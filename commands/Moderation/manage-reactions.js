const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    category: 'Moderation',
    data: new SlashCommandBuilder()
        .setName('react')
        .setDescription('React to one or more messages with one or more emojis.')
        .addStringOption(option =>
            option.setName('message_ids')
                .setDescription('Message ID(s), separated by spaces or commas')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('emojis')
                .setDescription('Emoji(s), separated by spaces or commas')
                .setRequired(true))
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('Channel (if messages are not in this channel)')
                .addChannelTypes(ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread, ChannelType.GuildAnnouncement)
                .setRequired(false))
        .addBooleanOption(option =>
            option.setName('remove')
                .setDescription("Remove the bot's reactions instead of adding")
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply privately')
                .setRequired(false)
        ),
    async execute(interaction) {
        const cfg = interaction.client.config.commands.react || {};
        const msgs = cfg.messages || {};

        const isPrivate = interaction.options.getBoolean('private') || false;
        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        const messageIdsRaw = interaction.options.getString('message_ids');
        const emojisRaw = interaction.options.getString('emojis');
        const selectedChannel = interaction.options.getChannel('channel');
        const remove = interaction.options.getBoolean('remove') || false;

        const linkOrIdToId = (token) => {
            // Accept message links of the form https://discord.com/channels/guild/channel/message
            const match = token.match(/\/(\d+)$/);
            return match ? match[1] : token;
        };

        const messageIds = messageIdsRaw.split(/[\s,]+/).filter(Boolean).map(linkOrIdToId);

        // Normalize emojis: support unicode or custom <a:name:id>/<:name:id>
        const normalizeEmoji = (e) => {
            const m = e.match(/^<a?:\w+:(\d+)>$/);
            return m ? m[1] : e; // use id for custom, unicode as-is
        };
        const emojis = emojisRaw.split(/[\s,]+/).filter(Boolean).map(normalizeEmoji);

        // Use specified channel or current channel
        const channel = selectedChannel || interaction.channel;

        if (!channel || !channel.isTextBased()) {
            return interaction.editReply({ content: msgs.channel_not_found || 'Channel not found or not a text channel.' });
        }

        // Permission checks for bot
        const botMember = interaction.guild.members.me;
        const perms = channel.permissionsFor(botMember);
        if (!perms?.has(PermissionFlagsBits.ReadMessageHistory)) {
            return interaction.editReply({ content: 'I need Read Message History in that channel.' });
        }
        if (!perms?.has(PermissionFlagsBits.AddReactions) && !remove) {
            return interaction.editReply({ content: 'I need Add Reactions permission in that channel.' });
        }

        let successCount = 0;
        let failCount = 0;
        let failedMessages = [];

        for (const messageId of messageIds) {
            try {
                const message = await channel.messages.fetch(messageId);
                for (const emoji of emojis) {
                    try {
                        if (remove) {
                            const reaction = message.reactions.cache.get(emoji) || message.reactions.cache.find(r => r.emoji.id === emoji || r.emoji.name === emoji);
                            if (reaction) {
                                await reaction.users.remove(interaction.client.user.id);
                                successCount++;
                            } else {
                                failCount++;
                                failedMessages.push(`Message \`${messageId}\`: Emoji \`${emoji}\``);
                            }
                        } else {
                            await message.react(emoji);
                            successCount++;
                        }
                    } catch {
                        failCount++;
                        failedMessages.push(`Message \`${messageId}\`: Emoji \`${emoji}\``);
                    }
                }
            } catch {
                failCount += emojis.length;
                failedMessages.push(`Message \`${messageId}\`: All emojis`);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(msgs.title || 'Reaction Results')
            .setColor(successCount > 0 ? (interaction.client.config.commands.react?.color_success || 0x00b300) : (interaction.client.config.commands.react?.color_error || 0xff0000))
            .addFields(
                { name: msgs.field_success || 'Reactions Added', value: `${successCount}`, inline: true },
                { name: msgs.field_failed || 'Failed', value: `${failCount}`, inline: true }
            )
            .setTimestamp();

        if (failedMessages.length > 0) {
            embed.addFields({ name: msgs.field_failures || 'Failures', value: failedMessages.join('\n').slice(0, 1024) });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
