const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Shows the top 10 most recently active members.'),

    async execute(interaction) {
        // Presupunem că config-ul este atașat la client
        const config = interaction.client.config.commands.top;

        try {
            await interaction.deferReply();

            // Preluăm toți membrii de pe server pentru a avea acces la datele lor
            const members = await interaction.guild.members.fetch();
            
            // Folosim o Mapă pentru a stoca numărul de mesaje
            const messageCount = new Map();
            
            // Filtrăm doar canalele text unde bot-ul poate citi mesaje
            const textChannels = interaction.guild.channels.cache.filter(ch => 
                ch.type === 0 && // ChannelType.GuildText
                ch.permissionsFor(interaction.client.user).has('ViewChannel') &&
                ch.permissionsFor(interaction.client.user).has('ReadMessageHistory')
            );
            
            // Iterăm prin fiecare canal și preluăm ultimele 100 de mesaje
            for (const [, channel] of textChannels) {
                try {
                    const messages = await channel.messages.fetch({ limit: 100 });
                    messages.forEach(msg => {
                        if (!msg.author.bot) {
                            messageCount.set(msg.author.id, (messageCount.get(msg.author.id) || 0) + 1);
                        }
                    });
                } catch (error) {
                    // Ignorăm erorile de la canalele unde nu avem acces, etc.
                    console.error(`Could not fetch messages from ${channel.name}: ${error.message}`);
                }
            }

            if (messageCount.size === 0) {
                return interaction.editReply({ content: "I couldn't find any recent activity to create a leaderboard." });
            }

            // Sortăm membrii descrescător și luăm primii 10
            const sortedMembers = [...messageCount.entries()]
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const topUser = await interaction.client.users.fetch(sortedMembers[0][0]);

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle('🏆 Top 10 Recently Active Members')
                .setDescription(`Based on the last 100 messages in each channel on **${interaction.guild.name}**.`)
                .setThumbnail(topUser.displayAvatarURL({ dynamic: true, size: 256 })) // <-- AVATARUL ADĂUGAT AICI
                .setTimestamp();

            // Adăugăm fiecare membru în embed
            for (let i = 0; i < sortedMembers.length; i++) {
                const [userId, count] = sortedMembers[i];
                const member = members.get(userId);
                if (member) {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
                    embed.addFields({
                        name: `${medal} ${member.user.displayName}`,
                        value: `\`${count}\` recent messages`,
                        inline: false
                    });
                }
            }

            embed.setFooter({ 
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Top command error:', error);
            await interaction.editReply({ content: config.messages.error || "An error occurred while fetching the leaderboard." });
        }
    },
};