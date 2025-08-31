const { Events } = require('discord.js');

// Simple per-command cooldowns: Map<commandName, Map<userId, lastUsedMs>>
const cooldowns = new Map();

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        const config = interaction.client.config.events.interactionCreate;

        try {
            // Handle Slash Commands
            if (interaction.isChatInputCommand()) {
                const commandName = interaction.commandName;
                const command = interaction.client.commands.get(commandName);

                if (!command) {
                    console.error(`No command matching ${commandName} was found.`);
                    if (!interaction.replied && !interaction.deferred) {
                        await interaction.reply({
                            content: config.messages.command_not_found.replace('{command}', commandName),
                            ephemeral: true
                        });
                    }
                    return;
                }

                // Cooldown support via config: commands.<name>.cooldown_seconds
                const cmdCfg = interaction.client.config?.commands?.[commandName];
                const cdSec = Number(cmdCfg?.cooldown_seconds) || 0;
                if (cdSec > 0) {
                    if (!cooldowns.has(commandName)) cooldowns.set(commandName, new Map());
                    const byUser = cooldowns.get(commandName);
                    const last = byUser.get(interaction.user.id) || 0;
                    const now = Date.now();
                    const remaining = last + cdSec * 1000 - now;
                    if (remaining > 0) {
                        const seconds = Math.ceil(remaining / 1000);
                        const msg = (cmdCfg?.messages?.cooldown || '⏳ Please wait {remaining} seconds.').replace('{remaining}', String(seconds));
                        await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
                        return;
                    }
                    byUser.set(interaction.user.id, now);
                }

                await command.execute(interaction);
                return;
            }

            // Handle Autocomplete
            if (interaction.isAutocomplete()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (command && typeof command.autocomplete === 'function') {
                    try { await command.autocomplete(interaction); } catch (e) { console.error('Autocomplete error:', e); }
                }
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
                // Info tabs are handled via message collectors inside the command, ignore here.
                
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
