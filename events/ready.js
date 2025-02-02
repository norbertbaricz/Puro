const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const { ActivityType } = require('discord.js');

// Load the config.yml file
const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        // Initial startup messages
        console.log(`✅ Successfully logged in as ${client.user.tag}`);
        
        let totalMembers = 0;
        let totalChannels = 0;

        client.guilds.cache.each(guild => {
            totalMembers += guild.memberCount;
            totalChannels += guild.channels.cache.size;
        });

        console.log(`🌐 Serving ${client.guilds.cache.size} servers`);
        console.log(`👥 Reaching ${totalMembers} users`);
        console.log(`📊 Managing ${totalChannels} channels`);

        // Load status configurations
        const statusConfig = config.status;
        if (!statusConfig || !statusConfig.text || !statusConfig.type) {
            console.log('⚠️ No status activities configured, using default');
            await client.user.setPresence({ 
                activities: [{ name: 'Powered by Skypixel™️', type: ActivityType.Custom }],
                status: 'dnd'
            });
            return;
        }

        const activityTypes = {
            'Playing': ActivityType.Playing,
            'Streaming': ActivityType.Streaming,
            'Listening': ActivityType.Listening,
            'Watching': ActivityType.Watching,
            'Custom': ActivityType.Custom,
            'Competing': ActivityType.Competing
        };

        // Special handling for Streaming status
        let customStatus;
        if (statusConfig.type === 'Streaming') {
            customStatus = {
                name: statusConfig.text,
                type: ActivityType.Streaming,
                url: statusConfig.url || 'https://www.twitch.tv/maxwastaked' // Fallback URL if none provided
            };
        } else {
            customStatus = {
                name: statusConfig.text,
                type: activityTypes[statusConfig.type]
            };
        }

        // Set custom status
        try {
            await client.user.setPresence({ 
                activities: [customStatus],
                status: 'idle'
            });
            console.log('✅ Custom status set successfully:', customStatus.name);
        } catch (error) {
            console.error('❌ Error setting custom status:', error);
            // Fallback to a simple status if streaming fails
            await client.user.setPresence({ 
                activities: [{ 
                    name: statusConfig.text, 
                    type: ActivityType.Custom 
                }],
                status: 'idle'
            });
        }
    }
};