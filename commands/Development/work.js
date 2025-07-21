const fs = require('fs');
const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const dbPath = path.join(__dirname, '../../database.json');

// Function to read the database
function readDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
    }
    try {
        const data = fs.readFileSync(dbPath);
        return JSON.parse(data);
    } catch (err) {
        // If the file is empty or corrupt, rewrite it
        fs.writeFileSync(dbPath, JSON.stringify({}));
        return {};
    }
}

// Function to write to the database
function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Helper function to get an emoji for each ore
function getOreEmoji(oreName) {
    switch (oreName) {
        case 'Emerald': return '💚';
        case 'Ruby': return '❤️';
        case 'Diamond': return '💎'; // Corrected emoji for Diamond
        case 'Gold': return '🟡';
        case 'Silver': return '⚪';
        case 'Sapphire': return '🔵';
        case 'Amethyst': return '🟣';
        case 'Copper': return '🟠';
        case 'Coal': return '⚫';
        case 'Stone': return '🪨';
        default: return '❔';
    }
}

module.exports = {
    category: 'Development',
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Go mining for ores and earn money!'),
    async execute(interaction) {
        const userId = interaction.user.id;
        let db = readDB();

        // Ores and their values with rarity (chance out of 100)
        const ores = [
            { name: 'Emerald', value: 1200, chance: 2 },     // Very rare
            { name: 'Ruby', value: 900, chance: 3 },         // Very rare
            { name: 'Diamond', value: 500, chance: 5 },      // Rare
            { name: 'Gold', value: 300, chance: 8 },         // Uncommon
            { name: 'Silver', value: 150, chance: 12 },      // Uncommon
            { name: 'Sapphire', value: 700, chance: 3 },     // Very rare
            { name: 'Amethyst', value: 400, chance: 5 },     // Rare
            { name: 'Copper', value: 80, chance: 10 },       // Common
            { name: 'Coal', value: 50, chance: 20 },         // Common
            { name: 'Stone', value: 10, chance: 15 },        // Very common
            { name: 'Nothing', value: 0, chance: 12 },       // Fail
            { name: 'Loss', value: -100, chance: 5 }         // Bad luck
        ];

        // Function to pick a random ore based on its chance
        function pickOre() {
            const totalChance = ores.reduce((sum, ore) => sum + ore.chance, 0);
            let rand = Math.random() * totalChance;
            for (const ore of ores) {
                if (rand < ore.chance) return ore;
                rand -= ore.chance;
            }
            return ores.find(o => o.name === 'Nothing'); // Fallback to 'Nothing'
        }

        const ore = pickOre();

        // Initialize user's balance if it doesn't exist
        if (!db[userId]) db[userId] = 0;
        
        // Update user's balance
        db[userId] += ore.value;
        
        // Ensure balance doesn't go below zero
        if (db[userId] < 0) db[userId] = 0;

        writeDB(db);

        const embed = new EmbedBuilder()
            .setTitle('⛏️ Mining Session Report')
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        if (ore.value > 0) {
            embed
                .setColor(0x2ecc71) // Green
                .setDescription('Congratulations on your find!')
                .addFields(
                    { name: 'Ore Found', value: `${getOreEmoji(ore.name)} ${ore.name}`, inline: true },
                    { name: 'Value', value: `**+$${ore.value}**`, inline: true }
                );
        } else if (ore.value === 0) {
            embed
                .setColor(0xf1c40f) // Yellow
                .setDescription('You searched but found nothing of value this time.')
                .addFields(
                    { name: 'Result', value: 'Found nothing', inline: true }
                );
        } else { // Loss
            embed
                .setColor(0xe74c3c) // Red
                .setDescription('Oh no! Your mining trip resulted in a loss.')
                .addFields(
                    { name: 'Incident', value: 'Mining accident', inline: true },
                    { name: 'Value', value: `**-$${Math.abs(ore.value)}**`, inline: true }
                );
        }

        await interaction.reply({ embeds: [embed] });
    }
};