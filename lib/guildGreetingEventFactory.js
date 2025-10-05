const DEFAULT_CONFIG_PATH = ['events', 'messageCreate'];

function toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}

function normalizeName(name) {
    return typeof name === 'string' ? name.trim().toLowerCase() : '';
}

function slugifyName(name) {
    const normalized = normalizeName(name);
    return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function createFilterSet() {
    return { ids: new Set(), names: new Set() };
}

function addEntry(filter, entry, preferredType) {
    if (entry === undefined || entry === null) return;

    if (typeof entry === 'object' && !Array.isArray(entry)) {
        addEntry(filter, entry.id, 'id');
        addEntry(filter, entry.name, 'name');
        addEntry(filter, entry.slug, 'name');
        return;
    }

    const str = String(entry).trim();
    if (!str.length) return;

    const type = preferredType || (/^\d{5,}$/.test(str) ? 'id' : 'name');
    if (type === 'id') {
        filter.ids.add(str);
    } else {
        const normalized = normalizeName(str);
        if (normalized.length) filter.names.add(normalized);
        const slug = slugifyName(str);
        if (slug.length) filter.names.add(slug);
    }
}

function addEntries(filter, entries, preferredType) {
    toArray(entries).forEach(entry => addEntry(filter, entry, preferredType));
}

function collectOptionFilters(options = {}) {
    const filter = createFilterSet();
    addEntries(filter, options.allowedGuilds);
    addEntries(filter, options.allowedGuildIds, 'id');
    addEntries(filter, options.allowedGuildNames, 'name');
    addEntries(filter, options.allowlist);
    return filter;
}

function collectConfigFilters(config = {}) {
    const filter = createFilterSet();
    addEntries(filter, config.guild_id, 'id');
    addEntries(filter, config.guild_ids, 'id');
    addEntries(filter, config.allowed_guilds);
    return filter;
}

function isGuildAllowed(guild, filter) {
    if (!filter || (!filter.ids.size && !filter.names.size)) return true;
    const guildId = guild?.id;
    if (guildId && filter.ids.has(guildId)) return true;

    const guildName = guild?.name || '';
    const normalized = normalizeName(guildName);
    if (normalized && filter.names.has(normalized)) return true;

    const slug = slugifyName(guildName);
    if (slug && filter.names.has(slug)) return true;

    return false;
}

function resolveConfigSection(root, pathParts) {
    let current = root;
    for (const part of pathParts) {
        if (!current || typeof current !== 'object') return {};
        current = current[part];
    }
    return (current && typeof current === 'object') ? current : {};
}

module.exports = function createGreetingEvent(options = {}) {
    const pathParts = Array.isArray(options.configPath)
        ? options.configPath.filter(Boolean)
        : String(options.configPath || '')
            .split('.')
            .map(part => part.trim())
            .filter(Boolean);
    const configPath = pathParts.length ? pathParts : DEFAULT_CONFIG_PATH;

    const optionFilters = collectOptionFilters(options);
    const userCooldown = new Map();

    return {
        name: 'messageCreate',
        async execute(message) {
            if (!message.guild) return;
            if (message.author?.bot) return;

            const configRoot = message.client?.config || {};
            const eventConfig = resolveConfigSection(configRoot, configPath);

            if (!isGuildAllowed(message.guild, optionFilters)) return;

            const configFilters = collectConfigFilters(eventConfig);
            if (!isGuildAllowed(message.guild, configFilters)) return;

            const greetingsCfg = eventConfig.greetings || {};

            const allowChannels = Array.isArray(greetingsCfg.allow_channels) ? greetingsCfg.allow_channels : [];
            const denyChannels = Array.isArray(greetingsCfg.deny_channels) ? greetingsCfg.deny_channels : [];
            if (allowChannels.length && !allowChannels.includes(message.channel.id)) return;
            if (denyChannels.length && denyChannels.includes(message.channel.id)) return;

            const cooldownSec = Math.max(0, Number(greetingsCfg.cooldown_seconds) || 0);
            if (cooldownSec > 0) {
                const now = Date.now();
                const last = userCooldown.get(message.author.id) || 0;
                if (now - last < cooldownSec * 1000) return;
                userCooldown.set(message.author.id, now);
            }

            const rawContent = typeof message.content === 'string' ? message.content : '';
            const content = rawContent.toLowerCase().trim();
            if (!content.length) return;

            const patterns = Array.isArray(greetingsCfg.patterns) ? greetingsCfg.patterns : [];
            if (!patterns.length) return;
            const matched = patterns.some(pattern => {
                try {
                    return new RegExp(pattern, 'i').test(content);
                } catch (error) {
                    console.error('Invalid greeting pattern:', { pattern, error: error.message });
                    return false;
                }
            });
            if (!matched) return;

            const probability = Number(greetingsCfg.probability);
            if (!Number.isNaN(probability) && probability >= 0 && probability <= 1) {
                if (Math.random() > probability) return;
            }

            try {
                const responsesRaw = greetingsCfg.responses;
                const responsePool = Array.isArray(responsesRaw) ? responsesRaw : [responsesRaw].filter(Boolean);
                const responseTemplate = responsePool.length
                    ? responsePool[Math.floor(Math.random() * responsePool.length)]
                    : 'Hello, {user}!';

                const response = responseTemplate
                    .replace('{user}', `${message.author}`)
                    .replace('{channel}', `${message.channel}`);

                const reactEmoji = greetingsCfg.reaction || null;
                if (reactEmoji) {
                    message.react(reactEmoji).catch(() => {});
                }

                const sent = await message.reply({ content: response, allowedMentions: { repliedUser: true } });

                const deleteAfter = Number(greetingsCfg.delete_after_seconds) || 0;
                if (deleteAfter > 0) {
                    setTimeout(() => sent.delete().catch(() => {}), deleteAfter * 1000);
                }
            } catch (error) {
                console.error('Greeting error:', error);
                const fallback = (eventConfig.messages && eventConfig.messages.error)
                    || 'An error occurred while sending the greeting.';
                message.reply({ content: fallback, allowedMentions: { repliedUser: false } }).catch(() => {});
            }
        },
    };
};
