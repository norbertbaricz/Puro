const { Events } = require('discord.js');
const { sendLog } = require('../../../../lib/lunarPackLogger');

module.exports = {
  name: Events.GuildEmojiDelete,
  async execute(emoji) {
    await sendLog(emoji.client, {
      guildId: emoji.guild?.id,
      title: 'Emoji Deleted',
      description: `${emoji} (\`:${emoji.name}:\`) was deleted.`,
      color: 0xff6347,
    });
  },
};
