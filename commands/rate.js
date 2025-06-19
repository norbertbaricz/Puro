const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rate')
        .setDescription('Rate anything out of 10!')
        .addStringOption(option =>
            option.setName('thing')
                .setDescription('What do you want me to rate?')
                .setRequired(true)),
    async execute(interaction) {
        const remaining = ratelimit(interaction.user.id, 5000);
        if (remaining) {
            return interaction.reply({ content: config.messages.cooldown.replace('{remaining}', remaining), ephemeral: true });
        }

        const config = interaction.client.config;
        const rateConfig = config.commands.rate;

        const thing = interaction.options.getString('thing');
        const rating = (Math.random() * 10).toFixed(1);

        const embed = new EmbedBuilder()
            .setColor(rateConfig.color)
            .setTitle(rateConfig.messages.title)
            .setDescription(
                rateConfig.messages.description
                    .replace('{thing}', thing)
                    .replace('{rating}', rating)
            )
            .setFooter({ text: `Requested by ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};