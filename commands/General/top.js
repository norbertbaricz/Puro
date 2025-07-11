const { SlashCommandBuilder, EmbedBuilder, ChannelType, PermissionsBitField } = require('discord.js');

module.exports = {
    category: 'General',
    data: new SlashCommandBuilder()
        .setName('top')
        .setDescription('Shows a leaderboard of the most or least active members.')
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Show active or inactive members?')
                .setRequired(true)
                .addChoices(
                    { name: 'Active', value: 'active' },
                    { name: 'Inactive', value: 'inactive' }
                )
        )
        .addIntegerOption(option =>
            option
                .setName('count')
                .setDescription('How many members to show on the leaderboard? (Default: 5)')
                .setMinValue(3)
                .setMaxValue(10)
        )
        .addIntegerOption(option =>
            option
                .setName('duration')
                .setDescription('For how many days should activity be measured? (Default: 7)')
                .setMinValue(1)
                .setMaxValue(7)
        ),

    async execute(interaction) {
        const config = interaction.client.config;
        const topConfig = config.commands.top || {};
        const topMsg = topConfig.messages || {};
        const topColor = topConfig.color || '#0099ff'; // Valoare implicită dacă nu este definită

        try {
            await interaction.deferReply();

            const type = interaction.options.getString('type');
            const count = interaction.options.getInteger('count') || 5;
            const durationDays = interaction.options.getInteger('duration') || 7;
            const messageCount = new Map();
            const sinceTimestamp = Date.now() - (durationDays * 24 * 60 * 60 * 1000);

            const textChannels = interaction.guild.channels.cache.filter(ch => 
                ch.type === ChannelType.GuildText &&
                ch.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.ReadMessageHistory)
            );

            // Embed de procesare cu valori implicite
            const processingEmbed = new EmbedBuilder()
                .setTitle(topMsg.calculating_title || '🔍 Calculating Activity...')
                .setDescription((topMsg.calculating_desc || 'Please wait. I am analyzing activity from the last **{days} days**. This might take a moment.').replace('{days}', durationDays))
                .setColor('#FFA500')
                .setTimestamp();
            await interaction.editReply({ embeds: [processingEmbed] });

            // Colectăm toate ID-urile membrilor pentru a include și cei inactivi
            const allMembers = await interaction.guild.members.fetch();
            for (const member of allMembers.values()) {
                if (!member.user.bot) {
                    messageCount.set(member.id, 0); // Inițializăm cu 0 pentru toți membrii
                }
            }

            // Colectăm mesajele din canale
            for (const channel of textChannels.values()) {
                try {
                    let lastId;
                    while (true) {
                        const messages = await channel.messages.fetch({ limit: 100, before: lastId });
                        if (messages.size === 0) break;
                        for (const msg of messages.values()) {
                            if (msg.createdTimestamp < sinceTimestamp) break;
                            if (!msg.author.bot) {
                                messageCount.set(msg.author.id, (messageCount.get(msg.author.id) || 0) + 1);
                            }
                        }
                        if (messages.last().createdTimestamp < sinceTimestamp) break;
                        lastId = messages.last().id;
                    }
                } catch (error) {
                    console.warn(`Could not fetch messages from ${channel.name}: ${error.message}`);
                }
            }

            if (messageCount.size === 0 && type === 'active') {
                return interaction.editReply({ 
                    content: (topMsg.no_activity || 'I couldn\'t find any recent activity in the last {days} days to create a leaderboard.').replace('{days}', durationDays) 
                });
            }

            // Sortăm membrii
            const sortedMembers = [...messageCount.entries()]
                .sort((a, b) => type === 'active' ? b[1] - a[1] : a[1] - b[1]) // active: descendent, inactive: ascendent
                .slice(0, count);

            // Verificăm dacă există membri pentru top
            if (sortedMembers.length === 0) {
                return interaction.editReply({ 
                    content: (topMsg.no_activity || 'I couldn\'t find any members to create a leaderboard for the last {days} days.').replace('{days}', durationDays) 
                });
            }

            const topUser = await interaction.client.users.fetch(sortedMembers[0][0]);

            // Creăm embed-ul final cu valori implicite
            const embed = new EmbedBuilder()
                .setColor(topColor)
                .setTitle(
                    (topMsg.title || '🏆 Top {count} Active Members')
                        .replace('{count}', sortedMembers.length)
                        .replace('Active', type === 'active' ? 'Active' : 'Inactive')
                )
                .setDescription(
                    (topMsg.description || 'Based on messages sent in the last **{days} days** on **{servername}**')
                        .replace('{days}', durationDays)
                        .replace('{servername}', interaction.guild.name)
                        .replace('messages sent', type === 'active' ? 'messages sent' : 'message activity')
                )
                .setThumbnail(topUser.displayAvatarURL({ dynamic: true, size: 256 }))
                .setTimestamp();

            let leaderboardString = '';
            for (let i = 0; i < sortedMembers.length; i++) {
                const [userId, msgCount] = sortedMembers[i];
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `**${i + 1}.**`;
                const displayName = member ? member.user.displayName : (await interaction.client.users.fetch(userId)).tag;
                leaderboardString += `${medal} **${displayName}** - \`${msgCount}\` messages\n`;
            }

            embed.addFields({
                name: topMsg.leaderboard_field || 'Leaderboard',
                value: leaderboardString || (topMsg.leaderboard_empty || 'No activity found.')
            });

            embed.setFooter({ 
                text: (topMsg.footer || 'Requested by {user}').replace('{user}', interaction.user.tag),
                iconURL: interaction.user.displayAvatarURL({ dynamic: true })
            });

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Top command execution error:', error);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: topMsg.error || '❌ An unexpected error occurred while running the command.', ephemeral: true });
            } else {
                await interaction.editReply({ content: topMsg.error || '❌ An unexpected error occurred while fetching the leaderboard.' });
            }
        }
    },
};