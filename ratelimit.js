const cooldowns = new Map();
module.exports = (userId, duration) => {
    const now = Date.now();
    const end = cooldowns.get(userId);
    if (end && now < end) return Math.ceil((end - now) / 1000);
    cooldowns.set(userId, now + duration);
    return 0;
};