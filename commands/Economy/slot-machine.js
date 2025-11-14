const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { withEconomy, ensureUserRecord } = require('../../lib/economy');
const { pickRandom, formatCurrency } = require('../../lib/utils');

// --- Slot machine configuration ---
// Weights control rarity; payouts define multipliers for matches
const SYMBOLS = [
    { emoji: '7️⃣', name: 'Seven', weight: 2, payouts: { '3': 20, '2': 4 } },
    { emoji: '🍒', name: 'Cherry', weight: 10, payouts: { '3': 8, '2': 1.5 } },
    { emoji: '🔔', name: 'Bell', weight: 6, payouts: { '3': 5 } },
    { emoji: '⭐', name: 'Star', weight: 6, payouts: { '3': 4 } },
    { emoji: '🍇', name: 'Grapes', weight: 7, payouts: { '3': 3 } },
    { emoji: '🍋', name: 'Lemon', weight: 8, payouts: { '3': 2 } },
    { emoji: '🍀', name: 'Clover', weight: 5, payouts: { '3': 3 } },
];

const totalWeight = SYMBOLS.reduce((s, sym) => s + sym.weight, 0);

function spinSymbol() {
    let roll = Math.random() * totalWeight;
    for (const sym of SYMBOLS) {
        if (roll < sym.weight) {
            return sym;
        }
        roll -= sym.weight;
    }
    return SYMBOLS[SYMBOLS.length - 1];
}

function spinColumn() {
    return [spinSymbol(), spinSymbol(), spinSymbol()];
}

function spinGrid() {
    return [spinColumn(), spinColumn(), spinColumn()];
}

function renderGrid(grid) {
    return grid[0].map((_, rowIdx) =>
        grid.map(column => column[rowIdx].emoji).join(' │ ')
    ).join('\n');
}

function evaluateGrid(grid, bet) {
    const middle = grid.map(column => column[1]);
    const [a, b, c] = middle;
    const counts = middle.reduce((acc, symbol) => {
        acc[symbol.emoji] = (acc[symbol.emoji] || 0) + 1;
        return acc;
    }, {});

    let multiplier = 0;
    let result = 'loss';
    let label = null;

    if (a === b && b === c) {
        multiplier = a.payouts?.['3'] || 0;
        label = `${a.name} x3`;
        result = multiplier >= 15 ? 'jackpot' : 'win';
    } else if ((counts['7️⃣'] || 0) >= 2) {
        multiplier = SYMBOLS[0].payouts?.['2'] || 0;
        label = 'Lucky Sevens';
        result = 'partial';
    } else if ((counts['🍒'] || 0) >= 2) {
        multiplier = SYMBOLS[1].payouts?.['2'] || 0;
        label = 'Cherry Pair';
        result = 'partial';
    }

    const payout = Math.max(0, Math.floor(bet * multiplier));
    if (payout > 0 && result === 'loss') {
        result = 'win';
    }

    return {
        multiplier,
        payout,
        label,
        result,
        middle
    };
}

module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('slotmachine')
        .setDescription('🎰 Spin the slot machine for tiered rewards!')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount to bet')
                .setMinValue(1)
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you (ephemeral)')
                .setRequired(false)
        ),

    async execute(interaction) {
        const conf = interaction.client.config?.commands?.slotmachine || {};
        const colorWin = parseInt((conf.color_win || '#2ecc71').replace('#','0x'));
        const colorLose = parseInt((conf.color_lose || '#ed4245').replace('#','0x'));
        const colorInfo = parseInt((conf.color_info || '#5865f2').replace('#','0x'));

        const msgs = conf.messages || {};
        const title = msgs.title || '🎰 Slot Machine';
        const labels = {
            bet: msgs.field_bet || 'Bet',
            multiplier: msgs.field_multiplier || 'Multiplier',
            win: msgs.field_win || 'Winnings',
            loss: msgs.field_loss || 'Loss',
            newBalance: msgs.field_new_balance || 'New Balance',
        };
        const buttons = (msgs.buttons || {});
        const btnLabels = {
            again: buttons.play_again || 'Play Again',
            half: buttons.half || 'Half',
            allin: buttons.all_in || 'All‑in',
            close: buttons.close || 'Close',
        };
        const footers = {
            win: msgs.footer_win || 'Luck is on your side!',
            lose: msgs.footer_lose || 'You lost the bet. Try again!',
        };
        const errors = msgs.errors || {};
        const notYou = msgs.not_you || 'Only you can use these buttons.';

        const fmt = (template, vars) => String(template || '')
            .replace(/\{(\w+)\}|\$\{(\w+)\}/g, (_, a, b) => {
                const k = a || b;
                return (vars && vars[k] !== undefined) ? String(vars[k]) : '';
            });

        const isPrivate = interaction.options.getBoolean('private') || false;
        const baseBet = interaction.options.getInteger('amount');

        const userId = interaction.user.id;

        if (baseBet <= 0 || !Number.isFinite(baseBet)) {
            return interaction.reply({ content: errors.invalid_bet || '❌ Bet amount must be a positive number.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });
        const resolveSpin = (bet) => withEconomy((dbNow) => {
            const userRecord = ensureUserRecord(dbNow, userId);
            if (bet <= 0 || userRecord.balance < bet) {
                const err = fmt(errors.insufficient_funds_bet || '❌ Insufficient funds to bet ${bet}. Balance: ${balance}.', {
                    bet: formatCurrency(bet),
                    balance: formatCurrency(userRecord.balance)
                });
                return { error: err };
            }
            userRecord.balance -= bet;

            const grid = spinGrid();
            const evaluation = evaluateGrid(grid, bet);
            userRecord.balance += evaluation.payout;

            return {
                balance: userRecord.balance,
                grid,
                evaluation,
                bet
            };
        });

        const play = async (bet) => {
            const spin = await resolveSpin(bet);
            if (spin.error) {
                return { error: spin.error };
            }

            const { grid, evaluation } = spin;
            const { multiplier, payout, label, result } = evaluation;
            const gridArt = renderGrid(grid);

            const win = payout > 0;
            const comboLabel = label && payout > 0 ? `**${label}!**` : null;
            const jackpotMsg = pickRandom(msgs.jackpot_variants, msgs.jackpot || '🎉 JACKPOT! Triple match pays out big!');
            const partialMsg = pickRandom(msgs.partial_variants, msgs.partial_win || 'Two-of-a-kind still pays out nicely!');
            const winMsg = pickRandom(msgs.win_variants, msgs.win_message || 'You hit a winning combo!');
            const loseMsg = pickRandom(msgs.lose_variants, msgs.lose_message || 'Better luck on the next spin.');

            let flavour;
            if (result === 'jackpot') {
                flavour = jackpotMsg;
            } else if (result === 'partial') {
                flavour = partialMsg;
            } else if (win) {
                flavour = winMsg;
            } else {
                flavour = loseMsg;
            }

            const multiplierDisplay = multiplier > 0 ? `x${Number.isInteger(multiplier) ? multiplier : multiplier.toFixed(2)}` : 'x0';
            const embedColor = result === 'loss' ? colorLose : (result === 'partial' ? colorInfo : colorWin);
            const footerText = (() => {
                if (result === 'jackpot') return msgs.footer_jackpot || footers.win;
                if (result === 'partial') return msgs.footer_partial || footers.win;
                return win ? footers.win : footers.lose;
            })();

            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(embedColor)
                .setDescription(`${comboLabel ? `${comboLabel}\n` : ''}${flavour}\n\n\`\`\`\n${gridArt}\n\`\`\``)
                .addFields(
                    { name: labels.bet, value: `\`${formatCurrency(bet)}\``, inline: true },
                    { name: labels.multiplier, value: `\`${multiplierDisplay}\``, inline: true },
                    { name: win ? labels.win : labels.loss, value: `\`${formatCurrency(win ? payout : -bet, { sign: 'always' })}\``, inline: true },
                    { name: labels.newBalance, value: `💰 **${formatCurrency(u.balance)}**`, inline: false }
                )
                .setFooter({ text: footerText })
                .setTimestamp();

            if (comboLabel && msgs.field_combo) {
                embed.addFields({ name: msgs.field_combo, value: comboLabel.replace(/\*\*/g, ''), inline: false });
            }

            const controls = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('slots_again').setLabel(btnLabels.again).setEmoji('🔁').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('slots_half').setLabel(btnLabels.half).setEmoji('➗').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('slots_allin').setLabel(btnLabels.allin).setEmoji('💥').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('slots_close').setLabel(btnLabels.close).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
            );

            return {
                embed,
                controls,
                lastBet: bet,
                newBalance: spin.balance
            };
        };

        // First spin
        let view = await play(baseBet);
        if (view.error) {
            await interaction.editReply({ content: view.error });
            return;
        }
        await interaction.editReply({ embeds: [view.embed], components: [view.controls] });

        const msg = await interaction.fetchReply();
        const collector = msg.createMessageComponentCollector({ time: 60000 });
        collector.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
                await i.reply({ content: notYou, flags: MessageFlags.Ephemeral });
                return;
            }
            if (i.customId === 'slots_close') {
                collector.stop('closed');
                const disabled = new ActionRowBuilder().addComponents(view.controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await i.update({ components: [disabled] });
                return;
            }

            // Decide next bet based on button
            let nextBet = view.lastBet;
            if (i.customId === 'slots_half') {
                nextBet = Math.max(1, Math.floor(view.lastBet / 2));
            } else if (i.customId === 'slots_allin') {
                nextBet = Math.max(1, view.newBalance);
            } else if (i.customId === 'slots_again') {
                // keep as lastBet
            }

            // Play next round
            const nextView = await play(nextBet);
            if (nextView.error) {
                await i.reply({ content: nextView.error, flags: MessageFlags.Ephemeral });
                return;
            }
            view = nextView;
            await i.update({ embeds: [view.embed], components: [view.controls] });
        });
        collector.on('end', async (_c, reason) => {
            if (reason === 'time') {
                const disabled = new ActionRowBuilder().addComponents(view.controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                await interaction.editReply({ components: [disabled] }).catch(() => {});
            }
        });
    }
};
