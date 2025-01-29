const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

// Load the config.yml file with error handling
let config;
try {
    config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));
} catch (error) {
    config = { commands: {}, limits: { message: 2000 } }; // Fallback config
}

// Rate limiting
const userCooldowns = new Map();
const COOLDOWN_DURATION = 10000; // 10 seconds

module.exports = {
    data: new SlashCommandBuilder()
        .setName('announce')
        .setDescription('Announce a message to a specific channel!')
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to send the message to')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('message')
                .setDescription('The message to send')
                .setRequired(true)
                .setMaxLength(2000))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(interaction) {
        try {
            // Check user permissions
            if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                return interaction.reply({
                    content: '❌ You need the "Manage Messages" permission to use this command!',
                    ephemeral: true
                });
            }

            // Check cooldown
            const now = Date.now();
            const cooldownEnd = userCooldowns.get(interaction.user.id);
            if (cooldownEnd && now < cooldownEnd) {
                const remainingTime = Math.ceil((cooldownEnd - now) / 1000);
                return interaction.reply({
                    content: `⏳ Please wait ${remainingTime} seconds before sending another message.`,
                    ephemeral: true
                });
            }

            // Get command options
            const channel = interaction.options.getChannel('channel');
            const message = interaction.options.getString('message');

            // Validate channel type
            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) {
                return interaction.reply({
                    content: '❌ Please specify a valid text or announcement channel!',
                    ephemeral: true
                });
            }

            // Check bot permissions in target channel
            const botMember = interaction.guild.members.me;
            const permissions = channel.permissionsFor(botMember);
            
            if (!permissions.has(PermissionFlagsBits.SendMessages)) {
                return interaction.reply({
                    content: `❌ I don't have permission to send messages in ${channel}!`,
                    ephemeral: true
                });
            }

            // Validate message length
            const maxLength = config.limits?.message || 2000;
            if (message.length > maxLength) {
                return interaction.reply({
                    content: `❌ Message is too long! Maximum length is ${maxLength} characters.`,
                    ephemeral: true
                });
            }

            // Defer reply for potentially slow operations
            await interaction.deferReply({ ephemeral: true });

            try {
                // Send the message
                await channel.send({
                    content: message,
                    allowedMentions: { parse: ['users', 'roles'] } // Control mention parsing
                });

                // Set cooldown
                userCooldowns.set(interaction.user.id, now + COOLDOWN_DURATION);

                // Success response
                await interaction.editReply({
                    content: `✅ Message sent successfully to ${channel}!`,
                    ephemeral: true
                });

            } catch (error) {
                let errorMessage = '❌ Failed to send the message.';
                if (error.code === 50013) {
                    errorMessage = `❌ Missing permissions to send messages in ${channel}!`;
                } else if (error.code === 50001) {
                    errorMessage = `❌ Cannot access ${channel}!`;
                }

                await interaction.editReply({
                    content: errorMessage,
                    ephemeral: true
                });
            }

        } catch (error) {
            const reply = interaction.deferred 
                ? interaction.editReply 
                : interaction.reply;
            
            await reply.call(interaction, {
                content: '❌ An unexpected error occurred!',
                ephemeral: true
            }).catch(console.error);
        }
    },
};
