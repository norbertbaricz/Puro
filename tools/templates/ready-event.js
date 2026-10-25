const { Events } = require('discord.js');

// Copy to events/custom/heartbeat.js. Returning cleanup prevents duplicate timers.
const INTERVAL_MS = 60_000;

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        const timer = setInterval(() => console.log(`Heartbeat: ${client.guilds.cache.size} servers`), INTERVAL_MS);
        timer.unref();
        return () => clearInterval(timer);
    },
};
