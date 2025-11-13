/**
 * Economy database operations
 * Handles all economy-related data persistence
 */

const fsSync = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.json');

/**
 * Ensure database file exists (sync for initialization)
 */
function ensureFile() {
    if (!fsSync.existsSync(dbPath)) {
        fsSync.writeFileSync(dbPath, '{}\n');
    }
}

/**
 * Read economy database (sync - legacy support)
 */
function readEconomyDB() {
    ensureFile();
    try {
        const raw = fsSync.readFileSync(dbPath, 'utf8');
        if (!raw.trim()) {
            return {};
        }
        return JSON.parse(raw);
    } catch (error) {
        console.error('Economy DB read error:', error);
        fsSync.writeFileSync(dbPath, '{}\n');
        return {};
    }
}

/**
 * Write economy database (sync - legacy support)
 */
function writeEconomyDB(db) {
    ensureFile();
    fsSync.writeFileSync(dbPath, JSON.stringify(db, null, 2));
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
    readEconomyDB,
    writeEconomyDB,
    ensureUserRecord,
    createDefaultUser,
    normalizeJob,
    normalizeJobStats
};
