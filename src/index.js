const fs = require('fs');
const path = require('path');
const {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ActivityType
} = require('discord.js');

const config = require('./config');
const queries = require('./database/queries');
const lolEsportsService = require('./services/lolEsportsService');
const predictionEngine = require('./services/predictionEngine');
const schedulerService = require('./services/schedulerService');
const embeds = require('./ui/embeds');
const components = require('./ui/components');
const http = require('http');

// Optional lightweight health check server for cloud hosting (Railway, Render, etc.)
const PORT = process.env.PORT || 3000;
const healthServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'healthy',
    service: 'LoL Worlds 2026 Prediction Bot',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  }));
});

healthServer.listen(PORT, () => {
  console.log(`[Hosting] Health check server listening on port ${PORT}`);
});

// Verify token
if (!config.DISCORD_TOKEN) {
  console.warn('⚠️ WARNING: DISCORD_TOKEN is not set in .env. Bot will fail to connect until configured.');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ]
});

// Load slash commands
client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  const command = require(filePath);
  if ('data' in command && 'execute' in command) {
    client.commands.set(command.data.name, command);
  } else {
    console.warn(`[WARNING] Command at ${filePath} is missing required "data" or "execute" property.`);
  }
}

// Bot ready event
client.once(Events.ClientReady, async c => {
  console.log(`\n=================================================`);
  console.log(`🏆 LoL Worlds 2026 Score Prediction Bot Online!`);
  console.log(`🤖 Logged in as: ${c.user.tag} (ID: ${c.user.id})`);
  console.log(`🌐 Connected to ${c.guilds.cache.size} guilds.`);
  console.log(`=================================================\n`);

  // Set presence
  c.user.setActivity('Worlds 2026 Predictions | /help', {
    type: ActivityType.Watching
  });

  // Initial sync from Riot LoL Esports API
  try {
    console.log('[Startup] Performing initial schedule sync from LoL Esports API...');
    const result = await lolEsportsService.syncMatchesToDatabase(true);
    console.log(`[Startup] Schedule synced: ${result.total} matches (${result.unstarted} upcoming, ${result.completed} completed).`);
  } catch (err) {
    console.error('[Startup] Failed to sync schedule on startup:', err.message);
  }

  // Start schedulers (cron for daily prompt, polling for live match results)
  schedulerService.start(client);
});

// Interaction handling
client.on(Events.InteractionCreate, async interaction => {
  try {
    // 1. Handle Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
      }

      queries.ensureUser(interaction.user.id, interaction.user.username);
      await command.execute(interaction);
      return;
    }

    // 2. Handle Select Menu Interactions
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'select_match_to_predict') {
        queries.ensureUser(interaction.user.id, interaction.user.username);
        const selectedValue = interaction.values[0];
        const matchId = selectedValue.replace('match_', '');

        const match = queries.getMatch(matchId);
        if (!match) {
          return interaction.reply({
            content: '❌ Match could not be found.',
            ephemeral: true
          });
        }

        const check = predictionEngine.isMatchOpenForPrediction(match);
        if (!check.isOpen) {
          return interaction.reply({
            content: `🔒 Predictions for **${match.team1_code} vs ${match.team2_code}** are locked: ${check.reason}`,
            ephemeral: true
          });
        }

        const existing = queries.getUserPrediction(interaction.user.id, matchId);
        const embed = embeds.createMatchPredictionEmbed(match, existing);
        const rows = components.createScorePredictionButtons(match, existing);

        return interaction.update({
          content: null,
          embeds: [embed],
          components: rows
        });
      }
    }

    // 3. Handle Button Interactions
    if (interaction.isButton()) {
      const customId = interaction.customId;
      queries.ensureUser(interaction.user.id, interaction.user.username);

      // Daily prompt buttons
      if (customId === 'btn_daily_predict') {
        const upcoming = queries.getUpcomingMatches(15);
        if (upcoming.length === 0) {
          return interaction.reply({
            content: '📅 There are no upcoming matches open for prediction at this moment.',
            ephemeral: true
          });
        }
        const selectRow = components.createMatchSelectMenu(upcoming);
        return interaction.reply({
          content: '🎯 **Choose a Worlds 2026 series to predict:**',
          components: [selectRow],
          ephemeral: true
        });
      }

      if (customId === 'btn_daily_mypredictions') {
        const predictions = queries.getUserPredictions(interaction.user.id, 10);
        if (predictions.length === 0) {
          return interaction.reply({
            content: 'You have not made any predictions yet! Use `/predict` to submit one.',
            ephemeral: true
          });
        }
        let text = '📋 **Your Worlds 2026 Predictions:**\n\n';
        predictions.forEach(p => {
          const status = p.settled === 1
            ? (p.exact_score_hit ? '🎯 Exact (+pts)' : (p.winner_correct ? '✅ Win (+pts)' : '❌ Miss'))
            : '⏳ Pending';
          text += `• **${p.team1_code} vs ${p.team2_code}** [Bo${p.best_of}]: Picked **${p.predicted_winner_code}** (${p.predicted_team1_score}-${p.predicted_team2_score}) — ${status}\n`;
        });
        return interaction.reply({ content: text, ephemeral: true });
      }

      if (customId === 'btn_daily_leaderboard' || customId === 'btn_view_current_standings') {
        const leaders = queries.getLeaderboard(10);
        const rank = queries.getUserRank(interaction.user.id);
        const embed = embeds.createLeaderboardEmbed(leaders, rank, interaction.user.username);
        return interaction.reply({ embeds: [embed], ephemeral: true });
      }

      if (customId === 'btn_toggle_reminders') {
        const user = queries.getUser(interaction.user.id);
        const newStatus = !(user && user.dm_reminders === 1);
        queries.setDmReminders(interaction.user.id, newStatus);
        return interaction.reply({
          content: newStatus
            ? '🔔 **DM Reminders Enabled!** The bot will send you a DM before daily series start so you never miss locking in your predictions.'
            : '🔕 **DM Reminders Disabled.**',
          ephemeral: true
        });
      }

      if (customId === 'btn_back_to_matches') {
        const upcoming = queries.getUpcomingMatches(15);
        const selectRow = components.createMatchSelectMenu(upcoming);
        return interaction.update({
          content: '🎯 **Select a Worlds 2026 series to predict:**',
          embeds: [],
          components: [selectRow]
        });
      }

      // Score Prediction Button: format: pred_{matchId}_{winnerCode}_{t1Score}_{t2Score}
      if (customId.startsWith('pred_')) {
        const parts = customId.split('_');
        if (parts.length >= 5) {
          const matchId = parts[1];
          const winnerCode = parts[2];
          const t1Score = parseInt(parts[3], 10);
          const t2Score = parseInt(parts[4], 10);

          const match = queries.getMatch(matchId);
          if (!match) {
            return interaction.reply({
              content: '❌ Match not found.',
              ephemeral: true
            });
          }

          const check = predictionEngine.isMatchOpenForPrediction(match);
          if (!check.isOpen) {
            return interaction.reply({
              content: `🔒 Predictions for **${match.team1_code} vs ${match.team2_code}** are locked: ${check.reason}`,
              ephemeral: true
            });
          }

          // Save prediction
          queries.savePrediction(
            interaction.user.id,
            matchId,
            winnerCode,
            t1Score,
            t2Score
          );

          const successEmbed = embeds.createPredictionSuccessEmbed(
            match,
            winnerCode,
            t1Score,
            t2Score
          );

          const updatedPrediction = {
            predicted_winner_code: winnerCode,
            predicted_team1_score: t1Score,
            predicted_team2_score: t2Score
          };

          const updatedRows = components.createScorePredictionButtons(match, updatedPrediction);

          return interaction.update({
            content: null,
            embeds: [successEmbed],
            components: updatedRows
          });
        }
      }
    }
  } catch (err) {
    console.error('[Interaction Error]', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: '⚠️ An error occurred while executing this action.',
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// Graceful termination
process.on('SIGINT', () => {
  console.log('\nShutting down bot gracefully...');
  schedulerService.stop();
  healthServer.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down bot gracefully...');
  schedulerService.stop();
  healthServer.close();
  client.destroy();
  process.exit(0);
});

// Login
if (config.DISCORD_TOKEN) {
  client.login(config.DISCORD_TOKEN).catch(err => {
    console.error('❌ Failed to login to Discord:', err.message);
  });
} else {
  console.log('ℹ️ Bot files ready! Please add your DISCORD_TOKEN in .env and run `npm start`.');
}
