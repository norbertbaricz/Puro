const { MessageFlags } = require('discord.js');

// Copy to components/color-select.js. Other select-menu kinds use the same type.
const SELECT_ID = 'example:color';
const ALLOWED_COLORS = new Set(['red', 'white', 'black']);

module.exports = {
    type: 'selectMenu',
    customId: SELECT_ID,
    async execute(interaction) {
        const color = interaction.values[0];
        if (!ALLOWED_COLORS.has(color))
            return interaction.reply({ content: 'Unknown color.', flags: MessageFlags.Ephemeral });
        await interaction.reply({ content: `You chose ${color}.`, flags: MessageFlags.Ephemeral });
    },
};
