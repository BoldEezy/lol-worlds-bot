const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const queries = require('../database/queries');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mypredictions')
    .setDescription('View your active and settled predictions for Worlds 2026'),

  async execute(interaction) {
    queries.ensureUser(interaction.user.id, interaction.user.username);
    const predictions = queries.getUserPredictions(interaction.user.id, 15);

    const embed = new EmbedBuilder()
      .setColor(config.COLORS.HEXTECH_BLUE)
      .setTitle(`📋 Predictions for ${interaction.user.username}`)
      .setTimestamp();

    if (predictions.length === 0) {
      embed.setDescription(
        'You have not submitted any predictions yet!\n' +
        'Use `/predict` or click **[🎯 Submit Predictions]** on the daily announcement to get started.'
      );
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    const pending = predictions.filter(p => p.settled === 0);
    const settled = predictions.filter(p => p.settled === 1);

    if (pending.length > 0) {
      let pendingText = '';
      pending.forEach(p => {
        const unix = Math.floor(new Date(p.start_time).getTime() / 1000);
        pendingText += `• **${p.team1_code} vs ${p.team2_code}** (Bo${p.best_of}): Picked **${p.predicted_winner_code}** (${p.predicted_team1_score}-${p.predicted_team2_score})\n  Starts: <t:${unix}:R>\n`;
      });
      embed.addFields({ name: '⏳ Active / Pending Predictions', value: pendingText });
    }

    if (settled.length > 0) {
      let settledText = '';
      settled.slice(0, 8).forEach(p => {
        const icon = p.exact_score_hit ? '🎯' : (p.winner_correct ? '✅' : '❌');
        const finalScore = `${p.team1_score}-${p.team2_score}`;
        settledText += `${icon} **${p.team1_code} vs ${p.team2_code}** (Bo${p.best_of}): Picked **${p.predicted_winner_code}** (${p.predicted_team1_score}-${p.predicted_team2_score}) | Actual: **${p.winner_code}** (${finalScore}) | **+${p.points_awarded} pts**\n`;
      });
      embed.addFields({ name: '🏁 Recent Results', value: settledText });
    }

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
