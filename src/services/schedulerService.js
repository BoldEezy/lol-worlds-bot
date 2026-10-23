const cron = require('node-cron');
const config = require('../config');
const queries = require('../database/queries');
const lolEsportsService = require('./lolEsportsService');
const predictionEngine = require('./predictionEngine');
const embeds = require('../ui/embeds');
const components = require('../ui/components');

class SchedulerService {
  constructor() {
    this.client = null;
    this.cronTask = null;
    this.pollInterval = null;
    this.timerInterval = null;
    this.isRunning = false;
  }

  /**
   * Initializes cron and polling loops
   * @param {import('discord.js').Client} client
   */
  start(client) {
    if (this.isRunning) return;
    this.client = client;
    this.isRunning = true;

    console.log('[SchedulerService] Starting background services...');

    // 1. Daily announcement cron at 08:00 AM CET (Europe/Paris handles CET/CEST auto-switch)
    this.cronTask = cron.schedule(config.DAILY_PROMPT_CRON, async () => {
      console.log('[SchedulerService] 08:00 CET — checking for Worlds matches to announce...');
      await this.postDailyAnnouncement(this.client);
    }, {
      timezone: config.TIMEZONE // 'Europe/Paris' = CET in winter, CEST in summer
    });

    // 2. Periodic match sync & settlement polling
    const pollMs = config.RESULT_POLL_INTERVAL_MINUTES * 60 * 1000;
    this.pollInterval = setInterval(async () => {
      try {
        await this.checkAndSettleMatches(this.client);
      } catch (err) {
        console.error('[SchedulerService] Error during auto-settle poll:', err.message);
      }
    }, pollMs);

    // 3. Per-minute timers: lock reminders (30 min before) and crowd picks (at start)
    this.timerInterval = setInterval(() => {
      this.checkMatchTimers(this.client).catch(err => {
        console.error('[SchedulerService] Error during match timer check:', err.message);
      });
    }, 60 * 1000);

    console.log(`[SchedulerService] Daily cron set to ${config.DAILY_PROMPT_CRON} ${config.TIMEZONE}. Result poller every ${config.RESULT_POLL_INTERVAL_MINUTES}m.`);
  }

  stop() {
    if (this.cronTask) this.cronTask.stop();
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.isRunning = false;
    console.log('[SchedulerService] Stopped background services.');
  }

  /**
   * Posts the daily series prediction prompt to all configured guild channels
   * and sends DM reminders to opted-in users
   * @param {import('discord.js').Client} client
   * @param {string|null} targetGuildId - Optional specific guild
   */
  async postDailyAnnouncement(client, targetGuildId = null) {
    try {
      // Sync latest schedule from API first
      await lolEsportsService.syncMatchesToDatabase(true);

      // Get today's date in CET so matches at e.g. 17:00 UTC appear on the correct local date
      const todayCet = new Intl.DateTimeFormat('en-CA', { timeZone: config.TIMEZONE }).format(new Date());
      // Matchday key shifts by 6h so US evening series after midnight CET are included
      let matches = queries.getMatchesForDayCET(queries.getMatchdayKey(new Date().toISOString()), false);
      let dateLabel = `Today (${todayCet})`;

      // If auto-scheduled and no confirmed matches today in CET → skip silently, don't post anything
      if (matches.length === 0 && !targetGuildId) {
        console.log(`[SchedulerService] No confirmed Worlds matches on ${todayCet} CET — skipping daily announcement.`);
        return { success: false, reason: `No confirmed matches on ${todayCet} CET.` };
      }

      // If manually triggered with /postdaily and no matches today, fall back to next confirmed match day
      if (matches.length === 0 && targetGuildId) {
        matches = queries.getNextMatchDayMatches(false);
        if (matches.length > 0) {
          const nextCet = new Intl.DateTimeFormat('en-CA', { timeZone: config.TIMEZONE }).format(new Date(matches[0].start_time));
          dateLabel = `Next Match Day: ${nextCet}`;
        }
      }

      const promptEmbed = embeds.createDailyPromptEmbed(matches, dateLabel);
      const actionRow = components.createDailyPromptActionRow();

      // Get guilds to post to
      const guildSettingsList = targetGuildId
        ? [queries.getGuildSettings(targetGuildId)].filter(Boolean)
        : queries.getAllGuildSettings();

      let postedCount = 0;
      for (const settings of guildSettingsList) {
        if (!settings.channel_id) continue;
        try {
          const channel = await client.channels.fetch(settings.channel_id);
          if (channel && channel.isTextBased()) {
            const roleMention = settings.role_id ? `<@&${settings.role_id}> ` : '';
            await channel.send({
              content: roleMention ? `${roleMention}⚔️ Worlds 2026 matches are coming up! Lock in your predictions:` : null,
              embeds: [promptEmbed],
              components: [actionRow]
            });
            queries.updateLastPromptDate(settings.guild_id, todayCet);
            postedCount++;
          }
        } catch (err) {
          console.error(`[SchedulerService] Failed to post to channel ${settings.channel_id}:`, err.message);
        }
      }

      // Send DM reminders to opted-in users (once per day)
      this.sendDmReminders(client, matches, dateLabel).catch(err => {
        console.error('[SchedulerService] Failed sending DM reminders:', err.message);
      });

      return { success: true, postedCount, matchCount: matches.length };
    } catch (err) {
      console.error('[SchedulerService] Error posting daily announcement:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Dispatches direct DM notifications to opted-in participating users
   */
  async sendDmReminders(client, matches, dateLabel) {
    const reminderUsers = queries.getUsersForReminders();
    if (reminderUsers.length === 0) return;

    const embed = embeds.createDailyPromptEmbed(matches, dateLabel);
    const actionRow = components.createDailyPromptActionRow();

    for (const u of reminderUsers) {
      try {
        const discordUser = await client.users.fetch(u.user_id);
        if (discordUser) {
          await discordUser.send({
            content: `👋 Hey **${u.username}**! Worlds 2026 series are scheduled for ${dateLabel}. Don't forget to submit your score predictions:`,
            embeds: [embed],
            components: [actionRow]
          });
        }
      } catch (err) {
        console.warn(`[SchedulerService] Could not DM user ${u.user_id}: ${err.message}`);
      }
    }
  }

  /**
   * Polls API for completed games, settles predictions, and announces results
   * @param {import('discord.js').Client} client
   * @returns {Promise<{ settledCount: number }>}
   */
  async checkAndSettleMatches(client) {
    // 1. Sync latest from Riot API
    await lolEsportsService.syncMatchesToDatabase(false);

    // 2. Fetch completed but unsettled matches
    const unsettled = queries.getUnsettledCompletedMatches();
    if (unsettled.length === 0) {
      await this.postMatchdaySummary(client);
      return { settledCount: 0 };
    }

    console.log(`[SchedulerService] Found ${unsettled.length} completed matches to settle.`);
    let settledCount = 0;

    for (const m of unsettled) {
      try {
        const report = predictionEngine.settleMatch(m.match_id);
        if (!report.alreadySettled) {
          settledCount++;
          // Only broadcast settlement if users actually submitted predictions for this match!
          // This prevents posting results for matches nobody in the server predicted.
          if (report.totalPredictions > 0) {
            await this.broadcastMatchResult(client, report);
          }
        }
      } catch (err) {
        console.error(`[SchedulerService] Error settling match ${m.match_id}:`, err.message);
      }
    }

    await this.postMatchdaySummary(client);
    return { settledCount };
  }

  /**
   * Sends a payload to every configured guild channel
   */
  async sendToAllChannels(client, payload) {
    for (const settings of queries.getAllGuildSettings()) {
      try {
        const channel = await client.channels.fetch(settings.channel_id);
        if (channel && channel.isTextBased()) await channel.send(payload);
      } catch (err) {
        console.error(`[SchedulerService] Failed to post to ${settings.channel_id}:`, err.message);
      }
    }
  }

  /**
   * Posts a 30-minute lock reminder (pinging users without a pick) and,
   * once a series has started, reveals everyone's locked-in picks
   */
  async checkMatchTimers(client) {
    if (!client) return;
    const now = Date.now();
    const nearby = queries.getMatchesNearStart();

    // Lock reminders: one message per tick covering all series about to start
    const due = nearby.filter(m => new Date(m.start_time).getTime() > now && !queries.wasNotified(m.match_id, 'reminder'));
    if (due.length > 0) {
      const missing = new Map();
      due.forEach(m => queries.getUsersWithoutPrediction(m.match_id).forEach(u => missing.set(u.user_id, u)));
      due.forEach(m => queries.markNotified(m.match_id, 'reminder'));

      if (missing.size > 0) {
        const mentions = [...missing.keys()].slice(0, 40).map(id => `<@${id}>`).join(' ');
        const list = due.map(m => `• **${m.team1_code} vs ${m.team2_code}** (Bo${m.best_of}) — locks <t:${Math.floor(new Date(m.start_time).getTime() / 1000)}:R>`).join('\n');
        await this.sendToAllChannels(client, {
          content: `⏰ ${mentions}
Predictions lock soon and you haven't picked yet:
${list}`,
          components: [components.createDailyPromptActionRow()]
        });
      }
    }

    // Crowd picks: reveal once the series has started
    for (const m of nearby) {
      if (new Date(m.start_time).getTime() > now || queries.wasNotified(m.match_id, 'crowd')) continue;
      queries.markNotified(m.match_id, 'crowd');
      const predictions = queries.getPredictionsForMatch(m.match_id);
      if (predictions.length === 0) continue;
      await this.sendToAllChannels(client, { embeds: [embeds.createCrowdPickEmbed(m, predictions)] });
    }
  }

  /**
   * Once every series of the current matchday is completed and settled, posts a compact
   * results list plus the prediction leaderboard (once per matchday)
   */
  async postMatchdaySummary(client) {
    if (!client) return;
    try {
      const dayKey = queries.getMatchdayKey(new Date().toISOString());
      if (queries.isMatchdaySummaryPosted(dayKey)) return;

      const dayMatches = queries.getMatchesForMatchday(dayKey);
      if (dayMatches.length === 0) return;

      // Stale never-played placeholders (>24h past start) must not block the summary
      const staleMs = Date.now() - 24 * 3600 * 1000;
      const relevant = dayMatches.filter(m => m.state === 'completed' || new Date(m.start_time).getTime() > staleMs);
      const finished = relevant.filter(m => m.state === 'completed');
      if (finished.length === 0 || finished.length !== relevant.length || finished.some(m => m.settled !== 1)) return;

      const leaders = queries.getLeaderboard(15);
      const summaryEmbeds = embeds.createMatchdaySummaryEmbeds(finished, leaders, dayKey);

      for (const settings of queries.getAllGuildSettings()) {
        try {
          const channel = await client.channels.fetch(settings.channel_id);
          if (channel && channel.isTextBased()) {
            await channel.send({ embeds: summaryEmbeds });
          }
        } catch (err) {
          console.error(`[SchedulerService] Failed to post matchday summary to ${settings.channel_id}:`, err.message);
        }
      }

      queries.markMatchdaySummaryPosted(dayKey);
      console.log(`[SchedulerService] Posted matchday summary for ${dayKey} (${finished.length} series).`);
    } catch (err) {
      console.error('[SchedulerService] Error posting matchday summary:', err.message);
    }
  }

  /**
   * Broadcasts the match conclusion embed to all server channels
   */
  async broadcastMatchResult(client, report) {
    if (!client) return;
    const allSettings = queries.getAllGuildSettings();
    const resultEmbed = embeds.createMatchResultEmbed(report);

    for (const settings of allSettings) {
      if (!settings.channel_id) continue;
      try {
        const channel = await client.channels.fetch(settings.channel_id);
        if (channel && channel.isTextBased()) {
          await channel.send({ embeds: [resultEmbed] });
        }
      } catch (err) {
        console.error(`[SchedulerService] Failed to broadcast match result to ${settings.channel_id}:`, err.message);
      }
    }
  }
}

module.exports = new SchedulerService();
