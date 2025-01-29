const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send a private DM to a user')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to send the message to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const message = interaction.options.getString('message');

        try {
            await targetUser.send(message);
            await interaction.reply({ 
                content: `Message sent successfully to ${targetUser.tag}!`,
                ephemeral: true 
            });
        } catch (error) {
            await interaction.reply({ 
                content: `Failed to send message to ${targetUser.tag}. They might have DMs disabled.`,
                ephemeral: true 
            });
        }
    },
};
