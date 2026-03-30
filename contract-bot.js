const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder,
  TextInputBuilder, TextInputStyle, REST, Routes, SlashCommandBuilder,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
  partials: [Partials.Channel],
});

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const CONFIG = {
  TOKEN: process.env.TOKEN,
  CLIENT_ID: process.env.CLIENT_ID,
  GUILD_ID: process.env.GUILD_ID,
  PANEL_CHANNEL_ID: '1485191415435624594',
  SUPPORT_PANEL_CHANNEL_ID: '1487752758294614076',
  STAFF_ROLE_ID: '1487848016110162153',

  DEV_ROLES: {
    builder:   '1488194780809789511',
    scripteur: '1488194696831307776',
    ui:        '1488194616413913088',
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
};
// ─────────────────────────────────────────────────────────────────────────────

const ticketEtapes = new Map(); // channelId → étape index
const ticketInfos  = new Map(); // channelId → { nom, clientId, devsAssignes, devsBack }
// État temporaire de l'assignation en cours (entre Q1 et Q2)
const assignState  = new Map(); // channelId → { typesChoisis: [], messageId }

client.once('ready', async () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  await registerSlashCommands();
});

// ─── SLASH COMMANDS ───────────────────────────────────────────────────────────
async function registerSlashCommands() {
  const commands = [
    new SlashCommandBuilder().setName('contrats').setDescription('Liste tous les contrats en cours').toJSON(),
  ];
  const rest = new REST({ version: '10' }).setToken(CONFIG.TOKEN);
  try {
    await rest.put(Routes.applicationGuildCommands(CONFIG.CLIENT_ID, CONFIG.GUILD_ID), { body: commands });
    console.log('✅ Commandes slash enregistrées');
  } catch (err) { console.error('Erreur commandes:', err); }
}

// ─── SETUP ────────────────────────────────────────────────────────────────────
if (process.argv[2] === 'setup') {
  client.once('ready', async () => {
    const contractChannel = await client.channels.fetch(CONFIG.PANEL_CHANNEL_ID);
    await contractChannel.send({
      embeds: [new EmbedBuilder().setTitle('📋 HEO Studio — Créer un contrat').setDescription('Bienvenue sur le système de contrats **HEO Studio**.\n\nClique sur le bouton ci-dessous pour ouvrir une demande de contrat.\nUn salon privé sera créé pour toi et notre équipe.').setColor(0x5865F2).setFooter({ text: 'HEO Studio • Système de contrats' })],
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('creer_contrat').setLabel('📝 Créer un contrat').setStyle(ButtonStyle.Primary))],
    });

    const supportChannel = await client.channels.fetch(CONFIG.SUPPORT_PANEL_CHANNEL_ID);
    await supportChannel.send({
      embeds: [new EmbedBuilder().setTitle('🎫 HEO Studio — Support').setDescription('Sélectionne le type de ticket dans le menu ci-dessous.\nUn salon privé sera créé pour toi et notre équipe.').setColor(0x5865F2).setFooter({ text: 'HEO Studio • Support' })],
      components: [new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('select_support').setPlaceholder('Choisis le type de ticket...').addOptions(
          new StringSelectMenuOptionBuilder().setLabel('❓ Question').setDescription('Tu as une question pour l\'équipe').setValue('question'),
          new StringSelectMenuOptionBuilder().setLabel('💡 Suggestion').setDescription('Tu as une idée à soumettre').setValue('suggestion'),
          new StringSelectMenuOptionBuilder().setLabel('🚨 Report').setDescription('Signaler un problème ou un joueur').setValue('report'),
        )
      )],
    });

    console.log('✅ Panneaux envoyés !');
    process.exit(0);
  });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function starsFor(n) { return '⭐'.repeat(n) + '☆'.repeat(5 - n); }

function buildEmbed(nom, description, budget, delai, user, etapeIndex, devsAssignes = [], devsBack = []) {
  const etape = CONFIG.ETAPES[etapeIndex];
  const embed = new EmbedBuilder()
    .setTitle(`📋 Contrat — ${nom}`)
    .setColor(etape.color)
    .addFields(
      { name: '👤 Client',      value: `<@${user.id}>`, inline: true },
      { name: '💰 Budget',      value: budget,           inline: true },
      { name: '⏱️ Délai',       value: delai,            inline: true },
      { name: '📝 Description', value: description,      inline: false },
    )
    .setFooter({ text: `HEO Studio • Étape : ${etape.label}` })
    .setTimestamp();

  if (devsAssignes.length > 0) {
    embed.addFields({ name: '⚙️ Devs assignés', value: devsAssignes.map(d => `> ⚙️ <@${d.id}> — ${d.type}`).join('\n'), inline: false });
  }
  if (devsBack.length > 0) {
    embed.addFields({ name: '👥 Devs', value: devsBack.map(d => `> <@${d.id}> — ${d.type}`).join('\n'), inline: false });
  }
  return embed;
}

function buildStaffRow(etapeIndex) {
  const isLast  = etapeIndex >= CONFIG.ETAPES.length - 1;
  const isFirst = etapeIndex <= 0;
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('etape_precedente').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(isFirst),
    new ButtonBuilder().setCustomId('etape_suivante').setLabel(isLast ? '✅ Terminé' : `➡️ Passer à : ${CONFIG.ETAPES[etapeIndex + 1]?.label}`).setStyle(isLast ? ButtonStyle.Success : ButtonStyle.Primary).setDisabled(isLast),
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

// Récupère les membres ayant un rôle donné
async function getMembersWithRole(guild, roleId) {
  await guild.members.fetch();
  return guild.members.cache.filter(m => m.roles.cache.has(roleId)).map(m => ({ id: m.id, username: m.user.username }));
}

// ─── INTERACTIONS ─────────────────────────────────────────────────────────────
client.on('interactionCreate', async (interaction) => {

  // ── /contrats ────────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'contrats') {
    await interaction.deferReply();
    const tickets = [];
    for (const [channelId, info] of ticketInfos.entries()) {
      const ch = interaction.guild.channels.cache.get(channelId);
      if (!ch) continue;
      const etape = CONFIG.ETAPES[ticketEtapes.get(channelId) ?? 0];
      tickets.push(`${etape.label} — **${info.nom}** — <@${info.clientId}> — ${ch}`);
    }
    if (!tickets.length) { await interaction.editReply({ content: '📭 Aucun contrat en cours.' }); return; }
    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('📋 Contrats en cours — HEO Studio').setColor(0x5865F2).setDescription(tickets.join('\n')).setFooter({ text: `${tickets.length} contrat(s) actif(s)` }).setTimestamp()] });
    return;
  }

  // ── Select support ───────────────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'select_support') {
    const type = interaction.values[0];
    const modals = {
      question:   { title: '❓ Poser une question',   fields: [{ id: 'sujet', label: 'Sujet', short: true, ph: 'Ex: Délais, paiements...' }, { id: 'message', label: 'Ta question', short: false, ph: 'Décris ta question...' }] },
      suggestion: { title: '💡 Faire une suggestion', fields: [{ id: 'sujet', label: 'Titre', short: true, ph: 'Ex: Ajouter une fonctionnalité...' }, { id: 'message', label: 'Description', short: false, ph: 'Décris ta suggestion...' }] },
      report:     { title: '🚨 Signaler un problème', fields: [{ id: 'sujet', label: 'Qui ou quoi ?', short: true, ph: 'Ex: Pseudo, bug...' }, { id: 'message', label: 'Description + preuves', short: false, ph: 'Décris le problème...' }] },
    };
    const def = modals[type];
    const modal = new ModalBuilder().setCustomId(`modal_support_${type}`).setTitle(def.title);
    for (const f of def.fields) modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setStyle(f.short ? TextInputStyle.Short : TextInputStyle.Paragraph).setPlaceholder(f.ph).setRequired(true)));
    await interaction.showModal(modal);
    return;
  }

  // ── Modal support ────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('modal_support_')) {
    await interaction.deferReply({ ephemeral: true });
    const type = interaction.customId.replace('modal_support_', '');
    const sujet = interaction.fields.getTextInputValue('sujet');
    const message = interaction.fields.getTextInputValue('message');
    const user = interaction.user;
    const guild = interaction.guild;
    const typeInfo = CONFIG.SUPPORT_TYPES[type];
    const ch = await guild.channels.create({
      name: `${type}-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      type: ChannelType.GuildText,
      parent: CONFIG.CATEGORIES.SUPPORT,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });
    await ch.send({
      content: `👋 <@${user.id}> | <@&${CONFIG.STAFF_ROLE_ID}>`,
      embeds: [new EmbedBuilder().setTitle(`${typeInfo.label} — ${sujet}`).setColor(typeInfo.color).addFields({ name: '👤 Membre', value: `<@${user.id}>`, inline: true }, { name: '📝 Message', value: message }).setFooter({ text: 'HEO Studio • Support' }).setTimestamp()],
      components: [buildSupportRow(false)],
    });
    await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ch}` });
    return;
  }

  // ── Bouton fermer support ────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'fermer_support') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    const channel = interaction.channel;
    for (const [id, ow] of channel.permissionOverwrites.cache) {
      if (id !== channel.guild.roles.everyone.id && id !== CONFIG.STAFF_ROLE_ID) {
        await channel.permissionOverwrites.edit(id, { ViewChannel: false, SendMessages: false });
      }
    }
    await channel.send({ embeds: [new EmbedBuilder().setColor(0x99AAB5).setDescription(`🔒 Ticket **fermé** par <@${interaction.user.id}>\nLe membre n'a plus accès à ce salon.`)] });
    await interaction.message.edit({ components: [buildSupportRow(true)] });
    return;
  }

  // ── Bouton supprimer support ─────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'supprimer_support') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return; }
    await interaction.reply({ content: '⚠️ Supprimer définitivement ?', components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confirmer_suppression_support').setLabel('✅ Oui').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('annuler_suppression_support').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary))], ephemeral: true });
    return;
  }
  if (interaction.isButton() && interaction.customId === 'confirmer_suppression_support') {
    await interaction.reply({ content: '🗑️ Suppression...', ephemeral: true });
    setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);
    return;
  }
  if (interaction.isButton() && interaction.customId === 'annuler_suppression_support') { await interaction.reply({ content: '✅ Annulé.', ephemeral: true }); return; }

  // ── Bouton créer contrat ─────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'creer_contrat') {
    const modal = new ModalBuilder().setCustomId('modal_contrat').setTitle('Nouvelle demande de contrat');
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('nom_projet').setLabel('Nom du projet').setStyle(TextInputStyle.Short).setPlaceholder('Ex: Jeu Roblox RPG...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('description').setLabel('Description du projet').setStyle(TextInputStyle.Paragraph).setPlaceholder('Décris ce que tu veux réaliser...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('budget').setLabel('Budget estimé (Robux ou €)').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 5000 Robux, 50€...').setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('delai').setLabel('Délai souhaité').setStyle(TextInputStyle.Short).setPlaceholder('Ex: 2 semaines, 1 mois...').setRequired(false)),
    );
    await interaction.showModal(modal);
    return;
  }

  // ── Modal contrat ────────────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId === 'modal_contrat') {
    await interaction.deferReply({ ephemeral: true });
    const nomProjet   = interaction.fields.getTextInputValue('nom_projet');
    const description = interaction.fields.getTextInputValue('description');
    const budget      = interaction.fields.getTextInputValue('budget');
    const delai       = interaction.fields.getTextInputValue('delai') || 'Non précisé';
    const guild = interaction.guild;
    const user  = interaction.user;

    const existing = guild.channels.cache.find(c => c.name === `contrat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}` && c.type === ChannelType.GuildText);
    if (existing) { await interaction.editReply({ content: `❌ Tu as déjà un ticket ouvert : ${existing}` }); return; }

    const ticketChannel = await guild.channels.create({
      name: `contrat-${user.username.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20)}`,
      type: ChannelType.GuildText,
      parent: CONFIG.CATEGORIES.NEGOCIATION,
      permissionOverwrites: [
        { id: guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        { id: CONFIG.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.ManageChannels] },
      ],
    });

    ticketEtapes.set(ticketChannel.id, 0);
    ticketInfos.set(ticketChannel.id, { nom: nomProjet, description, budget, delai, clientId: user.id, devsAssignes: [], devsBack: [] });

    await ticketChannel.send({
      content: `👋 <@${user.id}> | <@&${CONFIG.STAFF_ROLE_ID}>`,
      embeds: [buildEmbed(nomProjet, description, budget, delai, user, 0)],
      components: [buildStaffRow(0)],
    });

    await interaction.editReply({ content: `✅ Ton ticket a été créé : ${ticketChannel}` });
    return;
  }

  // ── Étape suivante ────────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'etape_suivante') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return; }

    const channel = interaction.channel;
    const etapeActuelle = ticketEtapes.get(channel.id) ?? 0;
    const nouvelleEtape = etapeActuelle + 1;
    if (nouvelleEtape >= CONFIG.ETAPES.length) { await interaction.reply({ content: '✅ Déjà à l\'étape finale.', ephemeral: true }); return; }

    // ── Transition spéciale : Négociation → 1er paiement (étape 0 → 1) ────────
    if (etapeActuelle === 0) {
      await interaction.deferUpdate();

      // Q1 : Sélection des types de dev
      const q1Row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('assign_types')
          .setPlaceholder('Sélectionne les types de dev...')
          .setMinValues(1).setMaxValues(3)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('🔨 Builder').setValue('builder'),
            new StringSelectMenuOptionBuilder().setLabel('💻 Scripteur').setValue('scripteur'),
            new StringSelectMenuOptionBuilder().setLabel('🎨 UI').setValue('ui'),
          )
      );

      const msg = await channel.send({
        embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('📋 Assignation des devs — Étape 1/2').setDescription('Sélectionne les **types de dev** retenus pour ce projet :')],
        components: [q1Row],
      });

      assignState.set(channel.id, { typesChoisis: [], messageId: msg.id });
      return;
    }

    // ── Transition normale ────────────────────────────────────────────────────
    await interaction.deferUpdate();
    await advanceEtape(interaction, channel, nouvelleEtape);
    return;
  }

  // ── Q1 : Types de dev choisis ─────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'assign_types') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return; }

    await interaction.deferUpdate();
    const channel = interaction.channel;
    const typesChoisis = interaction.values; // ['builder', 'scripteur', 'ui']
    assignState.set(channel.id, { ...assignState.get(channel.id), typesChoisis });

    // Récupère les devs ayant les rôles choisis
    const guild = interaction.guild;
    const options = [];
    for (const type of typesChoisis) {
      const members = await getMembersWithRole(guild, CONFIG.DEV_ROLES[type]);
      for (const m of members) {
        if (!options.find(o => o.value === m.id)) {
          options.push(new StringSelectMenuOptionBuilder().setLabel(`${m.username} — ${type}`).setValue(`${m.id}|${type}`));
        }
      }
    }

    if (options.length === 0) {
      await channel.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription('❌ Aucun dev trouvé avec ces rôles.')] });
      return;
    }

    const q2Row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('assign_devs_assignes')
        .setPlaceholder('Sélectionne les devs assignés...')
        .setMinValues(1).setMaxValues(Math.min(options.length, 25))
        .addOptions(options)
    );

    await interaction.message.edit({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('📋 Assignation des devs — Étape 2/2').setDescription(`Types retenus : **${typesChoisis.join(', ')}**\n\nSélectionne maintenant les devs **assignés** au projet :\n*(Les autres devs du même type seront automatiquement en backup)*`)],
      components: [q2Row],
    });
    return;
  }

  // ── Q2 : Devs assignés choisis ────────────────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId === 'assign_devs_assignes') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return; }

    await interaction.deferUpdate();
    const channel = interaction.channel;
    const guild = interaction.guild;
    const state = assignState.get(channel.id) ?? {};
    const typesChoisis = state.typesChoisis ?? [];

    // Parse les devs assignés
    const devsAssignes = interaction.values.map(v => {
      const [id, type] = v.split('|');
      return { id, type };
    });

    // Récupère tous les devs des types choisis → ceux pas assignés = backup
    const devsBack = [];
    const assignedIds = devsAssignes.map(d => d.id);
    for (const type of typesChoisis) {
      const members = await getMembersWithRole(guild, CONFIG.DEV_ROLES[type]);
      for (const m of members) {
        if (!assignedIds.includes(m.id)) {
          devsBack.push({ id: m.id, type });
        }
      }
    }

    // Sauvegarde dans ticketInfos
    const info = ticketInfos.get(channel.id) ?? {};
    info.devsAssignes = devsAssignes;
    info.devsBack = devsBack;
    ticketInfos.set(channel.id, info);

    // Supprime le message de sélection
    await interaction.message.delete().catch(() => {});

    // Avance l'étape
    assignState.delete(channel.id);
    await advanceEtape(interaction, channel, 1);
    return;
  }

  // ── Étape précédente ─────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'etape_precedente') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    const channel = interaction.channel;
    const etapePrecedente = (ticketEtapes.get(channel.id) ?? 0) - 1;
    if (etapePrecedente < 0) { await interaction.followUp({ content: '⚠️ Déjà à la première étape.', ephemeral: true }); return; }
    await channel.setParent(CONFIG.CATEGORIES[CONFIG.ETAPES[etapePrecedente].id], { lockPermissions: false });
    ticketEtapes.set(channel.id, etapePrecedente);
    const info = ticketInfos.get(channel.id) ?? {};
    const fakeUser = { id: info.clientId };
    const updatedEmbed = buildEmbed(info.nom, info.description, info.budget, info.delai, fakeUser, etapePrecedente, info.devsAssignes, info.devsBack);
    await interaction.message.edit({ embeds: [updatedEmbed], components: [buildStaffRow(etapePrecedente)] });
    await channel.send({ embeds: [new EmbedBuilder().setColor(CONFIG.ETAPES[etapePrecedente].color).setDescription(`◀️ Ticket revenu à l'étape : **${CONFIG.ETAPES[etapePrecedente].label}**\nPar : <@${interaction.user.id}>`)] });
    return;
  }

  // ── Supprimer ticket ─────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'supprimer_ticket') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return; }
    await interaction.reply({
      content: '⚠️ Tu es sûr de vouloir **supprimer définitivement** ce ticket ?',
      components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confirmer_suppression').setLabel('✅ Oui, supprimer').setStyle(ButtonStyle.Danger), new ButtonBuilder().setCustomId('annuler_suppression').setLabel('❌ Annuler').setStyle(ButtonStyle.Secondary))],
      ephemeral: true,
    });
    return;
  }
  if (interaction.isButton() && interaction.customId === 'confirmer_suppression') {
    const channel = interaction.channel;
    ticketEtapes.delete(channel.id); ticketInfos.delete(channel.id);
    await interaction.reply({ content: '🗑️ Suppression en cours...', ephemeral: true });
    setTimeout(() => channel.delete().catch(() => {}), 2000);
    return;
  }
  if (interaction.isButton() && interaction.customId === 'annuler_suppression') { await interaction.reply({ content: '✅ Suppression annulée.', ephemeral: true }); return; }

  // ── Annuler contrat ───────────────────────────────────────────────────────────
  if (interaction.isButton() && interaction.customId === 'annuler_contrat') {
    const member = interaction.member;
    if (!member.roles.cache.has(CONFIG.STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) { await interaction.reply({ content: '❌ Réservé au staff.', ephemeral: true }); return; }
    await interaction.deferUpdate();
    const channel = interaction.channel;
    await channel.setParent(CONFIG.CATEGORIES.ANNULE, { lockPermissions: false });
    ticketEtapes.set(channel.id, -1); ticketInfos.delete(channel.id);
    const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0]).setColor(0xED4245).setFooter({ text: 'HEO Studio • ❌ Contrat annulé' });
    await interaction.message.edit({ embeds: [updatedEmbed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('etape_precedente').setLabel('◀️').setStyle(ButtonStyle.Secondary).setDisabled(true), new ButtonBuilder().setCustomId('etape_suivante').setLabel('Annulé').setStyle(ButtonStyle.Danger).setDisabled(true), new ButtonBuilder().setCustomId('annuler_contrat').setLabel('🚫 Annulé').setStyle(ButtonStyle.Secondary).setDisabled(true), new ButtonBuilder().setCustomId('supprimer_ticket').setLabel('🗑️ Supprimer').setStyle(ButtonStyle.Secondary))] });
    await channel.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setDescription(`❌ Contrat **annulé** par <@${interaction.user.id}>`)] });
    return;
  }
});

// ─── AVANCER ÉTAPE (fonction réutilisable) ─────────────────────────────────────
async function advanceEtape(interaction, channel, nouvelleEtape) {
  await channel.setParent(CONFIG.CATEGORIES[CONFIG.ETAPES[nouvelleEtape].id], { lockPermissions: false });
  ticketEtapes.set(channel.id, nouvelleEtape);
  const info = ticketInfos.get(channel.id) ?? {};
  const fakeUser = { id: info.clientId };

  // Cherche le message principal (le premier embed du ticket)
  const messages = await channel.messages.fetch({ limit: 50 });
  const mainMsg = messages.find(m => m.embeds.length > 0 && m.components.length > 0 && m.author.id === client.user.id && m.components[0].components.some(c => c.customId === 'etape_suivante'));

  if (mainMsg) {
    const updatedEmbed = buildEmbed(info.nom, info.description, info.budget, info.delai, fakeUser, nouvelleEtape, info.devsAssignes ?? [], info.devsBack ?? []);
    await mainMsg.edit({ embeds: [updatedEmbed], components: [buildStaffRow(nouvelleEtape)] });
  }

  await channel.send({ embeds: [new EmbedBuilder().setColor(CONFIG.ETAPES[nouvelleEtape].color).setDescription(`📌 Ticket avancé à l'étape : **${CONFIG.ETAPES[nouvelleEtape].label}**\nPar : <@${interaction.user.id}>`)] });
}

// ─── UTILS ────────────────────────────────────────────────────────────────────
async function getMembersWithRole(guild, roleId) {
  await guild.members.fetch();
  return guild.members.cache.filter(m => m.roles.cache.has(roleId)).map(m => ({ id: m.id, username: m.user.username }));
}

client.login(CONFIG.TOKEN);
