const { Events } = require('discord.js');
const { sendLog, formatUser, timeTag } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.InviteCreate,
  async execute(invite) {
    await sendLog(invite.client, {
      guildId: invite.guild?.id,
      title: 'Invite Created',
      description: `Code: **${invite.code}** for ${invite.channel?.toString() || 'unknown channel'}`,
      fields: [
        { name: 'Creator', value: formatUser(invite.inviter), inline: true },
        { name: 'Max Uses', value: invite.maxUses ? String(invite.maxUses) : '∞', inline: true },
        { name: 'Expires', value: invite.expiresAt ? timeTag(invite.expiresAt) : 'Never', inline: true },
      ],
    });
  },
};
