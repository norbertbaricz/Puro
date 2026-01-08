const { Events } = require('discord.js');
const { sendLog, timeTag, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildScheduledEventCreate,
  async execute(event) {
    await sendLog(event.client, {
      guildId: event.guild?.id,
      title: 'Scheduled Event Created',
      description: `${event.name} (${event.id}) was created.`,
      fields: [
        { name: 'Start', value: timeTag(event.scheduledStartAt), inline: true },
        { name: 'End', value: timeTag(event.scheduledEndAt), inline: true },
        { name: 'Description', value: truncate(event.description || 'None') },
      ],
      color: 0x32cd32,
    });
  },
};
