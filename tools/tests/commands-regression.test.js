process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { PermissionFlagsBits, ChannelType } = require('discord.js');
const axios = require('axios');
const { commandFixture } = require('./command-fixture');
const { ROOT } = require('../../src/paths');

const SIMPLE_COMMANDS = [
    ['fun/coin-flip.js', { integers: { flips: 2 } }],
    ['fun/rate-anything.js', { strings: { thing: 'Clean code', mode: 'random' } }],
    ['fun/identity-meter.js', {}],
    ['fun/truth-or-dare.js', { strings: { type: 'truth' } }],
    ['fun/magic-8-ball.js', { strings: { question: 'Will the tests pass?' } }],
    ['media/random-food.js', {}],
    ['info/help-menu.js', {}],
];
for (const [file, options] of SIMPLE_COMMANDS) {
    test(`command smoke: ${file} sends valid SDK payloads`, async (t) => {
        const f = await commandFixture(t, options);
        await f.run(`commands/${file}`);
        assert.ok(f.replies.length, 'The command must answer.');
        assert.equal(f.client.healthMonitor.errors, 0);
    });
}

test('identity initial rendering is awaited so failures reach the interaction router', async (t) => {
    const f = await commandFixture(t);
    f.failEdit(1);
    await assert.rejects(f.run('commands/fun/identity-meter.js'), /Expected render failure/);
});

test('rating animation failures remain inside the collector error boundary', async (t) => {
    const f = await commandFixture(t, { strings: { thing: 'A test', mode: 'random' } });
    await f.run('commands/fun/rate-anything.js');
    f.failEdit(3);
    await f.collectors[0].listeners('collect')[0](f.component('rate_reroll'));
    assert.equal(f.client.healthMonitor.errors, 1);
    const reply = f.replies.at(-1);
    assert.equal(reply.method, 'followUp');
    assert.equal(reply.body.flags, 64);
    assert.match(reply.body.embeds[0].description, /Something went wrong/);
});

test('joke reroll network failures produce a private response instead of an unhandled timer rejection', async (t) => {
    const f = await commandFixture(t);
    let calls = 0;
    t.mock.method(axios, 'get', async () => {
        if (++calls > 1) throw new Error('Expected network failure');
        return { data: { type: 'single', joke: 'A deterministic test joke.' } };
    });
    await f.run('commands/fun/random-joke.js');
    await f.collectors[0].listeners('collect')[0](f.component('joke_again'));
    assert.equal(calls, 2);
    assert.equal(f.client.healthMonitor.errors, 1);
    assert.equal(f.replies.at(-1).body.flags, 64);
});

test('job applications and resignations each acknowledge their component once', async (t) => {
    const f = await commandFixture(t);
    const storePath = path.join(ROOT, 'src/services/economy/store');
    delete require.cache[require.resolve(storePath)];
    const economy = require(storePath);
    economy.configureEconomy({ path: path.join(f.root, 'economy.json') });
    t.mock.method(Math, 'random', () => 0);
    await f.run('commands/economy/job-center.js');
    const handle = f.collectors[0].listeners('collect')[0];
    const select = f.component('job_select');
    select.values = ['cashier'];
    await handle(select);
    await handle(f.component('job_apply'));
    assert.equal((await economy.getEconomySnapshot())[f.actor.id].job.id, 'cashier');
    await handle(f.component('job_quit'));
    assert.equal((await economy.getEconomySnapshot())[f.actor.id].job, null);
    assert.equal(f.client.healthMonitor.errors, 0);
});

test('private thread requests cannot fall back to public threads', async (t) => {
    const f = await commandFixture(t, {
        strings: { title: 'Private conversation' },
        booleans: { private_thread: true },
        botPermissions:
            PermissionFlagsBits.ViewChannel |
            PermissionFlagsBits.CreatePublicThreads |
            PermissionFlagsBits.SendMessages |
            PermissionFlagsBits.EmbedLinks,
    });
    await f.run('commands/management/create-thread.js');
    assert.equal(f.replies[0].method, 'reply');
    assert.match(f.replies[0].body.embeds[0].description, /permission/i);
});

test('private threads reject announcement channels before making an API request', async (t) => {
    const f = await commandFixture(t, { strings: { title: 'A title' }, booleans: { private_thread: true } });
    f.i.channel.type = ChannelType.GuildAnnouncement;
    await f.run('commands/management/create-thread.js');
    assert.match(f.replies[0].body.embeds[0].description, /regular text channel/);
});

test('oversize nicknames are rejected before fetching and editing server members', async (t) => {
    const f = await commandFixture(t, { strings: { nickname: 'x'.repeat(33) } });
    await f.run('commands/moderation/bulk-nicknames.js');
    assert.match(f.replies[0].body.embeds[0].description, /32 characters/);
});

test('number guesses reject partial numbers without consuming an attempt', async (t) => {
    const f = await commandFixture(t, { integers: { min: 1, max: 10, chances: 3 } });
    t.mock.method(Math, 'random', () => 0);
    await f.run('commands/fun/number-guess.js');
    const initial = f.replies[0].body.embeds[0].description;
    await f.collectors[0].listeners('collect')[0]({ author: f.actor, content: '4abc', async delete() {} });
    assert.equal(f.replies.at(-1).method, 'followUp');
    assert.match(f.replies.at(-1).body.embeds[0].description, /4abc/);
    assert.match(initial, /3/);
    await f.collectors[0].listeners('collect')[0]({ author: f.actor, content: '9', async delete() {} });
    assert.match(f.replies.at(-1).body.embeds[0].fields.find((field) => field.name === 'Attempts').value, /2\/3/);
});

test('expired hint buttons cannot consume a number-game attempt', async (t) => {
    const f = await commandFixture(t, { integers: { min: 1, max: 10, chances: 3 } });
    t.mock.method(Math, 'random', () => 0);
    await f.run('commands/fun/number-guess.js');
    const button = f.component('guess_hint');
    button.deferUpdate = async () => {
        throw Object.assign(new Error('Unknown interaction'), { code: 10062 });
    };
    await f.collectors[1].listeners('collect')[0](button);
    await f.collectors[0].listeners('collect')[0]({ author: f.actor, content: '9', async delete() {} });
    assert.match(f.replies.at(-1).body.embeds[0].fields.find((field) => field.name === 'Attempts').value, /2\/3/);
    assert.equal(f.client.healthMonitor.errors, 0);
});
