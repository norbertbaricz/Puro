const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('marry')
        .setDescription('Propose marriage to another member!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to marry')
                .setRequired(true)),
    async execute(interaction) {
        const proposer = interaction.user;
        const target = interaction.options.getUser('member');
        const config = interaction.client.config;
        const marryConfig = config.commands.marry;

        if (proposer.id === target.id) {
            return interaction.reply({ content: marryConfig.messages.self_marry, ephemeral: true });
        }

        const responses = marryConfig.messages.responses;
        const randomResponse = responses[Math.floor(Math.random() * responses.length)]
            .replace('{proposer}', proposer.username)
            .replace('{target}', target.username);

        const embed = new EmbedBuilder()
            .setColor(marryConfig.color)
            .setTitle(marryConfig.messages.title)
            .setDescription(randomResponse)
            .setThumbnail(target.displayAvatarURL())
            .setFooter({ text: `Proposal by ${proposer.tag}`, iconURL: proposer.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};