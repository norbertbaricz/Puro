const fs = require('fs');
const path = require('path');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

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

function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function getOreEmoji(oreName) {
    // This part remains hardcoded as it's visual logic, not text configuration
    switch (oreName) {
        case 'Emerald': return '💚';
        case 'Ruby': return '❤️';
        case 'Diamond': return '💎';
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
        const config = interaction.client.config.commands.work || {};
        const messages = config.messages || {};
        const userId = interaction.user.id;
        let db = readDB();

        // Ores logic remains in the command file as it's core game logic, not simple configuration
        const ores = [
            { name: 'Emerald', value: 1200, chance: 2 },
            { name: 'Ruby', value: 900, chance: 3 },
            { name: 'Diamond', value: 500, chance: 5 },
            { name: 'Gold', value: 300, chance: 8 },
            { name: 'Silver', value: 150, chance: 12 },
            { name: 'Sapphire', value: 700, chance: 3 },
            { name: 'Amethyst', value: 400, chance: 5 },
            { name: 'Copper', value: 80, chance: 10 },
            { name: 'Coal', value: 50, chance: 20 },
            { name: 'Stone', value: 10, chance: 15 },
            { name: 'Nothing', value: 0, chance: 12 },
            { name: 'Loss', value: -100, chance: 5 }
        ];

        function pickOre() {
            const totalChance = ores.reduce((sum, ore) => sum + ore.chance, 0);
            let rand = Math.random() * totalChance;
            for (const ore of ores) {
                if (rand < ore.chance) return ore;
                rand -= ore.chance;
            }
            return ores.find(o => o.name === 'Nothing');
        }

        const ore = pickOre();

        if (!db[userId]) db[userId] = 0;
        
        db[userId] += ore.value;
        
        if (db[userId] < 0) db[userId] = 0;

        writeDB(db);

        const embed = new EmbedBuilder()
            .setTitle(messages.title || '⛏️ Mining Session Report')
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        if (ore.value > 0) {
            embed
                .setColor(config.color_success || 0x2ecc71)
                .setDescription(messages.success_desc || 'Congratulations on your find!')
                .addFields(
                    { name: messages.field_ore || 'Ore Found', value: `${getOreEmoji(ore.name)} ${ore.name}`, inline: true },
                    { name: messages.field_value || 'Value', value: `**+$${ore.value}**`, inline: true }
                );
        } else if (ore.value === 0) {
            embed
                .setColor(config.color_neutral || 0xf1c40f)
                .setDescription(messages.neutral_desc || 'You found nothing of value.')
                .addFields(
                    { name: messages.field_result || 'Result', value: 'Found nothing', inline: true }
                );
        } else {
            embed
                .setColor(config.color_loss || 0xe74c3c)
                .setDescription(messages.loss_desc || 'Your trip resulted in a loss.')
                .addFields(
                    { name: messages.field_incident || 'Incident', value: messages.incident_text || 'Mining accident', inline: true },
                    { name: messages.field_value || 'Value', value: `**-$${Math.abs(ore.value)}**`, inline: true }
                );
        }

        await interaction.reply({ embeds: [embed] });
    }
};