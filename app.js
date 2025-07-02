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
    config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
} catch (e) {
    console.warn("WARN: Could not load config.yml. Using default configuration. Error:", e.message);
}

// Check for essential environment variables
if (!process.env.TOKEN || !process.env.clientId) {
    console.error(config.messages.environmentVariablesNotSet);
    process.exit(1); // Exit if variables are missing
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
client.commands = new Collection(); // Use Collection for commands
client.commandLoadDetails = []; // Store details about command loading
client.eventLoadDetails = []; // Store details about event loading

// Helper function to recursively get all .js files in a directory and subdirectories
function getAllJsFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const file of list) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(getAllJsFiles(filePath));
        } else if (file.isFile() && file.name.endsWith('.js')) {
            results.push(filePath);
        }
    }
    return results;
}

// Function to load and register slash commands (recursive)
async function loadAndRegisterCommands() {
    console.log('\n🤖 Starting command registration...');
    const commandsToRegister = [];
    const localCommandsPath = path.join(__dirname, 'commands');
    client.commandLoadDetails = [];
    let filesFound = 0;

    try {
        if (fs.existsSync(localCommandsPath)) {
            const commandFiles = getAllJsFiles(localCommandsPath);
            filesFound = commandFiles.length;
            console.log(`\n🔍 Found ${filesFound} command files...`);
            client.commandLoadDetails.push({ type: 'summary', message: `Found ${filesFound} command files.` });

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
                        const missingProps = `Missing or invalid "data" (with "name") or "execute" properties.`;
                        console.log(`❌ Command ${file} ${missingProps}`);
                        client.commandLoadDetails.push({ file, status: 'error', message: missingProps });
                    }
                } catch (error) {
                    console.log(`❌ Error loading command ${file}:`, error);
                    client.commandLoadDetails.push({ file, status: 'error', message: `Error loading: ${error.message}` });
                }
            }
        } else {
            console.log("📂 'commands' directory does not exist. No local commands will be loaded.");
            client.commandLoadDetails.push({ type: 'summary', message: "'commands' directory does not exist." });
        }

        if (commandsToRegister.length > 0) {
            const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
            console.log(`\n⚡ Refreshing ${commandsToRegister.length} application (/) commands...`);

            const data = await rest.put(
                Routes.applicationCommands(process.env.clientId),
                { body: commandsToRegister },
            );

            const refreshMessage = `Successfully reloaded ${data.length} application (/) commands!`;
            console.log(`\n✅ ${refreshMessage}`);
            client.commandLoadDetails.push({ type: 'summary', message: refreshMessage, status: 'success' });
        } else {
            console.log("\nℹ️ No commands to register with Discord API.");
            client.commandLoadDetails.push({ type: 'summary', message: "No commands to register with Discord API." });
        }
    } catch (error) {
        console.error('❌ Command registration/loading error:', error);
        client.commandLoadDetails.push({ type: 'summary', message: `Command registration/loading error: ${error.message}`, status: 'error' });
    }
}

// Function to load event handlers (recursive)
function loadEvents() {
    console.log('\n🎉 Starting event loading...');
    const localEventsPath = path.join(__dirname, 'events');
    client.eventLoadDetails = [];
    let loadedEventsCount = 0;
    let filesFound = 0;

    try {
        if (fs.existsSync(localEventsPath)) {
            const eventFiles = getAllJsFiles(localEventsPath);
            filesFound = eventFiles.length;
            console.log(`\n🔍 Found ${filesFound} event files...`);
            client.eventLoadDetails.push({ type: 'summary', message: `Found ${filesFound} event files.` });

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
                        const missingProps = `Missing or invalid "name" or "execute" properties.` ;
                        console.log(`❌ Event ${file} ${missingProps}`);
                        client.eventLoadDetails.push({ file, status: 'error', message: missingProps });
                    }
                } catch (error) {
                    console.error(`❌ Error loading event ${file}:`, error);
                    client.eventLoadDetails.push({ file, status: 'error', message: `Error loading: ${error.message}` });
                }
            }
        } else {
            console.log("📂 'events' directory does not exist. No local events will be loaded.");
            client.eventLoadDetails.push({ type: 'summary', message: "'events' directory does not exist." });
        }

        const loadMsg = `Successfully loaded ${loadedEventsCount} of ${filesFound} event files!`;
        console.log(`\n✅ ${loadMsg}`);
        client.eventLoadDetails.push({ type: 'summary', message: loadMsg, status: 'success' });

    } catch (error) {
        console.error('❌ Error reading events directory:', error);
        client.eventLoadDetails.push({ type: 'summary', message: `Error reading events directory: ${error.message}`, status: 'error' });
    }
}

// Main asynchronous function to start the bot
async function main() {
    try {
        loadEvents(); // Load events first
        await loadAndRegisterCommands(); // Then load and register commands

        await client.login(process.env.TOKEN); // Log in to Discord
        // client.user is only available after login
        console.log(`\n🤖 Bot logged in as ${client.user.tag}`);

    } catch (error) {
        console.error(`❌ ${client.config.messages.errorLoggingIn || 'Error during initialization or login:'} ${error.message}`);
        // Log the error in load details for debugging purposes if needed
        client.eventLoadDetails.push({ type: 'summary', message: `Bot login/initialization error: ${error.message}`, status: 'error' });
        client.commandLoadDetails.push({ type: 'summary', message: `Bot login/initialization error: ${error.message}`, status: 'error' });
    }
}

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', reason);
});

// Start everything
main();