const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Client, GatewayIntentBits } = require('discord.js');
const { loadConfig, buildGuildDirectory } = require('../../src/core/config/index');
const { PluginManager } = require('../../src/core/plugins/manager');

// Offline preflight: no Discord token, login, command registration, or event execution.
const ROOT = path.resolve(__dirname, '../..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.runtime', 'logs', 'coverage']);

function files(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : files(file);
        return /\.(js|cjs|mjs)$/.test(entry.name) ? [file] : [];
    });
}

async function main() {
    let failed = false;
    const scripts = files(ROOT);
    for (const file of scripts) {
        const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
        if (result.status !== 0) {
            console.error(result.stderr || result.error?.message || `Syntax check failed: ${file}`);
            failed = true;
        }
    }
    const client = new Client({ intents: [GatewayIntentBits.Guilds] });
    client.config = loadConfig(path.join(ROOT, 'config.yml'));
    client.config.logging.quiet_startup = true;
    client.guildDirectory = buildGuildDirectory(client.config);
    const plugins = new PluginManager(client, { root: ROOT });
    client.plugins = plugins;
    try {
        await plugins.scan({ sync: false });
        const errors = [...plugins.details.values()].filter((detail) => detail.status === 'error');
        failed ||= errors.length > 0;
        console.log(
            `Checked ${scripts.length} scripts and ${plugins.records.size} active modules; ${errors.length} module errors.`,
        );
    } finally {
        await plugins.stop();
        await client.destroy();
    }
    process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
