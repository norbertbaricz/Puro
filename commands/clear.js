const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load the config.yml file with error handling
let config;
try {
    config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
} catch (error) {
    config = { commands: {} }; // Fallback config
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear messages from a text channel')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Enter a number between 1 and 100')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)),

    async execute(interaction) {
        try {
            // Check user permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ 
                    content: '❌ You need the "Manage Messages" permission to use this command!', 
                    ephemeral: true 
                });
            }

            // Check bot permissions
            if (!interaction.guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({ 
                    content: '❌ I need the "Manage Messages" permission to delete messages!', 
                    ephemeral: true 
                });
            }

            const amount = interaction.options.getInteger('amount');

            // Defer the reply since this might take a while
            await interaction.deferReply({ ephemeral: true });

            try {
                const messages = await interaction.channel.messages.fetch({ limit: amount });
                const filteredMessages = messages.filter(msg => {
                    const age = Date.now() - msg.createdTimestamp;
                    return age < 1209600000; // 14 days in milliseconds
                });

                if (filteredMessages.size === 0) {
                    return interaction.editReply({
                        content: '⚠️ No messages found that can be deleted (messages must be newer than 14 days).',
                        ephemeral: true
                    });
                }

                const deletedMessages = await interaction.channel.bulkDelete(filteredMessages, true);

                const response = [
                    `✅ Successfully deleted ${deletedMessages.size} message${deletedMessages.size === 1 ? '' : 's'}!`
                ];

                if (deletedMessages.size < amount) {
                    response.push(`\n⚠️ ${amount - deletedMessages.size} message${amount - deletedMessages.size === 1 ? ' was' : 's were'} older than 14 days and couldn't be deleted.`);
                }

                await interaction.editReply({
                    content: response.join(''),
                    ephemeral: true
                });

            } catch (error) {
                let errorMessage = '❌ An error occurred while deleting messages.';
                if (error.code === 50034) {
                    errorMessage = '❌ Cannot delete messages older than 14 days.';
                } else if (error.code === 50013) {
                    errorMessage = '❌ I don\'t have permission to delete messages in this channel.';
                }

                await interaction.editReply({
                    content: errorMessage,
                    ephemeral: true
                });
            }
        } catch (error) {
            const reply = interaction.deferred 
                ? interaction.editReply 
                : interaction.reply;
            
            await reply.call(interaction, {
                content: '❌ An unexpected error occurred while processing the command.',
                ephemeral: true
            }).catch(console.error);
        }
    },
};
