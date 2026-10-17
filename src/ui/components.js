const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder
} = require('discord.js');

module.exports = {
  /**
   * Action row with primary buttons attached to daily announcement
   */
  createDailyPromptActionRow() {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_daily_predict')
        .setLabel('🎯 Submit Predictions')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('btn_daily_mypredictions')
        .setLabel('📋 My Predictions')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_daily_leaderboard')
        .setLabel('🏆 Leaderboard')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('btn_toggle_reminders')
        .setLabel('🔔 Reminders')
        .setStyle(ButtonStyle.Secondary)
    );
  },

  /**
   * Select menu to pick which match to predict from today's / upcoming matches
   */
  createMatchSelectMenu(matches) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_match_to_predict')
      .setPlaceholder('Choose a Worlds series to predict...')
      .setMinValues(1)
      .setMaxValues(1);

    matches.slice(0, 25).forEach(m => {
      const bestOfLabel = `Bo${m.best_of}`;
      const title = `${m.team1_code} vs ${m.team2_code} (${bestOfLabel})`;
      const desc = `${m.block_name || 'Worlds'} • Starts: ${new Date(m.start_time).toLocaleDateString()}`;

      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(title.substring(0, 100))
          .setDescription(desc.substring(0, 100))
          .setValue(`match_${m.match_id}`)
          .setEmoji('⚔️')
      );
    });

    return new ActionRowBuilder().addComponents(selectMenu);
  },

  /**
   * Generates interactive score prediction buttons for a specific match
   * @param {Object} match
   * @param {Object} existingPrediction
   * @returns {Array<ActionRowBuilder>}
   */
  createScorePredictionButtons(match, existingPrediction = null) {
    const rows = [];
    const bestOf = Number(match.best_of);
    const t1Code = match.team1_code;
    const t2Code = match.team2_code;

    const currentWinner = existingPrediction ? existingPrediction.predicted_winner_code : null;
    const currentT1Score = existingPrediction ? existingPrediction.predicted_team1_score : null;
    const currentT2Score = existingPrediction ? existingPrediction.predicted_team2_score : null;

    const isCurrentPick = (winner, s1, s2) => {
      return currentWinner === winner && currentT1Score === s1 && currentT2Score === s2;
    };

    if (bestOf === 1) {
      const row1 = new ActionRowBuilder();
      const t1Pick = isCurrentPick(t1Code, 1, 0);
      const t2Pick = isCurrentPick(t2Code, 0, 1);

      row1.addComponents(
        new ButtonBuilder()
          .setCustomId(`pred_${match.match_id}_${t1Code}_1_0`)
          .setLabel(`${t1Code} Wins (1-0)${t1Pick ? ' [Selected]' : ''}`)
          .setStyle(t1Pick ? ButtonStyle.Success : ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`pred_${match.match_id}_${t2Code}_0_1`)
          .setLabel(`${t2Code} Wins (0-1)${t2Pick ? ' [Selected]' : ''}`)
          .setStyle(t2Pick ? ButtonStyle.Success : ButtonStyle.Danger)
      );
      rows.push(row1);
    } else if (bestOf === 3) {
      // Team 1 scores: 2-0, 2-1
      const row1 = new ActionRowBuilder();
      [
        { score1: 2, score2: 0, label: `${t1Code} (2 - 0)` },
        { score1: 2, score2: 1, label: `${t1Code} (2 - 1)` }
      ].forEach(item => {
        const selected = isCurrentPick(t1Code, item.score1, item.score2);
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`pred_${match.match_id}_${t1Code}_${item.score1}_${item.score2}`)
            .setLabel(`${item.label}${selected ? ' ★' : ''}`)
            .setStyle(selected ? ButtonStyle.Success : ButtonStyle.Primary)
        );
      });
      rows.push(row1);

      // Team 2 scores: 0-2, 1-2
      const row2 = new ActionRowBuilder();
      [
        { score1: 0, score2: 2, label: `${t2Code} (0 - 2)` },
        { score1: 1, score2: 2, label: `${t2Code} (1 - 2)` }
      ].forEach(item => {
        const selected = isCurrentPick(t2Code, item.score1, item.score2);
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`pred_${match.match_id}_${t2Code}_${item.score1}_${item.score2}`)
            .setLabel(`${item.label}${selected ? ' ★' : ''}`)
            .setStyle(selected ? ButtonStyle.Success : ButtonStyle.Danger)
        );
      });
      rows.push(row2);
    } else if (bestOf === 5) {
      // Team 1 scores: 3-0, 3-1, 3-2
      const row1 = new ActionRowBuilder();
      [
        { score1: 3, score2: 0, label: `${t1Code} (3 - 0)` },
        { score1: 3, score2: 1, label: `${t1Code} (3 - 1)` },
        { score1: 3, score2: 2, label: `${t1Code} (3 - 2)` }
      ].forEach(item => {
        const selected = isCurrentPick(t1Code, item.score1, item.score2);
        row1.addComponents(
          new ButtonBuilder()
            .setCustomId(`pred_${match.match_id}_${t1Code}_${item.score1}_${item.score2}`)
            .setLabel(`${item.label}${selected ? ' ★' : ''}`)
            .setStyle(selected ? ButtonStyle.Success : ButtonStyle.Primary)
        );
      });
      rows.push(row1);

      // Team 2 scores: 0-3, 1-3, 2-3
      const row2 = new ActionRowBuilder();
      [
        { score1: 0, score2: 3, label: `${t2Code} (0 - 3)` },
        { score1: 1, score2: 3, label: `${t2Code} (1 - 3)` },
        { score1: 2, score2: 3, label: `${t2Code} (2 - 3)` }
      ].forEach(item => {
        const selected = isCurrentPick(t2Code, item.score1, item.score2);
        row2.addComponents(
          new ButtonBuilder()
            .setCustomId(`pred_${match.match_id}_${t2Code}_${item.score1}_${item.score2}`)
            .setLabel(`${item.label}${selected ? ' ★' : ''}`)
            .setStyle(selected ? ButtonStyle.Success : ButtonStyle.Danger)
        );
      });
      rows.push(row2);
    }

    // Navigation / Action row
    const rowNav = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_back_to_matches')
        .setLabel('⬅️ Change Match')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('btn_view_current_standings')
        .setLabel('🏆 View Standings')
        .setStyle(ButtonStyle.Secondary)
    );
    rows.push(rowNav);

    return rows;
  }
};
