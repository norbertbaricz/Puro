const { Events } = require('discord.js');
const { sendLog, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildStickerUpdate,
  async execute(oldSticker, newSticker) {
    const changes = [];
    if (oldSticker.name !== newSticker.name) changes.push(`Name: ${oldSticker.name} → ${newSticker.name}`);
    if (oldSticker.description !== newSticker.description) changes.push(`Description: ${oldSticker.description || 'None'} → ${newSticker.description || 'None'}`);
    if (!changes.length) return;

    await sendLog(newSticker.client, {
      guildId: newSticker.guild?.id,
      title: 'Sticker Updated',
      description: `**${newSticker.name}** was modified.`,
      fields: [{ name: 'Changes', value: changes.join('\n') }],
      color: 0x1e90ff,
    });
  },
};
