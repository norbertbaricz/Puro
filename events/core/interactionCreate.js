const { Events } = require('discord.js');
const { dispatchInteraction } = require('../../src/core/interactions/router');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        await dispatchInteraction(interaction);
    },
};
