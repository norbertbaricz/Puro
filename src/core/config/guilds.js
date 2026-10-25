const { SNOWFLAKE } = require('./defaults');
function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function buildGuildDirectory(config) {
    const bySlug = new Map();
    const byId = new Map();
    for (const raw of config.guilds || []) {
        if (!raw || typeof raw !== 'object') throw new Error('Each guild entry must be an object.');
        const slug = slugify(raw.slug || raw.name || raw.id);
        if (!slug) throw new Error('Each guild needs a slug, name, or ID.');
        const aliasSlugs = new Set([slug, raw.name, ...(raw.aliases || [])].map(slugify).filter(Boolean));
        const ids = [raw.id, ...(raw.ids || [])].filter(
            (value) => value !== undefined && value !== null && value !== '',
        );
        if (ids.some((id) => typeof id !== 'string'))
            throw new Error(`Guild ${slug}: Discord IDs must be quoted strings.`);
        const aliasIds = new Set(ids);
        if (!aliasIds.size || [...aliasIds].some((id) => !SNOWFLAKE.test(id))) {
            throw new Error(`Guild ${slug}: provide Discord IDs as quoted strings of 17–20 digits.`);
        }
        const meta = { ...raw, id: String(raw.id || [...aliasIds][0]), slug, aliasSlugs, aliasIds };
        for (const alias of aliasSlugs) {
            if (bySlug.has(alias)) throw new Error(`Duplicate guild alias: ${alias}`);
            bySlug.set(alias, meta);
        }
        for (const id of aliasIds) {
            if (byId.has(id)) throw new Error(`Duplicate guild ID: ${id}`);
            byId.set(id, meta);
        }
    }
    return { bySlug, byId };
}

module.exports = { slugify, buildGuildDirectory };
