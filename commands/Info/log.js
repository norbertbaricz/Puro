const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const {
    searchGuildLogs,
    getGuildLogTypeStats,
    getKnownLogTypes,
    normalizeType,
} = require('../../lib/serverLogs');

const MAX_RESULTS = 25;

function prettifyType(type) {
    return String(type || 'UNKNOWN')
        .split('_')
        .filter(Boolean)
        .map(part => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');
}

function formatEntry(entry, index) {
    const pieces = [];
    pieces.push(`**${index + 1}.** \`${entry.type}\` ${entry.summary}`);

    const details = [`<t:${Math.floor(Number(entry.timestamp || Date.now()) / 1000)}:R>`];
    if (entry.actorId) details.push(`actor: <@${entry.actorId}>`);
    if (entry.targetId) details.push(`target: <@${entry.targetId}>`);
    if (entry.channelId) details.push(`channel: <#${entry.channelId}>`);
    pieces.push(details.join(' | '));

    if (entry.content) {
        pieces.push(`msg: ${entry.content}`);
    }

    return pieces.join('\n');
}

function buildFilterLine({ type, userId, channelId, query, hours }) {
    const filters = [];
    if (type) filters.push(`type=${normalizeType(type)}`);
    if (userId) filters.push(`user=<@${userId}>`);
    if (channelId) filters.push(`channel=<#${channelId}>`);
    if (query) filters.push(`query="${query}"`);
    if (hours) filters.push(`window=${hours}h`);

    return filters.length ? filters.join(' | ') : 'none';
}

module.exports = {
    category: 'Info',
    data: new SlashCommandBuilder()
        .setName('log')
        .setDescription('Search and inspect this server audit log database.')
        .setDMPermission(false)
        .addSubcommand(subcommand =>
            subcommand
                .setName('latest')
                .setDescription('Show latest server logs.')
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('How many records to show (1-25).')
                        .setMinValue(1)
                        .setMaxValue(MAX_RESULTS)
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Optional log type filter.')
                        .setAutocomplete(true)
                        .setRequired(false)
                )
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Filter by actor or target user.')
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Filter by channel.')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option
                        .setName('hours')
                        .setDescription('Only include logs from the last N hours.')
                        .setMinValue(1)
                        .setMaxValue(720)
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option
                        .setName('private')
                        .setDescription('Reply privately (only visible to you).')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('search')
                .setDescription('Search logs by text query.')
                .addStringOption(option =>
                    option
                        .setName('query')
                        .setDescription('Keyword(s) to search in logs.')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('How many records to show (1-25).')
                        .setMinValue(1)
                        .setMaxValue(MAX_RESULTS)
                        .setRequired(false)
                )
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Optional log type filter.')
                        .setAutocomplete(true)
                        .setRequired(false)
                )
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('Filter by actor or target user.')
                        .setRequired(false)
                )
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('Filter by channel.')
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option
                        .setName('hours')
                        .setDescription('Only include logs from the last N hours.')
                        .setMinValue(1)
                        .setMaxValue(720)
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option
                        .setName('private')
                        .setDescription('Reply privately (only visible to you).')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('types')
                .setDescription('Show top log types for this server.')
                .addIntegerOption(option =>
                    option
                        .setName('top')
                        .setDescription('How many log types to list (1-25).')
                        .setMinValue(1)
                        .setMaxValue(25)
                        .setRequired(false)
                )
                .addIntegerOption(option =>
                    option
                        .setName('hours')
                        .setDescription('Only include logs from the last N hours.')
                        .setMinValue(1)
                        .setMaxValue(720)
                        .setRequired(false)
                )
                .addBooleanOption(option =>
                    option
                        .setName('private')
                        .setDescription('Reply privately (only visible to you).')
                        .setRequired(false)
                )
        ),

    async autocomplete(interaction) {
        try {
            const focused = interaction.options.getFocused(true);
            if (focused.name !== 'type') {
                return interaction.respond([]);
            }

            const text = String(focused.value || '').toLowerCase();
            const types = await getKnownLogTypes(interaction.guildId);
            const matches = types
                .filter(type => type.toLowerCase().includes(text))
                .slice(0, 25)
                .map(type => ({
                    name: `${type} (${prettifyType(type)})`,
                    value: type,
                }));

            await interaction.respond(matches);
        } catch {
            await interaction.respond([]).catch(() => {});
        }
    },

    async execute(interaction) {
        if (!interaction.inGuild()) {
            return interaction.reply({
                content: 'This command can only be used inside a server.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const subcommand = interaction.options.getSubcommand();
        const isPrivate = interaction.options.getBoolean('private') || false;
        const flags = isPrivate ? MessageFlags.Ephemeral : undefined;

        try {
            if (subcommand === 'types') {
                const top = interaction.options.getInteger('top') || 10;
                const hours = interaction.options.getInteger('hours') || null;
                const sinceMs = hours ? Date.now() - (hours * 60 * 60 * 1000) : null;

                const stats = await getGuildLogTypeStats(interaction.guildId, {
                    limit: top,
                    sinceMs,
                });

                if (!stats.length) {
                    return interaction.reply({
                        content: 'No log types found for the selected filters.',
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const lines = stats.map((item, idx) => `${idx + 1}. \`${item.type}\` - ${item.count}`);

                const embed = new EmbedBuilder()
                    .setColor(0x00a8ff)
                    .setTitle('Server Log Type Stats')
                    .setDescription(lines.join('\n'))
                    .addFields({
                        name: 'Window',
                        value: hours ? `Last ${hours} hour(s)` : 'All stored logs',
                        inline: true,
                    })
                    .setFooter({ text: `Guild: ${interaction.guild.name}` })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], flags });
            }

            const query = subcommand === 'search' ? interaction.options.getString('query', true) : null;
            const amount = interaction.options.getInteger('amount') || 10;
            const type = interaction.options.getString('type') || null;
            const user = interaction.options.getUser('user');
            const channel = interaction.options.getChannel('channel');
            const hours = interaction.options.getInteger('hours') || null;
            const sinceMs = hours ? Date.now() - (hours * 60 * 60 * 1000) : null;

            await interaction.deferReply({ flags });

            const results = await searchGuildLogs(interaction.guildId, {
                limit: amount,
                query,
                type,
                userId: user?.id || null,
                channelId: channel?.id || null,
                sinceMs,
            });

            if (!results.length) {
                return interaction.editReply({
                    content: 'No logs found for the selected filters.',
                });
            }

            const rendered = [];
            let totalLength = 0;

            for (let i = 0; i < results.length; i++) {
                const chunk = formatEntry(results[i], i);
                if (totalLength + chunk.length + 2 > 3700) {
                    rendered.push(`...and ${results.length - i} more result(s).`);
                    break;
                }
                rendered.push(chunk);
                totalLength += chunk.length + 2;
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865f2)
                .setTitle(subcommand === 'search' ? 'Log Search Results' : 'Latest Server Logs')
                .setDescription(rendered.join('\n\n'))
                .addFields(
                    {
                        name: 'Filters',
                        value: buildFilterLine({
                            type,
                            userId: user?.id || null,
                            channelId: channel?.id || null,
                            query,
                            hours,
                        }),
                    },
                    {
                        name: 'Result Count',
                        value: String(results.length),
                        inline: true,
                    }
                )
                .setFooter({ text: `Guild: ${interaction.guild.name}` })
                .setTimestamp();

            return interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('/log command failed:', error);

            const payload = {
                content: 'An error occurred while reading server logs.',
                flags: MessageFlags.Ephemeral,
            };

            if (interaction.deferred || interaction.replied) {
                return interaction.editReply({ content: payload.content }).catch(() => {});
            }

            return interaction.reply(payload).catch(() => {});
        }
    },
};
