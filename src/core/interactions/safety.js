// Expired tokens and deleted response messages are normal UI lifecycle outcomes.
const UNKNOWN_INTERACTION_CODE = 10062;
const UNAVAILABLE_RESPONSE_CODES = new Set([10008, 10015, 10062, 50027]);
const errorCode = (error) => Number(error?.code ?? error?.rawError?.code);

function isUnknownInteractionError(error) {
    return Boolean(
        error &&
        (errorCode(error) === UNKNOWN_INTERACTION_CODE ||
            (typeof error.message === 'string' && error.message.toLowerCase().includes('unknown interaction'))),
    );
}

function isUnavailableResponseError(error) {
    return isUnknownInteractionError(error) || UNAVAILABLE_RESPONSE_CODES.has(errorCode(error));
}

async function response(interaction, method, payload) {
    if (!interaction) return undefined;
    try {
        return await interaction[method](payload);
    } catch (error) {
        if (!isUnavailableResponseError(error)) throw error;
    }
}

const safeFollowUp = (interaction, payload) => response(interaction, 'followUp', payload);
const safeReply = (interaction, payload) =>
    response(interaction, interaction?.deferred || interaction?.replied ? 'followUp' : 'reply', payload);
const safeUpdate = (interaction, payload) => response(interaction, 'update', payload);
const safeEditReply = (interaction, payload) => response(interaction, 'editReply', payload);

async function safeDeferUpdate(interaction) {
    if (!interaction) return false;
    if (interaction.deferred || interaction.replied) return true;
    try {
        await interaction.deferUpdate();
        return true;
    } catch (error) {
        if (!isUnavailableResponseError(error)) throw error;
        return false;
    }
}

module.exports = {
    isUnknownInteractionError,
    isUnavailableResponseError,
    safeDeferUpdate,
    safeEditReply,
    safeReply,
    safeFollowUp,
    safeUpdate,
};
