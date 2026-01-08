const { Events } = require('discord.js');
const { handleVoiceStateUpdate } = require('../../../lib/wolfDenRecorder');

module.exports = {
  name: Events.VoiceStateUpdate,
  async execute(oldState, newState, client) {
    await handleVoiceStateUpdate(oldState, newState, client);
  },
};
