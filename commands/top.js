const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Top 10 active members'),

    async execute(interaction) {
        const config = interaction.client.config.commands.top;
        try {
            await interaction.deferReply();

            const members = await interaction.guild.members.fetch();
            const messageCount = new Map();
            const channels = interaction.guild.channels.cache.filter(channel => channel.type === 0);

            for (const [, channel] of channels) {
                try {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    messages.forEach(msg => {
                        if (!msg.author.bot) {
                            messageCount.set(msg.author.id, (messageCount.get(msg.author.id) || 0) + 1);
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching messages from ${channel.name}:`, error);
                }
            }

            const sortedMembers = [...messageCount.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle('🏆 Top 10 Active Members')
                .setDescription('Based on recent messages')
                .setTimestamp();

            let position = 1;
            for (const [userId, count] of sortedMembers) {
                const member = members.get(userId);
                if (member) {
                    const medal = position === 1 ? '🥇' : position === 2 ? '🥈' : position === 3 ? '🥉' : `${position}.`;
                    embed.addFields({
                        name: `${medal} ${member.nickname || member.user.username}`,
                        value: `Messages: ${count}`,
                        inline: false
                    });
                }
                position++;
            }

            embed.setFooter({ 
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Top error:', error);
            await interaction.editReply({ content: config.messages.error });
        }
    },
};