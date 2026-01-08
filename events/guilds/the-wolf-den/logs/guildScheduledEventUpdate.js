const { Events } = require('discord.js');
const { sendLog, timeTag, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildScheduledEventUpdate,
  async execute(oldEvent, newEvent) {
    const changes = [];
    if (oldEvent.name !== newEvent.name) changes.push(`Name: ${oldEvent.name} → ${newEvent.name}`);
    if (oldEvent.status !== newEvent.status) changes.push(`Status: ${oldEvent.status} → ${newEvent.status}`);
    if (oldEvent.scheduledStartAt?.getTime() !== newEvent.scheduledStartAt?.getTime()) changes.push('Start time modified');
    if (oldEvent.scheduledEndAt?.getTime() !== newEvent.scheduledEndAt?.getTime()) changes.push('End time modified');
    if (oldEvent.description !== newEvent.description) changes.push('Description modified');
    if (!changes.length) return;

    await sendLog(newEvent.client, {
      guildId: newEvent.guild?.id,
      title: 'Scheduled Event Updated',
      description: `${newEvent.name} (${newEvent.id}) was modified.`,
      fields: [
        { name: 'Changes', value: truncate(changes.join('\n')) },
        { name: 'Start', value: timeTag(newEvent.scheduledStartAt), inline: true },
        { name: 'End', value: timeTag(newEvent.scheduledEndAt), inline: true },
      ],
      color: 0x1e90ff,
    });
  },
};
