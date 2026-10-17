const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

async function deployCommands() {
  if (!config.DISCORD_TOKEN || !config.CLIENT_ID) {
    console.error('❌ Error: DISCORD_TOKEN and CLIENT_ID must be set in your .env file to register slash commands.');
    console.error('Please configure your .env file and run `npm run deploy` again.');
    process.exit(1);
  }

  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
      commands.push(command.data.toJSON());
    } else {
      console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.DISCORD_TOKEN);

  try {
    console.log(`🚀 Started refreshing ${commands.length} application (/) commands...`);

    if (config.GUILD_ID) {
      // Instant deployment for development guild
      const data = await rest.put(
        Routes.applicationGuildCommands(config.CLIENT_ID, config.GUILD_ID),
        { body: commands }
      );
      console.log(`✅ Successfully reloaded ${data.length} guild (/) commands for Guild ID: ${config.GUILD_ID}.`);
    } else {
      // Global deployment
      const data = await rest.put(
        Routes.applicationCommands(config.CLIENT_ID),
        { body: commands }
      );
      console.log(`✅ Successfully reloaded ${data.length} global application (/) commands.`);
    }
  } catch (error) {
    console.error('❌ Error deploying slash commands:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  deployCommands();
}

module.exports = { deployCommands };
