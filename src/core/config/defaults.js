const DEFAULTS = {
    runtime: {
        intents: [
            'Guilds',
            'GuildMessages',
            'MessageContent',
            'GuildMembers',
            'GuildVoiceStates',
            'GuildMessageReactions',
            'GuildInvites',
            'GuildModeration',
        ],
        message_cache_limit: 100,
        owner_ids: [],
    },
    hot_reload: { enabled: true, debounce_ms: 150, write_stability_ms: 250, polling: false, polling_interval_ms: 500 },
    api: { refresh_on_start: true, registration: 'global', guild_id: '', sync_debounce_ms: 1500, retry_ms: 10_000 },
    logging: { quiet_startup: false, listener_max: 64 },
    database: { path: 'database.json', auto_repair: true },
    health: { interval_ms: 300_000 },
    ui: {
        accent: '#ff1493',
        footer: 'Puro • Skypixel',
        timestamps: false,
        auto_embeds: true,
        validate_payloads: true,
        help_page_size: 8,
        session_minutes: 15,
        max_sessions: 2000,
    },
    features: {
        feedback: { enabled: true, channel_id: '', max_file_bytes: 8 * 1024 * 1024 },
        scheduled_events: { enabled: true },
        user_install: { enabled: false },
    },
    commands: {},
    events: {},
    guilds: [],
};
const SNOWFLAKE = /^\d{17,20}$/;

module.exports = { DEFAULTS, SNOWFLAKE };
