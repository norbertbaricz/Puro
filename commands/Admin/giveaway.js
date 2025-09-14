const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, MessageFlags } = require('discord.js');

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
    )
    .addIntegerOption(option =>
      option
        .setName('top')
        .setDescription('How many top members to consider (3-25, default 5)')
        .setMinValue(3)
        .setMaxValue(25)
        .setRequired(false)
    )
    .addIntegerOption(option =>
      option
        .setName('min_messages')
        .setDescription('Minimum messages to qualify (default 1)')
        .setMinValue(1)
        .setMaxValue(10000)
        .setRequired(false)
    )
    .addChannelOption(option =>
      option
        .setName('announce_channel')
        .setDescription('Channel to post the final result')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
        .setRequired(false)
    )
    .addBooleanOption(option =>
      option
        .setName('private')
        .setDescription('Reply privately with preview and buttons')
        .setRequired(false)
    ),
  async execute(interaction) {
    const config = interaction.client.config;
    const giveawayConfig = config.commands.giveaway;
    const giveawayMsg = giveawayConfig.messages;
    const giveawayColor = giveawayConfig.color;

    // Guild-only and permission checks
    if (!interaction.inGuild()) {
        return interaction.reply({
            content: '❌ This command can only be used in a server channel.',
            flags: MessageFlags.Ephemeral,
        });
    }

    // Check if the user has permission to manage the server
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
        return interaction.reply({
            content: 'You do not have permission to use this command.',
            flags: MessageFlags.Ephemeral,
        });
    }

    const isPrivate = interaction.options.getBoolean('private') || false;
    await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

    const prize = interaction.options.getString('prize');
    const durationDays = interaction.options.getInteger('duration_days') || 7;
    const topMemberCount = interaction.options.getInteger('top') || 5;
    const minMessages = interaction.options.getInteger('min_messages') || 1;
    const announceChannel = interaction.options.getChannel('announce_channel') || null;

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
        let processed = 0;
        const total = channels.size;
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
            processed++;
            if (processed % 3 === 0) {
              const progress = EmbedBuilder.from(waitingEmbed)
                .setDescription(
                  (giveawayMsg.calculating_desc || 'Please wait while I analyze server activity from the last **{days} days**. This might take a moment.')
                    .replace('{days}', durationDays)
                )
                .addFields({ name: 'Progress', value: `${processed}/${total} channels`, inline: false });
              await interaction.editReply({ embeds: [progress] }).catch(() => {});
            }
        }
    } catch (error) {
        console.error('Error fetching messages for giveaway:', error);
        return interaction.editReply({ content: giveawayMsg.error || 'An error occurred while fetching activity data. Please ensure I have the correct permissions to read message history in relevant channels.' });
    }

    let sortedMembers = [...messageCounts.entries()]
      .filter(([, count]) => count >= minMessages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topMemberCount)
      .map(([userId, count]) => ({ userId, count }));

    if (sortedMembers.length === 0) {
      return interaction.editReply({
        content: (giveawayMsg.no_active || 'Oops! No active members found in the last {days} days. 😔').replace('{days}', durationDays),
      });
    }

    const buildEmbed = async (winnerUser) => {
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

      const embed = new EmbedBuilder()
        .setTitle(giveawayMsg.winner_title || '🎉 Giveaway Winner! 🎉')
        .setColor(giveawayColor)
        .setDescription(
          (giveawayMsg.winner_desc || "Congratulations, {winner}! You've won the **{prize}**! 🎁\n\nHere are the top active members who were in the running:")
            .replace('{winner}', winnerUser)
            .replace('{prize}', prize)
        )
        .setThumbnail(winnerUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: giveawayMsg.prize_field || '🏆 Prize', value: `**${prize}**`, inline: true },
          { name: giveawayMsg.winner_field || '🎊 Winner', value: `${winnerUser}`, inline: true },
          { name: (giveawayMsg.top_field || `🌟 Top {count} Active Members`).replace('{count}', sortedMembers.length), value: topMembersList.join('\n') || (giveawayMsg.top_field_empty || 'No active members found.') }
        )
        .setImage(giveawayMsg.image || 'https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExbWthODZwa2Y0MXEyajAxOXFubDJ4b3lnaWdsbDhza3B1cTJxcm9naSZlcD12MV9naWZzX3NlYXJjaCZjdD1n/BPJmthQ3YRwD6QqcVD/giphy.gif')
        .setTimestamp()
        .setFooter({
          text: (giveawayMsg.footer || 'Activity based on the last {days} days.').replace('{days}', durationDays),
          iconURL: interaction.guild.iconURL()
        });
      return embed;
    };

    let currentWinner = sortedMembers[Math.floor(Math.random() * sortedMembers.length)];
    let winnerUser = await interaction.client.users.fetch(currentWinner.userId);
    let embed = await buildEmbed(winnerUser);

    const controls = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('ga_reroll').setLabel('Reroll').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(sortedMembers.length <= 1),
      ...(announceChannel ? [new ButtonBuilder().setCustomId('ga_post').setLabel(`Post to #${announceChannel.name}`).setStyle(ButtonStyle.Success).setEmoji('📣')] : []),
      new ButtonBuilder().setCustomId('ga_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
    );

    await interaction.editReply({ embeds: [embed], components: [controls] });

    const reply = await interaction.fetchReply();
    const collector = reply.createMessageComponentCollector({ time: 60000 });
    collector.on('collect', async i => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
        return;
      }
      if (i.customId === 'ga_close') {
        collector.stop('closed');
        const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
        await i.update({ components: [disabled] });
        return;
      }
      if (i.customId === 'ga_reroll') {
        // pick a different winner if possible
        let next = currentWinner;
        if (sortedMembers.length > 1) {
          while (next.userId === currentWinner.userId) {
            next = sortedMembers[Math.floor(Math.random() * sortedMembers.length)];
          }
        }
        currentWinner = next;
        winnerUser = await interaction.client.users.fetch(currentWinner.userId);
        embed = await buildEmbed(winnerUser);
        await i.update({ embeds: [embed] });
        return;
      }
      if (i.customId === 'ga_post' && announceChannel) {
        try {
          const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
          await announceChannel.send({ embeds: [embed] });
          await i.update({ components: [disabled] });
        } catch (e) {
          await i.reply({ content: 'Failed to post to the selected channel. Check my permissions.', flags: MessageFlags.Ephemeral });
        }
        return;
      }
    });

    collector.on('end', async (_c, reason) => {
      if (reason === 'time') {
        const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
        await interaction.editReply({ components: [disabled] }).catch(() => {});
      }
    });
  },
};
