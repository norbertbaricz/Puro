const { Events } = require('discord.js');
const { sendLog, formatRole } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildRoleCreate,
  async execute(role) {
    await sendLog(role.client, {
      guildId: role.guild?.id,
      title: 'Role Created',
      description: `${formatRole(role)} was created.`,
      color: 0x32cd32,
    });
  },
};
