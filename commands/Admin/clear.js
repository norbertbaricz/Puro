const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Admin',
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
                const embed = new EmbedBuilder()
                    .setColor(config.color || '#ff0000')
                    .setTitle('⛔ No Permission')
                    .setDescription(config.messages.no_permission);
                return interaction.reply({ embeds: [embed] });
            }

            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
                const embed = new EmbedBuilder()
                    .setColor(config.color || '#ff0000')
                    .setTitle('⛔ Missing Bot Permission')
                    .setDescription(config.messages.no_bot_permission);
                return interaction.reply({ embeds: [embed] });
            }

            const amount = interaction.options.getInteger('amount');
            const targetUser = interaction.options.getUser('user');

            // Folosește flags pentru ephemeral (fără warning)
            await interaction.deferReply({ flags: 64 });

            const messages = await interaction.channel.messages.fetch({ limit: amount });
            const filteredMessages = messages.filter(msg => {
                const age = Date.now() - msg.createdTimestamp;
                return age < 1209600000 && (!targetUser || msg.author.id === targetUser.id);
            });

            if (filteredMessages.size === 0) {
                const embed = new EmbedBuilder()
                    .setColor(config.color || '#ffcc00')
                    .setTitle('⚠️ No Messages')
                    .setDescription(config.messages.no_messages);
                return interaction.editReply({ embeds: [embed] });
            }

            const deletedMessages = await interaction.channel.bulkDelete(filteredMessages, true);

            const embed = new EmbedBuilder()
                .setColor(config.color || '#00ff00')
                .setTitle('✅ Messages Deleted')
                .setDescription(
                    config.messages.success
                        .replace('{count}', deletedMessages.size)
                        .replace('{s}', deletedMessages.size === 1 ? '' : 's')
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            console.error('Clear error:', error);
            const embed = new EmbedBuilder()
                .setColor(config.color || '#ff0000')
                .setTitle('❌ Error')
                .setDescription(config.messages.error || 'An error occurred while clearing messages.');
            await interaction.editReply({ embeds: [embed] });
        }
    },
};