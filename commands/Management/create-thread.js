const {
  SlashCommandBuilder,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  MessageFlags,
} = require('discord.js');

module.exports = {
  category: 'Management',
  data: new SlashCommandBuilder()
    .setName('thread')
    .setDescription('Create a thread with a title and optional invites.')
    .addStringOption(o =>
      o.setName('title')
        .setDescription('Thread title')
        .setMaxLength(100)
        .setRequired(true)
    )
    .addChannelOption(o =>
      o.setName('channel')
        .setDescription('Channel to create the thread in (defaults to current)')
        .addChannelTypes(
          ChannelType.GuildText,
          ChannelType.GuildAnnouncement,
          ChannelType.GuildForum,
        )
        .setRequired(false)
    )
    .addBooleanOption(o =>
      o.setName('private_thread')
        .setDescription('Create a private thread (where supported)')
        .setRequired(false)
    )
    .addIntegerOption(o =>
      o.setName('auto_archive')
        .setDescription('Auto-archive in minutes (60, 1440, 4320, 10080)')
        .addChoices(
          { name: '1 hour', value: 60 },
          { name: '1 day', value: 1440 },
          { name: '3 days', value: 4320 },
          { name: '7 days', value: 10080 },
        )
        .setRequired(false)
    )
    .addUserOption(o => o.setName('invite1').setDescription('Invite user').setRequired(false))
    .addUserOption(o => o.setName('invite2').setDescription('Invite user').setRequired(false))
    .addUserOption(o => o.setName('invite3').setDescription('Invite user').setRequired(false))
    .addUserOption(o => o.setName('invite4').setDescription('Invite user').setRequired(false))
    .addUserOption(o => o.setName('invite5').setDescription('Invite user').setRequired(false))
    .addBooleanOption(o =>
      o.setName('private')
        .setDescription('Reply privately (only you can see)')
        .setRequired(false)
    ),

  async execute(interaction) {
    const cfg = interaction.client.config?.commands?.thread || {};
    const color = cfg.color || '#5865F2';
    const msg = cfg.messages || {};

    const isPrivate = interaction.options.getBoolean('private') || false;
    const title = interaction.options.getString('title').trim();
    const targetChannel = interaction.options.getChannel('channel') || interaction.channel;
    const privateThread = interaction.options.getBoolean('private_thread') || false;
    const autoArchive = interaction.options.getInteger('auto_archive') || 1440;

    // Collect invitees
    const invitees = ['invite1','invite2','invite3','invite4','invite5']
      .map(k => interaction.options.getUser(k))
      .filter(Boolean);

    // Validate channel type
    if (!targetChannel || !targetChannel.isTextBased()) {
      return interaction.reply({
        content: msg.invalid_channel || '❌ Please select a text or forum channel.',
        flags: MessageFlags.Ephemeral,
      });
    }

    // Permission checks for the bot
    const bot = interaction.guild?.members?.me;
    const perms = bot && targetChannel.permissionsFor(bot);
    const canManageThreads = perms?.has(PermissionsBitField.Flags.ManageThreads);
    const canCreatePublic = perms?.has(PermissionsBitField.Flags.CreatePublicThreads);
    const canCreatePrivate = perms?.has(PermissionsBitField.Flags.CreatePrivateThreads);
    const canSend = perms?.has(PermissionsBitField.Flags.SendMessages);

    if (!perms || (!canManageThreads && !canCreatePublic && !canCreatePrivate)) {
      return interaction.reply({
        content: msg.no_permission || "❌ I don't have permission to create threads in that channel.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

    try {
      let thread = null;

      if (targetChannel.type === ChannelType.GuildForum) {
        // Forum: create a post (thread) with an initial message
        thread = await targetChannel.threads.create({
          name: title,
          autoArchiveDuration: autoArchive,
          message: { content: cfg.messages?.forum_post_message || `Thread created by ${interaction.user}` },
        });
      } else {
        // Text/Announcement channels
        if (privateThread && canCreatePrivate) {
          // Try direct private thread creation (no starter message)
          thread = await targetChannel.threads.create({
            name: title,
            autoArchiveDuration: autoArchive,
            type: ChannelType.PrivateThread,
            invitable: true,
            reason: `Requested by ${interaction.user.tag}`,
          });
        } else {
          if (!canSend) {
            return interaction.editReply({ content: msg.no_permission || "❌ I don't have permission to create threads in that channel." });
          }
          // Seed a starter message then start a (public) thread from it for broader compatibility
          const seed = await targetChannel.send({ content: cfg.messages?.seed_message || `Thread created by ${interaction.user}` });
          thread = await seed.startThread({
            name: title,
            autoArchiveDuration: autoArchive,
            reason: `Requested by ${interaction.user.tag}`,
          });
        }
      }

      // Invite members where possible
      let invited = 0;
      for (const u of invitees) {
        try {
          await thread.members.add(u.id);
          invited++;
        } catch {}
      }

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle(cfg.messages?.created_title || '🧵 Thread Created')
        .setDescription((msg.created || 'Thread created: {thread}').replace('{thread}', `${thread}`))
        .addFields({ name: 'Channel', value: `${targetChannel}`, inline: true })
        .setTimestamp();
      if (invited > 0) {
        embed.addFields({ name: 'Invites', value: (msg.invited_some || 'Invited {count} members.').replace('{count}', String(invited)), inline: true });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (error) {
      console.error('Thread creation error:', error);
      await interaction.editReply({ content: msg.error_create || '❌ Could not create the thread.' });
    }
  },
};

