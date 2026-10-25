const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');

// Copy to commands/Examples/select-demo.js and select-menu.js to components/.
const SELECT_ID = 'example:color';
const OPTIONS = [
    { label: 'Red', value: 'red' },
    { label: 'White', value: 'white' },
    { label: 'Black', value: 'black' },
];

module.exports = {
    category: 'Examples',
    data: new SlashCommandBuilder().setName('select-demo').setDescription('Show a persistent drop-in select menu.'),
    async execute(interaction) {
        await interaction.reply({
            content: 'Choose a color:',
            components: [
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId(SELECT_ID)
                        .setPlaceholder('Pick a color')
                        .addOptions(OPTIONS),
                ),
            ],
            flags: MessageFlags.Ephemeral,
        });
    },
};
