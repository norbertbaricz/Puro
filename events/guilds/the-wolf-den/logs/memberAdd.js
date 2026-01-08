const { Events } = require('discord.js');
const { sendLog, formatUser, timeTag } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildMemberAdd,
  async execute(member) {
    await sendLog(member.client, {
      guildId: member.guild?.id,
      title: 'Member Joined',
      description: `${formatUser(member.user)} joined the server.`,
      fields: [
        { name: 'Account Created', value: timeTag(member.user.createdAt), inline: true },
        { name: 'Joined', value: timeTag(member.joinedAt), inline: true },
      ],
      color: 0x00ff00,
    });
  },
};
