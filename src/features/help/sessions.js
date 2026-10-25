const { randomBytes } = require('node:crypto');
const { groups } = require('./catalog');

// Sessions remain bounded; expiry/size can be tuned in config.yml -> ui.
const DEFAULT_LIFETIME_MS = 15 * 60 * 1000;
const DEFAULT_CAPACITY = 2000;

function createSession(interaction) {
    const { client } = interaction;
    const sessions = (client.helpSessions ||= new Map());
    const now = Date.now();
    for (const [id, session] of sessions) if (session.expires <= now) sessions.delete(id);
    if (sessions.size >= (client.config.ui?.max_sessions || DEFAULT_CAPACITY))
        sessions.delete(sessions.keys().next().value);
    const session = {
        id: randomBytes(8).toString('hex'),
        ownerId: interaction.user.id,
        guildId: interaction.guildId,
        expires:
            now + (client.config.ui?.session_minutes ? client.config.ui.session_minutes * 60_000 : DEFAULT_LIFETIME_MS),
        category: null,
        query: null,
        categories: [...groups(interaction).keys()].sort((a, b) => a.localeCompare(b)),
    };
    sessions.set(session.id, session);
    return session;
}

module.exports = { createSession };
