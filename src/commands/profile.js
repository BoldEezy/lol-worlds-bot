const { SlashCommandBuilder } = require('discord.js');
const queries = require('../database/queries');
const embeds = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View prediction stats and accuracy breakdown for a summoner')
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The summoner to view (defaults to yourself)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const targetDiscordUser = interaction.options.getUser('user') || interaction.user;
    queries.ensureUser(targetDiscordUser.id, targetDiscordUser.username);

    const userStats = queries.getUser(targetDiscordUser.id);
    const userRank = queries.getUserRank(targetDiscordUser.id);
    const recentPredictions = queries.getUserPredictions(targetDiscordUser.id, 5);

    const embed = embeds.createUserProfileEmbed(userStats, userRank, recentPredictions);
    return interaction.reply({ embeds: [embed] });
  }
};
