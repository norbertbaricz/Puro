const { Events, ChannelType } = require('discord.js');
const { handleRecorderDm, TARGET_USER_ID } = require('../../lib/wolfDenRecorder');

module.exports = {
  name: Events.MessageCreate,
  async execute(message, client) {
    if (message.author?.bot) return;
    if (message.channel?.type !== ChannelType.DM) return;
    if (message.author?.id !== TARGET_USER_ID) return;
    await handleRecorderDm(message, client);
  },
};
