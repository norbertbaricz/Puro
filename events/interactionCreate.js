const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        const config = interaction.client.config.events.interactionCreate;
        try {
            if (interaction.isButton()) {
                const [command, action] = interaction.customId.split('_');
                if (command === 'help') {
                    const currentPage = parseInt(interaction.message.embeds[0].description.split('/')[0].split(' ')[1]);
                    const totalPages = parseInt(interaction.message.embeds[0].description.split('/')[1]);
                    
                    let newPage = currentPage;
                    switch (action) {
                        case 'first': newPage = 1; break;
                        case 'prev': newPage = Math.max(1, currentPage - 1); break;
                        case 'next': newPage = Math.min(totalPages, currentPage + 1); break;
                        case 'last': newPage = totalPages; break;
                    }

                    const helpCommand = interaction.client.commands.get('help');
                    if (helpCommand) {
                        interaction.options = { getInteger: () => newPage };
                        await helpCommand.execute(interaction);
                    }
                }
            } else if (interaction.isChatInputCommand()) {
                const command = interaction.client.commands.get(interaction.commandName);
                if (!command) {
                    console.error(`No command matching ${interaction.commandName}`);
                    return interaction.reply({ 
                        content: config.messages.command_not_found.replace('{command}', interaction.commandName), 
                        ephemeral: true 
                    });
                }

                await command.execute(interaction);
            }
        } catch (error) {
            console.error('Interaction handler error:', error);
            const reply = interaction.deferred ? interaction.editReply : interaction.reply;
            await reply.call(interaction, { content: config.messages.handler_error, ephemeral: true });
        }
    },
};