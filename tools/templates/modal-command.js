const { SlashCommandBuilder, ModalBuilder, LabelBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

// Copy to commands/Examples/feedback.js and copy modal.js to components/.
const MODAL_ID = 'example:feedback';
const INPUT_ID = 'feedback_text';
const MAX_INPUT_LENGTH = 1000;

module.exports = {
    category: 'Examples',
    data: new SlashCommandBuilder().setName('feedback-demo').setDescription('Open a modern Discord form.'),
    async execute(interaction) {
        const field = new LabelBuilder()
            .setLabel('Your feedback')
            .setTextInputComponent(
                new TextInputBuilder()
                    .setCustomId(INPUT_ID)
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(MAX_INPUT_LENGTH),
            );
        const modal = new ModalBuilder().setCustomId(MODAL_ID).setTitle('Feedback').addLabelComponents(field);
        await interaction.showModal(modal);
    },
};
