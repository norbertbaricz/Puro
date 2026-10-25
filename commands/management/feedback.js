const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { feedbackForm } = require('../../src/features/feedback/form');

module.exports = {
    category: 'Management',
    feature: 'feedback',
    cooldown: 60,
    data: new SlashCommandBuilder()
        .setName('feedback')
        .setDescription('Send feedback using a form with file upload, radio buttons, and contact consent.'),
    async execute(interaction) {
        if (!interaction.client.config.features.feedback.channel_id)
            return interaction.reply({
                content: 'The bot owner must configure features.feedback.channel_id first.',
                flags: MessageFlags.Ephemeral,
            });
        await interaction.showModal(feedbackForm());
    },
};
