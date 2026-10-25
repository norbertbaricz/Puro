const { ROOT } = require('../../paths');
const fs = require('node:fs');
const path = require('node:path');
const util = require('node:util');

// Environment variables can override console level and the bounded diagnostic log.
const LOG_LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };
const LOG_FILE = path.join(ROOT, 'logs', 'puro.log');
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const MAX_ERROR_HISTORY = 50;
const recentErrors = [];

function redact(value) {
    let text = String(value);
    for (const [key, secret] of Object.entries(process.env)) {
        if (secret && secret.length >= 8 && /TOKEN|SECRET|PASSWORD|API_KEY|WEBHOOK/i.test(key)) {
            text = text.split(secret).join('[REDACTED]');
        }
    }
    return text
        .replace(/(\/webhooks\/\d+\/)[\w.-]+/g, '$1[REDACTED]')
        .replace(/(\/interactions\/\d+\/)[\w.-]+/g, '$1[REDACTED]')
        .replace(/(Bot |Bearer )[\w.-]+/gi, '$1[REDACTED]');
}

class Logger {
    constructor(options = {}) {
        this.minLevel =
            LOG_LEVELS[String(options.level || process.env.LOG_LEVEL || 'INFO').toUpperCase()] ?? LOG_LEVELS.INFO;
        this.namespace = options.namespace || 'APP';
        this.timestamps = options.timestamps ?? process.env.LOG_TIMESTAMPS !== 'false';
    }

    _log(level, message, meta = {}) {
        if (LOG_LEVELS[level] < this.minLevel) return;
        const timestamp = new Date().toISOString();
        const details = Object.keys(meta).length
            ? ` ${util.inspect(meta, { depth: 5, colors: false, breakLength: Infinity })}`
            : '';
        const line = redact(
            `${this.timestamps ? `[${timestamp}] ` : ''}[${level}] [${this.namespace}] ${message}${details}`,
        );
        if (LOG_LEVELS[level] >= LOG_LEVELS.ERROR) {
            console.error(line);
            recentErrors.push({
                timestamp,
                namespace: this.namespace,
                message: redact(message),
                details: redact(details),
            });
            if (recentErrors.length > MAX_ERROR_HISTORY) recentErrors.shift();
        } else if (level === 'WARN') console.warn(line);
        else console.log(line);
        // Filesystem work is limited to diagnostics, never every Discord message.
        if (LOG_LEVELS[level] >= LOG_LEVELS.WARN && process.env.PURO_LOG_FILE !== 'false') {
            try {
                fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
                if (fs.existsSync(LOG_FILE) && fs.statSync(LOG_FILE).size >= MAX_LOG_BYTES) {
                    fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
                }
                fs.appendFileSync(LOG_FILE, `${line}\n`, { mode: 0o600 });
            } catch (error) {
                console.error(`Cannot write diagnostic log: ${redact(error.message)}`);
            }
        }
    }

    debug(message, meta) {
        this._log('DEBUG', message, meta);
    }
    info(message, meta) {
        this._log('INFO', message, meta);
    }
    warn(message, meta) {
        this._log('WARN', message, meta);
    }
    error(message, meta) {
        this._log('ERROR', message, meta);
    }
    fatal(message, meta) {
        this._log('FATAL', message, meta);
    }
    child(namespace) {
        return new Logger({
            namespace: `${this.namespace}:${namespace}`,
            level: Object.keys(LOG_LEVELS).find((key) => LOG_LEVELS[key] === this.minLevel),
            timestamps: this.timestamps,
        });
    }
}

module.exports = {
    Logger,
    logger: new Logger(),
    createLogger: (namespace, options = {}) => new Logger({ ...options, namespace }),
    recentErrors,
    redact,
};
