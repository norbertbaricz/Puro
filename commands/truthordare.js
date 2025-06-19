const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('truthordare')
        .setDescription('Get a random truth or dare!'),
    async execute(interaction) {
        const config = interaction.client.config;
        const todConfig = config.commands.truthordare;

        const isTruth = Math.random() < 0.5;
        const prompt = isTruth
            ? todConfig.truths[Math.floor(Math.random() * todConfig.truths.length)]
            : todConfig.dares[Math.floor(Math.random() * todConfig.dares.length)];

        const embed = new EmbedBuilder()
            .setColor(isTruth ? todConfig.color_truth : todConfig.color_dare)
            .setTitle(isTruth ? todConfig.messages.truth_title : todConfig.messages.dare_title)
            .setDescription(prompt)
            .setFooter({ text: todConfig.messages.footer.replace('{user}', interaction.user.tag), iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};