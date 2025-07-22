const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const dbPath = path.join(__dirname, '../../database.json');

function readDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
    }
    try {
        const data = fs.readFileSync(dbPath);
        return JSON.parse(data);
    } catch (err) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
        return {};
    }
}

module.exports = {
    category: 'Development',
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the top 10 richest members on the server!'),
    async execute(interaction) {
        const config = interaction.client.config.commands.leaderboard || {};
        const messages = config.messages || {};
        const db = readDB();
        
        const users = Object.entries(db);
        users.sort(([, balanceA], [, balanceB]) => balanceB - balanceA);
        const top10 = users.slice(0, 10);

        const embed = new EmbedBuilder()
            .setTitle(messages.title || '👑 Top 10 Richest Members 👑')
            .setColor(config.color || 0xffd700)
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        if (top10.length === 0) {
            embed.setDescription(messages.no_members || 'It looks like there are no members with money yet!');
        } else {
            let description = '';
            for (let i = 0; i < top10.length; i++) {
                const [userId, balance] = top10[i];
                const user = await interaction.client.users.fetch(userId).catch(() => null);
                const username = user ? user.username : `Unknown User (${userId})`;
                description += `**#${i + 1}** ${username}: **💵 ${balance}**\n`;
            }
            embed.setDescription(description);
        }

        await interaction.reply({ embeds: [embed] });
    }
};