const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    category: 'Fun',
    // Define the slash command
    data: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Tells a random joke!'),
    
    // The function that executes when the command is called
    async execute(interaction) {
        const config = interaction.client.config;
        const jokeConfig = config.commands.joke;

        try {
            // Make a request to the JokeAPI using Axios.
            const response = await axios.get('https://v2.jokeapi.dev/joke/Any', {
                params: {
                    blacklistFlags: 'nsfw,religious,political,racist,sexist,explicit',
                    type: 'single' // Request a single-part joke for simplicity
                }
            });
            
            const data = response.data;

            // Check if the API returned an error within its JSON response
            if (data.error) {
                console.error(`Error from joke API: ${data.message}`);
                return interaction.reply({ 
                    content: jokeConfig.messages.api_error,
                    ephemeral: true 
                });
            }

            // Since we requested 'type=single', we expect only 'single' type.
            if (data.type !== 'single') {
                return interaction.reply({ 
                    content: jokeConfig.messages.decode_error,
                    ephemeral: true 
                });
            }

            // Create the embed
            const jokeEmbed = new EmbedBuilder()
                .setColor(jokeConfig.color)
                .setTitle(jokeConfig.messages.title)
                .setDescription(data.joke)
                .setTimestamp()
                .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() });

            // Reply with the embed
            await interaction.reply({ embeds: [jokeEmbed] });

        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                console.error(`Axios API request error: ${error.response.status} ${error.response.statusText}`, error.response.data);
                await interaction.reply({
                    content: jokeConfig.messages.fetch_error,
                    ephemeral: true 
                });
            } else {
                console.error('An unexpected error occurred while executing the /joke command:', error);
                await interaction.reply({ 
                    content: jokeConfig.messages.unexpected_error,
                    ephemeral: true 
                });
            }
        }
    },
};