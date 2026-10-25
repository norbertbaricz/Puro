const { commandKey } = require('../plugins/files');
function registrationTargets(manager) {
    const global = [];
    const guilds = new Map();
    for (const id of manager.client.guildDirectory.byId.keys()) guilds.set(id, []);
    for (const record of manager.records.values()) {
        if (record.kind !== 'commands') continue;
        if (!record.scope) {
            const payload = structuredClone(record.payload);
            if (record.module.portable) {
                const personal = manager.client.config.features?.user_install?.enabled;
                payload.integration_types = personal ? [0, 1] : [0];
                payload.contexts = personal ? [0, 1, 2] : [0, 1];
            }
            global.push(payload);
        } else
            for (const id of record.scope) {
                if (!guilds.has(id)) guilds.set(id, []);
                guilds.get(id).push(record.payload);
            }
    }
    if (manager.client.config.api.registration === 'guild') {
        const id = manager.client.config.api.guild_id;
        const merged = new Map(global.map((command) => [commandKey(command.type, command.name), command]));
        for (const command of guilds.get(id) || []) merged.set(commandKey(command.type, command.name), command);
        guilds.set(id, [...merged.values()]);
        return new Map([['global', []], ...guilds]);
    }
    return new Map([['global', global], ...guilds]);
}

module.exports = { registrationTargets };
