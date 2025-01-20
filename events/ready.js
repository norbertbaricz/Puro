const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const { ActivityType } = require('discord.js');

// Load the config.yml file
const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        let totalMembers = 0;

        client.guilds.cache.each(guild => {
            console.log(`${config.messages.serverNameLog} ${guild.name}`);
            totalMembers += guild.memberCount;
        });

        console.log(`${config.messages.totalMembersLog} ${totalMembers}`);

        client.user.setPresence({
            activities: [{ name: config.status.text, type: ActivityType[config.status.type], url: config.status.type === 'STREAMING' ? config.status.url : undefined }],
            status: 'dnd'
        });
    }
};