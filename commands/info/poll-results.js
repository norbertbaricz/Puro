const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { showPollResults } = require('../../src/features/polls/results');

module.exports = {
    category: 'Info',
    guildOnly: true,
    defer: 'private',
    cooldown: 3,
    data: new ContextMenuCommandBuilder().setName('Poll results').setType(ApplicationCommandType.Message),
    async execute(interaction) {
        await showPollResults(interaction);
    },
};
