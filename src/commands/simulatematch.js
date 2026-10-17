const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const lolEsportsService = require('../services/lolEsportsService');
const predictionEngine = require('../services/predictionEngine');
const schedulerService = require('../services/schedulerService');
const queries = require('../database/queries');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('simulatematch')
    .setDescription('Simulate a match to test predictions and scoring anytime (Admin Only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a mock match open for predictions')
        .addIntegerOption(opt =>
          opt.setName('best_of')
            .setDescription('Series format (1, 3, or 5)')
            .setRequired(true)
            .addChoices(
              { name: 'Best of 5 (Bo5)', value: 5 },
              { name: 'Best of 3 (Bo3)', value: 3 },
              { name: 'Best of 1 (Bo1)', value: 1 }
            )
        )
        .addStringOption(opt => opt.setName('team1').setDescription('Team 1 Name/Code (default: T1)').setRequired(false))
        .addStringOption(opt => opt.setName('team2').setDescription('Team 2 Name/Code (default: GEN)').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('complete')
        .setDescription('Conclude a match with final scores to award points and test scoring rules')
        .addStringOption(opt => opt.setName('match_id').setDescription('ID of match to complete').setRequired(true))
        .addIntegerOption(opt => opt.setName('team1_score').setDescription('Games won by Team 1').setRequired(true))
        .addIntegerOption(opt => opt.setName('team2_score').setDescription('Games won by Team 2').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const bestOf = interaction.options.getInteger('best_of');
      const team1 = interaction.options.getString('team1') || 'T1';
      const team2 = interaction.options.getString('team2') || 'GEN';
      const mockId = `mock_${Date.now()}`;

      // Start time 2 hours from now so predictions are open
      const startTime = new Date(Date.now() + 2 * 3600 * 1000).toISOString();

      const created = lolEsportsService.createMockMatch({
        matchId: mockId,
        team1Name: team1,
        team1Code: team1.substring(0, 4).toUpperCase(),
        team2Name: team2,
        team2Code: team2.substring(0, 4).toUpperCase(),
        bestOf,
        startTime,
        blockName: 'Simulation Exhibition'
      });

      return interaction.reply({
        content: `🎮 **Mock Match Created!**\n` +
          `• **Series:** [Bo${created.best_of}] **${created.team1_code} vs ${created.team2_code}**\n` +
          `• **Match ID:** \`${created.match_id}\`\n` +
          `• Users can now predict using: \`/predict match_id:${created.match_id}\`\n\n` +
          `*When you're ready to test scoring, run:*\n` +
          `\`/simulatematch complete match_id:${created.match_id} team1_score:3 team2_score:1\``,
        ephemeral: false
      });
    }

    if (sub === 'complete') {
      const matchId = interaction.options.getString('match_id');
      const t1Score = interaction.options.getInteger('team1_score');
      const t2Score = interaction.options.getInteger('team2_score');

      const match = queries.getMatch(matchId);
      if (!match) {
        return interaction.reply({
          content: `❌ Match with ID \`${matchId}\` not found in database.`,
          ephemeral: true
        });
      }

      await interaction.deferReply();

      lolEsportsService.completeMockMatch(matchId, t1Score, t2Score);
      const report = predictionEngine.settleMatch(matchId);

      // Broadcast result announcement to configured server channels
      await schedulerService.broadcastMatchResult(interaction.client, report);

      return interaction.editReply({
        content: `🏁 **Match ${matchId} completed and settled!**\n` +
          `• Final: **${match.team1_code} ${t1Score} - ${t2Score} ${match.team2_code}**\n` +
          `• Winner: **${match.winner_code}**\n` +
          `• Total predictions settled: \`${report.totalPredictions}\`\n` +
          `Check <#${queries.getGuildSettings(interaction.guildId)?.channel_id || 'the announcement channel'}> for the settlement announcement!`
      });
    }
  }
};
