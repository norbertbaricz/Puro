const { Events, Routes } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const TARGET_GUILD_ID = '1217588804328620163';
const TARGET_MEMBER_ID = '486412940199591967';
const TARGET_SOUNDBOARD_ID = '1239667321467965654';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState) {
    if (newState.id !== TARGET_MEMBER_ID) return;

    const guild = newState.guild || oldState.guild;
    if (!guild || guild.id !== TARGET_GUILD_ID) return;

    const oldChannelId = oldState.channelId;
    const newChannelId = newState.channelId;

    if (oldChannelId === newChannelId) return;

    const connection = getVoiceConnection(guild.id);

    if (!newChannelId) {
      if (connection) {
        connection.destroy();
      }
      return;
    }

    const targetChannel = newState.channel;
    if (!targetChannel) return;

    if (connection?.joinConfig?.channelId === targetChannel.id) return;

    try {
      if (connection) {
        connection.destroy();
      }

      joinVoiceChannel({
        channelId: targetChannel.id,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      await wait(1200);
      try {
        await newState.client.rest.post(Routes.sendSoundboardSound(targetChannel.id), {
          body: {
            sound_id: TARGET_SOUNDBOARD_ID,
            source_guild_id: TARGET_GUILD_ID,
          },
        });
      } catch (soundboardError) {
        if (soundboardError?.code === 50167) {
          console.warn('[PremiumVoiceFollow] Soundboard skipped: bot is muted/deafened/suppressed in channel.');
        } else {
          console.error('[PremiumVoiceFollow] Failed to play soundboard:', soundboardError);
        }
      }
    } catch (error) {
      console.error('[PremiumVoiceFollow] Failed to follow member in voice:', error);
    }
  },
};
