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
    config = { commands: {}, colors: { default: '#FF69B4' } }; // Pink as fallback
}

// Love score calculation with seed for consistency
function calculateLoveScore(user1Id, user2Id) {
    const seed = (user1Id + user2Id).split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    const random = Math.sin(seed) * 10000;
    return Math.abs(Math.floor(random % 101));
}

// Get love message based on percentage
function getLoveMessage(percentage) {
    if (percentage === 100) return "Perfect match! 💘 True love at its finest!";
    if (percentage >= 90) return "Amazing chemistry! 💝 Love is definitely in the air!";
    if (percentage >= 70) return "Great potential! 💖 There's something special here!";
    if (percentage >= 50) return "There's definitely a spark! 💓 Worth exploring!";
    if (percentage >= 30) return "There's some attraction! 💗 Give it time!";
    if (percentage >= 10) return "Well... 💔 Maybe just be friends?";
    return "Oof... 💔 Time to look elsewhere!";
}

// Generate love bar
function generateLoveBar(percentage) {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return '❤️'.repeat(filled) + '🖤'.repeat(empty);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('love')
        .setDescription('Calculate the love compatibility between two users!')
        .addUserOption(option =>
            option.setName('user1')
                .setDescription('First user')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('user2')
                .setDescription('Second user (defaults to you)')
                .setRequired(false)),

    async execute(interaction) {
        try {
            const user1 = interaction.options.getUser('user1');
            const user2 = interaction.options.getUser('user2') || interaction.user;

            // Prevent self-love check
            if (user1.id === user2.id) {
                return interaction.reply({
                    content: "💝 Self-love is important, but let's check compatibility with others!",
                    ephemeral: true
                });
            }

            const lovePercentage = calculateLoveScore(user1.id, user2.id);
            const loveMessage = getLoveMessage(lovePercentage);
            const loveBar = generateLoveBar(lovePercentage);

            const embed = new EmbedBuilder()
                .setColor(config.commands?.love || config.colors?.default || '#FF69B4')
                .setTitle('💘 Love Calculator')
                .addFields(
                    { 
                        name: '👥 Love Match', 
                        value: `${user1} 💕 ${user2}`,
                        inline: false 
                    },
                    { 
                        name: '💝 Compatibility', 
                        value: `${lovePercentage}%\n${loveBar}`,
                        inline: false 
                    },
                    { 
                        name: '💌 Love Reading', 
                        value: loveMessage,
                        inline: false 
                    }
                )
                .setFooter({ 
                    text: 'Remember: True love is about more than just numbers!' 
                })
                .setTimestamp();

            // Add random love tips
            const loveTips = [
                "Tip: Communication is key! 🗣️",
                "Tip: Show appreciation daily! 🌟",
                "Tip: Respect each other's differences! 🤝",
                "Tip: Make time for each other! ⏰",
                "Tip: Keep the romance alive! 🌹"
            ];
            
            embed.addFields({
                name: '💡 Love Tip',
                value: loveTips[Math.floor(Math.random() * loveTips.length)],
                inline: false
            });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            await interaction.reply({ 
                content: '❌ An error occurred while calculating love compatibility!', 
                ephemeral: true 
            }).catch(console.error);
        }
    },
};
