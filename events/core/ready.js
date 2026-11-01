const { Events } = require('discord.js');
const { createLogger } = require('../../src/core/logging/logger');
const { buildPresence } = require('../../src/core/runtime/presence');

// Keep presence changes comfortably below Gateway rate limits.
const MIN_PRESENCE_INTERVAL_MS = 15_000;
const DEFAULT_PRESENCE_INTERVAL_MS = 30_000;
const log = createLogger('READY');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        const config = client.config.status || {};
        let index = 0;
        const update = () => {
            try {
                client.user.setPresence(buildPresence(client, index++));
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
