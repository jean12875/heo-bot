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

  // ─── RECRUTEMENT ──────────────────────────────────────────────────────────
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

  // ─── ASSETS / BOUTIQUE ────────────────────────────────────────────────────
  SHOP_CHANNEL_ID:   '1488940435593236570',
  ACHAT_CATEGORY_ID: '1488943924167970987',
  VENDEUR_ROLE_ID:   '1488952681278996571',
};
// ──────────────────────────────────────────────────────────────────────────────

// ─── STATE ────────────────────────────────────────────────────────────────────
const ticketEtapes        = new Map();
const ticketInfos         = new Map();
const ticketDevAssignment = new Map();
const pendingDevForm      = new Map();
const pendingRecrutement  = new Map();
const pendingShop         = new Map();
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

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  await registerSlashCommands();
});

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('contrats')
      .setDescription('Liste tous les contrats en cours')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('shop')
      .setDescription('Publier un nouvel asset dans la boutique (admin uniquement)')
      .toJSON(),
    new SlashCommandBuilder()
      .setName('modif')
      .setDescription('Modifier un asset existant dans la boutique (admin uniquement)')
      .addStringOption(opt =>
        opt.setName('message_id')
          .setDescription('ID du message de l\'asset à modifier')
          .setRequired(true)
      )
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
    const contractChannel = await client.channels.fetch(CONFIG.PANEL_CHANNEL_ID);
    await contractChannel.send({
      embeds: [new EmbedBuilder()
        .setTitle('📋 HEO Studio — Créer un contrat')
        .setDescription('Bienvenue sur le système de contrats **HEO Studio**.\n\nClique sur le bouton ci-dessous pour ouvrir une demande de contrat.\nUn salon privé sera créé pour toi et notre équipe.')
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
        .setDescription('Sélectionne le type de ticket dans le menu ci-dessous.\nUn salon privé sera créé pour toi et notre équipe.')
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
        .setDescription(
          'Tu souhaites rejoindre l\'équipe de développement **HEO Studio** ?\n\n' +
          'Clique sur le bouton ci-dessous pour ouvrir ta candidature.\nUn salon privé sera créé pour toi et notre équipe.'
        )
        .setColor(0x5865F2)
        .setFooter({ text: 'HEO Studio • Recrutement' })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('creer_recrutement').setLabel('📩 Postuler').setStyle(ButtonStyle.Primary)
      )],
    });

    console.log('✅ Panneaux envoyés !');
    process.exit(0);
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

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
    const typesLabel = devAssignment.types.map(t => DEV_TYPE_ICONS[t] ?? t).join(', ');
    const assignesStr = devAssignment.assignes.length > 0
      ? devAssignment.assignes.map(id => `🔨 <@${id}>`).join('\n')
      : '*Aucun*';
    const backupStr = devAssignment.backup.length > 0
      ? devAssignment.backup.map(id => `🔧 <@${id}>`).join('\n')
      : '*Aucun*';

    embed.addFields(
      { name: '🗂️ Types retenus',  value: typesLabel,   inline: false },
      { name: '🔨 Devs assignés',  value: assignesStr,  inline: true  },
      { name: '🔧 Support/Backup', value: backupStr,    inline: true  },
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
    .setCustomId('dev_form_types')
    .setPlaceholder('Sélectionne le(s) type(s) de dev retenus...')
    .setMinValues(1)
    .setMaxValues(4)
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
      { name: '📝 Description', value: desc,      inline: false },
      { name: '💰 Prix',        value: prix,       inline: true  },
      { name: '🗂️ Type',        value: typeLabel,  inline: true  },
    )
    .setFooter({ text: 'HEO Studio • Boutique' })
    .setTimestamp();

  if (mediaUrl) {
    const isImage = IMAGE_EXTS.some(ext => mediaUrl.toLowerCase().includes(ext));
    if (isImage) {
      embed.setImage(mediaUrl);
    } else {
      embed.addFields({ name: '🎬 Médias', value: `[Voir le média](${mediaUrl})`, inline: false });
    }
  }

  return embed;
}

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── /contrats ─────────────────────────────────────────────────────────────────
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
    await interaction.editReply({
      embeds: [new EmbedBuilder()
        .setTitle('📋 Contrats en cours — HEO Studio')
        .setColor(0x5865F2)
        .setDescription(tickets.join('\n'))
        .setFooter({ text: `${tickets.length} contrat(s) actif(s)` })
        .setTimestamp()],
    });
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ─── ASSETS / BOUTIQUE ──────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  // ── /shop ─────────────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'shop') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true }); return;
    }
    const modal = new ModalBuilder()
      .setCustomId('modal_shop_asset')
      .setTitle('🛒 Publier un asset — HEO Studio');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_nom').setLabel('Nom de l\'asset').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Map hospitalière V2, UI Pack médical...').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_desc').setLabel('Description').setStyle(TextInputStyle.Paragraph).setPlaceholder('Décris l\'asset en détail (contenu, usage, compatibilité...)').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_prix').setLabel('Prix').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 500 Robux, 10€, Gratuit...').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_type').setLabel('Type (build / ui / script / animation)').setStyle(TextInputStyle.Short).setPlaceholder('build, ui, script ou animation').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_media').setLabel('URL du média (image ou vidéo)').setStyle(TextInputStyle.Short).setPlaceholder('https://... (lien direct image ou vidéo) — optionnel').setRequired(false)
      ),
    );
    await interaction.showModal(modal);
    return;
  }

  // ── Modal /shop soumis ────────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_shop_asset') {
    await interaction.deferReply({ ephemeral: true });

    const nom      = interaction.fields.getTextInputValue('asset_nom');
    const desc     = interaction.fields.getTextInputValue('asset_desc');
    const prix     = interaction.fields.getTextInputValue('asset_prix');
    const typeRaw  = interaction.fields.getTextInputValue('asset_type').toLowerCase().trim();
    const mediaUrl = interaction.fields.getTextInputValue('asset_media').trim();

    if (!ASSET_TYPE_ICONS[typeRaw]) {
      await interaction.editReply({ content: '❌ Type invalide. Utilise : `build`, `ui`, `script` ou `animation`.' }); return;
    }

    const typeLabel   = ASSET_TYPE_ICONS[typeRaw];
    const shopChannel = await client.channels.fetch(CONFIG.SHOP_CHANNEL_ID);
    const embed       = buildAssetEmbed(nom, desc, prix, typeLabel, mediaUrl);

    const msg = await shopChannel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('acheter_asset').setLabel('🛒 Acheter').setStyle(ButtonStyle.Success)
      )],
    });

    await interaction.editReply({
      content: `✅ Asset publié dans ${shopChannel} !\nID du message : \`${msg.id}\` *(garde-le pour /modif)*`,
    });
    return;
  }

  // ── /modif ────────────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'modif') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé aux admins.', ephemeral: true }); return;
    }

    const messageId   = interaction.options.getString('message_id');
    const shopChannel = await client.channels.fetch(CONFIG.SHOP_CHANNEL_ID);

    try {
      await shopChannel.messages.fetch(messageId);
    } catch {
      await interaction.reply({ content: '❌ Message introuvable dans le salon boutique. Vérifie l\'ID.', ephemeral: true }); return;
    }

    pendingShop.set(interaction.user.id, { messageId, channelId: shopChannel.id });

    const modal = new ModalBuilder()
      .setCustomId('modal_modif_asset')
      .setTitle('✏️ Modifier un asset — HEO Studio');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_nom').setLabel('Nouveau nom').setStyle(TextInputStyle.Short).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_desc').setLabel('Nouvelle description').setStyle(TextInputStyle.Paragraph).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_prix').setLabel('Nouveau prix').setStyle(TextInputStyle.Short).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_type').setLabel('Nouveau type (build/ui/script/animation)').setStyle(TextInputStyle.Short).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('asset_media').setLabel('Nouvelle URL média').setStyle(TextInputStyle.Short).setPlaceholder('Laisse vide pour ne pas changer').setRequired(false)
      ),
    );
    await interaction.showModal(modal);
    return;
  }

  // ── Modal /modif soumis ───────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_modif_asset') {
    await interaction.deferReply({ ephemeral: true });

    const pending = pendingShop.get(interaction.user.id);
    if (!pending) { await interaction.editReply({ content: '❌ Session expirée, relance /modif.' }); return; }
    pendingShop.delete(interaction.user.id);

    const shopChannel = await client.channels.fetch(pending.channelId);
    let targetMsg;
    try {
      targetMsg = await shopChannel.messages.fetch(pending.messageId);
    } catch {
      await interaction.editReply({ content: '❌ Message introuvable.' }); return;
    }

    const oldEmbed = targetMsg.embeds[0];
    if (!oldEmbed) { await interaction.editReply({ content: '❌ Embed introuvable sur ce message.' }); return; }

    const nomRaw   = interaction.fields.getTextInputValue('asset_nom').trim();
    const descRaw  = interaction.fields.getTextInputValue('asset_desc').trim();
    const prixRaw  = interaction.fields.getTextInputValue('asset_prix').trim();
    const typeRaw  = interaction.fields.getTextInputValue('asset_type').toLowerCase().trim();
    const mediaRaw = interaction.fields.getTextInputValue('asset_media').trim();

    // Récupère les valeurs actuelles depuis l'embed
    const oldNom   = oldEmbed.title?.replace(/^.+? — /, '') ?? '';
    const oldDesc  = oldEmbed.fields?.find(f => f.name === '📝 Description')?.value ?? '';
    const oldPrix  = oldEmbed.fields?.find(f => f.name === '💰 Prix')?.value ?? '';
    const oldType  = oldEmbed.fields?.find(f => f.name === '🗂️ Type')?.value ?? '';
    const oldMedia = oldEmbed.image?.url ?? '';

    // Validation type si fourni
    if (typeRaw && !ASSET_TYPE_ICONS[typeRaw]) {
      await interaction.editReply({ content: '❌ Type invalide. Utilise : `build`, `ui`, `script` ou `animation`.' }); return;
    }

    const newNom      = nomRaw  || oldNom;
    const newDesc     = descRaw || oldDesc;
    const newPrix     = prixRaw || oldPrix;
    const newMedia    = mediaRaw || oldMedia;
    const newTypeRaw  = typeRaw || Object.entries(ASSET_TYPE_ICONS).find(([, v]) => v === oldType)?.[0] || 'build';
    const newTypeLabel = ASSET_TYPE_ICONS[newTypeRaw];

    const updatedEmbed = buildAssetEmbed(newNom, newDesc, newPrix, newTypeLabel, newMedia);
    updatedEmbed.setColor(oldEmbed.color ?? 0x5865F2);

    await targetMsg.edit({ embeds: [updatedEmbed] });
    await interaction.editReply({ content: `✅ Asset **${newNom}** mis à jour avec succès !` });
    return;
  }

  // ── Bouton Acheter ────────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'acheter_asset') {
    const embed    = interaction.message.embeds[0];
    const assetNom = embed?.title?.replace(/^.+? — /, '') ?? 'Asset inconnu';

    const modal = new ModalBuilder()
      .setCustomId('modal_achat_asset')
      .setTitle(`🛒 Acheter — ${assetNom.slice(0, 40)}`);
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('achat_pseudo_roblox').setLabel('Ton pseudo Roblox').setStyle(TextInputStyle.Short).setPlaceholder('Ex: MonPseudo123').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('achat_moyen_paiement').setLabel('Moyen de paiement').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Robux, PayPal, carte...').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('achat_message').setLabel('Message / infos supplémentaires').setStyle(TextInputStyle.Paragraph).setPlaceholder('Questions, précisions, usage prévu...').setRequired(false)
      ),
    );
    await interaction.showModal(modal);
    return;
  }

  // ── Modal achat soumis ────────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_achat_asset') {
    await interaction.deferReply({ ephemeral: true });

    const user          = interaction.user;
    const guild         = interaction.guild;
    const pseudoRoblox  = interaction.fields.getTextInputValue('achat_pseudo_roblox');
    const moyenPaiement = interaction.fields.getTextInputValue('achat_moyen_paiement');
    const messageClient = interaction.fields.getTextInputValue('achat_message') || '*Aucun*';

    // Anti-doublon
    const existing = guild.channels.cache.find(c =>
      c.name.startsWith(`achat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15)}`) &&
      c.type === ChannelType.GuildText
    );
    if (existing) {
      await interaction.editReply({ content: `❌ Tu as déjà un ticket d'achat ouvert : ${existing}` }); return;
    }

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
          { name: '🎮 Pseudo Roblox',     value: pseudoRoblox,    inline: true  },
          { name: '💳 Moyen de paiement', value: moyenPaiement,   inline: true  },
          { name: '💬 Message',           value: messageClient,   inline: false },
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

  // ── Fermer ticket achat ───────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'achat_fermer') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.VENDEUR_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au rôle vendeur.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    const channel = interaction.channel;

    for (const [id] of channel.permissionOverwrites.cache) {
      if (id !== interaction.guild.roles.everyone.id && id !== CONFIG.VENDEUR_ROLE_ID) {
        await channel.permissionOverwrites.edit(id, { ViewChannel: false, SendMessages: false });
      }
    }

    await interaction.message.edit({
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('achat_fermer').setLabel('🔒 Fermé').setStyle(ButtonStyle.Secondary).setDisabled(true),
      )],
    });
    await channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0x99AAB5)
        .setDescription(`🔒 Ticket **fermé** par <@${interaction.user.id}>\nTicket conservé comme archive.`)],
    });
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ─── SUPPORT ────────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  // ── Sélecteur support ─────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_support') {
    const type = interaction.values[0];
    const modals = {
      question:   { title: '❓ Poser une question',   fields: [
        { id: 'sujet',   label: 'Sujet',      short: true,  placeholder: 'Ex: Délais, paiements...' },
        { id: 'message', label: 'Ta question', short: false, placeholder: 'Décris ta question en détail...' },
      ]},
      suggestion: { title: '💡 Faire une suggestion', fields: [
        { id: 'sujet',   label: 'Titre de la suggestion', short: true,  placeholder: 'Ex: Ajouter une fonctionnalité...' },
        { id: 'message', label: 'Description',            short: false, placeholder: 'Décris ta suggestion en détail...' },
      ]},
      report:     { title: '🚨 Signaler un problème', fields: [
        { id: 'sujet',   label: 'Qui ou quoi signaler ?', short: true,  placeholder: 'Ex: Pseudo du joueur, bug...' },
        { id: 'message', label: 'Description + preuves',  short: false, placeholder: 'Décris le problème, ajoute des preuves si possible...' },
      ]},
    };
    const modalDef = modals[type];
    const modal = new ModalBuilder().setCustomId(`modal_support_${type}`).setTitle(modalDef.title);
    for (const f of modalDef.fields) {
      modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId(f.id).setLabel(f.label)
          .setStyle(f.short ? TextInputStyle.Short : TextInputStyle.Paragraph)
          .setPlaceholder(f.placeholder).setRequired(true)
      ));
    }
    await interaction.showModal(modal);
    return;
  }

  // ── Modal support soumis ──────────────────────────────────────────────────────
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

  // ── Fermer ticket support ─────────────────────────────────────────────────────
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

  // ── Supprimer ticket support ──────────────────────────────────────────────────
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
  // ─── CONTRATS ───────────────────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════

  // ── Créer un contrat ──────────────────────────────────────────────────────────
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

  // ── Modal contrat soumis ──────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_contrat') {
    await interaction.deferReply({ ephemeral: true });
    const nomProjet   = interaction.fields.getTextInputValue('nom_projet');
    const description = interaction.fields.getTextInputValue('description');
    const budget      = interaction.fields.getTextInputValue('budget');
    const delai       = interaction.fields.getTextInputValue('delai') || 'Non précisé';
    const guild       = interaction.guild;
    const user        = interaction.user;

    const existing = guild.channels.cache.find(c =>
      c.name === `contrat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}` &&
      c.type === ChannelType.GuildText
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

  // ── Étape précédente ──────────────────────────────────────────────────────────
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
    const updatedEmbed = buildEmbed(info.nom, info.description, info.budget, info.delai, clientUser, etapePrecedente, assignment)
      .setColor(CONFIG.ETAPES[etapePrecedente].color);
    await interaction.message.edit({ embeds: [updatedEmbed], components: [buildStaffRow(etapePrecedente)] });
    await channel.send({ embeds: [new EmbedBuilder().setColor(CONFIG.ETAPES[etapePrecedente].color).setDescription(`◀️ Ticket revenu à l'étape : **${CONFIG.ETAPES[etapePrecedente].label}**\nPar : <@${interaction.user.id}>`)] });
    return;
  }

  // ── Étape suivante ────────────────────────────────────────────────────────────
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

  // ── Formulaire assignation : sélection des types ──────────────────────────────
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

  // ── Formulaire assignation : annuler ──────────────────────────────────────────
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

  // ── Formulaire assignation : passer à l'étape 2 ──────────────────────────────
  if (interaction.isButton() && interaction.customId === 'dev_form_etape2') {
    const channel = interaction.channel;
    const pending = pendingDevForm.get(channel.id);
    if (!pending) { await interaction.reply({ content: '❌ Formulaire expiré.', ephemeral: true }); return; }
    if (pending.types.length === 0) {
      await interaction.reply({ content: '⚠️ Sélectionne au moins un type de dev avant de continuer.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    await interaction.message.delete().catch(() => {});

    const embed2 = new EmbedBuilder()
      .setTitle('👥 Assignation des devs — Étape 2/2')
      .setDescription(
        `Types retenus : **${pending.types.map(t => DEV_TYPE_ICONS[t] ?? t).join(', ')}**\n\n` +
        `Entre les **pseudos des devs assignés** au projet.\n` +
        `Sépare les pseudos par des **virgules**.\n\n` +
        `> Ex: \`Jean, Marc, Sophie\``
      )
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

  // ── Formulaire assignation : ouvre le modal depuis l'étape 2 ─────────────────
  if (interaction.isButton() && interaction.customId === 'dev_form_ouvrir_modal') {
    const channel = interaction.channel;
    const pending = pendingDevForm.get(channel.id);
    if (!pending) { await interaction.reply({ content: '❌ Formulaire expiré.', ephemeral: true }); return; }

    const modal = new ModalBuilder()
      .setCustomId('dev_form_modal_assignes')
      .setTitle('👥 Assignation des devs — Étape 2/2');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('pseudos_assignes')
          .setLabel('Pseudos des devs assignés au projet')
          .setStyle(TextInputStyle.Paragraph)
          .setPlaceholder('Ex: Jean, Marc, Sophie\n(Sépare les pseudos par des virgules)')
          .setRequired(true)
      )
    );
    await interaction.showModal(modal);
    return;
  }

  // ── Formulaire assignation : annuler depuis étape 2 ──────────────────────────
  if (interaction.isButton() && interaction.customId === 'dev_form_annuler_etape2') {
    const channel = interaction.channel;
    pendingDevForm.delete(channel.id);
    await interaction.deferUpdate();
    await interaction.message.delete().catch(() => {});
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x99AAB5).setDescription(`❌ Formulaire d'assignation annulé par <@${interaction.user.id}>.`)] });
    return;
  }

  // ── Formulaire assignation : modal étape 2 soumis ────────────────────────────
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

    if (assignesIds.length === 0) {
      await interaction.editReply({ content: `❌ Aucun membre trouvé. Vérifie les pseudos :\n${pseudos.map(p => `• \`${p}\``).join('\n')}` }); return;
    }

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
      if (!pending.types.includes(type)) {
        await channel.permissionOverwrites.delete(roleId).catch(() => {});
      }
    }

    for (const type of pending.types) {
      const roleId = CONFIG.DEV_ROLES[type];
      if (!roleId) continue;
      await channel.permissionOverwrites.edit(roleId, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      }).catch(() => {});
    }

    for (const userId of assignesIds) {
      await channel.permissionOverwrites.edit(userId, {
        ViewChannel: true, SendMessages: true, ReadMessageHistory: true,
      }).catch(() => {});
    }

    const nouvelleEtape = 1;
    await channel.setParent(CONFIG.CATEGORIES[CONFIG.ETAPES[nouvelleEtape].id], { lockPermissions: false });
    ticketEtapes.set(channel.id, nouvelleEtape);

    const info         = ticketInfos.get(channel.id);
    const clientUser   = await client.users.fetch(info.clientId);
    const updatedEmbed = buildEmbed(info.nom, info.description, info.budget, info.delai, clientUser, nouvelleEtape, assignment);
    const newStaffRow  = buildStaffRow(nouvelleEtape);

    const messages = await channel.messages.fetch({ limit: 50 });
    const embedMsg = messages.find(m =>
      m.author.id === client.user.id &&
      m.embeds.length > 0 &&
      m.components.length > 0 &&
      m.components[0]?.components?.some(c => c.customId === 'etape_suivante')
    );
    if (embedMsg) await embedMsg.edit({ embeds: [updatedEmbed], components: [newStaffRow] });

    const formMsg = await channel.messages.fetch(pending.formMessageId).catch(() => null);
    if (formMsg) await formMsg.delete().catch(() => {});

    const typesLabel      = pending.types.map(t => DEV_TYPE_ICONS[t] ?? t).join(', ');
    const warningNotFound = notFound.length > 0
      ? `\n\n⚠️ Pseudos non trouvés : ${notFound.map(p => `\`${p}\``).join(', ')}` : '';

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

  // ── Supprimer ticket contrat ──────────────────────────────────────────────────
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

  // ── Annuler contrat ───────────────────────────────────────────────────────────
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
    const disabledRow = new ActionRowBuilder().addComponents(
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

  // ── Ouvrir candidature ────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'creer_recrutement') {
    const modal = new ModalBuilder()
      .setCustomId('modal_recrutement')
      .setTitle('📩 Candidature Dev — HEO Studio');
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('type_dev').setLabel('Type de développeur').setStyle(TextInputStyle.Short).setPlaceholder('Ex: UI, Scripting, Builder, Animation (ou plusieurs)').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('disponibilite').setLabel('Disponibilité (jours / horaires)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Lun-Ven 18h-22h, Week-end toute la journée...').setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('paiement').setLabel('Type de paiement souhaité').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Robux, €, % sur projet...').setRequired(true)
      ),
    );
    await interaction.showModal(modal);
    return;
  }

  // ── Modal recrutement soumis ──────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_recrutement') {
    await interaction.deferReply({ ephemeral: true });
    const typeDev       = interaction.fields.getTextInputValue('type_dev');
    const disponibilite = interaction.fields.getTextInputValue('disponibilite');
    const paiement      = interaction.fields.getTextInputValue('paiement');
    const user          = interaction.user;
    const guild         = interaction.guild;

    const existing = guild.channels.cache.find(c =>
      c.name === `recrut-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}` &&
      c.type === ChannelType.GuildText
    );
    if (existing) {
      await interaction.editReply({ content: `❌ Tu as déjà une candidature ouverte : ${existing}` });
      return;
    }

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

  // ── Refuser candidature ───────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'recrut_refuser') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    const channel = interaction.channel;
    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('recrut_accepter').setLabel('✅ Accepter').setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('recrut_refuser').setLabel('❌ Refusé').setStyle(ButtonStyle.Danger).setDisabled(true),
    );
    await interaction.message.edit({ components: [disabledRow] });
    await channel.send({
      embeds: [new EmbedBuilder()
        .setColor(0xED4245)
        .setDescription(`❌ Candidature **refusée** par <@${interaction.user.id}>\nLe salon sera supprimé dans 5 secondes.`)],
    });
    setTimeout(() => channel.delete().catch(() => {}), 5000);
    return;
  }

  // ── Accepter candidature → sélecteur type(s) ─────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'recrut_accepter') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    const channel = interaction.channel;

    const disabledRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('recrut_accepter').setLabel('✅ Accepté').setStyle(ButtonStyle.Success).setDisabled(true),
      new ButtonBuilder().setCustomId('recrut_refuser').setLabel('❌ Refuser').setStyle(ButtonStyle.Danger).setDisabled(true),
    );
    await interaction.message.edit({ components: [disabledRow] });

    const selectTypes = new StringSelectMenuBuilder()
      .setCustomId('recrut_select_types')
      .setPlaceholder('Sélectionne le ou les types retenus...')
      .setMinValues(1)
      .setMaxValues(4)
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('🎨 UI').setValue('ui'),
        new StringSelectMenuOptionBuilder().setLabel('🏗️ Builder').setValue('builder'),
        new StringSelectMenuOptionBuilder().setLabel('💨 Animateur').setValue('animateur'),
        new StringSelectMenuOptionBuilder().setLabel('💻 Scripteur').setValue('scripteur'),
      );

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Candidature acceptée — Étape 1/2')
        .setDescription('Sélectionne le ou les **types de dev** attribués à ce candidat.')
        .setColor(0x57F287)],
      components: [
        new ActionRowBuilder().addComponents(selectTypes),
        new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('recrut_types_valider').setLabel('➡️ Étape suivante').setStyle(ButtonStyle.Primary),
        ),
      ],
    });
    return;
  }

  // ── Select : types retenus ────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'recrut_select_types') {
    const channel  = interaction.channel;
    const existing = pendingRecrutement.get(channel.id) ?? {};
    existing.types = interaction.values;
    pendingRecrutement.set(channel.id, existing);
    await interaction.deferUpdate();
    return;
  }

  // ── Valider types → sélecteur étoiles ────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'recrut_types_valider') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    const channel = interaction.channel;
    const pending = pendingRecrutement.get(channel.id);
    if (!pending?.types?.length) {
      await interaction.reply({ content: '⚠️ Sélectionne au moins un type de dev.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    await interaction.message.delete().catch(() => {});

    const rows = [];
    for (const type of pending.types) {
      const label = DEV_TYPE_ICONS[type] ?? type;
      rows.push(new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`recrut_etoiles_${type}`)
          .setPlaceholder(`Niveau pour ${label}...`)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐⭐ — 5 étoiles').setValue('0'),
            new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐⭐ — 4 étoiles').setValue('1'),
            new StringSelectMenuOptionBuilder().setLabel('⭐⭐⭐ — 3 étoiles').setValue('2'),
            new StringSelectMenuOptionBuilder().setLabel('⭐⭐ — 2 étoiles').setValue('3'),
            new StringSelectMenuOptionBuilder().setLabel('⭐ — 1 étoile').setValue('4'),
          )
      ));
    }
    rows.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('recrut_etoiles_valider').setLabel('✅ Confirmer et attribuer les rôles').setStyle(ButtonStyle.Success),
    ));

    await channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Candidature acceptée — Étape 2/2')
        .setDescription(`Types retenus : **${pending.types.map(t => DEV_TYPE_ICONS[t] ?? t).join(', ')}**\n\nChoisis le **niveau (étoiles)** pour chaque type.`)
        .setColor(0x57F287)],
      components: rows,
    });
    return;
  }

  // ── Select : étoiles par type ─────────────────────────────────────────────────
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

  // ── Confirmer → attribuer les rôles ──────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'recrut_etoiles_valider') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return;
    }
    await interaction.deferUpdate();
    const channel = interaction.channel;
    const pending = pendingRecrutement.get(channel.id);

    if (!pending?.types?.length || !pending?.etoiles) {
      await interaction.followUp({ content: '⚠️ Données manquantes, recommence.', ephemeral: true }); return;
    }

    for (const type of pending.types) {
      if (pending.etoiles[type] === undefined) {
        await interaction.followUp({ content: `⚠️ Tu n'as pas choisi le niveau pour **${DEV_TYPE_ICONS[type] ?? type}**.`, ephemeral: true }); return;
      }
    }

    const messages    = await channel.messages.fetch({ limit: 30 });
    const embedMsg    = messages.find(m => m.author.id === client.user.id && m.embeds?.[0]?.title?.startsWith('📩 Candidature'));
    const candidateId = embedMsg?.embeds?.[0]?.fields?.find(f => f.name === '👤 Candidat')?.value?.replace(/[<@>]/g, '');
    if (!candidateId) {
      await interaction.followUp({ content: '❌ Impossible de retrouver le candidat dans l\'embed.', ephemeral: true }); return;
    }

    const guild           = interaction.guild;
    const candidateMember = await guild.members.fetch(candidateId).catch(() => null);
    if (!candidateMember) {
      await interaction.followUp({ content: '❌ Le membre a quitté le serveur.', ephemeral: true }); return;
    }

    const rolesAdded = [];

    if (candidateMember.roles.cache.has(CONFIG.ROLE_ATT_ENTRETIEN)) {
      await candidateMember.roles.remove(CONFIG.ROLE_ATT_ENTRETIEN).catch(() => {});
    }

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

client.login(CONFIG.TOKEN);
