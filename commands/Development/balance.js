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
    category: 'Development',
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your or another member\'s wallet balance!')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member whose balance you want to check')
        ),
    async execute(interaction) {
        const db = readDB();
        // Get the target user, or default to the user who ran the command
        const target = interaction.options.getUser('member') || interaction.user;
        const balance = db[target.id] || 0;

        const embed = new EmbedBuilder()
            .setTitle('💰 Wallet Balance Inquiry') // More descriptive title
            .setColor(0x3498db) // A nice blue color
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        // Check if the balance is for the command issuer or another member
        if (target.id === interaction.user.id) {
            embed.setDescription(`Here is your current wallet balance:`)
                 .addFields(
                     { name: 'User', value: `${target.username}`, inline: true }, // Changed to only display username
                     { name: 'Balance', value: `**💵 $${balance}**`, inline: true }
                 );
        } else {
            embed.setDescription(`Here is the wallet balance for ${target.username}:`)
                 .addFields(
                     { name: 'User', value: `${target.username}`, inline: true }, // Changed to only display username
                     { name: 'Balance', value: `**💵 $${balance}**`, inline: true }
                 );
        }

        await interaction.reply({ embeds: [embed] });
    }
};