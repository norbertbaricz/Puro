const { createLogger } = require('../core/logging/logger');
const { guardInteraction } = require('../core/ui/guard');
const { privateReply } = require('../core/interactions/respond');
const { isUnavailableResponseError } = require('../core/interactions/safety');

// Related message/button collectors can share a queue for one game session.
const queues = new WeakMap();
const log = createLogger('COLLECTORS');
const COMPLETED_LIMITS = new Set(['limit', 'componentLimit', 'userLimit', 'processedLimit']);

function queueFor(collector) {
    if (!queues.has(collector)) queues.set(collector, { tail: Promise.resolve(), pending: 0 });
    return queues.get(collector);
}

function linkCollectors(...collectors) {
    if (!collectors.length) return;
    const state = queueFor(collectors[0]);
    for (const collector of collectors) {
        const current = queues.get(collector);
        if (current && current !== state && current.pending)
            throw new Error('Link collectors before processing their first action.');
        queues.set(collector, state);
    }
}

function listen(collector, event, handler) {
    collector.on(event, (...args) => {
        const state = queueFor(collector);
        state.pending++;
        const task = state.tail.then(async () => {
            const interaction =
                event === 'collect' && typeof args[0]?.isRepliable === 'function' && args[0].isRepliable()
                    ? args[0]
                    : null;
            try {
                if (interaction) guardInteraction(interaction);
                if (event === 'collect' && collector.ended && !COMPLETED_LIMITS.has(collector.endReason)) {
                    if (interaction) await privateReply(interaction, 'This action has already finished.');
                    return;
                }
                await handler(...args);
            } catch (error) {
                if (isUnavailableResponseError(error)) return;
                const client = interaction?.client || collector.client;
                log.error(`Collector ${event} failed`, {
                    action: interaction?.customId,
                    messageId: collector.message?.id || collector.messageId,
                    error,
                });
                client?.healthMonitor?.recordError(error);
                if (interaction) {
                    try {
                        await privateReply(
                            interaction,
                            'Something went wrong with this action. Please try again.',
                            'error',
                        );
                    } catch (replyError) {
                        if (!isUnavailableResponseError(replyError))
                            log.error('Could not send collector error', { error: replyError });
                    }
                }
            } finally {
                state.pending--;
            }
        });
        // Even an unexpected failure in the boundary itself cannot poison later callbacks.
        state.tail = task.catch((error) => log.error('Collector queue failed', { error }));
        return state.tail;
    });
    return collector;
}

const onCollect = (collector, handler) => listen(collector, 'collect', handler);
const onEnd = (collector, handler) => listen(collector, 'end', handler);

module.exports = { onCollect, onEnd, linkCollectors };
