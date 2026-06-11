const { Events } = require('discord.js');
const { appendLogEntry } = require('./serverLogs');

const DEFAULT_MAX_ENTRIES_PER_GUILD = 5000;

const DEFAULT_EVENT_FLAGS = {
    commands: true,
    messages: true,
    reactions: true,
    members: true,
    bans: true,
    roles: true,
    channels: true,
    threads: true,
    voice: true,
    invites: true,
    emojis: true,
    stickers: true,
    presence: true,
    pins: true,
    guild: true,
    scheduled_events: true,
    webhooks: true,
    automod: true,
    audit: true,
};

function hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj, key);
}

function toId(value) {
    if (value === undefined || value === null) return null;
    const str = String(value).trim();
    return str.length ? str : null;
}

function truncate(value, maxLength = 260) {
    if (value === undefined || value === null) return '';
    const text = String(value).replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 3))}...`;
}

function channelDisplay(channel) {
    if (!channel) return 'unknown-channel';
    if (typeof channel.name === 'string' && channel.name.length) {
        return `#${channel.name}`;
    }
    return channel.id ? `#${channel.id}` : 'unknown-channel';
}

function getRuntimeConfig(client) {
    const cfg = client?.config?.audit_logs || {};
    const events = cfg.events && typeof cfg.events === 'object' ? cfg.events : {};
    const maxRaw = Number(cfg.max_entries_per_guild);
    const maxEntriesPerGuild = Number.isFinite(maxRaw) && maxRaw > 0
        ? Math.floor(maxRaw)
        : DEFAULT_MAX_ENTRIES_PER_GUILD;

    return {
        enabled: cfg.enabled !== false,
        events,
        maxEntriesPerGuild,
    };
}

function isEventEnabled(config, key) {
    if (!config) return false;

    if (hasOwn(config.events, key)) {
        return config.events[key] !== false;
    }

    if (hasOwn(DEFAULT_EVENT_FLAGS, key)) {
        return DEFAULT_EVENT_FLAGS[key] !== false;
    }

    return true;
}

async function safeFetchPartial(entity) {
    if (!entity) return entity;
    if (entity.partial && typeof entity.fetch === 'function') {
        try {
            return await entity.fetch();
        } catch {
            return entity;
        }
    }
    return entity;
}

function collectCommandOptions(options = [], bucket = []) {
    for (const option of options) {
        if (!option) continue;

        if (Array.isArray(option.options) && option.options.length > 0) {
            collectCommandOptions(option.options, bucket);
            continue;
        }

        if (option.value === undefined || option.value === null) {
            continue;
        }

        bucket.push(`${option.name}:${truncate(option.value, 60)}`);
    }

    return bucket;
}

function buildRoleDiff(oldMember, newMember) {
    const added = newMember.roles.cache
        .filter(role => !oldMember.roles.cache.has(role.id))
        .map(role => role.name)
        .slice(0, 20);

    const removed = oldMember.roles.cache
        .filter(role => !newMember.roles.cache.has(role.id))
        .map(role => role.name)
        .slice(0, 20);

    return { added, removed };
}

function buildChannelUpdateChanges(oldChannel, newChannel) {
    const changes = [];

    if (oldChannel.name !== newChannel.name) {
        changes.push(`name: ${truncate(oldChannel.name || 'none', 40)} -> ${truncate(newChannel.name || 'none', 40)}`);
    }

    if (oldChannel.parentId !== newChannel.parentId) {
        changes.push(`parent: ${oldChannel.parentId || 'none'} -> ${newChannel.parentId || 'none'}`);
    }

    if (oldChannel.topic !== newChannel.topic) {
        changes.push('topic updated');
    }

    if (oldChannel.nsfw !== newChannel.nsfw) {
        changes.push(`nsfw: ${Boolean(oldChannel.nsfw)} -> ${Boolean(newChannel.nsfw)}`);
    }

    if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
        changes.push(`slowmode: ${oldChannel.rateLimitPerUser || 0}s -> ${newChannel.rateLimitPerUser || 0}s`);
    }

    return changes;
}

function buildThreadUpdateChanges(oldThread, newThread) {
    const changes = [];

    if (oldThread.name !== newThread.name) {
        changes.push(`name: ${truncate(oldThread.name || 'none', 40)} -> ${truncate(newThread.name || 'none', 40)}`);
    }

    if (oldThread.archived !== newThread.archived) {
        changes.push(`archived: ${Boolean(oldThread.archived)} -> ${Boolean(newThread.archived)}`);
    }

    if (oldThread.locked !== newThread.locked) {
        changes.push(`locked: ${Boolean(oldThread.locked)} -> ${Boolean(newThread.locked)}`);
    }

    if (oldThread.parentId !== newThread.parentId) {
        changes.push(`parent: ${oldThread.parentId || 'none'} -> ${newThread.parentId || 'none'}`);
    }

    if (oldThread.rateLimitPerUser !== newThread.rateLimitPerUser) {
        changes.push(`slowmode: ${oldThread.rateLimitPerUser || 0}s -> ${newThread.rateLimitPerUser || 0}s`);
    }

    return changes;
}

function buildGuildUpdateChanges(oldGuild, newGuild) {
    const changes = [];

    if (oldGuild.name !== newGuild.name) {
        changes.push(`name: ${truncate(oldGuild.name || 'none', 50)} -> ${truncate(newGuild.name || 'none', 50)}`);
    }

    if (oldGuild.icon !== newGuild.icon) {
        changes.push('icon changed');
    }

    if (oldGuild.banner !== newGuild.banner) {
        changes.push('banner changed');
    }

    if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
        changes.push(`verification: ${oldGuild.verificationLevel} -> ${newGuild.verificationLevel}`);
    }

    if (oldGuild.premiumTier !== newGuild.premiumTier) {
        changes.push(`premium tier: ${oldGuild.premiumTier} -> ${newGuild.premiumTier}`);
    }

    if (oldGuild.afkChannelId !== newGuild.afkChannelId) {
        changes.push(`afk channel: ${oldGuild.afkChannelId || 'none'} -> ${newGuild.afkChannelId || 'none'}`);
    }

    return changes;
}

function getSubcommandPath(interaction) {
    let subcommandGroup = null;
    let subcommand = null;

    try {
        subcommandGroup = interaction.options.getSubcommandGroup(false);
    } catch {
        subcommandGroup = null;
    }

    try {
        subcommand = interaction.options.getSubcommand(false);
    } catch {
        subcommand = null;
    }

    return {
        subcommandGroup,
        subcommand,
        path: [interaction.commandName, subcommandGroup, subcommand].filter(Boolean).join(' '),
    };
}

function getPresenceStatus(presence) {
    if (!presence) return 'offline';
    return presence.status || 'offline';
}

function buildRoleUpdateChanges(oldRole, newRole) {
    const changes = [];

    if (oldRole.name !== newRole.name) {
        changes.push(`name: ${truncate(oldRole.name || 'none', 40)} -> ${truncate(newRole.name || 'none', 40)}`);
    }

    if (oldRole.color !== newRole.color) {
        changes.push(`color: ${oldRole.color} -> ${newRole.color}`);
    }

    if (oldRole.hoist !== newRole.hoist) {
        changes.push(`hoist: ${Boolean(oldRole.hoist)} -> ${Boolean(newRole.hoist)}`);
    }

    if (oldRole.mentionable !== newRole.mentionable) {
        changes.push(`mentionable: ${Boolean(oldRole.mentionable)} -> ${Boolean(newRole.mentionable)}`);
    }

    if (oldRole.position !== newRole.position) {
        changes.push(`position: ${oldRole.position} -> ${newRole.position}`);
    }

    if (oldRole.permissions?.bitfield !== newRole.permissions?.bitfield) {
        changes.push('permissions changed');
    }

    return changes;
}

function buildScheduledEventChanges(oldEvent, newEvent) {
    const changes = [];

    if (oldEvent.name !== newEvent.name) {
        changes.push(`name: ${truncate(oldEvent.name || 'none', 50)} -> ${truncate(newEvent.name || 'none', 50)}`);
    }

    if (oldEvent.description !== newEvent.description) {
        changes.push('description changed');
    }

    if (oldEvent.channelId !== newEvent.channelId) {
        changes.push(`channel: ${oldEvent.channelId || 'none'} -> ${newEvent.channelId || 'none'}`);
    }

    if (oldEvent.scheduledStartTimestamp !== newEvent.scheduledStartTimestamp) {
        changes.push('start time updated');
    }

    if (oldEvent.scheduledEndTimestamp !== newEvent.scheduledEndTimestamp) {
        changes.push('end time updated');
    }

    if (oldEvent.status !== newEvent.status) {
        changes.push(`status: ${oldEvent.status} -> ${newEvent.status}`);
    }

    return changes;
}

function registerAuditLogListeners(client) {
    if (!client || client.auditLogListenersRegistered) {
        return;
    }

    const runtimeConfig = getRuntimeConfig(client);
    client.auditLogListenersRegistered = true;

    if (!runtimeConfig.enabled) {
        return;
    }

    const record = async (eventKey, guildId, payload) => {
        if (!guildId || !isEventEnabled(runtimeConfig, eventKey)) {
            return;
        }

        try {
            await appendLogEntry(guildId, payload, {
                maxEntriesPerGuild: runtimeConfig.maxEntriesPerGuild,
            });
        } catch (error) {
            console.error('Audit log append error:', error);
        }
    };

    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand() || !interaction.guildId) return;

        const details = getSubcommandPath(interaction);
        const optionSummary = collectCommandOptions(interaction.options?.data || []);

        await record('commands', interaction.guildId, {
            type: 'COMMAND_USED',
            summary: `/${details.path} used by ${interaction.user.tag}`,
            actorId: interaction.user.id,
            channelId: interaction.channelId,
            metadata: {
                command: interaction.commandName,
                subcommandGroup: details.subcommandGroup,
                subcommand: details.subcommand,
                options: optionSummary,
            },
        });
    });

    client.on(Events.MessageDelete, async (message) => {
        const resolved = await safeFetchPartial(message);
        const guildId = resolved?.guildId || message?.guildId;
        if (!guildId) return;

        await record('messages', guildId, {
            type: 'MESSAGE_DELETED',
            summary: `Message by ${resolved?.author?.tag || resolved?.author?.username || 'Unknown User'} deleted in ${channelDisplay(resolved?.channel)}`,
            targetId: resolved?.author?.id || null,
            channelId: resolved?.channelId || null,
            messageId: resolved?.id || null,
            content: truncate(resolved?.content, 600),
            metadata: {
                authorTag: resolved?.author?.tag || null,
                attachmentCount: resolved?.attachments?.size || 0,
            },
        });
    });

    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        const before = await safeFetchPartial(oldMessage);
        const after = await safeFetchPartial(newMessage);
        const guildId = after?.guildId || before?.guildId;
        if (!guildId) return;

        const beforeContent = truncate(before?.content, 360);
        const afterContent = truncate(after?.content, 360);
        const pinsChanged = Boolean(before?.pinned) !== Boolean(after?.pinned);

        if (beforeContent === afterContent && !pinsChanged) {
            return;
        }

        await record('messages', guildId, {
            type: 'MESSAGE_EDITED',
            summary: `Message by ${after?.author?.tag || after?.author?.username || before?.author?.tag || before?.author?.username || 'Unknown User'} edited in ${channelDisplay(after?.channel || before?.channel)}`,
            targetId: after?.author?.id || before?.author?.id || null,
            channelId: after?.channelId || before?.channelId || null,
            messageId: after?.id || before?.id || null,
            metadata: {
                before: beforeContent,
                after: afterContent,
                pinnedBefore: Boolean(before?.pinned),
                pinnedAfter: Boolean(after?.pinned),
            },
        });
    });

    client.on(Events.MessageBulkDelete, async (messages, channel) => {
        const first = messages?.first?.();
        const guildId = channel?.guildId || first?.guildId;
        if (!guildId) return;

        const samples = messages?.first?.(5)?.map(msg => msg.id) || [];

        await record('messages', guildId, {
            type: 'MESSAGE_BULK_DELETED',
            summary: `${messages.size} messages bulk-deleted in ${channelDisplay(channel)}`,
            channelId: channel?.id || first?.channelId || null,
            metadata: {
                count: messages.size,
                sampleMessageIds: samples,
            },
        });
    });

    client.on(Events.MessageReactionAdd, async (reaction, user) => {
        const resolved = await safeFetchPartial(reaction);
        const guildId = resolved?.message?.guildId;
        if (!guildId) return;

        await record('reactions', guildId, {
            type: 'REACTION_ADDED',
            summary: `${user.tag} added reaction ${resolved?.emoji?.toString() || 'unknown'} in ${channelDisplay(resolved?.message?.channel)}`,
            actorId: user.id,
            channelId: resolved?.message?.channelId || null,
            messageId: resolved?.message?.id || null,
            metadata: {
                emoji: resolved?.emoji?.name || null,
                emojiId: resolved?.emoji?.id || null,
                messageAuthorId: resolved?.message?.author?.id || null,
            },
        });
    });

    client.on(Events.MessageReactionRemove, async (reaction, user) => {
        const resolved = await safeFetchPartial(reaction);
        const guildId = resolved?.message?.guildId;
        if (!guildId) return;

        await record('reactions', guildId, {
            type: 'REACTION_REMOVED',
            summary: `${user.tag} removed reaction ${resolved?.emoji?.toString() || 'unknown'} in ${channelDisplay(resolved?.message?.channel)}`,
            actorId: user.id,
            channelId: resolved?.message?.channelId || null,
            messageId: resolved?.message?.id || null,
            metadata: {
                emoji: resolved?.emoji?.name || null,
                emojiId: resolved?.emoji?.id || null,
                messageAuthorId: resolved?.message?.author?.id || null,
            },
        });
    });

    client.on(Events.MessageReactionRemoveAll, async (message, reactions) => {
        const resolvedMessage = await safeFetchPartial(message);
        const guildId = resolvedMessage?.guildId;
        if (!guildId) return;

        await record('reactions', guildId, {
            type: 'REACTIONS_CLEARED',
            summary: `All reactions cleared from a message in ${channelDisplay(resolvedMessage?.channel)}`,
            channelId: resolvedMessage?.channelId || null,
            messageId: resolvedMessage?.id || null,
            metadata: {
                reactionCount: reactions?.size || 0,
            },
        });
    });

    client.on(Events.MessageReactionRemoveEmoji, async (reaction) => {
        const resolved = await safeFetchPartial(reaction);
        const guildId = resolved?.message?.guildId;
        if (!guildId) return;

        await record('reactions', guildId, {
            type: 'REACTION_EMOJI_REMOVED',
            summary: `Reaction emoji ${resolved?.emoji?.toString() || 'unknown'} removed from a message in ${channelDisplay(resolved?.message?.channel)}`,
            channelId: resolved?.message?.channelId || null,
            messageId: resolved?.message?.id || null,
            metadata: {
                emoji: resolved?.emoji?.name || null,
                emojiId: resolved?.emoji?.id || null,
            },
        });
    });

    client.on(Events.GuildMemberAdd, async (member) => {
        await record('members', member.guild.id, {
            type: 'MEMBER_JOINED',
            summary: `${member.user.tag} joined the server`,
            targetId: member.id,
        });
    });

    client.on(Events.GuildMemberRemove, async (member) => {
        await record('members', member.guild.id, {
            type: 'MEMBER_LEFT',
            summary: `${member.user.tag} left or was removed from the server`,
            targetId: member.id,
        });
    });

    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        const changes = [];

        if (oldMember.nickname !== newMember.nickname) {
            changes.push(`nickname: ${truncate(oldMember.nickname || 'none', 30)} -> ${truncate(newMember.nickname || 'none', 30)}`);
        }

        if (oldMember.pending !== newMember.pending) {
            changes.push(`pending: ${Boolean(oldMember.pending)} -> ${Boolean(newMember.pending)}`);
        }

        const oldTimeout = oldMember.communicationDisabledUntilTimestamp || 0;
        const newTimeout = newMember.communicationDisabledUntilTimestamp || 0;
        if (oldTimeout !== newTimeout) {
            changes.push(newTimeout > Date.now() ? 'timeout applied or updated' : 'timeout removed');
        }

        const roleDiff = buildRoleDiff(oldMember, newMember);
        if (roleDiff.added.length) {
            changes.push(`roles added: ${roleDiff.added.join(', ')}`);
        }
        if (roleDiff.removed.length) {
            changes.push(`roles removed: ${roleDiff.removed.join(', ')}`);
        }

        if (!changes.length) {
            return;
        }

        await record('members', newMember.guild.id, {
            type: 'MEMBER_UPDATED',
            summary: `Member updated: ${newMember.user.tag}`,
            targetId: newMember.id,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.GuildBanAdd, async (ban) => {
        await record('bans', ban.guild.id, {
            type: 'MEMBER_BANNED',
            summary: `${ban.user.tag} was banned`,
            targetId: ban.user.id,
            metadata: {
                reason: ban.reason || null,
            },
        });
    });

    client.on(Events.GuildBanRemove, async (ban) => {
        await record('bans', ban.guild.id, {
            type: 'MEMBER_UNBANNED',
            summary: `${ban.user.tag} was unbanned`,
            targetId: ban.user.id,
        });
    });

    client.on(Events.GuildRoleCreate, async (role) => {
        await record('roles', role.guild.id, {
            type: 'ROLE_CREATED',
            summary: `Role created: ${role.name}`,
            targetId: role.id,
            metadata: {
                color: role.color,
                position: role.position,
            },
        });
    });

    client.on(Events.GuildRoleDelete, async (role) => {
        await record('roles', role.guild.id, {
            type: 'ROLE_DELETED',
            summary: `Role deleted: ${role.name}`,
            targetId: role.id,
        });
    });

    client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
        const changes = buildRoleUpdateChanges(oldRole, newRole);
        if (!changes.length) {
            return;
        }

        await record('roles', newRole.guild.id, {
            type: 'ROLE_UPDATED',
            summary: `Role updated: ${newRole.name}`,
            targetId: newRole.id,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.ChannelCreate, async (channel) => {
        const guildId = channel.guild?.id;
        if (!guildId) return;

        await record('channels', guildId, {
            type: 'CHANNEL_CREATED',
            summary: `Channel created: ${channelDisplay(channel)}`,
            channelId: channel.id,
            metadata: {
                type: channel.type,
                parentId: channel.parentId || null,
            },
        });
    });

    client.on(Events.ChannelDelete, async (channel) => {
        const guildId = channel.guild?.id;
        if (!guildId) return;

        await record('channels', guildId, {
            type: 'CHANNEL_DELETED',
            summary: `Channel deleted: ${channelDisplay(channel)}`,
            channelId: channel.id,
            metadata: {
                type: channel.type,
            },
        });
    });

    client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
        const guildId = newChannel.guild?.id || oldChannel.guild?.id;
        if (!guildId) return;

        const changes = buildChannelUpdateChanges(oldChannel, newChannel);
        if (!changes.length) {
            return;
        }

        await record('channels', guildId, {
            type: 'CHANNEL_UPDATED',
            summary: `Channel updated: ${channelDisplay(newChannel)}`,
            channelId: newChannel.id,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.ThreadCreate, async (thread) => {
        const guildId = thread.guild?.id;
        if (!guildId) return;

        await record('threads', guildId, {
            type: 'THREAD_CREATED',
            summary: `Thread created: ${thread.name}`,
            channelId: thread.parentId || thread.id,
            targetId: thread.id,
            metadata: {
                archived: Boolean(thread.archived),
                locked: Boolean(thread.locked),
            },
        });
    });

    client.on(Events.ThreadDelete, async (thread) => {
        const guildId = thread.guild?.id;
        if (!guildId) return;

        await record('threads', guildId, {
            type: 'THREAD_DELETED',
            summary: `Thread deleted: ${thread.name}`,
            channelId: thread.parentId || thread.id,
            targetId: thread.id,
        });
    });

    client.on(Events.ThreadUpdate, async (oldThread, newThread) => {
        const guildId = newThread.guild?.id || oldThread.guild?.id;
        if (!guildId) return;

        const changes = buildThreadUpdateChanges(oldThread, newThread);
        if (!changes.length) {
            return;
        }

        await record('threads', guildId, {
            type: 'THREAD_UPDATED',
            summary: `Thread updated: ${newThread.name}`,
            channelId: newThread.parentId || newThread.id,
            targetId: newThread.id,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
        const guildId = newState.guild?.id || oldState.guild?.id;
        const userId = newState.id || oldState.id;
        if (!guildId || !userId) return;

        if (oldState.channelId !== newState.channelId) {
            let summary = 'Voice channel updated';
            if (!oldState.channelId && newState.channelId) {
                summary = `Voice join: ${newState.member?.user?.tag || userId} joined ${channelDisplay(newState.channel)}`;
            } else if (oldState.channelId && !newState.channelId) {
                summary = `Voice leave: ${oldState.member?.user?.tag || userId} left ${channelDisplay(oldState.channel)}`;
            } else if (oldState.channelId && newState.channelId) {
                summary = `Voice move: ${newState.member?.user?.tag || userId} moved ${channelDisplay(oldState.channel)} -> ${channelDisplay(newState.channel)}`;
            }

            await record('voice', guildId, {
                type: 'VOICE_STATE_UPDATED',
                summary,
                targetId: userId,
                channelId: newState.channelId || oldState.channelId,
                metadata: {
                    beforeChannelId: oldState.channelId || null,
                    afterChannelId: newState.channelId || null,
                },
            });
            return;
        }

        const changes = [];
        if (oldState.serverMute !== newState.serverMute) {
            changes.push(`serverMute: ${Boolean(oldState.serverMute)} -> ${Boolean(newState.serverMute)}`);
        }
        if (oldState.serverDeaf !== newState.serverDeaf) {
            changes.push(`serverDeaf: ${Boolean(oldState.serverDeaf)} -> ${Boolean(newState.serverDeaf)}`);
        }
        if (oldState.selfMute !== newState.selfMute) {
            changes.push(`selfMute: ${Boolean(oldState.selfMute)} -> ${Boolean(newState.selfMute)}`);
        }
        if (oldState.selfDeaf !== newState.selfDeaf) {
            changes.push(`selfDeaf: ${Boolean(oldState.selfDeaf)} -> ${Boolean(newState.selfDeaf)}`);
        }
        if (oldState.streaming !== newState.streaming) {
            changes.push(`streaming: ${Boolean(oldState.streaming)} -> ${Boolean(newState.streaming)}`);
        }
        if (oldState.selfVideo !== newState.selfVideo) {
            changes.push(`selfVideo: ${Boolean(oldState.selfVideo)} -> ${Boolean(newState.selfVideo)}`);
        }

        if (!changes.length) {
            return;
        }

        await record('voice', guildId, {
            type: 'VOICE_STATE_UPDATED',
            summary: `Voice state updated for ${newState.member?.user?.tag || oldState.member?.user?.tag || userId}`,
            targetId: userId,
            channelId: newState.channelId || oldState.channelId,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.InviteCreate, async (invite) => {
        await record('invites', invite.guild?.id, {
            type: 'INVITE_CREATED',
            summary: `Invite created by ${invite.inviter?.tag || invite.inviter?.username || 'Unknown'} in ${channelDisplay(invite.channel)} (code: ${invite.code})`,
            actorId: invite.inviter?.id || null,
            channelId: invite.channel?.id || null,
            metadata: {
                code: invite.code,
                maxUses: invite.maxUses,
                expiresTimestamp: invite.expiresTimestamp || null,
            },
        });
    });

    client.on(Events.InviteDelete, async (invite) => {
        await record('invites', invite.guild?.id, {
            type: 'INVITE_DELETED',
            summary: `Invite deleted from ${channelDisplay(invite.channel)} with code ${invite.code}`,
            channelId: invite.channel?.id || null,
            metadata: {
                code: invite.code,
            },
        });
    });

    client.on(Events.EmojiCreate, async (emoji) => {
        await record('emojis', emoji.guild?.id, {
            type: 'EMOJI_CREATED',
            summary: `Emoji created: ${emoji.name}`,
            targetId: emoji.id,
            metadata: {
                animated: Boolean(emoji.animated),
            },
        });
    });

    client.on(Events.EmojiDelete, async (emoji) => {
        await record('emojis', emoji.guild?.id, {
            type: 'EMOJI_DELETED',
            summary: `Emoji deleted: ${emoji.name}`,
            targetId: emoji.id,
        });
    });

    client.on(Events.EmojiUpdate, async (oldEmoji, newEmoji) => {
        const changes = [];
        if (oldEmoji.name !== newEmoji.name) {
            changes.push(`name: ${oldEmoji.name} -> ${newEmoji.name}`);
        }
        if (oldEmoji.animated !== newEmoji.animated) {
            changes.push(`animated: ${Boolean(oldEmoji.animated)} -> ${Boolean(newEmoji.animated)}`);
        }

        if (!changes.length) {
            return;
        }

        await record('emojis', newEmoji.guild?.id, {
            type: 'EMOJI_UPDATED',
            summary: `Emoji updated: ${newEmoji.name}`,
            targetId: newEmoji.id,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.GuildStickerCreate, async (sticker) => {
        await record('stickers', sticker.guild?.id, {
            type: 'STICKER_CREATED',
            summary: `Sticker created: ${sticker.name}`,
            targetId: sticker.id,
        });
    });

    client.on(Events.GuildStickerDelete, async (sticker) => {
        await record('stickers', sticker.guild?.id, {
            type: 'STICKER_DELETED',
            summary: `Sticker deleted: ${sticker.name}`,
            targetId: sticker.id,
        });
    });

    client.on(Events.GuildStickerUpdate, async (oldSticker, newSticker) => {
        const changes = [];
        if (oldSticker.name !== newSticker.name) {
            changes.push(`name: ${oldSticker.name} -> ${newSticker.name}`);
        }
        if (oldSticker.description !== newSticker.description) {
            changes.push('description updated');
        }

        if (!changes.length) {
            return;
        }

        await record('stickers', newSticker.guild?.id, {
            type: 'STICKER_UPDATED',
            summary: `Sticker updated: ${newSticker.name}`,
            targetId: newSticker.id,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.PresenceUpdate, async (oldPresence, newPresence) => {
        const guildId = newPresence?.guild?.id || oldPresence?.guild?.id;
        if (!guildId) return;

        const oldStatus = getPresenceStatus(oldPresence);
        const newStatus = getPresenceStatus(newPresence);

        if (oldStatus === newStatus) {
            return;
        }

        await record('presence', guildId, {
            type: 'PRESENCE_UPDATED',
            summary: `Presence updated for ${newPresence?.member?.user?.tag || oldPresence?.member?.user?.tag || newPresence?.userId || oldPresence?.userId || 'unknown user'}`,
            targetId: newPresence?.userId || oldPresence?.userId || null,
            metadata: {
                from: oldStatus,
                to: newStatus,
            },
        });
    });

    client.on(Events.ChannelPinsUpdate, async (channel, timestamp) => {
        await record('pins', channel.guild?.id, {
            type: 'CHANNEL_PINS_UPDATED',
            summary: `Pins updated in ${channelDisplay(channel)}`,
            channelId: channel.id,
            metadata: {
                timestamp: timestamp ? new Date(timestamp).toISOString() : null,
            },
        });
    });

    client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
        const changes = buildGuildUpdateChanges(oldGuild, newGuild);
        if (!changes.length) {
            return;
        }

        await record('guild', newGuild.id, {
            type: 'GUILD_UPDATED',
            summary: `Guild settings updated for ${newGuild.name}`,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.GuildScheduledEventCreate, async (event) => {
        await record('scheduled_events', event.guild?.id, {
            type: 'SCHEDULED_EVENT_CREATED',
            summary: `Scheduled event created: ${event.name}`,
            targetId: event.id,
            channelId: event.channelId || null,
            metadata: {
                startTimestamp: event.scheduledStartTimestamp || null,
                endTimestamp: event.scheduledEndTimestamp || null,
                status: event.status,
            },
        });
    });

    client.on(Events.GuildScheduledEventDelete, async (event) => {
        await record('scheduled_events', event.guild?.id, {
            type: 'SCHEDULED_EVENT_DELETED',
            summary: `Scheduled event deleted: ${event.name}`,
            targetId: event.id,
            channelId: event.channelId || null,
        });
    });

    client.on(Events.GuildScheduledEventUpdate, async (oldEvent, newEvent) => {
        const changes = buildScheduledEventChanges(oldEvent, newEvent);
        if (!changes.length) {
            return;
        }

        await record('scheduled_events', newEvent.guild?.id, {
            type: 'SCHEDULED_EVENT_UPDATED',
            summary: `Scheduled event updated: ${newEvent.name}`,
            targetId: newEvent.id,
            channelId: newEvent.channelId || null,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.GuildScheduledEventUserAdd, async (event, user) => {
        await record('scheduled_events', event.guild?.id, {
            type: 'SCHEDULED_EVENT_USER_ADD',
            summary: `${user.tag} subscribed to scheduled event ${event.name}`,
            actorId: user.id,
            targetId: event.id,
            channelId: event.channelId || null,
        });
    });

    client.on(Events.GuildScheduledEventUserRemove, async (event, user) => {
        await record('scheduled_events', event.guild?.id, {
            type: 'SCHEDULED_EVENT_USER_REMOVE',
            summary: `${user.tag} unsubscribed from scheduled event ${event.name}`,
            actorId: user.id,
            targetId: event.id,
            channelId: event.channelId || null,
        });
    });

    client.on(Events.WebhooksUpdate, async (channel) => {
        await record('webhooks', channel.guild?.id, {
            type: 'WEBHOOKS_UPDATED',
            summary: `Webhook configuration updated in ${channelDisplay(channel)}`,
            channelId: channel.id,
        });
    });

    client.on(Events.AutoModerationActionExecution, async (execution) => {
        await record('automod', execution.guildId, {
            type: 'AUTOMOD_ACTION_EXECUTED',
            summary: `AutoMod action executed for rule ${execution.ruleId || 'unknown'}`,
            actorId: execution.userId || null,
            channelId: execution.channelId || null,
            messageId: execution.messageId || null,
            content: truncate(execution.content, 500),
            metadata: {
                ruleId: execution.ruleId || null,
                actionType: execution.action?.type || null,
                alertSystemMessageId: execution.alertSystemMessageId || null,
                matchedKeyword: execution.matchedKeyword || null,
                matchedContent: truncate(execution.matchedContent, 300),
            },
        });
    });

    client.on(Events.AutoModerationRuleCreate, async (rule) => {
        await record('automod', rule.guild?.id, {
            type: 'AUTOMOD_RULE_CREATED',
            summary: `AutoMod rule created: ${rule.name}`,
            targetId: rule.id,
            metadata: {
                triggerType: rule.triggerType,
                eventType: rule.eventType,
                enabled: rule.enabled,
            },
        });
    });

    client.on(Events.AutoModerationRuleDelete, async (rule) => {
        await record('automod', rule.guild?.id, {
            type: 'AUTOMOD_RULE_DELETED',
            summary: `AutoMod rule deleted: ${rule.name}`,
            targetId: rule.id,
        });
    });

    client.on(Events.AutoModerationRuleUpdate, async (oldRule, newRule) => {
        const changes = [];
        if (oldRule.name !== newRule.name) changes.push(`name: ${oldRule.name} -> ${newRule.name}`);
        if (oldRule.enabled !== newRule.enabled) changes.push(`enabled: ${Boolean(oldRule.enabled)} -> ${Boolean(newRule.enabled)}`);
        if (oldRule.triggerType !== newRule.triggerType) changes.push(`triggerType: ${oldRule.triggerType} -> ${newRule.triggerType}`);

        if (!changes.length) {
            return;
        }

        await record('automod', newRule.guild?.id, {
            type: 'AUTOMOD_RULE_UPDATED',
            summary: `AutoMod rule updated: ${newRule.name}`,
            targetId: newRule.id,
            metadata: {
                changes,
            },
        });
    });

    client.on(Events.GuildAuditLogEntryCreate, async (entry, guild) => {
        await record('audit', guild?.id, {
            type: 'AUDIT_ENTRY_CREATED',
            summary: `Audit log entry created (action ${entry.action})`,
            actorId: entry.executorId || null,
            targetId: entry.targetId || null,
            metadata: {
                action: entry.action,
                reason: entry.reason || null,
                extra: entry.extra || null,
            },
        });
    });
}

module.exports = {
    registerAuditLogListeners,
};
