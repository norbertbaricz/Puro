const { validatePayload } = require('./validate');
const { formatMessage, flagsOf } = require('./messages');
const { MessageFlags } = require('discord.js');

// Wrap each interaction instance once; SDK prototypes and global emitters stay intact.
const GUARDED = Symbol('puro.ui.guarded');
const RESPONSE_METHODS = ['reply', 'editReply', 'followUp', 'update', 'showModal'];

function guardInteraction(interaction) {
    if (interaction[GUARDED]) return;
    interaction[GUARDED] = true;
    let originalV2 = false;
    for (const method of RESPONSE_METHODS) {
        if (typeof interaction[method] !== 'function') continue;
        const original = interaction[method];
        interaction[method] = function guardedResponse(payload, ...args) {
            const modal = method === 'showModal';
            const v2 =
                method === 'update'
                    ? this.message?.flags?.has(MessageFlags.IsComponentsV2)
                    : method === 'editReply' && originalV2;
            const outgoing = modal ? payload : formatMessage(this.client, payload, { v2 });
            const data = outgoing?.options || outgoing;
            if (this.client.config.ui?.validate_payloads !== false)
                validatePayload(
                    v2 ? { ...data, flags: flagsOf(data?.flags) | MessageFlags.IsComponentsV2 } : outgoing,
                    { modal },
                );
            const result = original.call(this, outgoing, ...args);
            return Promise.resolve(result).then((response) => {
                if (
                    ['reply', 'update', 'editReply'].includes(method) &&
                    flagsOf(data?.flags) & MessageFlags.IsComponentsV2
                )
                    originalV2 = true;
                return response;
            });
        };
    }
}

module.exports = { guardInteraction };
