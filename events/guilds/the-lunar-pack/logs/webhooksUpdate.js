const { Events } = require('discord.js');
const { sendLog, formatChannel } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.WebhooksUpdate,
  async execute(channel) {
    await sendLog(channel.client, {
      guildId: channel.guild?.id,
      title: 'Webhook Updated',
      description: `Webhooks in ${formatChannel(channel)} were modified.`,
      color: 0x6a5acd,
    });
  },
};
