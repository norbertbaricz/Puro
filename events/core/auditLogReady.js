const { registerAuditLogListeners } = require('../../lib/auditLogListeners');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
        registerAuditLogListeners(client);
    },
};
