const { ActivityType, Events } = require('discord.js');
const { createLogger } = require('../../src/core/logging/logger');

// Discord presence changes should remain comfortably below Gateway rate limits.
const MIN_PRESENCE_INTERVAL_MS = 15_000;
const DEFAULT_PRESENCE_INTERVAL_MS = 30_000;
const log = createLogger('READY');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        const config = client.config.status || {};
        const texts = Array.isArray(config.texts)
            ? config.texts.filter((text) => typeof text === 'string' && text.trim())
            : [];
        let index = 0;
        const update = () => {
            try {
                const members = [...client.guilds.cache.values()].reduce((sum, guild) => sum + guild.memberCount, 0);
                const minutes = Math.floor(process.uptime() / 60);
                const values = {
                    servers: client.guilds.cache.size,
                    members,
                    membersGreeted: members,
                    uptime: `${Math.floor(minutes / 1440)}d ${Math.floor(minutes / 60) % 24}h ${minutes % 60}m`,
                };
                const template = texts.length ? texts[index++ % texts.length] : 'Use /help';
                const name = template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match).slice(0, 128);
                const type = ActivityType[config.type] ?? ActivityType.Playing;
                const activity = { name, type };
                if (type === ActivityType.Custom) {
                    activity.name = 'Custom Status';
                    activity.state = name;
                }
                if (type === ActivityType.Streaming && config.url) activity.url = config.url;
                client.user.setPresence({ activities: [activity], status: config.status || 'online' });
            } catch (error) {
                log.error('Could not update presence', { error });
            }
        };
        update();
        const timer = setInterval(
            update,
            Math.max(MIN_PRESENCE_INTERVAL_MS, Number(config.interval_ms) || DEFAULT_PRESENCE_INTERVAL_MS),
        );
        timer.unref();
        client.healthMonitor?.stopMonitoring();
        client.healthMonitor?.startMonitoring(client.config.health.interval_ms);
        const seconds = client.bootStartedAt
            ? (Number(process.hrtime.bigint() - client.bootStartedAt) / 1e9).toFixed(2)
            : '?';
        log.info(
            `${client.user.tag} online | ${client.plugins.records.size} modules | ${client.guilds.cache.size} servers | boot ${seconds}s`,
        );
        return () => {
            clearInterval(timer);
            client.healthMonitor?.stopMonitoring();
        };
    },
};
