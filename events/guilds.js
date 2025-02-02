const { Events, EmbedBuilder } = require('discord.js');
const yaml = require('js-yaml');
const fs = require('fs');

// Guild and channel IDs for image-only moderation
const IMAGE_ONLY_GUILDS = [
    '1217588804328620163'
];

const IMAGE_ONLY_CHANNELS = [
    '1234533126248730827',
    '1230042540875448341',
    '1239021031570800651',
    '1332941016889823325',
    '1332941122133164173',
    '1332942365551235163'
];

const IMAGE_VIDEO_CHANNELS = [
    '1232155836118208642',
    '1332941356158681138',
    '1332941776008511520',
    '1332942402146537573',
    '1239128226274480168',
    '1332942454009233542',
    '1332942488163450963'
];

// Load config
let config;
try {
    config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));
} catch (error) {
    config = { colors: { error: '#FF0000' } }; // Fallback color if config fails to load
}

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Image-only channel moderation
        if (IMAGE_ONLY_GUILDS.includes(message.guildId)) {
            if (IMAGE_ONLY_CHANNELS.includes(message.channelId)) {
                // Ignore bot messages
                if (message.author.bot) return;
                
                // Check if the message contains an image
                if (!message.attachments.some(attachment => attachment.contentType?.startsWith('image/'))) {
                    await message.delete();
                    
                    // Create warning embed using color from config
                    const warningEmbed = new EmbedBuilder()
                        .setColor(config.colors?.error || '#FF0000')
                        .setTitle('⚠️ Warning: Image Required')
                        .setDescription(`Hey ${message.author}, this channel requires an image attachment with your message!`)
                        .addFields(
                            { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
                            { name: 'Action Taken', value: 'Message Deleted', inline: true }
                        )
                        .setTimestamp();

                    // Try to send DM, silently fail if not possible
                    await message.author.send({ embeds: [warningEmbed] }).catch(() => {});
                    return;
                }
            } else if (IMAGE_VIDEO_CHANNELS.includes(message.channelId)) {
                // Ignore bot messages
                if (message.author.bot) return;
                
                // Check if the message contains an image, video, or GIF
                if (!message.attachments.some(attachment => 
                    attachment.contentType?.startsWith('image/') || 
                    attachment.contentType?.startsWith('video/') ||
                    attachment.contentType === 'image/gif' ||
                    attachment.url.endsWith('.gif')
                )) {
                    await message.delete();
                    
                    // Create warning embed for image/video/gif channel
                    const warningEmbed = new EmbedBuilder()
                        .setColor(config.colors?.error || '#FF0000')
                        .setTitle('⚠️ Warning: Media Required')
                        .setDescription(`Hey ${message.author}, this channel requires an image, video, or GIF attachment with your message!`)
                        .addFields(
                            { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
                            { name: 'Action Taken', value: 'Message Deleted', inline: true }
                        )
                        .setTimestamp();

                    // Try to send DM, silently fail if not possible
                    await message.author.send({ embeds: [warningEmbed] }).catch(() => {});
                    return;
                }
            }
        }

        // ... rest of your existing guilds.js code ...
    },
};
