module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        // Special message logic (from specials.js)
        const channelId = ''; // Replace with actual channel ID
        const guildId = '1217588804328620163'; // Replace with actual guild ID

        const checkTimeAndSendMessage = () => {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();

            // Check if it's 23:00
            if (hours === 23 && minutes === 0) {
                const guild = client.guilds.cache.get(guildId);
                if (guild) {
                    const channel = guild.channels.cache.get(channelId);
                    if (channel) {
                        channel.send('||@everyone||\n# <@486412940199591967> and <@914250836538961941> have reached 1 month of being in a relationship!');
                    } else {
                        console.error('The specified channel was not found.');
                    }
                } else {
                    console.error('The specified guild was not found.');
                }
            }
        };

        // Calculate the next execution time
        const now = new Date();
        const nextExecutionTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 0, 0);

        // If it's already past 23:00 today, schedule for next month
        if (now > nextExecutionTime) {
            nextExecutionTime.setMonth(nextExecutionTime.getMonth() + 1);
        }

        // Calculate the delay until the next execution
        const delay = nextExecutionTime - now;

        // Schedule the first execution
        setTimeout(checkTimeAndSendMessage, delay);

        // Schedule subsequent executions monthly
        setInterval(checkTimeAndSendMessage, 2628000000); // 2628000000 milliseconds = 30.4 days (approximately)
    }
};