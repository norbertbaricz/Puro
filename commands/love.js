const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

function calculateLoveScore(user1Id, user2Id) {
    const seed = parseInt(user1Id) + parseInt(user2Id);
    return Math.abs(seed % 101);
}

function getLoveMessage(percentage, messages) {
    if (percentage === 100) return messages[100];
    if (percentage >= 90) return messages[90];
    if (percentage >= 70) return messages[70];
    if (percentage >= 50) return messages[50];
    if (percentage >= 30) return messages[30];
    if (percentage >= 10) return messages[10];
    return messages[0];
}

function generateLoveBar(percentage) {
    const filled = Math.round(percentage / 10);
    return '❤️'.repeat(filled) + '🖤'.repeat(10 - filled);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('love')
        .setDescription('Calculate love compatibility')
        .addUserOption(option =>
            option.setName('user1').setDescription('First user').setRequired(true))
        .addUserOption(option =>
            option.setName('user2').setDescription('Second user (you)').setRequired(false)),

    async execute(interaction) {
        const config = interaction.client.config.commands.love;
        try {
            const user1 = interaction.options.getUser('user1');
            const user2 = interaction.options.getUser('user2') || interaction.user;

            if (user1.id === user2.id) {
                return interaction.reply({ content: config.messages.self_love, ephemeral: true });
            }

            const lovePercentage = calculateLoveScore(user1.id, user2.id);
            const loveMessage = getLoveMessage(lovePercentage, config.messages.results);
            const loveBar = generateLoveBar(lovePercentage);

            const embed = new EmbedBuilder()
                .setColor(config.color)
                .setTitle('💘 Love Calculator')
                .addFields(
                    { name: '👥 Love Match', value: `${user1} 💕 ${user2}`, inline: false },
                    { name: '💝 Compatibility', value: `${lovePercentage}%\n${loveBar}`, inline: false },
                    { name: '💌 Love Reading', value: loveMessage, inline: false },
                    { 
                        name: '💡 Love Tip', 
                        value: config.messages.tips[Math.floor(Math.random() * config.messages.tips.length)], 
                        inline: false 
                    }
                )
                .setFooter({ text: 'True love > numbers!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error('Love error:', error);
            await interaction.reply({ content: config.messages.error, ephemeral: true });
        }
    },
};