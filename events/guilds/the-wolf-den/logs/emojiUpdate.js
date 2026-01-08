const { Events } = require('discord.js');
const { sendLog, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildEmojiUpdate,
  async execute(oldEmoji, newEmoji) {
    const changes = [];
    if (oldEmoji.name !== newEmoji.name) changes.push(`Name: ${oldEmoji.name} → ${newEmoji.name}`);
    if (!changes.length) return;

    await sendLog(newEmoji.client, {
      guildId: newEmoji.guild?.id,
      title: 'Emoji Updated',
      description: `${newEmoji} (\`:${newEmoji.name}:\`) was modified.`,
      fields: [{ name: 'Changes', value: changes.join('\n') }],
      color: 0x1e90ff,
    });
  },
};
