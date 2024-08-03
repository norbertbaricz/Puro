const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tp')
        .setDescription('Teleport to another member in real life!')
        .addUserOption(option => option.setName('member').setDescription('The member to teleport to').setRequired(true)),

    async execute(interaction) {
        const memberToTeleport = interaction.options.getMember('member');

        if (!memberToTeleport) {
            return interaction.reply({ content: 'Member not found.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(config.commands.tp || config.colors.default)
            .setTitle('Teleportation Successful!')
            .setDescription(`# ${interaction.user} has been teleported to ${memberToTeleport} in real life!`);

        await interaction.reply({ embeds: [embed] });
    },
};
