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
        const config = interaction.client.config.commands.pay || {};
        const messages = config.messages || {};
        const db = readDB();
        
        const sender = interaction.user;
        const receiver = interaction.options.getUser('member');
        const amount = interaction.options.getInteger('amount');

        if (!db[sender.id]) db[sender.id] = 0;

        const baseEmbed = new EmbedBuilder()
            .setFooter({ text: `Requested by ${sender.username}` })
            .setTimestamp();

        if (receiver.id === sender.id) {
            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle(messages.self_payment_title || '❌ Transaction Error: Self-Payment')
                        .setDescription(messages.self_payment_desc || 'You cannot send money to yourself.')
                        .setColor(config.color_error || 0xe74c3c)
                ],
                ephemeral: true
            });
        }

        if (amount <= 0) {
             return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle(messages.invalid_amount_title || '❌ Transaction Error: Invalid Amount')
                        .setDescription(messages.invalid_amount_desc || 'The amount must be a positive number.')
                        .setColor(config.color_error || 0xe74c3c)
                ],
                ephemeral: true
            });
        }

        if (db[sender.id] < amount) {
            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle(messages.insufficient_funds_title || '🏦 Transaction Error: Insufficient Funds')
                        .setDescription((messages.insufficient_funds_desc || 'You only have **💵 ${balance}**.').replace('{balance}', db[sender.id]).replace('{amount}', amount))
                        .setColor(config.color_error || 0xe74c3c)
                ],
                ephemeral: true
            });
        }

        if (Math.random() < 0.2) { // 20% chance to fail
            db[sender.id] -= amount;
            if (db[sender.id] < 0) db[sender.id] = 0;
            writeDB(db);

            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle(messages.hacked_title || '💀 Transaction Hacked! 💀')
                        .setDescription(messages.hacked_desc || 'Your transaction was intercepted!')
                        .addFields(
                            { name: messages.hacked_field_sender || 'Sender', value: `${sender.username}`, inline: true },
                            { name: messages.hacked_field_amount_lost || 'Amount Lost', value: `**-$${amount}**`, inline: true },
                            { name: messages.hacked_field_recipient || 'Recipient', value: `${receiver.username} (Did not receive funds)`, inline: true },
                            { name: messages.hacked_field_new_balance || 'Your New Balance', value: `💵 $${db[sender.id]}`, inline: false }
                        )
                        .setColor(config.color_hacked || 0x8e44ad)
                ]
            });
        }

        db[sender.id] -= amount;
        if (!db[receiver.id]) db[receiver.id] = 0;
        db[receiver.id] += amount;
        writeDB(db);

        await interaction.reply({
            embeds: [
                baseEmbed
                    .setTitle(messages.success_title || '✅ Transaction Successful! ✅')
                    .setDescription((messages.success_desc || 'You sent **💵 ${amount}** to {receiver}!').replace('{amount}', amount).replace('{receiver}', receiver.username))
                    .addFields(
                        { name: messages.success_field_sender || 'Sender', value: `${sender.username}`, inline: true },
                        { name: messages.success_field_recipient || 'Recipient', value: `${receiver.username}`, inline: true }
                    )
                    .setColor(config.color_success || 0x2ecc71)
            ]
        });
    }
};