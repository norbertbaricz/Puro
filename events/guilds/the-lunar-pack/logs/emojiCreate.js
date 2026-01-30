const { Events } = require('discord.js');
const { sendLog, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildEmojiCreate,
  async execute(emoji) {
    await sendLog(emoji.client, {
      guildId: emoji.guild?.id,
      title: 'Emoji Created',
      description: `:${emoji.name}: (${emoji.id}) was created.`,
      thumbnail: emoji.url,
      fields: [{ name: 'Animated', value: String(emoji.animated), inline: true }],
      color: 0x32cd32,
    });
  },
};
