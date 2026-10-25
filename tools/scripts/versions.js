const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const { ROOT } = require('../../src/paths');
const { dependencies, devDependencies } = require('../../package.json');

// Read-only registry check. Updates are deliberate so new releases can be tested.
const TIMEOUT_MS = 20_000;
const exec = promisify(execFile);

async function latest(name) {
    const { stdout } = await exec(
        process.execPath,
        [
            process.env.npm_execpath,
            'view',
            name,
            'dist-tags.latest',
            '--json',
            '--registry=https://registry.npmjs.org',
            '--fetch-retries=0',
            '--fetch-timeout=15000',
        ],
        { timeout: TIMEOUT_MS, cwd: ROOT },
    );
    const value = JSON.parse(stdout);
    const version = Array.isArray(value) ? value.at(-1) : value;
    if (typeof version !== 'string') throw new Error(`Invalid registry response for ${name}.`);
    return version;
}

async function main() {
    if (!process.env.npm_execpath) throw new Error('Use npm run deps:check.');
    const packages = Object.keys({ ...dependencies, ...devDependencies });
    const installed = (name) =>
        JSON.parse(require('node:fs').readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8'))
            .version;
    const rows = packages.map((name) => ({ name, installed: installed(name) }));
    rows.push(
        { name: 'node', installed: process.versions.node },
        { name: 'npm', installed: /npm\/([^ ]+)/.exec(process.env.npm_config_user_agent || '')?.[1] || 'unknown' },
    );
    let failed = false;
    // Small batches avoid a burst of npm subprocesses.
    for (let offset = 0; offset < rows.length; offset += 4) {
        await Promise.all(
            rows.slice(offset, offset + 4).map(async (row) => {
                try {
                    row.latest = await latest(row.name);
                    row.status = row.latest === row.installed ? 'current' : 'update available';
                } catch {
                    row.latest = 'unavailable';
                    row.status = 'registry check failed';
                }
                failed ||= row.status !== 'current';
            }),
        );
    }
    console.table(rows);
    console.log('Discord REST: API v10. Node Current releases are checked; preview and nightly builds are excluded.');
    if (failed)
        console.log('Review available releases, update the lockfile, then run npm run verify. No files were changed.');
    process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
