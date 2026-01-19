const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

module.exports = {
  category: 'Fun',
  data: new SlashCommandBuilder()
    .setName('adopt')
    .setDescription('Send a wholesome adoption request to another member!')
    .addUserOption(option =>
      option.setName('member')
        .setDescription('The member you want to adopt')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('note')
        .setDescription('Add a short, sweet note (optional)')
        .setMaxLength(200)
        .setRequired(false)
    ),

  async execute(interaction) {
    const adopter = interaction.user;
    const target = interaction.options.getUser('member');
    const note = (interaction.options.getString('note') || '').trim();

    const cfg = interaction.client.config || {};
    const colors = (cfg.colors) || {};
    const adoptCfg = (cfg.commands && cfg.commands.adopt) || {};

    const colorBase = adoptCfg.color || colors.primary || '#9b59b6';
    const colorSuccess = colors.success || '#2ecc71';
    const colorError = colors.error || '#e74c3c';
    const colorWarn = '#f1c40f';

    const messages = adoptCfg.messages || {
      title: 'Adoption Request',
      prompt: '{adopter} wants to adopt {target}! 💖',
      self_adopt: 'You cannot adopt yourself. Nice try! 😅',
      bot_adopt: 'You cannot adopt a bot. 🤖',
      accept_label: 'Accept',
      decline_label: 'Decline',
      accepted: '📜 Adoption papers signed! {target} has been adopted by {adopter}! 🎉',
      declined: '❌ {target} politely declined the adoption from {adopter}.',
      timeout: '⏳ No response in time. Adoption request expired.',
      not_you: 'Only the requested member can respond to this.',
    };

    if (adopter.id === target.id) {
      return interaction.reply({ content: messages.self_adopt, flags: MessageFlags.Ephemeral });
    }
    if (target.bot) {
      return interaction.reply({ content: messages.bot_adopt, flags: MessageFlags.Ephemeral });
    }

    await interaction.deferReply();

    const description = (messages.prompt || '')
      .replace('{adopter}', adopter)
      .replace('{target}', target);

    const embed = new EmbedBuilder()
      .setColor(colorBase)
      .setTitle(messages.title)
      .setDescription(description + (note ? `\n\nNote: ${note}` : ''))
      .setThumbnail(target.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `Requested by ${adopter.tag}`, iconURL: adopter.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('adopt_accept').setLabel(messages.accept_label || 'Accept').setStyle(ButtonStyle.Success).setEmoji('📝'),
      new ButtonBuilder().setCustomId('adopt_decline').setLabel(messages.decline_label || 'Decline').setStyle(ButtonStyle.Danger).setEmoji('❌'),
    );

    const msg = await interaction.editReply({ embeds: [embed], components: [row] });
    const collector = msg.createMessageComponentCollector({ time: 30_000 });

    collector.on('collect', async i => {
      if (i.user.id !== target.id) {
        await i.reply({ content: messages.not_you, flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.customId === 'adopt_accept') {
        collector.stop('accepted');
        // Cute certificate number
        const cert = `#${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
        const accepted = new EmbedBuilder()
          .setColor(colorSuccess)
          .setTitle('Adoption Complete')
          .setDescription((messages.accepted || '').replace('{adopter}', adopter).replace('{target}', target))
          .addFields({ name: 'Certificate', value: cert, inline: true })
          .setThumbnail(null)
          .setFooter({ text: `Approved by ${interaction.client.user.username}`, iconURL: interaction.client.user.displayAvatarURL() })
          .setTimestamp();
        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
        await i.update({ embeds: [accepted], components: [disabled] });
        return;
      }

      if (i.customId === 'adopt_decline') {
        collector.stop('declined');
        const declined = new EmbedBuilder()
          .setColor(colorError)
          .setTitle('Adoption Declined')
          .setDescription((messages.declined || '').replace('{adopter}', adopter).replace('{target}', target))
          .setThumbnail(null)
          .setTimestamp();
        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
        await i.update({ embeds: [declined], components: [disabled] });
        return;
      }
    });

    collector.on('end', async (_c, reason) => {
      if (reason === 'time') {
        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
        const timeout = new EmbedBuilder()
          .setColor(colorWarn)
          .setTitle('No Response')
          .setDescription(messages.timeout)
          .setTimestamp();
        await interaction.editReply({ embeds: [timeout], components: [disabled] }).catch(() => {});
      }
    });
  }
};
