const path = require('node:path');
const { slugify, SNOWFLAKE } = require('../config');
function getGuild(args) {
    for (const arg of args) {
        if (arg?.guild) return arg.guild;
        if (arg?.member?.guild) return arg.member.guild;
        if (arg?.id && arg?.channels && arg?.members) return arg;
        if (arg?.guildId) return { id: arg.guildId };
    }
    return null;
}

function scopeFor(manager, file) {
    const parts = path.relative(manager.root, file).split(path.sep);
    if (parts[1] !== 'guilds') return null;
    if (parts.length < 4) throw new Error('Guild modules belong in <kind>/guilds/<slug-or-id>/<file>.js.');
    const token = parts[2];
    const meta = manager.client.guildDirectory.bySlug.get(slugify(token));
    if (meta) return [...meta.aliasIds];
    if (SNOWFLAKE.test(token)) return [token];
    throw new Error(
        `Unknown guild folder '${token}'; add its slug and quoted ID to config.yml -> guilds, or use the numeric guild ID as folder name.`,
    );
}

module.exports = { scopeFor, getGuild };
