const { Events } = require('discord.js');
const { sendLog, formatUser } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildBanRemove,
  async execute(ban) {
    await sendLog(ban.client, {
      guildId: ban.guild?.id,
      title: 'Member Unbanned',
      description: `${formatUser(ban.user)} was unbanned.`,
      color: 0x2e8b57,
    });
  },
};
