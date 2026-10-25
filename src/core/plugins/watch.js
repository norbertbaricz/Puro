const fs = require('node:fs');
const path = require('node:path');
const { PLUGIN_DIRS, isPluginFile } = require('./files');
const WATCH_POLL_INTERVAL_MS = 50;
const { createLogger } = require('../logging/logger');
const log = createLogger('PLUGINS');
async function start(manager) {
    for (const kind of PLUGIN_DIRS) fs.mkdirSync(path.join(manager.root, kind), { recursive: true });
    if (manager.client.config.hot_reload.enabled) {
        const { watch } = await import('chokidar');
        const settings = manager.client.config.hot_reload;
        manager.watcher = watch(
            [
                ...PLUGIN_DIRS.map((kind) => path.join(manager.root, kind)),
                path.join(manager.root, 'config.yml'),
                path.join(manager.root, 'config'),
            ],
            {
                ignoreInitial: true,
                followSymlinks: false,
                atomic: true,
                usePolling: settings.polling,
                interval: settings.polling_interval_ms,
                awaitWriteFinish: {
                    stabilityThreshold: settings.write_stability_ms,
                    pollInterval: WATCH_POLL_INTERVAL_MS,
                },
                ignored: (file) =>
                    path
                        .relative(manager.root, file)
                        .split(path.sep)
                        .some((part) => part.startsWith('.') || part.startsWith('_')),
            },
        );
        manager.watcher.on('all', (event, file) => {
            if (manager.stopped || !['add', 'change', 'unlink'].includes(event)) return;
            const configuration =
                file === path.join(manager.root, 'config.yml') ||
                (file.startsWith(path.join(manager.root, 'config') + path.sep) && /\.ya?ml$/.test(file));
            if (!configuration && !isPluginFile(file, manager.root)) return;
            manager.pending.add(file);
            clearTimeout(manager.changeTimer);
            manager.changeTimer = setTimeout(() => {
                const batch = [...manager.pending].sort((a, b) => Number(fs.existsSync(a)) - Number(fs.existsSync(b)));
                manager.pending.clear();
                void manager
                    .enqueue(async () => {
                        if (manager.stopped) return;
                        const isConfig = (changed) =>
                            changed === path.join(manager.root, 'config.yml') ||
                            changed.startsWith(path.join(manager.root, 'config') + path.sep);
                        const configChanged = batch.some(isConfig);
                        if (configChanged) await manager.reloadConfig();
                        for (const changed of batch.filter((file) => !isConfig(file))) {
                            const record = manager.records.get(changed);
                            const stat = fs.existsSync(changed) ? fs.statSync(changed) : null;
                            if (
                                !configChanged ||
                                !record ||
                                !stat ||
                                record.fileStamp !== `${stat.mtimeMs}:${stat.size}`
                            )
                                await manager.loadFile(changed);
                        }
                        for (const [rejected, detail] of manager.details) {
                            if (
                                !manager.records.has(rejected) &&
                                detail.code === 'PURO_DUPLICATE_PLUGIN' &&
                                fs.existsSync(rejected)
                            )
                                await manager.loadFile(rejected);
                        }
                    })
                    .catch(() => {});
            }, settings.debounce_ms);
        });
        manager.watcher.on('error', (error) =>
            manager.report('File watcher error; try hot_reload.polling on network drives', error),
        );
        await new Promise((resolve, reject) => {
            manager.watcher.once('ready', resolve);
            manager.watcher.once('error', reject);
        });
    }
    await manager.scan({ sync: false });
    log.info(`Ready: ${manager.records.size} modules; hot reload ${manager.watcher ? 'enabled' : 'disabled'}.`);
}

module.exports = { start };
