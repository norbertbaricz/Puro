const { flushEconomy } = require('../../services/economy/store');
const { flushGuildEventState } = require('../../services/guild-state');
const { flushTemporaryVoice } = require('../../features/voice/registry');
const { createLogger } = require('../logging/logger');

// Give in-flight initialization and database writes time to finish during shutdown.
const SHUTDOWN_TIMEOUT_MS = 30_000;
const log = createLogger('SHUTDOWN');

function createShutdown(client) {
    let task = null;
    return function shutdown(reason, code = 0) {
        if (task) return task;
        task = (async () => {
            log.info(`Stopping: ${reason}`);
            const timeout = setTimeout(() => process.exit(1), SHUTDOWN_TIMEOUT_MS);
            timeout.unref();
            try {
                client.commandRegistrar.stop();
                await client.plugins.stop();
                client.healthMonitor.stopMonitoring();
                await flushTemporaryVoice(client);
                await flushGuildEventState();
                await flushEconomy();
                await client.destroy();
            } catch (error) {
                log.error('Shutdown failed', { error });
                code = 1;
            } finally {
                clearTimeout(timeout);
                process.exitCode = code;
            }
        })();
        return task;
    };
}

module.exports = { createShutdown };
