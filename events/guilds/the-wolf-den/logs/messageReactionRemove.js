const { Events } = require('discord.js');
const { sendLog, formatUser, formatChannel, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.MessageReactionRemove,
  async execute(reaction, user) {
    try { if (reaction.partial) await reaction.fetch(); } catch (_) {}
    const message = reaction.message;
    if (!message?.guild) return;
    await sendLog(message.client, {
      guildId: message.guild.id,
      title: 'Reaction Removed',
      description: `${formatUser(user)} removed ${reaction.emoji} from ${formatChannel(message.channel)}.`,
      fields: [
        { name: 'Message', value: truncate(message.content || 'No text', 512) },
        { name: 'Message Author', value: message.author ? formatUser(message.author) : 'None', inline: true },
      ],
      color: 0xcd853f,
    });
  },
};
