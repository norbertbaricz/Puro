const { Events, ChannelType } = require('discord.js');
const { sendLog, formatChannel } = require('../../../../lib/wolfDenLogger');

function typeName(type) {
  return ChannelType[type] || 'Channel';
}

module.exports = {
  name: Events.ChannelDelete,
  async execute(channel) {
    await sendLog(channel.client, {
      guildId: channel.guild?.id,
      title: 'Channel Deleted',
      description: `${formatChannel(channel)} (${typeName(channel.type)}) was deleted.`,
      color: 0xff6347,
    });
  },
};
