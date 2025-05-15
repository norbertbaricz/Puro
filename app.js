require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const config = yaml.load(fs.readFileSync('./config.yml', 'utf8'));

if (!process.env.TOKEN || !process.env.clientId) {
    console.error(config.messages.environmentVariablesNotSet);
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
});
client.config = config;

async function loadAndRegisterCommands() {
    console.log('\n🤖 Starting command registration...');
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    client.commands = new Map();

    try {
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
        console.log(`\n🔍 Found ${commandFiles.length} commands...`);

        for (const file of commandFiles) {
            try {
                const command = require(path.join(commandsPath, file));
                if (!command.data || !command.execute) {
                    console.log(`⚠️ Command ${file} missing properties`);
                    continue;
                }
                commands.push(command.data.toJSON());
                client.commands.set(command.data.name, command);
                console.log(`✅ Loaded ${file}`);
            } catch (error) {
                console.log(`⚠️ Error loading ${file}:`, error);
            }
        }

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
        console.log('\n⚡ Refreshing commands...');
        
        const data = await rest.put(
            Routes.applicationCommands(process.env.clientId),
            { body: commands },
        );
        
        console.log(`\n✅ Reloaded ${data.length} commands!`);
    } catch (error) {
        console.error('Command registration error:', error);
        process.exit(1);
    }
}

const eventsPath = path.join(__dirname, 'events');
try {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        try {
            const event = require(path.join(eventsPath, file));
            if (!event.name || !event.execute) {
                console.warn(`⚠️ Event ${file} missing properties`);
                continue;
            }
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
        } catch (error) {
            console.error(`⚠️ Error loading ${file}:`, error);
        }
    }
} catch (error) {
    console.error('Error reading events:', error);
    process.exit(1);
}

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity(config.status.text, { type: config.status.type, url: config.status.url });
});

(async () => {
    try {
        await loadAndRegisterCommands();
        await client.login(process.env.TOKEN);
    } catch (error) {
        console.error(`${config.messages.errorLoggingIn} ${error}`);
        process.exit(1);
    }
})();