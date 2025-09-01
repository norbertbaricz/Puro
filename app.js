require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, Collection } = require('discord.js');
const { EventEmitter } = require('events');
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
    // Optional verbose log below is controlled later
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

// Tame listener warnings using config values
const listenerMax = Number((client.config?.logging?.listener_max)) || 25;
EventEmitter.defaultMaxListeners = Math.max(EventEmitter.defaultMaxListeners || 10, listenerMax);
client.setMaxListeners(listenerMax);
// Also raise limits on Discord.js websocket layers to avoid AsyncEventEmitter warnings
if (client.ws?.setMaxListeners) {
    client.ws.setMaxListeners(listenerMax);
}
client.on('shardCreate', (shard) => {
    if (typeof shard?.setMaxListeners === 'function') {
        shard.setMaxListeners(listenerMax);
    }
});

client.config = config;
client.commands = new Collection();
client.commandLoadDetails = [];
client.eventLoadDetails = [];

// Verbose/quiet startup logging toggle (default: quiet)
const quietStartup = client.config?.logging?.quiet_startup ?? true;
const verboseLog = (...args) => { if (!quietStartup) console.log(...args); };
if (!quietStartup) {
    console.log("✅ Successfully loaded config.yml.");
}

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

// Ensure database exists and is readable/writable; auto-heal if corrupted
function ensureDatabase(dbPath, options = {}) {
    const { autoRepair = true } = options;
    const absPath = path.isAbsolute(dbPath) ? dbPath : path.join(__dirname, dbPath);
    if (!fs.existsSync(absPath)) {
        fs.writeFileSync(absPath, '{}\n');
        return { created: true, path: absPath };
    }
    fs.accessSync(absPath, fs.constants.R_OK | fs.constants.W_OK);
    const raw = fs.readFileSync(absPath, 'utf8');
    if (raw.trim() === '') {
        fs.writeFileSync(absPath, '{}\n');
        return { resetEmpty: true, path: absPath };
    }
    try {
        JSON.parse(raw);
        return { ok: true, path: absPath };
    } catch (e) {
        if (!autoRepair) {
            throw new Error('Database JSON is invalid and autoRepair=false');
        }
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backup = path.join(__dirname, `database.bak.${stamp}.json`);
        fs.copyFileSync(absPath, backup);
        fs.writeFileSync(absPath, '{}\n');
        return { repaired: true, backup, path: absPath };
    }
}

// Function to load and register slash commands
async function loadAndRegisterCommands() {
    verboseLog('\n🤖 Starting command registration...');
    const commandsToRegister = [];
    const localCommandsPath = path.join(__dirname, 'commands');
    client.commandLoadDetails = [];

    if (!fs.existsSync(localCommandsPath)) {
        verboseLog("📂 'commands' directory does not exist. No local commands will be loaded.");
        client.commandLoadDetails.push({ type: 'summary', message: "'commands' directory does not exist." });
        return;
    }

    const commandFiles = await getAllJsFiles(localCommandsPath);
    verboseLog(`\n🔍 Found ${commandFiles.length} command files...`);
    client.commandLoadDetails.push({ type: 'summary', message: `Found ${commandFiles.length} command files.` });

    for (const filePath of commandFiles) {
        const file = path.relative(localCommandsPath, filePath);
        try {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);

            if (command.data && typeof command.data.name === 'string' && typeof command.execute === 'function') {
                commandsToRegister.push(command.data.toJSON());
                client.commands.set(command.data.name, command);
                verboseLog(`✅ Loaded command: ${file}`);
                client.commandLoadDetails.push({ file, name: command.data.name, status: 'success', message: 'Loaded successfully.' });
            } else {
                const missingProps = 'Missing or invalid "data" (with "name") or "execute" properties.';
                verboseLog(`❌ Command ${file} ${missingProps}`);
                client.commandLoadDetails.push({ file, status: 'error', message: missingProps });
            }
        } catch (error) {
            console.log(`❌ Error loading command ${file}:`, error);
            client.commandLoadDetails.push({ file, status: 'error', message: `Failed to load: ${error.message}` });
        }
    }

    // Respect config for registration mode
    const refreshOnStart = client.config?.api?.refresh_on_start ?? true;
    const regMode = (client.config?.api?.registration || 'global').toLowerCase();
    const guildId = client.config?.api?.guild_id;

    if (commandsToRegister.length > 0 && refreshOnStart) {
        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        verboseLog(`\n⚡ Refreshing ${commandsToRegister.length} application (/) commands...`);

        try {
            let route;
            if (regMode === 'guild' && guildId) {
                route = Routes.applicationGuildCommands(process.env.clientId, guildId);
            } else {
                route = Routes.applicationCommands(process.env.clientId);
            }
            const data = await rest.put(route, { body: commandsToRegister });
            const scope = regMode === 'guild' && guildId ? `guild ${guildId}` : 'global';
            const refreshMessage = `Successfully reloaded ${data.length} ${scope} application (/) commands!`;
            verboseLog(`\n✅ ${refreshMessage}`);
            client.commandLoadDetails.push({ type: 'summary', message: refreshMessage, status: 'success' });
        } catch (error) {
            console.error('❌ Discord API command registration error:', error);
            client.commandLoadDetails.push({ type: 'summary', message: `Discord API Error: ${error.message}`, status: 'error' });
        }
    } else {
        verboseLog("\nℹ️ No valid commands to register with Discord API.");
        client.commandLoadDetails.push({ type: 'summary', message: "No valid commands to register." });
    }
}

// Function to load event handlers
async function loadEvents() {
    verboseLog('\n🗓️ Starting event loading...');
    const localEventsPath = path.join(__dirname, 'events');
    client.eventLoadDetails = [];
    let loadedEventsCount = 0;

    if (!fs.existsSync(localEventsPath)) {
        verboseLog("📂 'events' directory does not exist. No local events will be loaded.");
        client.eventLoadDetails.push({ type: 'summary', message: "'events' directory does not exist." });
        return;
    }

    const eventFiles = await getAllJsFiles(localEventsPath);
    verboseLog(`\n🔍 Found ${eventFiles.length} event files...`);
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
                verboseLog(`✅ Loaded event: ${file}`);
                client.eventLoadDetails.push({ file, name: event.name, status: 'success', message: 'Loaded successfully.' });
                loadedEventsCount++;
            } else {
                const missingProps = 'Missing or invalid "name" or "execute" properties.';
                verboseLog(`❌ Event ${file} ${missingProps}`);
                client.eventLoadDetails.push({ file, status: 'error', message: missingProps });
            }
        } catch (error) {
            console.error(`❌ Error loading event ${file}:`, error);
            client.eventLoadDetails.push({ file, status: 'error', message: `Failed to load: ${error.message}` });
        }
    }
    const loadMsg = `Successfully loaded ${loadedEventsCount} of ${eventFiles.length} event files!`;
    verboseLog(`\n✅ ${loadMsg}`);
    client.eventLoadDetails.push({ type: 'summary', message: loadMsg, status: 'success' });
}

// Main function to start the bot
async function main() {
    try {
        // Mark precise boot start for duration measurement
        client.bootStartedAt = process.hrtime.bigint();

        console.log("\n🛠️  Boot sequence initiated...");
        const dbPathCfg = client.config?.database?.path || 'database.json';
        const autoRepair = client.config?.database?.auto_repair !== false;
        console.log("🗄️  Validating database...");
        try {
            const dbStatus = ensureDatabase(dbPathCfg, { autoRepair });
            if (dbStatus.created) console.log(`✅ Database ready (created new at ${path.basename(dbStatus.path)}).`);
            else if (dbStatus.resetEmpty) console.log('✅ Database ready (reset empty file to valid JSON).');
            else if (dbStatus.repaired) console.log(`⚠️  Database was corrupted. Backed up to ${path.basename(dbStatus.backup)} and reset.`);
            else console.log('✅ Database ready.');
        } catch (dbErr) {
            console.error('❌ Database validation failed:', dbErr.message);
            process.exit(1);
        }
        console.log("🔧 Loading events...");
        await loadEvents();
        console.log("✅ Events loaded.");

        console.log("🔧 Registering commands...");
        await loadAndRegisterCommands();
        console.log("✅ Commands registered.");

        console.log("📡 Connecting to Discord...");
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

// Surface Node warnings clearly (including deprecation notices)
process.on('warning', (warning) => {
    console.warn('⚠️ Node Warning:', warning.message);
});

// Start the bot
main();
