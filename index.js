const {
  Client, GatewayIntentBits, REST, Routes,
  SlashCommandBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

// ───────────────────────────────────────────────
//  CONFIG
// ───────────────────────────────────────────────
const TOKEN            = process.env.TOKEN;
const CLIENT_ID        = process.env.CLIENT_ID;
const DEV_ROLE_ID      = '1485191413829337299';
const SCORE_CHANNEL_ID = '1487822457149853868';

// ───────────────────────────────────────────────
//  SYSTÈME DE POINTS
//
//  Critères importants (poids x2) :
//    qualite, delai, consignes
//  Critères normaux (poids x1) :
//    communication, revisions, attitude, investissement
//
//  Note → points (critère normal) :
//    1 → -10  |  2 → 0  |  3 → +5  |  4 → +10  |  5 → +15
//  Note → points (critère important x2) :
//    1 → -20  |  2 → 0  |  3 → +10 |  4 → +20  |  5 → +30
// ───────────────────────────────────────────────
const CRITERES = [
  { id: 'qualite',        label: 'Qualité du travail rendu',  important: true  },
  { id: 'delai',          label: 'Délai respecté',            important: true  },
  { id: 'consignes',      label: 'Respect des consignes',     important: true  },
  { id: 'communication',  label: 'Communication',             important: false },
  { id: 'revisions',      label: 'Nombre de révisions',       important: false },
  { id: 'attitude',       label: 'Attitude / comportement',   important: false },
  { id: 'investissement', label: 'Investissement',            important: false },
];

const POINTS_NORMAL    = { 1: -10, 2: 0, 3: 5,  4: 10, 5: 15 };
const POINTS_IMPORTANT = { 1: -20, 2: 0, 3: 10, 4: 20, 5: 30 };

function calcPoints(note, important) {
  const table = important ? POINTS_IMPORTANT : POINTS_NORMAL;
  return table[note] ?? 0;
}

// ───────────────────────────────────────────────
//  STOCKAGE EN MÉMOIRE
// ───────────────────────────────────────────────
// scores   = { userId: { username, score } }
// sessions = { sessionKey: { devId, notes, step } }
const scores   = {};
const sessions = {};
let   scoreMessageId = null;

// ───────────────────────────────────────────────
//  CLIENT
// ───────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
  ],
});

// ───────────────────────────────────────────────
//  SLASH COMMANDS
// ───────────────────────────────────────────────
const commands = [
  new SlashCommandBuilder()
    .setName('evaluer')
    .setDescription('Évaluer un développeur après un contrat')
    .addUserOption(opt =>
      opt.setName('dev')
        .setDescription('Mentionne le développeur à évaluer')
        .setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('score')
    .setDescription('Voir le score d\'un développeur')
    .addUserOption(opt =>
      opt.setName('dev')
        .setDescription('Le développeur')
        .setRequired(true))
    .toJSON(),

  new SlashCommandBuilder()
    .setName('resetscores')
    .setDescription('Réinitialiser tous les scores (admin uniquement)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
];

// ───────────────────────────────────────────────
//  MISE À JOUR DU MESSAGE DE CLASSEMENT
// ───────────────────────────────────────────────
async function updateScoreBoard(guild) {
  const channel = guild.channels.cache.get(SCORE_CHANNEL_ID);
  if (!channel) return;

  const sorted = Object.entries(scores).sort((a, b) => b[1].score - a[1].score);

  const now     = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  let description = '';
  if (sorted.length === 0) {
    description = '*Aucun développeur enregistré pour l\'instant.*';
  } else {
    sorted.forEach(([userId, data], index) => {
      let rank;
      if      (index === 0) rank = '🥇';
      else if (index === 1) rank = '🥈';
      else if (index === 2) rank = '🥉';
      else                  rank = `**#${index + 1}**`;

      const pts = data.score;
      const sign = pts < 0 ? '' : '';
      description += `${rank}  <@${userId}> : **${pts} pts**\n`;
    });
  }

  const embed = new EmbedBuilder()
    .setTitle('🏆 Classement des développeurs — HEO Studio')
    .setDescription(description)
    .setColor(0x5865F2)
    .setFooter({ text: `Mis à jour le ${dateStr} à ${timeStr}` });

  try {
    if (scoreMessageId) {
      const msg = await channel.messages.fetch(scoreMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed] });
        return;
      }
    }
    // Pas de message existant → on en crée un
    const newMsg = await channel.send({ embeds: [embed] });
    scoreMessageId = newMsg.id;
  } catch (err) {
    console.error('Erreur updateScoreBoard:', err);
  }
}

// Récupérer le message du bot au démarrage (pour rééditer au lieu de recréer)
async function loadExistingScoreMessage(guild) {
  const channel = guild.channels.cache.get(SCORE_CHANNEL_ID);
  if (!channel) return;
  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  if (!messages) return;
  const botMsg = messages.find(m => m.author.id === client.user.id && m.embeds.length > 0);
  if (botMsg) {
    scoreMessageId = botMsg.id;
    console.log(`✅ Message de classement existant retrouvé : ${scoreMessageId}`);
  }
}

// ───────────────────────────────────────────────
//  AJOUT AUTO QUAND LE RÔLE DEV EST ATTRIBUÉ
// ───────────────────────────────────────────────
client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const hadRole = oldMember.roles.cache.has(DEV_ROLE_ID);
  const hasRole = newMember.roles.cache.has(DEV_ROLE_ID);

  if (!hadRole && hasRole) {
    if (!scores[newMember.id]) {
      scores[newMember.id] = { username: newMember.user.username, score: 0 };
      console.log(`➕ Nouveau dev ajouté au classement : ${newMember.user.username}`);
      await updateScoreBoard(newMember.guild);
    }
  }
});

// ───────────────────────────────────────────────
//  HELPERS : EMBED + SELECT MENU D'UNE ÉTAPE
// ───────────────────────────────────────────────
function buildStepEmbed(devId, stepIndex) {
  const critere   = CRITERES[stepIndex];
  const progress  = `Étape ${stepIndex + 1} sur ${CRITERES.length}`;
  const important = critere.important ? '  ⭐ *critère important (x2)*' : '';

  return new EmbedBuilder()
    .setTitle('📋 Évaluation en cours')
    .setDescription(`Développeur : <@${devId}>`)
    .addFields(
      { name: `Critère ${stepIndex + 1}`, value: `**${critere.label}**${important}`, inline: false },
      { name: 'Progression',              value: progress,                            inline: true  },
    )
    .setColor(0x5865F2)
    .setFooter({ text: 'Sélectionne une note dans le menu ci-dessous' });
}

function buildSelectMenu(critere, stepIndex) {
  const options = [
    { label: '1 — Catastrophique',   description: 'Résultat très en dessous des attentes', value: '1', emoji: '💀' },
    { label: '2 — Passable / neutre', description: 'Ni bien ni mal, neutre',                value: '2', emoji: '😐' },
    { label: '3 — Correct',          description: 'Acceptable, dans la moyenne',            value: '3', emoji: '👍' },
    { label: '4 — Bien',             description: 'Au-dessus des attentes',                 value: '4', emoji: '⭐' },
    { label: '5 — Excellent',        description: 'Exceptionnel, parfait',                  value: '5', emoji: '🔥' },
  ];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`eval_step_${stepIndex}`)
    .setPlaceholder(`Note pour : ${critere.label}`)
    .addOptions(options);

  return new ActionRowBuilder().addComponents(menu);
}

// ───────────────────────────────────────────────
//  INTERACTIONS
// ───────────────────────────────────────────────
client.on('interactionCreate', async interaction => {

  // ════════════════════════════════════════
  //  COMMANDE /evaluer
  // ════════════════════════════════════════
  if (interaction.isChatInputCommand() && interaction.commandName === 'evaluer') {
    const dev = interaction.options.getUser('dev');
    if (!dev) return interaction.reply({ content: '❌ Développeur introuvable.', ephemeral: true });

    const member = await interaction.guild.members.fetch(dev.id).catch(() => null);
    if (!member || !member.roles.cache.has(DEV_ROLE_ID)) {
      return interaction.reply({
        content: `❌ <@${dev.id}> n'a pas le rôle développeur.`,
        ephemeral: true,
      });
    }

    // Initialiser le score si nouveau dev
    if (!scores[dev.id]) {
      scores[dev.id] = { username: dev.username, score: 0 };
    }

    // Clé de session unique par secrétaire → dev (une seule éval à la fois par paire)
    const sessionKey = `${interaction.user.id}_${dev.id}`;
    sessions[sessionKey] = { devId: dev.id, notes: {}, step: 0 };

    await interaction.reply({
      embeds:     [buildStepEmbed(dev.id, 0)],
      components: [buildSelectMenu(CRITERES[0], 0)],
      ephemeral:  true,
    });
    return;
  }

  // ════════════════════════════════════════
  //  COMMANDE /score
  // ════════════════════════════════════════
  if (interaction.isChatInputCommand() && interaction.commandName === 'score') {
    const dev  = interaction.options.getUser('dev');
    const data = scores[dev.id];

    if (!data) {
      return interaction.reply({
        content: `❌ <@${dev.id}> n'a pas encore de score enregistré.`,
        ephemeral: true,
      });
    }

    return interaction.reply({
      content: `📊 Score de <@${dev.id}> : **${data.score} pts**`,
      ephemeral: true,
    });
  }

  // ════════════════════════════════════════
  //  COMMANDE /resetscores
  // ════════════════════════════════════════
  if (interaction.isChatInputCommand() && interaction.commandName === 'resetscores') {
    for (const key of Object.keys(scores)) delete scores[key];
    await updateScoreBoard(interaction.guild);
    return interaction.reply({ content: '✅ Tous les scores ont été réinitialisés.', ephemeral: true });
  }

  // ════════════════════════════════════════
  //  SELECT MENUS : étapes de l'évaluation
  // ════════════════════════════════════════
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('eval_step_')) {
    const stepIndex  = parseInt(interaction.customId.split('_')[2]);

    // Retrouver la session de ce secrétaire
    const sessionKey = Object.keys(sessions).find(k => k.startsWith(`${interaction.user.id}_`));
    if (!sessionKey) {
      return interaction.reply({ content: '❌ Session expirée. Relance `/evaluer`.', ephemeral: true });
    }

    const session = sessions[sessionKey];

    // Vérifier qu'on est bien à la bonne étape (évite les clics sur de vieux menus)
    if (session.step !== stepIndex) {
      return interaction.reply({ content: '⚠️ Cette étape est déjà passée.', ephemeral: true });
    }

    const note    = parseInt(interaction.values[0]);
    const critere = CRITERES[stepIndex];

    // Enregistrer la note et avancer
    session.notes[critere.id] = note;
    session.step = stepIndex + 1;

    const nextStep = stepIndex + 1;

    // ── Pas encore fini → critère suivant ──
    if (nextStep < CRITERES.length) {
      await interaction.update({
        embeds:     [buildStepEmbed(session.devId, nextStep)],
        components: [buildSelectMenu(CRITERES[nextStep], nextStep)],
      });
      return;
    }

    // ── Toutes les notes saisies → calcul ──
    let totalPoints  = 0;
    const detailLines = [];

    for (const crit of CRITERES) {
      const n   = session.notes[crit.id] ?? 2;
      const pts = calcPoints(n, crit.important);
      totalPoints += pts;

      const sign  = pts > 0 ? '+' : '';
      const badge = crit.important ? ' ⭐' : '';
      detailLines.push(`• **${crit.label}**${badge} — note ${n} → \`${sign}${pts} pts\``);
    }

    scores[session.devId].score += totalPoints;
    const newTotal = scores[session.devId].score;
    const devUsername = scores[session.devId].username;

    // Nettoyer la session
    delete sessions[sessionKey];

    // Mettre à jour le classement dans le salon
    await updateScoreBoard(interaction.guild);

    // Embed récapitulatif
    const sign = totalPoints >= 0 ? '+' : '';
    const color = totalPoints > 0 ? 0x57F287 : totalPoints < 0 ? 0xED4245 : 0x99AAB5;

    const recap = new EmbedBuilder()
      .setTitle('✅ Évaluation enregistrée')
      .setDescription(`Développeur : <@${session.devId}>`)
      .addFields(
        { name: 'Détail des notes',         value: detailLines.join('\n'), inline: false },
        { name: 'Points cette évaluation',  value: `**${sign}${totalPoints} pts**`, inline: true  },
        { name: 'Nouveau score total',       value: `**${newTotal} pts**`,           inline: true  },
      )
      .setColor(color)
      .setTimestamp()
      .setFooter({ text: `Évalué par ${interaction.user.username}` });

    await interaction.update({ embeds: [recap], components: [] });
    return;
  }
});

// ───────────────────────────────────────────────
//  DÉMARRAGE
// ───────────────────────────────────────────────
client.once('ready', async () => {
  console.log(`✅ Bot connecté : ${client.user.tag}`);

  // Déployer les slash commands
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Slash commands déployées.');
  } catch (err) {
    console.error('Erreur déploiement commands:', err);
  }

  // Pour chaque serveur : charger le message existant + enregistrer les devs actuels
  for (const guild of client.guilds.cache.values()) {
    await loadExistingScoreMessage(guild);

    const members = await guild.members.fetch().catch(() => null);
    if (!members) continue;

    let added = false;
    for (const [id, member] of members) {
      if (member.roles.cache.has(DEV_ROLE_ID) && !scores[id]) {
        scores[id] = { username: member.user.username, score: 0 };
        added = true;
      }
    }

    if (added) await updateScoreBoard(guild);
  }
});

client.login(TOKEN);
