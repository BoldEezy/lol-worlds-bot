const { SlashCommandBuilder } = require('discord.js');
const queries = require('../database/queries');
const embeds = require('../ui/embeds');

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
    const leaders = queries.getLeaderboard(limit);
    const userRank = queries.getUserRank(interaction.user.id);

    const embed = embeds.createLeaderboardEmbed(leaders, userRank, interaction.user.username);
    return interaction.reply({ embeds: [embed] });
  }
};
