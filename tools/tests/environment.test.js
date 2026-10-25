const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

const ROOT = path.resolve(__dirname, '../..');
const SYNTHETIC_TOKEN = 'offline-test-token-that-is-never-sent-to-discord';
const APPLICATION_ID = '1217588804328620163';

function environment() {
    // Never read the operator's real .env or run inherited Node preload hooks.
    const env = {
        ...process.env,
        PURO_LOG_FILE: 'false',
        LOG_LEVEL: 'FATAL',
        PURO_ENV_FILE: os.devNull,
        DOTENV_CONFIG_PATH: os.devNull,
        DOTENV_KEY: '',
        NODE_OPTIONS: '',
    };
    for (const key of ['TOKEN', 'DISCORD_TOKEN', 'clientId', 'CLIENT_ID', 'APPLICATION_ID']) delete env[key];
    return env;
}

test('startup fails clearly before Discord login when credentials are missing', () => {
    const result = spawnSync(process.execPath, ['app.js'], {
        cwd: ROOT,
        env: environment(),
        encoding: 'utf8',
        timeout: 5000,
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /TOKEN must contain/);
    assert.match(result.stderr, /clientId must contain/);
});

test('current dotenv accepts credential aliases without logging their values', () => {
    const source =
        "const value=require('./src/core/config/environment').loadEnvironment(); console.log(value.applicationId, value.token.length);";
    const result = spawnSync(process.execPath, ['-e', source], {
        cwd: ROOT,
        env: { ...environment(), DISCORD_TOKEN: SYNTHETIC_TOKEN, APPLICATION_ID },
        encoding: 'utf8',
        timeout: 5000,
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, new RegExp(APPLICATION_ID));
    assert.ok(!result.stdout.includes(SYNTHETIC_TOKEN));
    assert.ok(!result.stderr.includes(SYNTHETIC_TOKEN));
});
