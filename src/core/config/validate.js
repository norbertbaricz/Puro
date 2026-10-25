const { GatewayIntentBits } = require('discord.js');
const { SNOWFLAKE } = require('./defaults');
const { buildGuildDirectory } = require('./guilds');
function validateConfig(config) {
    if (!Array.isArray(config.guilds || [])) throw new Error('guilds must be an array.');
    if (
        !Array.isArray(config.runtime.intents) ||
        !config.runtime.intents.length ||
        config.runtime.intents.some((name) => typeof GatewayIntentBits[name] !== 'number')
    ) {
        throw new Error('runtime.intents must contain valid GatewayIntentBits names.');
    }
    for (const [section, key, min] of [
        ['runtime', 'message_cache_limit', 0],
        ['logging', 'listener_max', 1],
        ['hot_reload', 'debounce_ms', 0],
        ['hot_reload', 'write_stability_ms', 50],
        ['hot_reload', 'polling_interval_ms', 100],
        ['api', 'sync_debounce_ms', 0],
        ['api', 'retry_ms', 1000],
        ['health', 'interval_ms', 1000],
    ]) {
        if (!Number.isInteger(config[section][key]) || config[section][key] < min) {
            throw new Error(`${section}.${key} must be an integer >= ${min}.`);
        }
    }
    for (const [section, key] of [
        ['hot_reload', 'enabled'],
        ['hot_reload', 'polling'],
        ['api', 'refresh_on_start'],
        ['logging', 'quiet_startup'],
        ['database', 'auto_repair'],
    ]) {
        if (typeof config[section][key] !== 'boolean') throw new Error(`${section}.${key} must be true or false.`);
    }
    if (!['global', 'guild'].includes(config.api.registration))
        throw new Error('api.registration must be global or guild.');
    if (
        config.api.registration === 'guild' &&
        (typeof config.api.guild_id !== 'string' || !SNOWFLAKE.test(config.api.guild_id))
    ) {
        throw new Error('api.guild_id is required in guild registration mode.');
    }
    if (
        !Array.isArray(config.runtime.owner_ids) ||
        config.runtime.owner_ids.some((id) => typeof id !== 'string' || !SNOWFLAKE.test(id))
    ) {
        throw new Error('runtime.owner_ids must be an array of quoted Discord user IDs.');
    }
    if (typeof config.database.path !== 'string' || !config.database.path.trim())
        throw new Error('database.path must be a non-empty path.');
    for (const [key, min, max] of [
        ['help_page_size', 1, 10],
        ['session_minutes', 1, 1440],
        ['max_sessions', 1, 10000],
    ]) {
        if (!Number.isInteger(config.ui[key]) || config.ui[key] < min || config.ui[key] > max)
            throw new Error(`ui.${key} must be an integer from ${min} to ${max}.`);
    }
    if (!/^#[0-9a-f]{6}$/i.test(config.ui.accent) || typeof config.ui.validate_payloads !== 'boolean')
        throw new Error('ui.accent must be #RRGGBB and ui.validate_payloads must be true or false.');
    if (typeof config.ui.footer !== 'string' || config.ui.footer.length > 128)
        throw new Error('ui.footer must contain at most 128 characters; use an empty string to hide it.');
    for (const key of ['auto_embeds', 'timestamps'])
        if (typeof config.ui[key] !== 'boolean') throw new Error(`ui.${key} must be true or false.`);
    for (const [name, feature] of Object.entries(config.features)) {
        if (!feature || typeof feature !== 'object' || typeof feature.enabled !== 'boolean')
            throw new Error(`features.${name}.enabled must be true or false.`);
    }
    const feedback = config.features.feedback;
    if (typeof feedback.channel_id !== 'string' || (feedback.channel_id && !SNOWFLAKE.test(feedback.channel_id)))
        throw new Error('features.feedback.channel_id must be empty or a quoted Discord channel ID.');
    if (
        !Number.isInteger(feedback.max_file_bytes) ||
        feedback.max_file_bytes < 1 ||
        feedback.max_file_bytes > 25 * 1024 * 1024
    )
        throw new Error('features.feedback.max_file_bytes must be an integer from 1 to 26214400.');
    const voice = config.events.voiceConnect;
    if (voice) {
        if (
            typeof voice.lobby_channel_id !== 'string' ||
            (voice.lobby_channel_id && !SNOWFLAKE.test(voice.lobby_channel_id))
        )
            throw new Error('voiceConnect.lobby_channel_id must be empty or a quoted Discord ID.');
        if (typeof voice.name_template !== 'string' || !voice.name_template.trim())
            throw new Error('voiceConnect.name_template must be a non-empty string.');
        if (voice.rtc_region !== null && typeof voice.rtc_region !== 'string')
            throw new Error('voiceConnect.rtc_region must be a region string or null.');
        for (const [key, min, max] of [
            ['bitrate', 8000, 384000],
            ['user_limit', 0, 99],
            ['cooldown_seconds', 0, 3600],
        ]) {
            if (!Number.isInteger(voice[key]) || voice[key] < min || voice[key] > max)
                throw new Error(`voiceConnect.${key} must be an integer from ${min} to ${max}.`);
        }
    }
    buildGuildDirectory(config);
    return config;
}
module.exports = { validateConfig };
