const { Events } = require('discord.js');
const { getEventConfig, pollGiveaways } = require('../../../src/features/giveaways/poll');

const DEFAULT_INTERVAL_MINUTES = 60;
const MIN_INTERVAL_MS = 15 * 60 * 1000;

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(guild, client) {
        if (!guild) {
            return;
        }

        const config = getEventConfig(client);
        if (config.enabled === false) {
            return;
        }

        const timers = (client.gamerPowerGiveawayTimers ||= new Map());
        const running = (client.gamerPowerGiveawayRunning ||= new Set());
        if (timers.has(guild.id)) {
            return;
        }

        const intervalMinutes = Number(config.interval_minutes) || DEFAULT_INTERVAL_MINUTES;
        const intervalMs = Math.max(MIN_INTERVAL_MS, intervalMinutes * 60 * 1000);

        const runPoll = async () => {
            if (running.has(guild.id)) {
                return;
            }

            running.add(guild.id);
            try {
                await pollGiveaways(guild, client);
            } catch (error) {
                console.error('[GamerPowerGiveaways] Poll failed:', error.message);
            } finally {
                running.delete(guild.id);
            }
        };

        await runPoll();
        const timer = setInterval(runPoll, intervalMs);
        timer.unref();
        timers.set(guild.id, timer);
        return () => {
            clearInterval(timer);
            if (timers.get(guild.id) === timer) timers.delete(guild.id);
        };
    },
};
