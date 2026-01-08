const { Events } = require('discord.js');
const { sendLog, formatUser, formatChannel, truncate, timeTag } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.MessageDelete,
  async execute(message) {
    if (!message.guild || !message.client || message.author?.id === message.client.user?.id) return;

    const content = message.partial ? 'Content unavailable (uncached message)' : (message.content || 'No text');
    const attachments = [...(message.attachments?.values() || [])];

    await sendLog(message.client, {
      guildId: message.guild.id,
      title: 'Message Deleted',
      description: `${formatUser(message.author)} deleted a message in ${formatChannel(message.channel)}`,
      fields: [
        { name: 'Content', value: truncate(content, 1024) },
        { name: 'Attachments', value: attachments.length ? attachments.map((a) => a.url).join('\n') : 'None' },
        { name: 'Created At', value: timeTag(message.createdAt), inline: true },
      ],
      color: 0xdc143c,
    });
  },
};
