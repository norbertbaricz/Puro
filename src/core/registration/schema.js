function ordered(value) {
    if (Array.isArray(value)) return value.map(ordered);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.keys(value)
            .sort()
            .filter((key) => value[key] !== undefined)
            .map((key) => [key, ordered(value[key])]),
    );
}

function normalizeOption(option) {
    const result = { ...option };
    if (!result.required) delete result.required;
    if (!result.autocomplete) delete result.autocomplete;
    for (const key of ['name_localizations', 'description_localizations']) if (result[key] == null) delete result[key];
    if (result.options) result.options = result.options.map(normalizeOption);
    if (result.choices)
        result.choices = result.choices.map((choice) => {
            const item = { ...choice };
            if (item.name_localizations == null) delete item.name_localizations;
            return item;
        });
    if (Array.isArray(result.channel_types)) result.channel_types = [...result.channel_types].sort((a, b) => a - b);
    return result;
}

function commandBody(payload, scope) {
    const body = structuredClone(payload);
    if (scope !== 'global') {
        delete body.contexts;
        delete body.integration_types;
        delete body.dm_permission;
    }
    return body;
}

function fingerprint(commands, scope) {
    const normalized = commands
        .map((command) => {
            const result = {
                type: command.type || 1,
                name: command.name,
                description: command.description || '',
                options: (command.options || []).map(normalizeOption),
                name_localizations: command.name_localizations || null,
                description_localizations: command.description_localizations || null,
                default_member_permissions:
                    command.default_member_permissions == null ? null : String(command.default_member_permissions),
                nsfw: command.nsfw || false,
            };
            if (scope === 'global') {
                result.contexts = [...(command.contexts || (command.dm_permission === false ? [0] : [0, 1, 2]))].sort();
                result.integration_types = [...(command.integration_types || [0])].sort();
            }
            return result;
        })
        .sort((a, b) => a.type - b.type || a.name.localeCompare(b.name));
    return JSON.stringify(ordered(normalized));
}

module.exports = { fingerprint, commandBody };
