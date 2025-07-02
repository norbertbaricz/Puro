const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    category: 'Fun',
    data: new SlashCommandBuilder()
        .setName('tp')
        .setDescription('Teleport to another member in the server!')
        .addUserOption(option =>
            option.setName('member')
            .setDescription('The member to teleport to')
            .setRequired(true)),

    async execute(interaction) {
        // Safely access configuration
        const commandConfig = interaction.client.config.commands.tp;
        const configMessages = commandConfig?.messages || {}; // Use empty object if messages are not defined in config
        const configColor = commandConfig?.color || '#9B59B6'; // Default color if not in config

        // Define default messages (these will be used if not found in config.yml)
        const defaultMessages = {
            cooldown: "⏳ Teleporter is recharging! Please wait {remaining} before teleporting again.",
            not_found: "❌ The selected user could not be found as a member in this server.",
            self_tp: "❌ You cannot teleport to yourself! That's not how this works.",
            bot_tp: "❌ Apologies, teleporter systems are incompatible with bot entities. Cannot teleport to bots!",
            error: "❌ Teleportation sequence failed! An unexpected dimensional rift occurred.",
            teleport: [ // Ensure teleport is an array with at least one message
                "🌟 *WHOOSH!* A shimmering portal slices through reality...",
                "⚡ *ZAP!* You're dematerialized and rematerialized in a flash of light!",
                "🌀 *VWOORP!* The very fabric of space-time bends around you...",
                "🌌 *STRETCH!* You're pulled through a cosmic string to your destination!",
                "✨ *TWINKLE!* With a sprinkle of quantum dust, you've arrived!"
            ]
        };

        // Helper function to get messages from config or defaults, with placeholder replacement
        const getMessage = (key, replacements = {}) => {
            let message = configMessages[key] || defaultMessages[key];
            if (typeof message === 'string') {
                for (const placeholder in replacements) {
                    message = message.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
                }
            }
            return message;
        };

        try {
            const targetUser = interaction.options.getUser('member'); // Step 1: Get the User object

            // This check is mostly for safety; setRequired(true) should prevent targetUser from being null.
            if (!targetUser) {
                console.error("TP Command Error: Target user was not resolved from a required option.");
                return interaction.reply({ content: getMessage('error'), ephemeral: true });
            }

            // Step 2: Check if the User is a bot.
            if (targetUser.bot) {
                return interaction.reply({ content: getMessage('bot_tp'), ephemeral: true });
            }

            // Step 3: Now, get the GuildMember object for this user in the current guild.
            const memberToTeleport = interaction.options.getMember('member');

            if (!memberToTeleport) {
                // This means the selected user exists on Discord but is not a member of this specific server.
                return interaction.reply({ content: getMessage('not_found'), ephemeral: true });
            }

            // Step 4: Check for self-teleportation.
            if (memberToTeleport.id === interaction.user.id) {
                return interaction.reply({ content: getMessage('self_tp'), ephemeral: true });
            }

            // Select a random teleport message
            const teleportMessagesArray = Array.isArray(configMessages.teleport) && configMessages.teleport.length > 0
                ? configMessages.teleport
                : defaultMessages.teleport;
            const teleportMessageText = teleportMessagesArray[Math.floor(Math.random() * teleportMessagesArray.length)];

            const embed = new EmbedBuilder()
                .setColor(configColor)
                .setTitle('🌟 Teleportation Sequence Initiated!')
                .setDescription(teleportMessageText || "Teleporting...") // Fallback for description
                .addFields(
                    { name: '🚀 Traveler', value: `${interaction.user}`, inline: true },
                    { name: '🏁 Destination', value: `${memberToTeleport}`, inline: true }
                )
                .setFooter({ text: 'Always thank your friendly teleporter operator!' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

            // Attempt to DM the target member
            try {
                await memberToTeleport.send({ // Sending to GuildMember DMs their User
                    content: `👋 Greetings! ${interaction.user.tag} just "teleported" to your location in the server: **${interaction.guild.name}**!`
                });
            } catch (dmError) {
                // Log if DM fails (e.g., user has DMs closed or blocked the bot). This is not a critical command error.
                console.log(`TP Info: Could not send a DM to ${memberToTeleport.user.tag} (User ID: ${memberToTeleport.id}). DM Error Code: ${dmError.code}`);
            }

        } catch (error) {
            console.error('TP Command General Error:', error); // Log the full error for debugging
            const errorMessage = getMessage('error');
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};