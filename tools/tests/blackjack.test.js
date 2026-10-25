process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const cards = require('../../src/features/blackjack/cards');
const { fixture, GUILD_ID } = require('./helpers');

const card = (rank) => ({
    rank: String(rank),
    value: rank === 'A' ? 11 : Number(rank),
    isAce: rank === 'A',
    label: `${rank}♠️`,
});

async function table(t, { failInitial = false } = {}) {
    const f = await fixture(t);
    // Each table uses a fresh store and a deterministic deck, never user data.
    delete require.cache[require.resolve('../../src/services/economy/store')];
    const economy = require('../../src/services/economy/store');
    economy.configureEconomy({ path: path.join(f.root, 'economy.json') });
    await economy.withEconomy((db) => {
        economy.ensureUserRecord(db, GUILD_ID).balance = 100;
    });
    t.mock.method(cards, 'createDeck', () => [card(10), card(9), card(8), card(9), card(2)].reverse());
    delete require.cache[require.resolve('../../src/features/blackjack/play')];
    const { playBlackjack } = require('../../src/features/blackjack/play');
    const collector = new EventEmitter();
    collector.client = f.client;
    collector.stop = (reason) => {
        collector.ended = true;
        collector.endReason = reason;
        collector.emit('end', [], reason);
    };
    const replies = [];
    const i = {
        client: f.client,
        user: { id: GUILD_ID, username: 'Max' },
        inGuild: () => true,
        options: { getInteger: () => 50, getBoolean: () => false },
        async deferReply() {},
        async editReply(payload) {
            if (failInitial) throw new Error('Initial Discord delivery failed');
            replies.push(payload);
        },
        async fetchReply() {
            return { createMessageComponentCollector: () => collector };
        },
    };
    const balance = async () => (await economy.getEconomySnapshot())[GUILD_ID].balance;
    const component = (customId, overrides = {}) => ({
        client: f.client,
        user: i.user,
        customId,
        isRepliable: () => true,
        async deferUpdate() {
            this.deferred = true;
        },
        async reply(payload) {
            replies.push(payload);
            this.replied = true;
        },
        async followUp(payload) {
            replies.push(payload);
        },
        ...overrides,
    });
    return { ...f, play: () => playBlackjack(i), collector, replies, component, balance };
}

test('blackjack decks are unique and ace totals follow blackjack rules', () => {
    const deck = cards.createDeck();
    assert.equal(deck.length, 52);
    assert.equal(new Set(deck.map((entry) => entry.label)).size, 52);
    assert.equal(cards.calculateHand([card('A'), card('A'), card(9)]).value, 21);
    assert.equal(cards.calculateHand([card('A'), card(6)]).isSoft, true);
    assert.equal(cards.calculateHand([card('A'), card(6), card(10)]).value, 17);
    assert.equal(cards.calculateHand([card(10), card(9), card(3)]).isBust, true);
});

test('rapid double-down clicks charge and settle a hand once', async (t) => {
    const f = await table(t);
    await f.play();
    const collect = f.collector.listeners('collect')[0];
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    const first = collect(
        f.component('bj_double', {
            async deferUpdate() {
                await gate;
                this.deferred = true;
            },
        }),
    );
    const second = collect(f.component('bj_double'));
    release();
    await Promise.all([first, second]);
    // 100 - 50 stake - 50 double + 200 payout. A second click adds nothing.
    assert.equal(await f.balance(), 200);
    assert.equal(f.collector.endReason, 'finished');
});

test('an initial table delivery failure refunds the unplayable wager', async (t) => {
    const f = await table(t, { failInitial: true });
    await assert.rejects(f.play(), /Initial Discord delivery failed/);
    assert.equal(await f.balance(), 100);
});

test('expired double-down interactions do not charge a second stake', async (t) => {
    const f = await table(t);
    await f.play();
    const collect = f.collector.listeners('collect')[0];
    await collect(
        f.component('bj_double', {
            async deferUpdate() {
                throw Object.assign(new Error('Unknown interaction'), { code: 10062 });
            },
        }),
    );
    assert.equal(await f.balance(), 50);
    assert.equal(f.collector.ended, undefined);
});
