const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { readEconomyDB, ensureUserRecord } = require('../../lib/economy');
const { getJobById, formatPayRange } = require('../../lib/jobs');

module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('wallet')
        .setDescription('Check your wallet balance, job, and earnings history.')
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you')
                .setRequired(false)
        ),
    async execute(interaction) {
        const isPrivate = interaction.options.getBoolean('private') || false;
        const targetUser = interaction.user;
        const conf = interaction.client.config.commands.wallet || {};

        if (isPrivate) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } else {
            await interaction.deferReply();
        }

        const render = async () => {
            const db = readEconomyDB();
            const entry = ensureUserRecord(db, targetUser.id);
            const balance = entry.balance || 0;
            const color = conf.color || 0x2ECC71;
            const title = conf.messages?.title || '💰 Wallet Balance Inquiry';
            const descSelf = conf.messages?.description_self || 'Here is your current wallet balance:';
            const fieldUser = conf.messages?.field_user || 'User';
            const fieldBalance = conf.messages?.field_balance || 'Balance';
            const jobFieldLabel = conf.messages?.field_job || 'Current Job';

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription(descSelf.replace('{user}', `${targetUser}`))
                .addFields(
                    { name: fieldUser, value: `${targetUser}`, inline: true },
                    { name: fieldBalance, value: `\`$${balance.toLocaleString()}\``, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setFooter({ text: 'Puro Bank | Official Statement' })
                .setTimestamp();

            if (entry.job && entry.job.id) {
                const job = getJobById(entry.job.id);
                const jobName = job ? `${job.emoji} ${job.name}` : entry.job.id;
                const payRange = job ? formatPayRange(job) : null;
                const shifts = entry.jobStats?.shiftsCompleted || 0;
                const earnings = entry.jobStats?.totalEarned || 0;
                let value = `${jobName}`;
                if (payRange) {
                    value += `\nPay Range: ${payRange}`;
                }
                if (shifts > 0 || earnings > 0) {
                    value += `\nShifts: ${shifts} • Earned: $${earnings.toLocaleString()}`;
                }
                embed.addFields({ name: jobFieldLabel, value, inline: false });
            } else {
                const unemployedText = conf.messages?.jobless || 'No job assigned.';
                embed.addFields({ name: jobFieldLabel, value: unemployedText, inline: false });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bal_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔁'),
                new ButtonBuilder().setCustomId('bal_tips').setLabel('How to earn?').setStyle(ButtonStyle.Primary).setEmoji('💡'),
                new ButtonBuilder().setCustomId('bal_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 30000 });
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only you can control your view.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'bal_close') {
                    collector.stop('closed');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                    return;
                }
                if (i.customId === 'bal_refresh') {
                    await i.deferUpdate();
                    await render();
                    return;
                }
                if (i.customId === 'bal_tips') {
                    await i.reply({ content: 'Open /job to pick a role, earn with /work, try your luck at /blackjack or /slotmachine, share cash with /pay, and track riches via /leaderboard.', flags: MessageFlags.Ephemeral });
                    return;
                }
            });

            collector.on('end', async (c, reason) => {
                if (reason === 'time') {
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ components: [disabled] }).catch(() => {});
                }
            });
        };

        await render();
    }
};
