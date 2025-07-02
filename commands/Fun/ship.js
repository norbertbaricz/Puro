const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Ship yourself with another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to ship with')
                .setRequired(true)),
    async execute(interaction) {
        const user1 = interaction.user;
        const user2 = interaction.options.getUser('member');
        const config = interaction.client.config;
        const shipConfig = config.commands.ship;

        if (user1.id === user2.id) {
            return interaction.reply({ content: shipConfig.messages.self_ship, ephemeral: true });
        }

        // Generate a random compatibility percentage
        const percentage = Math.floor(Math.random() * 101);

        // Generate a "ship name" from usernames
        const shipName = user1.username.slice(0, Math.ceil(user1.username.length / 2)) +
                         user2.username.slice(Math.floor(user2.username.length / 2));

        // Choose an emoji based on the percentage
        let emoji = '💔';
        if (percentage > 80) emoji = '💖';
        else if (percentage > 60) emoji = '❤️';
        else if (percentage > 40) emoji = '💛';
        else if (percentage > 20) emoji = '💙';

        const embed = new EmbedBuilder()
            .setColor(shipConfig.color)
            .setTitle(shipConfig.messages.title)
            .setDescription(
                shipConfig.messages.description
                    .replace('{emoji}', emoji)
                    .replace('{user1}', user1.username)
                    .replace('{user2}', user2.username)
                    .replace('{shipName}', shipName)
                    .replace('{percentage}', percentage)
            )
            .setThumbnail(user2.displayAvatarURL())
            .setFooter({ text: `Requested by ${user1.tag}`, iconURL: user1.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};