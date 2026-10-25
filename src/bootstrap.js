const path = require('node:path');
const { ROOT } = require('./paths');
const { loadEnvironment } = require('./core/config/environment');

async function start() {
    loadEnvironment();
    // Load environment-dependent services only after .env has been applied.
    const { loadConfig, buildGuildDirectory } = require('./core/config');
    const { createClient } = require('./core/runtime/client');
    const { PluginManager } = require('./core/plugins/manager');
    const { CommandRegistrar } = require('./core/registration/registrar');
    const { HealthMonitor } = require('./core/health/monitor');
    const { configureEconomy, initializeEconomy } = require('./services/economy/store');
    const { createShutdown } = require('./core/runtime/shutdown');
    const { installRuntimeHandlers } = require('./core/runtime/errors');
    const config = loadConfig(path.join(ROOT, 'config.yml'));
    const client = createClient(config);
    client.guildDirectory = buildGuildDirectory(config);
    client.healthMonitor = new HealthMonitor(client);
    configureEconomy({ path: path.resolve(ROOT, config.database.path) });
    await initializeEconomy({ autoRepair: config.database.auto_repair });
    client.commandRegistrar = new CommandRegistrar(client, { root: ROOT });
    client.plugins = new PluginManager(client, { root: ROOT, registrar: client.commandRegistrar });
    const shutdown = createShutdown(client);
    installRuntimeHandlers(client, shutdown);
    try {
        await client.plugins.start();
        await client.login(process.env.TOKEN);
    } catch (error) {
        require('./core/logging/logger').logger.fatal('Startup failed', { error });
        await shutdown('startup failure', 1);
    }
    return client;
}

module.exports = { start };
