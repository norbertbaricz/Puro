const { Events, ChannelType } = require('discord.js');
const { sendLog, formatChannel } = require('../../../../lib/wolfDenLogger');

function typeName(type) {
  return ChannelType[type] || 'Channel';
}

module.exports = {
  name: Events.ChannelCreate,
  async execute(channel) {
    await sendLog(channel.client, {
      guildId: channel.guild?.id,
      title: 'Channel Created',
      description: `${formatChannel(channel)} (${typeName(channel.type)}) was created.`,
      color: 0x32cd32,
    });
  },
};
