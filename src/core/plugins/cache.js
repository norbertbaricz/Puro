// CommonJS parents retain child modules independently of require.cache.
// Remove both references so repeated reloads can release obsolete module exports.
function releaseModule(file) {
    const cached = require.cache[file];
    if (cached?.parent) cached.parent.children = cached.parent.children.filter((child) => child !== cached);
    delete require.cache[file];
    return cached;
}

function restoreModule(file, previous) {
    releaseModule(file);
    if (!previous) return;
    require.cache[file] = previous;
    if (previous.parent && !previous.parent.children.includes(previous)) previous.parent.children.push(previous);
}

module.exports = { releaseModule, restoreModule };
