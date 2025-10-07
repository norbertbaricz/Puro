const createGreetingEvent = require('../../../lib/guildGreetingEventFactory');

module.exports = createGreetingEvent({
    configPath: ['events', 'guilds', 'the-wolf-den', 'messageCreate'],
    allowedGuildIds: ['1217588804328620163'],
    allowedGuildNames: ['The Wolf Den'],
    allowedGuilds: ['the-wolf-den'],
});
