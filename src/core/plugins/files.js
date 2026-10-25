const fs = require('node:fs');
const path = require('node:path');
const PLUGIN_DIRS = ['commands', 'events', 'components'];
function commandKey(type, name) {
    return `${type || 1}:${name}`;
}

function isPluginFile(file, root) {
    const parts = path.relative(root, file).split(path.sep);
    return (
        PLUGIN_DIRS.includes(parts[0]) &&
        parts.length > 1 &&
        parts.every((part) => !part.startsWith('.') && !part.startsWith('_')) &&
        /\.(?:js|cjs)$/.test(file) &&
        !/\.(?:test|spec)\.(?:js|cjs)$/.test(file)
    );
}

function walk(directory) {
    if (!fs.existsSync(directory)) return [];
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .flatMap((entry) => {
            if (entry.name.startsWith('.') || entry.name.startsWith('_')) return [];
            const file = path.join(directory, entry.name);
            return entry.isDirectory() ? walk(file) : entry.isFile() ? [file] : [];
        })
        .sort();
}

module.exports = { PLUGIN_DIRS, commandKey, isPluginFile, walk };
