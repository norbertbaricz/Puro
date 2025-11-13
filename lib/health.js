/**
 * Health check and monitoring utilities
 * Provides system health status and metrics
 */

const os = require('os');
const { logger } = require('./logger');

const healthLogger = logger.child('Health');

class HealthMonitor {
    constructor(client) {
        this.client = client;
        this.startTime = Date.now();
        this.metrics = {
            commandsExecuted: 0,
            errors: 0,
            lastError: null,
            lastHealthCheck: null
        };
    }

    /**
     * Get current health status
     */
    getStatus() {
        const uptime = Date.now() - this.startTime;
        const memoryUsage = process.memoryUsage();
        const systemMemory = {
            total: os.totalmem(),
            free: os.freemem(),
            used: os.totalmem() - os.freemem()
        };

        const status = {
            healthy: true,
            timestamp: new Date().toISOString(),
            uptime: {
                ms: uptime,
                formatted: this._formatUptime(uptime)
            },
            bot: {
                ready: this.client.isReady(),
                user: this.client.user?.tag || 'Not logged in',
                guilds: this.client.guilds?.cache.size || 0,
                users: this._getTotalUsers(),
                ping: this.client.ws.ping,
                shards: this.client.ws.shards?.size || 1
            },
            memory: {
                process: {
                    rss: this._formatBytes(memoryUsage.rss),
                    heapTotal: this._formatBytes(memoryUsage.heapTotal),
                    heapUsed: this._formatBytes(memoryUsage.heapUsed),
                    external: this._formatBytes(memoryUsage.external)
                },
                system: {
                    total: this._formatBytes(systemMemory.total),
                    free: this._formatBytes(systemMemory.free),
                    used: this._formatBytes(systemMemory.used),
                    percentage: ((systemMemory.used / systemMemory.total) * 100).toFixed(2) + '%'
                }
            },
            cpu: {
                model: os.cpus()[0]?.model || 'Unknown',
                cores: os.cpus().length,
                loadAverage: os.loadavg(),
                usage: this._getCPUUsage()
            },
            metrics: {
                commandsExecuted: this.metrics.commandsExecuted,
                errors: this.metrics.errors,
                errorRate: this._calculateErrorRate(),
                lastError: this.metrics.lastError
            },
            checks: this._runHealthChecks()
        };

        // Determine overall health
        status.healthy = status.checks.every(check => check.passed);
        this.metrics.lastHealthCheck = status;

        return status;
    }

    /**
     * Get health status as simple object
     */
    getSimpleStatus() {
        const status = this.getStatus();
        return {
            healthy: status.healthy,
            uptime: status.uptime.formatted,
            ping: status.bot.ping,
            guilds: status.bot.guilds,
            users: status.bot.users,
            memoryUsage: status.memory.process.heapUsed,
            errors: status.metrics.errors
        };
    }

    /**
     * Run health checks
     */
    _runHealthChecks() {
        const checks = [];

        // Bot connection check
        checks.push({
            name: 'Discord Connection',
            passed: this.client.isReady() && this.client.ws.ping > 0 && this.client.ws.ping < 500,
            message: this.client.isReady() ? 'Connected' : 'Disconnected',
            value: `${this.client.ws.ping}ms`
        });

        // Memory check
        const heapUsed = process.memoryUsage().heapUsed;
        const heapTotal = process.memoryUsage().heapTotal;
        const memoryPercent = (heapUsed / heapTotal) * 100;
        checks.push({
            name: 'Memory Usage',
            passed: memoryPercent < 90,
            message: memoryPercent < 90 ? 'Normal' : 'High',
            value: `${memoryPercent.toFixed(2)}%`
        });

        // Error rate check
        const errorRate = this._calculateErrorRate();
        checks.push({
            name: 'Error Rate',
            passed: errorRate < 0.05, // Less than 5% error rate
            message: errorRate < 0.05 ? 'Low' : 'High',
            value: `${(errorRate * 100).toFixed(2)}%`
        });

        // Uptime check
        const uptime = Date.now() - this.startTime;
        checks.push({
            name: 'Uptime',
            passed: uptime > 60000, // At least 1 minute
            message: uptime > 60000 ? 'Stable' : 'Starting',
            value: this._formatUptime(uptime)
        });

        return checks;
    }

    /**
     * Record command execution
     */
    recordCommand() {
        this.metrics.commandsExecuted++;
    }

    /**
     * Record error
     */
    recordError(error) {
        this.metrics.errors++;
        this.metrics.lastError = {
            message: error.message,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calculate error rate
     */
    _calculateErrorRate() {
        if (this.metrics.commandsExecuted === 0) return 0;
        return this.metrics.errors / this.metrics.commandsExecuted;
    }

    /**
     * Get total users across all guilds
     */
    _getTotalUsers() {
        let total = 0;
        this.client.guilds.cache.forEach(guild => {
            total += guild.memberCount;
        });
        return total;
    }

    /**
     * Format bytes to human readable
     */
    _formatBytes(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Format uptime
     */
    _formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Get CPU usage percentage
     */
    _getCPUUsage() {
        const cpus = os.cpus();
        let totalIdle = 0;
        let totalTick = 0;

        cpus.forEach(cpu => {
            for (const type in cpu.times) {
                totalTick += cpu.times[type];
            }
            totalIdle += cpu.times.idle;
        });

        const idle = totalIdle / cpus.length;
        const total = totalTick / cpus.length;
        const usage = 100 - ~~(100 * idle / total);

        return `${usage}%`;
    }

    /**
     * Start periodic health checks
     */
    startMonitoring(intervalMs = 300000) { // 5 minutes default
        this.monitoringInterval = setInterval(() => {
            const status = this.getStatus();
            
            if (!status.healthy) {
                healthLogger.warn('Health check failed', {
                    failedChecks: status.checks.filter(c => !c.passed)
                });
            } else {
                healthLogger.debug('Health check passed', {
                    uptime: status.uptime.formatted,
                    memory: status.memory.process.heapUsed
                });
            }
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
    }
}

module.exports = { HealthMonitor };
