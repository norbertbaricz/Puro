const { ContextMenuCommandBuilder, ApplicationCommandType } = require('discord.js');
const { showAvatar } = require('../../src/features/profiles/avatar');

module.exports = {
    category: 'Info',
    portable: true,
    cooldown: 2,
    data: new ContextMenuCommandBuilder().setName('View avatar').setType(ApplicationCommandType.User),
    async execute(interaction) {
        await showAvatar(interaction, interaction.targetUser);
    },
};
