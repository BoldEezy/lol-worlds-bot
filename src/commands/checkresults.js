const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const schedulerService = require('../services/schedulerService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('checkresults')
    .setDescription('Manually poll the LoL Esports API and settle any newly completed matches')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const { settledCount } = await schedulerService.checkAndSettleMatches(interaction.client);
      return interaction.editReply({
        content: settledCount > 0
          ? `✅ Successfully settled **${settledCount}** completed series and awarded points to users!`
          : 'ℹ️ LoL Esports schedule is up to date. No newly completed matches needed settling at this moment.'
      });
    } catch (err) {
      return interaction.editReply({
        content: `❌ Error checking results: ${err.message}`
      });
    }
  }
};
