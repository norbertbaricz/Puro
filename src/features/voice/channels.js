const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { createLogger } = require('../../core/logging/logger');

// Keep ownership transfer names below Discord's slow channel-name rate limit.
const RENAME_COOLDOWN_MS = 10 * 60 * 1000;
const MAX_NAME_LENGTH = 90;
const DEFAULT_BITRATE = 64_000;
const OWNER_PERMISSIONS = {
    ViewChannel: true,
    Connect: true,
    MoveMembers: true,
    MuteMembers: true,
    DeafenMembers: true,
    ManageChannels: true,
};
const BOT_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.Connect,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.MoveMembers,
];
const log = createLogger('TEMP-VOICE');

function channelName(member, config) {
    return (config.name_template || "{user}'s Channel")
        .replaceAll('{user}', member.displayName || member.user.username)
        .slice(0, MAX_NAME_LENGTH);
}

async function createTemporary(guild, member, lobby, state, registry, config) {
    const me = guild.members.me || (await guild.members.fetchMe());
    if (!lobby.permissionsFor(me)?.has(BOT_PERMISSIONS))
        throw new Error(
            'Temporary voice requires View Channel, Connect, Manage Channels, and Move Members in the lobby.',
        );
    const channel = await guild.channels.create({
        name: channelName(member, config),
        type: ChannelType.GuildVoice,
        parent: lobby.parentId || null,
        bitrate: Math.min(guild.maximumBitrate, Number(config.bitrate) || DEFAULT_BITRATE),
        userLimit: Number(config.user_limit ?? 5),
        rtcRegion: config.rtc_region || null,
        permissionOverwrites: [
            { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
            { id: me.id, allow: BOT_PERMISSIONS },
            { id: member.id, allow: Object.keys(OWNER_PERMISSIONS).map((name) => PermissionFlagsBits[name]) },
        ],
    });
    state.channels.set(channel.id, {
        ownerId: member.id,
        botId: me.id,
        lobbyId: lobby.id,
        createdAt: Date.now(),
        lastRenameAt: 0,
    });
    try {
        await registry.persist(guild, state);
        await member.voice.setChannel(channel);
    } catch (error) {
        try {
            await channel.delete('Temporary voice creation failed; rolling back.');
            state.channels.delete(channel.id);
            await registry.persist(guild, state);
        } catch (cleanupError) {
            log.error('Could not roll back a temporary channel', { channelId: channel.id, error: cleanupError });
        }
        throw error;
    }
}

async function reconcile(guild, id, state, registry, config) {
    const record = state.channels.get(id);
    if (!record) return;
    // Changing the lobby to a formerly temporary channel must never delete it.
    if (id === config.lobby_channel_id) {
        state.channels.delete(id);
        await registry.persist(guild, state);
        return;
    }
    let channel = guild.channels.cache.get(id);
    if (!channel) {
        try {
            channel = await guild.channels.fetch(id);
        } catch (error) {
            if (error.code !== 10003) throw error;
        }
    }
    if (!channel) {
        state.channels.delete(id);
        await registry.persist(guild, state);
        return;
    }
    if (channel.type !== ChannelType.GuildVoice) {
        log.warn('Tracked channel is no longer a voice channel; leaving it untouched', { channelId: id });
        return;
    }
    const present = [...guild.voiceStates.cache.values()].filter((voice) => voice.channelId === id);
    // A partial startup cache is not evidence that an occupied channel is empty.
    if (present.some((voice) => !voice.member || typeof voice.member.user?.bot !== 'boolean')) return;
    const humans = present.map((voice) => voice.member).filter((member) => !member.user.bot);
    if (!humans.length) {
        try {
            await channel.delete('Temporary voice channel has no human participants.');
        } catch (error) {
            if (error.code !== 10003) throw error;
        }
        state.channels.delete(id);
        await registry.persist(guild, state);
        return;
    }
    if (humans.some((member) => member.id === record.ownerId)) return;
    const nextOwner = humans[0];
    await channel.permissionOverwrites.edit(nextOwner.id, OWNER_PERMISSIONS);
    if (record.ownerId !== guild.members.me?.id && channel.permissionOverwrites.cache.has(record.ownerId))
        await channel.permissionOverwrites.delete(record.ownerId);
    record.ownerId = nextOwner.id;
    if (Date.now() - (record.lastRenameAt || 0) >= RENAME_COOLDOWN_MS) {
        try {
            await channel.setName(channelName(nextOwner, config));
            record.lastRenameAt = Date.now();
        } catch (error) {
            log.warn('Ownership transferred; channel rename failed', { channelId: id, error: error.message });
        }
    }
    await registry.persist(guild, state);
}

module.exports = { createTemporary, reconcile };
