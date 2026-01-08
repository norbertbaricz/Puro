const { Events } = require('discord.js');
const { sendLog, formatUser, formatChannel, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.MessageUpdate,
  async execute(oldMessage, newMessage) {
    if (!newMessage?.guild || newMessage.author?.id === newMessage.client.user?.id) return;
    if (oldMessage?.partial) {
      try { oldMessage = await oldMessage.fetch(); } catch (_) {}
    }
    const before = oldMessage?.content || 'Unavailable';
    const after = newMessage?.content || 'Unavailable';
    if (before === after) return;

    await sendLog(newMessage.client, {
      guildId: newMessage.guild.id,
      title: 'Message Edited',
      description: `${formatUser(newMessage.author)} edited a message in ${formatChannel(newMessage.channel)}`,
      fields: [
        { name: 'Before', value: truncate(before) },
        { name: 'After', value: truncate(after) },
      ],
      color: 0xffd700,
    });
  },
};
