const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const { DEFAULTS } = require('./defaults');
const { merge } = require('./merge');
const { validateConfig } = require('./validate');

// Each command has one optional small settings file. Root settings override sections.
const EXTENSIONS = new Set(['.yml', '.yaml']);
const MAX_CONFIG_BYTES = 1024 * 1024;

function readYaml(file) {
    if (fs.statSync(file).size > MAX_CONFIG_BYTES) throw new Error(`${file}: configuration exceeds 1 MiB.`);
    const value = yaml.load(fs.readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error(`${file}: expected a YAML object.`);
    return value;
}

function section(directory) {
    if (!fs.existsSync(directory)) return [];
    return fs
        .readdirSync(directory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && !entry.name.startsWith('_') && EXTENSIONS.has(path.extname(entry.name)))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((entry) => [path.parse(entry.name).name, readYaml(path.join(directory, entry.name))]);
}

function loadConfig(file) {
    const root = path.dirname(file);
    const sections = { commands: {}, events: { guilds: {} }, guilds: [] };
    for (const [name, value] of section(path.join(root, 'config', 'commands'))) sections.commands[name] = value;
    for (const [name, value] of section(path.join(root, 'config', 'events'))) sections.events[name] = value;
    for (const [slug, value] of section(path.join(root, 'config', 'guilds'))) {
        if (value.guild) sections.guilds.push({ slug, ...value.guild });
        if (value.events) sections.events.guilds[slug] = value.events;
    }
    const rootConfig = readYaml(file);
    // Existing all-in-one configurations can still override the split defaults.
    const config = merge(merge(structuredClone(DEFAULTS), sections), rootConfig);
    return validateConfig(config);
}

module.exports = { loadConfig, readYaml };
