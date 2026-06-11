const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { searchGuildLogs } = require('../../lib/serverLogs');

// ──────────────────────────────────────────────────────────────────
// Categories with friendly labels + associated internal types
// ──────────────────────────────────────────────────────────────────
const CATEGORIES = {
    members: {
        label: '👥 Members',
        color: 0x3498db,
        types: ['MEMBER_JOINED', 'MEMBER_LEFT', 'MEMBER_UPDATED'],
    },
    moderation: {
        label: '🔨 Moderation',
        color: 0xe74c3c,
        types: ['MEMBER_BANNED', 'MEMBER_UNBANNED'],
    },
    messages: {
        label: '💬 Messages',
        color: 0x2ecc71,
        types: ['MESSAGE_DELETED', 'MESSAGE_EDITED', 'MESSAGE_BULK_DELETED'],
    },
    reactions: {
        label: '😀 Reactions',
        color: 0xf1c40f,
        types: ['REACTION_ADDED', 'REACTION_REMOVED', 'REACTIONS_CLEARED', 'REACTION_EMOJI_REMOVED'],
    },
    voice: {
        label: '🎙️ Voice',
        color: 0x9b59b6,
        types: ['VOICE_STATE_UPDATED'],
    },
    channels: {
        label: '📢 Channels',
        color: 0x1abc9c,
        types: ['CHANNEL_CREATED', 'CHANNEL_UPDATED', 'CHANNEL_DELETED', 'CHANNEL_PINS_UPDATED'],
    },
    roles: {
        label: '🎭 Roles',
        color: 0xe67e22,
        types: ['ROLE_CREATED', 'ROLE_UPDATED', 'ROLE_DELETED'],
    },
    threads: {
        label: '🧵 Threads',
        color: 0x95a5a6,
        types: ['THREAD_CREATED', 'THREAD_UPDATED', 'THREAD_DELETED'],
    },
    invites: {
        label: '📨 Invites',
        color: 0x2980b9,
        types: ['INVITE_CREATED', 'INVITE_DELETED'],
    },
    automod: {
        label: '🤖 AutoMod',
        color: 0xc0392b,
        types: ['AUTOMOD_ACTION_EXECUTED', 'AUTOMOD_RULE_CREATED', 'AUTOMOD_RULE_UPDATED', 'AUTOMOD_RULE_DELETED'],
    },
    events: {
        label: '📅 Events',
        color: 0x8e44ad,
        types: ['SCHEDULED_EVENT_CREATED', 'SCHEDULED_EVENT_UPDATED', 'SCHEDULED_EVENT_DELETED', 'SCHEDULED_EVENT_USER_ADD', 'SCHEDULED_EVENT_USER_REMOVE'],
    },
    emojis: {
        label: '😄 Emoji & Stickers',
        color: 0xf39c12,
        types: ['EMOJI_CREATED', 'EMOJI_UPDATED', 'EMOJI_DELETED', 'STICKER_CREATED', 'STICKER_UPDATED', 'STICKER_DELETED'],
    },
    server: {
        label: '⚙️ Server',
        color: 0x7f8c8d,
        types: ['GUILD_UPDATED', 'WEBHOOKS_UPDATED'],
    },
    commands: {
        label: '⚡ Commands',
        color: 0xf1c40f,
        types: ['COMMAND_USED'],
    },
    audit: {
        label: '🛡️ Audit',
        color: 0x2c3e50,
        types: ['AUDIT_ENTRY_CREATED'],
    },
};

// Human-readable label displayed in embeds for each internal type
const TYPE_LABELS = {
    MEMBER_JOINED:              '👋 Member Joined',
    MEMBER_LEFT:                '🚪 Member Left',
    MEMBER_UPDATED:             '✏️ Member Updated',
    MEMBER_BANNED:              '🔨 Member Banned',
    MEMBER_UNBANNED:            '✅ Member Unbanned',
    MESSAGE_DELETED:            '🗑️ Message Deleted',
    MESSAGE_EDITED:             '✏️ Message Edited',
    MESSAGE_BULK_DELETED:       '🗑️ Bulk Message Delete',
    REACTION_ADDED:             '😀 Reaction Added',
    REACTION_REMOVED:           '❌ Reaction Removed',
    REACTIONS_CLEARED:          '🧹 All Reactions Cleared',
    REACTION_EMOJI_REMOVED:     '❌ Reaction Emoji Removed',
    VOICE_STATE_UPDATED:        '🎙️ Voice State Changed',
    CHANNEL_CREATED:            '📢 Channel Created',
    CHANNEL_UPDATED:            '📢 Channel Updated',
    CHANNEL_DELETED:            '📢 Channel Deleted',
    CHANNEL_PINS_UPDATED:       '📌 Pinned Messages Updated',
    ROLE_CREATED:               '🎭 Role Created',
    ROLE_UPDATED:               '🎭 Role Updated',
    ROLE_DELETED:               '🎭 Role Deleted',
    THREAD_CREATED:             '🧵 Thread Created',
    THREAD_UPDATED:             '🧵 Thread Updated',
    THREAD_DELETED:             '🧵 Thread Deleted',
    INVITE_CREATED:             '📨 Invite Created',
    INVITE_DELETED:             '📨 Invite Deleted',
    AUTOMOD_ACTION_EXECUTED:    '🤖 AutoMod Action Taken',
    AUTOMOD_RULE_CREATED:       '🤖 AutoMod Rule Created',
    AUTOMOD_RULE_UPDATED:       '🤖 AutoMod Rule Updated',
    AUTOMOD_RULE_DELETED:       '🤖 AutoMod Rule Deleted',
    SCHEDULED_EVENT_CREATED:    '📅 Scheduled Event Created',
    SCHEDULED_EVENT_UPDATED:    '📅 Scheduled Event Updated',
    SCHEDULED_EVENT_DELETED:    '📅 Scheduled Event Deleted',
    SCHEDULED_EVENT_USER_ADD:   '📅 User RSVP to Event',
    SCHEDULED_EVENT_USER_REMOVE:'📅 User Un-RSVP from Event',
    EMOJI_CREATED:              '😄 Emoji Added',
    EMOJI_UPDATED:              '😄 Emoji Updated',
    EMOJI_DELETED:              '😄 Emoji Removed',
    STICKER_CREATED:            '🎨 Sticker Added',
    STICKER_UPDATED:            '🎨 Sticker Updated',
    STICKER_DELETED:            '🎨 Sticker Removed',
    GUILD_UPDATED:              '⚙️ Server Settings Updated',
    WEBHOOKS_UPDATED:           '⚙️ Webhooks Updated',
    COMMAND_USED:               '⚡ Slash Command Used',
    AUDIT_ENTRY_CREATED:        '🛡️ Audit Log Entry Created',
    PRESENCE_UPDATED:           '🔵 User Status Changed',
    GENERAL_EVENT:              '📋 General Event',
};

// ──────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────

function labelForType(rawType) {
    return TYPE_LABELS[rawType] || `📋 ${rawType}`;
}

function typesForCategory(categoryKey) {
    return CATEGORIES[categoryKey]?.types || null;
}

function colorForCategory(categoryKey) {
    return CATEGORIES[categoryKey]?.color || 0x5865f2;
}

function colorForEntry(entry) {
    for (const cat of Object.values(CATEGORIES)) {
        if (cat.types.includes(entry.type)) return cat.color;
    }
    return 0x5865f2;
}

function formatEntry(entry, index) {
    const label = labelForType(entry.type);
    const ts = Math.floor(Number(entry.timestamp || Date.now()) / 1000);
    const lines = [`**${index + 1}.** ${label}`];

    // Use the stored summary — it has the username captured at log time,
    // so it stays readable even after the user has left the server.
    if (entry.summary && entry.summary !== 'No summary provided.') {
        lines.push(`> ${entry.summary}`);
    }

    // Timestamp + channel (channels stay in the server so <#id> is safe)
    const meta = [`<t:${ts}:R>`];
    if (entry.channelId) meta.push(`<#${entry.channelId}>`);
    lines.push(meta.join('  ·  '));

    // Content preview (deleted / edited messages)
    if (entry.content) {
        const preview = entry.content.length > 120
            ? `${entry.content.slice(0, 117)}...`
            : entry.content;
        lines.push(`\`${preview}\``);
    }

    return lines.join('\n');
}

function buildActiveFilters({ categoryKey, user, channel, query, hours }) {
    const parts = [];
    if (categoryKey) parts.push(`Category: **${CATEGORIES[categoryKey]?.label || categoryKey}**`);
    if (user) parts.push(`User: <@${user.id}>`);
    if (channel) parts.push(`Channel: <#${channel.id}>`);
    if (query) parts.push(`Search: \`${query}\``);
    if (hours) parts.push(`Last **${hours}** hours`);
    return parts.length ? parts.join('  ·  ') : '—';
}

// ──────────────────────────────────────────────────────────────────
// Command definition
// ──────────────────────────────────────────────────────────────────

module.exports = {
    category: 'Info',
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('View the server activity log. All filters are optional.')
        .setDMPermission(false)
        .addStringOption(opt =>
            opt.setName('search')
                .setDescription('Search for a specific word or phrase in the logs')
                .setRequired(false)
        )
        .addStringOption(opt =>
            opt.setName('category')
                .setDescription('Filter by a specific activity category')
                .addChoices(
                    ...Object.entries(CATEGORIES).map(([key, cat]) => ({
                        name: cat.label,
                        value: key,
                    }))
                )
                .setRequired(false)
        )
        .addUserOption(opt =>
            opt.setName('user')
                .setDescription('Only show activity from or about this user')
                .setRequired(false)
        )
        .addChannelOption(opt =>
            opt.setName('channel')
                .setDescription('Only show activity in this channel')
                .setRequired(false)
        )
        .addIntegerOption(opt =>
            opt.setName('hours')
                .setDescription('Only show logs from the last N hours')
                .setMinValue(1)
                .setMaxValue(720)
                .setRequired(false)
        )
        .addIntegerOption(opt =>
            opt.setName('results')
                .setDescription('How many entries to show (default: 10, max: 25)')
                .setMinValue(1)
                .setMaxValue(25)
                .setRequired(false)
        )
        .addBooleanOption(opt =>
            opt.setName('private')
                .setDescription('Only show the response to you')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: '❌ This command can only be used inside a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const query      = interaction.options.getString('search') || null;
        const categoryKey = interaction.options.getString('category') || null;
        const user       = interaction.options.getUser('user') || null;
        const channel    = interaction.options.getChannel('channel') || null;
        const hours      = interaction.options.getInteger('hours') || null;
        const amount     = interaction.options.getInteger('results') || 10;
        const isPrivate  = interaction.options.getBoolean('private') || false;
        const replyFlags = isPrivate ? MessageFlags.Ephemeral : undefined;
        const sinceMs    = hours ? Date.now() - hours * 3_600_000 : null;

        await interaction.deferReply({ flags: replyFlags });

        try {
            const typeFilters = typesForCategory(categoryKey);

            let results = [];
            if (typeFilters) {
                const perType = await Promise.all(
                    typeFilters.map(t =>
                        searchGuildLogs(interaction.guildId, {
                            limit: amount,
                            query,
                            type: t,
                            userId: user?.id || null,
                            channelId: channel?.id || null,
                            sinceMs,
                        })
                    )
                );
                results = perType
                    .flat()
                    .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
                    .slice(0, amount);
            } else {
                results = await searchGuildLogs(interaction.guildId, {
                    limit: amount,
                    query,
                    userId: user?.id || null,
                    channelId: channel?.id || null,
                    sinceMs,
                });
            }

            if (!results.length) {
                return interaction.editReply({
                    content: '📭 No activity found. Try adjusting your filters.',
                });
            }

            // Render entries
            const rendered = [];
            let totalLen = 0;
            for (let i = 0; i < results.length; i++) {
                const chunk = formatEntry(results[i], i);
                if (totalLen + chunk.length + 2 > 3_800) {
                    rendered.push(`*... and ${results.length - i} more entries*`);
                    break;
                }
                rendered.push(chunk);
                totalLen += chunk.length + 2;
            }

            const embedColor = categoryKey
                ? colorForCategory(categoryKey)
                : colorForEntry(results[0]);

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle('📋 Server Activity Log')
                .setDescription(rendered.join('\n\n'))
                .addFields({
                    name: '🔍 Filters',
                    value: buildActiveFilters({ categoryKey, user, channel, query, hours }),
                }, {
                    name: '📊 Showing',
                    value: `**${results.length}** entries`,
                    inline: true,
                })
                .setFooter({
                    text: `${interaction.guild.name}  ·  Requested by ${interaction.user.tag}`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true }),
                })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('/log command failed:', error);
            const errMsg = '❌ An error occurred while reading the logs. Please try again.';
            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({ content: errMsg }).catch(() => {});
            }
            return interaction.reply({ content: errMsg, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    },
};
