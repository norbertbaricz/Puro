const { Events } = require('discord.js');
const { sendLog, formatUser, timeTag } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    await sendLog(member.client, {
      guildId: member.guild?.id,
      title: 'Member Left',
      description: `${formatUser(member.user)} left the server.`,
      fields: [
        { name: 'Joined', value: timeTag(member.joinedAt), inline: true },
        { name: 'Left', value: timeTag(new Date()), inline: true },
      ],
      color: 0xff4500,
    });
  },
};
