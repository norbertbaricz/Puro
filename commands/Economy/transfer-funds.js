const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { readEconomyDB, writeEconomyDB, ensureUserRecord } = require('../../lib/economy');

module.exports = {
    category: 'Economy',
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Send money to another member (with taxes and risks!).')
        .addUserOption(option =>
            option.setName('member')
                .setDescription('The member you want to pay')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('The amount of money to send')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('note')
                .setDescription('Optional note for the recipient (max 200 chars)')
                .setMaxLength(200)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('anonymous')
                .setDescription('Hide your name in the recipient DM')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('dm_recipient')
                .setDescription('DM the recipient about this transfer')
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option.setName('private')
                .setDescription('Reply only to you (ephemeral)')
                .setRequired(false)
        ),
    async execute(interaction) {
        const sender = interaction.user;
        const receiver = interaction.options.getUser('member');
        const amount = interaction.options.getInteger('amount');
        const note = (interaction.options.getString('note') || '').trim();
        const anonymous = interaction.options.getBoolean('anonymous') || false;
        const dmRecipient = interaction.options.getBoolean('dm_recipient') || false;
        const isPrivate = interaction.options.getBoolean('private') || false;

        const baseEmbed = new EmbedBuilder()
            .setFooter({ text: `Transaction initiated by ${sender.username}` })
            .setTimestamp();

        // --- Input Validation ---
        if (receiver.id === sender.id) {
            return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('❌ Transaction Failed: Self-Payment')
                        .setDescription('You cannot send money to yourself. Please choose another member.')
                        .setColor(0xED4245) // Red
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        
        if (receiver.bot) {
             return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('❌ Transaction Failed: Invalid Recipient')
                        .setDescription('You cannot send money to a bot.')
                        .setColor(0xED4245) // Red
                ],
                flags: MessageFlags.Ephemeral
            });
        }

        if (amount <= 0) {
             return await interaction.reply({
                embeds: [
                    baseEmbed
                        .setTitle('❌ Transaction Failed: Invalid Amount')
                        .setDescription('The amount must be a positive number greater than zero.')
                        .setColor(0xED4245) // Red
                ],
                flags: MessageFlags.Ephemeral
            });
        }
        
        await interaction.deferReply({ flags: isPrivate ? MessageFlags.Ephemeral : undefined });

        // --- Transaction Tax Logic ---
        const db = readEconomyDB();
        // --- Ensure users exist in the new DB format ---
        const senderData = ensureUserRecord(db, sender.id);
        const receiverData = ensureUserRecord(db, receiver.id);

        const taxRate = 0.05; // 5% tax
        const taxAmount = Math.ceil(amount * taxRate);
        const totalDeduction = amount + taxAmount;

        if (senderData.balance < totalDeduction) {
            const insufficientEmbed = EmbedBuilder.from(baseEmbed)
                .setTitle('🏦 Transaction Failed: Insufficient Funds')
                .setDescription('You do not have enough money to complete this transaction.')
                .addFields(
                    { name: 'Your Balance', value: `💰 $${senderData.balance.toLocaleString()}`, inline: true },
                    { name: 'Required Amount', value: `💸 $${amount.toLocaleString()}`, inline: true },
                    { name: 'Transaction Tax (5%)', value: `🧾 $${taxAmount.toLocaleString()}`, inline: true },
                    { name: 'Total Needed', value: `🚨 **$${totalDeduction.toLocaleString()}**`, inline: false }
                )
                .setColor(0xFEE75C); // Yellow

            if (isPrivate) {
                await interaction.editReply({ embeds: [insufficientEmbed], components: [] });
            } else {
                await interaction.deleteReply().catch(() => {});
                await interaction.followUp({ embeds: [insufficientEmbed], flags: MessageFlags.Ephemeral });
            }
            return;
        }
        // Preview and confirmation
        const preview = new EmbedBuilder()
            .setTitle('Confirm Transfer')
            .setDescription(`Send **$${amount.toLocaleString()}** to ${receiver}?`)
            .addFields(
                { name: 'Tax (5%)', value: `$${taxAmount.toLocaleString()}`, inline: true },
                { name: 'Total Deducted', value: `$${totalDeduction.toLocaleString()}`, inline: true },
                ...(note ? [{ name: 'Note', value: note, inline: false }] : [])
            )
            .setColor(0x5865F2)
            .setFooter({ text: `Transaction initiated by ${sender.username}` })
            .setTimestamp();
        const controls = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pay_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('pay_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('🛑')
        );
        await interaction.editReply({ embeds: [preview], components: [controls] });

        const msg = await interaction.fetchReply();
        const decision = await new Promise(resolve => {
            const collector = msg.createMessageComponentCollector({ time: 30000 });
            collector.on('collect', async i => {
                if (i.user.id !== sender.id) {
                    await i.reply({ content: 'Only the command invoker can use these buttons.', flags: MessageFlags.Ephemeral });
                    return;
                }
                if (i.customId === 'pay_cancel') {
                    collector.stop('cancelled');
                    const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    const cancelled = EmbedBuilder.from(preview).setTitle('Cancelled').setColor(0xff6666);
                    await i.update({ embeds: [cancelled], components: [disabled] });
                    resolve(false);
                }
                if (i.customId === 'pay_confirm') {
                    collector.stop('confirmed');
                    const disabled = new ActionRowBuilder().addComponents(controls.components.map(c => ButtonBuilder.from(c).setDisabled(true)));
                    await i.update({ components: [disabled] });
                    resolve(true);
                }
            });
            collector.on('end', (_c, reason) => {
                if (reason === 'time') resolve(false);
            });
        });
        if (!decision) return;

        // Random negative events (15%)
        const eventChance = Math.random();
        if (eventChance < 0.15) {
            senderData.balance -= amount;
            if (senderData.balance < 0) senderData.balance = 0;
            writeEconomyDB(db);

            const events = [
                { title: '💀 Transaction Intercepted by Hackers! 💀', description: 'A shadowy group of hackers intercepted the data packet! The money is gone.', color: 0x9B59B6 },
                { title: '🔌 Network Error: Packet Lost! 🔌', description: 'A critical network failure occurred. Your transaction vanished into the digital void.', color: 0x34495E },
                { title: '💸 Corrupt Financier Fee! 💸', description: 'A corrupt banker skimmed your entire transaction off the top as a "processing fee".', color: 0xA84300 }
            ];
            const randomEvent = events[Math.floor(Math.random() * events.length)];

            const hackedEmbed = new EmbedBuilder()
                .setTitle(randomEvent.title)
                .setDescription(randomEvent.description)
                .addFields(
                    { name: 'Amount Lost', value: `**-$${amount.toLocaleString()}**`, inline: true },
                    { name: 'Recipient', value: `${receiver.username} (Received nothing)`, inline: true },
                    { name: 'Your New Balance', value: `💰 **$${senderData.balance.toLocaleString()}**`, inline: false }
                )
                .setColor(randomEvent.color)
                .setFooter({ text: `Transaction initiated by ${sender.username}` })
                .setTimestamp();

            await interaction.editReply({ embeds: [hackedEmbed], components: [] });
            return;
        }

        // Success path
        senderData.balance -= totalDeduction;
        receiverData.balance += amount;
        writeEconomyDB(db);

        if (dmRecipient) {
            const recipientName = anonymous ? 'Someone' : sender.username;
            const dmEmbed = new EmbedBuilder()
                .setTitle('💸 You received a payment!')
                .setDescription(`You have received **$${amount.toLocaleString()}** from **${recipientName}**${note ? `\n\nNote: ${note}` : ''}`)
                .setColor(0x57F287)
                .setTimestamp();
            receiver.send({ embeds: [dmEmbed] }).catch(() => {});
        }

        const success = new EmbedBuilder()
            .setTitle('✅ Transaction Successful! ✅')
            .setDescription(`You successfully sent **$${amount.toLocaleString()}** to ${receiver.username}!`)
            .addFields(
                { name: 'Your New Balance', value: `💰 $${senderData.balance.toLocaleString()}`, inline: true },
                { name: "Recipient's New Balance", value: `💰 $${receiverData.balance.toLocaleString()}`, inline: true },
                { name: 'Tax Paid (5%)', value: `🧾 $${taxAmount.toLocaleString()}`, inline: false },
                ...(note ? [{ name: 'Note', value: note, inline: false }] : [])
            )
            .setColor(0x57F287)
            .setFooter({ text: `Transaction initiated by ${sender.username}` })
            .setTimestamp();

        await interaction.editReply({ embeds: [success], components: [] });
    }
};
