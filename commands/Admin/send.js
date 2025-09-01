const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send a DM to a user, a role, or everyone in the server')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('Message content (supports {user} placeholder)')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Send only to this user')
                .setRequired(false))
        .addRoleOption(option =>
            option.setName('role')
                .setDescription('Send to all members with this role')
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Send as plain text or as embed')
                .addChoices(
                    { name: 'Plain', value: 'plain' },
                    { name: 'Embed', value: 'embed' }
                )
                .setRequired(false)
        )
        .addStringOption(option => option.setName('title').setDescription('Embed title').setRequired(false))
        .addStringOption(option => option.setName('color').setDescription('Embed color hex, e.g. #5865F2').setRequired(false))
        .addStringOption(option => option.setName('image').setDescription('Embed image URL').setRequired(false))
        .addStringOption(option => option.setName('thumbnail').setDescription('Embed thumbnail URL').setRequired(false))
        .addStringOption(option => option.setName('footer').setDescription('Embed footer text').setRequired(false))
        .addStringOption(option => option.setName('button_label').setDescription('Optional button label').setRequired(false))
        .addStringOption(option => option.setName('button_url').setDescription('Optional button URL').setRequired(false))
        .addBooleanOption(option => option.setName('private').setDescription('Preview and results privately').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const configPath = interaction.client.config.commands.send;
        const configMessages = configPath && configPath.messages ? configPath.messages : {};

        const messages = {
            no_permission: configMessages.no_permission || "You do not have permission to use this command.",
            success: configMessages.success || "Successfully sent a DM to {user}.",
            success_all: configMessages.success_all || "Successfully sent a DM to {count} users.",
            error: configMessages.error || "Could not process the send command for {user}.",
            error_generic: configMessages.error_generic || "An unexpected error occurred.",
            cannot_dm_user: configMessages.cannot_dm_user || "Could not send a DM to {user}. They may have DMs disabled, server privacy settings, or the bot is blocked.",
            dm_fail: configMessages.dm_fail || "Failed to send the DM to {user} due to an unknown issue.",
            user_not_found: configMessages.user_not_found || "The specified user could not be found.",
        };

        try {
            if (!interaction.inGuild()) {
                return interaction.reply({ content: "This command can only be used within a server.", flags: MessageFlags.Ephemeral });
            }

            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: messages.no_permission, flags: MessageFlags.Ephemeral });
            }

            const targetUser = interaction.options.getUser('user');
            const targetRole = interaction.options.getRole('role');
            const messageContent = interaction.options.getString('message');
            const mode = interaction.options.getString('mode') || 'plain';
            const title = interaction.options.getString('title') || null;
            const color = interaction.options.getString('color') || null;
            const image = interaction.options.getString('image') || null;
            const thumbnail = interaction.options.getString('thumbnail') || null;
            const footer = interaction.options.getString('footer') || null;
            const buttonLabel = interaction.options.getString('button_label') || null;
            const buttonUrl = interaction.options.getString('button_url') || null;
            const isPrivate = interaction.options.getBoolean('private') || false;

            // Build DM payload factory
            const buildPayload = (user) => {
                const text = (messageContent || '').replace(/{user}/g, `${user}`);
                let payload = {};
                const components = [];
                if (buttonLabel && buttonUrl) {
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setLabel(buttonLabel).setStyle(ButtonStyle.Link).setURL(buttonUrl)
                    );
                    components.push(row);
                }
                if (mode === 'embed') {
                    const embed = new EmbedBuilder()
                        .setColor(color || 0x5865F2)
                        .setTitle(title || 'Message')
                        .setDescription(text)
                        .setTimestamp();
                    if (image) embed.setImage(image);
                    if (thumbnail) embed.setThumbnail(thumbnail);
                    if (footer) embed.setFooter({ text: footer });
                    payload = { embeds: [embed] };
                } else {
                    payload = { content: text };
                }
                if (components.length) payload.components = components;
                return payload;
            };

            // Collect targets
            let targets = [];
            if (targetUser) {
                targets = [targetUser];
            } else if (targetRole) {
                const members = await interaction.guild.members.fetch();
                targets = members.filter(m => !m.user.bot && m.roles.cache.has(targetRole.id)).map(m => m.user);
            } else {
                const members = await interaction.guild.members.fetch();
                targets = members.filter(m => !m.user.bot).map(m => m.user);
            }

            if (targets.length === 0) {
                return interaction.reply({ content: 'No eligible recipients were found.', flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

            // Preview + confirm for multi-recipient
            if (!targetUser) {
                const preview = new EmbedBuilder()
                    .setTitle('DM Broadcast Preview')
                    .setColor('#0099ff')
                    .setDescription(`Targets: ${targets.length}\nMode: ${mode}${targetRole ? `\nRole: ${targetRole}` : ''}`)
                    .setTimestamp();
                const controls = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('send_confirm').setLabel('Send').setStyle(ButtonStyle.Success).setEmoji('📤'),
                    new ButtonBuilder().setCustomId('send_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('🛑')
                );
                await interaction.editReply({ embeds: [preview], components: [controls] });

                const reply = await interaction.fetchReply();
                const collector = reply.createMessageComponentCollector({ time: 30000 });
                let proceed = false;
                await new Promise((resolve) => {
                    collector.on('collect', async i => {
                        if (i.user.id !== interaction.user.id) {
                            await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                            return;
                        }
                        if (i.customId === 'send_cancel') {
                            collector.stop('cancelled');
                            const cancelled = new EmbedBuilder().setTitle('Cancelled').setColor('#ff6666').setDescription('No DMs were sent.');
                            const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                            await i.update({ embeds: [cancelled], components: [disabled] });
                            resolve();
                            return;
                        }
                        if (i.customId === 'send_confirm') {
                            proceed = true;
                            collector.stop('confirmed');
                            const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                            await i.update({ components: [disabled] });
                            resolve();
                        }
                    });
                    collector.on('end', async (_c, reason) => {
                        if (!proceed && reason === 'time') {
                            const timed = new EmbedBuilder().setTitle('Timed out').setColor('#ffcc00').setDescription('No action taken.');
                            const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                            await interaction.editReply({ embeds: [timed], components: [disabled] }).catch(() => {});
                        }
                        resolve();
                    });
                });
                if (!proceed) return; // stop here
            }

            // Send DMs
            let sentCount = 0;
            let failedCount = 0;
            let processed = 0;
            const total = targets.length;
            const updateProgress = async () => {
                const prog = new EmbedBuilder()
                    .setTitle(targetUser ? 'Sending DM...' : 'Broadcast in progress...')
                    .setColor('#00b300')
                    .setDescription(`${processed}/${total} processed`)
                    .addFields(
                        { name: 'Success', value: `${sentCount}`, inline: true },
                        { name: 'Failed', value: `${failedCount}`, inline: true }
                    )
                    .setTimestamp();
                await interaction.editReply({ embeds: [prog], components: [] }).catch(() => {});
            };

            for (const user of targets) {
                try {
                    await user.send(buildPayload(user));
                    sentCount++;
                } catch (dmError) {
                    failedCount++;
                }
                processed++;
                if (processed % 25 === 0) await updateProgress();
            }
            await updateProgress();

            const done = new EmbedBuilder()
                .setTitle(targetUser ? 'DM Sent' : 'DM Broadcast')
                .setDescription(targetUser ? messages.success.replace('{user}', targets[0].tag) : messages.success_all.replace('{count}', sentCount))
                .setColor(0x00b300)
                .addFields(
                    { name: 'Success', value: `${sentCount}`, inline: true },
                    { name: 'Failed', value: `${failedCount}`, inline: true }
                );
            await interaction.editReply({ embeds: [done] });
        } catch (error) {
            console.error('Error in send command execution:', error);
            const embed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription(messages.error_generic)
                .setColor(0xff0000);
            const payload = { embeds: [embed], flags: MessageFlags.Ephemeral };
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(payload);
            } else {
                await interaction.reply(payload);
            }
        }
    },
};
