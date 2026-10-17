const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const queries = require('../database/queries');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('matches')
    .setDescription('View Worlds 2026 matches and schedule')
    .addStringOption(option =>
      option.setName('filter')
        .setDescription('Filter matches to display')
        .setRequired(false)
        .addChoices(
          { name: 'Upcoming Series', value: 'upcoming' },
          { name: "Today's Series", value: 'today' },
          { name: 'Recent Results', value: 'results' }
        )
    ),

  async execute(interaction) {
    const filter = interaction.options.getString('filter') || 'upcoming';
    const embed = new EmbedBuilder().setColor(config.COLORS.WORLDS_GOLD).setTimestamp();

    if (filter === 'today') {
      const todayIso = new Date().toISOString();
      let matches = queries.getMatchesForDate(todayIso, false);
      let titleSuffix = 'Today';

      if (matches.length === 0) {
        matches = queries.getNextMatchDayMatches(false);
        if (matches.length > 0) {
          titleSuffix = `Next Confirmed Match Day (${matches[0].start_time.substring(0, 10)})`;
        }
      }

      embed.setTitle(`📅 Worlds 2026 Series • ${titleSuffix}`);
      if (matches.length === 0) {
        embed.setDescription(
          '⏳ **Awaiting Swiss Stage Draw**\n' +
          'All upcoming Swiss Stage matches currently have **TBD** teams (matches with TBD cannot be predicted yet).\n' +
          'As soon as teams are confirmed in the official draw, they will appear here!\n\n' +
          '💡 *Tip: Admins can test predictions anytime using `/simulatematch create`.*'
        );
      } else {
        matches.forEach((m, idx) => {
          const unix = Math.floor(new Date(m.start_time).getTime() / 1000);
          const maxPts = m.best_of === 5 ? '4 pts' : (m.best_of === 3 ? '3 pts' : '1 pt');
          embed.addFields({
            name: `${idx + 1}. [Bo${m.best_of}] ${m.team1_name} vs ${m.team2_name}`,
            value: `**Stage:** ${m.block_name || 'Worlds'} | **Max Points:** \`${maxPts}\`\n**Starts:** <t:${unix}:F> (<t:${unix}:R>)\n*(ID: \`${m.match_id}\`)*`,
            inline: false
          });
        });
      }
    } else if (filter === 'results') {
      const db = require('../database/db').getDb();
      const results = db.prepare(`
        SELECT * FROM matches
        WHERE state = 'completed'
        ORDER BY datetime(start_time) DESC
        LIMIT 10
      `).all();

      embed.setTitle('🏁 Worlds 2026 • Recent Match Results');
      if (results.length === 0) {
        embed.setDescription('No completed matches recorded yet for Worlds 2026 Swiss Stage.');
      } else {
        results.forEach((m, idx) => {
          const score = `${m.team1_code} ${m.team1_score} - ${m.team2_score} ${m.team2_code}`;
          embed.addFields({
            name: `${idx + 1}. [Bo${m.best_of}] ${m.team1_name} vs ${m.team2_name}`,
            value: `🏆 **Result:** \`${score}\` (Winner: **${m.winner_code}**)\n**Stage:** ${m.block_name || 'Worlds'}`,
            inline: false
          });
        });
      }
    } else {
      // Upcoming (excluding TBD by default)
      const matches = queries.getUpcomingMatches(10, false);
      embed.setTitle('⚔️ Worlds 2026 • Upcoming Series');
      if (matches.length === 0) {
        embed.setDescription(
          '⏳ **Awaiting Swiss Stage Draw**\n' +
          'All upcoming Swiss Stage matches currently have **TBD** teams (matches with TBD cannot be predicted yet).\n' +
          'As soon as teams are confirmed in the official draw, they will appear here with live prediction buttons!\n\n' +
          '💡 *Tip: Admins can test predictions anytime using `/simulatematch create`.*'
        );
      } else {
        matches.forEach((m, idx) => {
          const unix = Math.floor(new Date(m.start_time).getTime() / 1000);
          const maxPts = m.best_of === 5 ? '4 pts' : (m.best_of === 3 ? '3 pts' : '1 pt');
          embed.addFields({
            name: `${idx + 1}. [Bo${m.best_of}] ${m.team1_name} vs ${m.team2_name}`,
            value: `**Starts:** <t:${unix}:F> (<t:${unix}:R>)\n**Stage:** ${m.block_name || 'Worlds'} | **Max Points:** \`${maxPts}\`\n*Predict with: \`/predict match_id:${m.match_id}\`*`,
            inline: false
          });
        });
      }
    }

    embed.setFooter({ text: 'LoL Worlds 2026 Predictions • Use /predict to make your picks!' });
    return interaction.reply({ embeds: [embed] });
  }
};
