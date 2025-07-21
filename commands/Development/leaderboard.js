const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Path to the database file
const dbPath = path.join(__dirname, '../../database.json');

// Function to read the database
function readDB() {
    // Check if the file exists, if not, create an empty one
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
    }
    try {
        const data = fs.readFileSync(dbPath);
        return JSON.parse(data);
    } catch (err) {
        // If there is a reading error, overwrite with an empty object
        fs.writeFileSync(dbPath, JSON.stringify({}));
        return {};
    }
}

module.exports = {
    category: 'Development', // Changed from Economy to Development
    data: new SlashCommandBuilder()
        .setName('leaderboard') // Changed from 'top' to 'leaderboard'
        .setDescription('Displays the top 10 richest members on the server!'),
    async execute(interaction) {
        const db = readDB();
        
        // Convert the database object into an array of [userId, balance] pairs
        const users = Object.entries(db);

        // Sort users by their balance in descending order
        users.sort(([, balanceA], [, balanceB]) => balanceB - balanceA);

        // Get the top 10 users
        const top10 = users.slice(0, 10);

        const embed = new EmbedBuilder()
            .setTitle('👑 Top 10 Richest Members 👑')
            .setColor(0xffd700) // Gold color
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        if (top10.length === 0) {
            embed.setDescription('It looks like there are no members with money yet!');
        } else {
            let description = '';
            for (let i = 0; i < top10.length; i++) {
                const [userId, balance] = top10[i];
                // Fetch the user object to get their username
                const user = await interaction.client.users.fetch(userId).catch(() => null);
                const username = user ? user.username : `Unknown User (${userId})`;
                description += `**#${i + 1}** ${username}: **💵 ${balance}**\n`;
            }
            embed.setDescription(description);
        }

        await interaction.reply({ embeds: [embed] });
    }
};