const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags
} = require('discord.js');
const { withEconomy, ensureUserRecord, snapshotEntry } = require('../../lib/economy');
const { getAllJobs, getJobById, formatPayRange } = require('../../lib/jobs');
const { parseColor, pickRandom, formatTemplate } = require('../../lib/utils');

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
        `• ${messages.failure_label || 'Failure Risk'}: ${formatPercent(job.work.failureChance || 0)}`
    ];
    return lines.join('\n');
}

module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('job')
        .setDescription('Browse jobs, view details, and manage your employment with one command.')
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you (ephemeral)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const isPrivate = interaction.options.getBoolean('private') || false;
        const config = interaction.client.config?.commands?.job || {};
        const messages = config.messages || {};
        const colors = {
            primary: parseColor(config.color || '#5865F2', '#5865F2'),
            success: parseColor(config.color_success || config.color || '#2ECC71', '#2ECC71'),
            failure: parseColor(config.color_failure || '#ED4245', '#ED4245')
        };

        const jobs = getAllJobs();

        const loadProfile = async () => {
            return withEconomy((db) => {
                const record = ensureUserRecord(db, interaction.user.id);
                return { entry: snapshotEntry(record) };
            });
        };

        const profile = await loadProfile();

        const state = {
            entry: profile.entry,
            selectedJobId: profile.entry.job?.id || null,
            currentJobId: profile.entry.job?.id || null,
            flashMessage: null,
            flashVariant: 'info'
        };

        const buildSelect = (options = {}) => {
            const menu = new StringSelectMenuBuilder()
                .setCustomId('job_select')
                .setPlaceholder(messages.select_placeholder || 'Pick a job to view details')
                .setMinValues(1)
                .setMaxValues(1)
                .addOptions(jobs.map(job => ({
                    label: `${job.emoji} ${job.name}`,
                    value: job.id,
                    description: job.description.slice(0, 90),
                    default: state.selectedJobId === job.id
                })));
            if (options.disabled) {
                menu.setDisabled(true);
            }
            return new ActionRowBuilder().addComponents(menu);
        };

        const buildButtons = () => {
            if (state.currentJobId) {
                const quit = new ButtonBuilder()
                    .setCustomId('job_quit')
                    .setLabel(messages.quit_button || 'Quit current job')
                    .setStyle(ButtonStyle.Danger);
                return new ActionRowBuilder().addComponents(quit);
            }
            const apply = new ButtonBuilder()
                .setCustomId('job_apply')
                .setLabel(messages.apply_button || 'Apply for job')
                .setStyle(ButtonStyle.Success)
                .setDisabled(!state.selectedJobId);
            return new ActionRowBuilder().addComponents(apply);
        };

        const buildEmbed = () => {
            const embedColor = state.flashVariant === 'success'
                ? colors.success
                : state.flashVariant === 'failure'
                    ? colors.failure
                    : colors.primary;

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(messages.list_title || 'Job Board');

            const banner = state.flashMessage || messages.list_description || 'Select a job from the menu to view details and apply.';
            embed.setDescription(banner);

            const entry = state.entry;
            const jobIdToShow = state.selectedJobId;
            const job = jobIdToShow ? getJobById(jobIdToShow) : null;
            if (job) {
                embed.addFields({
                    name: `${job.emoji} ${job.name}`,
                    value: buildJobDescription(job, messages),
                    inline: false
                });
            }

            if (entry?.job?.id) {
                const activeJob = getJobById(entry.job.id);
                const stats = entry.jobStats || {};
                const details = [
                    activeJob ? `${activeJob.emoji} ${activeJob.name}` : state.currentJobId,
                    messages.current_since
                        ? formatTemplate(messages.current_since, { time: `<t:${Math.floor((entry.job?.hiredAt || Date.now()) / 1000)}:R>` })
                        : `Since: <t:${Math.floor((entry.job?.hiredAt || Date.now()) / 1000)}:R>`,
                    `Shifts: ${stats.shiftsCompleted || 0} • Failures: ${stats.failedShifts || 0}`,
                    `Earned: $${(stats.totalEarned || 0).toLocaleString()}`
                ].join('\n');
                embed.addFields({
                    name: messages.status_title || 'Employment Status',
                    value: details,
                    inline: false
                });
            } else {
                embed.addFields({
                    name: messages.status_title || 'Employment Status',
                    value: messages.status_no_job || 'You are currently unemployed. Pick a role and press Apply to get hired.',
                    inline: false
                });
            }

            return embed;
        };

        const sendInitial = async () => {
            return interaction.reply({
                embeds: [buildEmbed()],
                components: [buildSelect(), buildButtons()],
                flags: isPrivate ? MessageFlags.Ephemeral : undefined
            });
        };

        await sendInitial();
        const message = await interaction.fetchReply();
        const collector = message.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async (componentInteraction) => {
            try {
                if (componentInteraction.user.id !== interaction.user.id) {
                    await componentInteraction.reply({
                        content: messages.not_you || 'Only the command user can interact with this menu.',
                        flags: MessageFlags.Ephemeral
                    });
                    return;
                }

                if (componentInteraction.customId === 'job_select') {
                    state.selectedJobId = componentInteraction.values[0];
                    state.flashVariant = 'info';
                    state.flashMessage = messages.selection_prompt || 'Review the job details, then press Apply when ready.';
                    await componentInteraction.update({
                        embeds: [buildEmbed()],
                        components: [buildSelect(), buildButtons()]
                    });
                    return;
                }

                if (componentInteraction.customId === 'job_apply') {
                    if (state.currentJobId) {
                        await componentInteraction.reply({
                            content: messages.already_employed || 'You already have a job. Quit first before applying again.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }
                    if (!state.selectedJobId) {
                        await componentInteraction.reply({
                            content: messages.no_selection || 'Select a job before applying.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    const job = getJobById(state.selectedJobId);
                    if (!job) {
                        await componentInteraction.reply({
                            content: messages.job_not_found || 'That job is no longer available.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    await componentInteraction.deferUpdate();

                    const outcome = await withEconomy((db) => {
                        const record = ensureUserRecord(db, interaction.user.id);

                        if (record.job) {
                            return { status: 'already-employed', entry: snapshotEntry(record) };
                        }

                        if (!job) {
                            return { status: 'missing', entry: snapshotEntry(record) };
                        }

                        const hireRoll = Math.random();
                        const hired = hireRoll <= (job.apply.baseSuccessRate || 0);

                        if (hired) {
                            record.job = {
                                id: job.id,
                                hiredAt: Date.now(),
                                lastWorkedAt: 0,
                                streak: 0
                            };
                            record.jobStats = {
                                shiftsCompleted: 0,
                                failedShifts: 0,
                                totalEarned: 0
                            };
                        }

                        return {
                            status: hired ? 'hired' : 'rejected',
                            entry: snapshotEntry(record),
                            job
                        };
                    });

                    if (outcome.status === 'already-employed') {
                        await componentInteraction.followUp({
                            content: messages.already_employed || 'You already have a job. Quit first before applying again.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    state.entry = outcome.entry;
                    state.currentJobId = outcome.entry.job?.id || null;
                    state.selectedJobId = outcome.entry.job?.id || state.selectedJobId;

                    if (outcome.status === 'hired') {
                        state.flashMessage = `${formatTemplate(messages.apply_title || 'You are hired for {job}!', {
                            job: `${job.emoji} ${job.name}`
                        })}\n${pickRandom(job.apply.successMessages, messages.apply_success || 'Welcome aboard!')}`;
                        state.flashVariant = 'success';
                        await interaction.editReply({
                            embeds: [buildEmbed()],
                            components: [buildSelect({ disabled: true }), buildButtons()]
                        });
                        return;
                    }

                    state.flashMessage = pickRandom(job.apply.failureMessages, messages.apply_failure || 'Unfortunately you were not hired this time.');
                    state.flashVariant = 'failure';
                    await interaction.editReply({
                        embeds: [buildEmbed()],
                        components: [buildSelect(), buildButtons()]
                    });
                    return;
                }

                if (componentInteraction.customId === 'job_quit') {
                    if (!state.currentJobId) {
                        await componentInteraction.reply({
                            content: messages.quit_no_job || 'You are not currently employed.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    const outcome = await withEconomy((db) => {
                        const record = ensureUserRecord(db, interaction.user.id);
                        if (!record.job) {
                            return { status: 'no-job', entry: snapshotEntry(record) };
                        }

                        const previousJob = record.job.id;
                        record.job = null;
                        if (record.jobStats) {
                            record.jobStats.shiftsCompleted = 0;
                            record.jobStats.failedShifts = 0;
                            record.jobStats.totalEarned = 0;
                        }

                        return {
                            status: 'quit',
                            entry: snapshotEntry(record),
                            previousJob
                        };
                    });

                    if (outcome.status === 'no-job') {
                        await componentInteraction.reply({
                            content: messages.quit_no_job || 'You are not currently employed.',
                            flags: MessageFlags.Ephemeral
                        });
                        return;
                    }

                    state.entry = outcome.entry;
                    state.currentJobId = null;
                    state.selectedJobId = null;
                    const oldJob = getJobById(outcome.previousJob);
                    state.flashMessage = formatTemplate(messages.quit_success || 'You left your job as {job}.', {
                        job: oldJob ? `${oldJob.emoji} ${oldJob.name}` : 'your previous position'
                    });
                    state.flashVariant = 'success';

                    await componentInteraction.update({
                        embeds: [buildEmbed()],
                        components: [buildSelect(), buildButtons()]
                    });
                    return;
                }
            } catch (error) {
                console.error('Job center component error:', error);
                const responsePayload = {
                    content: 'Something went wrong handling that action.',
                    flags: MessageFlags.Ephemeral
                };
                try {
                    if (componentInteraction.deferred || componentInteraction.replied) {
                        await componentInteraction.followUp(responsePayload);
                    } else if (componentInteraction.isRepliable()) {
                        await componentInteraction.reply(responsePayload);
                    }
                } catch (followUpError) {
                    if (followUpError?.code !== 10062) {
                        console.error('Failed to notify job interaction error:', followUpError);
                    }
                }
            }
        });

        collector.on('end', async () => {
            try {
                await interaction.editReply({
                    components: []
                });
            } catch {
                // Ignore edit errors if message already removed/updated
            }
        });
    }
};
