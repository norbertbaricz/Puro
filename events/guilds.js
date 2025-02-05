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
        try {
            // Check if message is in allowed guild
            if (!IMAGE_ONLY_GUILDS.includes(message.guildId)) return;
            
            // Ignore bot messages
            if (message.author.bot) return;

            // Get member's nickname or username
            const memberName = message.member.nickname || message.author.username;

            // Handle IMAGE_ONLY_CHANNELS (only images allowed)
            if (IMAGE_ONLY_CHANNELS.includes(message.channelId)) {
                const hasImage = message.attachments.some(attachment => 
                    attachment.contentType?.startsWith('image/') && 
                    !attachment.contentType?.includes('gif')
                );

                if (!hasImage) {
                    try {
                        // Get all threads first
                        const threads = await message.channel.threads.fetch();
                        const existingThread = threads.threads.find(t => 
                            t.name === `${memberName}'s Discussion` && !t.archived
                        );

                        // Store content
                        const originalContent = message.content;

                        if (originalContent) {
                            if (existingThread) {
                                // Use existing thread
                                const messageEmbed = new EmbedBuilder()
                                    .setColor('#00ff00')
                                    .setAuthor({
                                        name: memberName,
                                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                                    })
                                    .setDescription(originalContent)
                                    .setTimestamp();

                                    await existingThread.send({ embeds: [messageEmbed] });
                                    await message.delete();
                            } else {
                                // Create new thread first, then delete message
                                const thread = await message.startThread({
                                    name: `${memberName}'s Discussion`,
                                    autoArchiveDuration: 60,
                                    reason: 'Automatically created thread for text message'
                                });

                                const threadEmbed = new EmbedBuilder()
                                    .setColor('#00ff00')
                                    .setAuthor({
                                        name: memberName,
                                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                                    })
                                    .setTitle('💬 Discussion Thread Created')
                                    .setDescription(originalContent)
                                    .addFields(
                                        { 
                                            name: '📝 Channel Rules',
                                            value: 'This channel only allows static images. Videos, GIFs, and text-only messages are not permitted.',
                                            inline: false 
                                        },
                                        { 
                                            name: '⏰ Auto-Archive',
                                            value: 'This thread will be automatically archived after 1 hour of inactivity.',
                                            inline: false 
                                        }
                                    )
                                    .setFooter({ 
                                        text: `Thread created for ${memberName}` 
                                    })
                                    .setTimestamp();

                                await thread.send({ embeds: [threadEmbed] });
                                await message.delete();
                            }
                        } else {
                            // If no content, just delete the message
                            await message.delete();
                        }
                    } catch (error) {
                        console.error('Error in thread handling:', error);
                        // If there's an error, make sure the message is deleted
                        try {
                            await message.delete();
                        } catch (deleteError) {
                            console.error('Error deleting message:', deleteError);
                        }
                    }
                }
            }

            // Handle IMAGE_VIDEO_CHANNELS (only videos and GIFs allowed)
            else if (IMAGE_VIDEO_CHANNELS.includes(message.channelId)) {
                const hasVideoOrGif = message.attachments.some(attachment => 
                    attachment.contentType?.startsWith('video/') ||
                    attachment.contentType?.includes('gif') ||
                    attachment.url.endsWith('.gif')
                );

                if (!hasVideoOrGif) {
                    try {
                        // Get all threads first
                        const threads = await message.channel.threads.fetch();
                        const existingThread = threads.threads.find(t => 
                            t.name === `${memberName}'s Discussion` && !t.archived
                        );

                        // Store content
                        const originalContent = message.content;

                        if (originalContent) {
                            if (existingThread) {
                                // Use existing thread
                                const messageEmbed = new EmbedBuilder()
                                    .setColor('#00ff00')
                                    .setAuthor({
                                        name: memberName,
                                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                                    })
                                    .setDescription(originalContent)
                                    .setTimestamp();

                                await existingThread.send({ embeds: [messageEmbed] });
                                await message.delete();
                            } else {
                                // Create new thread first, then delete message
                                const thread = await message.startThread({
                                    name: `${memberName}'s Discussion`,
                                    autoArchiveDuration: 60,
                                    reason: 'Automatically created thread for text message'
                                });

                                const threadEmbed = new EmbedBuilder()
                                    .setColor('#00ff00')
                                    .setAuthor({
                                        name: memberName,
                                        iconURL: message.author.displayAvatarURL({ dynamic: true })
                                    })
                                    .setTitle('💬 Discussion Thread Created')
                                    .setDescription(originalContent)
                                    .addFields(
                                        { 
                                            name: '📝 Channel Rules',
                                            value: 'This channel only allows videos and GIFs. Static images and text-only messages are not permitted.',
                                            inline: false 
                                        },
                                        { 
                                            name: '⏰ Auto-Archive',
                                            value: 'This thread will be automatically archived after 1 hour of inactivity.',
                                            inline: false 
                                        }
                                    )
                                    .setFooter({ 
                                        text: `Thread created for ${memberName}` 
                                    })
                                    .setTimestamp();

                                await thread.send({ embeds: [threadEmbed] });
                                await message.delete();
                            }
                        } else {
                            // If no content, just delete the message
                            await message.delete();
                        }
                    } catch (error) {
                        console.error('Error in thread handling:', error);
                        // If there's an error, make sure the message is deleted
                        try {
                            await message.delete();
                        } catch (deleteError) {
                            console.error('Error deleting message:', deleteError);
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Error in guilds.js:', error);
        }
    },
};
