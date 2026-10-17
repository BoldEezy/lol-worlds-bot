const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const schedulerService = require('../services/schedulerService');
const queries = require('../database/queries');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('postdaily')
    .setDescription('Manually post the Worlds 2026 daily series prediction call into the announcement channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const settings = queries.getGuildSettings(interaction.guildId);
    if (!settings || !settings.channel_id) {
      return interaction.reply({
        content: '⚠️ Announcement channel has not been set yet! Run `/setchannel` first to choose where predictions should be posted.',
        ephemeral: true
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const result = await schedulerService.postDailyAnnouncement(interaction.client, interaction.guildId);

    if (result.success) {
      return interaction.editReply({
        content: `✅ Successfully posted Worlds 2026 series prediction prompt into <#${settings.channel_id}> (${result.matchCount} series included)!`
      });
    } else {
      return interaction.editReply({
        content: `❌ Could not post daily announcement: ${result.error || result.reason}`
      });
    }
  }
};
