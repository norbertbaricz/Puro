const { Events, Routes } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus } = require('@discordjs/voice');

const DEFAULT_GUILD_ID = '1217588804328620163';
const DEFAULT_MEMBER_ID = '486412940199591967';
const DEFAULT_SOUNDBOARD_ID = '1239667321467965654';

const connections = new Set();
const revisions = new Map();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        const cfg = newState.client.config?.events?.guilds?.['the-lunar-pack']?.voice_follow || {};
        if (cfg.enabled === false) return;
        const targetGuildId = cfg.guild_id || DEFAULT_GUILD_ID;
        const targetMemberId = cfg.member_id || DEFAULT_MEMBER_ID;
        const soundboardId = cfg.soundboard_id || DEFAULT_SOUNDBOARD_ID;
        if (newState.id !== targetMemberId) return;

        const guild = newState.guild || oldState.guild;
        if (!guild || guild.id !== targetGuildId) return;

        const oldChannelId = oldState.channelId;
        const newChannelId = newState.channelId;

        if (oldChannelId === newChannelId) return;

        const revision = (revisions.get(guild.id) || 0) + 1;
        revisions.set(guild.id, revision);
        const connection = getVoiceConnection(guild.id);

        if (!newChannelId) {
            if (connection) {
                connection.destroy();
            }
            return;
        }

        const targetChannel = newState.channel;
        if (!targetChannel) return;

        if (connection?.joinConfig?.channelId === targetChannel.id) return;

        try {
            if (connection) {
                connection.destroy();
            }

            const nextConnection = joinVoiceChannel({
                channelId: targetChannel.id,
                guildId: guild.id,
                adapterCreator: guild.voiceAdapterCreator,
                selfDeaf: false,
            });

            connections.add(nextConnection);
            nextConnection.once(VoiceConnectionStatus.Destroyed, () => connections.delete(nextConnection));

            try {
                await entersState(nextConnection, VoiceConnectionStatus.Ready, 7_500);
            } catch {
                await wait(1500);
            }

            if (revisions.get(guild.id) !== revision) return;
            const botVoiceState = guild.members.me?.voice;
            if (!botVoiceState?.channelId || botVoiceState.channelId !== targetChannel.id) {
                console.warn('[VoiceFollow] Soundboard skipped: bot is not connected to the target voice channel yet.');
                return;
            }

            try {
                await newState.client.rest.post(Routes.sendSoundboardSound(targetChannel.id), {
                    body: {
                        sound_id: soundboardId,
                        source_guild_id: targetGuildId,
                    },
                });
            } catch (soundboardError) {
                if (soundboardError?.code === 50167) {
                    console.warn('[VoiceFollow] Soundboard skipped: bot is muted/deafened/suppressed in channel.');
                } else if (soundboardError?.code === 50168) {
                    console.warn(
                        '[VoiceFollow] Soundboard skipped: Discord still reports the bot as outside the voice channel.',
                    );
                } else {
                    console.error('[VoiceFollow] Failed to play soundboard:', soundboardError);
                }
            }
        } catch (error) {
            console.error('[VoiceFollow] Failed to follow member in voice:', error);
        }
    },
    cleanup() {
        for (const connection of connections) {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
        }
        connections.clear();
        revisions.clear();
    },
};
