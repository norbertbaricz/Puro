const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        const config = interaction.client.config.events.interactionCreate;

        try {
            // Handle Slash Commands
            if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);

                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found.`);
                    return interaction.reply({
                        content: config.messages.command_not_found.replace('{command}', interaction.commandName),
                        ephemeral: true
                    });
                }

                await command.execute(interaction);
                return;
            }

            // Handle Button Interactions
            if (interaction.isButton()) {
                const customId = interaction.customId;
                
                // Logic for help command's "Back" button
                if (customId === 'help_back_to_categories') {
                    const helpCommand = interaction.client.commands.get('help');
                    if (helpCommand && typeof helpCommand.handleBackButton === 'function') {
                        await helpCommand.handleBackButton(interaction);
                    }
                }
                
                // Adaugă aici altă logică pentru butoane dacă este necesar (ex: tictactoe este gestionat prin collector, deci nu necesită cod aici)
                return;
            }

            // Handle Select Menu Interactions
            if (interaction.isStringSelectMenu()) {
                const customId = interaction.customId;

                // Logic for help command's category selection
                if (customId === 'help_category_select') {
                    const helpCommand = interaction.client.commands.get('help');
                    if (helpCommand && typeof helpCommand.handleCategorySelect === 'function') {
                        await helpCommand.handleCategorySelect(interaction);
                    }
                }
                return;
            }

        } catch (error) {
            console.error('Interaction handler error:', error);
            
            const errorMessage = {
                content: config.messages.handler_error || 'There was an error while processing this interaction!',
                ephemeral: true
            };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage).catch(console.error);
            } else {
                await interaction.reply(errorMessage).catch(console.error);
            }
        }
    },
};