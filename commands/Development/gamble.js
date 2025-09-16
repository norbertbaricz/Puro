const fs = require('fs');
const path = require('path');
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');

// --- Database helpers ---
const dbPath = path.join(__dirname, '../../database.json');

function readDB() {
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, '{}');
        return {};
    }
    try {
        const data = fs.readFileSync(dbPath, 'utf8');
        if (data.trim() === '') return {};
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading or parsing database.json:', err);
        fs.writeFileSync(dbPath, '{}');
        return {};
    }
}

function writeDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function ensureUser(db, userId) {
    if (!db[userId] || typeof db[userId] !== 'object' || db[userId] === null) {
        db[userId] = { balance: typeof db[userId] === 'number' ? db[userId] : 0 };
    }
    if (typeof db[userId].balance !== 'number') db[userId].balance = 0;
    return db[userId];
}

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

function spinReel() {
    let r = Math.random() * totalWeight;
    for (const sym of SYMBOLS) {
        if (r < sym.weight) return sym;
        r -= sym.weight;
    }
    return SYMBOLS[SYMBOLS.length - 1];
}

function evaluate(reels, bet) {
    // reels: array of symbol objects
    const [a, b, c] = reels;
    const counts = new Map();
    for (const s of reels) counts.set(s.emoji, (counts.get(s.emoji) || 0) + 1);

    let multiplier = 0;
    // Three of a kind
    if (a.emoji === b.emoji && b.emoji === c.emoji) {
        multiplier = a.payouts?.['3'] || 0;
    } else {
        // Two 7s special case or two cherries
        const seven = SYMBOLS[0];
        const cherry = SYMBOLS[1];
        if ((counts.get(seven.emoji) || 0) === 2) {
            multiplier = seven.payouts?.['2'] || 0;
        } else if ((counts.get(cherry.emoji) || 0) === 2) {
            multiplier = cherry.payouts?.['2'] || 0;
        } else {
            multiplier = 0; // lose
        }
    }
    // Payout is an integer, round down for fractional multipliers
    const payout = Math.floor(bet * multiplier);
    return { multiplier, payout };
}

module.exports = {
    category: 'Development',
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('🎰 Play slots (cherries & 7s) and win up to 20x!')
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
        const conf = interaction.client.config?.commands?.gamble || {};
        const colorWin = parseInt((conf.color_win || '#2ecc71').replace('#','0x'));
        const colorLose = parseInt((conf.color_lose || '#ed4245').replace('#','0x'));
        const colorInfo = parseInt((conf.color_info || '#5865f2').replace('#','0x'));

        const msgs = conf.messages || {};
        const title = msgs.title || '🎰 Puro Slots';
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
        let db = readDB();
        const user = ensureUser(db, userId);

        if (baseBet <= 0 || !Number.isFinite(baseBet)) {
            return interaction.reply({ content: errors.invalid_bet || '❌ Bet amount must be a positive number.', flags: MessageFlags.Ephemeral });
        }
        if (user.balance < baseBet) {
            const msg = fmt(errors.insufficient_funds || '❌ Insufficient funds. You only have ${balance}.', {
                balance: `$${user.balance.toLocaleString()}`
            });
            return interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        const play = (bet) => {
            // Re-load DB fresh each spin to avoid race conditions within collector
            const dbNow = readDB();
            const u = ensureUser(dbNow, userId);
            if (bet <= 0 || u.balance < bet) {
                const err = fmt(errors.insufficient_funds_bet || '❌ Insufficient funds to bet ${bet}. Balance: ${balance}.', {
                    bet: `$${bet.toLocaleString()}`,
                    balance: `$${u.balance.toLocaleString()}`
                });
                return { error: err };
            }
            // Deduct bet first
            u.balance -= bet;

            const reels = [spinReel(), spinReel(), spinReel()];
            const { multiplier, payout } = evaluate(reels, bet);

            // Credit payout (could be zero)
            u.balance += payout;
            writeDB(dbNow);

            const win = payout > 0;
            const embed = new EmbedBuilder()
                .setTitle(title)
                .setColor(win ? colorWin : colorLose)
                .setDescription(`${reels.map(r => r.emoji).join(' │ ')}`)
                .addFields(
                    { name: labels.bet, value: `\`$${bet.toLocaleString()}\``, inline: true },
                    { name: labels.multiplier, value: win ? `\`x${multiplier}\`` : '`x0`', inline: true },
                    { name: win ? labels.win : labels.loss, value: win ? `\`$${payout.toLocaleString()}\`` : `\`-$${bet.toLocaleString()}\``, inline: true },
                    { name: labels.newBalance, value: `💰 **$${u.balance.toLocaleString()}**`, inline: false }
                )
                .setFooter({ text: win ? footers.win : footers.lose })
                .setTimestamp();

            const controls = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('slots_again').setLabel(btnLabels.again).setEmoji('🔁').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('slots_half').setLabel(btnLabels.half).setEmoji('➗').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('slots_allin').setLabel(btnLabels.allin).setEmoji('💥').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('slots_close').setLabel(btnLabels.close).setEmoji('🗑️').setStyle(ButtonStyle.Danger)
            );

            return { embed, controls, lastBet: bet, newBalance: u.balance };
        };

        // First spin
        let view = play(baseBet);
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
                const dbNow = readDB();
                const uNow = ensureUser(dbNow, userId);
                nextBet = Math.max(1, uNow.balance);
            } else if (i.customId === 'slots_again') {
                // keep as lastBet
            }

            // Play next round
            const nextView = play(nextBet);
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
