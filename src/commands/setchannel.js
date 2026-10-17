const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const queries = require('../database/queries');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setchannel')
    .setDescription('Set the server channel for daily prediction announcements and match results')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addChannelOption(option =>
      option.setName('channel')
        .setDescription('The text channel to send daily prompts and match result announcements')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(true)
    )
    .addRoleOption(option =>
      option.setName('role')
        .setDescription('Optional role to ping when daily matchups are posted')
        .setRequired(false)
    ),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const role = interaction.options.getRole('role');

    queries.setGuildChannel(interaction.guildId, channel.id, role ? role.id : null);

    let reply = `✅ **Prediction Channel Configured!**\n• **Channel:** <#${channel.id}>\n`;
    if (role) {
      reply += `• **Mention Role:** <@&${role.id}>\n`;
    } else {
      reply += `• **Mention Role:** None\n`;
    }
    reply += `The bot will automatically post daily match series announcements here and announce final scores when matches conclude.\n` +
      `💡 *Tip: Run \`/postdaily\` right now to send today's matchup embed immediately.*`;

    return interaction.reply({ content: reply, ephemeral: false });
  }
};
