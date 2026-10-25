const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getJobById, formatPayRange } = require('../../services/economy/jobs');
const { formatTemplate } = require('../../shared/utils');

const JOBS_PER_PAGE = 25;

function formatPercent(value) {
    return `${Math.round((value || 0) * 100)}%`;
}

function buildJobDescription(job, messages) {
    const lines = [
        job.description,
        '',
        `• ${messages.pay_label || 'Pay Range'}: ${formatPayRange(job)}`,
        `• ${messages.cooldown_label || 'Cooldown'}: ${job.work.cooldownSeconds}s`,
        `• ${messages.success_label || 'Hire Chance'}: ${formatPercent(job.apply.baseSuccessRate)}`,
        `• ${messages.bonus_label || 'Bonus Chance'}: ${formatPercent(job.work.bonusChance || 0)}`,
        `• ${messages.failure_label || 'Failure Risk'}: ${formatPercent(job.work.failureChance || 0)}`,
    ];
    return lines.join('\n');
}

function createJobView(state, jobs, messages, colors) {
    const pageCount = Math.max(1, Math.ceil(jobs.length / JOBS_PER_PAGE));
    state.jobPage = Math.min(pageCount - 1, Math.max(0, state.jobPage || 0));
    const buildSelect = (options = {}) => {
        const menu = new StringSelectMenuBuilder()
            .setCustomId('job_select')
            .setPlaceholder(messages.select_placeholder || 'Pick a job to view details')
            .setMinValues(1)
            .setMaxValues(1)
            .addOptions(
                jobs.slice(state.jobPage * JOBS_PER_PAGE, (state.jobPage + 1) * JOBS_PER_PAGE).map((job) => ({
                    label: `${job.emoji} ${job.name}`.slice(0, 100),
                    value: job.id,
                    description: job.description.slice(0, 90),
                    default: state.selectedJobId === job.id,
                })),
            );
        if (options.disabled) {
            menu.setDisabled(true);
        }
        return new ActionRowBuilder().addComponents(menu);
    };

    const buildButtons = () => {
        const row = new ActionRowBuilder();
        if (pageCount > 1)
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('job_previous')
                    .setLabel('Previous jobs')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(state.jobPage <= 0),
                new ButtonBuilder()
                    .setCustomId('job_next')
                    .setLabel('More jobs')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(state.jobPage >= pageCount - 1),
            );
        if (state.currentJobId) {
            const quit = new ButtonBuilder()
                .setCustomId('job_quit')
                .setLabel(messages.quit_button || 'Quit current job')
                .setStyle(ButtonStyle.Danger);
            return row.addComponents(quit);
        }
        const apply = new ButtonBuilder()
            .setCustomId('job_apply')
            .setLabel(messages.apply_button || 'Apply for job')
            .setStyle(ButtonStyle.Success)
            .setDisabled(!state.selectedJobId);
        return row.addComponents(apply);
    };

    const buildEmbed = () => {
        const embedColor =
            state.flashVariant === 'success'
                ? colors.success
                : state.flashVariant === 'failure'
                  ? colors.failure
                  : colors.primary;

        const embed = new EmbedBuilder().setColor(embedColor).setTitle(messages.list_title || 'Job Board');

        const banner =
            state.flashMessage || messages.list_description || 'Select a job from the menu to view details and apply.';
        embed.setDescription(banner);

        const entry = state.entry;
        const jobIdToShow = state.selectedJobId;
        const job = jobIdToShow ? getJobById(jobIdToShow) : null;
        if (job) {
            embed.addFields({
                name: `${job.emoji} ${job.name}`,
                value: buildJobDescription(job, messages),
                inline: false,
            });
        }

        if (entry?.job?.id) {
            const activeJob = getJobById(entry.job.id);
            const stats = entry.jobStats || {};
            const details = [
                activeJob ? `${activeJob.emoji} ${activeJob.name}` : state.currentJobId,
                messages.current_since
                    ? formatTemplate(messages.current_since, {
                          time: `<t:${Math.floor((entry.job?.hiredAt || Date.now()) / 1000)}:R>`,
                      })
                    : `Since: <t:${Math.floor((entry.job?.hiredAt || Date.now()) / 1000)}:R>`,
                `Shifts: ${stats.shiftsCompleted || 0} • Failures: ${stats.failedShifts || 0}`,
                `Earned: $${(stats.totalEarned || 0).toLocaleString()}`,
            ].join('\n');
            embed.addFields({
                name: messages.status_title || 'Employment Status',
                value: details,
                inline: false,
            });
        } else {
            embed.addFields({
                name: messages.status_title || 'Employment Status',
                value:
                    messages.status_no_job || 'You are currently unemployed. Pick a role and press Apply to get hired.',
                inline: false,
            });
        }

        return embed;
    };

    return { buildSelect, buildButtons, buildEmbed };
}

module.exports = { createJobView };
