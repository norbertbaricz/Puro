const { MessageFlags } = require('discord.js');

// Copy to components/hello-button.js. No central handler edits are needed.
const CUSTOM_ID = 'example:hello';

module.exports = {
    type: 'button',
    customId: CUSTOM_ID,
    async execute(interaction) {
        await interaction.reply({ content: 'Your button works!', flags: MessageFlags.Ephemeral });
    },
};
