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

// Tame listener warnings using config values (read from loaded config)
const listenerMax = Number((config?.logging?.listener_max)) || 25;
EventEmitter.defaultMaxListeners = Math.max(EventEmitter.defaultMaxListeners || 10, listenerMax);
client.setMaxListeners(listenerMax);
// Also raise limits on Discord.js websocket layers to avoid AsyncEventEmitter warnings
if (client.ws?.setMaxListeners) {
    client.ws.setMaxListeners(0);
}
client.on('shardCreate', (shard) => {
    if (typeof shard?.setMaxListeners === 'function') {
        shard.setMaxListeners(0);
    }
});

client.config = config;
client.commands = new Collection();
client.guildCommands = new Map();
client.commandLoadDetails = [];
client.eventLoadDetails = [];

// Verbose/quiet startup logging toggle (default: quiet)
const quietStartup = client.config?.logging?.quiet_startup ?? true;
const verboseLog = (...args) => { if (!quietStartup) console.log(...args); };
if (!quietStartup) {
    console.log("✅ Successfully loaded config.yml.");
}

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildGuildDirectory(cfg) {
    const entries = Array.isArray(cfg?.guilds) ? cfg.guilds : [];
    const bySlug = new Map();
    const byId = new Map();
    const premiumSlugs = new Set();
    const premiumIds = new Set();
    const premiumGuilds = new Map();

    for (const raw of entries) {
        if (!raw || typeof raw !== 'object') continue;

        const slug = slugify(raw.slug || raw.name);
        if (!slug) continue;

        const id = raw.id ? String(raw.id) : null;
        const tier = typeof raw.tier === 'string' ? raw.tier.toLowerCase() : '';
        const premium = raw.premium === true || tier === 'premium';

        const aliasInputs = [];
        if (Array.isArray(raw.aliases)) aliasInputs.push(...raw.aliases);
        if (raw.name) aliasInputs.push(raw.name);
        if (raw.slug) aliasInputs.push(raw.slug);

        const aliasSlugs = new Set(aliasInputs.map(slugify).filter(Boolean));
        aliasSlugs.add(slug);

        const extraIds = Array.isArray(raw.ids) ? raw.ids.map(String) : [];
        if (id) extraIds.unshift(id);
        const aliasIds = new Set(extraIds.filter(Boolean));

        const meta = {
            ...raw,
            id,
            slug,
            tier: tier || (premium ? 'premium' : raw.tier),
            premium,
            aliasSlugs,
            aliasIds,
        };

        bySlug.set(slug, meta);
        aliasSlugs.forEach(sl => {
            if (sl && !bySlug.has(sl)) {
                bySlug.set(sl, meta);
            }
        });
        aliasIds.forEach(aliasId => {
            if (aliasId) byId.set(aliasId, meta);
        });
        if (premium) {
            aliasSlugs.forEach(sl => premiumSlugs.add(sl));
            aliasIds.forEach(aliasId => premiumIds.add(aliasId));
            if (slug) premiumGuilds.set(slug, meta);
        }
    }

    return { bySlug, byId, premiumSlugs, premiumIds, premiumGuilds };
}

client.guildDirectory = buildGuildDirectory(client.config);

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
    const localCommandsPath = path.join(__dirname, 'commands');
    client.commandLoadDetails = [];
    client.commands.clear();
    if (!(client.guildCommands instanceof Map)) {
        client.guildCommands = new Map();
    } else {
        client.guildCommands.clear();
    }

    if (!fs.existsSync(localCommandsPath)) {
        verboseLog("📂 'commands' directory does not exist. No local commands will be loaded.");
        client.commandLoadDetails.push({ type: 'summary', message: "'commands' directory does not exist." });
        return;
    }

    const commandFiles = await getAllJsFiles(localCommandsPath);
    verboseLog(`\n🔍 Found ${commandFiles.length} command files...`);
    client.commandLoadDetails.push({ type: 'summary', message: `Found ${commandFiles.length} command files.` });

    const directory = client.guildDirectory || {};
    const bySlug = directory.bySlug instanceof Map ? directory.bySlug : new Map();
    const globalCommands = [];
    const guildScopedPayloads = new Map();
    const seenGlobalNames = new Set();

    for (const filePath of commandFiles) {
        const file = path.relative(localCommandsPath, filePath);
        const segments = file.split(path.sep);
        const isGuildScoped = segments[0] === 'guilds' && segments.length >= 2;
        let guildMeta = null;
        let guildIds = [];

        try {
            delete require.cache[require.resolve(filePath)];
            const command = require(filePath);

            if (command.data && typeof command.data.name === 'string' && typeof command.execute === 'function') {
                if (isGuildScoped) {
                    const slugCandidate = slugify(segments[1]);
                    if (!slugCandidate) {
                        verboseLog(`⚠️ Skipping command ${file} (cannot resolve guild slug).`);
                        client.commandLoadDetails.push({ file, status: 'skipped', message: 'Guild slug could not be resolved.' });
                        continue;
                    }

                    guildMeta = bySlug.get(slugCandidate) || null;
                    if (!guildMeta) {
                        verboseLog(`⚠️ Skipping command ${file} (no guild config for slug ${slugCandidate}).`);
                        client.commandLoadDetails.push({ file, status: 'skipped', message: `No guild config for slug ${slugCandidate}.` });
                        continue;
                    }

                    if (!guildMeta.premium) {
                        verboseLog(`⚠️ Skipping command ${file} (guild ${guildMeta.slug} is not premium).`);
                        client.commandLoadDetails.push({ file, status: 'skipped', message: `Guild ${guildMeta.slug} is not flagged premium.` });
                        continue;
                    }

                    const aliasIds = guildMeta.aliasIds instanceof Set ? Array.from(guildMeta.aliasIds) : [];
                    if (guildMeta.id && !aliasIds.includes(guildMeta.id)) aliasIds.unshift(guildMeta.id);
                    guildIds = aliasIds.filter(Boolean);

                    if (!guildIds.length) {
                        verboseLog(`⚠️ Skipping command ${file} (premium guild ${guildMeta.slug} missing ID).`);
                        client.commandLoadDetails.push({ file, status: 'skipped', message: `Guild ${guildMeta.slug} missing numeric id for registration.` });
                        continue;
                    }

                    guildIds.forEach((guildId) => {
                        if (!client.guildCommands.has(guildId)) {
                            client.guildCommands.set(guildId, new Collection());
                        }
                        const perGuild = client.guildCommands.get(guildId);
                        if (perGuild.has(command.data.name)) {
                            verboseLog(`⚠️ Command ${command.data.name} for guild ${guildId} is being overwritten by ${file}.`);
                        }
                        perGuild.set(command.data.name, command);
                        if (!guildScopedPayloads.has(guildId)) guildScopedPayloads.set(guildId, []);
                        guildScopedPayloads.get(guildId).push(command.data.toJSON());
                    });

                    verboseLog(`✅ Loaded guild command: ${file} → [${guildIds.join(', ')}]`);
                    client.commandLoadDetails.push({ file, name: command.data.name, status: 'success', message: `Loaded for premium guild ${guildMeta.slug}.` });
                } else {
                    if (seenGlobalNames.has(command.data.name)) {
                        verboseLog(`⚠️ Duplicate global command name detected: ${command.data.name} (${file}).`);
                    }
                    seenGlobalNames.add(command.data.name);
                    client.commands.set(command.data.name, command);
                    globalCommands.push(command.data.toJSON());
                    verboseLog(`✅ Loaded command: ${file}`);
                    client.commandLoadDetails.push({ file, name: command.data.name, status: 'success', message: 'Loaded successfully.' });
                }
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

    const scopedCount = Array.from(guildScopedPayloads.values()).reduce((acc, list) => acc + list.length, 0);
    client.commandLoadDetails.push({ type: 'summary', message: `Prepared ${globalCommands.length} global commands and ${scopedCount} guild-scoped commands.` });

    const refreshOnStart = client.config?.api?.refresh_on_start ?? true;
    const regMode = (client.config?.api?.registration || 'global').toLowerCase();
    const guildId = client.config?.api?.guild_id;

    if (!refreshOnStart) {
        verboseLog('\nℹ️ refresh_on_start=false; skipping Discord API registration.');
        client.commandLoadDetails.push({ type: 'summary', message: 'Skipped registration (refresh_on_start=false).' });
        return;
    }

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

    try {
        if (regMode === 'guild' && guildId) {
            const combined = [...globalCommands, ...(guildScopedPayloads.get(guildId) || [])];
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.clientId, guildId),
                { body: combined }
            );
            const refreshMessage = `Reloaded ${data.length} application commands for guild ${guildId}.`;
            verboseLog(`\n✅ ${refreshMessage}`);
            client.commandLoadDetails.push({ type: 'summary', message: refreshMessage, status: 'success' });
            guildScopedPayloads.delete(guildId);
        } else {
            const data = await rest.put(
                Routes.applicationCommands(process.env.clientId),
                { body: globalCommands }
            );
            const refreshMessage = `Reloaded ${data.length} global application (/) commands.`;
            verboseLog(`\n✅ ${refreshMessage}`);
            client.commandLoadDetails.push({ type: 'summary', message: refreshMessage, status: 'success' });
        }

        for (const [gid, scopedCommands] of guildScopedPayloads.entries()) {
            try {
                const data = await rest.put(
                    Routes.applicationGuildCommands(process.env.clientId, gid),
                    { body: scopedCommands }
                );
                const refreshMessage = `Reloaded ${data.length} guild-specific commands for ${gid}.`;
                verboseLog(`\n✅ ${refreshMessage}`);
                client.commandLoadDetails.push({ type: 'summary', message: refreshMessage, status: 'success' });
            } catch (error) {
                console.error(`❌ Discord API command registration error for guild ${gid}:`, error);
                client.commandLoadDetails.push({ type: 'summary', message: `Guild ${gid} API Error: ${error.message}`, status: 'error' });
            }
        }
    } catch (error) {
        console.error('❌ Discord API command registration error:', error);
        client.commandLoadDetails.push({ type: 'summary', message: `Discord API Error: ${error.message}`, status: 'error' });
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

    const directory = client.guildDirectory || {};
    const bySlug = directory.bySlug instanceof Map ? directory.bySlug : new Map();

    const findGuildInArgs = (args) => {
        for (const arg of args) {
            if (!arg) continue;
            if (arg.guild) return arg.guild;
            if (arg.member?.guild) return arg.member.guild;
            if (arg.guildId && client.guilds?.cache?.get) {
                const fetched = client.guilds.cache.get(arg.guildId);
                if (fetched) return fetched;
            }
        }
        return null;
    };

    for (const filePath of eventFiles) {
        const file = path.relative(localEventsPath, filePath);
        const segments = file.split(path.sep);
        const isGuildScoped = segments[0] === 'guilds' && segments.length >= 3;
        let guildMeta = null;

        if (isGuildScoped) {
            const slugCandidate = slugify(segments[1]);
            if (!slugCandidate) {
                verboseLog(`⚠️ Skipping event ${file} (cannot resolve guild slug).`);
                client.eventLoadDetails.push({ file, status: 'skipped', message: 'Guild slug could not be resolved.' });
                continue;
            }

            guildMeta = bySlug.get(slugCandidate) || null;
            if (!guildMeta) {
                verboseLog(`⚠️ Skipping event ${file} (no guild config for slug ${slugCandidate}).`);
                client.eventLoadDetails.push({ file, status: 'skipped', message: `No guild config for slug ${slugCandidate}.` });
                continue;
            }

            if (!guildMeta.premium) {
                verboseLog(`⚠️ Skipping event ${file} (guild ${guildMeta.slug} is not premium).`);
                client.eventLoadDetails.push({ file, status: 'skipped', message: `Guild ${guildMeta.slug} is not flagged premium.` });
                continue;
            }
        }

        try {
            delete require.cache[require.resolve(filePath)];
            const event = require(filePath);

            if (event.name && typeof event.name === 'string' && typeof event.execute === 'function') {
                const handler = (...args) => {
                    if (guildMeta) {
                        const targetGuild = findGuildInArgs(args);
                        if (!targetGuild) return;

                        if (guildMeta.aliasIds?.size) {
                            if (!guildMeta.aliasIds.has(targetGuild.id)) return;
                        } else if (guildMeta.id) {
                            if (targetGuild.id !== guildMeta.id) return;
                        } else {
                            const guildSlug = slugify(targetGuild.name);
                            if (!guildMeta.aliasSlugs?.has(guildSlug)) return;
                        }
                    }

                    return event.execute(...args, client);
                };

                if (event.once) {
                    client.once(event.name, handler);
                } else {
                    client.on(event.name, handler);
                }
                verboseLog(`✅ Loaded event: ${file}`);
                client.eventLoadDetails.push({ file, name: event.name, status: 'success', message: guildMeta ? `Loaded for premium guild ${guildMeta.slug}.` : 'Loaded successfully.' });
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
