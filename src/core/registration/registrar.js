const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');
const { createLogger } = require('../logging/logger');

// REST handles Discord bucket limits; this queue coalesces saves and retries failures.
const API_VERSION = '10';
const REST_TIMEOUT_MS = 20_000;
const MAX_RETRY_MS = 60_000;
const log = createLogger('COMMANDS');

const { fingerprint, commandBody } = require('./schema');

class CommandRegistrar {
    constructor(client, { root, rest = null, applicationId = process.env.clientId } = {}) {
        this.client = client;
        this.applicationId = applicationId;
        this.rest = rest || new REST({ version: API_VERSION, timeout: REST_TIMEOUT_MS }).setToken(process.env.TOKEN);
        this.statePath = path.join(root, '.runtime', 'command-scopes.json');
        this.known = new Set();
        this.synced = new Map();
        this.retryAttempt = 0;
        this.stopped = false;
        this.dirty = false;
        try {
            const state = JSON.parse(fs.readFileSync(this.statePath, 'utf8'));
            if (state.applicationId === this.applicationId && Array.isArray(state.scopes)) {
                for (const scope of state.scopes)
                    if (scope === 'global' || /^\d{17,20}$/.test(scope)) this.known.add(scope);
            }
        } catch (error) {
            if (error.code !== 'ENOENT')
                log.warn('Ignoring unreadable command scope history', { error: error.message });
        }
        client.registrationStatus = { status: 'pending', lastSync: null, errors: [] };
    }

    schedule(delay = this.client.config.api.sync_debounce_ms) {
        if (this.stopped || !this.client.isReady()) return;
        this.dirty = true;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.sync();
        }, delay);
    }

    saveScopes() {
        fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
        const temp = `${this.statePath}.tmp`;
        fs.writeFileSync(
            temp,
            JSON.stringify({ applicationId: this.applicationId, scopes: [...this.known] }, null, 2) + '\n',
        );
        fs.renameSync(temp, this.statePath);
    }

    async sync() {
        if (this.stopped) return;
        if (this.running) {
            this.dirty = true;
            return this.running;
        }
        clearTimeout(this.timer);
        this.timer = null;
        this.dirty = false;
        this.running = this.run()
            .catch((error) => {
                log.error('Command synchronization failed', { error });
                this.client.registrationStatus = { status: 'error', lastSync: null, errors: [error.message] };
                this.schedule(Math.min(MAX_RETRY_MS, this.client.config.api.retry_ms * 2 ** this.retryAttempt++));
            })
            .finally(() => {
                this.running = null;
                if (this.dirty && !this.timer && !this.stopped) this.schedule();
            });
        return this.running;
    }

    async run() {
        const targets = this.client.plugins.registrationTargets();
        for (const scope of this.known) if (!targets.has(scope)) targets.set(scope, []);
        const errors = [];
        let needsRetry = false;
        for (const [scope, source] of targets) {
            if (this.stopped) return;
            const body = source.map((command) => commandBody(command, scope));
            const desired = fingerprint(body, scope);
            if (this.synced.get(scope) === desired) continue;
            const route =
                scope === 'global'
                    ? Routes.applicationCommands(this.applicationId)
                    : Routes.applicationGuildCommands(this.applicationId, scope);
            try {
                // Fetch once per scope per process. Execution-only edits cause no PUT.
                if (!this.synced.has(scope)) {
                    const remote = await this.rest.get(route);
                    this.synced.set(scope, fingerprint(remote, scope));
                }
                if (this.synced.get(scope) !== desired) {
                    await this.rest.put(route, { body });
                    this.synced.set(scope, desired);
                    log.info(`Synchronized ${body.length} commands in ${scope}.`);
                }
                if (body.length || (targets.has(scope) && !this.known.has(scope))) this.known.add(scope);
                if (!body.length && !source.length) this.known.delete(scope);
            } catch (error) {
                const message = `${scope}: ${error.message}`;
                errors.push(message);
                log.error('Discord command registration failed; local modules remain available', { scope, error });
                // A guild that removed the bot should not trigger endless retries.
                const code = Number(error.code ?? error.rawError?.code);
                if (![50001, 50013, 10004, 50035, 30032].includes(code)) needsRetry = true;
            }
        }
        this.saveScopes();
        this.client.registrationStatus = {
            status: errors.length ? 'error' : 'synced',
            lastSync: new Date().toISOString(),
            errors,
        };
        if (needsRetry)
            this.schedule(Math.min(MAX_RETRY_MS, this.client.config.api.retry_ms * 2 ** this.retryAttempt++));
        else this.retryAttempt = 0;
    }

    stop() {
        this.stopped = true;
        this.dirty = false;
        clearTimeout(this.timer);
    }
}

module.exports = { CommandRegistrar, fingerprint, commandBody };
