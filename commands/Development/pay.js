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

// Function to write to the database
function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = {
    category: 'Development',
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Send money to another member!')
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

        // Initialize sender's balance if it doesn't exist
        if (!db[sender.id]) db[sender.id] = 0;

        // Base embed structure for consistent footer and timestamp
        const baseEmbed = new EmbedBuilder()
            .setFooter({ text: `Requested by ${sender.username}` })
            .setTimestamp();

        // Check if the user is trying to pay themselves
        if (receiver.id === sender.id) {
            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('❌ Transaction Error: Self-Payment')
                        .setDescription('You cannot send money to yourself. Please choose another member.')
                        .setColor(0xe74c3c) // Red for error
                ],
                ephemeral: true // Only visible to the user who ran the command
            });
        }

        // Check if the amount is valid
        if (amount <= 0) {
             return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('❌ Transaction Error: Invalid Amount')
                        .setDescription('The amount must be a positive number greater than 0.')
                        .setColor(0xe74c3c) // Red for error
                ],
                ephemeral: true
            });
        }

        // Check if the sender has enough funds
        if (db[sender.id] < amount) {
            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('🏦 Transaction Error: Insufficient Funds')
                        .setDescription(`You currently have **💵 $${db[sender.id]}**, which is not enough to send **💵 $${amount}**.`)
                        .setColor(0xe74c3c) // Red for error
                ],
                ephemeral: true
            });
        }

        // 20% chance for the transaction to fail (get "hacked")
        if (Math.random() < 0.2) {
            db[sender.id] -= amount;
            if (db[sender.id] < 0) db[sender.id] = 0; // Ensure the balance doesn't go negative
            writeDB(db);

            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('💀 Transaction Hacked! �')
                        .setDescription(`Oh no! Your transaction was intercepted by a rogue hacker!`)
                        .addFields(
                            { name: 'Sender', value: `${sender.username}`, inline: true },
                            { name: 'Amount Lost', value: `**-$${amount}**`, inline: true },
                            { name: 'Recipient', value: `${receiver.username} (Did not receive funds)`, inline: true },
                            { name: 'Your New Balance', value: `💵 $${db[sender.id]}`, inline: false }
                        )
                        .setColor(0x8e44ad) // A darker, more ominous color
                ]
            });
        }

        // Normal, successful transaction
        db[sender.id] -= amount;
        if (!db[receiver.id]) db[receiver.id] = 0; // Initialize receiver's account if it doesn't exist
        db[receiver.id] += amount;
        writeDB(db);

        await interaction.reply({
            embeds: [
                baseEmbed
                    .setTitle('✅ Transaction Successful! ✅')
                    .setDescription(`You have successfully transferred **💵 $${amount}** to ${receiver.username}!`) // Updated description
                    .addFields(
                        { name: 'Sender', value: `${sender.username}`, inline: true },
                        { name: 'Recipient', value: `${receiver.username}`, inline: true }
                        // Removed balance fields as requested
                    )
                    .setColor(0x2ecc71) // Green for success
            ]
        });
    }
};