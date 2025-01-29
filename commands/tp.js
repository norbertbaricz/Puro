const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load the config.yml file with error handling
let config;
try {
    config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
} catch (error) {
    config = { commands: {}, colors: { default: '#9B59B6' } }; // Purple as fallback
}

// Rate limiting
const userCooldowns = new Map();
const COOLDOWN_DURATION = 30000; // 30 seconds

// Teleport messages
const teleportMessages = [
    "🌟 *WHOOSH!* A magical portal opens...",
    "⚡ *ZAP!* Lightning fast teleportation...",
    "🌈 *POOF!* Through the rainbow bridge...",
    "🎯 *ZOOM!* Direct transmission...",
    "✨ *SPARKLE!* Magical transportation..."
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('tp')
        .setDescription('Teleport to another member in real life!')
        .addUserOption(option => 
            option.setName('member')
                .setDescription('The member to teleport to')
                .setRequired(true)),

    async execute(interaction) {
        try {
            // Check cooldown
            const now = Date.now();
            const cooldownEnd = userCooldowns.get(interaction.user.id);
            if (cooldownEnd && now < cooldownEnd) {
                const remainingTime = Math.ceil((cooldownEnd - now) / 1000);
                return interaction.reply({
                    content: `⏳ Your teleporter needs ${remainingTime} more seconds to recharge!`,
                    ephemeral: true
                });
            }

            const memberToTeleport = interaction.options.getMember('member');

            // Validate target member
            if (!memberToTeleport) {
                return interaction.reply({ 
                    content: '❌ Member not found in this server!', 
                    ephemeral: true 
                });
            }

            // Prevent self-teleportation
            if (memberToTeleport.id === interaction.user.id) {
                return interaction.reply({
                    content: '❓ You\'re already here! No need to teleport to yourself!',
                    ephemeral: true
                });
            }

            // Check if target is a bot
            if (memberToTeleport.user.bot) {
                return interaction.reply({
                    content: '❌ Cannot teleport to bots! They exist in the digital realm!',
                    ephemeral: true
                });
            }

            // Get random teleport message
            const teleportMessage = teleportMessages[Math.floor(Math.random() * teleportMessages.length)];

            // Create embed
            const embed = new EmbedBuilder()
                .setColor(config.commands?.tp || config.colors?.default || '#9B59B6')
                .setTitle('🌟 Teleportation Sequence')
                .setDescription(teleportMessage)
                .addFields(
                    {
                        name: '🏃 Traveler',
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: '🎯 Destination',
                        value: `${memberToTeleport}`,
                        inline: true
                    }
                )
                .setFooter({ 
                    text: 'Remember to thank your local teleporter operator!' 
                })
                .setTimestamp();

            // Set cooldown
            userCooldowns.set(interaction.user.id, now + COOLDOWN_DURATION);

            // Send the response
            await interaction.reply({ embeds: [embed] });

            // Optional: Send DM to target member
            try {
                await memberToTeleport.send({
                    content: `🌟 ${interaction.user.tag} has teleported to your location! They came from ${interaction.guild.name}!`
                });
            } catch (error) {
                // Silently fail if DM cannot be sent
                console.log(`Could not send DM to ${memberToTeleport.user.tag}`);
            }

        } catch (error) {
            await interaction.reply({ 
                content: '❌ Teleportation failed! The quantum tunnel collapsed!', 
                ephemeral: true 
            }).catch(console.error);
        }
    },
};
