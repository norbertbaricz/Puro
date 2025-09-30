const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { readEconomyDB, writeEconomyDB, ensureUserRecord } = require('../../lib/economy');
const { formatCurrency, randomInt, pickRandom } = require('../../lib/utils');

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

const cooldowns = new Map();

module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('pickpocket')
        .setDescription('Try to steal a bit of cash from another member.')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Who do you want to pickpocket?')
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you')
                .setRequired(false)
        ),

    async execute(interaction) {
        const cfg = interaction.client.config.commands.pickpocket || {};
        const msgs = cfg.messages || {};
        const colorSuccess = cfg.color_success || '#2ecc71';
        const colorFail = cfg.color_fail || '#e74c3c';
        const colorWarn = cfg.color_warn || '#f1c40f';

        const isPrivate = interaction.options.getBoolean('private') || false;
        const targetUser = interaction.options.getUser('target');
        const now = Date.now();

        if (!interaction.inGuild()) {
            return interaction.reply({ content: msgs.guild_only || '❌ This command can only be used inside a server.', flags: MessageFlags.Ephemeral });
        }

        const cooldownUntil = cooldowns.get(interaction.user.id) || 0;
        if (cooldownUntil > now) {
            const remaining = Math.ceil((cooldownUntil - now) / 1000);
            const message = (msgs.cooldown_active || '🚓 The police are watching you. Try again in {time}s.').replace('{time}', `${remaining}`);
            return interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
        }

        if (!targetUser || targetUser.id === interaction.user.id) {
            return interaction.reply({ content: msgs.self_target || '❌ You cannot pickpocket yourself.', flags: MessageFlags.Ephemeral });
        }

        if (targetUser.bot) {
            return interaction.reply({ content: msgs.bot_target || '🤖 Bots have no pockets to pick.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        const db = readEconomyDB();
        const thief = ensureUserRecord(db, interaction.user.id);
        const victim = ensureUserRecord(db, targetUser.id);

        const minBalance = Number(cfg.min_balance) || 100;
        if ((victim.balance || 0) < minBalance) {
            const embed = new EmbedBuilder()
                .setColor(colorWarn)
                .setTitle(msgs.too_poor_title || 'No luck!')
                .setDescription((msgs.too_poor_desc || '{target} has barely any money to steal.').replace('{target}', `${targetUser}`))
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        const maxSlice = clamp(Number(cfg.max_percent) || 0.25, 0.05, 0.4);
        const minSlice = clamp(Number(cfg.min_percent) || 0.05, 0.01, maxSlice);

        const targetBalance = victim.balance;
        const minSteal = Math.max(10, Math.floor(targetBalance * minSlice));
        const maxSteal = Math.max(minSteal, Math.floor(targetBalance * maxSlice));

        const amount = randomInt(minSteal, maxSteal);

        const difficulty = amount / targetBalance;
        const baseChance = Number(cfg.base_success) || 0.8;
        const successProbability = clamp(baseChance - difficulty * (Number(cfg.difficulty_weight) || 1.5), 0.05, 0.9);
        const rolled = Math.random();

        if (rolled <= successProbability) {
            const stolen = Math.min(amount, victim.balance);
            victim.balance -= stolen;
            thief.balance += stolen;
            writeEconomyDB(db);

            const embed = new EmbedBuilder()
                .setColor(colorSuccess)
                .setTitle(msgs.success_title || 'Successful Pickpocket!')
                .setDescription((msgs.success_desc || 'You slipped some cash from {target}!').replace('{target}', `${targetUser}`))
                .addFields(
                    { name: msgs.amount_label || 'Stolen', value: formatCurrency(stolen, { sign: 'always' }), inline: true },
                    { name: msgs.success_chance_label || 'Chance', value: `${Math.round(successProbability * 100)}%`, inline: true },
                    { name: msgs.thief_balance_label || 'Your Balance', value: formatCurrency(thief.balance), inline: true },
                    { name: msgs.victim_balance_label || "Victim's Balance", value: formatCurrency(victim.balance), inline: true }
                )
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // Failure outcomes with richer branches
        const scenarios = [
            {
                key: 'caught',
                type: 'repay',
                payVictim: true,
                multiplier: Number(cfg.fail_return_multiplier) || 1,
                color: colorFail
            },
            {
                key: 'jail',
                type: 'jail',
                payVictim: false,
                multiplier: Number(cfg.fail_fine_multiplier) || 1.5,
                color: colorWarn
            },
            {
                key: 'escape_drop',
                type: 'escape_drop',
                payVictim: false,
                dropMultiplier: Number(cfg.escape_drop_multiplier) || 0.4,
                color: colorWarn
            },
            {
                key: 'escape_clean',
                type: 'escape_clean',
                payVictim: false,
                multiplier: 0,
                color: colorWarn
            },
            {
                key: 'fight_win',
                type: 'fight_win',
                payVictim: false,
                bonusMultiplier: Number(cfg.fight_win_multiplier) || 1.8,
                color: colorSuccess
            },
            {
                key: 'fight_loss',
                type: 'fight_loss',
                payVictim: false,
                multiplier: Number(cfg.fight_loss_multiplier) || 2,
                color: colorFail
            }
        ];

        const outcome = pickRandom(scenarios);

        if (outcome.type === 'fight_win') {
            const bonus = Math.max(10, Math.floor(amount * outcome.bonusMultiplier));
            const stolen = Math.min(bonus, victim.balance);
            victim.balance -= stolen;
            thief.balance += stolen;
            writeEconomyDB(db);

            const embed = new EmbedBuilder()
                .setColor(outcome.color)
                .setTitle((msgs.fail_fight_win_title || msgs.success_title) || 'Brawl Victory!')
                .setDescription((msgs.fail_fight_win_desc || 'You fought {target} and grabbed a bigger haul!').replace('{target}', `${targetUser}`))
                .addFields(
                    { name: msgs.amount_label || 'Stolen', value: formatCurrency(stolen, { sign: 'always' }), inline: true },
                    { name: msgs.success_chance_label || 'Chance', value: `${Math.round(successProbability * 100)}%`, inline: true },
                    { name: msgs.thief_balance_label || 'Your Balance', value: formatCurrency(thief.balance), inline: true }
                )
                .setTimestamp();

            embed.addFields({ name: msgs.victim_balance_label || "Victim's Balance", value: formatCurrency(victim.balance), inline: true });

            await interaction.editReply({ embeds: [embed] });
            return;
        }

        let penalty = 0;
        let drop = 0;

        if (outcome.type === 'escape_drop') {
            drop = Math.min(Math.floor(amount * (outcome.dropMultiplier || 0.4)), thief.balance);
            thief.balance -= drop;
        } else if (outcome.type === 'escape_clean') {
            // nothing lost
        } else {
            penalty = Math.max(0, Math.floor(amount * (outcome.multiplier || 0)));
            if (outcome.payVictim && penalty > 0) {
                const actual = Math.min(penalty, thief.balance);
                thief.balance -= actual;
                victim.balance += actual;
                penalty = actual;
            } else if (penalty > 0) {
                const actual = Math.min(penalty, thief.balance);
                thief.balance -= actual;
                penalty = actual;
            }
        }

        if (outcome.type === 'jail') {
            const cooldownMs = Number(cfg.jail_cooldown_ms) || 10 * 60 * 1000;
            cooldowns.set(interaction.user.id, Date.now() + cooldownMs);
        }

        writeEconomyDB(db);

        const embed = new EmbedBuilder()
            .setColor(outcome.color)
            .setTitle((msgs[`fail_${outcome.key}_title`] || msgs.fail_title) || 'Caught in the act!')
            .setDescription((msgs[`fail_${outcome.key}_desc`] || msgs.fail_desc || '{target} noticed and things went south.').replace('{target}', `${targetUser}`))
            .addFields(
                { name: msgs.amount_label || 'Attempted', value: formatCurrency(amount, { sign: 'always' }), inline: true },
                { name: msgs.success_chance_label || 'Chance', value: `${Math.round(successProbability * 100)}%`, inline: true },
                { name: msgs.thief_balance_label || 'Your Balance', value: formatCurrency(thief.balance), inline: true }
            )
            .setTimestamp();

        if (penalty > 0) {
            const penaltyFieldName = outcome.payVictim
                ? (msgs.penalty_paid_label || 'Paid to victim')
                : (msgs.penalty_fine_label || 'Fine Paid');
            embed.addFields({ name: penaltyFieldName, value: formatCurrency(penalty, { sign: '-' }), inline: true });
        }

        if (drop > 0) {
            embed.addFields({ name: msgs.drop_label || 'Lost while fleeing', value: formatCurrency(drop, { sign: '-' }), inline: true });
        }

        if (outcome.payVictim) {
            embed.addFields({ name: msgs.victim_balance_label || "Victim's Balance", value: formatCurrency(victim.balance), inline: true });
        }

        await interaction.editReply({ embeds: [embed] });
    }
};
