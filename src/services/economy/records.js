function createDefaultUser(balance = 0) {
    return {
        balance,
        job: null,
        jobStats: {
            shiftsCompleted: 0,
            failedShifts: 0,
            totalEarned: 0,
        },
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
        streak: Number(job.streak) || 0,
    };
}

function normalizeJobStats(stats) {
    if (!stats || typeof stats !== 'object') {
        return {
            shiftsCompleted: 0,
            failedShifts: 0,
            totalEarned: 0,
        };
    }
    return {
        shiftsCompleted: Number(stats.shiftsCompleted) || 0,
        failedShifts: Number(stats.failedShifts) || 0,
        totalEarned: Number(stats.totalEarned) || 0,
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

module.exports = { createDefaultUser, normalizeJob, normalizeJobStats, ensureUserRecord };
