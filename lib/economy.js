const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'database.json');

function ensureFile() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, '{}\n');
    }
}

function readEconomyDB() {
    ensureFile();
    try {
        const raw = fs.readFileSync(dbPath, 'utf8');
        if (!raw.trim()) {
            return {};
        }
        return JSON.parse(raw);
    } catch (error) {
        console.error('Economy DB read error:', error);
        fs.writeFileSync(dbPath, '{}\n');
        return {};
    }
}

function writeEconomyDB(db) {
    ensureFile();
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
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
