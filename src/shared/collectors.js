const { createLogger } = require('../core/logging/logger');
const { guardInteraction } = require('../core/ui/guard');
const { privateReply } = require('../core/interactions/respond');
const { isUnknownInteractionError } = require('../core/interactions/safety');

// Discord collectors use EventEmitter: async callbacks need their own error
// boundary. A per-collector queue also prevents overlapping game/balance changes.
const queues = new WeakMap();
const log = createLogger('COLLECTORS');
const COMPLETED_LIMITS = new Set(['limit', 'componentLimit', 'userLimit']);

function listen(collector, event, handler) {
    collector.on(event, (...args) => {
        const previous = queues.get(collector) || Promise.resolve();
        const task = previous.then(async () => {
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
                if (isUnknownInteractionError(error)) return;
                const client = interaction?.client || collector.client;
                log.error(`Collector ${event} failed`, { messageId: collector.message?.id, error });
                client?.healthMonitor?.recordError(error);
                if (interaction) {
                    try {
                        await privateReply(
                            interaction,
                            'Something went wrong with this action. Please try again.',
                            'error',
                        );
                    } catch (replyError) {
                        if (!isUnknownInteractionError(replyError))
                            log.error('Could not send collector error', { error: replyError });
                    }
                }
            }
        });
        queues.set(collector, task);
        return task;
    });
    return collector;
}

const onCollect = (collector, handler) => listen(collector, 'collect', handler);
const onEnd = (collector, handler) => listen(collector, 'end', handler);

module.exports = { onCollect, onEnd };
