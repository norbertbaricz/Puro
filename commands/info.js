const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Load the config.yml file
const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('This command will tell you the information about our discord bot'),

    async execute(interaction) {
        const botAvatar = interaction.client.user.displayAvatarURL();
        const guilds = interaction.client.guilds.cache;
        let totalGuilds = guilds.size;
        let totalMembers = guilds.reduce((total, guild) => total + guild.memberCount, 0);

        const uptime = process.uptime();
        const days = Math.floor(uptime / (3600 * 24));
        const hours = Math.floor((uptime % (3600 * 24)) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);

        const latency = interaction.client.ws.ping;

        const embed = new EmbedBuilder()
            .setColor(config.commands.info || config.colors.default)
            .setTitle('Bot Information:')
            .setThumbnail(botAvatar)
            .addFields(
                { name: '> Creator', value: '*MaxWasTaked (Aka MAX)*', inline: true },
                { name: '> Creation Date', value: '*10.05.2024*', inline: true },
                { name: '> Registered Commands', value: `*${interaction.client.commands.size}*`, inline: true },
                { name: '> Guilds', value: `*${totalGuilds}*`, inline: true },
                { name: '> Total Members', value: `*${totalMembers}*`, inline: true },
                { name: '> Uptime', value: `*${days}d ${hours}h ${minutes}m*`, inline: true },
                { name: '> Average Latency', value: `*${latency}ms*`, inline: true },
            );

        await interaction.reply({ embeds: [embed] });
    },
};
