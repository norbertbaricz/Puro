function normalizePlatformToken(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');
}

function normalizePlatformList(platforms) {
    if (Array.isArray(platforms)) {
        return platforms.map(normalizePlatformToken).filter(Boolean);
    }

    return String(platforms || '')
        .split(',')
        .map(normalizePlatformToken)
        .filter(Boolean);
}

function getAllowedPlatforms(config) {
    const rawPlatforms =
        Array.isArray(config.platforms) && config.platforms.length
            ? config.platforms
            : ['steam', 'ps4', 'ps5', 'epic-games-store'];

    return new Set(rawPlatforms.map(normalizePlatformToken).filter(Boolean));
}

module.exports = { normalizePlatformList, getAllowedPlatforms };
