const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('divorce')
        .setDescription('Role-play a divorce with another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to divorce')
                .setRequired(true)),
    async execute(interaction) {
        const initiator = interaction.user;
        const target = interaction.options.getUser('member');
        const config = interaction.client.config;
        const divorceConfig = config.commands.divorce;

        if (initiator.id === target.id) {
            return interaction.reply({ content: divorceConfig.messages.self_divorce, ephemeral: true });
        }

        const responses = divorceConfig.messages.responses;
        const randomResponse = responses[Math.floor(Math.random() * responses.length)]
            .replace('{initiator}', initiator.username)
            .replace('{target}', target.username);

        const embed = new EmbedBuilder()
            .setColor(divorceConfig.color)
            .setTitle(divorceConfig.messages.title)
            .setDescription(randomResponse)
            .setThumbnail(target.displayAvatarURL())
            .setFooter({ text: `Divorce initiated by ${initiator.tag}`, iconURL: initiator.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};