const { createRequire } = require('node:module');
const { setTimeout: wait } = require('node:timers/promises');
const { Collection } = require('discord.js');
const { createLogger } = require('../logging/logger');

// Use the same Gateway implementation and network error set as discord.js.
const {
    KnownNetworkErrorCodes,
    SimpleContextFetchingStrategy,
    WebSocketShard,
    WebSocketShardDestroyRecovery,
    WebSocketShardEvents,
    WebSocketShardStatus,
    managerToFetchingStrategyOptions,
} = createRequire(require.resolve('discord.js'))('@discordjs/ws');

// These delays supplement the SDK's normal reconnect delay after a failed handshake.
const INITIAL_RETRY_MS = 2_000;
const MAX_RETRY_MS = 30_000;
const RETRY_LOG_INTERVAL_MS = 60_000;
const ABNORMAL_CLOSE_CODE = 1006;
const log = createLogger('GATEWAY');

class GatewayShard extends WebSocketShard {
    #stop = new AbortController();
    #failures = 0;
    #lastNoticeAt = 0;
    #waiting = false;
    #recoveries = 0;

    constructor(manager, options, shardId) {
        const context = new SimpleContextFetchingStrategy(manager, options);
        super(context, shardId);
        this.context = context;
        const retrieveSessionInfo = context.retrieveSessionInfo.bind(context);
        context.retrieveSessionInfo = (id) => {
            // Cancel a reconnect already queued inside the SDK when this shard is retired.
            if (this.status === WebSocketShardStatus.Idle && this.#recoveries > 0) {
                this.#stop.signal.throwIfAborted();
            }
            return retrieveSessionInfo(id);
        };

        this.on(WebSocketShardEvents.Ready, () => this.#recovered());
        this.on(WebSocketShardEvents.Resumed, () => this.#recovered());
    }

    #recovered() {
        if (this.#failures > 0) {
            log.info('Discord Gateway connection restored', { shardId: this.id, failedAttempts: this.#failures });
            this.#failures = 0;
        }
    }

    async #waitForRetry() {
        const delayMs = Math.min(MAX_RETRY_MS, INITIAL_RETRY_MS * 2 ** this.#failures);
        this.#failures++;
        const now = performance.now();
        if (this.#failures === 1 || now - this.#lastNoticeAt >= RETRY_LOG_INTERVAL_MS) {
            this.#lastNoticeAt = now;
            const session = await this.context.retrieveSessionInfo(this.id);
            const address = session?.resumeURL ?? this.context.options.gatewayInformation.url;
            log.warn('Discord Gateway is unreachable; retry scheduled', {
                shardId: this.id,
                host: URL.parse(address)?.hostname,
                delayMs,
                failedAttempts: this.#failures,
            });
        }
        await wait(delayMs, undefined, { signal: this.#stop.signal });
    }

    async destroy(options = {}) {
        if (options.recover === undefined) {
            this.#stop.abort();
            return super.destroy(options);
        }

        const { signal } = this.#stop;
        if (signal.aborted || this.#waiting) return;
        this.#recoveries++;
        try {
            if (
                this.status === WebSocketShardStatus.Connecting &&
                options.code === ABNORMAL_CLOSE_CODE &&
                options.recover === WebSocketShardDestroyRecovery.Reconnect
            ) {
                this.#waiting = true;
                try {
                    await this.#waitForRetry();
                } finally {
                    this.#waiting = false;
                }
            }
            if (!signal.aborted) await super.destroy(options);
        } catch (error) {
            if (!signal.aborted || (error !== signal.reason && error.name !== 'AbortError')) throw error;
        } finally {
            this.#recoveries--;
        }
    }
}

function buildGatewayStrategy(manager) {
    // A vanished regional resume host requires a fresh connection to Discord's original Gateway URL.
    KnownNetworkErrorCodes.add('ENOTFOUND');
    const shards = new Collection();
    return {
        async spawn(shardIds) {
            const options = await managerToFetchingStrategyOptions(manager);
            for (const shardId of shardIds) {
                const shard = new GatewayShard(manager, options, shardId);
                for (const event of Object.values(WebSocketShardEvents)) {
                    shard.on(event, (payload) => manager.emit(event, { ...payload, shardId }));
                }
                shards.set(shardId, shard);
            }
        },
        async connect() {
            await Promise.all(shards.map((shard) => shard.connect()));
        },
        async destroy(options) {
            await Promise.all(shards.map((shard) => shard.destroy(options)));
            shards.clear();
        },
        async send(shardId, payload) {
            const shard = shards.get(shardId);
            if (!shard) throw new RangeError(`Shard ${shardId} not found`);
            return shard.send(payload);
        },
        fetchStatus() {
            return shards.mapValues((shard) => shard.status);
        },
    };
}

module.exports = { buildGatewayStrategy };
