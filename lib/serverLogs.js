const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const logsPath = path.join(__dirname, '..', 'logs.json');
const DEFAULT_LIMIT = 20;
const DEFAULT_MAX_ENTRIES_PER_GUILD = 5000;

let cache = null;
let queue = Promise.resolve();

const KNOWN_LOG_TYPES = [
    'AUDIT_ENTRY_CREATED',
    'AUTOMOD_ACTION_EXECUTED',
    'AUTOMOD_RULE_CREATED',
    'AUTOMOD_RULE_DELETED',
    'AUTOMOD_RULE_UPDATED',
    'CHANNEL_CREATED',
    'CHANNEL_DELETED',
    'CHANNEL_PINS_UPDATED',
    'CHANNEL_UPDATED',
    'COMMAND_USED',
    'EMOJI_CREATED',
    'EMOJI_DELETED',
    'EMOJI_UPDATED',
    'GUILD_UPDATED',
    'INVITE_CREATED',
    'INVITE_DELETED',
    'MEMBER_BANNED',
    'MEMBER_JOINED',
    'MEMBER_LEFT',
    'MEMBER_UNBANNED',
    'MEMBER_UPDATED',
    'MESSAGE_BULK_DELETED',
    'MESSAGE_DELETED',
    'MESSAGE_EDITED',
    'PRESENCE_UPDATED',
    'REACTION_ADDED',
    'REACTION_EMOJI_REMOVED',
    'REACTION_REMOVED',
    'REACTIONS_CLEARED',
    'ROLE_CREATED',
    'ROLE_DELETED',
    'ROLE_UPDATED',
    'SCHEDULED_EVENT_CREATED',
    'SCHEDULED_EVENT_DELETED',
    'SCHEDULED_EVENT_UPDATED',
    'SCHEDULED_EVENT_USER_ADD',
    'SCHEDULED_EVENT_USER_REMOVE',
    'STICKER_CREATED',
    'STICKER_DELETED',
    'STICKER_UPDATED',
    'THREAD_CREATED',
    'THREAD_DELETED',
    'THREAD_UPDATED',
    'VOICE_STATE_UPDATED',
    'WEBHOOKS_UPDATED',
];

function snapshotEntry(entry) {
    if (entry === undefined || entry === null) {
        return entry;
    }

    if (typeof global.structuredClone === 'function') {
        return structuredClone(entry);
    }

    return JSON.parse(JSON.stringify(entry));
}

function toId(value) {
    if (value === undefined || value === null) {
        return null;
    }

    const str = String(value).trim();
    return str.length ? str : null;
}

function truncateText(value, maxLength = 300) {
    if (value === undefined || value === null) {
        return '';
    }

    const text = String(value).replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) {
        return text;
    }

    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function normalizeType(type) {
    const raw = String(type || 'GENERAL_EVENT').trim().toUpperCase();
    const normalized = raw
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');

    return normalized || 'GENERAL_EVENT';
}

function normalizeMetadata(metadata, maxLength = 1800) {
    if (metadata === undefined) {
        return undefined;
    }

    if (metadata === null) {
        return null;
    }

    if (typeof metadata === 'string') {
        return truncateText(metadata, maxLength);
    }

    if (typeof metadata !== 'object') {
        return truncateText(String(metadata), maxLength);
    }

    try {
        const serialized = JSON.stringify(metadata);
        if (serialized.length <= maxLength) {
            return metadata;
        }

        return {
            note: 'Metadata was truncated due to size.',
            preview: `${serialized.slice(0, maxLength - 3)}...`,
        };
    } catch {
        return {
            note: 'Metadata could not be serialized.',
        };
    }
}

function createLogId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createLogEntry(guildId, payload = {}) {
    const timestampRaw = Number(payload.timestamp);
    const timestamp = Number.isFinite(timestampRaw) ? timestampRaw : Date.now();

    return {
        id: createLogId(),
        guildId: String(guildId),
        timestamp,
        type: normalizeType(payload.type),
        summary: truncateText(payload.summary || payload.action || 'No summary provided.', 320),
        actorId: toId(payload.actorId),
        targetId: toId(payload.targetId),
        channelId: toId(payload.channelId),
        messageId: toId(payload.messageId),
        content: truncateText(payload.content, 700),
        metadata: normalizeMetadata(payload.metadata),
    };
}

function clampLimit(value, fallback = DEFAULT_LIMIT, max = 100) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    return Math.min(max, Math.max(1, Math.floor(parsed)));
}

function toTimestamp(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
}

async function ensureLogsFile() {
    try {
        await fsp.access(logsPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
        await fsp.writeFile(logsPath, '{}\n', 'utf8');
    }
}

async function loadLogsDatabase() {
    await ensureLogsFile();

    if (cache) {
        return cache;
    }

    const raw = await fsp.readFile(logsPath, 'utf8').catch(() => '{}');
    cache = raw.trim() ? JSON.parse(raw) : {};
    return cache;
}

async function persistLogsDatabase(db) {
    cache = db;
    await fsp.writeFile(logsPath, `${JSON.stringify(db, null, 2)}\n`, 'utf8');
}

function withServerLogs(mutator, options = {}) {
    const { persist = true } = options;

    const run = async () => {
        const db = await loadLogsDatabase();
        const result = await mutator(db);

        if (persist) {
            await persistLogsDatabase(db);
        } else {
            cache = db;
        }

        return result;
    };

    const task = queue.then(run);
    queue = task.then(
        () => undefined,
        () => undefined
    );

    return task;
}

function buildSearchBlob(entry) {
    const chunks = [
        entry.type,
        entry.summary,
        entry.content,
    ];

    if (entry.actorId) chunks.push(entry.actorId);
    if (entry.targetId) chunks.push(entry.targetId);
    if (entry.channelId) chunks.push(entry.channelId);

    if (entry.metadata !== undefined) {
        if (typeof entry.metadata === 'string') {
            chunks.push(entry.metadata);
        } else {
            try {
                chunks.push(JSON.stringify(entry.metadata));
            } catch {
                // Ignore metadata serialization failures during search.
            }
        }
    }

    return chunks
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function matchesFilters(entry, filters = {}) {
    const typeFilter = filters.type ? normalizeType(filters.type) : null;
    if (typeFilter && normalizeType(entry.type) !== typeFilter) {
        return false;
    }

    const userIdFilter = toId(filters.userId);
    if (userIdFilter && entry.actorId !== userIdFilter && entry.targetId !== userIdFilter) {
        return false;
    }

    const channelIdFilter = toId(filters.channelId);
    if (channelIdFilter && entry.channelId !== channelIdFilter) {
        return false;
    }

    const sinceMs = toTimestamp(filters.sinceMs);
    if (sinceMs && Number(entry.timestamp) < sinceMs) {
        return false;
    }

    const untilMs = toTimestamp(filters.untilMs);
    if (untilMs && Number(entry.timestamp) > untilMs) {
        return false;
    }

    const query = typeof filters.query === 'string' ? filters.query.trim().toLowerCase() : '';
    if (query.length > 0 && !buildSearchBlob(entry).includes(query)) {
        return false;
    }

    return true;
}

async function appendLogEntry(guildId, payload = {}, options = {}) {
    const normalizedGuildId = toId(guildId);
    if (!normalizedGuildId) {
        throw new Error('appendLogEntry requires a valid guildId');
    }

    const maxEntriesRaw = Number(options.maxEntriesPerGuild);
    const maxEntriesPerGuild = Number.isFinite(maxEntriesRaw) && maxEntriesRaw > 0
        ? Math.floor(maxEntriesRaw)
        : DEFAULT_MAX_ENTRIES_PER_GUILD;

    return withServerLogs((db) => {
        if (!Array.isArray(db[normalizedGuildId])) {
            db[normalizedGuildId] = [];
        }

        const entry = createLogEntry(normalizedGuildId, payload);
        db[normalizedGuildId].push(entry);

        if (maxEntriesPerGuild > 0 && db[normalizedGuildId].length > maxEntriesPerGuild) {
            db[normalizedGuildId].splice(0, db[normalizedGuildId].length - maxEntriesPerGuild);
        }

        return snapshotEntry(entry);
    });
}

async function getGuildLogs(guildId) {
    const normalizedGuildId = toId(guildId);
    if (!normalizedGuildId) {
        return [];
    }

    return withServerLogs((db) => {
        const list = Array.isArray(db[normalizedGuildId]) ? db[normalizedGuildId] : [];
        return snapshotEntry(list);
    }, { persist: false });
}

async function searchGuildLogs(guildId, filters = {}) {
    const list = await getGuildLogs(guildId);
    const limit = clampLimit(filters.limit, DEFAULT_LIMIT);

    return list
        .filter(entry => matchesFilters(entry, filters))
        .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
        .slice(0, limit);
}

async function getGuildLogTypeStats(guildId, filters = {}) {
    const list = await getGuildLogs(guildId);
    const limit = clampLimit(filters.limit, 10, 50);
    const stats = new Map();

    for (const entry of list) {
        if (!matchesFilters(entry, {
            query: filters.query,
            userId: filters.userId,
            channelId: filters.channelId,
            sinceMs: filters.sinceMs,
            untilMs: filters.untilMs,
        })) {
            continue;
        }

        const type = normalizeType(entry.type);
        stats.set(type, (stats.get(type) || 0) + 1);
    }

    return Array.from(stats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([type, count]) => ({ type, count }));
}

async function getKnownLogTypes(guildId) {
    const allTypes = new Set(KNOWN_LOG_TYPES);
    const list = await getGuildLogs(guildId);

    for (const entry of list) {
        allTypes.add(normalizeType(entry.type));
    }

    return Array.from(allTypes).sort((a, b) => a.localeCompare(b));
}

module.exports = {
    logsPath,
    withServerLogs,
    ensureLogsFile,
    appendLogEntry,
    getGuildLogs,
    searchGuildLogs,
    getGuildLogTypeStats,
    getKnownLogTypes,
    normalizeType,
    KNOWN_LOG_TYPES,
};
