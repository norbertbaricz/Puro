const { SlashCommandBuilder } = require('@discordjs/builders');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load the config.yml file
const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear a text channel by running this command!')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Enter a number between 1 and 100')
                .setRequired(true)),

    async execute(interaction) {
        if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
            return interaction.reply({ content: 'You do not have the necessary permission to delete messages!', ephemeral: true });
        }

        const amount = interaction.options.getInteger('amount');
        if (amount <= 0 || amount > 100) {
            return interaction.reply({ content: 'Please specify a number between 1 and 100 of messages to delete.', ephemeral: true });
        }

        try {
            const fetched = await interaction.channel.messages.fetch({ limit: amount });
            const filtered = fetched.filter(msg => (Date.now() - msg.createdTimestamp) < 14 * 24 * 60 * 60 * 1000); // Filter messages older than 14 days

            await interaction.channel.bulkDelete(filtered, true);

            interaction.reply({ content: `Successfully deleted ${filtered.size} messages!`, ephemeral: true });
        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while deleting messages.', ephemeral: true });
        }
    },
};
