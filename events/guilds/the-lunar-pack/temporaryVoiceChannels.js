const { Events } = require('discord.js');
const { handleVoiceUpdate } = require('../../../src/features/voice/temporary');

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState) {
        await handleVoiceUpdate(oldState, newState);
    },
};
