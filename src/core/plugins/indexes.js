const path = require('node:path');
const { Collection } = require('discord.js');
const { commandKey } = require('./files');
function rebuildIndexes(manager) {
    const client = manager.client;
    client.commands = new Collection();
    client.guildCommands = new Map();
    client.contextMenus = new Collection();
    client.guildContextMenus = new Map();
    manager.components = [];
    for (const record of manager.records.values()) {
        if (record.kind === 'components') {
            manager.components.push(record);
            continue;
        }
        if (record.kind !== 'commands') continue;
        const slash = record.payload.type === 1;
        const key = slash ? record.payload.name : record.key;
        if (!record.scope) (slash ? client.commands : client.contextMenus).set(key, record.module);
        else
            for (const id of record.scope) {
                const map = slash ? client.guildCommands : client.guildContextMenus;
                if (!map.has(id)) map.set(id, new Collection());
                map.get(id).set(key, record.module);
            }
    }
    manager.components.sort(
        (a, b) =>
            Number(!!b.scope) - Number(!!a.scope) ||
            Number(!!a.module.prefix) - Number(!!b.module.prefix) ||
            b.module.customId.length - a.module.customId.length,
    );
}

function refreshDetails(manager) {
    const details = [...manager.details.entries()];
    manager.client.commandLoadDetails = details
        .filter(([file]) => path.relative(manager.root, file).startsWith(`commands${path.sep}`))
        .map(([, value]) => value);
    manager.client.eventLoadDetails = details
        .filter(([file]) => path.relative(manager.root, file).startsWith(`events${path.sep}`))
        .map(([, value]) => value);
}

function findCommand(manager, interaction) {
    const type = interaction.commandType || 1;
    const key = type === 1 ? interaction.commandName : commandKey(type, interaction.commandName);
    const global = type === 1 ? manager.client.commands : manager.client.contextMenus;
    const scoped = type === 1 ? manager.client.guildCommands : manager.client.guildContextMenus;
    return scoped.get(interaction.guildId)?.get(key) || global.get(key);
}

function findComponent(manager, interaction) {
    const type = interaction.isButton()
        ? 'button'
        : interaction.isModalSubmit()
          ? 'modal'
          : interaction.isAnySelectMenu()
            ? 'selectMenu'
            : null;
    return manager.components.find(
        (record) =>
            record.module.type === type &&
            (!record.scope || record.scope.includes(interaction.guildId)) &&
            (record.module.prefix
                ? interaction.customId.startsWith(record.module.customId)
                : interaction.customId === record.module.customId),
    )?.module;
}

module.exports = { rebuildIndexes, refreshDetails, findCommand, findComponent };
