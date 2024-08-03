const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('This command will post random memes from the internet! Attention, these memes are very funny!'),

    async execute(interaction) {
        try {
            const apiUrl = 'https://meme-api.com/gimme';
            const response = await axios.get(apiUrl);

            const memeUrl = response.data.url;

            const embed = new EmbedBuilder()
                .setColor(config.commands.meme || config.colors.default)
                .setImage(memeUrl);

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            await interaction.reply('An error occurred while fetching the meme.');
        }
    },
};
