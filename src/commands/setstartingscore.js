const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const queries = require('../database/queries');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setstartingscore')
    .setDescription('Set the points a user carries over from before the bot was added (Admin Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addUserOption(option =>
      option.setName('user')
        .setDescription('The user to set a starting score for')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('points')
        .setDescription('Starting points (replaces any previous starting score; 0 to clear)')
        .setMinValue(0)
        .setRequired(true)
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user');
    const points = interaction.options.getInteger('points');

    if (target.bot) {
      return interaction.reply({ content: '❌ Bots cannot take part in predictions.', ephemeral: true });
    }

    queries.ensureUser(target.id, target.username);
    const previous = queries.setStartingPoints(target.id, points);
    const user = queries.getUser(target.id);

    return interaction.reply({
      content: `✅ Starting score for <@${target.id}> set to **${points} pts** (was ${previous} pts).\n` +
        `• **New total:** \`${user.total_points} pts\``,
      allowedMentions: { users: [] },
      ephemeral: false
    });
  }
};
