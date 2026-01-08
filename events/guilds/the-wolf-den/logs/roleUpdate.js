const { Events } = require('discord.js');
const { sendLog, formatRole, truncate } = require('../../../../lib/wolfDenLogger');

function diff(oldRole, newRole) {
  const changes = [];
  if (oldRole.name !== newRole.name) changes.push(`Name: ${oldRole.name} → ${newRole.name}`);
  if (oldRole.color !== newRole.color) changes.push(`Color: ${oldRole.hexColor} → ${newRole.hexColor}`);
  if (oldRole.hoist !== newRole.hoist) changes.push(`Display Separately: ${oldRole.hoist} → ${newRole.hoist}`);
  if (oldRole.mentionable !== newRole.mentionable) changes.push(`Mentionable: ${oldRole.mentionable} → ${newRole.mentionable}`);
  if (!oldRole.permissions.equals(newRole.permissions)) changes.push('Permissions modified');
  return changes;
}

module.exports = {
  name: Events.GuildRoleUpdate,
  async execute(oldRole, newRole) {
    const changes = diff(oldRole, newRole);
    if (!changes.length) return;

    await sendLog(newRole.client, {
      guildId: newRole.guild?.id,
      title: 'Role Updated',
      description: `${formatRole(newRole)} was modified.`,
      fields: [{ name: 'Changes', value: truncate(changes.join('\n')) }],
      color: 0x1e90ff,
    });
  },
};
