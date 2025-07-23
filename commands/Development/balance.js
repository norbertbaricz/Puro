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
        .setName('balance')
        .setDescription("Check your or another member's wallet balance!")
        .addUserOption(option =>
            option.setName('member')
                .setDescription("The member whose balance you want to check")
                .setRequired(false) // Optional, defaults to the command user
        ),
    async execute(interaction) {
        const db = readDB();
        
        // Determine the target user: either the one specified in the option or the user who ran the command.
        const targetUser = interaction.options.getUser('member') || interaction.user;
        
        // Correctly retrieve the balance from the user's data object.
        const balance = db[targetUser.id]?.balance || 0;

        // --- New, Refined Embed Creation ---
        const embed = new EmbedBuilder()
            .setColor(0x2ECC71) // A rich, professional green
            .setAuthor({ name: `${targetUser.username}'s Bank Account`, iconURL: targetUser.displayAvatarURL() })
            .addFields(
                { 
                    name: 'Available Funds', 
                    // Using a 'diff' code block to make the text green and stand out
                    value: `\`\`\`diff\n+ $${balance.toLocaleString()}\`\`\`` 
                },
                {
                    name: 'Account Status',
                    value: '✅ Active',
                    inline: true
                },
                {
                    name: 'Account Holder',
                    // Mentioning the user makes it easy to click their profile
                    value: `<@${targetUser.id}>`,
                    inline: true
                }
            )
            .setTimestamp()
            .setFooter({ text: `Puro Bank | Official Statement` });

        await interaction.reply({ embeds: [embed] });
    }
};
