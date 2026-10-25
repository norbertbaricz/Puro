process.env.PURO_LOG_FILE = 'false';
process.env.LOG_LEVEL = 'FATAL';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { Collection } = require('discord.js');
const { DEFAULTS, buildGuildDirectory } = require('../../src/core/config/index');
const { PluginManager } = require('../../src/core/plugins/manager');

// Fixtures never connect to Discord and create data only inside temporary folders.
const GUILD_ID = '1217588804328620163';

async function fixture(t, overrides = {}) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puro-tests-'));
    const client = new EventEmitter();
    client.setMaxListeners(64);
    client.config = { ...structuredClone(DEFAULTS), guilds: [], commands: {}, events: {}, ...overrides };
    client.config.logging.quiet_startup = true;
    client.guildDirectory = buildGuildDirectory(client.config);
    client.ready = false;
    client.isReady = () => client.ready;
    client.guilds = { cache: new Collection() };
    client.healthMonitor = {
        errors: 0,
        count: 0,
        recordError() {
            this.errors++;
        },
        recordCommand() {
            this.count++;
        },
    };
    const registrar = {
        calls: 0,
        schedule() {
            this.calls++;
        },
    };
    const manager = new PluginManager(client, { root, registrar });
    client.plugins = manager;
    const write = (relative, source) => {
        const file = path.join(root, relative);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, source);
        return file;
    };
    t.after(async () => {
        await manager.stop();
        fs.rmSync(root, { recursive: true, force: true });
    });
    return { root, client, manager, registrar, write };
}

function command(name = 'hello', value = 1, extra = '') {
    return `module.exports = { data: { type: 1, name: '${name}', description: 'Test command' }, execute() { return ${value}; } ${extra} };`;
}

async function eventually(predicate, timeout = 4000) {
    const deadline = Date.now() + timeout;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for file watcher.');
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
}

module.exports = { fixture, command, eventually, GUILD_ID };
