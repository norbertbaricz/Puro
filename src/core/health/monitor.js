const os = require('node:os');
const { createLogger } = require('../logging/logger');

// Lightweight runtime metrics; thresholds are grouped for straightforward tuning.
const MAX_PING_MS = 2000;
const MAX_RSS_FRACTION = 0.85;
const DEFAULT_INTERVAL_MS = 300_000;
const log = createLogger('HEALTH');
const bytes = (value) => `${(value / 1024 / 1024).toFixed(1)} MiB`;

class HealthMonitor {
    constructor(client) {
        this.client = client;
        this.startTime = Date.now();
        this.metrics = { commandsExecuted: 0, errors: 0, lastError: null };
    }
    recordCommand() {
        this.metrics.commandsExecuted++;
    }
    recordError(error) {
        this.metrics.errors++;
        this.metrics.lastError = { message: error.message, timestamp: new Date().toISOString() };
    }
    getStatus() {
        const memory = process.memoryUsage();
        const ping = this.client.ws?.ping ?? -1;
        const checks = [
            { name: 'Discord Connection', passed: this.client.isReady() && ping >= 0 && ping < MAX_PING_MS },
            { name: 'Memory Usage', passed: memory.rss < os.totalmem() * MAX_RSS_FRACTION },
        ];
        return {
            healthy: checks.every((check) => check.passed),
            checks,
            uptime: {
                ms: Date.now() - this.startTime,
                formatted: `${Math.floor((Date.now() - this.startTime) / 1000)}s`,
            },
            bot: { ready: this.client.isReady(), guilds: this.client.guilds.cache.size, ping },
            memory: { process: { rss: bytes(memory.rss), heapUsed: bytes(memory.heapUsed) } },
            metrics: { ...this.metrics },
        };
    }
    getSimpleStatus() {
        const status = this.getStatus();
        return {
            healthy: status.healthy,
            uptime: status.uptime.formatted,
            ping: status.bot.ping,
            guilds: status.bot.guilds,
            memoryUsage: status.memory.process.heapUsed,
            errors: status.metrics.errors,
        };
    }
    startMonitoring(intervalMs = DEFAULT_INTERVAL_MS) {
        this.stopMonitoring();
        this.timer = setInterval(() => {
            const status = this.getStatus();
            if (!status.healthy)
                log.warn('Health check failed', { checks: status.checks.filter((check) => !check.passed) });
        }, intervalMs);
        this.timer.unref();
    }
    stopMonitoring() {
        clearInterval(this.timer);
        this.timer = null;
    }
}

module.exports = { HealthMonitor };
