const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('Flip a coin'),

    async execute(interaction) {
        const result = Math.random() < 0.5 ? 'Heads' : 'Tails';

        const embed = new EmbedBuilder()
            .setColor(config.commands.coinflip || config.colors.default)
            .setTitle('Coin flip result:')
            .setDescription(`# ${result}`);

        await interaction.reply({ embeds: [embed] });
    },
};
