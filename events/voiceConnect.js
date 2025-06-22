const { Events, ChannelType, PermissionsBitField } = require('discord.js');

const LOBBY_CHANNEL_ID = '1385321890675032174';

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    // User joined the lobby channel
    if (
      newState.channelId === LOBBY_CHANNEL_ID &&
      oldState.channelId !== LOBBY_CHANNEL_ID
    ) {
      const guild = newState.guild;
      const member = newState.member;

      // Creează canalul vocal personalizat cu opțiuni extra
      const channel = await guild.channels.create({
        name: `${member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: newState.channel.parent,
        bitrate: 64000, // bitrate custom (maximul depinde de boost)
        userLimit: 5, // maxim 5 persoane
        rtcRegion: 'rotterdam', // regiune validă pentru Europa
        videoQualityMode: 1, // 1 = Auto, 2 = Full
        permissionOverwrites: [
          {
            id: guild.roles.everyone,
            allow: [PermissionsBitField.Flags.Connect],
          },
          {
            id: member.id,
            allow: [
              PermissionsBitField.Flags.Connect,
              PermissionsBitField.Flags.MoveMembers,
              PermissionsBitField.Flags.MuteMembers,
              PermissionsBitField.Flags.DeafenMembers,
              PermissionsBitField.Flags.ManageChannels, // poate edita canalul
            ],
          },
        ],
      });

      // Mută membrul în noul canal
      await member.voice.setChannel(channel);

      // Salvează creatorul pe canal pentru verificare la ștergere
      channel.creatorId = member.id;
    }

    // Verifică dacă un canal personal trebuie șters
    if (
      oldState.channel &&
      oldState.channel.type === ChannelType.GuildVoice &&
      oldState.channel.name === oldState.member.user.username // presupunem că doar canalele create au acest nume
    ) {
      // Dacă nu mai e nimeni pe canal, șterge-l
      if (oldState.channel.members.size === 0) {
        await oldState.channel.delete().catch(() => {});
      }
    }
  },
};