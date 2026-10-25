process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { onCollect, onEnd } = require('../../src/shared/collectors');
const { fixture } = require('./helpers');

test('rapid collector actions and their end handler run in order', async () => {
    const collector = new EventEmitter();
    const order = [];
    let release;
    const gate = new Promise((resolve) => {
        release = resolve;
    });
    onCollect(collector, async (value) => {
        order.push(`start${value}`);
        if (value === 1) await gate;
        order.push(`end${value}`);
    });
    onEnd(collector, () => order.push('finished'));
    const collect = collector.listeners('collect')[0];
    const end = collector.listeners('end')[0];
    const first = collect(1);
    const second = collect(2);
    const finished = end();
    await Promise.resolve();
    assert.deepEqual(order, ['start1']);
    release();
    await Promise.all([first, second, finished]);
    assert.deepEqual(order, ['start1', 'end1', 'start2', 'end2', 'finished']);
});

test('collector errors produce a private embed and the next action can still run', async (t) => {
    const f = await fixture(t);
    const collector = new EventEmitter();
    collector.client = f.client;
    let sent;
    const i = {
        client: f.client,
        isRepliable: () => true,
        async reply(payload) {
            sent = payload;
        },
    };
    let calls = 0;
    onCollect(collector, () => {
        if (++calls === 1) throw new Error('Expected failure');
    });
    const collect = collector.listeners('collect')[0];
    await collect(i);
    assert.match(sent.embeds[0].toJSON().description, /Something went wrong/);
    assert.equal(sent.flags, 64);
    assert.equal(f.client.healthMonitor.errors, 1);
    await collect(i);
    assert.equal(calls, 2);
});

test('a second queued confirmation cannot run after the first stops its collector', async () => {
    const collector = new EventEmitter();
    let actions = 0;
    onCollect(collector, () => {
        actions++;
        collector.ended = true;
        collector.endReason = 'confirmed';
    });
    const collect = collector.listeners('collect')[0];
    await Promise.all([collect({}), collect({})]);
    assert.equal(actions, 1);
});

test('the final message reaching an SDK collection limit is still processed', async () => {
    const collector = new EventEmitter();
    let calls = 0;
    onCollect(collector, () => {
        calls++;
    });
    const result = collector.listeners('collect')[0]({});
    collector.ended = true;
    collector.endReason = 'limit';
    await result;
    assert.equal(calls, 1);
});
