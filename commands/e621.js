const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('e621')
        .setDescription('This command will post a random image from the e621 website!')
        .addStringOption(option =>
            option.setName('search')
                .setDescription('Write whatever you want here to search on e621')),

    async execute(interaction) {
        try {
            let apiUrl = 'https://e621.net/posts.json?tags=werewolf%20favcount:100%20rating:explicit';
            const searchQuery = interaction.options.getString('search');

            if (searchQuery) {
                apiUrl = `https://e621.net/posts.json?tags=${encodeURIComponent(searchQuery)}%20favcount:100%20rating:explicit`;
            }

            const response = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': 'norbertbaricz608@gmail.com',
                    'Authorization': 'Basic ' + Buffer.from(`${process.env.E621_USERNAME}:${process.env.E621_API_KEY}`).toString('base64')
                }
            });

            const postURLs = response.data.posts.map(post => post.file.url);
            const filteredURLs = postURLs.filter(url => url.endsWith('.png') || url.endsWith('.gif'));

            if (filteredURLs.length > 0) {
                const randomIndex = Math.floor(Math.random() * filteredURLs.length);
                const randomImageUrl = filteredURLs[randomIndex];

                const embed = new EmbedBuilder()
                    .setColor(config.commands.e621 || config.colors.default)
                    .setImage(randomImageUrl);

                await interaction.reply({ embeds: [embed] });
            } else {
                await interaction.reply('No PNG or GIF images found.');
            }
        } catch (error) {
            console.error(error);
            await interaction.reply('An error occurred while fetching the image.');
        }
    },
};
