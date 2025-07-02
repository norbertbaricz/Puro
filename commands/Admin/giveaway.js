const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = {
  category: 'Admin',
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Starts a giveaway and picks a winner from the most active members!')
    .addStringOption(option =>
      option
        .setName('prize')
        .setDescription('What awesome prize are you giving away?')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('duration_days')
        .setDescription('For how many days should activity be considered? (Default: 7)')
        .setMinValue(1)
        .setMaxValue(30)
    ),
  async execute(interaction) {
    const config = interaction.client.config;
    const giveawayConfig = config.commands.giveaway;
    const giveawayMsg = giveawayConfig.messages;
    const giveawayColor = giveawayConfig.color;

    // Check if the user has permission to manage the server
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({
            content: 'You do not have permission to use this command.',
            ephemeral: true
        });
    }

    await interaction.deferReply();

    const prize = interaction.options.getString('prize');
    const durationDays = interaction.options.getInteger('duration_days') || 7;
    const topMemberCount = 5;

    const messageCounts = new Map();
    // Calculate the start timestamp (now - `durationDays`)
    const sinceTimestamp = Date.now() - (durationDays * 24 * 60 * 60 * 1000);

    const channels = interaction.guild.channels.cache.filter(ch =>
        ch.isTextBased() &&
        ch.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.ReadMessageHistory)
    );

    // A waiting embed to inform the user
    const waitingEmbed = new EmbedBuilder()
        .setTitle(giveawayMsg.calculating_title || '🔍 Calculating Activity...')
        .setDescription(
          (giveawayMsg.calculating_desc || 'Please wait while I analyze server activity from the last **{days} days**. This might take a moment.')
            .replace('{days}', durationDays)
        )
        .setColor('#FFA500') // Orange
        .setTimestamp();
    await interaction.editReply({ embeds: [waitingEmbed] });

    try {
        for (const channel of channels.values()) {
            let lastId;
            // Fetch messages in pages of 100
            while (true) {
                const messages = await channel.messages.fetch({ limit: 100, before: lastId });

                if (messages.size === 0) break; // No more messages

                for (const msg of messages.values()) {
                    // Stop if the message is older than the specified duration
                    if (msg.createdTimestamp < sinceTimestamp) {
                        break; // Exit the for...of loop
                    }
                    if (!msg.author.bot) {
                        messageCounts.set(msg.author.id, (messageCounts.get(msg.author.id) || 0) + 1);
                    }
                }

                // If the last message in the fetched batch is too old, no need to fetch more from this channel
                if (messages.last().createdTimestamp < sinceTimestamp) {
                    break; // Exit the while(true) loop
                }
                
                lastId = messages.last().id;
            }
        }
    } catch (error) {
        console.error('Error fetching messages for giveaway:', error);
        return interaction.editReply({ content: giveawayMsg.error || 'An error occurred while fetching activity data. Please ensure I have the correct permissions to read message history in relevant channels.' });
    }

    const sortedMembers = [...messageCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topMemberCount)
      .map(([userId, count]) => ({ userId, count }));

    if (sortedMembers.length === 0) {
      return interaction.editReply({
        content: (giveawayMsg.no_active || 'Oops! No active members found in the last {days} days. 😔').replace('{days}', durationDays),
      });
    }

    // Pick a random winner from the top active members
    const winnerEntry = sortedMembers[Math.floor(Math.random() * sortedMembers.length)];
    const winner = await interaction.client.users.fetch(winnerEntry.userId);

    // Top members list
    const topMembersList = await Promise.all(
      sortedMembers.map(async ({ userId, count }, index) => {
        try {
            const user = await interaction.client.users.fetch(userId);
            return `**${index + 1}. ${user.tag}** - ${count} messages`;
        } catch {
            return `**${index + 1}.** Unknown User - ${count} messages`;
        }
      })
    );

    // Create the final embed
    const embed = new EmbedBuilder()
      .setTitle(giveawayMsg.winner_title || '🎉 Giveaway Winner! 🎉')
      .setColor(giveawayColor) // Folosește culoarea din config
      .setDescription(
        (giveawayMsg.winner_desc || "Congratulations, {winner}! You've won the **{prize}**! 🎁\n\nHere are the top active members who were in the running:")
          .replace('{winner}', winner)
          .replace('{prize}', prize)
      )
      .setThumbnail(winner.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: giveawayMsg.prize_field || '🏆 Prize', value: `**${prize}**`, inline: true },
        { name: giveawayMsg.winner_field || '🎊 Winner', value: `${winner}`, inline: true }
      )
      .setImage(giveawayMsg.image || 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbWthODZwa2Y0MXEyajAxOXFubDJ4b3lnaWdsbDhza3B1cTJxcm9naSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/BPJmthQ3YRwD6QqcVD/giphy.gif')
      .setTimestamp()
      .setFooter({ 
        text: (giveawayMsg.footer || 'Activity based on the last {days} days.').replace('{days}', durationDays), 
        iconURL: interaction.guild.iconURL() 
      });

    embed.addFields({
      name: (giveawayMsg.top_field || `🌟 Top {count} Active Members`).replace('{count}', sortedMembers.length),
      value: topMembersList.join('\n') || (giveawayMsg.top_field_empty || 'No active members found.'),
    });

    await interaction.editReply({ embeds: [embed] });
  },
};