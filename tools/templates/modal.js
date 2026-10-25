const { MessageFlags } = require('discord.js');

// Copy to components/feedback-modal.js. Read other modal components the same way.
const MODAL_ID = 'example:feedback';
const INPUT_ID = 'feedback_text';

module.exports = {
    type: 'modal',
    customId: MODAL_ID,
    async execute(interaction) {
        const feedback = interaction.fields.getTextInputValue(INPUT_ID);
        await interaction.reply({
            content: `Received your ${feedback.length}-character response. Thank you!`,
            flags: MessageFlags.Ephemeral,
        });
    },
};
