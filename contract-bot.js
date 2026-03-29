const { Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, REST, Routes, SlashCommandBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  PANEL_CHANNEL_ID: '1485191415435624594',
  STAFF_ROLE_ID: '1487848016110162153',

  CATEGORIES: {
    NEGOCIATION:   '1487848273355210803',
    PAIEMENT_1:    '1487848408050962593',
    DEVELOPPEMENT: '1487848473448546577',
    PAIEMENT_2:    '1487848515165229336',
    TERMINE:       '1487848579488813309',
    ANNULE:        '1487859413627834418',
  },

  ETAPES: [
    { id: 'NEGOCIATION',   label: '🟡 Négociation',               color: 0xF5C542 },
    { id: 'PAIEMENT_1',    label: '💳 1er paiement en attente',   color: 0xFF8C00 },
    { id: 'DEVELOPPEMENT', label: '🔨 En cours de développement', color: 0x5865F2 },
    { id: 'PAIEMENT_2',    label: '💳 2ème paiement en attente',  color: 0xFF8C00 },
    { id: 'TERMINE',       label: '✅ Terminé',                    color: 0x57F287 },
  ],
};
// ─────────────────────────────────────────────────────────────────────────────

const ticketEtapes = new Map();
// Map channelId → { nom, client, etape }
const ticketInfos = new Map();

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  await registerSlashCommands();
});

// ─── REGISTER SLASH COMMANDS ─────────────────────────────────────────────────
async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('contrats')
      .setDescription('Liste tous les contrats en cours')
      .toJSON(),
  ];

  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  try {
    await rest.put(
      Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID),
      { body: commands }
    );
    console.log('✅ Commandes slash enregistrées');
  } catch (err) {
    console.error('Erreur enregistrement commandes:', err);
  }
}

// ─── SETUP ───────────────────────────────────────────────────────────────────
if (process.argv[2] === 'setup') {
  client.once('ready', async () => {
    const channel = await client.channels.fetch(CONFIG.PANEL_CHANNEL_ID);

    const embed = new EmbedBuilder()
      .setTitle('📋 HEO Studio — Créer un contrat')
      .setDescription(
        'Bienvenue sur le système de contrats **HEO Studio**.\n\n' +
        'Clique sur le bouton ci-dessous pour ouvrir une demande de contrat.\n' +
        'Un salon privé sera créé pour toi et notre équipe.'
      )
      .setColor(0x5865F2)
      .setFooter({ text: 'HEO Studio • Système de contrats' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('creer_contrat')
        .setLabel('📝 Créer un contrat')
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({ embeds: [embed], components: [row] });
    console.log('✅ Panneau envoyé !');
    process.exit(0);
  });
}

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── Commande /contrats ──────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'contrats') {
    await interaction.deferReply({ ephemeral: false });

    const guild = interaction.guild;
    const tickets = [];

    for (const [channelId, info] of ticketInfos.entries()) {
      const channel = guild.channels.cache.get(channelId);
      if (!channel) continue;
      const etapeIndex = ticketEtapes.get(channelId) ?? 0;
      const etape = CONFIG.ETAPES[etapeIndex];
      tickets.push(`${etape.label} — **${info.nom}** — <@${info.clientId}> — ${channel}`);
    }

    if (tickets.length === 0) {
      await interaction.editReply({ content: '📭 Aucun contrat en cours.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('📋 Contrats en cours — HEO Studio')
      .setColor(0x5865F2)
      .setDescription(tickets.join('\n'))
      .setFooter({ text: `${tickets.length} contrat(s) actif(s)` })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // ── Bouton "Créer un contrat" ───────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'creer_contrat') {
    const modal = new ModalBuilder()
      .setCustomId('modal_contrat')
      .setTitle('Nouvelle demande de contrat');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('nom_projet')
          .setLabel('Nom du projet')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: Jeu Roblox RPG, Site vitrine...')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('description')
          .setLabel('Description du projet')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Décris ce que tu veux qu\'on réalise...')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('budget')
          .setLabel('Budget estimé (en Robux ou €)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 5000 Robux, 50€...')
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('delai')
          .setLabel('Délai souhaité')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: 2 semaines, 1 mois...')
          .setRequired(false)
      ),
    );

    await interaction.showModal(modal);
    return;
  }

  // ── Soumission du modal ─────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_contrat') {
    await interaction.deferReply({ ephemeral: true });

    const nomProjet   = interaction.fields.getTextInputValue('nom_projet');
    const description = interaction.fields.getTextInputValue('description');
    const budget      = interaction.fields.getTextInputValue('budget');
    const delai       = interaction.fields.getTextInputValue('delai') || 'Non précisé';

    const guild = interaction.guild;
    const user  = interaction.user;

    const existing = guild.channels.cache.find(
      c => c.name === `contrat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}` &&
           c.type === ChannelType.GuildText
    );
    if (existing) {
      await interaction.editReply({ content: `❌ Tu as déjà un ticket ouvert : ${existing}` });
      return;
    }

    const channelName = `contrat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`;

    const ticketChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: CONFIG.CATEGORIES.NEGOCIATION,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });

    ticketEtapes.set(ticketChannel.id, 0);
    ticketInfos.set(ticketChannel.id, { nom: nomProjet, clientId: user.id });

    const embed = buildEmbed(nomProjet, description, budget, delai, user, 0);
    const row   = buildStaffRow(0);

    await ticketChannel.send({
      content: `👋 <@${user.id}> | <@&${CONFIG.STAFF_ROLE_ID}>`,
      embeds: [embed],
      components: [row],
    });

    await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });
    return;
  }

  // ── Bouton "Étape suivante" ─────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'etape_suivante') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true });
      return;
    }

    await interaction.deferUpdate();

    const channel       = interaction.channel;
    const etapeActuelle = ticketEtapes.get(channel.id) ?? 0;
    const nouvelleEtape = etapeActuelle + 1;

    if (nouvelleEtape >= CONFIG.ETAPES.length) {
      await interaction.followUp({ content: '✅ Ce ticket est déjà à l\'étape finale.', ephemeral: true });
      return;
    }

    await channel.setParent(CONFIG.CATEGORIES[CONFIG.ETAPES[nouvelleEtape].id], { lockPermissions: false });
    ticketEtapes.set(channel.id, nouvelleEtape);

    const originalMessage = interaction.message;
    const ancienEmbed = originalMessage.embeds[0];

    const updatedEmbed = EmbedBuilder.from(ancienEmbed)
      .setColor(CONFIG.ETAPES[nouvelleEtape].color)
      .setFooter({ text: `HEO Studio • Étape : ${CONFIG.ETAPES[nouvelleEtape].label}` });

    await originalMessage.edit({ embeds: [updatedEmbed], components: [buildStaffRow(nouvelleEtape)] });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(CONFIG.ETAPES[nouvelleEtape].color)
          .setDescription(`📌 Ticket avancé à l'étape : **${CONFIG.ETAPES[nouvelleEtape].label}**\nPar : <@${interaction.user.id}>`)
      ]
    });

    return;
  }

  // ── Bouton "Annuler le contrat" ─────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'annuler_contrat') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true });
      return;
    }

    await interaction.deferUpdate();

    const channel = interaction.channel;
    await channel.setParent(CONFIG.CATEGORIES.ANNULE, { lockPermissions: false });
    ticketEtapes.set(channel.id, -1);
    ticketInfos.delete(channel.id);

    const originalMessage = interaction.message;
    const ancienEmbed = originalMessage.embeds[0];

    const updatedEmbed = EmbedBuilder.from(ancienEmbed)
      .setColor(0xED4245)
      .setFooter({ text: 'HEO Studio • ❌ Contrat annulé' });

    // Désactive tous les boutons
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('etape_suivante')
        .setLabel('Contrat annulé')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId('annuler_contrat')
        .setLabel('Annulé')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
    );

    await originalMessage.edit({ embeds: [updatedEmbed], components: [disabledRow] });

    await channel.send({
      embeds: [
        new EmbedBuilder()
          .setColor(0xED4245)
          .setDescription(`❌ Contrat **annulé** par <@${interaction.user.id}>`)
      ]
    });

    return;
  }
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function buildEmbed(nom, description, budget, delai, user, etapeIndex) {
  const etape = CONFIG.ETAPES[etapeIndex];
  return new EmbedBuilder()
    .setTitle(`📋 Contrat — ${nom}`)
    .setColor(etape.color)
    .addFields(
      { name: '👤 Client',      value: `<@${user.id}>`, inline: true  },
      { name: '💰 Budget',      value: budget,           inline: true  },
      { name: '⏱️ Délai',       value: delai,            inline: true  },
      { name: '📝 Description', value: description,      inline: false },
    )
    .setFooter({ text: `HEO Studio • Étape : ${etape.label}` })
    .setTimestamp();
}

function buildStaffRow(etapeIndex) {
  const isLast = etapeIndex >= CONFIG.ETAPES.length - 1;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('etape_suivante')
      .setLabel(isLast ? '✅ Terminé' : `➡️ Passer à : ${CONFIG.ETAPES[etapeIndex + 1]?.label ?? 'Fin'}`)
      .setStyle(isLast ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(isLast),
    new ButtonBuilder()
      .setCustomId('annuler_contrat')
      .setLabel('🚫 Annuler le contrat')
      .setStyle(ButtonStyle.Danger),
  );
}

client.login(CONFIG.TOKEN);
