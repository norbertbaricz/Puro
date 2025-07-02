const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Development',
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
        .addStringOption(option =>
            option.setName('channel_id')
                .setDescription('Channel ID (optional, if messages are not in this channel)')
                .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ flags: 64 }); // răspunde rapid, ca să nu expire

        const messageIdsRaw = interaction.options.getString('message_ids');
        const emojisRaw = interaction.options.getString('emojis');
        const channelId = interaction.options.getString('channel_id');

        const messageIds = messageIdsRaw.split(/[\s,]+/).filter(Boolean);
        const emojis = emojisRaw.split(/[\s,]+/).filter(Boolean);

        // Use specified channel or current channel
        const channel = channelId
            ? await interaction.guild.channels.fetch(channelId).catch(() => null)
            : interaction.channel;

        if (!channel || !channel.isTextBased()) {
            return interaction.editReply({ content: 'Channel not found or not a text channel.' });
        }

        let successCount = 0;
        let failCount = 0;
        let failedMessages = [];

        for (const messageId of messageIds) {
            try {
                const message = await channel.messages.fetch(messageId);
                for (const emoji of emojis) {
                    try {
                        await message.react(emoji);
                        successCount++;
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
            .setTitle('Reaction Results')
            .setColor(successCount > 0 ? 0x00b300 : 0xff0000)
            .addFields(
                { name: 'Reactions Added', value: `${successCount}`, inline: true },
                { name: 'Failed', value: `${failCount}`, inline: true }
            )
            .setTimestamp();

        if (failedMessages.length > 0) {
            embed.addFields({ name: 'Failures', value: failedMessages.join('\n').slice(0, 1024) });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};