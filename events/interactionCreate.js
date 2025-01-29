const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { Events } = require('discord.js');

// Load the config.yml file
const config = yaml.load(fs.readFileSync(path.join(__dirname, '../config.yml'), 'utf8'));

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        try {
            // Handle button interactions
            if (interaction.isButton()) {
                // Extract page number from custom ID
                const [command, action] = interaction.customId.split('_');
                
                if (command === 'help') {
                    const currentPage = parseInt(interaction.message.embeds[0].description.split('/')[0].split(' ')[1]);
                    const totalPages = parseInt(interaction.message.embeds[0].description.split('/')[1]);
                    
                    let newPage = currentPage;
                    
                    switch (action) {
                        case 'first':
                            newPage = 1;
                            break;
                        case 'prev':
                            newPage = Math.max(1, currentPage - 1);
                            break;
                        case 'next':
                            newPage = Math.min(totalPages, currentPage + 1);
                            break;
                        case 'last':
                            newPage = totalPages;
                            break;
                    }

                    // Get the help command
                    const helpCommand = interaction.client.commands.get('help');
                    if (helpCommand) {
                        // Create a new interaction option mock
                        const optionMock = {
                            getInteger: (name) => name === 'page' ? newPage : null
                        };
                        interaction.options = optionMock;
                        
                        // Execute help command with new page
                        await helpCommand.execute(interaction);
                    }
                }
            }
            // Handle slash commands (existing code)
            else if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);

                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found.`);
                    return;
                }

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`Error executing ${interaction.commandName}`);
                    console.error(error);
                }
            }
        } catch (error) {
            console.error('Error in interaction handler:', error);
            try {
                const reply = interaction.deferred 
                    ? interaction.editReply 
                    : interaction.reply;
                
                await reply.call(interaction, {
                    content: 'There was an error while executing this command!',
                    ephemeral: true
                });
            } catch (e) {
                console.error('Error sending error message:', e);
            }
        }
    },
};