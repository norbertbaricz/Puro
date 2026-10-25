const path = require('node:path');
const { loadConfig, buildGuildDirectory } = require('../config');
const { createLogger } = require('../logging/logger');
const log = createLogger('PLUGINS');
async function reloadConfig(manager) {
    const file = path.join(manager.root, 'config.yml');
    try {
        const next = loadConfig(file);
        const previous = manager.client.config;
        for (const section of ['runtime', 'database', 'hot_reload']) {
            if (JSON.stringify(next[section]) !== JSON.stringify(previous[section])) {
                log.warn(`${section} changes require a restart; keeping the running settings until then.`);
                next[section] =
                    section === 'runtime'
                        ? { ...previous.runtime, owner_ids: next.runtime.owner_ids }
                        : previous[section];
            }
        }
        manager.client.config = next;
        manager.client.guildDirectory = buildGuildDirectory(next);
        manager.client.setMaxListeners(next.logging.listener_max);
        // Configuration may alter guild scopes or ready-task intervals.
        for (const record of [...manager.records.values()]) {
            if (record.scope) {
                try {
                    manager.scopeFor(record.file);
                } catch {
                    await manager.removeFile(record.file, { sync: false });
                }
            }
        }
        await manager.scan({ sync: false, force: false });
        manager.registrar?.schedule();
        log.info('Reloaded config.yml');
        return true;
    } catch (error) {
        manager.report('Invalid config.yml; kept the previous configuration', error);
        return false;
    }
}

module.exports = { reloadConfig };
