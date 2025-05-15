const { ActivityType } = require('discord.js');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        const config = client.config.events.ready;
        console.log(config.messages.login_success.replace('{tag}', client.user.tag));

        let totalMembers = 0, totalChannels = 0;
        client.guilds.cache.each(guild => {
            totalMembers += guild.memberCount;
            totalChannels += guild.channels.cache.size;
        });

        console.log(config.messages.stats.servers.replace('{count}', client.guilds.cache.size));
        console.log(config.messages.stats.members.replace('{count}', totalMembers));
        console.log(config.messages.stats.channels.replace('{count}', totalChannels));

        const statusConfig = client.config.status;
        if (!statusConfig?.text || !statusConfig?.type) {
            console.log(config.messages.no_status);
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

        try {
            const activity = statusConfig.type === 'Streaming' 
                ? { name: statusConfig.text, type: ActivityType.Streaming, url: statusConfig.url }
                : { name: statusConfig.text, type: activityTypes[statusConfig.type] };

            await client.user.setPresence({ activities: [activity], status: 'idle' });
        } catch (error) {
            console.error(config.messages.status_error, error);
            await client.user.setPresence({ 
                activities: [{ name: statusConfig.text, type: ActivityType.Custom }],
                status: 'idle'
            });
        }
    },
};