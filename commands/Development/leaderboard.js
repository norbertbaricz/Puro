const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// --- Database Functions ---
const dbPath = path.join(__dirname, '../../database.json');

/**
 * Reads the database file. Creates one if it doesn't exist.
 * Handles empty or corrupted JSON files gracefully.
 * @returns {object} The parsed database object.
 */
function readDB() {
    // If the database file doesn't exist, create it with an empty JSON object.
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
        return {};
    }
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        
        // FIX: If the file is empty or just contains whitespace,
        // return an empty object to prevent a parsing error.
        if (data.trim() === '') {
            return {};
        }
        
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading or parsing database.json:", err);
        
        // FIX: If the file is corrupted, overwrite it with a valid empty JSON object
        // to prevent the error on subsequent commands, then return an empty object.
        fs.writeFileSync(dbPath, JSON.stringify({}));
        return {};
    }
}

module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Displays the global top 10 richest members!'), // <-- Aici am făcut modificarea
    async execute(interaction) {
        const db = readDB();
        
        // --- Data Processing ---
        // 1. Get all user entries from the database object.
        // 2. Filter out any malformed entries that don't have a balance.
        // 3. Sort users by their balance in descending order.
        const sortedUsers = Object.entries(db)
            .filter(([, data]) => data && typeof data.balance === 'number')
            .sort(([, dataA], [, dataB]) => dataB.balance - dataA.balance);

        // 4. Get the top 10 users from the sorted list.
        const top10 = sortedUsers.slice(0, 10);

        // --- Embed Creation ---
        const embed = new EmbedBuilder()
            .setTitle('🏆 Global Top 10 Richest 🏆') // Am actualizat și titlul
            .setColor(0xFFD700) // Gold color
            .setTimestamp()
            .setFooter({ text: 'Who will be the next millionaire?' });

        if (top10.length === 0) {
            embed.setDescription('🏜️ The leaderboard is empty. Start working to get on the board!');
        } else {
            // Fetch user objects for all top 10 users at once for efficiency
            const userPromises = top10.map(([userId]) => 
                interaction.client.users.fetch(userId).catch(() => ({ id: userId, username: 'Unknown User' }))
            );
            const users = await Promise.all(userPromises);

            // Map ranks to medal emojis
            const medals = ['🥇', '🥈', '🥉'];

            // Build the description string
            const leaderboardString = users.map((user, index) => {
                const [, data] = top10[index];
                const rank = index + 1;
                const medal = medals[index] || `**#${rank}**`; // Use medals for top 3, numbers for the rest
                const balance = data.balance.toLocaleString(); // Format number with commas
                
                return `${medal} **${user.username}** - \`$${balance}\``;
            }).join('\n');
            
            embed.setDescription(leaderboardString);
        }

        await interaction.reply({ embeds: [embed] });
    }
};
