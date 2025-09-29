const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Moderation',
    data: new SlashCommandBuilder()
        .setName('allnick')
        .setDescription('Change or reset the nickname of many members')
        .addStringOption(option =>
            option.setName('nickname')
                .setDescription('Nickname to set (leave empty to reset)')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Limit to members with this role')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('include_bots')
                .setDescription('Include bots in the operation')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('only_with_nickname')
                .setDescription('Affect only members that currently have a nickname')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Audit log reason')
                .setMaxLength(200)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames),

    async execute(interaction) {
        const config = interaction.client.config.commands.allnick || {};
        const newNick = interaction.options.getString('nickname');
        const role = interaction.options.getRole('role');
        const includeBots = interaction.options.getBoolean('include_bots') ?? true;
        const onlyWithNickname = interaction.options.getBoolean('only_with_nickname') || false;
        const isPrivate = interaction.options.getBoolean('private') || false;
        const reason = (interaction.options.getString('reason') || `Action by /allnick used by ${interaction.user.tag}`).slice(0, 200);
        const guild = interaction.guild;

        // Verificare suplimentară a permisiunilor (bună practică)
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageNicknames)) {
            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(config.color || '#ff0000')
                        .setTitle('⛔ No Permission')
                        .setDescription(config.messages?.no_permission || 'You need "Manage Nicknames" permission to use this command.')
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        const members = await guild.members.fetch();
        const targets = members.filter(m => {
            if (!includeBots && m.user.bot) return false;
            if (role && !m.roles.cache.has(role.id)) return false;
            if (onlyWithNickname && !m.nickname) return false;
            return true;
        });

        if (targets.size === 0) {
            return interaction.editReply({
                embeds: [
                    new EmbedBuilder()
                        .setColor('#ffcc00')
                        .setTitle('No matching members')
                        .setDescription('No members matched your filters (role/bots/nickname).')
                ]
            });
        }

        const preview = new EmbedBuilder()
            .setColor(config.color || '#0099ff')
            .setTitle(newNick ? 'Preview: Change Nicknames' : 'Preview: Reset Nicknames')
            .setDescription(`About to ${newNick ? `set nickname to \`${newNick}\`` : 'reset nicknames'} for:`)
            .addFields(
                { name: 'Targets', value: `${targets.size}`, inline: true },
                { name: 'Include bots', value: includeBots ? 'Yes' : 'No', inline: true },
                { name: 'Only with nickname', value: onlyWithNickname ? 'Yes' : 'No', inline: true },
                ...(role ? [{ name: 'Role filter', value: role.toString(), inline: true }] : []),
                ...(reason ? [{ name: 'Reason', value: reason, inline: false }] : [])
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}` })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('allnick_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('allnick_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('🛑')
        );

        const previewMsg = await interaction.editReply({ embeds: [preview], components: [row] });
        const collector = (await interaction.fetchReply()).createMessageComponentCollector({ time: 30000 });

        let proceed = false;
        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                return;
            }
            if (i.customId === 'allnick_cancel') {
                collector.stop('cancelled');
                const cancelled = EmbedBuilder.from(preview).setColor('#ff6666').setTitle('Operation cancelled');
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ embeds: [cancelled], components: [disabled] });
                return;
            }
            if (i.customId === 'allnick_confirm') {
                proceed = true;
                collector.stop('confirmed');
                const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                const starting = EmbedBuilder.from(preview).setTitle('Working...').setColor('#00b300');
                await i.update({ embeds: [starting], components: [disabled] });
            }
        });

        collector.on('end', async (_c, reasonEnd) => {
            if (!proceed) {
                if (reasonEnd === 'time') {
                    const timeout = EmbedBuilder.from(preview).setColor('#ffcc00').setTitle('Timed out').setDescription('No action taken.');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ embeds: [timeout], components: [disabled] }).catch(() => {});
                }
                return;
            }

            // Execute operation
            let changed = 0, failed = 0, processed = 0;
            const total = targets.size;
            const updateProgress = async () => {
                const prog = new EmbedBuilder()
                    .setColor('#00b300')
                    .setTitle('Processing...')
                    .setDescription(`${processed}/${total} processed`)
                    .addFields(
                        { name: 'Succeeded', value: `**${changed}**`, inline: true },
                        { name: 'Failed', value: `**${failed}**`, inline: true }
                    )
                    .setFooter({ text: `Requested by ${interaction.user.tag}` })
                    .setTimestamp();
                await interaction.editReply({ embeds: [prog] }).catch(() => {});
            };

            let idx = 0;
            for (const member of targets.values()) {
                try {
                    await member.setNickname(newNick || null, reason);
                    changed++;
                } catch (err) {
                    failed++;
                }
                processed++; idx++;
                if (idx % 20 === 0) await updateProgress();
            }
            await updateProgress();

            const result = new EmbedBuilder()
                .setColor(config.color || '#00ff00')
                .setTitle(newNick ? (config.messages?.title_changed || '✅ Nicknames Changed') : (config.messages?.title_reset || '✅ Nicknames Reset'))
                .setDescription(
                    newNick
                        ? (config.messages?.success || 'Changed nickname for **{changed}** members to: `{newNick}`.')
                            .replace('{changed}', changed).replace('{newNick}', newNick)
                        : (config.messages?.reset_success || 'Reset nickname for **{changed}** members.')
                            .replace('{changed}', changed)
                )
                .addFields(
                    { name: 'Succeeded', value: `**${changed}**`, inline: true },
                    { name: 'Failed', value: `**${failed}**`, inline: true }
                )
                .setFooter({ text: `Requested by ${interaction.user.tag}`})
                .setTimestamp();

            await interaction.editReply({ embeds: [result], components: [] });
        });
    },
};
