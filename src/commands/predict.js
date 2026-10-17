const { SlashCommandBuilder } = require('discord.js');
const queries = require('../database/queries');
const predictionEngine = require('../services/predictionEngine');
const embeds = require('../ui/embeds');
const components = require('../ui/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('predict')
    .setDescription('Submit or view your score prediction for a Worlds 2026 series')
    .addStringOption(option =>
      option.setName('match_id')
        .setDescription('Optional specific match ID to predict')
        .setRequired(false)
    ),

  async execute(interaction) {
    queries.ensureUser(interaction.user.id, interaction.user.username);
    const matchId = interaction.options.getString('match_id');

    if (matchId) {
      const match = queries.getMatch(matchId);
      if (!match) {
        return interaction.reply({
          content: `❌ Match with ID \`${matchId}\` was not found. Use \`/matches\` to view available series.`,
          ephemeral: true
        });
      }

      const check = predictionEngine.isMatchOpenForPrediction(match);
      if (!check.isOpen) {
        return interaction.reply({
          content: `🔒 **${match.team1_code} vs ${match.team2_code}** is closed for predictions: ${check.reason}`,
          ephemeral: true
        });
      }

      const existing = queries.getUserPrediction(interaction.user.id, matchId);
      const embed = embeds.createMatchPredictionEmbed(match, existing);
      const rows = components.createScorePredictionButtons(match, existing);

      return interaction.reply({
        embeds: [embed],
        components: rows,
        ephemeral: true
      });
    }

    // No match ID provided: show list of upcoming matches to choose from
    const upcoming = queries.getUpcomingMatches(15);
    if (upcoming.length === 0) {
      return interaction.reply({
        content: '📅 There are currently no upcoming matches open for prediction. Check `/matches` for tournament schedule!',
        ephemeral: true
      });
    }

    const selectMenuRow = components.createMatchSelectMenu(upcoming);
    return interaction.reply({
      content: '🎯 **Select a Worlds 2026 series to submit or update your prediction:**',
      components: [selectMenuRow],
      ephemeral: true
    });
  }
};
