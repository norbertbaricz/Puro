const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages from channel')
        .addIntegerOption(option =>
            option.setName('amount').setDescription('Number (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
        .addUserOption(option =>
            option.setName('user').setDescription('Delete user messages').setRequired(false)),

    async execute(interaction) {
        const config = interaction.client.config.commands.clear;
        try {
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: config.messages.no_permission, ephemeral: true });
            }

            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ content: config.messages.no_bot_permission, ephemeral: true });
            }

            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');

            await interaction.deferReply({ ephemeral: true });

            const messages = await interaction.channel.messages.fetch({ limit: amount });
            const filteredMessages = messages.filter(msg => {
                const age = Date.now() - msg.createdTimestamp;
                return age < 1209600000 && (!targetUser || msg.author.id === targetUser.id);
            });

            if (filteredMessages.size === 0) {
                return interaction.editReply({ content: config.messages.no_messages, ephemeral: true });
            }

            const deletedMessages = await interaction.channel.bulkDelete(filteredMessages, true);

            await interaction.editReply({
                content: config.messages.success.replace('{count}', deletedMessages.size).replace('{s}', deletedMessages.size === 1 ? '' : 's'),
                ephemeral: true
            });
        } catch (error) {
            console.error('Clear error:', error);
            await interaction.editReply({ content: config.messages.error, ephemeral: true });
        }
    },
};