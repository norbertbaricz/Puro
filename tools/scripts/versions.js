const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const fs = require('node:fs');
const path = require('node:path');
const { ROOT } = require('../../src/paths');
const { latestStable, STABLE_VERSION } = require('../../src/shared/versions');
const { dependencies, devDependencies, overrides } = require('../../package.json');

// Read-only checks; updates remain deliberate so they can be tested before release.
const TIMEOUT_MS = 20_000;
const BATCH_SIZE = 4;
const exec = promisify(execFile);

async function query(name, field) {
    const { stdout } = await exec(
        process.execPath,
        [
            process.env.npm_execpath,
            'view',
            name,
            field,
            '--json',
            '--registry=https://registry.npmjs.org',
            '--fetch-retries=0',
            '--fetch-timeout=15000',
        ],
        { timeout: TIMEOUT_MS, cwd: ROOT },
    );
    return JSON.parse(stdout);
}

async function latest(name) {
    if (name === 'node') return latestStable(await query(name, 'versions'));
    const result = await query(name, 'dist-tags.latest');
    const tagged = Array.isArray(result) ? result.at(-1) : result;
    return typeof tagged === 'string' && STABLE_VERSION.test(tagged)
        ? tagged
        : latestStable(await query(name, 'versions'));
}

async function main() {
    if (!process.env.npm_execpath) throw new Error('Use npm run deps:check.');
    const rows = Object.keys({ ...dependencies, ...devDependencies, ...overrides }).map((name) => ({
        name,
        installed: JSON.parse(fs.readFileSync(path.join(ROOT, 'node_modules', name, 'package.json'), 'utf8')).version,
    }));
    rows.push(
        { name: 'node', installed: process.versions.node },
        { name: 'npm', installed: /npm\/([^ ]+)/.exec(process.env.npm_config_user_agent || '')?.[1] || 'unknown' },
    );
    let failed = false;
    for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
        await Promise.all(
            rows.slice(offset, offset + BATCH_SIZE).map(async (row) => {
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
    console.log(
        'Discord REST: API v10. Only stable releases are checked; alpha, beta, preview, and nightly builds are excluded.',
    );
    if (failed)
        console.log('Review available releases, update the lockfile, then run npm run verify. No files were changed.');
    process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
});
