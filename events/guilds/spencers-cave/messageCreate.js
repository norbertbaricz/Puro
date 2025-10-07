const createGreetingEvent = require('../../../lib/guildGreetingEventFactory');

module.exports = createGreetingEvent({
    configPath: ['events', 'guilds', 'spencers-cave', 'messageCreate'],
    allowedGuildIds: ['1010638602004340787'],
    allowedGuildNames: ["Spencer's Cave"],
    allowedGuilds: ['spencers-cave'],
});
