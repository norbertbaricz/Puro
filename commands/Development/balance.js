const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

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
    category: 'Development',
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription("Check your or another member's wallet balance!")
        .addUserOption(option =>
            option.setName('member')
                .setDescription("The member whose balance you want to check")
                .setRequired(false)) // Optional, defaults to the command user
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you')
                .setRequired(false)
        ),
    async execute(interaction) {
        const isPrivate = interaction.options.getBoolean('private') || false;
        const targetUser = interaction.options.getUser('member') || interaction.user;
        const conf = interaction.client.config.commands.balance || {};

        if (isPrivate) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        } else {
            await interaction.deferReply();
        }

        const render = async () => {
            const db = readDB();
            const balance = db[targetUser.id]?.balance || 0;
            const color = conf.color || 0x2ECC71;
            const title = conf.messages?.title || '💰 Wallet Balance Inquiry';
            const descSelf = conf.messages?.description_self || 'Here is your current wallet balance:';
            const descOther = conf.messages?.description_other || 'Here is the wallet balance for {user}:';
            const fieldUser = conf.messages?.field_user || 'User';
            const fieldBalance = conf.messages?.field_balance || 'Balance';

            const embed = new EmbedBuilder()
                .setColor(color)
                .setTitle(title)
                .setDescription((targetUser.id === interaction.user.id ? descSelf : descOther).replace('{user}', `${targetUser}`))
                .addFields(
                    { name: fieldUser, value: `${targetUser}`, inline: true },
                    { name: fieldBalance, value: `\`$${balance.toLocaleString()}\``, inline: true }
                )
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setFooter({ text: 'Puro Bank | Official Statement' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bal_refresh').setLabel('Refresh').setStyle(ButtonStyle.Secondary).setEmoji('🔁'),
                new ButtonBuilder().setCustomId('bal_tips').setLabel('How to earn?').setStyle(ButtonStyle.Primary).setEmoji('💡'),
                new ButtonBuilder().setCustomId('bal_close').setLabel('Close').setStyle(ButtonStyle.Danger).setEmoji('🗑️')
            );

            await interaction.editReply({ embeds: [embed], components: [row] });

            const msg = await interaction.fetchReply();
            const collector = msg.createMessageComponentCollector({ time: 30000 });
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({ content: 'Only you can control your view.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'bal_close') {
                    collector.stop('closed');
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                    return;
                }
                if (i.customId === 'bal_refresh') {
                    await i.deferUpdate();
                    await render();
                    return;
                }
                if (i.customId === 'bal_tips') {
                    await i.reply({ content: 'Try /work to earn, /pay to transfer, and /leaderboard to see the richest!', flags: MessageFlags.Ephemeral });
                    return;
                }
            });

            collector.on('end', async (c, reason) => {
                if (reason === 'time') {
                    const disabled = new ActionRowBuilder().addComponents(row.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await interaction.editReply({ components: [disabled] }).catch(() => {});
                }
            });
        };

        await render();
    }
};
