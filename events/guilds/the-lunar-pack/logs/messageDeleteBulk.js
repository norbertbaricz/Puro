const { Events } = require('discord.js');
const { sendLog, formatChannel } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.MessageBulkDelete,
  async execute(messages) {
    const first = messages?.first();
    if (!first?.guild) return;

    await sendLog(first.client, {
      guildId: first.guild.id,
      title: 'Bulk Message Delete',
      description: `${messages.size} messages deleted in ${formatChannel(first.channel)}`,
      color: 0xdc143c,
    });
  },
};
