const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Timeout a member or clear an existing timeout.')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member to timeout')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duration')
                .setDescription('Timeout duration (e.g., 10m, 1h, 1d). Ignored if clear=true')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('reason')
                .setDescription('Reason for the timeout')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('clear')
                .setDescription('Clear existing timeout for the member')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('silent')
                .setDescription("Don't DM the user about the action")
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately with confirmation')
                .setRequired(false)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        // Obține configurația din client. Se presupune că a fost încărcată la pornire.
        const config = interaction.client.config;
        const timeoutConfig = config.commands.timeout;

        // Verificare dacă secțiunea de config există
        if (!timeoutConfig) {
            console.error("Eroare: Configurația pentru comanda 'timeout' nu a fost găsită.");
            return interaction.reply({ content: '❌ A configuration error occurred. Please contact the bot administrator.', flags: MessageFlags.Ephemeral });
        }

        if (!interaction.inGuild()) {
            return interaction.reply({ content: '❌ This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        }

        const member = interaction.options.getMember('member');
        const durationStr = interaction.options.getString('duration') || '';
        const clear = interaction.options.getBoolean('clear') || false;
        const silent = interaction.options.getBoolean('silent') || false;
        const isPrivate = interaction.options.getBoolean('private') || false;
        const reason = interaction.options.getString('reason') || 'No reason provided';

        if (!member) {
            return interaction.reply({ content: timeoutConfig.messages.user_not_found || 'User not found in this server.', flags: MessageFlags.Ephemeral });
        }
        if (member.id === interaction.user.id) {
             return interaction.reply({ content: timeoutConfig.messages.cannot_timeout_self || '❌ You cannot time out yourself.', flags: MessageFlags.Ephemeral });
        }
        if (member.id === interaction.client.user.id) {
            return interaction.reply({ content: timeoutConfig.messages.cannot_timeout_bot || '❌ I cannot time myself out.', flags: MessageFlags.Ephemeral });
        }
        if (!member.moderatable) {
            return interaction.reply({ content: timeoutConfig.messages.not_moderatable, flags: MessageFlags.Ephemeral });
        }

        // Parse duration if not clearing
        let durationMs = null;
        if (!clear) {
            const durationRegex = /^(\d+)([smhd])$/i;
            const match = durationStr.match(durationRegex);
            if (!match) {
                return interaction.reply({ content: timeoutConfig.messages.invalid_format, flags: MessageFlags.Ephemeral });
            }
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            switch (unit) {
                case 's': durationMs = value * 1000; break;
                case 'm': durationMs = value * 60 * 1000; break;
                case 'h': durationMs = value * 60 * 60 * 1000; break;
                case 'd': durationMs = value * 24 * 60 * 60 * 1000; break;
            }
            const maxDurationMs = 28 * 24 * 60 * 60 * 1000;
            if (durationMs > maxDurationMs) {
                return interaction.reply({ content: timeoutConfig.messages.max_duration_exceeded, flags: MessageFlags.Ephemeral });
            }
        }

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        const actionTitle = clear ? 'Confirm Clear Timeout' : 'Confirm Timeout';
        const actionDesc = clear
            ? `Are you sure you want to clear the timeout for ${member} (${member.user.tag})?`
            : `Are you sure you want to timeout ${member} (${member.user.tag}) for **${durationStr}**?`;
        const preview = new EmbedBuilder()
            .setTitle(actionTitle)
            .setColor(timeoutConfig.color || '#ffcc00')
            .setDescription(actionDesc)
            .addFields(
                { name: 'Reason', value: reason, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL())
            .setTimestamp();
        const controls = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('to_confirm').setLabel('Confirm').setStyle(ButtonStyle.Danger).setEmoji('⏳'),
            new ButtonBuilder().setCustomId('to_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🛑')
        );
        await interaction.editReply({ embeds: [preview], components: [controls] });

        const replyMsg = await interaction.fetchReply();
        const collector = replyMsg.createMessageComponentCollector({ time: 30000 });
        let proceed = false;
        collector.on('collect', async i => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                return;
            }
            if (i.customId === 'to_cancel') {
                collector.stop('cancelled');
                const cancelled = EmbedBuilder.from(preview).setTitle('Cancelled').setColor('#ff6666');
                const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ embeds: [cancelled], components: [disabled] });
                return;
            }
            if (i.customId === 'to_confirm') {
                proceed = true;
                collector.stop('confirmed');
                const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });

                // DM user unless silent
                if (!silent) {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(timeoutConfig.color || '#ffcc00')
                        .setTitle(clear ? 'Your timeout has been cleared' : 'You have been timed out')
                        .setDescription(`Server: **${interaction.guild.name}**`)
                        .addFields(
                            ...(clear ? [] : [{ name: 'Duration', value: durationStr, inline: true }]),
                            { name: 'Reason', value: reason, inline: true }
                        )
                        .setTimestamp();
                    member.send({ embeds: [dmEmbed] }).catch(() => {});
                }

                try {
                    await member.timeout(clear ? null : durationMs, `${clear ? 'Cleared' : 'Applied'} by ${interaction.user.tag} • ${reason}`);
                    const successEmbed = new EmbedBuilder()
                        .setTitle(clear ? '✅ Timeout Cleared' : timeoutConfig.messages.success_title)
                        .setDescription(
                            clear
                                ? `${member} is no longer timed out.`
                                : timeoutConfig.messages.success_desc
                                    .replace('{user}', member.user.tag)
                                    .replace('{duration}', durationStr)
                        )
                        .setColor(timeoutConfig.color || '#ffcc00')
                        .setThumbnail(member.user.displayAvatarURL())
                        .setTimestamp();
                    await interaction.editReply({ embeds: [successEmbed] });
                } catch (error) {
                    console.error('Failed to apply timeout action:', error);
                    const errEmbed = new EmbedBuilder()
                        .setTitle('❌ Error')
                        .setDescription(timeoutConfig.messages.error)
                        .setColor('#ff0000');
                    await interaction.editReply({ embeds: [errEmbed], components: [] });
                }
            }
        });

        collector.on('end', async (_c, reason) => {
            if (!proceed && reason === 'time') {
                const timed = new EmbedBuilder().setTitle('Timed out').setDescription('No action taken.').setColor('#ffcc00');
                const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await interaction.editReply({ embeds: [timed], components: [disabled] }).catch(() => {});
            }
        });
    },
};
