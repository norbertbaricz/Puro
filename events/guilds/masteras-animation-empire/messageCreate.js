const createGreetingEvent = require('../../../lib/guildGreetingEventFactory');

module.exports = createGreetingEvent({
    configPath: ['events', 'guilds', 'masteras-animation-empire', 'messageCreate'],
    allowedGuildIds: ['1299378352301539398'],
    allowedGuildNames: ["Mastera's Animation Empire"],
    allowedGuilds: ['masteras-animation-empire'],
});
