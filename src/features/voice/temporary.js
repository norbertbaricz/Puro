const { registryFor } = require('./registry');
const { createTemporary, reconcile } = require('./channels');

const DEFAULT_COOLDOWN_SECONDS = 15;
const MAX_COOLDOWN_ENTRIES = 5000;

async function handleVoiceUpdate(oldState, newState) {
    const guild = newState.guild || oldState.guild;
    if (!guild || oldState.channelId === newState.channelId) return;
    const registry = registryFor(guild.client);
    const config = guild.client.config.events?.voiceConnect || {};
    await registry.run(guild, async (state) => {
        if (config.enabled !== false && config.lobby_channel_id && newState.channelId === config.lobby_channel_id) {
            const member = newState.member || (await guild.members.fetch(newState.id));
            if (!member.user.bot) {
                const now = Date.now();
                const cooldown = Number(config.cooldown_seconds ?? DEFAULT_COOLDOWN_SECONDS) * 1000;
                const previous = state.cooldowns.get(member.id) || 0;
                if (now - previous >= cooldown) {
                    for (const [id, used] of state.cooldowns) if (used + cooldown <= now) state.cooldowns.delete(id);
                    if (state.cooldowns.size >= MAX_COOLDOWN_ENTRIES)
                        state.cooldowns.delete(state.cooldowns.keys().next().value);
                    state.cooldowns.set(member.id, now);
                    try {
                        const lobby = newState.channel || (await guild.channels.fetch(newState.channelId));
                        if (!lobby) throw new Error('Configured temporary voice lobby is unavailable.');
                        await createTemporary(guild, member, lobby, state, registry, config);
                    } catch (error) {
                        state.cooldowns.delete(member.id);
                        throw error;
                    }
                } else if (oldState.channelId) await member.voice.setChannel(oldState.channelId);
            }
        }
        // Bot departures also trigger cleanup; ownership is assigned only to humans.
        if (oldState.channelId) await reconcile(guild, oldState.channelId, state, registry, config);
    });
}

async function restoreTemporaryChannels(guild, client) {
    const registry = registryFor(client);
    const config = client.config.events?.voiceConnect || {};
    await registry.run(guild, async (state) => {
        for (const id of [...state.channels.keys()]) await reconcile(guild, id, state, registry, config);
    });
}

module.exports = { handleVoiceUpdate, restoreTemporaryChannels };
