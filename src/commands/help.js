const { SlashCommandBuilder } = require('discord.js');
const embeds = require('../ui/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View the Worlds 2026 score predictions guide, rules, and commands'),

  async execute(interaction) {
    const embed = embeds.createHelpEmbed();
    return interaction.reply({ embeds: [embed] });
  }
};
