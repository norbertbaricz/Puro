const { setTimeout: wait } = require('node:timers/promises');
const { Events, Routes } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionDisconnectReason, VoiceConnectionStatus } = require('@discordjs/voice');
const { createLogger } = require('../../../src/core/logging/logger');

// Defaults are overridden by the guild's voice_follow configuration.
const DEFAULT_GUILD_ID = '1217588804328620163';
const DEFAULT_MEMBER_ID = '486412940199591967';
const DEFAULT_SOUNDBOARD_ID = '1239667321467965654';

// Rejoin with a fresh voice endpoint after a temporary failure. Each delay allows one retry.
const VOICE_READY_TIMEOUT_MS = 10_000;
const VOICE_RETRY_DELAYS_MS = [2_000, 5_000, 12_000];
const RETRYABLE_NETWORK_CODES = new Set([
    'ENOTFOUND',
    'EAI_AGAIN',
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENETUNREACH',
    'EHOSTUNREACH',
    'VOICE_READY_TIMEOUT',
    'VOICE_ADAPTER_UNAVAILABLE',
]);
const TEMPORARY_WS_RESPONSE = /^Unexpected server response: (?:408|5\d{2})$/;
const SOUNDBOARD_SKIPS = {
    50167: 'The bot is muted, deafened, or suppressed in the channel.',
    50168: 'Discord reports the bot outside the target voice channel.',
};

const log = createLogger('VOICE-FOLLOW');
const follows = new Map();

function reportFailure(follow, message, error) {
    log.error(message, { guildId: follow.guild.id, channelId: follow.channelId, error });
    follow.client.healthMonitor?.recordError(error);
}

async function playSoundboard(follow) {
    const { guild, channelId, client, soundboardId, controller } = follow;
    if (follow.soundboardAttempted || controller.signal.aborted || guild.members.me?.voice?.channelId !== channelId) {
        return;
    }
    follow.soundboardAttempted = true;
    try {
        await client.rest.post(Routes.sendSoundboardSound(channelId), {
            body: { sound_id: soundboardId, source_guild_id: guild.id },
            signal: controller.signal,
        });
    } catch (error) {
        if (controller.signal.aborted) return;
        const reason = SOUNDBOARD_SKIPS[error.code];
        if (reason) {
            log.warn('Soundboard skipped', { guildId: guild.id, channelId, reason });
        } else {
            reportFailure(follow, 'Cannot play the follow soundboard sound', error);
        }
    }
}

function runVoiceAttempt(follow) {
    const { guild, channelId, controller } = follow;
    const { signal } = controller;
    const connection = joinVoiceChannel({
        channelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    return new Promise((resolve, reject) => {
        let readyTimer;
        let finished = false;

        function finish(error) {
            if (finished) return;
            finished = true;
            clearTimeout(readyTimer);
            signal.removeEventListener('abort', onAbort);
            connection.off('stateChange', onStateChange);
            try {
                // Stop the failed connection before its own socket close can signal another join.
                if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
            } catch (destroyError) {
                reject(destroyError);
                return;
            } finally {
                connection.off('error', finish);
            }
            if (error) reject(error);
            else resolve();
        }

        function onAbort() {
            finish();
        }

        function onStateChange(_previous, state) {
            if (state.status === VoiceConnectionStatus.Ready) {
                clearTimeout(readyTimer);
                readyTimer = undefined;
                if (follow.failures > 0) {
                    log.info('Discord voice connection restored', {
                        guildId: guild.id,
                        channelId,
                        failedAttempts: follow.failures,
                    });
                    follow.failures = 0;
                }
                void playSoundboard(follow);
                return;
            }
            if (state.status === VoiceConnectionStatus.Destroyed) {
                finish();
                return;
            }
            if (state.status === VoiceConnectionStatus.Disconnected) {
                if (state.reason === VoiceConnectionDisconnectReason.AdapterUnavailable) {
                    const error = Object.assign(new Error('The Discord Gateway is unavailable for voice signalling.'), {
                        code: 'VOICE_ADAPTER_UNAVAILABLE',
                    });
                    queueMicrotask(() => finish(error));
                    return;
                }
                if (state.reason !== VoiceConnectionDisconnectReason.EndpointRemoved) {
                    // A manual disconnect or a do-not-reconnect close ends this follow.
                    queueMicrotask(onAbort);
                    return;
                }
            }
            readyTimer ??= setTimeout(() => {
                finish(
                    Object.assign(new Error('The Discord voice connection did not become ready in time.'), {
                        code: 'VOICE_READY_TIMEOUT',
                    }),
                );
            }, VOICE_READY_TIMEOUT_MS);
        }

        connection.on('error', finish);
        connection.on('stateChange', onStateChange);
        signal.addEventListener('abort', onAbort, { once: true });
        if (signal.aborted) onAbort();
        else onStateChange(null, connection.state);
    });
}

async function followMember(follow) {
    const { signal } = follow.controller;
    try {
        while (!signal.aborted) {
            try {
                await runVoiceAttempt(follow);
                return;
            } catch (error) {
                if (signal.aborted) return;
                const delayMs = VOICE_RETRY_DELAYS_MS[follow.failures];
                const retryable = RETRYABLE_NETWORK_CODES.has(error.code) || TEMPORARY_WS_RESPONSE.test(error.message);
                if (!retryable || delayMs === undefined) throw error;

                follow.failures++;
                log.warn('Discord voice connection interrupted; retry scheduled', {
                    guildId: follow.guild.id,
                    channelId: follow.channelId,
                    reason: error.code ?? error.message,
                    delayMs,
                });
                await wait(delayMs, undefined, { signal });
            }
        }
    } catch (error) {
        if (!signal.aborted) reportFailure(follow, 'Voice connection failed', error);
    } finally {
        if (follows.get(follow.guild.id) === follow) follows.delete(follow.guild.id);
    }
}

module.exports = {
    name: Events.VoiceStateUpdate,
    execute(oldState, newState) {
        const config = newState.client.config?.events?.guilds?.['the-lunar-pack']?.voice_follow || {};
        if (config.enabled === false) return;
        const guild = newState.guild || oldState.guild;
        const targetGuildId = config.guild_id || DEFAULT_GUILD_ID;
        const targetMemberId = config.member_id || DEFAULT_MEMBER_ID;
        if (
            guild?.id !== targetGuildId ||
            newState.id !== targetMemberId ||
            oldState.channelId === newState.channelId
        ) {
            return;
        }

        follows.get(guild.id)?.controller.abort();
        if (!newState.channelId || !newState.channel) return;

        const follow = {
            guild,
            client: newState.client,
            channelId: newState.channelId,
            soundboardId: config.soundboard_id || DEFAULT_SOUNDBOARD_ID,
            controller: new AbortController(),
            failures: 0,
            soundboardAttempted: false,
        };
        follows.set(guild.id, follow);
        void followMember(follow);
    },
    cleanup() {
        for (const follow of follows.values()) follow.controller.abort();
        follows.clear();
    },
};
