const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// --- Database Functions ---
const dbPath = path.join(__dirname, '../../database.json');

/**
 * Reads the database file. Creates one if it doesn't exist.
 * @returns {object} The parsed database object.
 */
function readDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({}));
        return {};
    }
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading or parsing database.json:", err);
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
 * Ensures a user exists in the database with the correct object format.
 * @param {object} db The database object.
 * @param {string} userId The ID of the user to check.
 * @returns {object} The user's database entry.
 */
function ensureUser(db, userId) {
    if (!db[userId] || typeof db[userId] !== 'object' || db[userId] === null) {
        // If user doesn't exist, or is in the old format (just a number),
        // initialize them with the new object structure.
        db[userId] = { balance: db[userId] || 0 };
    }
    return db[userId];
}


module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Send money to another member (with taxes and risks!).')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to pay')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of money to send')
                .setRequired(true)
        ),
    async execute(interaction) {
        const db = readDB();
        
        const sender = interaction.user;
        const receiver = interaction.options.getUser('member');
        const amount = interaction.options.getInteger('amount');

        // --- Ensure users exist in the new DB format ---
        const senderData = ensureUser(db, sender.id);
        const receiverData = ensureUser(db, receiver.id);

        const baseEmbed = new EmbedBuilder()
            .setFooter({ text: `Transaction initiated by ${sender.username}` })
            .setTimestamp();

        // --- Input Validation ---
        if (receiver.id === sender.id) {
            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('❌ Transaction Failed: Self-Payment')
                        .setDescription('You cannot send money to yourself. Please choose another member.')
                        .setColor(0xED4245) // Red
                ],
                ephemeral: true
            });
        }
        
        if (receiver.bot) {
             return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('❌ Transaction Failed: Invalid Recipient')
                        .setDescription('You cannot send money to a bot.')
                        .setColor(0xED4245) // Red
                ],
                ephemeral: true
            });
        }

        if (amount <= 0) {
             return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('❌ Transaction Failed: Invalid Amount')
                        .setDescription('The amount must be a positive number greater than zero.')
                        .setColor(0xED4245) // Red
                ],
                ephemeral: true
            });
        }
        
        // --- Transaction Tax Logic ---
        const taxRate = 0.05; // 5% tax
        const taxAmount = Math.ceil(amount * taxRate);
        const totalDeduction = amount + taxAmount;

        if (senderData.balance < totalDeduction) {
            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('🏦 Transaction Failed: Insufficient Funds')
                        .setDescription(`You do not have enough money to complete this transaction.`)
                        .addFields(
                            { name: 'Your Balance', value: `💰 $${senderData.balance.toLocaleString()}`, inline: true },
                            { name: 'Required Amount', value: `💸 $${amount.toLocaleString()}`, inline: true },
                            { name: 'Transaction Tax (5%)', value: `🧾 $${taxAmount.toLocaleString()}`, inline: true },
                            { name: 'Total Needed', value: `🚨 **$${totalDeduction.toLocaleString()}**`, inline: false }
                        )
                        .setColor(0xFEE75C) // Yellow
                ],
                ephemeral: true
            });
        }
        
        // --- Random Negative Events ---
        const eventChance = Math.random();
        if (eventChance < 0.15) { // 15% chance for a negative event
            senderData.balance -= amount; // The sender still loses the original amount
            if (senderData.balance < 0) senderData.balance = 0;
            writeDB(db);

            const events = [
                {
                    title: '💀 Transaction Intercepted by Hackers! 💀',
                    description: 'A shadowy group of hackers intercepted the data packet! The money is gone.',
                    color: 0x9B59B6 // Purple
                },
                {
                    title: '🔌 Network Error: Packet Lost! 🔌',
                    description: 'A critical network failure occurred. Your transaction vanished into the digital void.',
                    color: 0x34495E // Dark Blue-Gray
                },
                {
                    title: '💸 Corrupt Financier Fee! 💸',
                    description: 'A corrupt banker skimmed your entire transaction off the top as a "processing fee".',
                    color: 0xA84300 // Dark Orange
                }
            ];
            const randomEvent = events[Math.floor(Math.random() * events.length)];

            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle(randomEvent.title)
                        .setDescription(randomEvent.description)
                        .addFields(
                            { name: 'Amount Lost', value: `**-$${amount.toLocaleString()}**`, inline: true },
                            { name: 'Recipient', value: `${receiver.username} (Received nothing)`, inline: true },
                            { name: 'Your New Balance', value: `💰 **$${senderData.balance.toLocaleString()}**`, inline: false }
                        )
                        .setColor(randomEvent.color)
                ]
            });
        }

        // --- Successful Transaction ---
        senderData.balance -= totalDeduction;
        receiverData.balance += amount;
        writeDB(db);

        await interaction.reply({
            embeds: [
                baseEmbed
                    .setTitle('✅ Transaction Successful! ✅')
                    .setDescription(`You successfully sent **$${amount.toLocaleString()}** to ${receiver.username}!`)
                    .addFields(
                        { name: 'Your New Balance', value: `💰 $${senderData.balance.toLocaleString()}`, inline: true },
                        { name: 'Recipient\'s New Balance', value: `💰 $${receiverData.balance.toLocaleString()}`, inline: true },
                        { name: 'Tax Paid (5%)', value: `🧾 $${taxAmount.toLocaleString()}`, inline: false }
                    )
                    .setColor(0x57F287) // Green
            ]
        });
    }
};
