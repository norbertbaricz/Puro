const { SlashCommandBuilder, MessageFlags } = require('discord.js');

// Copy to commands/<category>/hello.js and choose a unique slash-command name.
const COMMAND_NAME = 'hello';
const COMMAND_DESCRIPTION = 'Say hello.';
const COOLDOWN_SECONDS = 3;

module.exports = {
    category: 'Examples',
    cooldown: COOLDOWN_SECONDS,
    data: new SlashCommandBuilder().setName(COMMAND_NAME).setDescription(COMMAND_DESCRIPTION),
    async execute(interaction) {
        await interaction.reply(
            interaction.client.ui.info(`Hello, ${interaction.user.username}!`, {
                title: 'Welcome',
                flags: MessageFlags.Ephemeral,
            }),
        );
    },
};
