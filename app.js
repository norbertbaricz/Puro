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

// Function to load and register slash commands
async function loadAndRegisterCommands() {
    console.log('\n🤖 Starting command registration...');
    const commandsToRegister = []; // Commands to register with Discord API
    const localCommandsPath = path.join(__dirname, 'commands');
    client.commandLoadDetails = []; // Reset on each load
    let filesFound = 0;

    try {
        if (fs.existsSync(localCommandsPath)) {
            const commandFiles = fs.readdirSync(localCommandsPath).filter(file => file.endsWith('.js'));
            filesFound = commandFiles.length;
            console.log(`\n🔍 Found ${filesFound} command files...`);
            client.commandLoadDetails.push({ type: 'summary', message: `Found ${filesFound} command files.` });

            for (const file of commandFiles) {
                const filePath = path.join(localCommandsPath, file);
                try {
                    delete require.cache[require.resolve(filePath)]; // Clear cache for hot reloading
                    const command = require(filePath);

                    // Validate command structure
                    if (command.data && typeof command.data.name === 'string' && typeof command.execute === 'function') {
                        commandsToRegister.push(command.data.toJSON()); // For global registration
                        client.commands.set(command.data.name, command); // For local use
                        console.log(`✅ Loaded command: ${file}`); // Console log without (Name: ...)
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

        // Register commands with Discord API if any are found
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

// Function to load event handlers
function loadEvents() {
    console.log('\n🎉 Starting event loading...');
    const localEventsPath = path.join(__dirname, 'events');
    client.eventLoadDetails = []; // Reset on each load
    let loadedEventsCount = 0;
    let filesFound = 0;

    try {
        if (fs.existsSync(localEventsPath)) {
            const eventFiles = fs.readdirSync(localEventsPath).filter(file => file.endsWith('.js'));
            filesFound = eventFiles.length;
            console.log(`\n🔍 Found ${filesFound} event files...`);
            client.eventLoadDetails.push({ type: 'summary', message: `Found ${filesFound} event files.` });

            for (const file of eventFiles) {
                const filePath = path.join(localEventsPath, file);
                try {
                    delete require.cache[require.resolve(filePath)]; // Clear cache for hot reloading
                    const event = require(filePath);

                    // Validate event structure
                    if (event.name && typeof event.name === 'string' && typeof event.execute === 'function') {
                        if (event.once) {
                            client.once(event.name, (...args) => event.execute(...args, client));
                        } else {
                            client.on(event.name, (...args) => event.execute(...args, client));
                        }
                        console.log(`✅ Loaded event: ${file}`); // Console log without (Name: ...)
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

// Start everything
main();