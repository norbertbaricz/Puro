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
        if (!statusConfig?.texts?.length) { // Am schimbat asta, verifica doar lungimea array-ului
            console.log(config.messages.no_status);
            await client.user.setPresence({
                activities: [{ name: 'Error' }],
                status: statusConfig?.status || 'dnd'
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

        const setRandomActivity = async () => {
            const randomText = statusConfig.texts[Math.floor(Math.random() * statusConfig.texts.length)];
            let activity;

            if (statusConfig.type === 'Custom') {
                activity = {
                    name: randomText,
                    type: ActivityType.Custom,
                };
            } else if (statusConfig.type === 'Streaming') {
                activity = {
                    name: randomText,
                    type: ActivityType.Streaming,
                    url: statusConfig.url || "https://www.twitch.tv/insym", // Adaugă un URL implicit pentru streaming
                };
            } else {
                activity = {
                    name: randomText,
                    type: activityTypes[statusConfig.type] || ActivityType.Playing,
                };
            }

            try {
                await client.user.setPresence({ activities: [activity], status: statusConfig.status || 'dnd' });
            } catch (error) {
                console.error(config.messages.status_error, error);
            }
        };

        setRandomActivity();
        setInterval(setRandomActivity, 10000);
    },
};