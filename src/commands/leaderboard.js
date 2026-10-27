const { SlashCommandBuilder } = require('discord.js');
const queries = require('../database/queries');
const embeds = require('../ui/embeds');
const schedulerService = require('../services/schedulerService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the server prediction leaderboard and rankings')
    .addIntegerOption(option =>
      option.setName('limit')
        .setDescription('Number of summoners to display (default: 10, max: 25)')
        .setMinValue(1)
        .setMaxValue(25)
        .setRequired(false)
    ),

  async execute(interaction) {
    const limit = interaction.options.getInteger('limit') || 10;

    // Defer first: the audit may post a score correction message before we reply
    await interaction.deferReply();
    await schedulerService.runScoreAudit(interaction.client);

    const leaders = queries.getLeaderboard(limit);
    const userRank = queries.getUserRank(interaction.user.id);

    const embed = embeds.createLeaderboardEmbed(leaders, userRank, interaction.user.username);
    return interaction.editReply({ embeds: [embed] });
  }
};
