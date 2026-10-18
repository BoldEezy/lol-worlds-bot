const { EmbedBuilder } = require('discord.js');
const config = require('../config');

function getDiscordTimestamp(isoString) {
  if (!isoString) return 'TBD';
  const unix = Math.floor(new Date(isoString).getTime() / 1000);
  return `<t:${unix}:F> (<t:${unix}:R>)`;
}

function getShortDiscordTimestamp(isoString) {
  if (!isoString) return 'TBD';
  const unix = Math.floor(new Date(isoString).getTime() / 1000);
  return `<t:${unix}:t> (<t:${unix}:R>)`;
}

module.exports = {
  /**
   * Daily announcement embed sent to the server channel
   */
  createDailyPromptEmbed(matches, targetDate = 'Today') {
    const embed = new EmbedBuilder()
      .setColor(config.COLORS.WORLDS_GOLD)
      .setTitle(`🏆 LoL Worlds 2026 • Daily Match Predictions (${targetDate})`)
      .setDescription(
        `Summoners! Worlds series are scheduled for today! Make sure to lock in your score predictions before each series begins.\n\n` +
        `**📜 Scoring System:**\n` +
        `• **Bo5**: **3 pts** for correct winner + **1 extra pt** for exact score *(Max: 4 pts)*\n` +
        `• **Bo3**: **2 pts** for correct winner + **1 extra pt** for exact score *(Max: 3 pts)*\n` +
        `• **Bo1**: **1 pt** for correct winner\n` +
        `*(Predictions lock at scheduled match start time)*`
      )
      .setThumbnail('https://static.lolesports.com/leagues/1592594612171_WorldsDarkBG.png')
      .setFooter({ text: 'LoL Worlds 2026 Score Predictions • Click [🎯 Submit Predictions] below!' })
      .setTimestamp();

    if (!matches || matches.length === 0) {
      embed.addFields({
        name: '⏳ Awaiting Confirmed Matchups',
        value: 'Upcoming Swiss Stage series are currently pending the official draw (TBD matchups are hidden).\n' +
          'As soon as teams are confirmed, prediction cards will unlock here automatically!\n\n' +
          '💡 *Tip: Admins can create a mock series anytime using `/simulatematch create` to test predictions.*'
      });
      return embed;
    }

    matches.forEach((m, idx) => {
      const bestOfLabel = `Bo${m.best_of}`;
      const maxPts = m.best_of === 5 ? '4 pts' : (m.best_of === 3 ? '3 pts' : '1 pt');
      const timeStr = getDiscordTimestamp(m.start_time);

      embed.addFields({
        name: `${idx + 1}. [${bestOfLabel}] ${m.team1_name} (${m.team1_code}) vs ${m.team2_name} (${m.team2_code})`,
        value: `**Stage:** ${m.block_name || 'Worlds 2026'} | **Max Points:** \`${maxPts}\`\n**Starts:** ${timeStr}\n*(Match ID: \`${m.match_id}\`)*`,
        inline: false
      });
    });

    return embed;
  },

  /**
   * Interactive match details card for submitting predictions
   */
  createMatchPredictionEmbed(match, existingPrediction = null) {
    const embed = new EmbedBuilder()
      .setColor(config.COLORS.HEXTECH_BLUE)
      .setTitle(`🎯 Series Prediction: ${match.team1_name} vs ${match.team2_name}`)
      .setDescription(
        `**Format:** Best of ${match.best_of} (Bo${match.best_of})\n` +
        `**Stage:** ${match.block_name || 'Worlds 2026'}\n` +
        `**Start Time:** ${getDiscordTimestamp(match.start_time)}\n\n` +
        `**Scoring Breakdown for Bo${match.best_of}:**\n` +
        (match.best_of === 5
          ? `• Right Winner: **3 points**\n• Exact Score Bonus: **+1 point**\n• **Total Possible: 4 points**`
          : match.best_of === 3
            ? `• Right Winner: **2 points**\n• Exact Score Bonus: **+1 point**\n• **Total Possible: 3 points**`
            : `• Right Winner: **1 point** (Bo1)`)
      );

    if (match.team1_image) {
      embed.setThumbnail(match.team1_image);
    }

    if (existingPrediction) {
      const predictedWinner = existingPrediction.predicted_winner_code;
      const scoreStr = `${existingPrediction.predicted_team1_score} - ${existingPrediction.predicted_team2_score}`;
      embed.addFields({
        name: '📌 Your Current Pick',
        value: `Winner: **${predictedWinner}** | Score: **${scoreStr}**\n*(You can update your pick by clicking any button below before match start)*`,
        inline: false
      });
    } else {
      embed.addFields({
        name: '⏳ Status',
        value: 'You have not submitted a prediction for this series yet. Select your score prediction below!',
        inline: false
      });
    }

    return embed;
  },

  /**
   * Confirmation embed after user clicks a score prediction button
   */
  createPredictionSuccessEmbed(match, predictedWinnerCode, t1Score, t2Score) {
    const isExactEligible = match.best_of > 1;
    const maxPoints = match.best_of === 5 ? 4 : (match.best_of === 3 ? 3 : 1);
    const winPoints = match.best_of === 5 ? 3 : (match.best_of === 3 ? 2 : 1);

    const embed = new EmbedBuilder()
      .setColor(config.COLORS.VICTORY_GREEN)
      .setTitle('✅ Prediction Locked In!')
      .setDescription(
        `Your prediction for **${match.team1_name} vs ${match.team2_name}** has been recorded:\n\n` +
        `🏆 **Predicted Winner:** \`${predictedWinnerCode}\`\n` +
        `🔢 **Predicted Series Score:** \`${t1Score} - ${t2Score}\` (${match.team1_code} vs ${match.team2_code})\n` +
        `⭐ **Potential Points:** \`${maxPoints} pts\` (${winPoints} win${isExactEligible ? ' + 1 exact score' : ''})\n` +
        `🔒 **Locks at:** ${getDiscordTimestamp(match.start_time)}\n\n` +
        `*Good luck! You can change your prediction anytime before the series starts.*`
      )
      .setTimestamp();

    return embed;
  },

  /**
   * Post-game settlement announcement embed
   */
  createMatchResultEmbed(report) {
    const match = report.match;
    const winnerName = match.winner_code === match.team1_code ? match.team1_name : match.team2_name;
    const finalScore = `${match.team1_score} - ${match.team2_score}`;

    const embed = new EmbedBuilder()
      .setColor(config.COLORS.WORLDS_GOLD)
      .setTitle(`🏁 Match Concluded: ${match.team1_name} vs ${match.team2_name}`)
      .setDescription(
        `The **Bo${match.best_of}** series has finished!\n\n` +
        `🏆 **Winner:** **${winnerName} (${match.winner_code})**\n` +
        `📊 **Final Score:** **${match.team1_code} ${finalScore} ${match.team2_code}**\n` +
        `👥 **Participating Users:** \`${report.totalPredictions}\``
      )
      .setThumbnail(match.winner_code === match.team1_code ? match.team1_image : match.team2_image)
      .setTimestamp();

    if (report.userResults.length > 0) {
      // Sort users by points earned descending
      const sorted = [...report.userResults].sort((a, b) => b.pointsEarned - a.pointsEarned);

      const exactHits = sorted.filter(u => u.isExactScore);
      const winHits = sorted.filter(u => u.isWinnerCorrect && !u.isExactScore);
      const misses = sorted.filter(u => !u.isWinnerCorrect);

      let pointsSummary = '';
      if (exactHits.length > 0) {
        const names = exactHits.map(u => `**${u.username}** (+${u.pointsEarned} pts 🎯)`).join(', ');
        pointsSummary += `**🎯 Exact Score Masters:**\n${names}\n\n`;
      }
      if (winHits.length > 0) {
        const names = winHits.map(u => `**${u.username}** (+${u.pointsEarned} pts)`).join(', ');
        pointsSummary += `**✅ Correct Winner:**\n${names}\n\n`;
      }
      if (misses.length > 0) {
        const names = misses.map(u => `${u.username}`).join(', ');
        pointsSummary += `**❌ Missed:** ${names}`;
      }

      embed.addFields({
        name: '🏅 Score Predictions Results',
        value: pointsSummary.length > 1024 ? pointsSummary.substring(0, 1020) + '...' : pointsSummary
      });
    } else {
      embed.addFields({
        name: 'Predictions',
        value: 'No users submitted predictions for this series.'
      });
    }

    embed.setFooter({ text: 'Worlds 2026 Score Predictions • Type /leaderboard to view standings' });
    return embed;
  },

  /**
   * Locked-in picks shown when a series starts
   */
  createCrowdPickEmbed(match, predictions) {
    const groups = {};
    predictions.forEach(p => {
      (groups[p.predicted_winner_code] = groups[p.predicted_winner_code] || []).push(p);
    });

    const fields = Object.entries(groups)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([code, list]) => ({
        name: `${code} • ${list.length} pick${list.length === 1 ? '' : 's'}`,
        value: list.map(p => `${p.username} (${p.predicted_team1_score}-${p.predicted_team2_score})`).join('\n').substring(0, 1024)
      }));

    return new EmbedBuilder()
      .setColor(config.COLORS.PURPLE_MYTHIC)
      .setTitle(`🔒 Picks Locked: ${match.team1_code} vs ${match.team2_code} (Bo${match.best_of})`)
      .setDescription(`Here is what everyone predicted (${match.team1_code} - ${match.team2_code} score):`)
      .addFields(fields);
  },

  /**
   * Compact end-of-matchday embed: one line per series plus the current leaderboard
   */
  createMatchdaySummaryEmbeds(matches, leaders, dayKey) {
    const resultLines = matches.map(m => {
      const t1Won = m.winner_code === m.team1_code;
      const t1 = t1Won ? `**${m.team1_code}**` : m.team1_code;
      const t2 = !t1Won ? `**${m.team2_code}**` : m.team2_code;
      return `${t1} ${m.team1_score}-${m.team2_score} ${t2} · Bo${m.best_of}`;
    }).join('\n');

    const resultsEmbed = new EmbedBuilder()
      .setColor(config.COLORS.WORLDS_GOLD)
      .setTitle(`🏁 Matchday Results • ${dayKey}`)
      .setDescription(resultLines.substring(0, 4000));

    const medals = ['🥇', '🥈', '🥉'];
    const boardLines = leaders.length > 0
      ? leaders.map((u, i) => `${i < 3 ? medals[i] : `\`#${i + 1}\``} **${u.username}** — ${u.total_points} pts (🎯${u.exact_scores} · ✅${u.correct_winners}/${u.total_predictions})`).join('\n')
      : 'No settled predictions yet.';

    const boardEmbed = new EmbedBuilder()
      .setColor(config.COLORS.HEXTECH_BLUE)
      .setTitle('🏆 Prediction Leaderboard')
      .setDescription(boardLines.substring(0, 4000))
      .setFooter({ text: 'Worlds 2026 Score Predictions' })
      .setTimestamp();

    return [resultsEmbed, boardEmbed];
  },

  /**
   * Global server leaderboard embed
   */
  createLeaderboardEmbed(users, userRank = null, requestedUsername = null) {
    const embed = new EmbedBuilder()
      .setColor(config.COLORS.WORLDS_GOLD)
      .setTitle('🏆 LoL Worlds 2026 • Server Leaderboard')
      .setDescription(
        'Points: **Bo5: 3+1 pts** | **Bo3: 2+1 pts** | **Bo1: 1 pt**\n' +
        '═════════════════════════════════════════'
      )
      .setThumbnail('https://static.lolesports.com/leagues/1592594612171_WorldsDarkBG.png')
      .setTimestamp();

    if (!users || users.length === 0) {
      embed.addFields({
        name: 'No Scores Yet',
        value: 'No predictions have been settled yet! Submit your predictions with `/predict` to get on the board.'
      });
      return embed;
    }

    const medals = ['🥇', '🥈', '🥉'];
    let leaderboardText = '';

    users.forEach((u, i) => {
      const badge = i < 3 ? medals[i] : `\`#${i + 1}\``;
      leaderboardText += `${badge} **${u.username}** — **${u.total_points} pts**\n` +
        `    └ 🎯 Exact: \`${u.exact_scores}\` | ✅ Wins: \`${u.correct_winners}/${u.total_predictions}\` (${u.win_rate}%)\n`;
    });

    embed.addFields({
      name: 'Top Summoners',
      value: leaderboardText
    });

    if (userRank && requestedUsername) {
      embed.setFooter({
        text: `Your Standing: #${userRank} (${requestedUsername}) • Submit picks before every match!`
      });
    } else {
      embed.setFooter({ text: 'LoL Worlds 2026 Predictions • Keep picking to climb the ranks!' });
    }

    return embed;
  },

  /**
   * User profile & stats embed
   */
  createUserProfileEmbed(user, rank, recentPredictions = []) {
    const winRate = user.total_predictions > 0
      ? Math.round((user.correct_winners / user.total_predictions) * 100)
      : 0;
    const exactRate = user.total_predictions > 0
      ? Math.round((user.exact_scores / user.total_predictions) * 100)
      : 0;

    const embed = new EmbedBuilder()
      .setColor(config.COLORS.HEXTECH_BLUE)
      .setTitle(`📊 Summoner Prediction Stats: ${user.username}`)
      .setDescription(
        `**Server Rank:** \`#${rank || 'Unranked'}\`\n` +
        `**Total Points:** \`${user.total_points} pts\`` +
        (user.starting_points ? ` *(incl. ${user.starting_points} carried over)*\n` : '\n') +
        `**Predictions Made:** \`${user.total_predictions}\`\n` +
        `**Winner Winrate:** \`${winRate}%\` (${user.correct_winners}/${user.total_predictions})\n` +
        `**Exact Score Rate:** \`${exactRate}%\` (${user.exact_scores} exact hits)`
      )
      .addFields({
        name: '📈 Points Breakdown by Format',
        value: `• **Bo5 Points:** \`${user.bo5_points || 0} pts\`\n` +
          `• **Bo3 Points:** \`${user.bo3_points || 0} pts\`\n` +
          `• **Bo1 Points:** \`${user.bo1_points || 0} pts\``,
        inline: true
      }, {
        name: '🔔 Preferences',
        value: `• **DM Reminders:** ${user.dm_reminders ? '✅ Enabled' : '❌ Disabled'}\n*(Use \`/remindme\` to toggle)*`,
        inline: true
      });

    if (recentPredictions.length > 0) {
      let recentText = '';
      recentPredictions.slice(0, 5).forEach(p => {
        const isSettled = p.settled === 1;
        const icon = isSettled
          ? (p.exact_score_hit ? '🎯' : (p.winner_correct ? '✅' : '❌'))
          : '⏳';
        const ptsStr = isSettled ? `(+${p.points_awarded} pts)` : '(Pending)';
        recentText += `${icon} **${p.team1_code} vs ${p.team2_code}** [Bo${p.best_of}]: Picked **${p.predicted_winner_code}** (${p.predicted_team1_score}-${p.predicted_team2_score}) ${ptsStr}\n`;
      });

      embed.addFields({
        name: '🕒 Recent Predictions',
        value: recentText,
        inline: false
      });
    }

    return embed;
  },

  /**
   * Help & rules guide embed
   */
  createHelpEmbed() {
    return new EmbedBuilder()
      .setColor(config.COLORS.WORLDS_GOLD)
      .setTitle('📖 LoL Worlds 2026 Score Predictions Guide')
      .setDescription(
        `Compete against other members in the server by predicting series winners and exact scores for the 2026 League of Legends World Championship!\n\n` +
        `### 🏆 Scoring Rules:\n` +
        `• **Best of 5 (Bo5)**:\n` +
        `  - Correct Series Winner: **3 points**\n` +
        `  - Exact Series Score Bonus: **+1 additional point** *(Max: 4 pts)*\n` +
        `• **Best of 3 (Bo3)**:\n` +
        `  - Correct Series Winner: **2 points**\n` +
        `  - Exact Series Score Bonus: **+1 additional point** *(Max: 3 pts)*\n` +
        `• **Best of 1 (Bo1)**:\n` +
        `  - Correct Winner: **1 point**\n\n` +
        `### 🕹️ Commands:\n` +
        `• \`/predict [match_id]\` — Submit or modify your prediction for a series\n` +
        `• \`/matches [filter]\` — View today's or upcoming Worlds 2026 series\n` +
        `• \`/leaderboard\` — View server rankings and points\n` +
        `• \`/mypredictions\` — View your active and past predictions\n` +
        `• \`/profile [@user]\` — View your accuracy, badges, and stats\n` +
        `• \`/remindme\` — Toggle DM reminders before daily series start\n\n` +
        `### ⚙️ Admin Commands:\n` +
        `• \`/setchannel #channel [@role]\` — Set the daily prompt & results channel\n` +
        `• \`/postdaily\` — Trigger today's daily match prediction prompt\n` +
        `• \`/checkresults\` — Manually poll API and settle finished matches\n` +
        `• \`/simulatematch\` — Create a mock series for testing & demoing anytime\n` +
        `• \`/setstartingscore @user points\` — Set points carried over from before the bot`
      )
      .setFooter({ text: 'LoL Worlds 2026 • May the best analyst win!' });
  }
};
