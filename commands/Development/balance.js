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
        const config = interaction.client.config.commands.balance || {};
        const messages = config.messages || {};
        const db = readDB();
        
        const target = interaction.options.getUser('member') || interaction.user;
        const balance = db[target.id] || 0;

        const embed = new EmbedBuilder()
            .setTitle(messages.title || '💰 Wallet Balance Inquiry')
            .setColor(config.color || 0x3498db)
            .setFooter({ text: `Requested by ${interaction.user.username}` })
            .setTimestamp();

        if (target.id === interaction.user.id) {
            embed.setDescription(messages.description_self || 'Here is your current wallet balance:')
                 .addFields(
                     { name: messages.field_user || 'User', value: `${target.username}`, inline: true },
                     { name: messages.field_balance || 'Balance', value: `**💵 $${balance}**`, inline: true }
                 );
        } else {
            embed.setDescription((messages.description_other || 'Here is the wallet balance for {user}:').replace('{user}', target.username))
                 .addFields(
                     { name: messages.field_user || 'User', value: `${target.username}`, inline: true },
                     { name: messages.field_balance || 'Balance', value: `**💵 $${balance}**`, inline: true }
                 );
        }

        await interaction.reply({ embeds: [embed] });
    }
};