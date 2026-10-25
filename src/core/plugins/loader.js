const fs = require('node:fs');
const path = require('node:path');
const { isPluginFile, PLUGIN_DIRS, walk } = require('./files');
const { createLogger } = require('../logging/logger');
const log = createLogger('PLUGINS');
const { releaseModule, restoreModule } = require('./cache');
async function loadFile(manager, file, { sync = true } = {}) {
    if (!isPluginFile(file, manager.root)) return false;
    if (!fs.existsSync(file)) return manager.removeFile(file, { sync });
    const previous = manager.records.get(file);
    const cached = require.cache[file];
    try {
        releaseModule(file);
        const candidate = manager.validate(file, require(file));
        if (!candidate) {
            await manager.removeFile(file, { sync });
            manager.details.set(file, { file: path.relative(manager.root, file), status: 'disabled' });
            manager.refreshDetails();
            return true;
        }
        // Validation finishes before the live module or its listeners are touched.
        if (previous) await manager.detach(previous);
        const stat = fs.statSync(file);
        candidate.fileStamp = `${stat.mtimeMs}:${stat.size}`;
        manager.records.set(file, candidate);
        manager.rebuildIndexes();
        if (candidate.kind === 'events') await manager.attach(candidate);
        manager.details.set(file, {
            file: candidate.relative,
            name: candidate.payload?.name || candidate.name || candidate.module.customId,
            status: 'success',
        });
        manager.refreshDetails();
        if (!manager.client.config.logging.quiet_startup || manager.client.isReady())
            log.info(`${previous ? 'Reloaded' : 'Loaded'} ${candidate.relative}`);
        if (sync && candidate.kind === 'commands') manager.registrar?.schedule();
        return true;
    } catch (error) {
        restoreModule(file, cached);
        manager.details.set(file, {
            file: path.relative(manager.root, file),
            status: 'error',
            retained: !!previous,
            code: error.code,
            message: error.message,
        });
        manager.refreshDetails();
        manager.report(
            `${previous ? 'Kept last working version' : 'Skipped invalid module'}: ${path.relative(manager.root, file)}`,
            error,
        );
        return false;
    }
}

async function removeFile(manager, file, { sync = true } = {}) {
    const record = manager.records.get(file);
    if (record) {
        await manager.detach(record);
        manager.records.delete(file);
        releaseModule(file);
        manager.rebuildIndexes();
        log.info(`Unloaded ${record.relative}`);
        if (sync && record.kind === 'commands') manager.registrar?.schedule();
    }
    manager.details.delete(file);
    manager.refreshDetails();
    return !!record;
}

async function scan(manager, { sync = true, force = true } = {}) {
    const files = PLUGIN_DIRS.flatMap((kind) => walk(path.join(manager.root, kind))).filter((file) =>
        isPluginFile(file, manager.root),
    );
    const found = new Set(files);
    for (const file of manager.records.keys()) if (!found.has(file)) await manager.removeFile(file, { sync: false });
    for (const file of files) {
        const record = manager.records.get(file);
        const stat = fs.statSync(file);
        const changed = record?.fileStamp !== `${stat.mtimeMs}:${stat.size}`;
        if (force || changed || record?.scope || record?.module.feature || record?.name === 'clientReady')
            await manager.loadFile(file, { sync: false });
    }
    if (sync) manager.registrar?.schedule();
}

module.exports = { loadFile, removeFile, scan };
