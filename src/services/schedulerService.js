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

    // 1. Setup daily schedule announcement cron
    this.cronTask = cron.schedule(config.DAILY_PROMPT_CRON, async () => {
      console.log('[SchedulerService] Triggering scheduled daily prompt...');
      await this.postDailyAnnouncement(this.client);
    }, {
      timezone: 'UTC'
    });

    // 2. Setup periodic match sync & settlement polling
    const pollMs = config.RESULT_POLL_INTERVAL_MINUTES * 60 * 1000;
    this.pollInterval = setInterval(async () => {
      try {
        await this.checkAndSettleMatches(this.client);
      } catch (err) {
        console.error('[SchedulerService] Error during auto-settle poll:', err.message);
      }
    }, pollMs);

    console.log(`[SchedulerService] Daily cron active (${config.DAILY_PROMPT_CRON} UTC). Result poller running every ${config.RESULT_POLL_INTERVAL_MINUTES}m.`);
  }

  stop() {
    if (this.cronTask) this.cronTask.stop();
    if (this.pollInterval) clearInterval(this.pollInterval);
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

      const todayIso = new Date().toISOString();
      let matches = queries.getMatchesForDate(todayIso);

      // If no matches today, grab the next available match day series
      let dateLabel = 'Today';
      if (matches.length === 0) {
        matches = queries.getNextMatchDayMatches();
        if (matches.length > 0) {
          dateLabel = `Next Match Day: ${matches[0].start_time.substring(0, 10)}`;
        }
      }

      if (matches.length === 0) {
        console.log('[SchedulerService] No matches found for daily announcement.');
        return { success: false, reason: 'No upcoming matches found in schedule.' };
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
            queries.updateLastPromptDate(settings.guild_id, todayIso.substring(0, 10));
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

    return { settledCount };
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
