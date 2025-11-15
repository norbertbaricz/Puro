const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { withEconomy, ensureUserRecord } = require('../../lib/economy');
const { getJobById } = require('../../lib/jobs');
const { parseColor, pickRandom, randomInt, randomFloat, formatTemplate } = require('../../lib/utils');

module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Complete a shift at your current job to earn money.')
        .setDMPermission(false)
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you (ephemeral)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const isPrivate = interaction.options.getBoolean('private') || false;
        const config = interaction.client.config?.commands?.work || {};
        const messages = config.messages || {};

        if (typeof interaction.inGuild === 'function' ? !interaction.inGuild() : !interaction.guild) {
            const reply = messages.guild_only || '❌ This command can only be used inside a server.';
            await interaction.reply({ content: reply, flags: MessageFlags.Ephemeral });
            return;
        }

        const colors = {
            success: parseColor(config.color_success || '#2ECC71', '#2ECC71'),
            neutral: parseColor(config.color_neutral || '#F1C40F', '#F1C40F'),
            failure: parseColor(config.color_failure || '#ED4245', '#ED4245')
        };

        const canUseEphemeral = typeof interaction.inGuild === 'function'
            ? interaction.inGuild()
            : Boolean(interaction.guildId);
        const shouldBeEphemeral = Boolean(isPrivate && canUseEphemeral);
        const ackMessage = messages.processing || '⌛ Starting your shift...';

        try {
            await interaction.reply({
                content: ackMessage,
                flags: shouldBeEphemeral ? MessageFlags.Ephemeral : undefined,
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            if (error?.code === 10062) {
                console.warn('[work] Interaction token expired before initial reply.', { interactionId: interaction.id });
                return;
            }
            throw error;
        }

        const updateReply = (payload) => interaction.editReply({ content: null, ...payload });

        const workResult = await withEconomy((db) => {
            const entry = ensureUserRecord(db, interaction.user.id);

            if (!entry.job) {
                return { outcome: 'no-job' };
            }

            const job = getJobById(entry.job.id);
            if (!job) {
                entry.job = null;
                return { outcome: 'job-missing' };
            }

            const now = Date.now();
            const cooldownSeconds = Math.max(10, job.work.cooldownSeconds || 60);
            const elapsed = now - (entry.job.lastWorkedAt || 0);
            const remaining = cooldownSeconds * 1000 - elapsed;
            if (remaining > 0) {
                return {
                    outcome: 'cooldown',
                    readyAt: now + remaining,
                    job
                };
            }

            const failureChance = typeof job.work.failureChance === 'number' ? job.work.failureChance : 0;
            const failed = Math.random() < failureChance;

            if (failed) {
                entry.job.lastWorkedAt = now;
                entry.job.streak = 0;
                entry.jobStats.failedShifts = (entry.jobStats.failedShifts || 0) + 1;

                let penalty = 0;
                if (job.work.failurePenaltyRange) {
                    const { min = 0, max = 0 } = job.work.failurePenaltyRange;
                    if (max > 0) {
                        penalty = randomInt(min, max);
                        entry.balance = Math.max(0, entry.balance - penalty);
                    }
                }

                return {
                    outcome: 'failure',
                    job,
                    penalty,
                    balance: entry.balance
                };
            }

            const payRange = job.work?.payRange || { min: 0, max: 0 };
            const { min, max } = payRange;
            let basePay = randomInt(min, max);
            if (basePay < 0) basePay = 0;

            let totalPay = basePay;
            let bonusApplied = false;
            if (job.work.bonusChance && job.work.bonusMultiplier) {
                if (Math.random() < job.work.bonusChance) {
                    const multi = randomFloat(job.work.bonusMultiplier.min || 1, job.work.bonusMultiplier.max || 1);
                    totalPay = Math.max(basePay, Math.round(basePay * multi));
                    bonusApplied = totalPay > basePay;
                }
            }

            entry.balance += totalPay;
            entry.job.lastWorkedAt = now;
            entry.job.streak = (entry.job.streak || 0) + 1;
            entry.jobStats.shiftsCompleted = (entry.jobStats.shiftsCompleted || 0) + 1;
            entry.jobStats.totalEarned = (entry.jobStats.totalEarned || 0) + totalPay;

            return {
                outcome: 'success',
                job,
                totalPay,
                basePay,
                bonusApplied,
                balance: entry.balance,
                streak: entry.job.streak
            };
        });

        if (workResult.outcome === 'no-job') {
            const embed = new EmbedBuilder()
                .setColor(colors.neutral)
                .setTitle(messages.no_job_title || 'No job found')
                .setDescription(messages.no_job || 'You do not have a job yet. Use /job to browse roles and get hired.');
            await updateReply({ embeds: [embed] });
            return;
        }

        if (workResult.outcome === 'job-missing') {
            const embed = new EmbedBuilder()
                .setColor(colors.failure)
                .setTitle(messages.job_missing_title || 'Job unavailable')
                .setDescription(messages.job_missing || 'Your previous job no longer exists. Please apply for a new one.');
            await updateReply({ embeds: [embed] });
            return;
        }

        if (workResult.outcome === 'cooldown') {
            const embed = new EmbedBuilder()
                .setColor(colors.neutral)
                .setTitle(messages.cooldown_title || 'Take a breather')
                .setDescription(formatTemplate(messages.cooldown || 'You need to rest for {time} before working again.', {
                    time: `<t:${Math.floor(workResult.readyAt / 1000)}:R>`
                }));
            await updateReply({ embeds: [embed] });
            return;
        }

        if (workResult.outcome === 'failure') {
            const failureMessage = pickRandom(workResult.job.work.failureMessages, messages.failure_default);
            const embed = new EmbedBuilder()
                .setColor(colors.failure)
                .setTitle(messages.failure_title || 'Shift failed')
                .setDescription(failureMessage || 'The shift did not go well this time.')
                .addFields({
                    name: messages.field_balance || 'Balance',
                    value: `💰 $${workResult.balance.toLocaleString()}`,
                    inline: true
                });

            if (workResult.penalty > 0) {
                embed.addFields({
                    name: messages.field_penalty || 'Penalty',
                    value: `-$${workResult.penalty.toLocaleString()}`,
                    inline: true
                });
            }

            await updateReply({ embeds: [embed] });
            return;
        }

        const successMessage = pickRandom(workResult.job.work.successMessages, messages.success_default);
        const bonusMessage = pickRandom(workResult.job.work.bonusMessages, messages.bonus_default);

        const embed = new EmbedBuilder()
            .setColor(colors.success)
            .setTitle(formatTemplate(messages.success_title || '{job} shift complete!', {
                job: workResult.job.name,
                emoji: workResult.job.emoji
            }))
            .setDescription(successMessage || 'Great work! You completed your shift successfully.')
            .addFields(
                { name: messages.field_earnings || 'Earnings', value: `+$${workResult.totalPay.toLocaleString()}`, inline: true },
                { name: messages.field_balance || 'Balance', value: `💰 $${workResult.balance.toLocaleString()}`, inline: true },
                { name: messages.field_streak || 'Shift streak', value: `${workResult.streak}`, inline: true }
            )
            .setTimestamp();

        if (workResult.bonusApplied && workResult.totalPay > workResult.basePay) {
            const bonusDelta = workResult.totalPay - workResult.basePay;
            embed.addFields({
                name: messages.field_bonus || 'Bonus',
                value: `${bonusMessage || messages.bonus_default || 'You received a bonus!'} (+$${bonusDelta.toLocaleString()})`,
                inline: false
            });
        }

        await updateReply({ embeds: [embed] });
    }
};
