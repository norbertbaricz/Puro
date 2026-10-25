const { Events } = require('discord.js');
const { createLogger } = require('../logging/logger');
const { guardInteraction } = require('../ui/guard');

const log = createLogger('RUNTIME');

function installRuntimeHandlers(client, shutdown) {
    const registrar = client.commandRegistrar;
    process.once('SIGINT', () => {
        void shutdown('SIGINT');
    });
    process.once('SIGTERM', () => {
        void shutdown('SIGTERM');
    });
    process.on('uncaughtException', (error) => {
        log.fatal('Uncaught exception', { error });
        void shutdown('uncaughtException', 1);
    });
    process.on('unhandledRejection', (reason) => {
        const error = reason instanceof Error ? reason : new Error(String(reason));
        log.error('Unhandled promise rejection', { error });
        client.healthMonitor.recordError(error);
    });
    process.on('warning', (error) => log.warn('Node.js warning', { error }));
    client.on(Events.Error, (error) => {
        log.error('Discord client error', { error });
        client.healthMonitor.recordError(error);
    });
    client.on(Events.ShardError, (error) => log.error('Discord shard error', { error }));
    client.on(Events.ShardDisconnect, (event, shardId) =>
        log.warn('Discord shard disconnected', { shardId, code: event.code }),
    );
    client.rest.on('rateLimited', (data) =>
        log.warn('REST is waiting for a Discord rate limit', { route: data.route, retryAfterMs: data.timeToReset }),
    );
    client.prependListener(Events.InteractionCreate, guardInteraction);
    client.on(Events.ClientReady, () => {
        if (client.config.api.refresh_on_start) registrar.schedule();
    });
    client.on(Events.GuildCreate, () => registrar.schedule());
}

module.exports = { installRuntimeHandlers };
