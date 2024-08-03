const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Displays the avatar of the mentioned user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to show the avatar of')
                .setRequired(true)),
    
    async execute(interaction) {
        const user = interaction.options.getUser('user');

        if (!user) {
            return interaction.reply('User not found.');
        }

        const avatarUrl = user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 });

        const avatarEmbed = new EmbedBuilder()
            .setColor(config.commands.avatar || config.colors.default)
            .setTitle(`${user.username}'s Avatar`)
            .setImage(avatarUrl);

        await interaction.reply({ embeds: [avatarEmbed] });
    },
};