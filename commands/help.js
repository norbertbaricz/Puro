const { SlashCommandBuilder } = require('@discordjs/builders');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('This command will show you all the commands that are available'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(config.commands.help || config.colors.default)
            .setTitle('Available Commands:');

        const commandsPath = path.join(__dirname, '..', 'commands');
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, file));
            embed.addFields({ name: '\u200B', value: `> **/${command.data.name}** \n *${command.data.description}*`, inline: true });
        }

        await interaction.reply({ embeds: [embed] });
    },
};
