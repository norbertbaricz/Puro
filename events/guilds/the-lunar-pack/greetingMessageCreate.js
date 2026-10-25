const createGreetingEvent = require('../../../src/features/greetings/createGreetingEvent');

module.exports = createGreetingEvent({
    configPath: ['events', 'guilds', 'the-lunar-pack', 'messageCreate'],
    allowedGuildIds: ['1217588804328620163'],
    allowedGuildNames: ['The Lunar Pack'],
    allowedGuilds: ['the-lunar-pack'],
});
