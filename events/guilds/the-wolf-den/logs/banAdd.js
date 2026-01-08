const { Events } = require('discord.js');
const { sendLog, formatUser } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildBanAdd,
  async execute(ban) {
    await sendLog(ban.client, {
      guildId: ban.guild?.id,
      title: 'Member Banned',
      description: `${formatUser(ban.user)} was banned.`,
      color: 0x8b0000,
    });
  },
};
