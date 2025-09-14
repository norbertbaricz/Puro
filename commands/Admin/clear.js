const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages from channel')
        .addIntegerOption(option =>
            option.setName('amount').setDescription('Number (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
        .addUserOption(option =>
            option.setName('user').setDescription('Only delete messages from this user').setRequired(false))
        .addStringOption(option =>
            option.setName('contains').setDescription('Only delete messages containing this text').setRequired(false))
        .addBooleanOption(option =>
            option.setName('bots_only').setDescription('Only delete messages from bots').setRequired(false))
        .addBooleanOption(option =>
            option.setName('attachments_only').setDescription('Only delete messages with attachments').setRequired(false))
        .addBooleanOption(option =>
            option.setName('include_pinned').setDescription('Include pinned messages (default: no)').setRequired(false))
        .addBooleanOption(option =>
            option.setName('private').setDescription('Reply privately').setRequired(false)),

    async execute(interaction) {
        const config = interaction.client.config.commands.clear;
        try {
            // Guild-only guard and robust permission checks
            if (!interaction.inGuild()) {
                const embed = new EmbedBuilder()
                    .setColor(config.color || '#ff0000')
                    .setTitle('⛔ Server Only')
                    .setDescription('This command can only be used in a server channel.');
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                const embed = new EmbedBuilder()
                    .setColor(config.color || '#ff0000')
                    .setTitle('⛔ No Permission')
                    .setDescription(config.messages.no_permission);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (!interaction.guild.members.me?.permissions?.has(PermissionFlagsBits.ManageMessages)) {
                const embed = new EmbedBuilder()
                    .setColor(config.color || '#ff0000')
                    .setTitle('⛔ Missing Bot Permission')
                    .setDescription(config.messages.no_bot_permission);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');
            const contains = interaction.options.getString('contains');
            const botsOnly = interaction.options.getBoolean('bots_only') || false;
            const attachmentsOnly = interaction.options.getBoolean('attachments_only') || false;
            const includePinned = interaction.options.getBoolean('include_pinned') || false;
            const isPrivate = interaction.options.getBoolean('private') || false;

            await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

            // Fetch up to 100 recent messages for filtering (bulkDelete limit anyway)
            const messages = await interaction.channel.messages.fetch({ limit: 100 });
            const fourteenDays = 14 * 24 * 60 * 60 * 1000;
            const containsLower = contains ? contains.toLowerCase() : null;

            const matched = messages.filter(msg => {
                const age = Date.now() - msg.createdTimestamp;
                if (age >= 1209600000) return false; // bulkDelete can't delete >= 14 days
                if (!includePinned && msg.pinned) return false;
                if (targetUser && msg.author.id !== targetUser.id) return false;
                if (botsOnly && !msg.author.bot) return false;
                if (attachmentsOnly && msg.attachments.size === 0) return false;
                if (containsLower && !(msg.content || '').toLowerCase().includes(containsLower)) return false;
                return true;
            });

            const toDelete = matched.first(amount);
            const toDeleteCount = toDelete ? toDelete.length : 0;

            if (!toDeleteCount) {
                const embed = new EmbedBuilder()
                    .setColor(config.color || '#ffcc00')
                    .setTitle('⚠️ No Messages')
                    .setDescription(config.messages.no_messages);
                return interaction.editReply({ embeds: [embed] });
            }

            // Preview + confirm
            const preview = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('Confirm Clear')
                .setDescription(`Found ${matched.size} matching messages. Will delete the latest ${toDeleteCount}.`)
                .addFields(
                    { name: 'Filters', value: [
                        targetUser ? `user:${targetUser.tag}` : null,
                        contains ? `contains:"${contains}"` : null,
                        botsOnly ? 'bots_only:true' : null,
                        attachmentsOnly ? 'attachments_only:true' : null,
                        includePinned ? 'include_pinned:true' : null
                    ].filter(Boolean).join(' | ') || 'none', inline: false },
                    { name: 'Note', value: 'Messages older than 14 days cannot be bulk deleted.', inline: false }
                )
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('clear_confirm').setLabel('Confirm').setStyle(ButtonStyle.Danger).setEmoji('🧹'),
                new ButtonBuilder().setCustomId('clear_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary).setEmoji('🛑')
            );

            await interaction.editReply({ embeds: [preview], components: [row] });

            const reply = await interaction.fetchReply();
            const collector = reply.createMessageComponentCollector({ time: 30000 });
            let proceed = false;
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'clear_cancel') {
                    collector.stop('cancelled');
                    const cancelled = new EmbedBuilder().setColor('#ff6666').setTitle('Cancelled').setDescription('No messages were deleted.');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ embeds: [cancelled], components: [disabled] });
                    return;
                }
                if (i.customId === 'clear_confirm') {
                    proceed = true;
                    collector.stop('confirmed');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });

                    try {
                        // Delete the selected messages directly
                        const deleted = await interaction.channel.bulkDelete(toDelete, true);

                        const done = new EmbedBuilder()
                            .setColor(config.color || '#00ff00')
                            .setTitle('✅ Messages Deleted')
                            .setDescription(
                                config.messages.success
                                    .replace('{count}', deleted.size)
                                    .replace('{s}', deleted.size === 1 ? '' : 's')
                            );
                        await interaction.editReply({ embeds: [done] });
                    } catch (err) {
                        console.error('Clear confirm error:', err);
                        const fail = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('❌ Error')
                            .setDescription(config.messages.error || 'An error occurred while clearing messages.');
                        await interaction.editReply({ embeds: [fail] }).catch(() => {});
                    }
                }
            });

            collector.on('end', async (_c, reason) => {
                if (!proceed && reason === 'time') {
                    const timed = new EmbedBuilder().setColor('#ffcc00').setTitle('Timed out').setDescription('No action taken.');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ embeds: [timed], components: [disabled] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error('Clear error:', error);
            const embed = new EmbedBuilder()
                .setColor(config.color || '#ff0000')
                .setTitle('❌ Error')
                .setDescription(config.messages.error || 'An error occurred while clearing messages.');
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ embeds: [embed] }).catch(() => {});
            } else {
                await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral }).catch(() => {});
            }
        }
    },
};
