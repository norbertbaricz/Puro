const { withGuildEventState } = require('../../services/guild-state');
const { SNOWFLAKE } = require('../../core/config');

const STATE_KEY = 'temporaryVoiceChannels';
const CONTROLLER = Symbol.for('puro.temporaryVoice.controller');

class VoiceRegistry {
    constructor(client, { store = withGuildEventState } = {}) {
        this.client = client;
        this.store = store;
        this.guilds = new Map();
        this.queues = new Map();
    }
    async state(guild) {
        if (this.guilds.has(guild.id)) return this.guilds.get(guild.id);
        const saved = await this.store((data) => data[STATE_KEY]?.[guild.id] || {}, { persist: false });
        const channels = new Map(
            Object.entries(saved).filter(
                ([id, record]) =>
                    SNOWFLAKE.test(id) &&
                    record &&
                    typeof record.ownerId === 'string' &&
                    SNOWFLAKE.test(record.ownerId) &&
                    record.botId === this.client.user.id,
            ),
        );
        const state = { channels, cooldowns: new Map() };
        this.guilds.set(guild.id, state);
        return state;
    }
    async persist(guild, state) {
        await this.store((data) => {
            data[STATE_KEY] ||= {};
            const previous = data[STATE_KEY][guild.id] || {};
            const otherBots = Object.fromEntries(
                Object.entries(previous).filter(([, record]) => record?.botId !== this.client.user.id),
            );
            data[STATE_KEY][guild.id] = { ...otherBots, ...Object.fromEntries(state.channels) };
        });
    }
    async run(guild, task) {
        const previous = this.queues.get(guild.id) || Promise.resolve();
        const result = previous.then(async () => task(await this.state(guild)));
        const settled = result.then(
            () => undefined,
            () => undefined,
        );
        this.queues.set(guild.id, settled);
        try {
            return await result;
        } finally {
            if (this.queues.get(guild.id) === settled) this.queues.delete(guild.id);
        }
    }
}

function registryFor(client) {
    return (client[CONTROLLER] ||= new VoiceRegistry(client));
}

async function flushTemporaryVoice(client) {
    const registry = client[CONTROLLER];
    if (registry) await Promise.all([...registry.queues.values()]);
}

module.exports = { VoiceRegistry, registryFor, STATE_KEY, flushTemporaryVoice };
