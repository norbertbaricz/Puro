const { Collection } = require('discord.js');

function visibleCommands(interaction) {
    const { client, guildId } = interaction;
    const commands = new Collection(client.commands);
    client.guildCommands.get(guildId)?.forEach((command, name) => commands.set(name, command));
    return [...commands.values()]
        .filter(
            (command) =>
                (!command.guildOnly || guildId) &&
                (!command.ownerOnly || client.config.runtime.owner_ids.includes(interaction.user.id)) &&
                (!command.userPermissions || !guildId || interaction.memberPermissions?.has(command.userPermissions)),
        )
        .sort((a, b) => a.data.name.localeCompare(b.data.name));
}

function groups(interaction) {
    const result = new Map();
    for (const command of visibleCommands(interaction)) {
        const category = String(command.category || 'Misc');
        if (!result.has(category)) result.set(category, []);
        result.get(category).push(command);
    }
    return result;
}

module.exports = { visibleCommands, groups };
