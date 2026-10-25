const { Events } = require('discord.js');
const { restoreTemporaryChannels } = require('../../../src/features/voice/temporary');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(guild, client) {
        await restoreTemporaryChannels(guild, client);
    },
};
