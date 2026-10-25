process.env.LOG_LEVEL = 'FATAL';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createJobView } = require('../../src/features/jobs/view');
const { buildAnnouncementPayload } = require('../../src/features/giveaways/view');
const { validatePayload } = require('../../src/core/ui/validate');

test('job menus stay within the Discord 25-option limit across every page', () => {
    const jobs = Array.from({ length: 51 }, (_, index) => ({
        id: `job${index}`,
        emoji: '💼',
        name: `Job ${index}`,
        description: 'A job.',
    }));
    const state = { entry: {}, jobPage: 0 };
    const view = createJobView(state, jobs, {}, { primary: 0xff1493 });
    const shown = [];
    for (let page = 0; page < 3; page++) {
        state.jobPage = page;
        const select = view.buildSelect();
        const buttons = view.buildButtons();
        validatePayload({ embeds: [view.buildEmbed()], components: [select, buttons] });
        const options = select.toJSON().components[0].options;
        assert.ok(options.length <= 25);
        shown.push(...options.map((option) => option.value));
        const controls = buttons.toJSON().components;
        assert.equal(new Set(controls.map((button) => button.custom_id)).size, controls.length);
        assert.equal(controls[0].disabled, page === 0);
        assert.equal(controls[1].disabled, page === 2);
    }
    assert.deepEqual(
        shown,
        jobs.map((job) => job.id),
    );
});

test('giveaway cards handle missing media and invalid source dates', () => {
    const payload = buildAnnouncementPayload({
        title: 'A free game',
        description: 'Claim it.',
        instructions: 'Visit the store.',
        platforms: 'Steam',
        published_date: 'N/A',
        end_date: 'N/A',
        worth: '$20',
        open_giveaway_url: 'https://store.steampowered.com/',
    });
    assert.doesNotThrow(() => validatePayload(payload));
    const embed = payload.embeds[0].toJSON();
    assert.ok(Number.isFinite(Date.parse(embed.timestamp)));
    assert.equal(embed.title, 'A free game');
    assert.equal(payload.components[0].toJSON().components[0].url, 'https://store.steampowered.com/');
});
