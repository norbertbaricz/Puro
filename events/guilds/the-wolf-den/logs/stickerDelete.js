const { Events } = require('discord.js');
const { sendLog } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildStickerDelete,
  async execute(sticker) {
    await sendLog(sticker.client, {
      guildId: sticker.guild?.id,
      title: 'Sticker Deleted',
      description: `**${sticker.name}** (${sticker.id}) was deleted.`,
      color: 0xff6347,
    });
  },
};
