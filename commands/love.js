const { SlashCommandBuilder } = require('discord.js');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('love')
        .setDescription('This command can show you how much you love a person!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('The user to express love to')),

    async execute(interaction) {
        const user = interaction.options.getMember('user') || interaction.member;

        if (!user) {
            return interaction.reply({ content: 'User not found.', ephemeral: true });
        }

        const lovePercentage = Math.floor(Math.random() * 101);

        const embed = new EmbedBuilder()
            .setColor(config.commands.love || config.colors.default)
            .setTitle('Love Compatibility')
            .setDescription(`# Love compatibility between ${interaction.member} and ${user} is ${lovePercentage}% ❤️`);

        await interaction.reply({ embeds: [embed] });
    },
};
