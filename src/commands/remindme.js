const { SlashCommandBuilder } = require('discord.js');
const queries = require('../database/queries');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Toggle direct DM reminders before Worlds 2026 daily series begin'),

  async execute(interaction) {
    queries.ensureUser(interaction.user.id, interaction.user.username);
    const user = queries.getUser(interaction.user.id);
    const newStatus = !(user && user.dm_reminders === 1);

    queries.setDmReminders(interaction.user.id, newStatus);

    return interaction.reply({
      content: newStatus
        ? '🔔 **DM Reminders Enabled!** You will receive a direct message with the match schedule before daily series begin so you never miss locking in your predictions.'
        : '🔕 **DM Reminders Disabled.** You will no longer receive direct messages for daily series.',
      ephemeral: true
    });
  }
};
