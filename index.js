const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  REST, Routes, SlashCommandBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel],
});

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  TOKEN:                    process.env.TOKEN,
  CLIENT_ID:                process.env.CLIENT_ID,
  GUILD_ID:                 process.env.GUILD_ID,

  // ── Ancien système ──────────────────────────────────────────────────────────
  PANEL_CHANNEL_ID:         '1485191415435624594',
  SUPPORT_PANEL_CHANNEL_ID: '1487752758294614076',
  STAFF_ROLE_ID:            '1487848016110162153',
  DEV_ROLE_ID:              '1485191413829337299',
  DEV_ROLES: {
    builder:   '1488194780809789511',
    ui:        '1488194616413913088',
    scripteur: '1488194696831307776',
    animateur: '1488581098563702914',
  },
  CATEGORIES: {
    NEGOCIATION:   '1487848273355210803',
    PAIEMENT_1:    '1487848408050962593',
    DEVELOPPEMENT: '1487848473448546577',
    PAIEMENT_2:    '1487848515165229336',
    TERMINE:       '1487848579488813309',
    ANNULE:        '1487859413627834418',
    SUPPORT:       '1485236440047554640',
  },
  ETAPES: [
    { id: 'NEGOCIATION',   label: '🟡 Négociation',               color: 0xF5C542 },
    { id: 'PAIEMENT_1',    label: '💳 1er paiement en attente',   color: 0xFF8C00 },
    { id: 'DEVELOPPEMENT', label: '🔨 En cours de développement', color: 0x5865F2 },
    { id: 'PAIEMENT_2',    label: '💳 2ème paiement en attente',  color: 0xFF8C00 },
    { id: 'TERMINE',       label: '✅ Terminé',                    color: 0x57F287 },
  ],
  SUPPORT_TYPES: {
    question:   { label: '❓ Question',   color: 0x5865F2 },
    suggestion: { label: '💡 Suggestion', color: 0xF5C542 },
    report:     { label: '🚨 Report',     color: 0xED4245 },
  },
  RECRUTEMENT_PANEL_CHANNEL_ID: '1488553805258821662',
  RECRUTEMENT_CATEGORY_ID:      '1488554531217346731',
  ROLE_ATT_ENTRETIEN:           '1485313117603893348',
  ROLE_DEV_GLOBAL:              '1485191413829337299',
  ROLE_SEPARATION:              '1485191413829337293',
  ETOILES_ROLES: {
    ui:        ['1485321773665751141','1485321825834766587','1485321711158038841','1485321660138524763','1485320858624065757'],
    builder:   ['1485322061994786918','1485321763985293392','1485321427845648385','1485321015721591024','1485320049073061952'],
    animateur: ['1488587193932058654','1488587312269885590','1488587339105308752','1488587372319871197','1488587400518041612'],
    scripteur: ['1485321122646851735','1485321178859180165','1485321077495300298','1485321012709953717','1488194696831307776'],
  },
  SHOP_CHANNEL_ID:   '1488940435593236570',
  ACHAT_CATEGORY_ID: '1488943924167970987',
  VENDEUR_ROLE_ID:   '1488952681278996571',

  // ── Nouveau système ─────────────────────────────────────────────────────────
  NEW_PANEL_CHANNEL_ID:      '1490697124709404872',
  SECRETAIRE_ROLE_ID:        '1490464910549712937',
  GESTION_TICKET_ROLE_ID:    '1487848016110162153',
  PROPOSITION_CONTRAT_CH_ID: '1490697987473674361',
  OWNER_ROLE_ID:             '1485191413837856966',
  NEW_DEV_ROLE_ID:           '1485191413829337299',
  NEW_STAFF_ROLE_ID:         '1485191413829337297',

  // Emojis des étapes (préfixes catégorie)
  ETAPE_EMOJIS: ['🟡', '1️⃣💳', '🛠️', '2️⃣💳', '💰', '✅'],
  // index :        0      1       2       3       4     5
  ETAPE_ANNULE: '🛑',
};
// ──────────────────────────────────────────────────────────────────────────────

// ─── STATE (ancien système) ───────────────────────────────────────────────────
const ticketEtapes        = new Map();
const ticketInfos         = new Map();
const ticketDevAssignment = new Map();
const pendingDevForm      = new Map();
const pendingRecrutement  = new Map();
const pendingShop         = new Map();

// ─── STATE (nouveau système) ──────────────────────────────────────────────────
// newContrats: categoryId -> { nom, budget, delai, description, clientId, secretaireId,
//                              devIds[], etape (0-5), annule (bool), etapeAvantAnnul,
//                              clientTicketId, devTicketId, paySecretaireTicketId }
const newContrats = new Map();
// pendingNewDev: interactionUserId -> { categoryId }  (pour le formulaire choix dev)
const pendingNewDev = new Map();
// ──────────────────────────────────────────────────────────────────────────────

const DEV_TYPE_ICONS = {
  builder:   '🏗️ Builder',
  scripteur: '💻 Scripteur',
  ui:        '🎨 UI',
  animateur: '💨 Animateur',
};
const ASSET_TYPE_ICONS = {
  build:     '🏗️ Build',
  ui:        '🎨 UI',
  script:    '💻 Script',
  animation: '💨 Animation',
};
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// ─── HELPERS NOUVEAU SYSTÈME ──────────────────────────────────────────────────

function canSecretaire(member) {
  return member.roles.cache.has(CONFIG.SECRETAIRE_ROLE_ID)
    || member.roles.cache.has(CONFIG.OWNER_ROLE_ID)
    || member.permissions.has(PermissionFlagsBits.Administrator);
}

function canOwner(member) {
  return member.roles.cache.has(CONFIG.OWNER_ROLE_ID)
    || member.permissions.has(PermissionFlagsBits.Administrator);
}

// Renomme la catégorie avec le bon emoji selon l'étape
async function renameCategoryEmoji(guild, categoryId, etape, annule = false) {
  const category = guild.channels.cache.get(categoryId);
  if (!category) return;
  const nomSansEmoji = category.name.replace(/^[\p{Emoji}\s\uFE0F\u20E3]+/gu, '').trim();
  const emoji = annule ? CONFIG.ETAPE_ANNULE : (CONFIG.ETAPE_EMOJIS[etape] ?? '✅');
  await category.setName(`${emoji}-${nomSansEmoji}`).catch(() => {});
}

// Renomme un salon en ajoutant/retirant un emoji préfixe
async function renameChannelPrefix(channel, prefix) {
  if (!channel) return;
  const nomSansEmoji = channel.name.replace(/^[\p{Emoji}\s\uFE0F\u20E3]+[-\s]*/gu, '').trim();
  await channel.setName(`${prefix}-${nomSansEmoji}`).catch(() => {});
}

// Envoie un message dans les deux tickets (client + dev)
async function sendToBothTickets(guild, contrat, content, embedData = null) {
  const channels = [contrat.clientTicketId, contrat.devTicketId].filter(Boolean);
  for (const chId of channels) {
    const ch = guild.channels.cache.get(chId);
    if (!ch) continue;
    if (embedData) {
      await ch.send({ content, embeds: [new EmbedBuilder().setColor(embedData.color).setDescription(embedData.desc)] }).catch(() => {});
    } else {
      await ch.send(content).catch(() => {});
    }
  }
}

// Construit les boutons du ticket client selon l'étape
function buildClientTicketRow(etape, annule = false) {
  const rows = [];

  if (annule) {
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('nc_desannuler').setLabel('↩️ Désannuler').setStyle(ButtonStyle.Primary),
    ));
    return rows;
  }

  const nextBtn = new ButtonBuilder().setCustomId('nc_next').setStyle(ButtonStyle.Primary);
  const backBtn = new ButtonBuilder().setCustomId('nc_back').setLabel('🔙 Retour').setStyle(ButtonStyle.Secondary).setDisabled(etape <= 0);
  const cancelBtn = new ButtonBuilder().setCustomId('nc_annuler').setLabel('🛑 Annuler').setStyle(ButtonStyle.Danger);

  // Étiquettes dynamiques selon l'étape
  const nextLabels = [
    '➡️ Dev choisi — créer ticket dev',
    '✅ 1er paiement reçu',
    '✅ Travail terminé — 2ème paiement',
    '✅ 2ème paiement reçu',
    '✅ Dev payé',
    null,
  ];

  if (nextLabels[etape]) {
    nextBtn.setLabel(nextLabels[etape]);
  } else {
    nextBtn.setLabel('✅ Terminé').setDisabled(true);
  }

  rows.push(new ActionRowBuilder().addComponents(backBtn, nextBtn, cancelBtn));
  return rows;
}

// Construit les boutons du ticket dev (bouton "dev payé")
function buildDevTicketRow(etape) {
  if (etape === 4) {
    return [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('nc_dev_paye').setLabel('✅ Dev payé').setStyle(ButtonStyle.Success),
    )];
  }
  return [];
}

// ──────────────────────────────────────────────────────────────────────────────

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  await registerSlashCommands();
});

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
async function registerSlashCommands() {
  const commands = [
    // Ancien système
    new SlashCommandBuilder().setName('contrats').setDescription('Liste tous les contrats en cours (ancien système)').toJSON(),
    new SlashCommandBuilder().setName('shop').setDescription('Publier un nouvel asset dans la boutique (admin uniquement)').toJSON(),
    new SlashCommandBuilder()
      .setName('modif').setDescription('Modifier un asset existant dans la boutique (admin uniquement)')
      .addStringOption(opt => opt.setName('message_id').setDescription('ID du message de l\'asset à modifier').setRequired(true))
      .toJSON(),
    // Nouveau système
    new SlashCommandBuilder()
      .setName('next')
      .setDescription('Passe à l\'étape suivante du contrat (équivalent bouton ➡️)')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('back')
      .setDescription('Revient à l\'étape précédente du contrat (équivalent bouton 🔙)')
      .toJSON(),
  ];
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
    console.log('✅ Commandes slash enregistrées');
  } catch (err) {
    console.error('Erreur commandes:', err);
  }
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
if (process.argv[2] === 'setup') {
  client.once('ready', async () => {
    // Ancien système — panneaux existants
    const contractChannel = await client.channels.fetch(CONFIG.PANEL_CHANNEL_ID);
    await contractChannel.send({
      embeds: [new EmbedBuilder()
        .setTitle('📋 HEO Studio — Créer un contrat (ancien système)')
        .setDescription('Clique sur le bouton ci-dessous pour ouvrir une demande de contrat.')
        .setColor(0x5865F2)
        .setFooter({ text: 'HEO Studio • Système de contrats' })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('creer_contrat').setLabel('📝 Créer un contrat').setStyle(ButtonStyle.Primary)
      )],
    });

    const supportChannel = await client.channels.fetch(CONFIG.SUPPORT_PANEL_CHANNEL_ID);
    await supportChannel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🎫 HEO Studio — Support')
        .setDescription('Sélectionne le type de ticket dans le menu ci-dessous.')
        .setColor(0x5865F2)
        .setFooter({ text: 'HEO Studio • Support' })],
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('select_support')
          .setPlaceholder('Choisis le type de ticket...')
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('❓ Question').setDescription('Tu as une question pour l\'équipe').setValue('question'),
            new StringSelectMenuOptionBuilder().setLabel('💡 Suggestion').setDescription('Tu as une idée à soumettre').setValue('suggestion'),
            new StringSelectMenuOptionBuilder().setLabel('🚨 Report').setDescription('Signaler un problème ou un joueur').setValue('report'),
          )
      )],
    });

    const recrutChannel = await client.channels.fetch(CONFIG.RECRUTEMENT_PANEL_CHANNEL_ID);
    await recrutChannel.send({
      embeds: [new EmbedBuilder()
        .setTitle('🖥️ HEO Studio — Recrutement Dev')
        .setDescription('Tu souhaites rejoindre l\'équipe de développement **HEO Studio** ?\n\nClique sur le bouton ci-dessous pour ouvrir ta candidature.')
        .setColor(0x5865F2)
        .setFooter({ text: 'HEO Studio • Recrutement' })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('creer_recrutement').setLabel('📩 Postuler').setStyle(ButtonStyle.Primary)
      )],
    });

    // Nouveau système — panneau
    const newPanelChannel = await client.channels.fetch(CONFIG.NEW_PANEL_CHANNEL_ID);
    await newPanelChannel.send({
      embeds: [new EmbedBuilder()
        .setTitle('📋 HEO Studio — Nouveau système de contrats')
        .setDescription(
          'Bienvenue sur le système de contrats **HEO Studio**.\n\n' +
          'Clique sur le bouton ci-dessous pour ouvrir une demande de contrat.\n' +
          'Une catégorie privée sera créée avec ton ticket client.'
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'HEO Studio • Système de contrats v2' })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nc_creer_contrat').setLabel('📝 Créer un contrat').setStyle(ButtonStyle.Primary)
      )],
    });

    console.log('✅ Panneaux envoyés !');
    process.exit(0);
  });
}

// ─── HELPERS (ancien système) ──────────────────────────────────────────────────
function buildEmbed(nom, description, budget, delai, user, etapeIndex, devAssignment = null) {
  const etape = CONFIG.ETAPES[etapeIndex];
  const embed = new EmbedBuilder()
    .setTitle(`📋 Contrat — ${nom}`)
    .setColor(etape.color)
    .addFields(
      { name: '👤 Client',      value: `<@${user.id}>`, inline: true },
      { name: '💰 Budget',      value: budget,           inline: true },
      { name: '⏱️ Délai',       value: delai,            inline: true },
      { name: '📝 Description', value: description,       inline: false },
    )
    .setFooter({ text: `HEO Studio • Étape : ${etape.label}` })
    .setTimestamp();
  if (devAssignment) {
    const typesLabel  = devAssignment.types.map(t => DEV_TYPE_ICONS[t] ?? t).join(', ');
    const assignesStr = devAssignment.assignes.length > 0 ? devAssignment.assignes.map(id => `🔨 <@${id}>`).join('\n') : '*Aucun*';
    const backupStr   = devAssignment.backup.length > 0 ? devAssignment.backup.map(id => `🔧 <@${id}>`).join('\n') : '*Aucun*';
    embed.addFields(
      { name: '🗂️ Types retenus',  value: typesLabel,  inline: false },
      { name: '🔨 Devs assignés',  value: assignesStr, inline: true  },
      { name: '🔧 Support/Backup', value: backupStr,   inline: true  },
    );
  }
  return embed;
}

function canAdvanceEtape(member, channelId, etapeActuelle) {
  const isStaff = member.roles.cache.has(CONFIG.STAFF_ROLE_ID) || member.permissions.has(PermissionFlagsBits.Administrator);
  if (isStaff) return true;
  if (etapeActuelle >= 1) {
    const assignment = ticketDevAssignment.get(channelId);
    if (assignment && assignment.assignes.includes(member.id)) return true;
  }
  return false;
}

function buildStaffRow(etapeIndex) {
  const isLast  = etapeIndex >= CONFIG.ETAPES.length - 1;
  const isFirst = etapeIndex <= 0;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('etape_precedente').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(isFirst),
    new ButtonBuilder().setCustomId('etape_suivante').setLabel(isLast ? '✅ Terminé' : `➡️ Passer à : ${CONFIG.ETAPES[etapeIndex + 1]?.label ?? 'Fin'}`).setStyle(isLast ? ButtonStyle.Success : ButtonStyle.Primary).setDisabled(isLast),
    new ButtonBuilder().setCustomId('annuler_contrat').setLabel('🚫 Annuler').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('supprimer_ticket').setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Secondary),
  );
}

function buildSupportRow(ferme) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('fermer_support').setLabel('🔒 Fermer').setStyle(ButtonStyle.Secondary).setDisabled(ferme),
    new ButtonBuilder().setCustomId('supprimer_support').setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Danger),
  );
}

async function sendFormEtape1(channel, selectedTypes = []) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('dev_form_types').setPlaceholder('Sélectionne le(s) type(s) de dev retenus...').setMinValues(1).setMaxValues(4)
    .addOptions(
      new StringSelectMenuOptionBuilder().setLabel('🏗️ Builder').setDescription('Constructeur de maps / structures').setValue('builder').setDefault(selectedTypes.includes('builder')),
      new StringSelectMenuOptionBuilder().setLabel('💻 Scripteur').setDescription('Développeur de scripts / systèmes').setValue('scripteur').setDefault(selectedTypes.includes('scripteur')),
      new StringSelectMenuOptionBuilder().setLabel('🎨 UI').setDescription('Designer d\'interfaces').setValue('ui').setDefault(selectedTypes.includes('ui')),
      new StringSelectMenuOptionBuilder().setLabel('💨 Animateur').setDescription('Animateur : animation').setValue('animateur').setDefault(selectedTypes.includes('animateur')),
    );
  const row1 = new ActionRowBuilder().addComponents(select);
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dev_form_annuler').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('dev_form_etape2').setLabel('➡️ Étape suivante').setStyle(ButtonStyle.Primary),
  );
  const embed = new EmbedBuilder()
    .setTitle('👥 Assignation des devs — Étape 1/2')
    .setDescription('Sélectionne le ou les **types de dev** retenus pour ce projet.\nTous les devs de ce type seront notifiés comme support/backup.')
    .setColor(0x5865F2)
    .setFooter({ text: selectedTypes.length > 0 ? `Types sélectionnés : ${selectedTypes.join(', ')}` : 'Aucun type sélectionné' });
  return await channel.send({ embeds: [embed], components: [row1, row2] });
}

function buildAssetEmbed(nom, desc, prix, typeLabel, mediaUrl) {
  const embed = new EmbedBuilder()
    .setTitle(`${typeLabel} — ${nom}`)
    .setColor(0x5865F2)
    .addFields(
      { name: '📝 Description', value: desc,     inline: false },
      { name: '💰 Prix',        value: prix,      inline: true  },
      { name: '🗂️ Type',        value: typeLabel, inline: true  },
    )
    .setFooter({ text: 'HEO Studio • Boutique' })
    .setTimestamp();
  if (mediaUrl) {
    const isImage = IMAGE_EXTS.some(ext => mediaUrl.toLowerCase().includes(ext));
    if (isImage) embed.setImage(mediaUrl);
    else embed.addFields({ name: '🎬 Médias', value: `[Voir le média](${mediaUrl})`, inline: false });
  }
  return embed;
}

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ════════════════════════════════════════════════════════════════════════════
  // ─── SLASH COMMANDS ──────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  if (interaction.isChatInputCommand()) {

    // ── /contrats (ancien) ──────────────────────────────────────────────────────
    if (interaction.commandName === 'contrats') {
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
      if (tickets.length === 0) { await interaction.editReply({ content: '📭 Aucun contrat en cours.' }); return; }
      await interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('📋 Contrats en cours — HEO Studio').setColor(0x5865F2)
          .setDescription(tickets.join('\n')).setFooter({ text: `${tickets.length} contrat(s) actif(s)` }).setTimestamp()],
      });
      return;
    }

    // ── /shop ───────────────────────────────────────────────────────────────────
    if (interaction.commandName === 'shop') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true }); return;
      }
      const modal = new ModalBuilder().setCustomId('modal_shop_asset').setTitle('🛒 Publier un asset — HEO Studio');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_nom').setLabel('Nom de l\'asset').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Map hospitalière V2, UI Pack médical...').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setPlaceholder('Décris l\'asset en détail (contenu, usage, compatibilité...)').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_prix').setLabel('Prix').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 500 Robux, 10€, Gratuit...').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_type').setLabel('Type (build / ui / script / animation)').setStyle(TextInputStyle.Short).setPlaceholder('build, ui, script ou animation').setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_media').setLabel('URL du média (image ou vidéo)').setStyle(TextInputStyle.Short).setPlaceholder('https://... (lien direct image ou vidéo) — optionnel').setRequired(false)),
      );
      await interaction.showModal(modal);
      return;
    }

    // ── /modif ──────────────────────────────────────────────────────────────────
    if (interaction.commandName === 'modif') {
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true }); return;
      }
      const messageId   = interaction.options.getString('message_id');
      const shopChannel = await client.channels.fetch(CONFIG.SHOP_CHANNEL_ID);
      try { await shopChannel.messages.fetch(messageId); }
      catch { await interaction.reply({ content: '❌ Message introuvable dans le salon boutique. Vérifie l\'ID.', ephemeral: true }); return; }
      pendingShop.set(interaction.user.id, { messageId, channelId: shopChannel.id });
      const modal = new ModalBuilder().setCustomId('modal_modif_asset').setTitle('✏️ Modifier un asset — HEO Studio');
      modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_nom').setLabel('Nouveau nom').setStyle(TextInputStyle.Short).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_desc').setLabel('Nouvelle description').setStyle(TextInputStyle.Paragraph).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_prix').setLabel('Nouveau prix').setStyle(TextInputStyle.Short).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_type').setLabel('Nouveau type (build/ui/script/animation)').setStyle(TextInputStyle.Short).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('asset_media').setLabel('Nouvelle URL média').setStyle(TextInputStyle.Short).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)),
      );
      await interaction.showModal(modal);
      return;
    }

    // ── /next (nouveau système) ─────────────────────────────────────────────────
    if (interaction.commandName === 'next') {
      if (!canSecretaire(interaction.member)) {
        await interaction.reply({ content: '❌ Réservé au secrétaire / owner.', ephemeral: true }); return;
      }
      // Cherche le contrat lié à ce salon
      const contrat = findContratByChannel(interaction.channelId);
      if (!contrat) { await interaction.reply({ content: '❌ Ce salon n\'est pas lié à un contrat actif.', ephemeral: true }); return; }
      await interaction.deferReply({ ephemeral: true });
      await handleNext(interaction.guild, contrat, interaction.user, interaction.channel);
      await interaction.editReply({ content: '✅ Étape suivante effectuée.' });
      return;
    }

    // ── /back (nouveau système) ─────────────────────────────────────────────────
    if (interaction.commandName === 'back') {
      if (!canSecretaire(interaction.member)) {
        await interaction.reply({ content: '❌ Réservé au secrétaire / owner.', ephemeral: true }); return;
      }
      const contrat = findContratByChannel(interaction.channelId);
      if (!contrat) { await interaction.reply({ content: '❌ Ce salon n\'est pas lié à un contrat actif.', ephemeral: true }); return; }
      await interaction.deferReply({ ephemeral: true });
      await handleBack(interaction.guild, contrat, interaction.user, interaction.channel);
      await interaction.editReply({ content: '✅ Retour à l\'étape précédente effectué.' });
      return;
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ─── NOUVEAU SYSTÈME DE CONTRATS ─────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  // ── Bouton : créer un contrat ────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'nc_creer_contrat') {
    const modal = new ModalBuilder().setCustomId('nc_modal_contrat').setTitle('📋 Nouvelle demande de contrat');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom').setLabel('Nom du contrat / projet').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Jeu RPG Roblox, Site vitrine...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('budget').setLabel('Budget estimé').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 5000 Robux, 50€...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('delai').setLabel('Délai souhaité').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 2 semaines, 1 mois...').setRequired(false)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description du projet').setStyle(TextInputStyle.Paragraph).setPlaceholder('Décris ce que tu veux qu\'on réalise...').setRequired(true)),
    );
    await interaction.showModal(modal);
    return;
  }

  // ── Modal contrat soumis ─────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'nc_modal_contrat') {
    await interaction.deferReply({ ephemeral: true });
    const nom         = interaction.fields.getTextInputValue('nom');
    const budget      = interaction.fields.getTextInputValue('budget');
    const delai       = interaction.fields.getTextInputValue('delai') || 'Non précisé';
    const description = interaction.fields.getTextInputValue('description');
    const user        = interaction.user;
    const guild       = interaction.guild;

    // Anti-doublon
    const alreadyExists = [...newContrats.values()].find(c => c.clientId === user.id);
    if (alreadyExists) {
      const cat = guild.channels.cache.get(alreadyExists.categoryId);
      await interaction.editReply({ content: `❌ Tu as déjà un contrat en cours${cat ? ` : **${cat.name}**` : ''}.` });
      return;
    }

    // Crée la catégorie
    const nomSafe    = nom.replace(/[^\w\s-]/g, '').trim().slice(0, 40);
    const category   = await guild.channels.create({
      name: `🟡-${nomSafe}`,
      type: ChannelType.GuildCategory,
    });

    // Crée le ticket client-secrétaire
    const clientTicket = await guild.channels.create({
      name: `💼-client`,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites: [
        { id: guild.roles.everyone,              deny:  [PermissionFlagsBits.ViewChannel] },
        { id: user.id,                           allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.SECRETAIRE_ROLE_ID,         allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        { id: CONFIG.OWNER_ROLE_ID,              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        { id: CONFIG.GESTION_TICKET_ROLE_ID,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });

    // Enregistre le contrat
    const contratData = {
      categoryId:          category.id,
      nom,
      budget,
      delai,
      description,
      clientId:            user.id,
      secretaireId:        null,
      devIds:              [],
      etape:               0,
      annule:              false,
      etapeAvantAnnul:     null,
      clientTicketId:      clientTicket.id,
      devTicketId:         null,
      paySecretaireTicketId: null,
    };
    newContrats.set(category.id, contratData);

    // Message d'avertissement anti-arnaque
    await clientTicket.send({
      content: `👋 <@${user.id}> | <@&${CONFIG.SECRETAIRE_ROLE_ID}>`,
      embeds: [
        new EmbedBuilder()
          .setTitle(`📋 Contrat — ${nom}`)
          .setColor(0xF5C542)
          .addFields(
            { name: '👤 Client',      value: `<@${user.id}>`, inline: true  },
            { name: '💰 Budget',      value: budget,           inline: true  },
            { name: '⏱️ Délai',       value: delai,            inline: true  },
            { name: '📝 Description', value: description,       inline: false },
          )
          .setFooter({ text: 'HEO Studio • Système de contrats v2 — Étape : 🟡 Négociation' })
          .setTimestamp(),
        new EmbedBuilder()
          .setColor(0xED4245)
          .setTitle('⚠️ Avertissement sécurité')
          .setDescription(
            '🔒 **Jamais** un secrétaire ne te demandera de le payer **directement**.\n' +
            'Tous les paiements passent exclusivement par :\n' +
            '• Le **compte PayPal officiel HEO Studio**\n' +
            '• Le **groupe officiel HEO**\n\n' +
            'Si un secrétaire te demande un paiement direct ou tout comportement suspect, ping immédiatement <@&' + CONFIG.OWNER_ROLE_ID + '> ou le rôle `🚨 • Urgence`.'
          ),
      ],
      components: buildClientTicketRow(0),
    });

    await interaction.editReply({ content: `✅ Ton contrat a été créé ! Rends-toi dans la catégorie **🟡-${nomSafe}**.` });
    return;
  }

  // ── Bouton : ➡️ Next ──────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'nc_next') {
    if (!canSecretaire(interaction.member)) {
      await interaction.reply({ content: '❌ Réservé au secrétaire / owner.', ephemeral: true }); return;
    }
    const contrat = findContratByChannel(interaction.channelId);
    if (!contrat) { await interaction.reply({ content: '❌ Contrat introuvable.', ephemeral: true }); return; }
    if (contrat.annule) { await interaction.reply({ content: '❌ Ce contrat est annulé. Désannule-le d\'abord.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    await handleNext(interaction.guild, contrat, interaction.user, interaction.channel);
    return;
  }

  // ── Bouton : 🔙 Back ──────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'nc_back') {
    if (!canSecretaire(interaction.member)) {
      await interaction.reply({ content: '❌ Réservé au secrétaire / owner.', ephemeral: true }); return;
    }
    const contrat = findContratByChannel(interaction.channelId);
    if (!contrat) { await interaction.reply({ content: '❌ Contrat introuvable.', ephemeral: true }); return; }
    if (contrat.annule) { await interaction.reply({ content: '❌ Ce contrat est annulé. Désannule-le d\'abord.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    await handleBack(interaction.guild, contrat, interaction.user, interaction.channel);
    return;
  }

  // ── Bouton : 🛑 Annuler ───────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'nc_annuler') {
    if (!canSecretaire(interaction.member) && !canOwner(interaction.member)) {
      await interaction.reply({ content: '❌ Réservé au secrétaire / owner.', ephemeral: true }); return;
    }
    const contrat = findContratByChannel(interaction.channelId);
    if (!contrat) { await interaction.reply({ content: '❌ Contrat introuvable.', ephemeral: true }); return; }
    if (contrat.annule) { await interaction.reply({ content: '⚠️ Déjà annulé.', ephemeral: true }); return; }
    await interaction.deferUpdate();

    contrat.etapeAvantAnnul = contrat.etape;
    contrat.annule          = true;
    newContrats.set(contrat.categoryId, contrat);

    const guild = interaction.guild;

    // Renomme la catégorie en 🛑
    await renameCategoryEmoji(guild, contrat.categoryId, contrat.etape, true);

    // Ajoute 🛑 aux salons de la catégorie
    for (const chId of [contrat.clientTicketId, contrat.devTicketId, contrat.paySecretaireTicketId].filter(Boolean)) {
      const ch = guild.channels.cache.get(chId);
      if (ch) await renameChannelPrefix(ch, '🛑').catch(() => {});
    }

    await sendToBothTickets(guild, contrat, '', { color: 0xED4245, desc: `🛑 Contrat **annulé** par <@${interaction.user.id}>` });

    // Met à jour les boutons du ticket client
    await refreshClientTicketButtons(guild, contrat);
    return;
  }

  // ── Bouton : ↩️ Désannuler ────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'nc_desannuler') {
    if (!canSecretaire(interaction.member) && !canOwner(interaction.member)) {
      await interaction.reply({ content: '❌ Réservé au secrétaire / owner.', ephemeral: true }); return;
    }
    const contrat = findContratByChannel(interaction.channelId);
    if (!contrat) { await interaction.reply({ content: '❌ Contrat introuvable.', ephemeral: true }); return; }
    if (!contrat.annule) { await interaction.reply({ content: '⚠️ Ce contrat n\'est pas annulé.', ephemeral: true }); return; }
    await interaction.deferUpdate();

    const etapeRetour = contrat.etapeAvantAnnul ?? 0;
    contrat.annule          = false;
    contrat.etapeAvantAnnul = null;
    contrat.etape           = etapeRetour;
    newContrats.set(contrat.categoryId, contrat);

    const guild = interaction.guild;

    // Restore les noms
    await renameCategoryEmoji(guild, contrat.categoryId, etapeRetour, false);

    // Retire 🛑 des salons
    for (const chId of [contrat.clientTicketId, contrat.devTicketId, contrat.paySecretaireTicketId].filter(Boolean)) {
      const ch = guild.channels.cache.get(chId);
      if (ch) {
        const nomSans = ch.name.replace(/^🛑-?/u, '');
        await ch.setName(nomSans).catch(() => {});
      }
    }

    await sendToBothTickets(guild, contrat, '', { color: 0x57F287, desc: `↩️ Contrat **désannulé** par <@${interaction.user.id}> — retour à l'étape **${etapeRetour + 1}/6**` });

    await refreshClientTicketButtons(guild, contrat);
    return;
  }

  // ── Bouton : créer ticket dev (étape 0 → modal) ───────────────────────────────
  // Ce bouton n'est pas dans le ticket directement : le secrétaire clique "next" depuis l'étape 0,
  // ce qui déclenche le modal pour entrer le nom des devs.
  // Le modal est ouvert depuis handleNext() ci-dessous.

  // ── Modal : entrer les devs ──────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'nc_modal_devs') {
    await interaction.deferReply({ ephemeral: true });
    const pending = pendingNewDev.get(interaction.user.id);
    if (!pending) { await interaction.editReply({ content: '❌ Session expirée, recommence.' }); return; }
    pendingNewDev.delete(interaction.user.id);

    const contrat     = newContrats.get(pending.categoryId);
    if (!contrat)     { await interaction.editReply({ content: '❌ Contrat introuvable.' }); return; }

    const pseudosRaw  = interaction.fields.getTextInputValue('dev_pseudos');
    const infosSup    = interaction.fields.getTextInputValue('dev_infos') || '*Aucune*';
    const guild       = interaction.guild;
    await guild.members.fetch();

    const pseudos     = pseudosRaw.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    const devIds      = [];
    const notFound    = [];
    for (const pseudo of pseudos) {
      const found = guild.members.cache.find(m =>
        m.user.username.toLowerCase() === pseudo ||
        (m.nickname && m.nickname.toLowerCase() === pseudo) ||
        m.user.globalName?.toLowerCase() === pseudo
      );
      if (found) devIds.push(found.id);
      else notFound.push(pseudo);
    }

    if (devIds.length === 0) {
      await interaction.editReply({ content: `❌ Aucun dev trouvé. Vérifie les pseudos :\n${pseudos.map(p => `• \`${p}\``).join('\n')}` }); return;
    }

    contrat.devIds       = devIds;
    contrat.secretaireId = interaction.user.id;
    newContrats.set(contrat.categoryId, contrat);

    // Crée le ticket dev-secrétaire
    const devTicket = await guild.channels.create({
      name: `🛠️-dev`,
      type: ChannelType.GuildText,
      parent: contrat.categoryId,
      permissionOverwrites: [
        { id: guild.roles.everyone,          deny:  [PermissionFlagsBits.ViewChannel] },
        { id: CONFIG.SECRETAIRE_ROLE_ID,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        { id: CONFIG.OWNER_ROLE_ID,          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        { id: CONFIG.GESTION_TICKET_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
        ...devIds.map(id => ({ id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] })),
      ],
    });

    contrat.devTicketId = devTicket.id;
    newContrats.set(contrat.categoryId, contrat);

    // Passe à l'étape 1 (1️⃣💳)
    contrat.etape = 1;
    newContrats.set(contrat.categoryId, contrat);
    await renameCategoryEmoji(guild, contrat.categoryId, 1);

    const devsStr = devIds.map(id => `<@${id}>`).join(', ');
    const warnNotFound = notFound.length > 0 ? `\n⚠️ Non trouvés : ${notFound.map(p => `\`${p}\``).join(', ')}` : '';

    // Message dans le ticket dev
    await devTicket.send({
      content: `👋 ${devsStr} | <@&${CONFIG.SECRETAIRE_ROLE_ID}>`,
      embeds: [new EmbedBuilder()
        .setTitle(`🛠️ Ticket Dev — ${contrat.nom}`)
        .setColor(0xFF8C00)
        .addFields(
          { name: '📋 Projet',        value: contrat.nom,         inline: true  },
          { name: '💰 Budget',        value: contrat.budget,      inline: true  },
          { name: '⏱️ Délai',         value: contrat.delai,       inline: true  },
          { name: '📝 Description',   value: contrat.description, inline: false },
          { name: '👤 Développeur(s)', value: devsStr,            inline: false },
          { name: '📌 Infos supp.',   value: infosSup,            inline: false },
        )
        .setDescription('⏳ En attente du 1er paiement client.')
        .setFooter({ text: 'HEO Studio • Ticket Dev' })
        .setTimestamp()],
    });

    // Message dans le ticket client (sans nom du dev)
    const clientCh = guild.channels.cache.get(contrat.clientTicketId);
    if (clientCh) {
      await clientCh.send({
        embeds: [new EmbedBuilder()
          .setColor(0xFF8C00)
          .setDescription('✅ Un développeur a été sélectionné pour ton projet.\n⏳ **En attente du 1er paiement.**')],
      });
      // Met à jour les boutons
      await refreshClientTicketButtons(guild, contrat);
    }

    await devTicket.send({
      embeds: [new EmbedBuilder().setColor(0xFF8C00).setDescription('⏳ **Attente du 1er paiement client.**')],
    });

    await interaction.editReply({ content: `✅ Ticket dev créé : ${devTicket} ! Dev(s) assignés : ${devsStr}${warnNotFound}` });
    return;
  }

  // ── Bouton : ✅ Dev payé (ticket dev, étape 4) ────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'nc_dev_paye') {
    if (!canSecretaire(interaction.member)) {
      await interaction.reply({ content: '❌ Réservé au secrétaire / owner.', ephemeral: true }); return;
    }
    const contrat = findContratByChannel(interaction.channelId);
    if (!contrat || contrat.etape !== 4) { await interaction.reply({ content: '❌ Action non disponible à cette étape.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    const guild = interaction.guild;

    // Retire le dev du ticket dev
    for (const devId of contrat.devIds) {
      const devCh = guild.channels.cache.get(contrat.devTicketId);
      if (devCh) await devCh.permissionOverwrites.delete(devId).catch(() => {});
    }

    // Renomme ticket dev avec ✅
    const devCh = guild.channels.cache.get(contrat.devTicketId);
    if (devCh) await renameChannelPrefix(devCh, '✅').catch(() => {});

    // Crée le ticket paiement secrétaire
    const payTicket = await guild.channels.create({
      name: `📍💳-${interaction.user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      type: ChannelType.GuildText,
      parent: contrat.categoryId,
      permissionOverwrites: [
        { id: guild.roles.everyone,          deny:  [PermissionFlagsBits.ViewChannel] },
        { id: CONFIG.SECRETAIRE_ROLE_ID,     allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        { id: CONFIG.OWNER_ROLE_ID,          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        { id: CONFIG.GESTION_TICKET_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });

    contrat.paySecretaireTicketId = payTicket.id;
    contrat.etape                 = 5;
    newContrats.set(contrat.categoryId, contrat);
    await renameCategoryEmoji(guild, contrat.categoryId, 5);

    await payTicket.send({
      content: `<@&${CONFIG.OWNER_ROLE_ID}>`,
      embeds: [new EmbedBuilder()
        .setTitle('💳 Paiement secrétaire en attente')
        .setColor(0xFF8C00)
        .setDescription(`⏳ Le développeur a été payé.\nEn attente du **paiement du secrétaire** <@${interaction.user.id}>.`)
        .setFooter({ text: 'HEO Studio • Paiement secrétaire' })
        .setTimestamp()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nc_terminer_paiement_sec').setLabel('✅ TERMINER — Secrétaire payé').setStyle(ButtonStyle.Success),
      )],
    });

    // Met à jour emoji catégorie
    await renameCategoryEmoji(guild, contrat.categoryId, 5);

    await interaction.message.edit({
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nc_dev_paye').setLabel('✅ Dev payé').setStyle(ButtonStyle.Success).setDisabled(true),
      )],
    });
    return;
  }

  // ── Bouton : ✅ Terminer paiement secrétaire ──────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'nc_terminer_paiement_sec') {
    if (!canOwner(interaction.member)) {
      await interaction.reply({ content: '❌ Réservé aux owners.', ephemeral: true }); return;
    }
    const contrat = findContratByChannel(interaction.channelId);
    if (!contrat) { await interaction.reply({ content: '❌ Contrat introuvable.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    const guild = interaction.guild;

    // Renomme ticket paiement secrétaire avec ✅
    const payCh = guild.channels.cache.get(contrat.paySecretaireTicketId);
    if (payCh) {
      await payCh.send({
        embeds: [new EmbedBuilder().setColor(0x57F287).setDescription('✅ **Paiement secrétaire effectué !** Contrat terminé.')],
      });
      await renameChannelPrefix(payCh, '✅').catch(() => {});
    }

    // Renomme catégorie ✅
    await renameCategoryEmoji(guild, contrat.categoryId, 5);

    // Désactive le bouton
    await interaction.message.edit({
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('nc_terminer_paiement_sec').setLabel('✅ Terminé').setStyle(ButtonStyle.Success).setDisabled(true),
      )],
    });
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ─── ASSETS / BOUTIQUE ──────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  if (interaction.isModalSubmit() && interaction.customId === 'modal_shop_asset') {
    await interaction.deferReply({ ephemeral: true });
    const nom      = interaction.fields.getTextInputValue('asset_nom');
    const desc     = interaction.fields.getTextInputValue('asset_desc');
    const prix     = interaction.fields.getTextInputValue('asset_prix');
    const typeRaw  = interaction.fields.getTextInputValue('asset_type').toLowerCase().trim();
    const mediaUrl = interaction.fields.getTextInputValue('asset_media').trim();
    if (!ASSET_TYPE_ICONS[typeRaw]) { await interaction.editReply({ content: '❌ Type invalide. Utilise : `build`, `ui`, `script` ou `animation`.' }); return; }
    const typeLabel   = ASSET_TYPE_ICONS[typeRaw];
    const shopChannel = await client.channels.fetch(CONFIG.SHOP_CHANNEL_ID);
    const embed       = buildAssetEmbed(nom, desc, prix, typeLabel, mediaUrl);
    const msg = await shopChannel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('acheter_asset').setLabel('🛒 Acheter').setStyle(ButtonStyle.Success))],
    });
    await interaction.editReply({ content: `✅ Asset publié dans ${shopChannel} !\nID du message : \`${msg.id}\` *(garde-le pour /modif)*` });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'modal_modif_asset') {
    await interaction.deferReply({ ephemeral: true });
    const pending = pendingShop.get(interaction.user.id);
    if (!pending) { await interaction.editReply({ content: '❌ Session expirée, relance /modif.' }); return; }
    pendingShop.delete(interaction.user.id);
    const shopChannel = await client.channels.fetch(pending.channelId);
    let targetMsg;
    try { targetMsg = await shopChannel.messages.fetch(pending.messageId); }
    catch { await interaction.editReply({ content: '❌ Message introuvable.' }); return; }
    const oldEmbed = targetMsg.embeds[0];
    if (!oldEmbed) { await interaction.editReply({ content: '❌ Embed introuvable sur ce message.' }); return; }
    const nomRaw   = interaction.fields.getTextInputValue('asset_nom').trim();
    const descRaw  = interaction.fields.getTextInputValue('asset_desc').trim();
    const prixRaw  = interaction.fields.getTextInputValue('asset_prix').trim();
    const typeRaw  = interaction.fields.getTextInputValue('asset_type').toLowerCase().trim();
    const mediaRaw = interaction.fields.getTextInputValue('asset_media').trim();
    const oldNom   = oldEmbed.title?.replace(/^.+? — /, '') ?? '';
    const oldDesc  = oldEmbed.fields?.find(f => f.name === '📝 Description')?.value ?? '';
    const oldPrix  = oldEmbed.fields?.find(f => f.name === '💰 Prix')?.value ?? '';
    const oldType  = oldEmbed.fields?.find(f => f.name === '🗂️ Type')?.value ?? '';
    const oldMedia = oldEmbed.image?.url ?? '';
    if (typeRaw && !ASSET_TYPE_ICONS[typeRaw]) { await interaction.editReply({ content: '❌ Type invalide. Utilise : `build`, `ui`, `script` ou `animation`.' }); return; }
    const newNom       = nomRaw  || oldNom;
    const newDesc      = descRaw || oldDesc;
    const newPrix      = prixRaw || oldPrix;
    const newMedia     = mediaRaw || oldMedia;
    const newTypeRaw   = typeRaw || Object.entries(ASSET_TYPE_ICONS).find(([, v]) => v === oldType)?.[0] || 'build';
    const newTypeLabel = ASSET_TYPE_ICONS[newTypeRaw];
    const updatedEmbed = buildAssetEmbed(newNom, newDesc, newPrix, newTypeLabel, newMedia);
    updatedEmbed.setColor(oldEmbed.color ?? 0x5865F2);
    await targetMsg.edit({ embeds: [updatedEmbed] });
    await interaction.editReply({ content: `✅ Asset **${newNom}** mis à jour avec succès !` });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'acheter_asset') {
    const embed    = interaction.message.embeds[0];
    const assetNom = embed?.title?.replace(/^.+? — /, '') ?? 'Asset inconnu';
    const modal    = new ModalBuilder().setCustomId(`modal_achat_asset:${assetNom.slice(0, 90)}`).setTitle(`🛒 Acheter — ${assetNom.slice(0, 40)}`);
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('achat_moyen_paiement').setLabel('Moyen de paiement').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Robux, PayPal, carte...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('achat_message').setLabel('Message / infos supplémentaires').setStyle(TextInputStyle.Paragraph).setPlaceholder('Questions, précisions, usage prévu...').setRequired(false)),
    );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_achat_asset:')) {
    await interaction.deferReply({ ephemeral: true });
    const user          = interaction.user;
    const guild         = interaction.guild;
    const assetNom      = interaction.customId.slice('modal_achat_asset:'.length);
    const moyenPaiement = interaction.fields.getTextInputValue('achat_moyen_paiement');
    const messageClient = interaction.fields.getTextInputValue('achat_message') || '*Aucun*';
    const existing = guild.channels.cache.find(c =>
      c.name.startsWith(`achat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}`) &&
      c.type === ChannelType.GuildText
    );
    if (existing) { await interaction.editReply({ content: `❌ Tu as déjà un ticket d'achat ouvert : ${existing}` }); return; }
    const ticketChannel = await guild.channels.create({
      name: `achat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      type: ChannelType.GuildText,
      parent: CONFIG.ACHAT_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.roles.everyone,   deny:  [PermissionFlagsBits.ViewChannel] },
        { id: user.id,                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.VENDEUR_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });
    await ticketChannel.send({
      content: `👋 <@${user.id}> | <@&${CONFIG.VENDEUR_ROLE_ID}>`,
      embeds: [new EmbedBuilder()
        .setTitle(`🛒 Demande d'achat — ${user.username}`)
        .setColor(0x57F287)
        .addFields(
          { name: '👤 Acheteur',          value: `<@${user.id}>`, inline: true  },
          { name: '🎮 Article',           value: assetNom,         inline: true  },
          { name: '💳 Moyen de paiement', value: moyenPaiement,    inline: true  },
          { name: '💬 Message',           value: messageClient,    inline: false },
        )
        .setFooter({ text: 'HEO Studio • Boutique' })
        .setTimestamp()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('achat_fermer').setLabel('🔒 Fermer le ticket').setStyle(ButtonStyle.Secondary),
      )],
    });
    await interaction.editReply({ content: `✅ Ton ticket d'achat a été créé : ${ticketChannel}` });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'achat_fermer') {
    const member    = interaction.member;
    const isVendeur = member.roles.cache.has(CONFIG.VENDEUR_ROLE_ID);
    const isAdmin   = member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isVendeur && !isAdmin) { await interaction.reply({ content: '❌ Réservé au rôle vendeur.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    const channel = interaction.channel;
    const guild   = interaction.guild;
    for (const [id] of channel.permissionOverwrites.cache) {
      if (id === guild.id) continue;
      if (id === CONFIG.VENDEUR_ROLE_ID) continue;
      await channel.permissionOverwrites.edit(id, { ViewChannel: false, SendMessages: false, ReadMessageHistory: false }).catch(() => {});
    }
    const newName = `🔒${channel.name.replace(/^🔒/, '')}`;
    await channel.setName(newName).catch(() => {});
    await interaction.message.edit({
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('achat_fermer').setLabel('🔒 Fermé').setStyle(ButtonStyle.Secondary).setDisabled(true),
      )],
    });
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x99AAB5).setDescription(`🔒 Ce ticket est **fermé** par <@${interaction.user.id}>\nLe salon est conservé comme archive.`)] });
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ─── SUPPORT ────────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  if (interaction.isStringSelectMenu() && interaction.customId === 'select_support') {
    const type = interaction.values[0];
    const modals = {
      question:   { title: '❓ Poser une question',   fields: [{ id: 'sujet', label: 'Sujet', short: true, placeholder: 'Ex: Délais, paiements...' }, { id: 'message', label: 'Ta question', short: false, placeholder: 'Décris ta question en détail...' }] },
      suggestion: { title: '💡 Faire une suggestion', fields: [{ id: 'sujet', label: 'Titre de la suggestion', short: true, placeholder: 'Ex: Ajouter une fonctionnalité...' }, { id: 'message', label: 'Description', short: false, placeholder: 'Décris ta suggestion en détail...' }] },
      report:     { title: '🚨 Signaler un problème', fields: [{ id: 'sujet', label: 'Qui ou quoi signaler ?', short: true, placeholder: 'Ex: Pseudo du joueur, bug...' }, { id: 'message', label: 'Description + preuves', short: false, placeholder: 'Décris le problème, ajoute des preuves si possible...' }] },
    };
    const modalDef = modals[type];
    const modal = new ModalBuilder().setCustomId(`modal_support_${type}`).setTitle(modalDef.title);
    for (const f of modalDef.fields) {
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setStyle(f.short ? TextInputStyle.Short : TextInputStyle.Paragraph).setPlaceholder(f.placeholder).setRequired(true)
      ));
    }
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_support_')) {
    await interaction.deferReply({ ephemeral: true });
    const type     = interaction.customId.replace('modal_support_', '');
    const sujet    = interaction.fields.getTextInputValue('sujet');
    const message  = interaction.fields.getTextInputValue('message');
    const user     = interaction.user;
    const guild    = interaction.guild;
    const typeInfo = CONFIG.SUPPORT_TYPES[type];
    const ticketChannel = await guild.channels.create({
      name: `${type}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      type: ChannelType.GuildText,
      parent: CONFIG.CATEGORIES.SUPPORT,
      permissionOverwrites: [
        { id: guild.roles.everyone,  deny:  [PermissionFlagsBits.ViewChannel] },
        { id: user.id,               allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.STAFF_ROLE_ID,  allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });
    await ticketChannel.send({
      content: `👋 <@${user.id}> | <@&${CONFIG.STAFF_ROLE_ID}>`,
      embeds: [new EmbedBuilder()
        .setTitle(`${typeInfo.label} — ${sujet}`)
        .setColor(typeInfo.color)
        .addFields(
          { name: '👤 Membre',  value: `<@${user.id}>`, inline: true },
          { name: '📝 Message', value: message,          inline: false },
        )
        .setFooter({ text: 'HEO Studio • Support' })
        .setTimestamp()],
      components: [buildSupportRow(false)],
    });
    await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'fermer_support') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    const channel = interaction.channel;
    for (const [id] of channel.permissionOverwrites.cache) {
      if (id !== interaction.guild.roles.everyone.id && id !== CONFIG.STAFF_ROLE_ID) {
        await channel.permissionOverwrites.edit(id, { ViewChannel: false, SendMessages: false });
      }
    }
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x99AAB5).setDescription(`🔒 Ticket **fermé** par <@${interaction.user.id}>\nLe membre n'a plus accès à ce salon.`)] });
    await interaction.message.edit({ components: [buildSupportRow(true)] });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'supprimer_support') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.reply({
      content: '⚠️ Tu es sûr de vouloir **supprimer définitivement** ce ticket ?',
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirmer_suppression_support').setLabel('✅ Oui, supprimer').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('annuler_suppression_support').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary),
      )],
      ephemeral: true,
    });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'confirmer_suppression_support') {
    const channel = interaction.channel;
    await interaction.reply({ content: '🗑️ Suppression en cours...', ephemeral: true });
    setTimeout(() => channel.delete().catch(() => {}), 2000);
    return;
  }

  if (interaction.isButton() && interaction.customId === 'annuler_suppression_support') {
    await interaction.reply({ content: '✅ Suppression annulée.', ephemeral: true }); return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ─── ANCIEN SYSTÈME — CONTRATS ───────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  if (interaction.isButton() && interaction.customId === 'creer_contrat') {
    const modal = new ModalBuilder().setCustomId('modal_contrat').setTitle('Nouvelle demande de contrat');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom_projet').setLabel('Nom du projet').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Jeu Roblox RPG, Site vitrine...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description du projet').setStyle(TextInputStyle.Paragraph).setPlaceholder('Décris ce que tu veux qu\'on réalise...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('budget').setLabel('Budget estimé (en Robux ou €)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 5000 Robux, 50€...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('delai').setLabel('Délai souhaité').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 2 semaines, 1 mois...').setRequired(false)),
    );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'modal_contrat') {
    await interaction.deferReply({ ephemeral: true });
    const nomProjet   = interaction.fields.getTextInputValue('nom_projet');
    const description = interaction.fields.getTextInputValue('description');
    const budget      = interaction.fields.getTextInputValue('budget');
    const delai       = interaction.fields.getTextInputValue('delai') || 'Non précisé';
    const guild       = interaction.guild;
    const user        = interaction.user;
    const existing = guild.channels.cache.find(c =>
      c.name === `contrat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}` && c.type === ChannelType.GuildText
    );
    if (existing) { await interaction.editReply({ content: `❌ Tu as déjà un ticket ouvert : ${existing}` }); return; }
    const ticketChannel = await guild.channels.create({
      name: `contrat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      type: ChannelType.GuildText,
      parent: CONFIG.CATEGORIES.NEGOCIATION,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny:  [PermissionFlagsBits.ViewChannel] },
        { id: user.id,              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
        { id: CONFIG.DEV_ROLE_ID,   allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
    ticketEtapes.set(ticketChannel.id, 0);
    ticketInfos.set(ticketChannel.id, { nom: nomProjet, description, budget, delai, clientId: user.id });
    await ticketChannel.send({
      content: `👋 <@${user.id}> | <@&${CONFIG.STAFF_ROLE_ID}>`,
      embeds: [buildEmbed(nomProjet, description, budget, delai, user, 0)],
      components: [buildStaffRow(0)],
    });
    await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'etape_precedente') {
    const channel       = interaction.channel;
    const etapeActuelle = ticketEtapes.get(channel.id) ?? 0;
    if (!canAdvanceEtape(interaction.member, channel.id, etapeActuelle)) {
      await interaction.reply({ content: '❌ Tu n\'as pas la permission de faire ça.', ephemeral: true }); return;
    }
    const etapePrecedente = etapeActuelle - 1;
    if (etapePrecedente < 0) { await interaction.reply({ content: '⚠️ Déjà à la première étape.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    await channel.setParent(CONFIG.CATEGORIES[CONFIG.ETAPES[etapePrecedente].id], { lockPermissions: false });
    ticketEtapes.set(channel.id, etapePrecedente);
    const info       = ticketInfos.get(channel.id);
    const assignment = ticketDevAssignment.get(channel.id) ?? null;
    const clientUser = await client.users.fetch(info.clientId);
    const updatedEmbed = buildEmbed(info.nom, info.description, info.budget, info.delai, clientUser, etapePrecedente, assignment).setColor(CONFIG.ETAPES[etapePrecedente].color);
    await interaction.message.edit({ embeds: [updatedEmbed], components: [buildStaffRow(etapePrecedente)] });
    await channel.send({ embeds: [new EmbedBuilder().setColor(CONFIG.ETAPES[etapePrecedente].color).setDescription(`◀️ Ticket revenu à l'étape : **${CONFIG.ETAPES[etapePrecedente].label}**\nPar : <@${interaction.user.id}>`)] });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'etape_suivante') {
    const channel       = interaction.channel;
    const etapeActuelle = ticketEtapes.get(channel.id) ?? 0;
    if (!canAdvanceEtape(interaction.member, channel.id, etapeActuelle)) {
      await interaction.reply({ content: '❌ Tu n\'as pas la permission de faire ça.', ephemeral: true }); return;
    }
    const nouvelleEtape = etapeActuelle + 1;
    if (nouvelleEtape >= CONFIG.ETAPES.length) { await interaction.reply({ content: '✅ Déjà à l\'étape finale.', ephemeral: true }); return; }
    if (etapeActuelle === 0) {
      await interaction.deferUpdate();
      const formMsg = await sendFormEtape1(channel, []);
      pendingDevForm.set(channel.id, { types: [], formMessageId: formMsg.id });
      return;
    }
    await interaction.deferUpdate();
    await channel.setParent(CONFIG.CATEGORIES[CONFIG.ETAPES[nouvelleEtape].id], { lockPermissions: false });
    ticketEtapes.set(channel.id, nouvelleEtape);
    const info       = ticketInfos.get(channel.id);
    const assignment = ticketDevAssignment.get(channel.id) ?? null;
    const clientUser = await client.users.fetch(info.clientId);
    const updatedEmbed = buildEmbed(info.nom, info.description, info.budget, info.delai, clientUser, nouvelleEtape, assignment);
    await interaction.message.edit({ embeds: [updatedEmbed], components: [buildStaffRow(nouvelleEtape)] });
    await channel.send({ embeds: [new EmbedBuilder().setColor(CONFIG.ETAPES[nouvelleEtape].color).setDescription(`📌 Ticket avancé à l'étape : **${CONFIG.ETAPES[nouvelleEtape].label}**\nPar : <@${interaction.user.id}>`)] });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'dev_form_types') {
    const channel = interaction.channel;
    const pending = pendingDevForm.get(channel.id);
    if (!pending) { await interaction.reply({ content: '❌ Formulaire expiré.', ephemeral: true }); return; }
    pending.types = interaction.values;
    pendingDevForm.set(channel.id, pending);
    await interaction.deferUpdate();
    const embed = new EmbedBuilder()
      .setTitle('👥 Assignation des devs — Étape 1/2')
      .setDescription('Sélectionne le ou les **types de dev** retenus pour ce projet.\nTous les devs de ce type seront notifiés comme support/backup.')
      .setColor(0x5865F2)
      .setFooter({ text: `Types sélectionnés : ${pending.types.join(', ')}` });
    await interaction.message.edit({ embeds: [embed] });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'dev_form_annuler') {
    const channel = interaction.channel;
    const pending = pendingDevForm.get(channel.id);
    if (!pending) { await interaction.reply({ content: '❌ Formulaire déjà fermé.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    pendingDevForm.delete(channel.id);
    await interaction.message.delete().catch(() => {});
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x99AAB5).setDescription(`❌ Formulaire d'assignation annulé par <@${interaction.user.id}>.`)] });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'dev_form_etape2') {
    const channel = interaction.channel;
    const pending = pendingDevForm.get(channel.id);
    if (!pending) { await interaction.reply({ content: '❌ Formulaire expiré.', ephemeral: true }); return; }
    if (pending.types.length === 0) { await interaction.reply({ content: '⚠️ Sélectionne au moins un type de dev avant de continuer.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    await interaction.message.delete().catch(() => {});
    const embed2 = new EmbedBuilder()
      .setTitle('👥 Assignation des devs — Étape 2/2')
      .setDescription(`Types retenus : **${pending.types.map(t => DEV_TYPE_ICONS[t] ?? t).join(', ')}**\n\nEntre les **pseudos des devs assignés** au projet.\nSépare les pseudos par des **virgules**.\n\n> Ex: \`Jean, Marc, Sophie\``)
      .setColor(0x5865F2)
      .setFooter({ text: 'Pseudos exacts (username, pseudo serveur ou globalName)' });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('dev_form_annuler_etape2').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('dev_form_ouvrir_modal').setLabel('✏️ Entrer les pseudos').setStyle(ButtonStyle.Primary),
    );
    const msg2 = await channel.send({ embeds: [embed2], components: [row] });
    pending.formMessageId = msg2.id;
    pendingDevForm.set(channel.id, pending);
    return;
  }

  if (interaction.isButton() && interaction.customId === 'dev_form_ouvrir_modal') {
    const channel = interaction.channel;
    const pending = pendingDevForm.get(channel.id);
    if (!pending) { await interaction.reply({ content: '❌ Formulaire expiré.', ephemeral: true }); return; }
    const modal = new ModalBuilder().setCustomId('dev_form_modal_assignes').setTitle('👥 Assignation des devs — Étape 2/2');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('pseudos_assignes').setLabel('Pseudos des devs assignés au projet').setStyle(TextInputStyle.Paragraph).setPlaceholder('Ex: Jean, Marc, Sophie\n(Sépare les pseudos par des virgules)').setRequired(true)
      )
    );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isButton() && interaction.customId === 'dev_form_annuler_etape2') {
    const channel = interaction.channel;
    pendingDevForm.delete(channel.id);
    await interaction.deferUpdate();
    await interaction.message.delete().catch(() => {});
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x99AAB5).setDescription(`❌ Formulaire d'assignation annulé par <@${interaction.user.id}>.`)] });
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'dev_form_modal_assignes') {
    await interaction.deferReply({ ephemeral: true });
    const channel = interaction.channel;
    const pending = pendingDevForm.get(channel.id);
    if (!pending) { await interaction.editReply({ content: '❌ Formulaire expiré, recommence depuis le bouton ➡️.' }); return; }
    const pseudosRaw = interaction.fields.getTextInputValue('pseudos_assignes');
    const pseudos    = pseudosRaw.split(',').map(p => p.trim().toLowerCase()).filter(Boolean);
    const guild      = interaction.guild;
    await guild.members.fetch();
    const assignesIds = [];
    const notFound    = [];
    for (const pseudo of pseudos) {
      const found = guild.members.cache.find(m =>
        m.user.username.toLowerCase() === pseudo ||
        (m.nickname && m.nickname.toLowerCase() === pseudo) ||
        m.user.globalName?.toLowerCase() === pseudo
      );
      if (found) assignesIds.push(found.id);
      else notFound.push(pseudo);
    }
    if (assignesIds.length === 0) { await interaction.editReply({ content: `❌ Aucun membre trouvé. Vérifie les pseudos :\n${pseudos.map(p => `• \`${p}\``).join('\n')}` }); return; }
    const backupIds = [];
    for (const type of pending.types) {
      const roleId = CONFIG.DEV_ROLES[type];
      if (!roleId) continue;
      for (const [, member] of guild.members.cache) {
        if (member.roles.cache.has(roleId) && !assignesIds.includes(member.id) && !backupIds.includes(member.id)) {
          backupIds.push(member.id);
        }
      }
    }
    const assignment = { types: pending.types, assignes: assignesIds, backup: backupIds };
    ticketDevAssignment.set(channel.id, assignment);
    pendingDevForm.delete(channel.id);
    await channel.permissionOverwrites.delete(CONFIG.DEV_ROLE_ID).catch(() => {});
    for (const [type, roleId] of Object.entries(CONFIG.DEV_ROLES)) {
      if (!pending.types.includes(type)) await channel.permissionOverwrites.delete(roleId).catch(() => {});
    }
    for (const type of pending.types) {
      const roleId = CONFIG.DEV_ROLES[type];
      if (!roleId) continue;
      await channel.permissionOverwrites.edit(roleId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
    }
    for (const userId of assignesIds) {
      await channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }).catch(() => {});
    }
    const nouvelleEtape = 1;
    await channel.setParent(CONFIG.CATEGORIES[CONFIG.ETAPES[nouvelleEtape].id], { lockPermissions: false });
    ticketEtapes.set(channel.id, nouvelleEtape);
    const info         = ticketInfos.get(channel.id);
    const clientUser   = await client.users.fetch(info.clientId);
    const updatedEmbed = buildEmbed(info.nom, info.description, info.budget, info.delai, clientUser, nouvelleEtape, assignment);
    const newStaffRow  = buildStaffRow(nouvelleEtape);
    const messages     = await channel.messages.fetch({ limit: 50 });
    const embedMsg     = messages.find(m =>
      m.author.id === client.user.id && m.embeds.length > 0 && m.components.length > 0 &&
      m.components[0]?.components?.some(c => c.customId === 'etape_suivante')
    );
    if (embedMsg) await embedMsg.edit({ embeds: [updatedEmbed], components: [newStaffRow] });
    const formMsg = await channel.messages.fetch(pending.formMessageId).catch(() => null);
    if (formMsg) await formMsg.delete().catch(() => {});
    const typesLabel      = pending.types.map(t => DEV_TYPE_ICONS[t] ?? t).join(', ');
    const warningNotFound = notFound.length > 0 ? `\n\n⚠️ Pseudos non trouvés : ${notFound.map(p => `\`${p}\``).join(', ')}` : '';
    await channel.send({
      embeds: [new EmbedBuilder()
        .setColor(CONFIG.ETAPES[nouvelleEtape].color)
        .setTitle('✅ Devs assignés au projet')
        .addFields(
          { name: '🗂️ Types retenus',  value: typesLabel,                                                    inline: false },
          { name: '🔨 Devs assignés',  value: assignesIds.map(id => `🔨 <@${id}>`).join('\n') || '*Aucun*', inline: true  },
          { name: '🔧 Support/Backup', value: backupIds.map(id => `🔧 <@${id}>`).join('\n') || '*Aucun*',   inline: true  },
        )
        .setDescription(`📌 Ticket avancé à l'étape : **${CONFIG.ETAPES[nouvelleEtape].label}**\nPar : <@${interaction.user.id}>${warningNotFound}`)
        .setFooter({ text: 'HEO Studio • Assignation devs' })
        .setTimestamp()],
    });
    await interaction.editReply({ content: `✅ ${assignesIds.length} dev(s) assigné(s) ! Le ticket passe en **${CONFIG.ETAPES[nouvelleEtape].label}**.` });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'supprimer_ticket') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.reply({
      content: '⚠️ Tu es sûr de vouloir **supprimer définitivement** ce ticket ?',
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('confirmer_suppression').setLabel('✅ Oui, supprimer').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('annuler_suppression').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary),
      )],
      ephemeral: true,
    });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'confirmer_suppression') {
    const channel = interaction.channel;
    ticketEtapes.delete(channel.id);
    ticketInfos.delete(channel.id);
    ticketDevAssignment.delete(channel.id);
    pendingDevForm.delete(channel.id);
    await interaction.reply({ content: '🗑️ Suppression en cours...', ephemeral: true });
    setTimeout(() => channel.delete().catch(() => {}), 2000);
    return;
  }

  if (interaction.isButton() && interaction.customId === 'annuler_suppression') {
    await interaction.reply({ content: '✅ Suppression annulée.', ephemeral: true }); return;
  }

  if (interaction.isButton() && interaction.customId === 'annuler_contrat') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    const channel = interaction.channel;
    await channel.setParent(CONFIG.CATEGORIES.ANNULE, { lockPermissions: false });
    ticketEtapes.set(channel.id, -1);
    ticketInfos.delete(channel.id);
    ticketDevAssignment.delete(channel.id);
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xED4245).setFooter({ text: 'HEO Studio • ❌ Contrat annulé' });
    const disabledRow  = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('etape_precedente').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('etape_suivante').setLabel('Annulé').setStyle(ButtonStyle.Danger).setDisabled(true),
      new ButtonBuilder().setCustomId('annuler_contrat').setLabel('🚫 Annulé').setStyle(ButtonStyle.Secondary).setDisabled(true),
      new ButtonBuilder().setCustomId('supprimer_ticket').setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Secondary),
    );
    await interaction.message.edit({ embeds: [updatedEmbed], components: [disabledRow] });
    await channel.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ Contrat **annulé** par <@${interaction.user.id}>`)] });
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ─── RECRUTEMENT ────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  if (interaction.isButton() && interaction.customId === 'creer_recrutement') {
    const modal = new ModalBuilder().setCustomId('modal_recrutement').setTitle('📩 Candidature Dev — HEO Studio');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('type_dev').setLabel('Type de développeur').setStyle(TextInputStyle.Short).setPlaceholder('Ex: UI, Scripting, Builder, Animation (ou plusieurs)').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('disponibilite').setLabel('Disponibilité (jours / horaires)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Lun-Ven 18h-22h, Week-end toute la journée...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('paiement').setLabel('Type de paiement souhaité').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Robux, €, % sur projet...').setRequired(true)),
    );
    await interaction.showModal(modal);
    return;
  }

  if (interaction.isModalSubmit() && interaction.customId === 'modal_recrutement') {
    await interaction.deferReply({ ephemeral: true });
    const typeDev       = interaction.fields.getTextInputValue('type_dev');
    const disponibilite = interaction.fields.getTextInputValue('disponibilite');
    const paiement      = interaction.fields.getTextInputValue('paiement');
    const user          = interaction.user;
    const guild         = interaction.guild;
    const existing = guild.channels.cache.find(c =>
      c.name === `recrut-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}` && c.type === ChannelType.GuildText
    );
    if (existing) { await interaction.editReply({ content: `❌ Tu as déjà une candidature ouverte : ${existing}` }); return; }
    const ticketChannel = await guild.channels.create({
      name: `recrut-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      type: ChannelType.GuildText,
      parent: CONFIG.RECRUTEMENT_CATEGORY_ID,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny:  [PermissionFlagsBits.ViewChannel] },
        { id: user.id,              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });
    await ticketChannel.send({
      content: `👋 <@${user.id}> | <@&${CONFIG.STAFF_ROLE_ID}>`,
      embeds: [new EmbedBuilder()
        .setTitle(`📩 Candidature — ${user.username}`)
        .setColor(0x5865F2)
        .addFields(
          { name: '👤 Candidat',         value: `<@${user.id}>`, inline: true  },
          { name: '🛠️ Type de dev',       value: typeDev,         inline: true  },
          { name: '🕐 Disponibilité',     value: disponibilite,   inline: false },
          { name: '💰 Paiement souhaité', value: paiement,        inline: true  },
        )
        .setFooter({ text: 'HEO Studio • Recrutement' })
        .setTimestamp()],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('recrut_accepter').setLabel('✅ Accepter').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('recrut_refuser').setLabel('❌ Refuser').setStyle(ButtonStyle.Danger),
      )],
    });
    await interaction.editReply({ content: `✅ Ta candidature a été ouverte : ${ticketChannel}` });
    return;
  }

  if (interaction.isButton() && interaction.customId === 'recrut_refuser') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    const channel     = interaction.channel;
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('recrut_accepter').setLabel('✅ Accepter').setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('recrut_refuser').setLabel('❌ Refusé').setStyle(ButtonStyle.Danger).setDisabled(true),
    );
    await interaction.message.edit({ components: [disabledRow] });
    await channel.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ Candidature **refusée** par <@${interaction.user.id}>\nLe salon sera supprimé dans 5 secondes.`)] });
    setTimeout(() => channel.delete().catch(() => {}), 5000);
    return;
  }

  if (interaction.isButton() && interaction.customId === 'recrut_accepter') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    const channel     = interaction.channel;
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('recrut_accepter').setLabel('✅ Accepté').setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('recrut_refuser').setLabel('❌ Refuser').setStyle(ButtonStyle.Danger).setDisabled(true),
    );
    await interaction.message.edit({ components: [disabledRow] });
    const selectTypes = new StringSelectMenuBuilder()
      .setCustomId('recrut_select_types').setPlaceholder('Sélectionne le ou les types retenus...').setMinValues(1).setMaxValues(4)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🎨 UI').setValue('ui'),
        new StringSelectMenuOptionBuilder().setLabel('🏗️ Builder').setValue('builder'),
        new StringSelectMenuOptionBuilder().setLabel('💨 Animateur').setValue('animateur'),
        new StringSelectMenuOptionBuilder().setLabel('💻 Scripteur').setValue('scripteur'),
      );
    await channel.send({
      embeds: [new EmbedBuilder().setTitle('✅ Candidature acceptée — Étape 1/2').setDescription('Sélectionne le ou les **types de dev** attribués à ce candidat.').setColor(0x57F287)],
      components: [
        new ActionRowBuilder().addComponents(selectTypes),
        new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('recrut_types_valider').setLabel('➡️ Étape suivante').setStyle(ButtonStyle.Primary)),
      ],
    });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId === 'recrut_select_types') {
    const channel  = interaction.channel;
    const existing = pendingRecrutement.get(channel.id) ?? {};
    existing.types = interaction.values;
    pendingRecrutement.set(channel.id, existing);
    await interaction.deferUpdate();
    return;
  }

  if (interaction.isButton() && interaction.customId === 'recrut_types_valider') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    const channel = interaction.channel;
    const pending = pendingRecrutement.get(channel.id);
    if (!pending?.types?.length) { await interaction.reply({ content: '⚠️ Sélectionne au moins un type de dev.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    await interaction.message.delete().catch(() => {});
    const rows = [];
    for (const type of pending.types) {
      const label = DEV_TYPE_ICONS[type] ?? type;
      rows.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId(`recrut_etoiles_${type}`).setPlaceholder(`Niveau pour ${label}...`)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐⭐ — 5 étoiles').setValue('0'),
            new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐ — 4 étoiles').setValue('1'),
            new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐ — 3 étoiles').setValue('2'),
            new StringSelectMenuOptionBuilder().setLabel('⭐⭐ — 2 étoiles').setValue('3'),
            new StringSelectMenuOptionBuilder().setLabel('⭐ — 1 étoile').setValue('4'),
          )
      ));
    }
    rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('recrut_etoiles_valider').setLabel('✅ Confirmer et attribuer les rôles').setStyle(ButtonStyle.Success)));
    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Candidature acceptée — Étape 2/2')
        .setDescription(`Types retenus : **${pending.types.map(t => DEV_TYPE_ICONS[t] ?? t).join(', ')}**\n\nChoisis le **niveau (étoiles)** pour chaque type.`)
        .setColor(0x57F287)],
      components: rows,
    });
    return;
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('recrut_etoiles_')) {
    const type    = interaction.customId.replace('recrut_etoiles_', '');
    const channel = interaction.channel;
    const pending = pendingRecrutement.get(channel.id) ?? {};
    if (!pending.etoiles) pending.etoiles = {};
    pending.etoiles[type] = interaction.values[0];
    pendingRecrutement.set(channel.id, pending);
    await interaction.deferUpdate();
    return;
  }

  if (interaction.isButton() && interaction.customId === 'recrut_etoiles_valider') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    const channel = interaction.channel;
    const pending = pendingRecrutement.get(channel.id);
    if (!pending?.types?.length || !pending?.etoiles) { await interaction.followUp({ content: '⚠️ Données manquantes, recommence.', ephemeral: true }); return; }
    for (const type of pending.types) {
      if (pending.etoiles[type] === undefined) { await interaction.followUp({ content: `⚠️ Tu n'as pas choisi le niveau pour **${DEV_TYPE_ICONS[type] ?? type}**.`, ephemeral: true }); return; }
    }
    const messages    = await channel.messages.fetch({ limit: 30 });
    const embedMsg    = messages.find(m => m.author.id === client.user.id && m.embeds?.[0]?.title?.startsWith('📩 Candidature'));
    const candidateId = embedMsg?.embeds?.[0]?.fields?.find(f => f.name === '👤 Candidat')?.value?.replace(/[<@>]/g, '');
    if (!candidateId) { await interaction.followUp({ content: '❌ Impossible de retrouver le candidat dans l\'embed.', ephemeral: true }); return; }
    const guild           = interaction.guild;
    const candidateMember = await guild.members.fetch(candidateId).catch(() => null);
    if (!candidateMember) { await interaction.followUp({ content: '❌ Le membre a quitté le serveur.', ephemeral: true }); return; }
    const rolesAdded = [];
    if (candidateMember.roles.cache.has(CONFIG.ROLE_ATT_ENTRETIEN)) await candidateMember.roles.remove(CONFIG.ROLE_ATT_ENTRETIEN).catch(() => {});
    await candidateMember.roles.add(CONFIG.ROLE_DEV_GLOBAL).catch(() => {});
    await candidateMember.roles.add(CONFIG.ROLE_SEPARATION).catch(() => {});
    rolesAdded.push(`<@&${CONFIG.ROLE_DEV_GLOBAL}>`, `<@&${CONFIG.ROLE_SEPARATION}>`);
    for (const type of pending.types) {
      const typeRoleId = CONFIG.DEV_ROLES[type];
      const starIndex  = parseInt(pending.etoiles[type], 10);
      const starRoleId = CONFIG.ETOILES_ROLES[type]?.[starIndex];
      if (typeRoleId) { await candidateMember.roles.add(typeRoleId).catch(() => {}); rolesAdded.push(`<@&${typeRoleId}>`); }
      if (starRoleId) { await candidateMember.roles.add(starRoleId).catch(() => {}); rolesAdded.push(`<@&${starRoleId}>`); }
    }
    pendingRecrutement.delete(channel.id);
    await interaction.message.delete().catch(() => {});
    const typesLabel = pending.types.map(t => {
      const starIndex = parseInt(pending.etoiles[t], 10);
      const stars     = '⭐'.repeat(5 - starIndex);
      return `${DEV_TYPE_ICONS[t] ?? t} — ${stars}`;
    }).join('\n');
    await channel.send({
      content: `🎉 <@${candidateId}>`,
      embeds: [new EmbedBuilder()
        .setTitle('🎉 Candidature acceptée !')
        .setColor(0x57F287)
        .setDescription(`Bienvenue dans l'équipe **HEO Studio** <@${candidateId}> !\nTes rôles ont été attribués par <@${interaction.user.id}>.`)
        .addFields(
          { name: '🛠️ Types & niveaux', value: typesLabel,            inline: false },
          { name: '🏷️ Rôles ajoutés',   value: rolesAdded.join('\n'), inline: false },
        )
        .setFooter({ text: 'HEO Studio • Recrutement' })
        .setTimestamp()],
    });
    return;
  }

});

// ─── HELPERS NOUVEAU SYSTÈME (fonctions séparées pour /next et boutons) ────────

function findContratByChannel(channelId) {
  for (const [, contrat] of newContrats) {
    if (contrat.clientTicketId === channelId || contrat.devTicketId === channelId || contrat.paySecretaireTicketId === channelId) {
      return contrat;
    }
  }
  return null;
}

async function refreshClientTicketButtons(guild, contrat) {
  const clientCh = guild.channels.cache.get(contrat.clientTicketId);
  if (!clientCh) return;
  // Trouve le dernier message du bot avec des boutons nc_
  const msgs = await clientCh.messages.fetch({ limit: 30 });
  const botMsg = msgs.find(m =>
    m.author.id === client.user.id &&
    m.components.length > 0 &&
    m.components[0]?.components?.some(c => c.customId?.startsWith('nc_'))
  );
  if (botMsg) {
    await botMsg.edit({ components: buildClientTicketRow(contrat.etape, contrat.annule) }).catch(() => {});
  }
}

async function handleNext(guild, contrat, user, channel) {
  if (contrat.etape === 0) {
    // Ouvre le modal pour entrer les devs — impossible depuis une fonction async sans interaction
    // On doit gérer ça directement dans le handler bouton / slash
    // Mais pour /next slash, on ne peut pas showModal sans interaction initiale
    // On envoie un message indiquant de cliquer sur le bouton à la place
    await channel.send({
      embeds: [new EmbedBuilder().setColor(0xF5C542).setDescription('⚠️ Pour passer à l\'étape 1, utilise le bouton **➡️ Dev choisi** dans le ticket pour renseigner le nom du dev.')],
    });
    return;
  }

  if (contrat.etape >= 5) {
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x57F287).setDescription('✅ Ce contrat est déjà à l\'étape finale.')] });
    return;
  }

  contrat.etape++;
  newContrats.set(contrat.categoryId, contrat);
  await renameCategoryEmoji(guild, contrat.categoryId, contrat.etape);

  const messages = {
    1: { color: 0xFF8C00, desc: `1️⃣💳 **En attente du 1er paiement.**\nPar : <@${user.id}>` },
    2: { color: 0x5865F2, desc: `✅ 1er paiement reçu — 🛠️ **Développement en cours.**\nPar : <@${user.id}>` },
    3: { color: 0xFF8C00, desc: `✅ Travail terminé — 2️⃣💳 **En attente du 2ème paiement.**\nPar : <@${user.id}>` },
    4: { color: 0x57F287, desc: `✅ 2ème paiement reçu — 💰 **En attente du paiement du dev.**\nPar : <@${user.id}>` },
    5: { color: 0x57F287, desc: `✅ **Contrat terminé !**\nPar : <@${user.id}>` },
  };

  await sendToBothTickets(guild, contrat, '', messages[contrat.etape] ?? { color: 0x57F287, desc: `Étape ${contrat.etape}` });

  // Étape 4 : ping owner pour payer le dev + bouton dans ticket dev
  if (contrat.etape === 4) {
    const devCh = guild.channels.cache.get(contrat.devTicketId);
    if (devCh) {
      await devCh.send({
        content: `<@&${CONFIG.OWNER_ROLE_ID}>`,
        embeds: [new EmbedBuilder().setColor(0x57F287).setDescription('💰 2ème paiement reçu. **Payer le développeur** et cliquer sur le bouton ci-dessous.')],
        components: buildDevTicketRow(4),
      });
    }
    // Renomme ticket client avec ✅
    const clientCh = guild.channels.cache.get(contrat.clientTicketId);
    if (clientCh) await renameChannelPrefix(clientCh, '✅').catch(() => {});
  }

  await refreshClientTicketButtons(guild, contrat);
}

async function handleBack(guild, contrat, user, channel) {
  if (contrat.etape <= 0) {
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x99AAB5).setDescription('⚠️ Déjà à la première étape.')] });
    return;
  }

  const etapePrecedente = contrat.etape - 1;

  // Si on revient de l'étape 1 à 0 : supprime le ticket dev
  if (contrat.etape === 1 && contrat.devTicketId) {
    const devCh = guild.channels.cache.get(contrat.devTicketId);
    if (devCh) await devCh.delete().catch(() => {});
    contrat.devTicketId = null;
    contrat.devIds      = [];
  }

  // Si on revient de l'étape 5 à 4 : supprime le ticket paiement secrétaire
  if (contrat.etape === 5 && contrat.paySecretaireTicketId) {
    const payCh = guild.channels.cache.get(contrat.paySecretaireTicketId);
    if (payCh) await payCh.delete().catch(() => {});
    contrat.paySecretaireTicketId = null;
  }

  // Retire le ✅ du ticket client si on revient depuis l'étape 4
  if (contrat.etape === 4) {
    const clientCh = guild.channels.cache.get(contrat.clientTicketId);
    if (clientCh) {
      const nomSans = clientCh.name.replace(/^✅-?/u, '');
      await clientCh.setName(nomSans).catch(() => {});
    }
  }

  contrat.etape = etapePrecedente;
  newContrats.set(contrat.categoryId, contrat);
  await renameCategoryEmoji(guild, contrat.categoryId, etapePrecedente);

  await sendToBothTickets(guild, contrat, '', { color: 0x99AAB5, desc: `🔙 Retour à l'étape **${etapePrecedente + 1}/6** par <@${user.id}>` });
  await refreshClientTicketButtons(guild, contrat);
}

// ─── Ouvre le modal "devs" depuis le bouton nc_next à l'étape 0 ──────────────
// (Séparé ici car showModal doit être appelé directement sur l'interaction)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== 'nc_next_etape0') return;
  if (!canSecretaire(interaction.member)) {
    await interaction.reply({ content: '❌ Réservé au secrétaire / owner.', ephemeral: true }); return;
  }
  const contrat = findContratByChannel(interaction.channelId);
  if (!contrat || contrat.etape !== 0) return;

  pendingNewDev.set(interaction.user.id, { categoryId: contrat.categoryId });

  const modal = new ModalBuilder().setCustomId('nc_modal_devs').setTitle('👷 Choisir le développeur');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('dev_pseudos').setLabel('Pseudo(s) du ou des développeurs').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Jean, Marc (sépare par des virgules)').setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('dev_infos').setLabel('Informations supplémentaires').setStyle(TextInputStyle.Paragraph).setPlaceholder('Détails, consignes, notes pour le dev...').setRequired(false)
    ),
  );
  await interaction.showModal(modal);
});

// ─── Override du bouton nc_next à l'étape 0 pour ouvrir le modal ──────────────
// On intercepte nc_next AVANT le handler générique pour l'étape 0
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton() || interaction.customId !== 'nc_next') return;
  const contrat = findContratByChannel(interaction.channelId);
  if (!contrat || contrat.etape !== 0) return;
  if (!canSecretaire(interaction.member)) {
    await interaction.reply({ content: '❌ Réservé au secrétaire / owner.', ephemeral: true }); return;
  }

  pendingNewDev.set(interaction.user.id, { categoryId: contrat.categoryId });

  const modal = new ModalBuilder().setCustomId('nc_modal_devs').setTitle('👷 Choisir le développeur');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('dev_pseudos').setLabel('Pseudo(s) du ou des développeurs').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Jean, Marc (sépare par des virgules)').setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('dev_infos').setLabel('Informations supplémentaires').setStyle(TextInputStyle.Paragraph).setPlaceholder('Détails, consignes, notes pour le dev...').setRequired(false)
    ),
  );
  await interaction.showModal(modal);
});

client.login(CONFIG.TOKEN);
