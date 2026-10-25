const { createDefaultUser, normalizeJob, normalizeJobStats, ensureUserRecord } = require('./records');
const { ROOT } = require('../../paths');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

// The application configures this once from config.yml -> database.path.
let dbPath = path.join(ROOT, 'database.json');
let cache = null;
let persistedText = null;
let queue = Promise.resolve();

function configureEconomy(options = {}) {
    if (cache) throw new Error('The economy path cannot change after the database is loaded.');
    if (options.path) dbPath = path.resolve(options.path);
}

function isDatabase(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

async function initializeEconomy({ autoRepair = true } = {}) {
    if (cache) return;
    await fsp.mkdir(path.dirname(dbPath), { recursive: true });
    try {
        await fsp.writeFile(dbPath, '{}\n', { flag: 'wx', mode: 0o600 });
    } catch (error) {
        if (error.code !== 'EEXIST') throw error;
    }
    await fsp.access(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    const raw = await fsp.readFile(dbPath, 'utf8');
    try {
        const parsed = JSON.parse(raw);
        if (!isDatabase(parsed)) throw new Error('Economy data must be a JSON object.');
        cache = parsed;
        persistedText = JSON.stringify(parsed, null, 2) + '\n';
    } catch (error) {
        if (!autoRepair) throw new Error('Invalid economy JSON; automatic repair is disabled.', { cause: error });
        const backup = `${dbPath}.bak.${Date.now()}.json`;
        await fsp.copyFile(dbPath, backup);
        await persistDatabase({});
        console.warn(`Economy database repaired; original saved to ${path.basename(backup)}.`);
    }
}

async function persistDatabase(db) {
    const text = JSON.stringify(db, null, 2) + '\n';
    if (text === persistedText) {
        cache = db;
        return;
    }
    const temp = `${dbPath}.tmp`;
    await fsp.writeFile(temp, text, { mode: 0o600 });
    await fsp.rename(temp, dbPath);
    cache = db;
    persistedText = text;
}

function withEconomy(mutator, { persist = true } = {}) {
    const task = queue.then(async () => {
        await initializeEconomy();
        // Work on a snapshot so failed commands or writes cannot corrupt live balances.
        const next = structuredClone(cache);
        const result = await mutator(next);
        if (persist) await persistDatabase(next);
        else cache = next;
        return result;
    });
    queue = task.then(
        () => undefined,
        () => undefined,
    );
    return task;
}

function flushEconomy() {
    return queue;
}

function snapshotEntry(entry) {
    if (entry === undefined || entry === null) {
        return entry;
    }
    if (typeof global.structuredClone === 'function') {
        return structuredClone(entry);
    }
    return JSON.parse(JSON.stringify(entry));
}

async function getEconomySnapshot() {
    return withEconomy(async (db) => snapshotEntry(db), { persist: false });
}

module.exports = {
    get dbPath() {
        return dbPath;
    },
    configureEconomy,
    initializeEconomy,
    flushEconomy,
    withEconomy,
    getEconomySnapshot,
    snapshotEntry,
    ensureUserRecord,
    createDefaultUser,
    normalizeJob,
    normalizeJobStats,
};
