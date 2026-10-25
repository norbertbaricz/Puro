const path = require('node:path');
const { ROOT } = require('../../paths');
const { SNOWFLAKE } = require('./defaults');
const { assertRuntime } = require('../runtime/version');

// Credentials stay in .env; application behavior belongs in the YAML settings.
const VALID_LOG_LEVELS = new Set(['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL']);

function loadEnvironment() {
    require('dotenv').config({ path: process.env.PURO_ENV_FILE || path.join(ROOT, '.env'), quiet: true });
    assertRuntime();
    const token = process.env.TOKEN || process.env.DISCORD_TOKEN;
    const applicationId = process.env.clientId || process.env.CLIENT_ID || process.env.APPLICATION_ID;
    const errors = [];
    if (!token || token.length < 20 || /\s/.test(token)) errors.push('TOKEN must contain your Discord bot token.');
    if (!applicationId || !SNOWFLAKE.test(applicationId))
        errors.push('clientId must contain the quoted Discord application ID.');
    if (process.env.LOG_LEVEL && !VALID_LOG_LEVELS.has(process.env.LOG_LEVEL.toUpperCase()))
        errors.push('LOG_LEVEL must be DEBUG, INFO, WARN, ERROR, or FATAL.');
    if (errors.length) throw new Error(`${errors.join('\n')}\nSee .env.example; credential values are never printed.`);
    process.env.TOKEN = token;
    process.env.clientId = applicationId;
    return { token, applicationId };
}

module.exports = { loadEnvironment };
