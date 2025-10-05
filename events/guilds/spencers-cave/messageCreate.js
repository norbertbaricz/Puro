const createGreetingEvent = require('../../../lib/guildGreetingEventFactory');

module.exports = createGreetingEvent({
    allowedGuildNames: ["Spencer's Cave"],
});
