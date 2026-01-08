const { Events } = require('discord.js');
const { sendLog, formatChannel, truncate } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.ThreadUpdate,
  async execute(oldThread, newThread) {
    if (!newThread?.guild) return;
    const changes = [];
    if (oldThread.name !== newThread.name) changes.push(`Name: ${oldThread.name} → ${newThread.name}`);
    if (oldThread.archived !== newThread.archived) changes.push(`Archived: ${oldThread.archived} → ${newThread.archived}`);
    if (oldThread.locked !== newThread.locked) changes.push(`Locked: ${oldThread.locked} → ${newThread.locked}`);
    if (!changes.length) return;

    await sendLog(newThread.client, {
      guildId: newThread.guild.id,
      title: 'Thread Updated',
      description: `${formatChannel(newThread)} in ${formatChannel(newThread.parent)} was modified.`,
      fields: [{ name: 'Changes', value: truncate(changes.join('\n')) }],
      color: 0x1e90ff,
    });
  },
};
