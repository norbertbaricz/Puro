const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load the config.yml file
const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));

module.exports = {
    name: 'interactionCreate',
    execute: async (interaction, client) => {
        if (!interaction.isCommand()) return;

        const { commandName } = interaction;
        const command = client.commands.get(commandName);

        if (!command) return;

        try {
            await command.execute(interaction, client);
        } catch (error) {
            console.error('Error executing command:', error);
            await interaction.reply({ content: config.messages.errorExecutingCommand, ephemeral: true });
        }
    }
};