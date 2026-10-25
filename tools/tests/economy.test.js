const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// Load a fresh store instance for each test so no user's database can be touched.
function store(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'puro-economy-'));
    delete require.cache[require.resolve('../../src/services/economy/store')];
    const economy = require('../../src/services/economy/store');
    economy.configureEconomy({ path: path.join(root, 'custom.json') });
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    return { root, economy };
}

test('concurrent economy updates serialize and persist to the configured path', async (t) => {
    const { root, economy } = store(t);
    await Promise.all(
        Array.from({ length: 30 }, () =>
            economy.withEconomy((db) => {
                economy.ensureUserRecord(db, 'user').balance += 1;
            }),
        ),
    );
    await economy.flushEconomy();
    assert.equal(JSON.parse(fs.readFileSync(path.join(root, 'custom.json'), 'utf8')).user.balance, 30);
    assert.equal(fs.existsSync(path.join(root, 'custom.json.tmp')), false);
});

test('an aborted economy mutation cannot change cached or persisted balances', async (t) => {
    const { economy } = store(t);
    await economy.withEconomy((db) => {
        economy.ensureUserRecord(db, 'user').balance = 10;
    });
    await assert.rejects(
        economy.withEconomy((db) => {
            db.user.balance = 999;
            throw new Error('abort');
        }),
    );
    assert.equal((await economy.getEconomySnapshot()).user.balance, 10);
});

test('invalid JSON is backed up before automatic repair', async (t) => {
    const { root, economy } = store(t);
    fs.writeFileSync(economy.dbPath, 'invalid data');
    await economy.initializeEconomy();
    const backup = fs.readdirSync(root).find((file) => file.includes('.bak.'));
    assert.ok(backup);
    assert.equal(fs.readFileSync(path.join(root, backup), 'utf8'), 'invalid data');
    assert.deepEqual(await economy.getEconomySnapshot(), {});
});

test('disabled repair preserves corrupted data and fails clearly', async (t) => {
    const { economy } = store(t);
    fs.writeFileSync(economy.dbPath, 'invalid data');
    await assert.rejects(economy.initializeEconomy({ autoRepair: false }), /repair is disabled/);
    assert.equal(fs.readFileSync(economy.dbPath, 'utf8'), 'invalid data');
});

test('unchanged economy reads do not rewrite the database', async (t) => {
    const { economy } = store(t);
    await economy.withEconomy((db) => {
        economy.ensureUserRecord(db, 'user').balance = 10;
    });
    fs.utimesSync(economy.dbPath, new Date(0), new Date(0));
    await economy.withEconomy((db) => economy.ensureUserRecord(db, 'user').balance);
    assert.equal(fs.statSync(economy.dbPath).mtimeMs, 0);
    await economy.withEconomy((db) => {
        db.user.balance++;
    });
    assert.equal(JSON.parse(fs.readFileSync(economy.dbPath, 'utf8')).user.balance, 11);
});
