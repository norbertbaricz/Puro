const { SlashCommandBuilder } = require('discord.js');
const { showAvatar } = require('../../src/features/profiles/avatar');

module.exports = {
    category: 'Info',
    portable: true,
    cooldown: 2,
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('View an avatar in a native Discord media gallery.')
        .addUserOption((option) => option.setName('user').setDescription('Whose avatar to show.'))
        .addBooleanOption((option) => option.setName('private').setDescription('Show the avatar only to you.')),
    async execute(interaction) {
        await showAvatar(
            interaction,
            interaction.options.getUser('user') || interaction.user,
            interaction.options.getBoolean('private') ?? true,
        );
    },
};
