const UNKNOWN_INTERACTION_CODE = 10062;

const hasUnknownInteractionMessage = (error) =>
    typeof error?.message === 'string' && error.message.toLowerCase().includes('unknown interaction');

const isUnknownInteractionError = (error) =>
    !error ? false : error.code === UNKNOWN_INTERACTION_CODE ||
    error.rawError?.code === UNKNOWN_INTERACTION_CODE ||
    hasUnknownInteractionMessage(error);

const safeFollowUp = async (interaction, payload) => {
    if (!interaction) return;
    try {
        await interaction.followUp(payload);
    } catch (error) {
        if (!isUnknownInteractionError(error)) {
            throw error;
        }
    }
};

const safeReply = async (interaction, payload) => {
    if (!interaction) return;
    if (interaction.deferred || interaction.replied) {
        await safeFollowUp(interaction, payload);
        return;
    }
    try {
        await interaction.reply(payload);
    } catch (error) {
        if (!isUnknownInteractionError(error)) {
            throw error;
        }
    }
};

const safeUpdate = async (interaction, payload) => {
    if (!interaction) return;
    try {
        await interaction.update(payload);
    } catch (error) {
        if (!isUnknownInteractionError(error)) {
            throw error;
        }
    }
};

const safeDeferUpdate = async (interaction) => {
    if (!interaction || interaction.deferred || interaction.replied) {
        return;
    }
    try {
        await interaction.deferUpdate();
    } catch (error) {
        if (!isUnknownInteractionError(error)) {
            throw error;
        }
    }
};

module.exports = {
    isUnknownInteractionError,
    safeDeferUpdate,
    safeReply,
    safeFollowUp,
    safeUpdate
};
