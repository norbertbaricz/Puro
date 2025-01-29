const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load the config.yml file with error handling
let config;
try {
    config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
} catch (error) {
    config = { commands: {}, colors: { default: '#FFD700' } }; // Fallback config with gold color
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('flip')
        .setDescription('Flip a coin')
        .addIntegerOption(option =>
            option.setName('flips')
                .setDescription('Number of coins to flip (max 10)')
                .setMinValue(1)
                .setMaxValue(10)
                .setRequired(false)),

    async execute(interaction) {
        try {
            const flips = interaction.options.getInteger('flips') || 1;
            const results = [];
            let heads = 0;
            let tails = 0;

            for (let i = 0; i < flips; i++) {
                const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
                results.push(result);
                result === 'Heads' ? heads++ : tails++;
            }

            const emoji = {
                'Heads': '🌕', // Full moon for heads
                'Tails': '🌑'  // New moon for tails
            };

            const resultString = results.map(r => `${emoji[r]} ${r}`).join('\n');
            
            const embed = new EmbedBuilder()
                .setColor(config.commands?.coinflip || config.colors?.default || '#FFD700')
                .setTitle(`🎲 Coin Flip ${flips > 1 ? 'Results' : 'Result'}`)
                .setDescription(resultString)
                .setTimestamp();

            if (flips > 1) {
                embed.addFields(
                    { name: 'Statistics', value: `Heads: ${heads} (${((heads/flips)*100).toFixed(1)}%)\nTails: ${tails} (${((tails/flips)*100).toFixed(1)}%)`, inline: true }
                );
            }

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            await interaction.reply({ 
                content: '❌ There was an error flipping the coin!', 
                ephemeral: true 
            }).catch(console.error);
        }
    },
};
