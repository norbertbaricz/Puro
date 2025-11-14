const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.json');
let cache = null;
let queue = Promise.resolve();

async function ensureFile() {
    try {
        await fsp.access(dbPath, fs.constants.R_OK | fs.constants.W_OK);
    } catch {
        await fsp.writeFile(dbPath, '{}\n', 'utf8');
    }
}

async function loadDatabase() {
    await ensureFile();
    if (cache) {
        return cache;
    }

    const raw = await fsp.readFile(dbPath, 'utf8').catch(() => '{}');
    cache = raw.trim() ? JSON.parse(raw) : {};
    return cache;
}

async function persistDatabase(db) {
    cache = db;
    await fsp.writeFile(dbPath, JSON.stringify(db, null, 2) + '\n', 'utf8');
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

function withEconomy(mutator, options = {}) {
    const { persist = true } = options;

    const run = async () => {
        const db = await loadDatabase();
        const result = await mutator(db);
        if (persist) {
            await persistDatabase(db);
        } else {
            cache = db;
        }
        return result;
    };

    const task = queue.then(run);
    queue = task.then(
        () => undefined,
        () => undefined
    );
    return task;
}

async function getEconomySnapshot() {
    return withEconomy(async (db) => snapshotEntry(db), { persist: false });
}

function createDefaultUser(balance = 0) {
    return {
        balance,
        job: null,
        jobStats: {
            shiftsCompleted: 0,
            failedShifts: 0,
            totalEarned: 0
        }
    };
}

function normalizeJob(job) {
    if (!job || typeof job !== 'object' || typeof job.id !== 'string') {
        return null;
    }
    return {
        id: job.id,
        hiredAt: Number(job.hiredAt) || Date.now(),
        lastWorkedAt: Number(job.lastWorkedAt) || 0,
        streak: Number(job.streak) || 0
    };
}

function normalizeJobStats(stats) {
    if (!stats || typeof stats !== 'object') {
        return {
            shiftsCompleted: 0,
            failedShifts: 0,
            totalEarned: 0
        };
    }
    return {
        shiftsCompleted: Number(stats.shiftsCompleted) || 0,
        failedShifts: Number(stats.failedShifts) || 0,
        totalEarned: Number(stats.totalEarned) || 0
    };
}

function ensureUserRecord(db, userId) {
    if (!db || typeof db !== 'object') {
        throw new Error('Database must be an object');
    }

    const current = db[userId];
    if (current === undefined) {
        db[userId] = createDefaultUser();
        return db[userId];
    }

    if (typeof current === 'number') {
        db[userId] = createDefaultUser(current);
        return db[userId];
    }

    if (!current || typeof current !== 'object') {
        db[userId] = createDefaultUser();
        return db[userId];
    }

    if (typeof current.balance !== 'number' || Number.isNaN(current.balance)) {
        current.balance = 0;
    }

    current.job = normalizeJob(current.job);
    current.jobStats = normalizeJobStats(current.jobStats);

    return current;
}

module.exports = {
    dbPath,
    withEconomy,
    getEconomySnapshot,
    snapshotEntry,
    ensureUserRecord,
    createDefaultUser,
    normalizeJob,
    normalizeJobStats
};
