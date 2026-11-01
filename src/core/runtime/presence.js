const { ActivityType } = require('discord.js');

// The branding entry also applies to configurations copied from older releases.
const DEFAULT_BRANDING = 'Made by Skypixel Framework';
const MAX_ACTIVITY_TEXT = 128;

function statusTexts(config = {}) {
    const branding = config.branding ?? DEFAULT_BRANDING;
    const configured = Array.isArray(config.texts) ? config.texts : [];
    return [
        ...new Set(
            [branding, ...configured]
                .filter((text) => typeof text === 'string' && text.trim())
                .map((text) => text.trim()),
        ),
    ];
}

function buildPresence(client, index = 0) {
    const config = client.config.status || {};
    const texts = statusTexts(config);
    const members = [...client.guilds.cache.values()].reduce((sum, guild) => sum + (Number(guild.memberCount) || 0), 0);
    const minutes = Math.floor(process.uptime() / 60);
    const values = {
        servers: client.guilds.cache.size,
        members,
        membersGreeted: members,
        uptime: `${Math.floor(minutes / 1440)}d ${Math.floor(minutes / 60) % 24}h ${minutes % 60}m`,
    };
    const template = texts.length ? texts[index % texts.length] : 'Use /help';
    let name = template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match).slice(0, MAX_ACTIVITY_TEXT);
    if (/[\uD800-\uDBFF]/.test(name.at(-1) || '')) name = name.slice(0, -1);
    const type = ActivityType[config.type] ?? ActivityType.Custom;
    const activity = type === ActivityType.Custom ? { name: 'Custom Status', type, state: name } : { name, type };
    if (type === ActivityType.Streaming && config.url) activity.url = config.url;
    return { activities: [activity], status: config.status || 'online' };
}

module.exports = { DEFAULT_BRANDING, statusTexts, buildPresence };
