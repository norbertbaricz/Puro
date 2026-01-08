const { Events } = require('discord.js');
const { sendLog, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildStickerCreate,
  async execute(sticker) {
    await sendLog(sticker.client, {
      guildId: sticker.guild?.id,
      title: 'Sticker Created',
      description: `${sticker.name} (${sticker.id}) was created.`,
      fields: [{ name: 'Description', value: truncate(sticker.description || 'None') }],
      color: 0x32cd32,
    });
  },
};
