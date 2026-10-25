const { Events } = require('discord.js');
const { getGuild } = require('./scope');
async function invoke(manager, record, args, onlyGuildId = null) {
    const isReady = record.name === Events.ClientReady;
    if (manager.stopped || record.disposed || (record.module.once && record.fired && !(isReady && record.scope)))
        return;
    const guild = getGuild(args);
    if (record.scope && !isReady && (!guild || !record.scope.includes(guild.id))) return;
    record.fired = true;
    if (record.module.once) manager.client.removeListener(record.name, record.listener);
    try {
        if (isReady && record.scope) {
            record.initializedGuilds ||= new Set();
            for (const id of record.scope) {
                if ((onlyGuildId && id !== onlyGuildId) || record.initializedGuilds.has(id)) continue;
                const target = manager.client.guilds.cache.get(id);
                if (!target) continue;
                record.initializedGuilds.add(id);
                const dispose = await record.module.execute(target, manager.client);
                if (typeof dispose === 'function') record.disposers.push(dispose);
            }
        } else {
            const dispose = await record.module.execute(...args, manager.client);
            if (isReady && typeof dispose === 'function') record.disposers.push(dispose);
        }
    } catch (error) {
        manager.report(`Event ${record.name} failed`, error, record);
    }
}

async function attach(manager, record) {
    record.listener = (...args) => {
        const task = manager.invoke(record, args);
        if (record.name === Events.ClientReady) record.initializing = task;
        return task;
    };
    manager.client.on(record.name, record.listener);
    // Ready modules dropped into a running bot initialize immediately.
    if (record.name === Events.ClientReady && manager.client.isReady()) {
        record.initializing = manager.invoke(record, [manager.client]);
        await record.initializing;
    }
}

async function detach(manager, record) {
    record.disposed = true;
    if (record.listener) manager.client.removeListener(record.name, record.listener);
    await record.initializing;
    for (const dispose of record.disposers) {
        try {
            await dispose();
        } catch (error) {
            manager.report('Module disposer failed', error, record);
        }
    }
    if (typeof record.module.cleanup === 'function') {
        try {
            await record.module.cleanup(manager.client);
        } catch (error) {
            manager.report('Module cleanup failed', error, record);
        }
    }
}

module.exports = { invoke, attach, detach };
