const { createLogger } = require('../logging/logger');
const { isUnknownInteractionError } = require('./safety');
const { runHandler } = require('./execute');
const { privateReply } = require('./respond');
const log = createLogger('INTERACTIONS');
const { guardInteraction } = require('../ui/guard');
async function dispatchInteraction(interaction) {
    const client = interaction.client;
    guardInteraction(interaction);
    const messages = client.config.events?.interactionCreate?.messages || {};
    const action = interaction.commandName ? `/${interaction.commandName}` : interaction.customId || interaction.type;
    let activeHandler;
    try {
        if (interaction.isAutocomplete()) {
            const command = client.plugins.findCommand(interaction);
            try {
                if (typeof command?.autocomplete === 'function') await command.autocomplete(interaction, client);
            } catch (error) {
                log.error('Autocomplete failed', { command: interaction.commandName, error });
            } finally {
                if (!interaction.responded) await interaction.respond([]);
            }
            return;
        }
        if (interaction.isChatInputCommand() || interaction.isContextMenuCommand()) {
            const command = client.plugins.findCommand(interaction);
            if (!command) {
                await privateReply(
                    interaction,
                    (messages.command_not_found || 'Command {command} is no longer loaded.').replaceAll(
                        '{command}',
                        interaction.commandName,
                    ),
                );
                return;
            }
            activeHandler = command;
            await runHandler(interaction, command, `${interaction.commandType || 1}:${interaction.commandName}`);
            return;
        }
        if (!interaction.isButton() && !interaction.isAnySelectMenu() && !interaction.isModalSubmit()) return;
        const handler = client.plugins.findComponent(interaction);
        if (handler) {
            activeHandler = handler;
            await runHandler(interaction, handler, `${handler.type}:${handler.customId}`);
            return;
        }
        // Existing message collectors keep handling their own buttons. Only these
        // legacy persistent help IDs are routed here for backward compatibility.
        const help = client.commands.get('help');
        if (interaction.isButton() && interaction.customId === 'help_back_to_categories')
            await help?.handleBackButton?.(interaction);
        else if (interaction.isStringSelectMenu() && interaction.customId === 'help_category_select')
            await help?.handleCategorySelect?.(interaction);
    } catch (error) {
        const code = Number(error.code ?? error.rawError?.code);
        if (isUnknownInteractionError(error) || code === 40060 || error.code === 'InteractionAlreadyReplied') {
            log.warn('Interaction expired or was already acknowledged', { action, code });
            return;
        }
        const record =
            client.plugins.records &&
            [...client.plugins.records.values()].find((item) => item.module === activeHandler);
        log.error('Interaction failed', { action, ...(record ? { file: record.relative } : {}), error });
        client.healthMonitor?.recordError(error);
        try {
            await privateReply(
                interaction,
                messages.handler_error || 'Something went wrong. Please try again; the bot owner can check the logs.',
                'error',
            );
        } catch (replyError) {
            if (!isUnknownInteractionError(replyError))
                log.error('Could not send the interaction error', { error: replyError });
        }
    }
}

module.exports = { dispatchInteraction, runHandler, privateReply };
