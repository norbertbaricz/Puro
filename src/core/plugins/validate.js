const path = require('node:path');
const { Events } = require('discord.js');
const { commandKey } = require('./files');
const COMPONENT_TYPES = new Set(['button', 'selectMenu', 'modal']);
function validate(manager, file, module) {
    if (!module || typeof module !== 'object') throw new Error('Export a CommonJS object with module.exports.');
    if (
        module.enabled === false ||
        (module.feature && manager.client.config.features?.[module.feature]?.enabled === false)
    )
        return null;
    for (const key of ['ownerOnly', 'guildOnly', 'portable']) {
        if (module[key] !== undefined && typeof module[key] !== 'boolean')
            throw new Error(`${key} must be true or false.`);
    }
    if (typeof module.execute !== 'function') throw new Error('Missing execute() function.');
    if (module.category !== undefined && (typeof module.category !== 'string' || module.category.length > 100))
        throw new Error('category must be a string of at most 100 characters.');
    if (module.cleanup !== undefined && typeof module.cleanup !== 'function')
        throw new Error('cleanup must be a function.');
    if (module.defer !== undefined && ![false, 'public', 'private'].includes(module.defer))
        throw new Error('defer must be false, public, or private.');
    if (module.cooldown !== undefined && (!Number.isFinite(module.cooldown) || module.cooldown < 0))
        throw new Error('cooldown must be a non-negative number of seconds.');
    const kind = path.relative(manager.root, file).split(path.sep)[0];
    const record = {
        file,
        relative: path.relative(manager.root, file),
        kind,
        module,
        scope: manager.scopeFor(file),
        disposers: [],
        fired: false,
    };
    if (kind === 'commands') {
        const payload = typeof module.data?.toJSON === 'function' ? module.data.toJSON() : structuredClone(module.data);
        if (!payload || typeof payload.name !== 'string' || !payload.name.length || payload.name.length > 32)
            throw new Error('Command data needs a name of 1–32 characters.');
        payload.type ??= 1;
        if (![1, 2, 3].includes(payload.type)) throw new Error('Only slash, user, and message commands are supported.');
        if (
            payload.type === 1 &&
            (!/^[-_\p{L}\p{N}\u02bc]{1,32}$/u.test(payload.name) || payload.name !== payload.name.toLowerCase())
        )
            throw new Error('Slash command names must be lowercase and contain valid Discord command characters.');
        if (
            payload.type === 1 &&
            (typeof payload.description !== 'string' || !payload.description.length || payload.description.length > 100)
        )
            throw new Error('Slash command data needs a description of 1–100 characters.');
        if (module.guildOnly) payload.contexts = [0];
        record.payload = payload;
        record.key = commandKey(payload.type, payload.name);
        module.category ||=
            path.relative(path.join(manager.root, kind), file).split(path.sep)[0] === path.basename(file)
                ? 'Misc'
                : path.relative(path.join(manager.root, kind), file).split(path.sep)[0];
    } else if (kind === 'events') {
        if (typeof module.name !== 'string' || !module.name.trim())
            throw new Error('Event needs a non-empty name (use Events from discord.js).');
        if (module.once !== undefined && typeof module.once !== 'boolean')
            throw new Error('Event once must be true or false.');
        record.name = module.name === 'ready' ? Events.ClientReady : module.name;
    } else {
        if (!COMPONENT_TYPES.has(module.type)) throw new Error('Component type must be button, selectMenu, or modal.');
        if (typeof module.customId !== 'string' || !module.customId.length || module.customId.length > 100)
            throw new Error('Component needs a customId of 1–100 characters.');
        if (module.prefix !== undefined && typeof module.prefix !== 'boolean')
            throw new Error('Component prefix must be true or false.');
        record.key = `${module.type}:${module.prefix ? 'prefix' : 'exact'}:${module.customId}`;
    }
    for (const previous of manager.records.values()) {
        if (previous.file === file || previous.kind !== kind || kind === 'events' || previous.key !== record.key)
            continue;
        const overlaps =
            (!previous.scope && !record.scope) ||
            (previous.scope && record.scope && previous.scope.some((id) => record.scope.includes(id)));
        if (overlaps) {
            const error = new Error(`Duplicate ${kind} '${record.key}', already loaded from ${previous.relative}.`);
            error.code = 'PURO_DUPLICATE_PLUGIN';
            throw error;
        }
    }
    return record;
}

module.exports = { validate };
