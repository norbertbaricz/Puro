const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Shows top 10 most active members'),

    async execute(interaction) {
        try {
            await interaction.deferReply();

            // Get all members in the guild
            const members = await interaction.guild.members.fetch();
            
            // Create a map to store message counts
            const messageCount = new Map();

            // Get all text channels in the guild
            const channels = interaction.guild.channels.cache.filter(channel => 
                channel.type === 0 // 0 is TextChannel
            );

            // Fetch messages from each channel (last 100 messages per channel)
            for (const [, channel] of channels) {
                try {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    
                    messages.forEach(msg => {
                        if (!msg.author.bot) {
                            const userId = msg.author.id;
                            messageCount.set(userId, (messageCount.get(userId) || 0) + 1);
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching messages from ${channel.name}:`, error);
                }
            }

            // Sort members by message count
            const sortedMembers = [...messageCount.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            // Create the leaderboard embed
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🏆 Top 10 Most Active Members')
                .setDescription('Based on recent message activity')
                .setTimestamp();

            // Add fields for each member in top 10
            let position = 1;
            for (const [userId, count] of sortedMembers) {
                const member = members.get(userId);
                if (member) {
                    let medal = '';
                    switch(position) {
                        case 1: medal = '🥇'; break;
                        case 2: medal = '🥈'; break;
                        case 3: medal = '🥉'; break;
                        default: medal = `${position}.`; break;
                    }
                    
                    embed.addFields({
                        name: `${medal} ${member.nickname || member.user.username}`,
                        value: `Messages: ${count}`,
                        inline: false
                    });
                }
                position++;
            }

            // Add footer
            embed.setFooter({ 
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

            // Send the embed
            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Error in top command:', error);
            await interaction.editReply('An error occurred while fetching the leaderboard.');
        }
    },
};
