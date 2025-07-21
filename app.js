require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Default configuration
let config = {
    messages: {
        environmentVariablesNotSet: "Environment variables TOKEN or clientId are not set!",
        errorLoggingIn: "Error logging in:"
    }
};

try {
    // Load configuration from config.yml
    const configFile = fs.readFileSync('./config.yml', 'utf8');
    config = yaml.load(configFile);
    console.log("✅ Successfully loaded config.yml.");
} catch (e) {
    console.warn("⚠️ WARN: Could not load config.yml. Using default configuration. Error:", e.message);
}

// Check for essential environment variables
if (!process.env.TOKEN || !process.env.clientId) {
    console.error("❌ FATAL:", config.messages.environmentVariablesNotSet);
    process.exit(1);
}

// Initialize Discord Client
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

client.config = config;
client.commands = new Collection();
client.commandLoadDetails = [];
client.eventLoadDetails = [];

// Helper function to recursively get all .js files
async function getAllJsFiles(dir) {
    const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
    const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        if (dirent.isDirectory()) {
            return getAllJsFiles(res);
        } else if (dirent.isFile() && dirent.name.endsWith('.js')) {
            return res;
        }
        return [];
    }));
    return Array.prototype.concat(...files);
}

// Function to load and register slash commands
async function loadAndRegisterCommands() {
    console.log('\n🤖 Starting command registration...');
    const commandsToRegister = [];
    const localCommandsPath = path.join(__dirname, 'commands');
    client.commandLoadDetails = [];

    if (!fs.existsSync(localCommandsPath)) {
        console.log("📂 'commands' directory does not exist. No local commands will be loaded.");
        client.commandLoadDetails.push({ type: 'summary', message: "'commands' directory does not exist." });
        return;
    }

    const commandFiles = await getAllJsFiles(localCommandsPath);
    console.log(`\n🔍 Found ${commandFiles.length} command files...`);
    client.commandLoadDetails.push({ type: 'summary', message: `Found ${commandFiles.length} command files.` });

    for (const filePath of commandFiles) {
        const file = path.relative(localCommandsPath, filePath);
        try {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);

            if (command.data && typeof command.data.name === 'string' && typeof command.execute === 'function') {
                commandsToRegister.push(command.data.toJSON());
                client.commands.set(command.data.name, command);
                console.log(`✅ Loaded command: ${file}`);
                client.commandLoadDetails.push({ file, name: command.data.name, status: 'success', message: 'Loaded successfully.' });
            } else {
                const missingProps = 'Missing or invalid "data" (with "name") or "execute" properties.';
                console.log(`❌ Command ${file} ${missingProps}`);
                client.commandLoadDetails.push({ file, status: 'error', message: missingProps });
            }
        } catch (error) {
            console.log(`❌ Error loading command ${file}:`, error);
            client.commandLoadDetails.push({ file, status: 'error', message: `Failed to load: ${error.message}` });
        }
    }

    if (commandsToRegister.length > 0) {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        console.log(`\n⚡ Refreshing ${commandsToRegister.length} application (/) commands...`);

        try {
            const data = await rest.put(
                Routes.applicationCommands(process.env.clientId),
                { body: commandsToRegister },
            );
            const refreshMessage = `Successfully reloaded ${data.length} application (/) commands!`;
            console.log(`\n✅ ${refreshMessage}`);
            client.commandLoadDetails.push({ type: 'summary', message: refreshMessage, status: 'success' });
        } catch (error) {
             console.error('❌ Discord API command registration error:', error);
             client.commandLoadDetails.push({ type: 'summary', message: `Discord API Error: ${error.message}`, status: 'error' });
        }
    } else {
        console.log("\nℹ️ No valid commands to register with Discord API.");
        client.commandLoadDetails.push({ type: 'summary', message: "No valid commands to register." });
    }
}

// Function to load event handlers
async function loadEvents() {
    console.log('\n🗓️ Starting event loading...');
    const localEventsPath = path.join(__dirname, 'events');
    client.eventLoadDetails = [];
    let loadedEventsCount = 0;

    if (!fs.existsSync(localEventsPath)) {
        console.log("📂 'events' directory does not exist. No local events will be loaded.");
        client.eventLoadDetails.push({ type: 'summary', message: "'events' directory does not exist." });
        return;
    }

    const eventFiles = await getAllJsFiles(localEventsPath);
    console.log(`\n🔍 Found ${eventFiles.length} event files...`);
    client.eventLoadDetails.push({ type: 'summary', message: `Found ${eventFiles.length} event files.` });

    for (const filePath of eventFiles) {
        const file = path.relative(localEventsPath, filePath);
        try {
            delete require.cache[require.resolve(filePath)];
            const event = require(filePath);

            if (event.name && typeof event.name === 'string' && typeof event.execute === 'function') {
                if (event.once) {
                    client.once(event.name, (...args) => event.execute(...args, client));
                } else {
                    client.on(event.name, (...args) => event.execute(...args, client));
                }
                console.log(`✅ Loaded event: ${file}`);
                client.eventLoadDetails.push({ file, name: event.name, status: 'success', message: 'Loaded successfully.' });
                loadedEventsCount++;
            } else {
                const missingProps = 'Missing or invalid "name" or "execute" properties.';
                console.log(`❌ Event ${file} ${missingProps}`);
                client.eventLoadDetails.push({ file, status: 'error', message: missingProps });
            }
        } catch (error) {
            console.error(`❌ Error loading event ${file}:`, error);
            client.eventLoadDetails.push({ file, status: 'error', message: `Failed to load: ${error.message}` });
        }
    }
    const loadMsg = `Successfully loaded ${loadedEventsCount} of ${eventFiles.length} event files!`;
    console.log(`\n✅ ${loadMsg}`);
    client.eventLoadDetails.push({ type: 'summary', message: loadMsg, status: 'success' });
}

// Main function to start the bot
async function main() {
    try {
        await loadEvents();
        await loadAndRegisterCommands();

        console.log("\n📡 Logging in to Discord...");
        await client.login(process.env.TOKEN);

    } catch (error) {
        console.error(`❌ ${config.messages.errorLoggingIn || 'Error during initialization or login:'}`, error);
        process.exit(1);
    }
}

// Graceful shutdown & Error Handling
process.on('SIGINT', () => {
    console.log("\n🔴 Shutting down bot...");
    client.destroy();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log("\n🔴 Shutting down bot...");
    client.destroy();
    process.exit(0);
});

// Aici este corecția. Am eliminat parametrul 'origin' pentru compatibilitate maximă.
process.on('uncaughtException', (err) => {
    console.error('🚨 UNCAUGHT EXCEPTION! Shutting down...');
    console.error(err);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚫 UNHANDLED REJECTION:');
    console.error('Reason:', reason);
});

// Start the bot
main();