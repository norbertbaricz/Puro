const { Events, ChannelType } = require('discord.js');
const { sendLog, formatChannel, truncate } = require('../../../../lib/wolfDenLogger');

function typeName(type) {
  return ChannelType[type] || 'Channel';
}

function diff(oldC, newC) {
  const changes = [];
  if (oldC.name !== newC.name) changes.push(`Name: ${oldC.name} → ${newC.name}`);
  if (oldC.parentId !== newC.parentId) changes.push(`Category: ${oldC.parentId || 'None'} → ${newC.parentId || 'None'}`);
  if (oldC.topic !== newC.topic) changes.push('Topic changed');
  if (oldC.nsfw !== newC.nsfw) changes.push(`NSFW: ${oldC.nsfw} → ${newC.nsfw}`);
  if (oldC.rateLimitPerUser !== newC.rateLimitPerUser) changes.push(`Slowmode: ${oldC.rateLimitPerUser}s → ${newC.rateLimitPerUser}s`);
  if (oldC.bitrate !== newC.bitrate) changes.push(`Bitrate: ${oldC.bitrate} → ${newC.bitrate}`);
  if (oldC.userLimit !== newC.userLimit) changes.push(`User limit: ${oldC.userLimit} → ${newC.userLimit}`);
  return changes;
}

module.exports = {
  name: Events.ChannelUpdate,
  async execute(oldChannel, newChannel) {
    if (!newChannel?.guild) return;
    const changes = diff(oldChannel, newChannel);
    if (!changes.length) return;

    await sendLog(newChannel.client, {
      guildId: newChannel.guild.id,
      title: 'Channel Updated',
      description: `${formatChannel(newChannel)} (${typeName(newChannel.type)}) was modified.`,
      fields: [{ name: 'Changes', value: truncate(changes.join('\n')) }],
      color: 0x1e90ff,
    });
  },
};
