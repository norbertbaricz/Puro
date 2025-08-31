const fs = require('fs');
const path = require('path');
const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// --- Database Functions ---
// It's good practice to keep these, but for larger bots, consider a more robust database like SQLite or a database service.
const dbPath = path.join(__dirname, '../../database.json');

/**
 * Reads the database file. Creates one if it doesn't exist.
 * @returns {object} The parsed database object.
 */
function readDB() {
    // Check if the database file exists, if not, create an empty one.
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
        return {};
    }
    try {
        // Read and parse the database file.
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading or parsing database.json:", err);
        // If parsing fails, reset the database to prevent crashes.
        fs.writeFileSync(dbPath, JSON.stringify({}));
        return {};
    }
}

/**
 * Writes data to the database file.
 * @param {object} data The data to write to the database.
 */
function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

/**
 * Returns a corresponding emoji for a given ore name.
 * @param {string} oreName The name of the ore.
 * @returns {string} An emoji representation.
 */
function getOreEmoji(oreName) {
    const emojis = {
        // Precious Gems
        'Emerald': '💚',
        'Ruby': '❤️',
        'Diamond': '💎',
        'Sapphire': '🔵',
        'Amethyst': '🟣',
        'Topaz': '🧡',
        'Garnet': '❤️‍🔥',
        // Precious Metals
        'Platinum': '🪙',
        'Gold': '🟡',
        'Silver': '⚪',
        // Industrial & Common
        'Titanium': '🔩',
        'Uranium': '☢️',
        'Copper': '🟠',
        'Coal': '⚫',
        'Quartz': '🔮',
        'Obsidian': '✨',
        'Stone': '🪨',
        // Special
        'Fools Gold': '🤡',
        'Nothing': '💨',
        'Loss': '💥'
    };
    return emojis[oreName] || '❔';
}

module.exports = {
    category: 'Development', // Changed category to be more specific
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Go mining for valuable ores and gems!')
        .addStringOption(option =>
            option.setName('risk')
                .setDescription('Choose your risk level')
                .addChoices(
                    { name: 'Safe (lower rewards)', value: 'safe' },
                    { name: 'Normal', value: 'normal' },
                    { name: 'Risky (higher rewards)', value: 'risky' }
                )
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you')
                .setRequired(false)
        ),
    async execute(interaction) {
        const userId = interaction.user.id;
        let db = readDB();

        const workCfg = interaction.client.config.commands?.work || {};
        const cooldownSeconds = Number(workCfg.cooldown_seconds) || 60;
        const isPrivate = interaction.options.getBoolean('private') || false;
        const risk = interaction.options.getString('risk') || 'normal';

        // Simple in-memory cooldown map
        if (!global.__workCooldowns) global.__workCooldowns = new Map();
        const now = Date.now();
        const last = global.__workCooldowns.get(userId) || 0;
        const remainingMs = last + cooldownSeconds * 1000 - now;
        if (remainingMs > 0) {
            const remaining = Math.ceil(remainingMs / 1000);
            return interaction.reply({ content: `⏳ You are tired. Try again in ${remaining}s.`, flags: MessageFlags.Ephemeral });
        }
        global.__workCooldowns.set(userId, now);

        if (isPrivate) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } else {
            await interaction.deferReply();
        }

        // --- Expanded Ore & Event List ---
        // This list is now more diverse, with varying chances and values for a more dynamic experience.
        const outcomes = [
            // Rarest & Most Valuable
            { name: 'Uranium', value: 2500, chance: 1 },
            { name: 'Platinum', value: 1800, chance: 2 },
            { name: 'Emerald', value: 1200, chance: 3 },
            { name: 'Ruby', value: 900, chance: 4 },
            // Rare & Valuable
            { name: 'Diamond', value: 750, chance: 5 },
            { name: 'Sapphire', value: 700, chance: 5 },
            { name: 'Titanium', value: 500, chance: 6 },
            { name: 'Amethyst', value: 400, chance: 7 },
            { name: 'Gold', value: 300, chance: 10 },
            // Uncommon
            { name: 'Topaz', value: 220, chance: 8 },
            { name: 'Garnet', value: 180, chance: 8 },
            { name: 'Silver', value: 150, chance: 12 },
            // Common
            { name: 'Copper', value: 80, chance: 15 },
            { name: 'Obsidian', value: 60, chance: 15 },
            { name: 'Coal', value: 50, chance: 20 },
            { name: 'Quartz', value: 30, chance: 18 },
            { name: 'Stone', value: 10, chance: 25 },
            // Neutral / Negative
            { name: 'Fools Gold', value: 5, chance: 10 },
            { name: 'Nothing', value: 0, chance: 15 },
            { name: 'Loss', value: -100, chance: 5 } // e.g., tool breaking
        ];

        /**
         * Picks a random outcome based on weighted chances.
         * @returns {object} The chosen ore/event object.
         */
        function pickOutcome() {
            const totalChance = outcomes.reduce((sum, ore) => sum + ore.chance, 0);
            let randomValue = Math.random() * totalChance;

            for (const outcome of outcomes) {
                if (randomValue < outcome.chance) {
                    return outcome;
                }
                randomValue -= outcome.chance;
            }
            // Fallback in case of rounding errors
            return outcomes.find(o => o.name === 'Nothing');
        }

        let result = pickOutcome();

        // Adjust based on risk
        const risky = risk === 'risky';
        const safe = risk === 'safe';
        if (risky) {
            if (result.value > 0) result = { ...result, value: Math.round(result.value * 1.5) };
            else if (result.name === 'Loss') result = { ...result, value: Math.round(result.value * 1.5) };
        } else if (safe) {
            if (result.value > 0) result = { ...result, value: Math.max(1, Math.round(result.value * 0.75)) };
            else if (result.name === 'Loss') result = { ...result, value: Math.round(result.value * 0.5) };
        }

        // Initialize user in DB if they don't exist.
        if (!db[userId]) {
            db[userId] = { balance: 0 };
        }
        
        // Ensure balance property exists for older users
        if (typeof db[userId] !== 'object' || db[userId] === null) {
             // Convert old format (just a number) to the new object format
            db[userId] = { balance: db[userId] || 0 };
        }


        // Update balance
        db[userId].balance += result.value;

        // Prevent balance from going negative
        if (db[userId].balance < 0) {
            db[userId].balance = 0;
        }

        writeDB(db);

        const newBalance = db[userId].balance;

        // --- Enhanced Embed Logic ---
        const embed = new EmbedBuilder()
            .setAuthor({ name: `${interaction.user.username}'s Mining Trip`, iconURL: interaction.user.displayAvatarURL() })
            .setFooter({ text: 'Mine, mine, mine!' })
            .setTimestamp();

        if (result.value > 0) {
            // SUCCESS EMBED
            embed
                .setColor(0x57F287) // Vibrant Green
                .setTitle('⛏️ Jackpot! A Precious Find!')
                .setDescription('Your perseverance paid off! You struck a rich vein and unearthed something valuable.')
                .addFields(
                    { name: 'Material Found', value: `${getOreEmoji(result.name)} **${result.name}**`, inline: true },
                    { name: 'Market Value', value: `\`+$${result.value.toLocaleString()}\``, inline: true },
                    { name: 'New Balance', value: `💰 **$${newBalance.toLocaleString()}**`, inline: true },
                    { name: 'Risk', value: `\`${risk}\``, inline: true }
                );
        } else if (result.value === 0) {
            // NEUTRAL EMBED
            embed
                .setColor(0xFEE75C) // Yellow
                .setTitle('Dusty Pockets')
                .setDescription("It was a long day of hard work, but you came back with empty hands. The mountain keeps its secrets for now.")
                .addFields(
                    { name: 'Result', value: `${getOreEmoji(result.name)} Found nothing of value`, inline: true },
                    { name: 'New Balance', value: `💰 **$${newBalance.toLocaleString()}**`, inline: true },
                    { name: 'Risk', value: `\`${risk}\``, inline: true }
                );
        } else {
            // LOSS EMBED
            embed
                .setColor(0xED4245) // Red
                .setTitle('💥 Mining Accident!')
                .setDescription("Disaster! A tunnel collapsed and you had to make a quick escape, losing some equipment in the process.")
                .addFields(
                    { name: 'Incident', value: `${getOreEmoji(result.name)} Cave-in`, inline: true },
                    { name: 'Damages', value: `\`-$${Math.abs(result.value).toLocaleString()}\``, inline: true },
                    { name: 'New Balance', value: `💰 **$${newBalance.toLocaleString()}**`, inline: true },
                    { name: 'Risk', value: `\`${risk}\``, inline: true }
                );
        }

        // Double-or-nothing option for positive results
        if (result.value > 0) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('work_double').setLabel('Double or nothing').setStyle(ButtonStyle.Primary).setEmoji('🎲'),
                new ButtonBuilder().setCustomId('work_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );
            await interaction.editReply({ embeds: [embed], components: [row] });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 30000 });
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'work_close') {
                    collector.stop('closed');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                    return;
                }
                if (i.customId === 'work_double') {
                    collector.stop('rolled');
                    // 50/50 outcome: win -> +result.value; lose -> -result.value (reverts the win)
                    const win = Math.random() < 0.5;
                    const db2 = readDB();
                    if (!db2[userId] || typeof db2[userId] !== 'object') db2[userId] = { balance: 0 };
                    if (win) {
                        db2[userId].balance += result.value;
                        writeDB(db2);
                        const updated = EmbedBuilder.from(embed)
                            .setTitle('🎉 Double!')
                            .setDescription('Fortune favors the bold. Your find has doubled!')
                            .setColor(0x57F287);
                        updated.spliceFields(2, 1, { name: 'New Balance', value: `💰 **$${db2[userId].balance.toLocaleString()}**`, inline: true });
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await i.update({ embeds: [updated], components: [disabled] });
                    } else {
                        db2[userId].balance = Math.max(0, db2[userId].balance - result.value);
                        writeDB(db2);
                        const updated = EmbedBuilder.from(embed)
                            .setTitle('💀 Nothing!')
                            .setDescription('The gamble failed. You lost the find from this trip.')
                            .setColor(0xED4245);
                        updated.spliceFields(2, 1, { name: 'New Balance', value: `💰 **$${db2[userId].balance.toLocaleString()}**`, inline: true });
                        const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                        await i.update({ embeds: [updated], components: [disabled] });
                    }
                    return;
                }
            });
            collector.on('end', async (_c, reason) => {
                if (reason === 'time') {
                    const disabled = new ActionRowBuilder().addComponents(
                        [
                            new ButtonBuilder().setCustomId('work_double').setLabel('Double or nothing').setStyle(ButtonStyle.Primary).setEmoji('🎲').setDisabled(true),
                            new ButtonBuilder().setCustomId('work_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️').setDisabled(true)
                        ]
                    );
                    await interaction.editReply({ components: [disabled] }).catch(() => {});
                }
            });
        } else {
            await interaction.editReply({ embeds: [embed], components: [] });
        }
    }
};
