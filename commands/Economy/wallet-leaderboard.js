const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { withEconomy, ensureUserRecord, snapshotEntry } = require('../../lib/economy');
const { safeEditReply, safeReply, safeUpdate, isUnknownInteractionError } = require('../../lib/interactionSafety');

module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the richest members with pagination')
        .addIntegerOption(option =>
            option.setName('top')
                .setDescription('How many entries per page (5-20, default 10)')
                .setMinValue(5)
                .setMaxValue(20)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('guild_only')
                .setDescription('Show only members from this server')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately (only you can see)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const conf = interaction.client.config.commands.leaderboard || {};
        const color = conf.color || 0xFFD700;
        const title = conf.messages?.title || '👑 Top 10 Richest Members 👑';
        const emptyMsg = conf.messages?.no_members || 'It looks like there are no members with money yet!';

        const perPage = interaction.options.getInteger('top') || 10;
        const guildOnly = interaction.options.getBoolean('guild_only') || false;
        const isPrivate = interaction.options.getBoolean('private') || false;

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        const { entries, selfBalance } = await withEconomy((db) => {
            const normalized = Object.entries(db).map(([id]) => [id, snapshotEntry(ensureUserRecord(db, id))]);
            const self = ensureUserRecord(db, interaction.user.id);
            return {
                entries: normalized,
                selfBalance: self.balance || 0
            };
        });

        let sortedUsers = entries
            .filter(([, data]) => data && typeof data.balance === 'number')
            .sort(([, a], [, b]) => b.balance - a.balance);

        if (guildOnly) {
            const members = await interaction.guild.members.fetch();
            const memberIds = new Set(members.map(m => m.user.id));
            sortedUsers = sortedUsers.filter(([id]) => memberIds.has(id));
        }

        const yourIndex = sortedUsers.findIndex(([id]) => id === interaction.user.id);
        const yourBalance = selfBalance;

        const pages = Math.max(1, Math.ceil(sortedUsers.length / perPage));
        let page = 0;
        const medals = ['🥇', '🥈', '🥉'];

        const buildPage = async (pageIndex) => {
            const start = pageIndex * perPage;
            const slice = sortedUsers.slice(start, start + perPage);
            const users = await Promise.all(slice.map(([uid]) => interaction.client.users.fetch(uid).catch(() => ({ id: uid, username: 'Unknown User' }))));
            const lines = slice.length ? users.map((u, idx) => {
                const [, data] = slice[idx];
                const rank = start + idx + 1;
                const marker = medals[rank - 1] || `#${rank}`;
                const name = u.username || `User ${u.id}`;
                return `${marker} **${name}** — \`$${data.balance.toLocaleString()}\``;
            }).join('\n') : emptyMsg;

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(color)
                .setDescription(lines)
                .setFooter({ text: `Page ${pageIndex + 1}/${pages}` })
                .setTimestamp();

            if (yourIndex !== -1) {
                embed.addFields({ name: 'Your Rank', value: `#${yourIndex + 1} — \`$${yourBalance.toLocaleString()}\``, inline: false });
            } else {
                embed.addFields({ name: 'Your Rank', value: `Not ranked yet — \`$${yourBalance.toLocaleString()}\``, inline: false });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('lb_prev').setLabel('Prev').setStyle(ButtonStyle.Secondary).setEmoji('◀️').setDisabled(pageIndex === 0),
                new ButtonBuilder().setCustomId('lb_next').setLabel('Next').setStyle(ButtonStyle.Secondary).setEmoji('▶️').setDisabled(pageIndex >= pages - 1),
                new ButtonBuilder().setCustomId('lb_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );
            return { embed, row };
        };

        const first = await buildPage(page);
        await interaction.editReply({ embeds: [first.embed], components: [first.row] });

        const msg = await interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async i => {
            try {
                if (i.user.id !== interaction.user.id) {
                    await safeReply(i, { content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'lb_close') {
                    collector.stop('closed');
                    const disabled = new ActionRowBuilder().addComponents(first.row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await safeUpdate(i, { components: [disabled] });
                    return;
                }
                if (i.customId === 'lb_prev' && page > 0) page -= 1;
                if (i.customId === 'lb_next' && page < pages - 1) page += 1;
                const view = await buildPage(page);
                await safeUpdate(i, { embeds: [view.embed], components: [view.row] });
            } catch (error) {
                if (!isUnknownInteractionError(error)) {
                    console.error('Leaderboard collector error:', error);
                }
            }
        });

        collector.on('end', async (_c, reason) => {
            try {
                if (reason === 'time') {
                    const disabled = new ActionRowBuilder().addComponents(first.row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await safeEditReply(interaction, { components: [disabled] });
                }
            } catch (error) {
                if (!isUnknownInteractionError(error)) {
                    console.error('Leaderboard collector end error:', error);
                }
            }
        });
    }
};
