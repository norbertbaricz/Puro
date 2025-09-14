const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to kick')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the kick')
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription("Don't DM the user about the kick")
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately with confirmation')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionsBitField.Flags.KickMembers),

    async execute(interaction) {
        const config = interaction.client.config.commands.kick || {};
        const messages = config.messages || {};

        // Ensure this runs only in a guild and permissions are checked robustly
        if (!interaction.inGuild()) {
            return interaction.reply({ content: '❌ This command can only be used in a server channel.', flags: MessageFlags.Ephemeral });
        }

        const canMemberKick = interaction.memberPermissions?.has(PermissionsBitField.Flags.KickMembers);
        if (!canMemberKick) {
            return interaction.reply({ content: messages.no_permission || 'You do not have permission to use this command.', flags: MessageFlags.Ephemeral });
        }

        if (!interaction.guild.members.me?.permissions?.has(PermissionsBitField.Flags.KickMembers)) {
            return interaction.reply({ content: messages.bot_no_permission || 'I do not have permission to kick members.', flags: MessageFlags.Ephemeral });
        }

        const member = interaction.options.getMember('member');
        const reasonRaw = interaction.options.getString('reason');
        const silent = interaction.options.getBoolean('silent') || false;
        const isPrivate = interaction.options.getBoolean('private') || false;
        const reason = (reasonRaw && reasonRaw.trim()) || messages.no_reason || 'No reason provided';

        if (!member) {
            return interaction.reply({ content: messages.user_not_found || 'That user is not in this server.', flags: MessageFlags.Ephemeral });
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({ content: messages.cannot_kick_self || 'You cannot kick yourself.', flags: MessageFlags.Ephemeral });
        }
        
        if (member.id === interaction.client.user.id) {
            return interaction.reply({ content: messages.cannot_kick_bot || 'I cannot kick myself.', flags: MessageFlags.Ephemeral });
        }

        const me = await interaction.guild.members.fetch(interaction.client.user.id);
        if (!member.kickable || me.roles.highest.comparePositionTo(member.roles.highest) <= 0) {
            return interaction.reply({ content: messages.cannot_kick_member || 'I cannot kick this member.', flags: MessageFlags.Ephemeral });
        }
        try {
            await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

            // Preview + confirmation
            const preview = new EmbedBuilder()
                .setTitle('Confirm Kick')
                .setColor(config.color || 0xff0000)
                .setDescription(`Are you sure you want to kick ${member} (${member.user.tag})?`)
                .addFields(
                    { name: messages.field_user || 'User', value: `${member.user.tag} (${member.id})`, inline: false },
                    { name: messages.field_kicked_by || 'Kicked by', value: `${interaction.user.tag}`, inline: true },
                    { name: messages.field_reason || 'Reason', value: reason, inline: true }
                )
                .setTimestamp();

            const controls = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('kick_confirm').setLabel('Confirm').setStyle(ButtonStyle.Danger).setEmoji('👢'),
                new ButtonBuilder().setCustomId('kick_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🛑')
            );
            await interaction.editReply({ embeds: [preview], components: [controls] });

            const reply = await interaction.fetchReply();
            const collector = reply.createMessageComponentCollector({ time: 30000 });
            let proceed = false;
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'kick_cancel') {
                    collector.stop('cancelled');
                    const cancelled = new EmbedBuilder().setColor('#ff6666').setTitle('Cancelled').setDescription('No action taken.');
                    const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ embeds: [cancelled], components: [disabled] });
                    return;
                }
                if (i.customId === 'kick_confirm') {
                    proceed = true;
                    collector.stop('confirmed');
                    const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });

                    // Try DM unless silent
                    if (!silent) {
                        member.send({
                            embeds: [
                                new EmbedBuilder()
                                    .setColor(0xff0000)
                                    .setTitle('You have been kicked')
                                    .setDescription(`Server: **${interaction.guild.name}**`)
                                    .addFields({ name: messages.field_reason || 'Reason', value: reason, inline: true })
                                    .setTimestamp()
                            ]
                        }).catch(() => {});
                    }

                    await member.kick(reason);

                    const embed = new EmbedBuilder()
                        .setTitle(messages.success_title || 'Member Kicked')
                        .setColor(config.color || 0xff0000)
                        .addFields(
                            { name: messages.field_user || 'User', value: `${member.user.tag} (${member.id})`, inline: true },
                            { name: messages.field_kicked_by || 'Kicked by', value: `${interaction.user.tag}`, inline: true },
                            { name: messages.field_reason || 'Reason', value: reason, inline: false }
                        )
                        .setTimestamp()
                        .setFooter({ text: (messages.footer || 'Guild: {guildName}').replace('{guildName}', interaction.guild.name) });

                    await interaction.editReply({ embeds: [embed] });
                }
            });

            collector.on('end', async (_c, reason) => {
                if (!proceed && reason === 'time') {
                    const timed = new EmbedBuilder().setColor('#ffcc00').setTitle('Timed out').setDescription('No action taken.');
                    const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ embeds: [timed], components: [disabled] }).catch(() => {});
                }
            });

        } catch (error) {
            console.error(`Failed to kick member ${member?.user?.tag || member?.id}:`, error);
            const already = interaction.replied || interaction.deferred;
            const payload = { content: (messages.error || 'An error occurred: {error}').replace('{error}', error.message), flags: MessageFlags.Ephemeral };
            if (already) await interaction.editReply(payload); else await interaction.reply(payload);
        }
    }
};
