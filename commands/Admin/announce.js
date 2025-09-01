const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    category: 'Admin',
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Announce a message to a specific channel!')
        .addChannelOption(option =>
            option.setName('channel').setDescription('The channel to send to').setRequired(true))
        .addStringOption(option =>
            option.setName('message').setDescription('The message to send (used as content or embed description)').setRequired(true))
        .addStringOption(option =>
            option.setName('mode').setDescription('Send as plain text or as embed').addChoices(
                { name: 'Plain', value: 'plain' },
                { name: 'Embed', value: 'embed' }
            ).setRequired(false))
        .addStringOption(option => option.setName('title').setDescription('Embed title (embed mode)').setRequired(false))
        .addStringOption(option => option.setName('color').setDescription('Embed color hex, e.g. #5865F2').setRequired(false))
        .addStringOption(option => option.setName('image').setDescription('Embed image URL').setRequired(false))
        .addStringOption(option => option.setName('thumbnail').setDescription('Embed thumbnail URL').setRequired(false))
        .addStringOption(option => option.setName('footer').setDescription('Embed footer text').setRequired(false))
        .addStringOption(option => option.setName('button_label').setDescription('Optional button label').setRequired(false))
        .addStringOption(option => option.setName('button_url').setDescription('Optional button URL').setRequired(false))
        .addBooleanOption(option => option.setName('mention_everyone').setDescription('Allow @everyone/@here mentions').setRequired(false))
        .addBooleanOption(option => option.setName('publish').setDescription('Publish in announcement channel').setRequired(false))
        .addBooleanOption(option => option.setName('private').setDescription('Reply privately').setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const config = interaction.client.config.commands.announce;

        // MODIFICARE AICI: Verificăm dacă comanda este rulată pe un server
        if (!interaction.inGuild()) {
            return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        }

        try {
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageMessages)) {
                const embed = new EmbedBuilder()
                    .setTitle('No Permission')
                    .setDescription(config.messages.no_permission)
                    .setColor(0xff0000);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');
            const publish = interaction.options.getBoolean('publish') ?? false;
            const mode = interaction.options.getString('mode') || 'plain';
            const title = interaction.options.getString('title') || null;
            const color = interaction.options.getString('color') || null;
            const image = interaction.options.getString('image') || null;
            const thumbnail = interaction.options.getString('thumbnail') || null;
            const footer = interaction.options.getString('footer') || null;
            const buttonLabel = interaction.options.getString('button_label') || null;
            const buttonUrl = interaction.options.getString('button_url') || null;
            const allowEveryone = interaction.options.getBoolean('mention_everyone') || false;
            const isPrivate = interaction.options.getBoolean('private') || false;

            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
                const embed = new EmbedBuilder()
                    .setTitle('Invalid Channel')
                    .setDescription(config.messages.invalid_channel)
                    .setColor(0xffa500);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            
            // MODIFICARE AICI: Am corectat modul de a obține bot-ul și permisiunile lui
            const botMember = await interaction.guild.members.fetch(interaction.client.user.id);
            if (!channel.permissionsFor(botMember).has(PermissionFlagsBits.SendMessages)) {
                const embed = new EmbedBuilder()
                    .setTitle('Missing Permission')
                    .setDescription(config.messages.no_bot_permission.replace('{channel}', channel))
                    .setColor(0xff0000);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
            if (allowEveryone && !channel.permissionsFor(botMember).has(PermissionFlagsBits.MentionEveryone)) {
                return interaction.reply({ content: 'I lack the Mention Everyone permission in that channel.', flags: MessageFlags.Ephemeral });
            }

            if (message.length > interaction.client.config.limits.message) {
                const embed = new EmbedBuilder()
                    .setTitle('Message Too Long')
                    .setDescription(config.messages.too_long.replace('{maxLength}', interaction.client.config.limits.message))
                    .setColor(0xffa500);
                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

            // Build preview payload
            let previewEmbed = null;
            let components = [];
            const mentionParse = ['users', 'roles', ...(allowEveryone ? ['everyone'] : [])];
            if (mode === 'embed') {
                previewEmbed = new EmbedBuilder()
                    .setColor(color || config.color || 0x5865F2)
                    .setTitle(title || config.messages?.title || 'Announcement')
                    .setDescription(message)
                    .setTimestamp();
                if (image) previewEmbed.setImage(image);
                if (thumbnail) previewEmbed.setThumbnail(thumbnail);
                if (footer) previewEmbed.setFooter({ text: footer });
            }
            if (buttonLabel && buttonUrl) {
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel(buttonLabel).setStyle(ButtonStyle.Link).setURL(buttonUrl)
                );
                components.push(row);
            }

            const previewMsg = new EmbedBuilder()
                .setTitle('Preview')
                .setDescription(`Channel: ${channel}\nMode: ${mode}${publish ? ' • Will publish' : ''}${allowEveryone ? ' • Mentions: everyone allowed' : ''}`)
                .setColor(0x0099ff);
            const controls = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('announce_send').setLabel('Send').setStyle(ButtonStyle.Success).setEmoji('📣'),
                new ButtonBuilder().setCustomId('announce_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('🛑')
            );

            await interaction.editReply({
                embeds: [previewMsg, ...(mode === 'embed' ? [previewEmbed] : [])],
                content: mode === 'plain' ? message : null,
                components: [controls, ...components]
            });

            const reply = await interaction.fetchReply();
            const collector = reply.createMessageComponentCollector({ time: 30000 });
            let proceed = false;
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'announce_cancel') {
                    collector.stop('cancelled');
                    const cancelled = EmbedBuilder.from(previewMsg).setTitle('Cancelled').setColor(0xff6666);
                    const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ embeds: [cancelled], content: null, components: [disabled] });
                    return;
                }
                if (i.customId === 'announce_send') {
                    proceed = true;
                    collector.stop('send');
                    const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });

                    // Construct final payload
                    const payload = {
                        allowedMentions: { parse: mentionParse }
                    };
                    if (mode === 'embed') {
                        payload.embeds = [previewEmbed];
                        if (components.length) payload.components = components;
                    } else {
                        payload.content = message;
                        if (components.length) payload.components = components;
                    }
                    // Send and optionally crosspost
                    const sent = await channel.send(payload);
                    if (publish && channel.type === ChannelType.GuildAnnouncement) {
                        try { await sent.crosspost(); } catch {}
                    }

                    const done = new EmbedBuilder()
                        .setTitle('Announcement Sent')
                        .setDescription(config.messages.success.replace('{channel}', channel))
                        .setColor(0x00b300);
                    await interaction.editReply({ embeds: [done], content: null, components: [] });
                }
            });

            collector.on('end', async (_c, reason) => {
                if (!proceed && reason === 'time') {
                    const timed = EmbedBuilder.from(previewMsg).setTitle('Timed out').setColor(0xffcc00);
                    const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ embeds: [timed], content: null, components: [disabled] }).catch(() => {});
                }
            });
        } catch (error) {
            console.error('Announce error:', error);
            const embed = new EmbedBuilder()
                .setTitle('Error')
                .setDescription(config.messages.error)
                .setColor(0xff0000);
            const replyMethod = interaction.deferred || interaction.replied ? interaction.editReply : interaction.reply;
            await replyMethod.call(interaction, { embeds: [embed], flags: MessageFlags.Ephemeral });
        }
    },
};
