const { Events } = require('discord.js');
const { sendLog, formatChannel } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.ThreadCreate,
  async execute(thread) {
    await sendLog(thread.client, {
      guildId: thread.guild?.id,
      title: 'Thread Created',
      description: `${formatChannel(thread)} was created.`,
      color: 0x32cd32,
    });
  },
};
