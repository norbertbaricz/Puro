const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file with error handling
let config;
try {
    config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
} catch (error) {
    config = { commands: {}, colors: { default: '#0099ff' } }; // Fallback config
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Displays the avatar of the mentioned user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to show the avatar of')
                .setRequired(true))
        .addBooleanOption(option =>
            option.setName('server')
                .setDescription('Show server-specific avatar if available')
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            const user = interaction.options.getUser('user');
            const showServerAvatar = interaction.options.getBoolean('server') ?? false;
            
            // Get member if server avatar is requested and in a guild
            const member = showServerAvatar && interaction.guild 
                ? interaction.guild.members.cache.get(user.id) 
                : null;

            const avatarUrl = member?.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 }) 
                || user.displayAvatarURL({ format: 'png', dynamic: true, size: 1024 });

            const avatarEmbed = new EmbedBuilder()
                .setColor(config.commands?.avatar || config.colors?.default || '#0099ff')
                .setTitle(`${user.username}'s ${showServerAvatar && member?.avatar ? 'Server ' : ''}Avatar`)
                .setImage(avatarUrl)
                .setFooter({ text: `Requested by ${interaction.user.username}` })
                .setTimestamp();

            await interaction.reply({ embeds: [avatarEmbed] });
        } catch (error) {
            await interaction.reply({ 
                content: 'There was an error while executing this command!', 
                ephemeral: true 
            }).catch(console.error);
        }
    },
};