const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// Copy to commands/Examples/button-demo.js and copy button.js to components/.
const BUTTON_ID = 'example:hello';

module.exports = {
    category: 'Examples',
    data: new SlashCommandBuilder().setName('button-demo').setDescription('Show a persistent, drop-in button.'),
    async execute(interaction) {
        await interaction.reply({
            content: 'Press the button:',
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(BUTTON_ID).setLabel('Hello').setStyle(ButtonStyle.Primary),
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};
