const { Events } = require('discord.js');
const { sendLog, formatRole } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildRoleDelete,
  async execute(role) {
    await sendLog(role.client, {
      guildId: role.guild?.id,
      title: 'Role Deleted',
      description: `${formatRole(role)} was deleted.`,
      color: 0xff6347,
    });
  },
};
