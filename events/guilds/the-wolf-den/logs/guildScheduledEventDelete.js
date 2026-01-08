const { Events } = require('discord.js');
const { sendLog } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildScheduledEventDelete,
  async execute(event) {
    await sendLog(event.client, {
      guildId: event.guild?.id,
      title: 'Scheduled Event Deleted',
      description: `${event.name} (${event.id}) was deleted.`,
      color: 0xff6347,
    });
  },
};
