const { Events } = require('discord.js');
const { sendLog, formatUser, formatChannel } = require('../../../../lib/wolfDenLogger');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;
    if (oldChannel?.id === newChannel?.id) return;

    let action = '';
    if (!oldChannel && newChannel) action = 'joined voice';
    else if (oldChannel && !newChannel) action = 'left voice';
    else action = 'moved voice channels';

    await sendLog(newState.client, {
      guildId: guild.id,
      title: 'Voice Activity',
      description: `${formatUser(newState.member?.user || oldState.member?.user)} ${action}.`,
      fields: [
        { name: 'From', value: oldChannel ? formatChannel(oldChannel) : 'None', inline: true },
        { name: 'To', value: newChannel ? formatChannel(newChannel) : 'None', inline: true },
      ],
      color: 0x1e90ff,
    });
  },
};
