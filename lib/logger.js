/**
 * Structured logging utility for Puro Discord Bot
 * Provides consistent, colorful, and configurable logging across the application
 */

const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    FATAL: 4
};

const LOG_COLORS = {
    DEBUG: '\x1b[36m',   // Cyan
    INFO: '\x1b[32m',    // Green
    WARN: '\x1b[33m',    // Yellow
    ERROR: '\x1b[31m',   // Red
    FATAL: '\x1b[35m',   // Magenta
    RESET: '\x1b[0m'
};

const LOG_ICONS = {
    DEBUG: '🔍',
    INFO: '✅',
    WARN: '⚠️',
    ERROR: '❌',
    FATAL: '💀'
};

class Logger {
    constructor(options = {}) {
        this.minLevel = LOG_LEVELS[options.level?.toUpperCase()] ?? LOG_LEVELS.INFO;
        this.useColors = options.colors !== false;
        this.useIcons = options.icons !== false;
        this.timestamps = options.timestamps !== false;
        this.namespace = options.namespace || 'APP';
    }

    _format(level, message, meta = {}) {
        const parts = [];

        if (this.timestamps) {
            parts.push(`[${new Date().toISOString()}]`);
        }

        const icon = this.useIcons ? LOG_ICONS[level] : '';
        const color = this.useColors ? LOG_COLORS[level] : '';
        const reset = this.useColors ? LOG_COLORS.RESET : '';

        parts.push(`${color}${icon} [${level}]${reset}`);
        parts.push(`[${this.namespace}]`);
        parts.push(message);

        if (Object.keys(meta).length > 0) {
            parts.push(JSON.stringify(meta));
        }

        return parts.join(' ');
    }

    _log(level, message, meta) {
        if (LOG_LEVELS[level] < this.minLevel) return;

        const formatted = this._format(level, message, meta);
        
        if (level === 'ERROR' || level === 'FATAL') {
            console.error(formatted);
        } else {
            console.log(formatted);
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

    // Create a child logger with a different namespace
    child(namespace) {
        return new Logger({
            level: Object.keys(LOG_LEVELS).find(k => LOG_LEVELS[k] === this.minLevel),
            colors: this.useColors,
            icons: this.useIcons,
            timestamps: this.timestamps,
            namespace: `${this.namespace}:${namespace}`
        });
    }
}

// Export singleton instance with environment-based configuration
const defaultLogger = new Logger({
    level: process.env.LOG_LEVEL || 'INFO',
    colors: process.env.LOG_COLORS !== 'false',
    icons: process.env.LOG_ICONS !== 'false',
    timestamps: process.env.LOG_TIMESTAMPS !== 'false'
});

module.exports = {
    Logger,
    logger: defaultLogger,
    createLogger: (namespace, options = {}) => new Logger({ ...options, namespace })
};
