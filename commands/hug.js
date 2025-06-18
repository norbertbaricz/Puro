const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hug')
        .setDescription('Give a virtual hug to another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to hug')
                .setRequired(true)),
    async execute(interaction) {
        const sender = interaction.user;
        const receiver = interaction.options.getUser('member');
        const config = interaction.client.config;
        const hugConfig = config.commands.hug;

        if (sender.id === receiver.id) {
            return interaction.reply({ content: hugConfig.messages.self_hug, ephemeral: true });
        }

        // Random hug GIFs
        const hugGifs = [
            'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif',
            'https://media.giphy.com/media/l2QDM9Jnim1YVILXa/giphy.gif',
            'https://media.giphy.com/media/143v0Z4767T15e/giphy.gif',
            'https://media.giphy.com/media/wnsgren9NtITS/giphy.gif'
        ];
        const randomGif = hugGifs[Math.floor(Math.random() * hugGifs.length)];

        const hugEmbed = new EmbedBuilder()
            .setColor(hugConfig.color)
            .setTitle(hugConfig.messages.success_title + ' 🤗')
            .setDescription(
                hugConfig.messages.success_desc
                    .replace('{sender}', `**${sender.username}**`)
                    .replace('{receiver}', `**${receiver.username}**`)
            )
            .setImage(randomGif)
            .setThumbnail(receiver.displayAvatarURL())
            .setFooter({ text: `Requested by ${sender.username}`, iconURL: sender.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [hugEmbed] });
    }
};