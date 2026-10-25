process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ComponentType, Collection, PermissionsBitField, PermissionFlagsBits } = require('discord.js');
const { feedbackForm } = require('../../src/features/feedback/form');
const { submitFeedback } = require('../../src/features/feedback/submit');
const { parseDate, createCalendarEvent } = require('../../src/features/calendar/create');
const { validatePayload } = require('../../src/core/ui/validate');
const { fixture, command, GUILD_ID } = require('./helpers');
const fs = require('node:fs');

test('feedback form uses validated radio, upload and checkbox components', () => {
    const form = feedbackForm();
    validatePayload(form, { modal: true });
    const types = form.toJSON().components.map((label) => label.component.type);
    assert.equal(types.length, 5);
    assert.ok(types.includes(ComponentType.RadioGroup));
    assert.ok(types.includes(ComponentType.FileUpload));
    assert.ok(types.includes(ComponentType.Checkbox));
});

test('feedback is delivered only after destination permissions and size checks', async (t) => {
    const f = await fixture(t);
    f.client.config.features.feedback.channel_id = GUILD_ID;
    f.client.user = { id: GUILD_ID };
    let sent;
    f.client.channels = {
        async fetch() {
            return {
                isSendable: () => true,
                permissionsFor: () => new PermissionsBitField(PermissionFlagsBits.Administrator),
                async send(payload) {
                    sent = payload;
                    return { id: 'report-reference' };
                },
            };
        },
    };
    let reply;
    const i = {
        client: f.client,
        guildId: GUILD_ID,
        user: { id: GUILD_ID, tag: 'Max' },
        fields: {
            getTextInputValue: (id) => (id === 'subject' ? 'A bug' : 'Steps to reproduce.'),
            getRadioGroup: () => 'bug',
            getCheckbox: () => false,
            getUploadedFiles: () => new Collection(),
        },
        async editReply(payload) {
            reply = payload;
        },
    };
    await submitFeedback(i);
    assert.equal(sent.embeds[0].toJSON().title, 'A bug');
    assert.match(reply.content, /report-reference/);
    sent = undefined;
    i.fields.getUploadedFiles = () =>
        new Collection([['file', { size: 50 * 1024 * 1024, url: 'https://cdn.discordapp.com/attachments/example' }]]);
    await submitFeedback(i);
    assert.equal(sent, undefined);
    assert.match(reply.content, /smaller/);
});

test('event dates reject missing timezones and calendar-invalid dates', () => {
    assert.ok(Number.isNaN(parseDate('2027-01-01T19:00')));
    assert.ok(Number.isNaN(parseDate('2027-02-30T19:00Z')));
    assert.ok(Number.isNaN(parseDate('2027-12-01T25:00Z')));
    assert.equal(parseDate('2027-01-01T19:00+02:00'), Date.parse('2027-01-01T17:00:00Z'));
});

test('calendar command sends native external-event fields after validation', async () => {
    let created;
    let reply;
    const starts = new Date(Date.now() + 3600_000)
        .toISOString()
        .replace('.000Z', 'Z')
        .replace(/\.\d{3}Z$/, 'Z');
    const ends = new Date(Date.now() + 7200_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const values = { title: 'Community night', starts, ends, location: 'Discord', description: 'Join us.' };
    const i = {
        options: { getString: (name) => values[name] },
        user: { tag: 'Max' },
        guild: {
            scheduledEvents: {
                async create(payload) {
                    created = payload;
                    return { url: 'https://discord.com/events/test' };
                },
            },
        },
        async editReply(payload) {
            reply = payload;
        },
    };
    await createCalendarEvent(i);
    assert.equal(created.entityType, 3);
    assert.equal(created.entityMetadata.location, 'Discord');
    assert.match(reply.content, /Event created/);
});

test('user-install contexts apply only to explicitly portable modules', async (t) => {
    const f = await fixture(t);
    await f.manager.loadFile(f.write('commands/a.js', command('portable', 1, ', portable: true')));
    await f.manager.loadFile(f.write('commands/b.js', command('server', 1, ', guildOnly: true')));
    f.client.config.features.user_install.enabled = true;
    const payloads = f.manager.registrationTargets().get('global');
    assert.deepEqual(payloads.find((item) => item.name === 'portable').integration_types, [0, 1]);
    assert.deepEqual(payloads.find((item) => item.name === 'server').contexts, [0]);
});

test('split configuration reloads command text without replacing healthy command instances', async (t) => {
    const f = await fixture(t);
    const file = f.write('commands/a.js', command());
    await f.manager.loadFile(file);
    const original = f.client.commands.get('hello');
    f.write('config.yml', 'guilds: []\n');
    const settings = f.write('config/commands/hello.yml', 'messages:\n  greeting: Hello from settings\n');
    assert.equal(await f.manager.reloadConfig(), true);
    assert.equal(f.client.config.commands.hello.messages.greeting, 'Hello from settings');
    assert.equal(f.client.commands.get('hello'), original);
    fs.writeFileSync(settings, 'messages: [invalid yaml');
    assert.equal(await f.manager.reloadConfig(), false);
    assert.equal(f.client.config.commands.hello.messages.greeting, 'Hello from settings');
});
