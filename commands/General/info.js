const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { exec } = require('child_process');
const os = require('os');

function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        if (stderr) console.warn(`Stderr from command "${command}": ${stderr}`);
        reject(new Error(`Command failed: ${error.message}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function getSystemHardwareInfo() {
  let cpuTemperature = 'N/A';
  let batteryPercentage = 'N/A';
  if (os.type() === 'Linux') {
    try {
      const tempOutput = await executeCommand("sensors | grep 'Core 0' | awk '{print $3}'");
      const m = tempOutput.match(/\+([\d.]+)°C/);
      if (m && m[1]) cpuTemperature = `${m[1]}°C`;
    } catch (e) {
      console.warn('CPU temp unavailable:', e.message);
    }
    try {
      const batteryOutput = await executeCommand('acpi -b');
      const b = batteryOutput.match(/(\d+)%/);
      if (b && b[1]) batteryPercentage = `${b[1]}%`;
    } catch (e) {
      console.warn('Battery percent unavailable:', e.message);
    }
  }
  return { cpuTemperature, batteryPercentage };
}

module.exports = {
  category: 'General',
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Displays various information about the bot.')
    .addStringOption(option =>
      option.setName('type').setDescription('Which information to display?').setRequired(false).addChoices(
        { name: 'Creator', value: 'creator' },
        { name: 'Status', value: 'status' },
        { name: 'System', value: 'system' },
        { name: 'Uptime', value: 'uptime' }
      )
    )
    .addBooleanOption(option =>
      option.setName('private').setDescription('Reply privately (only you can see)').setRequired(false)
    ),

  async execute(interaction) {
    const selected = interaction.options.getString('type') || null;
    const isPrivate = interaction.options.getBoolean('private') || false;
    const client = interaction.client;
    const cfg = client.config?.commands?.info || {};
    const content = cfg.content || {};

    try {
      await interaction.deferReply({ ephemeral: isPrivate });

      const build = async (type) => {
        const { cpuTemperature, batteryPercentage } = await getSystemHardwareInfo();
        const base = new EmbedBuilder()
          .setColor(cfg.color || '#0099ff')
          .setFooter({ text: `Bot ID: ${client.user.id}` })
          .setTimestamp()
          .setThumbnail(client.user.displayAvatarURL());

        const guilds = client.guilds.cache;
        const totalMembers = guilds.reduce((acc, g) => acc + g.memberCount, 0);
        const eventsCount = client.events ? client.events.size : 0;

        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        if (!type) {
          base.setTitle(cfg.all?.title || 'Bot Information');
          const creatorContent = content.creator || {};
          base.addFields({
            name: creatorContent.title || 'Creator Information',
            value: `${creatorContent.creator_name_label || 'Creator'}: \`${creatorContent.creator_name_value || 'Unknown'}\`\n${creatorContent.creation_date_label || 'Creation Date'}: <t:${creatorContent.creation_date_value || '0'}:D>`,
            inline: false,
          });
          const statusContent = content.status || {};
          base.addFields({
            name: statusContent.title || 'Bot Status & Statistics',
            value: `${statusContent.servers_label || 'Servers'}: \`${guilds.size}\`\n${statusContent.members_label || 'Members'}: \`${totalMembers}\`\n${statusContent.commands_label || 'Commands'}: \`${client.commands?.size || 0}\`\n${statusContent.latency_label || 'Latency'}: \`${client.ws.ping}ms\`\nEvents: \`${eventsCount}\``,
            inline: false,
          });
          const systemContent = content.system || {};
          const mem = process.memoryUsage();
          base.addFields({
            name: systemContent.title || 'System Information',
            value: `${systemContent.os_label || 'Operating System'}: \`${os.type()} ${os.release()}\`\n${systemContent.cpu_label || 'CPU'}: \`${os.cpus()[0]?.model || 'Unknown'}\`\n${systemContent.mem_usage_label || 'Memory Usage'}: \`${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\`\n${systemContent.total_mem_label || 'Total Memory'}: \`${(os.totalmem() / 1024 / 1024).toFixed(2)} MB\`\n${systemContent.node_label || 'Node.js Version'}: \`${process.version}\`\n${systemContent.djs_label || 'Discord.js Version'}: \`v${require('discord.js').version}\`\n${systemContent.cpu_temp_label || 'CPU Temperature'}: \`${cpuTemperature}\`\n${systemContent.battery_label || 'Battery'}: \`${batteryPercentage}\``,
            inline: false,
          });
          const uptimeContent = content.uptime || {};
          const upStr = (uptimeContent.time_format || '{days}d {hours}h {minutes}m {seconds}s')
            .replace('{days}', days).replace('{hours}', hours).replace('{minutes}', minutes).replace('{seconds}', seconds);
          const desc = (uptimeContent.description || 'The bot has been online for {uptimeString}.').replace('{uptimeString}', upStr);
          base.addFields({ name: uptimeContent.title || 'Uptime', value: desc, inline: false });
        } else if (type === 'creator') {
          const c = content.creator || {};
          base.setTitle(c.title || 'Creator Information')
            .addFields(
              { name: c.creator_name_label || 'Creator', value: `\`${c.creator_name_value || 'Unknown'}\``, inline: true },
              { name: c.creation_date_label || 'Creation Date', value: `<t:${c.creation_date_value || '0'}:D>`, inline: true }
            );
        } else if (type === 'status') {
          const s = content.status || {};
          base.setTitle(s.title || 'Bot Status')
            .addFields(
              { name: s.servers_label || 'Servers', value: `\`${guilds.size}\``, inline: true },
              { name: s.members_label || 'Members', value: `\`${totalMembers}\``, inline: true },
              { name: s.commands_label || 'Commands', value: `\`${client.commands?.size || 0}\``, inline: true },
              { name: 'Events', value: `\`${eventsCount}\``, inline: true },
              { name: s.latency_label || 'Latency', value: `\`${client.ws.ping}ms\``, inline: true }
            );
        } else if (type === 'system') {
          const s = content.system || {};
          const mem = process.memoryUsage();
          base.setTitle(s.title || 'System Information')
            .addFields(
              { name: s.os_label || 'Operating System', value: `\`${os.type()} ${os.release()}\``, inline: false },
              { name: s.cpu_label || 'CPU', value: `\`${os.cpus()[0]?.model || 'Unknown'}\``, inline: false },
              { name: s.mem_usage_label || 'Memory Usage', value: `\`${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB\``, inline: true },
              { name: s.total_mem_label || 'Total Memory', value: `\`${(os.totalmem() / 1024 / 1024).toFixed(2)} MB\``, inline: true },
              { name: s.node_label || 'Node.js Version', value: `\`${process.version}\``, inline: true },
              { name: s.djs_label || 'Discord.js Version', value: `\`v${require('discord.js').version}\``, inline: true },
              { name: s.cpu_temp_label || 'CPU Temperature', value: `\`${cpuTemperature}\``, inline: true },
              { name: s.battery_label || 'Battery', value: `\`${batteryPercentage}\``, inline: true }
            );
        } else if (type === 'uptime') {
          const u = content.uptime || {};
          const upStr = (u.time_format || '{days}d {hours}h {minutes}m {seconds}s')
            .replace('{days}', days).replace('{hours}', hours).replace('{minutes}', minutes).replace('{seconds}', seconds);
          const desc = (u.description || 'The bot has been online for {uptimeString}.').replace('{uptimeString}', upStr);
          base.setTitle(u.title || 'Bot Uptime').setDescription(desc);
        }
        return base;
      };

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('info_all').setLabel('All').setStyle(ButtonStyle.Secondary).setEmoji('📚'),
        new ButtonBuilder().setCustomId('info_creator').setLabel('Creator').setStyle(ButtonStyle.Secondary).setEmoji('👤'),
        new ButtonBuilder().setCustomId('info_status').setLabel('Status').setStyle(ButtonStyle.Secondary).setEmoji('📊'),
        new ButtonBuilder().setCustomId('info_system').setLabel('System').setStyle(ButtonStyle.Secondary).setEmoji('💻'),
        new ButtonBuilder().setCustomId('info_uptime').setLabel('Uptime').setStyle(ButtonStyle.Secondary).setEmoji('⏱️')
      );

      let current = selected;
      const first = await build(current);
      await interaction.editReply({ embeds: [first], components: [buttons] });

      const msg = await interaction.fetchReply();
      const collector = msg.createMessageComponentCollector({ time: 30000 });
      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: 'Only the command invoker can use these buttons.', ephemeral: true });
          return;
        }
        if (i.customId === 'info_all') current = null;
        if (i.customId === 'info_creator') current = 'creator';
        if (i.customId === 'info_status') current = 'status';
        if (i.customId === 'info_system') current = 'system';
        if (i.customId === 'info_uptime') current = 'uptime';
        const fresh = await build(current);
        await i.update({ embeds: [fresh] });
      });
      collector.on('end', async () => {
        const disabled = new ActionRowBuilder().addComponents(
          buttons.components.map(b => ButtonBuilder.from(b).setDisabled(true))
        );
        await interaction.editReply({ components: [disabled] }).catch(() => {});
      });

    } catch (error) {
      console.error(`Error executing /info command (type: ${selected || 'all'}):`, error);
      const payload = { content: cfg.messages?.error || 'An error occurred while executing the command.', ephemeral: true };
      if (interaction.deferred || interaction.replied) await interaction.followUp(payload); else await interaction.reply(payload);
    }
  },
};

