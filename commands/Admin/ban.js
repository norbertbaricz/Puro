const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const ms = require('ms');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Ban a member from the server.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to ban')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('period')
                .setDescription('Ban duration (e.g. 1d, 7d, permanent)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('delete_days')
                .setDescription('Delete message history (0-7 days)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription("Don't DM the user about the ban")
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    async execute(interaction) {
        const config = interaction.client.config.commands.ban || {};
        const targetMember = interaction.options.getMember('member');
        const period = interaction.options.getString('period');
        const reasonRaw = interaction.options.getString('reason');
        const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
        const silent = interaction.options.getBoolean('silent') || false;
        const isPrivate = interaction.options.getBoolean('private') || false;

        const reason = (reasonRaw && reasonRaw.trim()) || (config.messages?.no_reason || 'No reason provided');

        // Basic validations
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        }
        if (!targetMember) {
            return interaction.reply({ content: config.messages?.user_not_found || 'That user is not in this server.', ephemeral: true });
        }
        if (targetMember.id === interaction.user.id) {
            return interaction.reply({ content: config.messages?.cannot_ban_self || 'You cannot ban yourself.', ephemeral: true });
        }
        if (targetMember.id === interaction.client.user.id) {
            return interaction.reply({ content: config.messages?.cannot_ban_bot || 'I cannot ban myself.', ephemeral: true });
        }
        const me = await interaction.guild.members.fetch(interaction.client.user.id);
        if (!targetMember.bannable || me.roles.highest.comparePositionTo(targetMember.roles.highest) <= 0) {
            return interaction.reply({ content: config.messages?.cannot_ban || 'I cannot ban this member. They may have a higher role than me or I lack permissions.', ephemeral: true });
        }

        // Parse duration
        let periodText = period;
        let unbanAfterMs = null;
        if (period.toLowerCase() !== 'permanent') {
            const msPeriod = ms(period);
            if (!msPeriod || msPeriod < 1000) {
                return interaction.reply({ content: config.messages?.invalid_period || 'Invalid period format.', ephemeral: true });
            }
            periodText = ms(msPeriod, { long: true });
            unbanAfterMs = msPeriod;
        } else {
            periodText = config.messages?.permanent || 'Permanent';
        }

        await interaction.deferReply({ ephemeral: isPrivate });

        // Preview + confirm
        const preview = new EmbedBuilder()
            .setTitle('Confirm Ban')
            .setColor(config.color || 0x8b0000)
            .setDescription(`Are you sure you want to ban ${targetMember} (${targetMember.user.tag})?`)
            .addFields(
                { name: config.messages?.field_user || 'User', value: `${targetMember.user.tag} (${targetMember.id})`, inline: false },
                { name: config.messages?.field_banned_by || 'Banned by', value: `${interaction.user.tag}`, inline: true },
                { name: config.messages?.field_duration || 'Duration', value: periodText, inline: true },
                { name: 'Delete days', value: `${deleteDays}`, inline: true },
                { name: config.messages?.field_reason || 'Reason', value: reason, inline: false }
            );
        const controls = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ban_confirm').setLabel('Confirm').setStyle(ButtonStyle.Danger).setEmoji('🔨'),
            new ButtonBuilder().setCustomId('ban_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🛑')
        );
        await interaction.editReply({ embeds: [preview], components: [controls] });

        const reply = await interaction.fetchReply();
        const collector = reply.createMessageComponentCollector({ time: 30000 });
        let proceed = false;
        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'Only the command invoker can use these buttons.', ephemeral: true });
                return;
            }
            if (i.customId === 'ban_cancel') {
                collector.stop('cancelled');
                const cancelled = EmbedBuilder.from(preview).setTitle('Cancelled').setColor(0xff6666);
                const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ embeds: [cancelled], components: [disabled] });
                return;
            }
            if (i.customId === 'ban_confirm') {
                proceed = true;
                collector.stop('confirmed');
                const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });

                // Try DM (if not silent)
                if (!silent) {
                    targetMember.send({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(0x8b0000)
                                .setTitle('You have been banned')
                                .setDescription(`Server: **${interaction.guild.name}**`)
                                .addFields(
                                    { name: config.messages?.field_duration || 'Duration', value: periodText, inline: true },
                                    { name: config.messages?.field_reason || 'Reason', value: reason, inline: true }
                                )
                                .setTimestamp()
                        ]
                    }).catch(() => {});
                }

                // Perform ban
                await targetMember.ban({ reason, deleteMessageDays: deleteDays });

                // Schedule unban (best-effort; not persistent across restarts)
                if (unbanAfterMs) {
                    setTimeout(async () => {
                        try { await interaction.guild.members.unban(targetMember.id, 'Temporary ban expired'); } catch {}
                    }, unbanAfterMs);
                }

                const embed = new EmbedBuilder()
                    .setTitle(config.messages?.success_title || 'Member Banned')
                    .setColor(config.color || 0x8b0000)
                    .addFields(
                        { name: config.messages?.field_user || 'User', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
                        { name: config.messages?.field_banned_by || 'Banned by', value: `${interaction.user.tag}`, inline: true },
                        { name: config.messages?.field_duration || 'Duration', value: periodText, inline: true },
                        { name: config.messages?.field_reason || 'Reason', value: reason, inline: false }
                    )
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });
            }
        });

        collector.on('end', async (_c, reasonEnd) => {
            if (!proceed && reasonEnd === 'time') {
                const timed = new EmbedBuilder().setTitle('Timed out').setDescription('No action taken.').setColor(0xffcc00);
                const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await interaction.editReply({ embeds: [timed], components: [disabled] }).catch(() => {});
            }
        });
    }
};
