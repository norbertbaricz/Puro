const { MessageFlags } = require('discord.js');

// Select-menu routing uses the same persistent help session as navigation buttons.
const CUSTOM_ID_PREFIX = 'puro:help:';

module.exports = {
    type: 'selectMenu',
    customId: CUSTOM_ID_PREFIX,
    prefix: true,
    async execute(interaction) {
        const command = interaction.client.commands.get('help');
        if (command) await command.handleComponent(interaction);
        else
            await interaction.reply({
                content: 'The help command is currently unavailable.',
                flags: MessageFlags.Ephemeral,
            });
    },
};
