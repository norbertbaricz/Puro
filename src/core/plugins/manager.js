const { Events } = require('discord.js');
const files = require('./files');
const { releaseModule } = require('./cache');
const scope = require('./scope');
const validation = require('./validate');
const indexes = require('./indexes');
const lifecycle = require('./lifecycle');
const loader = require('./loader');
const watcher = require('./watch');
const { reloadConfig } = require('./reload');
const { registrationTargets } = require('../registration/targets');
const { createLogger } = require('../logging/logger');
const log = createLogger('PLUGINS');
const { createUi } = require('../ui/messages');

// Public plugin API; file discovery, validation, indexes and lifecycle stay separate.
class PluginManager {
    constructor(client, { root, registrar = null } = {}) {
        this.client = client;
        client.ui ||= createUi(client);
        this.root = root;
        this.registrar = registrar;
        this.records = new Map();
        this.details = new Map();
        this.queue = Promise.resolve();
        this.stopped = false;
        this.pending = new Set();
        this.guildJoinHandler = (guild) => {
            if (!this.client.isReady() || this.stopped) return;
            void this.enqueue(async () => {
                for (const record of this.records.values()) {
                    if (
                        record.kind !== 'events' ||
                        record.name !== Events.ClientReady ||
                        !record.scope?.includes(guild.id)
                    )
                        continue;
                    await record.initializing;
                    record.initializing = this.invoke(record, [this.client], guild.id);
                    await record.initializing;
                }
            }).catch(() => {});
        };
        this.client.on(Events.GuildCreate, this.guildJoinHandler);
        this.rebuildIndexes();
    }
    enqueue(task) {
        const result = this.queue.then(task);
        this.queue = result.catch((error) => this.report('Reload task failed', error));
        return result;
    }
    report(message, error, record) {
        log.error(message, { file: record?.relative, error });
        this.client.healthMonitor?.recordError(error);
    }
    scopeFor(...args) {
        return scope.scopeFor(this, ...args);
    }
    validate(...args) {
        return validation.validate(this, ...args);
    }
    rebuildIndexes(...args) {
        return indexes.rebuildIndexes(this, ...args);
    }
    refreshDetails(...args) {
        return indexes.refreshDetails(this, ...args);
    }
    findCommand(...args) {
        return indexes.findCommand(this, ...args);
    }
    findComponent(...args) {
        return indexes.findComponent(this, ...args);
    }
    invoke(...args) {
        return lifecycle.invoke(this, ...args);
    }
    attach(...args) {
        return lifecycle.attach(this, ...args);
    }
    detach(...args) {
        return lifecycle.detach(this, ...args);
    }
    loadFile(...args) {
        return loader.loadFile(this, ...args);
    }
    removeFile(...args) {
        return loader.removeFile(this, ...args);
    }
    scan(...args) {
        return loader.scan(this, ...args);
    }
    reloadConfig() {
        return reloadConfig(this);
    }
    registrationTargets() {
        return registrationTargets(this);
    }
    start() {
        return watcher.start(this);
    }
    async stop() {
        this.stopped = true;
        this.client.removeListener(Events.GuildCreate, this.guildJoinHandler);
        clearTimeout(this.changeTimer);
        if (this.watcher) await this.watcher.close();
        await this.queue;
        for (const record of this.records.values()) {
            await this.detach(record);
            releaseModule(record.file);
        }
        this.records.clear();
        this.rebuildIndexes();
    }
}

module.exports = { PluginManager, isPluginFile: files.isPluginFile, commandKey: files.commandKey };
