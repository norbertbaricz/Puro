const { MODAL_ID } = require('../src/features/feedback/form');
const { submitFeedback } = require('../src/features/feedback/submit');

module.exports = {
    type: 'modal',
    customId: MODAL_ID,
    feature: 'feedback',
    defer: 'private',
    cooldown: 60,
    async execute(interaction) {
        await submitFeedback(interaction);
    },
};
