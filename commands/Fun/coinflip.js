const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('Flip a coin')
        .addIntegerOption(option =>
            option.setName('flips').setDescription('Number of flips (max 10)').setMinValue(1).setMaxValue(10).setRequired(false)),

    async execute(interaction) {
        const config = interaction.client.config.commands.coinflip;
        try {
            const flips = Math.min(interaction.options.getInteger('flips') || 1, interaction.client.config.limits.flips);
            const results = Array(flips).fill().map(() => Math.random() < 0.5 ? 'Heads' : 'Tails');
            const heads = results.filter(r => r === 'Heads').length;
            const tails = flips - heads;

            const resultString = results.map(r => `${config.emojis[r.toLowerCase()]} ${r}`).join('\n');
            
            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle(`🎲 Coin Flip ${flips > 1 ? 'Results' : 'Result'}`)
                .setDescription(resultString)
                .setTimestamp();

            if (flips > 1) {
                embed.addFields({
                    name: 'Statistics',
                    value: `Heads: ${heads} (${((heads/flips)*100).toFixed(1)}%)\nTails: ${tails} (${((tails/flips)*100).toFixed(1)}%)`,
                    inline: true
                });
            }

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Coinflip error:', error);
            await interaction.reply({ content: config.messages.error, ephemeral: true });
        }
    },
};