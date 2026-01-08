const { Events } = require('discord.js');
const { sendLog, formatUser } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.InviteDelete,
  async execute(invite) {
    await sendLog(invite.client, {
      guildId: invite.guild?.id,
      title: 'Invite Deleted',
      description: `Code deleted: **${invite.code}** for ${invite.channel?.toString() || 'unknown channel'}`,
      fields: [
        { name: 'Creator', value: formatUser(invite.inviter), inline: true },
      ],
      color: 0xffa500,
    });
  },
};
