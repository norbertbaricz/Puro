const { MessageFlags } = require('discord.js');

// This persistent route survives module reloads without a message collector.
const CUSTOM_ID_PREFIX = 'puro:help:';

module.exports = {
    type: 'button',
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
