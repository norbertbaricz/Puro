const { Events } = require('discord.js');
const { sendLog, formatChannel } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.ThreadDelete,
  async execute(thread) {
    await sendLog(thread.client, {
      guildId: thread.guild?.id,
      title: 'Thread Deleted',
      description: `${formatChannel(thread)} was deleted.`,
      color: 0xff6347,
    });
  },
};
