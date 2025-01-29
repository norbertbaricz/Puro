require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

// Check required environment variables
if (!process.env.TOKEN || !process.env.clientId) {
    console.error(config.messages.environmentVariablesNotSet);
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Load and register commands
async function loadAndRegisterCommands() {
    console.log('\n🤖 Starting command registration process...');
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    client.commands = new Map();

    try {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        console.log(`\n🔍 Found ${commandFiles.length} command files to load...\n`);

        for (const file of commandFiles) {
            try {
                const command = require(path.join(commandsPath, file));
                if (!command.data || !command.execute) {
                    console.log(`⚠️ Command at ${file} is missing required properties`);
                    continue;
                }
                commands.push(command.data.toJSON());
                client.commands.set(command.data.name, command);
                console.log(`✅ Successfully loaded command: ${file}`);
            } catch (error) {
                console.log(`⚠️ Error loading command ${file}:`, error);
            }
        }

        // Register commands with Discord API
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        console.log('\n⚡ Started refreshing application (/) commands...');
        
        const data = await rest.put(
            Routes.applicationCommands(process.env.clientId),
            { body: commands },
        );
        
        console.log(`\n✅ Successfully reloaded ${data.length} application (/) commands!\n`);
    } catch (error) {
        console.error('Error during command registration:', error);
        process.exit(1);
    }
}

// Load events with error handling
const eventsPath = path.join(__dirname, 'events');

try {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        try {
            const event = require(path.join(eventsPath, file));
            if (!event.name || !event.execute) {
                console.warn(`⚠️ Event file ${file} is missing required properties`);
                continue;
            }
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
        } catch (error) {
            console.error(`⚠️ Error loading event file ${file}:`, error);
        }
    }
} catch (error) {
    console.error(`Error reading events directory:`, error);
    process.exit(1);
}

// Initialize bot
(async () => {
    try {
        // First register commands
        await loadAndRegisterCommands();
        
        // Then login
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error(`${config.messages.errorLoggingIn} ${error}`);
        process.exit(1);
    }
})();