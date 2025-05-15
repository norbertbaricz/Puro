const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('send')
        .setDescription('Send a DM')
        .addUserOption(option =>
            option.setName('user').setDescription('The user').setRequired(true))
        .addStringOption(option =>
            option.setName('message').setDescription('The message').setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        const config = interaction.client.config.commands.send;
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: config.messages.no_permission, ephemeral: true });
            }

            const targetUser = interaction.options.getUser('user');
            const message = interaction.options.getString('message');

            await targetUser.send(message);
            await interaction.reply({ content: config.messages.success.replace('{user}', targetUser.tag), ephemeral: true });
        } catch (error) {
            console.error('Send error:', error);
            await interaction.reply({ content: config.messages.error.replace('{user}', targetUser.tag), ephemeral: true });
        }
    },
};