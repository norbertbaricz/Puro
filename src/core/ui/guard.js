const { MessageFlags } = require('discord.js');
const { validatePayload } = require('./validate');
const { formatMessage, flagsOf } = require('./messages');
const { recordAcknowledgement, acknowledgementMode } = require('../interactions/acknowledgement');

// Guard each interaction once; SDK prototypes remain untouched.
const GUARDED = Symbol('puro.ui.guarded');
const RESPONSE_METHODS = ['reply', 'editReply', 'followUp', 'update', 'showModal', 'deferReply', 'deferUpdate'];
const INITIAL_REPLIES = new Set(['reply', 'deferReply']);
const INITIAL_UPDATES = new Set(['update', 'deferUpdate']);

function guardInteraction(interaction) {
    if (interaction[GUARDED]) return;
    interaction[GUARDED] = true;
    let originalV2 = false;
    for (const method of RESPONSE_METHODS) {
        if (typeof interaction[method] !== 'function') continue;
        const original = interaction[method];
        interaction[method] = function guardedResponse(payload, ...args) {
            const modal = method === 'showModal';
            const deferred = method === 'deferReply' || method === 'deferUpdate';
            const updatesOriginal =
                method === 'update' || (method === 'editReply' && acknowledgementMode(this) === 'update');
            const v2 =
                (method === 'editReply' && originalV2) ||
                (updatesOriginal && this.message?.flags?.has(MessageFlags.IsComponentsV2));
            const outgoing = modal || deferred ? payload : formatMessage(this.client, payload, { v2 });
            const data = outgoing?.options || outgoing;
            if (!deferred && this.client.config.ui?.validate_payloads !== false) {
                validatePayload(
                    v2 ? { ...data, flags: flagsOf(data?.flags) | MessageFlags.IsComponentsV2 } : outgoing,
                    { modal },
                );
            }
            const result = original.call(this, outgoing, ...args);
            return Promise.resolve(result).then((response) => {
                if (INITIAL_REPLIES.has(method)) recordAcknowledgement(this, 'reply');
                if (INITIAL_UPDATES.has(method)) recordAcknowledgement(this, 'update');
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
