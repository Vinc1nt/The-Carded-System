import { createServer } from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const STANDARD_ACTIONS = {
  move: {
    id: 'move',
    label: 'Move',
    summary: '1 AP → 10 ft (2 squares); repeat as needed.',
    apCost: 1,
    detail: 'Move 10 ft (2 squares). May be repeated without limit.',
    logText: 'moves 10 ft.'
  },
  move_difficult: {
    id: 'move_difficult',
    label: 'Move (Difficult Terrain)',
    summary: '1 AP → 5 ft (1 square) in difficult terrain.',
    apCost: 1,
    detail: 'When terrain is difficult, 1 AP moves only 5 ft (1 square).',
    logText: 'pushes through difficult terrain (5 ft).'
  },
  disengage: {
    id: 'disengage',
    label: 'Disengage',
    summary: '2 AP: This turn’s movement does not provoke OAs.',
    apCost: 2,
    logText: 'disengages to avoid opportunity attacks.'
  },
  slip: {
    id: 'slip',
    label: 'Slip',
    summary: '1 AP: Move 5 ft without provoking OAs.',
    apCost: 1,
    logText: 'slips 5 ft without provoking.'
  },
  interact: {
    id: 'interact',
    label: 'Interact/Use',
    summary: '1 AP (usually): interact with an object or context item.',
    apCost: 1,
    logText: 'takes an interact/use action.'
  },
  guard: {
    id: 'guard',
    label: 'Guard',
    summary: '2 AP → Restore 3 Shield (once/turn, max shield limit).',
    apCost: 2,
    logText: 'guards and restores shield.'
  },
  recover: {
    id: 'recover',
    label: 'Recover',
    summary: '1 AP: Remove 1 stack of Bleeding, Poisoned, or Burning.',
    apCost: 1,
    logText: 'recovers to reduce damaging stacks.'
  },
  manual_swap: {
    id: 'manual_swap',
    label: 'Manual Swap',
    summary: '2 AP: Swap cards, new card readies next turn.',
    apCost: 2,
    logText: 'performs a manual card swap.'
  }
};

const DEFAULT_GUARD_RESTORE = 3;
const SET_LIBRARY = {
  Machine: [
    {
      pieces: 3,
      effect:
        'Hardened Plating — +1 Max Shield. Guard restores +1 additional Shield (still capped).',
      modifiers: { maxShield: 1, guardRestore: 1 }
    },
    {
      pieces: 5,
      effect:
        'Servo Stride — Once per turn, your first 10 ft of movement costs 0 AP (first 5 ft in Difficult Terrain).',
      modifiers: {}
    },
    {
      pieces: 7,
      effect:
        'Auto-Loader — After you play a Machine card, your next Machine Attack this turn costs 1 less AP (min 1).',
      modifiers: {}
    },
    {
      pieces: 10,
      effect:
        'Overclock Protocol (1/combat) — Gain +2 AP and +1 damage to Machine Attacks this turn; end of turn become Weakened 1.',
      modifiers: { apMax: 0 }
    }
  ],
  Elemental: [],
  Goblinoid: [],
  Human: []
};

const STATUS_LIBRARY = [
  {
    id: 'bleeding',
    name: 'Bleeding',
    defaultStacks: 1,
    description:
      'Damaging (bypasses Shield). Start of turn: take damage equal to stacks, then Bleeding loses 1 stack. If Bleeding is still 5+ stacks, gain Weakened 1 and reset Bleeding to 1 (max once/turn). Recover (1 AP) removes 1 stack.',
    tags: ['Damaging']
  },
  {
    id: 'poisoned',
    name: 'Poisoned',
    defaultStacks: 1,
    description:
      'Damaging (bypasses Shield). Start of turn: take damage equal to stacks, then Poisoned loses 1 stack. If Poisoned is still 5+ stacks, gain Fatigued 1 and reset Poisoned to 1 (max once/turn). Recover (1 AP) removes 1 stack.',
    tags: ['Damaging']
  },
  {
    id: 'burning',
    name: 'Burning',
    defaultStacks: 1,
    description:
      'Damaging (hits Shield first). Start of turn: take damage equal to stacks, then Burning loses 1 stack. Burning does not escalate. Recover (1 AP) removes 1 stack.',
    tags: ['Damaging']
  },
  {
    id: 'blinded',
    name: 'Blinded',
    defaultStacks: 1,
    description:
      'Debuff. Cannot target beyond 5 ft; attacks deal -2 damage. Auto-decays end of next turn or spend 1 AP to clear.',
    tags: ['Debuff']
  },
  {
    id: 'weakened',
    name: 'Weakened',
    defaultStacks: 1,
    description: 'Debuff. Your attacks deal -2 damage (min 0). Clears at end of next turn or spend 1 AP.',
    tags: ['Debuff']
  },
  {
    id: 'fatigued',
    name: 'Fatigued',
    defaultStacks: 1,
    description: 'Debuff. -1 AP on your next turn (min 1). Clears at end of that turn or spend 1 AP.',
    tags: ['Debuff']
  },
  {
    id: 'rooted',
    name: 'Rooted',
    defaultStacks: 1,
    description:
      'Control. Speed becomes 0 but you can act. If Rooted is 5+ stacks, it escalates to Restrained (Rooted removed, once/turn).',
    tags: ['Control']
  },
  {
    id: 'restrained',
    name: 'Restrained',
    defaultStacks: 1,
    description:
      'Control. Speed 0; attacks against you deal +2 damage. Restrained replaces Rooted. If Stunned is applied, Restrained is removed.',
    tags: ['Control']
  },
  {
    id: 'stunned',
    name: 'Stunned',
    defaultStacks: 1,
    description:
      'Control. You lose your next turn. Stunned replaces Rooted and Restrained.',
    tags: ['Control']
  }
];

const JOURNAL_FIELD_BY_CATEGORY = {
  quest: 'quests',
  achievement: 'achievements'
};

function buildReferenceData() {
  return {
    standardActions: Object.values(STANDARD_ACTIONS),
    sets: Object.entries(SET_LIBRARY).map(([name, bonuses]) => ({
      name,
      bonuses
    })),
    statuses: STATUS_LIBRARY
  };
}

const ABILITY_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];
const SKILL_KEYS = [
  'acrobatics',
  'animalHandling',
  'arcana',
  'athletics',
  'deception',
  'history',
  'insight',
  'intimidation',
  'investigation',
  'medicine',
  'nature',
  'perception',
  'performance',
  'persuasion',
  'religion',
  'sleightOfHand',
  'stealth',
  'survival'
];

const trackerState = {
  encounter: {
    name: 'Untitled Encounter',
    round: 1,
    started: false,
    participants: [],
    currentIndex: -1,
    log: []
  },
  reference: buildReferenceData(),
  updatedAt: new Date().toISOString()
};

const sseClients = new Map();

const server = createServer(async (req, res) => {
  const { method, url: reqUrl } = req;
  const requestUrl = new URL(reqUrl, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (pathname === '/events') {
    handleSse(req, res);
    return;
  }

  if (pathname.startsWith('/api/')) {
    await handleApi(req, res, pathname, method);
    return;
  }

  await handleStatic(res, pathname);
});

server.listen(PORT, () => {
  console.log(`Carded turn tracker running at http://localhost:${PORT}`);
});

async function handleApi(req, res, pathname, method) {
  try {
    if (method === 'GET' && pathname === '/api/state') {
      return sendJson(res, { state: trackerState });
    }

    if (method === 'GET' && pathname === '/api/export/encounter') {
      return sendJson(res, { encounter: trackerState.encounter });
    }

    if (method === 'POST' && pathname === '/api/import/encounter') {
      const body = await readBody(req);
      if (!body?.encounter) {
        return sendJson(res, { error: 'Encounter payload required' }, 400);
      }
      importEncounter(body.encounter);
      touchState();
      broadcastState('encounter_imported');
      return sendJson(res, { encounter: trackerState.encounter });
    }

    if (method === 'POST' && pathname === '/api/participants') {
      const body = await readBody(req);
      const participant = createParticipant(body);
      trackerState.encounter.participants.push(participant);
      sortParticipants();
      ensureCurrentIndex();
      pushLog(`${participant.name} joins the encounter.`);
      touchState();
      broadcastState('participant_added');
      return sendJson(res, { participant });
    }

    if (pathname.startsWith('/api/participants/')) {
      const [, , , participantId, subresource] = pathname.split('/');
      const participant = findParticipant(participantId);

      if (!participant) {
        return sendJson(res, { error: 'Participant not found' }, 404);
      }

       if (method === 'GET' && subresource === 'export') {
         return sendJson(res, { participant });
       }

      if (method === 'PATCH' && !subresource) {
        const body = await readBody(req);
        Object.assign(participant, sanitizeParticipantUpdate(body, participant));
        recalculateParticipant(participant);
        sortParticipants();
        touchState();
        broadcastState('participant_updated');
        return sendJson(res, { participant });
      }

      if (method === 'DELETE' && !subresource) {
        trackerState.encounter.participants = trackerState.encounter.participants.filter(
          (member) => member.id !== participantId
        );
        fixCurrentIndexAfterRemoval();
        pushLog(`${participant.name} is removed from the encounter.`);
        touchState();
        broadcastState('participant_removed');
        return sendJson(res, { ok: true });
      }

      if (method === 'POST' && subresource === 'adjust') {
        const body = await readBody(req);
        applyAdjustment(participant, body);
        recalculateParticipant(participant);
        touchState();
        broadcastState('participant_adjusted');
        return sendJson(res, { participant });
      }
    }

    if (method === 'POST' && pathname === '/api/import/participant') {
      const body = await readBody(req);
      if (!body?.participant) {
        return sendJson(res, { error: 'Participant payload required' }, 400);
      }
      const participant = createParticipant(body.participant);
      trackerState.encounter.participants.push(participant);
      sortParticipants();
      ensureCurrentIndex();
      touchState();
      broadcastState('participant_imported');
      return sendJson(res, { participant });
    }

    if (method === 'POST' && pathname === '/api/turn/next') {
      advanceTurn(1);
      return sendJson(res, { encounter: trackerState.encounter });
    }

    if (method === 'POST' && pathname === '/api/turn/previous') {
      advanceTurn(-1);
      return sendJson(res, { encounter: trackerState.encounter });
    }

    if (method === 'POST' && pathname === '/api/turn/start') {
      const body = await readBody(req);
      startEncounter(body?.startingRound);
      return sendJson(res, { encounter: trackerState.encounter });
    }

    if (method === 'POST' && pathname === '/api/actions/standard') {
      const body = await readBody(req);
      const result = executeStandardAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/actions/custom') {
      const body = await readBody(req);
      const participant = resolveActor(body.actorId);
      const text = body.text?.trim();
      if (!text) {
        return sendJson(res, { error: 'Missing text' }, 400);
      }
      pushLog(text, participant?.id || null);
      touchState();
      broadcastState('custom_action');
      return sendJson(res, { ok: true });
    }

    if (method === 'POST' && pathname === '/api/rest/short') {
      const body = await readBody(req);
      const participant = resolveActor(body.participantId);
      if (!participant) {
        return sendJson(res, { error: 'Participant required' }, 400);
      }
      applyShortRest(participant);
      touchState();
      broadcastState('short_rest');
      return sendJson(res, { participant });
    }

    if (method === 'POST' && pathname === '/api/rest/long') {
      const body = await readBody(req);
      const participant = resolveActor(body.participantId);
      if (!participant) {
        return sendJson(res, { error: 'Participant required' }, 400);
      }
      applyLongRest(participant);
      touchState();
      broadcastState('long_rest');
      return sendJson(res, { participant });
    }

    if (method === 'POST' && pathname === '/api/rest/short/all') {
      trackerState.encounter.participants.forEach((participant) => applyShortRest(participant));
      touchState();
      broadcastState('short_rest_all');
      return sendJson(res, { participants: trackerState.encounter.participants });
    }

    if (method === 'POST' && pathname === '/api/rest/long/all') {
      trackerState.encounter.participants.forEach((participant) => applyLongRest(participant));
      touchState();
      broadcastState('long_rest_all');
      return sendJson(res, { participants: trackerState.encounter.participants });
    }

    if (method === 'POST' && pathname === '/api/journal/entry') {
      const body = await readBody(req);
      const category = normalizeJournalCategory(body.category);
      if (!category) {
        return sendJson(res, { error: 'Invalid journal category' }, 400);
      }
      const targets = resolveJournalTargets(body);
      if (!targets.length) {
        return sendJson(res, { error: 'No participants matched journal target' }, 400);
      }
      const sharedId = body.id || randomUUID();
      const field = JOURNAL_FIELD_BY_CATEGORY[category];
      targets.forEach((participant, index) => {
        const entry = createJournalEntry(
          body,
          category,
          body.target === 'all' ? sharedId : body.id || randomUUID(),
          index
        );
        participant[field] = normalizeJournalEntries([...(participant[field] || []), entry], category);
        recalculateParticipant(participant);
      });
      touchState();
      broadcastState('journal_entry_added');
      return sendJson(res, {
        participants: targets.map((participant) => ({ id: participant.id, [field]: participant[field] }))
      });
    }

    if (method === 'DELETE' && pathname === '/api/journal/entry') {
      const body = await readBody(req);
      const category = normalizeJournalCategory(body.category);
      if (!category) {
        return sendJson(res, { error: 'Invalid journal category' }, 400);
      }
      const entryId = String(body.entryId || '').trim();
      if (!entryId) {
        return sendJson(res, { error: 'entryId is required' }, 400);
      }
      const field = JOURNAL_FIELD_BY_CATEGORY[category];
      const targets = resolveJournalTargets(body);
      if (!targets.length) {
        return sendJson(res, { error: 'No participants matched journal target' }, 400);
      }
      targets.forEach((participant) => {
        participant[field] = normalizeJournalEntries(
          (participant[field] || []).filter((entry) => String(entry.id) !== entryId),
          category
        );
        recalculateParticipant(participant);
      });
      touchState();
      broadcastState('journal_entry_removed');
      return sendJson(res, { ok: true });
    }

    if (method === 'POST' && pathname === '/api/journal/ack') {
      const body = await readBody(req);
      const category = normalizeJournalCategory(body.category);
      if (!category) {
        return sendJson(res, { error: 'Invalid journal category' }, 400);
      }
      const participant = resolveActor(body.participantId);
      if (!participant) {
        return sendJson(res, { error: 'Participant required' }, 400);
      }
      const entryId = String(body.entryId || '').trim();
      if (!entryId) {
        return sendJson(res, { error: 'entryId is required' }, 400);
      }
      const field = JOURNAL_FIELD_BY_CATEGORY[category];
      const now = new Date().toISOString();
      participant[field] = normalizeJournalEntries(
        (participant[field] || []).map((entry) => {
          if (String(entry.id) !== entryId) return entry;
          return {
            ...entry,
            acknowledged: true,
            acknowledgedAt: entry.acknowledgedAt || now
          };
        }),
        category
      );
      recalculateParticipant(participant);
      touchState();
      broadcastState('journal_entry_acknowledged');
      return sendJson(res, { participant });
    }

    return sendJson(res, { error: 'Not found' }, 404);
  } catch (err) {
    console.error('API error', err);
    return sendJson(res, { error: 'Server error' }, 500);
  }
}

function startEncounter(startingRound = 1) {
  trackerState.encounter.round = Number(startingRound) || 1;
  trackerState.encounter.started = true;
  ensureCurrentIndex();
  const actor = getCurrentParticipant();
  if (actor) {
    const startEvents = resetTurn(actor, { applyStatusTick: true });
    startEvents.forEach((event) => pushLog(`${actor.name} ${event}`, actor.id));
    pushLog(`Encounter starts. ${actor.name} takes the first turn.`);
  }
  touchState();
  broadcastState('encounter_started');
}

function executeStandardAction(body) {
  const action = STANDARD_ACTIONS[body.actionId];
  if (!action) {
    return { error: 'Unknown action' };
  }
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  if (action.id === 'guard' && participant.guardUsedThisTurn) {
    return { error: 'Guard already used this turn' };
  }
  if (participant.apCurrent < action.apCost) {
    return { error: 'Not enough AP' };
  }
  participant.apCurrent = Math.max(0, participant.apCurrent - action.apCost);
  if (action.id === 'guard') {
    const before = participant.shield;
    const restoreAmount = participant.guardRestore ?? DEFAULT_GUARD_RESTORE;
    participant.shield = Math.min(participant.maxShield, participant.shield + restoreAmount);
    participant.guardUsedThisTurn = true;
    pushLog(
      `${participant.name} guards (${before} → ${participant.shield} Shield, +${restoreAmount}).`,
      participant.id
    );
  } else if (action.id === 'recover') {
    const recovered = applyRecoverAction(participant, {
      statusIndex: body.recoverStatusIndex,
      statusId: body.recoverStatusId,
      statusName: body.recoverStatusName,
      statusType: body.recoverStatusType
    });
    if (recovered) {
      pushLog(
        `${participant.name} recovers and reduces ${recovered.name} by 1 stack.`,
        participant.id
      );
    } else {
      pushLog(`${participant.name} attempts to recover but has no eligible stacks.`, participant.id);
    }
  } else {
    const text = `${participant.name} ${action.logText}`;
    pushLog(text, participant.id);
  }
  touchState();
  broadcastState('standard_action');
  return { participant, action };
}

function applyAdjustment(participant, adjustment) {
  const { hp, shield, ap, status, note } = adjustment;
  if (typeof hp === 'number') {
    participant.hp = clampNumber(hp, 0, participant.maxHp);
  }
  if (typeof shield === 'number') {
    participant.shield = clampNumber(shield, 0, participant.maxShield);
  }
  if (typeof ap === 'number') {
    participant.apCurrent = clampNumber(ap, 0, participant.apMax);
  }
  if (Array.isArray(status)) {
    participant.statuses = status;
  }
  if (typeof note === 'string') {
    participant.notes = note;
  }
  clampParticipant(participant);
}

function sanitizeParticipantUpdate(body, current) {
  const update = {};
  const numericFields = [
    'initiative',
    'apCurrent',
    'hp',
    'shield',
    'mastery'
  ];
  for (const field of numericFields) {
    if (typeof body[field] === 'number') {
      update[field] = body[field];
    }
  }
  const baseStats = { ...(current.baseStats || {}) };
  let baseChanged = false;
  if (typeof body.apMax === 'number') {
    baseStats.apMax = body.apMax;
    baseChanged = true;
  }
  if (typeof body.maxHp === 'number') {
    baseStats.maxHp = body.maxHp;
    baseChanged = true;
  }
  if (typeof body.maxShield === 'number') {
    baseStats.maxShield = body.maxShield;
    baseChanged = true;
  }
  if (typeof body.baseGuardRestore === 'number') {
    baseStats.guardRestore = body.baseGuardRestore;
    baseChanged = true;
  }
  if (typeof body.baseDamageBonus === 'number') {
    baseStats.damageBonus = body.baseDamageBonus;
    baseChanged = true;
  }
  if (baseChanged) {
    update.baseStats = baseStats;
  }
  if (typeof body.name === 'string') update.name = body.name;
  if (typeof body.setFocus === 'string') update.setFocus = body.setFocus;
  if (typeof body.notes === 'string') update.notes = body.notes;
  if (Array.isArray(body.cards)) update.cards = body.cards;
  if (Array.isArray(body.tags)) update.tags = body.tags;
  if (Array.isArray(body.statuses)) update.statuses = body.statuses;
  if (Array.isArray(body.abilities)) {
    update.abilities = normalizeAbilityEntries(body.abilities);
  }
  if (Array.isArray(body.quests)) {
    update.quests = normalizeJournalEntries(body.quests, 'quest');
  }
  if (Array.isArray(body.achievements)) {
    update.achievements = normalizeJournalEntries(body.achievements, 'achievement');
  }
  if (body.stats && typeof body.stats === 'object') {
    update.stats = { ...current.stats, ...body.stats };
  }
  if (typeof body.proficiencyBonus === 'number') {
    update.proficiencyBonus = body.proficiencyBonus;
  }
  if (body.savingThrows && typeof body.savingThrows === 'object') {
    update.savingThrows = {
      ...current.savingThrows,
      ...normalizeSavingThrows(body.savingThrows)
    };
  }
  if (body.skills && typeof body.skills === 'object') {
    update.skills = {
      ...current.skills,
      ...normalizeSkills(body.skills)
    };
  }
  if (Array.isArray(body.relics)) {
    update.relics = normalizeRelics(body.relics);
  }
  if (Array.isArray(body.resistances)) {
    update.resistances = normalizeDamageTypes(body.resistances);
  }
  if (Array.isArray(body.vulnerabilities)) {
    update.vulnerabilities = normalizeDamageTypes(body.vulnerabilities);
  }
  return update;
}

function createParticipant(body = {}) {
  const id = body.id || randomUUID();
  const apMax = typeof body.apMax === 'number' ? body.apMax : 6;
  const maxHp = typeof body.maxHp === 'number' ? body.maxHp : 20;
  const maxShield = typeof body.maxShield === 'number' ? body.maxShield : 0;
  const baseStats = {
    apMax,
    maxHp,
    maxShield,
    guardRestore: typeof body.baseGuardRestore === 'number' ? body.baseGuardRestore : DEFAULT_GUARD_RESTORE,
    damageBonus: typeof body.baseDamageBonus === 'number' ? body.baseDamageBonus : 0
  };
  const participant = {
    id,
    name: body.name?.trim() || `Combatant ${trackerState.encounter.participants.length + 1}`,
    initiative: typeof body.initiative === 'number' ? body.initiative : 0,
    apMax,
    apCurrent: typeof body.apCurrent === 'number' ? body.apCurrent : apMax,
    hp: typeof body.hp === 'number' ? body.hp : maxHp,
    maxHp,
    shield: typeof body.shield === 'number' ? body.shield : maxShield,
    maxShield,
    mastery: typeof body.mastery === 'number' ? body.mastery : 1,
    cards: Array.isArray(body.cards) ? body.cards : [],
    tags: Array.isArray(body.tags) ? body.tags : [],
    statuses: Array.isArray(body.statuses) ? body.statuses : [],
    abilities: normalizeAbilityEntries(body.abilities),
    quests: normalizeJournalEntries(body.quests, 'quest'),
    achievements: normalizeJournalEntries(body.achievements, 'achievement'),
    resistances: normalizeDamageTypes(body.resistances),
    vulnerabilities: normalizeDamageTypes(body.vulnerabilities),
    notes: body.notes || '',
    setFocus: body.setFocus || '',
    stats: {
      strength: 0,
      dexterity: 0,
      constitution: 0,
      intelligence: 0,
      wisdom: 0,
      charisma: 0,
      ...(body.stats || {})
    },
    proficiencyBonus: typeof body.proficiencyBonus === 'number' ? body.proficiencyBonus : 2,
    savingThrows: normalizeSavingThrows(body.savingThrows),
    skills: normalizeSkills(body.skills),
    relics: normalizeRelics(body.relics),
    guardUsedThisTurn: false,
    guardRestore: baseStats.guardRestore,
    damageBonus: baseStats.damageBonus,
    baseStats,
    derivedBonuses: {
      base: baseStats,
      totals: createZeroModifier(),
      cardModifiers: [],
      setBonuses: []
    }
  };
  recalculateParticipant(participant);
  return participant;
}

function sortParticipants() {
  trackerState.encounter.participants.sort((a, b) => {
    if (b.initiative === a.initiative) {
      return a.name.localeCompare(b.name);
    }
    return b.initiative - a.initiative;
  });
}

function ensureCurrentIndex() {
  if (trackerState.encounter.currentIndex === -1 && trackerState.encounter.participants.length > 0) {
    trackerState.encounter.currentIndex = 0;
  }
}

function fixCurrentIndexAfterRemoval() {
  const list = trackerState.encounter.participants;
  if (!list.length) {
    trackerState.encounter.currentIndex = -1;
    return;
  }
  trackerState.encounter.currentIndex = trackerState.encounter.currentIndex % list.length;
}

function advanceTurn(direction = 1) {
  const list = trackerState.encounter.participants;
  if (!list.length) return;
  const previousIndex = trackerState.encounter.currentIndex;
  if (previousIndex === -1) {
    trackerState.encounter.currentIndex = 0;
  } else {
    trackerState.encounter.currentIndex =
      (previousIndex + direction + list.length) % list.length;
  }
  if (
    direction > 0 &&
    trackerState.encounter.currentIndex === 0 &&
    previousIndex !== -1
  ) {
    trackerState.encounter.round += 1;
  }
  const actor = getCurrentParticipant();
  if (actor) {
    const startEvents = resetTurn(actor, { applyStatusTick: direction > 0 });
    startEvents.forEach((event) => pushLog(`${actor.name} ${event}`, actor.id));
    pushLog(`It is now ${actor.name}'s turn (AP ${actor.apCurrent}).`, actor.id);
  }
  touchState();
  broadcastState('turn_advanced');
}

function resetTurn(participant, options = {}) {
  participant.apCurrent = participant.apMax;
  participant.guardUsedThisTurn = false;
  if (options.applyStatusTick) {
    return applyStartOfTurnStatusEffects(participant);
  }
  return [];
}

function clampParticipant(participant) {
  participant.apCurrent = clampNumber(participant.apCurrent, 0, participant.apMax);
  participant.hp = clampNumber(participant.hp, 0, participant.maxHp);
  participant.shield = clampNumber(participant.shield, 0, participant.maxShield);
}

function abilityModifier(score = 10) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.floor((value - 10) / 2);
}

function getCurrentParticipant() {
  const index = trackerState.encounter.currentIndex;
  if (index < 0) return null;
  return trackerState.encounter.participants[index] || null;
}

function findParticipant(id) {
  return trackerState.encounter.participants.find((entry) => entry.id === id);
}

function resolveActor(id) {
  if (id) {
    return findParticipant(id);
  }
  return getCurrentParticipant();
}

function pushLog(text, participantId = null, meta = {}) {
  const entry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    text,
    participantId,
    meta
  };
  trackerState.encounter.log.push(entry);
  if (trackerState.encounter.log.length > 200) {
    trackerState.encounter.log.shift();
  }
}

function removeMinorStatus(participant) {
  if (!Array.isArray(participant.statuses)) {
    participant.statuses = [];
  }
  const minorTypes = new Set(['blinded', 'weakened', 'fatigued']);
  const idx = participant.statuses.findIndex((status) => {
    const type = detectStatusType(status);
    if (minorTypes.has(type)) {
      return true;
    }
    const normalizedName = normalizeStatusToken(status?.name);
    return minorTypes.has(normalizedName);
  });
  if (idx !== -1) {
    participant.statuses.splice(idx, 1);
  }
}

function applyShortRest(participant) {
  if (!participant) return;
  const conScore = participant.stats?.constitution ?? participant.stats?.con ?? 10;
  const conMod = abilityModifier(conScore);
  const healAmount = Math.max(1, 5 + conMod);
  participant.hp = Math.min(participant.maxHp, participant.hp + healAmount);
  removeMinorStatus(participant);
  pushLog(`${participant.name} completes a short rest and heals ${healAmount} HP.`, participant.id);
}

function applyLongRest(participant) {
  if (!participant) return;
  participant.hp = participant.maxHp;
  participant.shield = participant.maxShield;
  participant.statuses = [];
  participant.apCurrent = participant.apMax;
  participant.guardUsedThisTurn = false;
  pushLog(`${participant.name} takes a long rest and is fully restored.`, participant.id);
}

function normalizeStatusToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function detectStatusType(status) {
  const candidates = [status?.presetId, status?.name, status?.id];
  for (const candidate of candidates) {
    const token = normalizeStatusToken(candidate);
    if (token.includes('bleeding')) return 'bleeding';
    if (token.includes('poisoned') || token === 'poison') return 'poisoned';
    if (token.includes('burning') || token === 'burn') return 'burning';
    if (token.includes('blinded') || token.includes('blind')) return 'blinded';
    if (token.includes('weakened') || token.includes('weaken')) return 'weakened';
    if (token.includes('fatigued') || token.includes('fatigue')) return 'fatigued';
    if (token.includes('restrained') || token.includes('restrain')) return 'restrained';
    if (token.includes('stunned') || token.includes('stun')) return 'stunned';
    if (token.includes('rooted') || token.includes('root')) return 'rooted';
  }
  return null;
}

function getStatusesByType(statuses = [], type) {
  return statuses
    .map((status, index) => {
      const detected = detectStatusType(status);
      if (!detected || detected !== type) return null;
      return { status, index, type: detected };
    })
    .filter(Boolean);
}

function getRecoverableStatuses(statuses = []) {
  const recoverable = ['bleeding', 'poisoned', 'burning'];
  return statuses
    .map((status, index) => {
      const detected = detectStatusType(status);
      if (!recoverable.includes(detected)) return null;
      return { status, index, type: detected };
    })
    .filter(Boolean);
}

function statusDisplayName(type) {
  const labels = {
    bleeding: 'Bleeding',
    poisoned: 'Poisoned',
    burning: 'Burning',
    blinded: 'Blinded',
    weakened: 'Weakened',
    fatigued: 'Fatigued',
    rooted: 'Rooted',
    restrained: 'Restrained',
    stunned: 'Stunned'
  };
  return labels[type] || type;
}

const KNOWN_STATUS_TYPES = [
  'bleeding',
  'poisoned',
  'burning',
  'blinded',
  'weakened',
  'fatigued',
  'rooted',
  'restrained',
  'stunned'
];

function buildStatusMergeKey(status, fallbackIndex = 0) {
  const type = detectStatusType(status);
  if (type) return `type:${type}`;
  const token = normalizeStatusToken(status?.name || status?.presetId || status?.id || '');
  if (token) return `name:${token}`;
  return `index:${fallbackIndex}`;
}

function normalizeStatuses(statuses = []) {
  if (!Array.isArray(statuses)) return [];
  const merged = new Map();
  statuses.forEach((rawStatus, index) => {
    if (!rawStatus || typeof rawStatus !== 'object') return;
    const key = buildStatusMergeKey(rawStatus, index);
    const type = detectStatusType(rawStatus);
    const parsedStacks = Number(rawStatus.stacks);
    const stacks = Number.isFinite(parsedStacks) ? Math.max(1, Math.round(parsedStacks)) : 1;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        id: rawStatus.id || randomUUID(),
        presetId: type || rawStatus.presetId || '',
        name: type ? statusDisplayName(type) : rawStatus.name || rawStatus.presetId || 'Status',
        stacks,
        notes: rawStatus.notes || ''
      });
      return;
    }
    existing.stacks += stacks;
    if (!existing.notes && rawStatus.notes) {
      existing.notes = rawStatus.notes;
    }
  });
  return Array.from(merged.values());
}

function getStatusStacks(participant, type) {
  const matches = getStatusesByType(participant.statuses || [], type);
  return matches.reduce((total, entry) => total + Math.max(0, Number(entry.status?.stacks || 0)), 0);
}

function setStatusStacks(participant, type, stacks) {
  if (!Array.isArray(participant.statuses)) {
    participant.statuses = [];
  }
  const matches = getStatusesByType(participant.statuses, type);
  const nextStacks = Math.max(0, Number(stacks || 0));
  if (!matches.length) {
    if (nextStacks > 0) {
      participant.statuses.push({
        id: randomUUID(),
        presetId: type,
        name: statusDisplayName(type),
        stacks: nextStacks,
        notes: ''
      });
    }
    return;
  }
  const [first, ...rest] = matches;
  if (nextStacks <= 0) {
    [first, ...rest]
      .sort((a, b) => b.index - a.index)
      .forEach((entry) => participant.statuses.splice(entry.index, 1));
    return;
  }
  first.status.stacks = nextStacks;
  if (!first.status.name) first.status.name = statusDisplayName(type);
  if (!first.status.presetId) first.status.presetId = type;
  rest
    .sort((a, b) => b.index - a.index)
    .forEach((entry) => participant.statuses.splice(entry.index, 1));
}

function addStatusStacks(participant, type, amount = 1) {
  const existing = getStatusStacks(participant, type);
  const increment = Math.max(1, Number(amount || 1));
  setStatusStacks(participant, type, existing + increment);
}

function enforceControlHierarchy(participant) {
  const hasStunned = getStatusStacks(participant, 'stunned') > 0;
  const hasRestrained = getStatusStacks(participant, 'restrained') > 0;
  if (hasStunned) {
    setStatusStacks(participant, 'restrained', 0);
    setStatusStacks(participant, 'rooted', 0);
    return;
  }
  if (hasRestrained) {
    setStatusStacks(participant, 'rooted', 0);
  }
}

function applyStatusDamage(participant, type, damage) {
  const amount = Math.max(0, Number(damage || 0));
  if (!amount) return;
  if (type === 'burning') {
    const shieldHit = Math.min(participant.shield, amount);
    participant.shield -= shieldHit;
    const hpHit = amount - shieldHit;
    if (hpHit > 0) {
      participant.hp = Math.max(0, participant.hp - hpHit);
    }
    return;
  }
  participant.hp = Math.max(0, participant.hp - amount);
}

function applyStartOfTurnStatusEffects(participant) {
  participant.statuses = normalizeStatuses(participant.statuses);
  const events = [];
  const startingStacks = {};
  KNOWN_STATUS_TYPES.forEach((type) => {
    startingStacks[type] = getStatusStacks(participant, type);
  });

  // Apply hierarchy to the starting snapshot before resolving this turn.
  if (startingStacks.stunned > 0) {
    startingStacks.restrained = 0;
    startingStacks.rooted = 0;
  } else if (startingStacks.restrained > 0) {
    startingStacks.rooted = 0;
  }

  // Start-of-turn damage from damaging statuses.
  ['bleeding', 'poisoned', 'burning'].forEach((type) => {
    const stacks = startingStacks[type] || 0;
    if (stacks <= 0) return;
    applyStatusDamage(participant, type, stacks);
    events.push(`takes ${stacks} ${statusDisplayName(type)} damage at start of turn.`);
  });

  // Start-of-turn AP impact from Fatigued.
  if (startingStacks.fatigued > 0) {
    const penalty = Math.max(1, startingStacks.fatigued);
    const before = participant.apCurrent;
    participant.apCurrent = Math.max(1, participant.apCurrent - penalty);
    events.push(`loses ${before - participant.apCurrent} AP from Fatigued.`);
  }

  // Stunned: lose this turn.
  if (startingStacks.stunned > 0) {
    participant.apCurrent = 0;
    events.push('is Stunned and loses this turn.');
  }

  const escalatedThisTurn = new Set();
  const nextStacks = {};
  KNOWN_STATUS_TYPES.forEach((type) => {
    nextStacks[type] = Math.max(0, (startingStacks[type] || 0) - 1);
  });

  // Escalations (checked after damage/effects resolve, from starting stacks).
  if (startingStacks.bleeding >= 5 && !escalatedThisTurn.has('bleeding')) {
    escalatedThisTurn.add('bleeding');
    nextStacks.bleeding = 1;
    nextStacks.weakened += 1;
    events.push('Bleeding escalates: gains Weakened 1 and Bleeding resets to 1.');
  }

  if (startingStacks.poisoned >= 5 && !escalatedThisTurn.has('poisoned')) {
    escalatedThisTurn.add('poisoned');
    nextStacks.poisoned = 1;
    nextStacks.fatigued += 1;
    events.push('Poisoned escalates: gains Fatigued 1 and Poisoned resets to 1.');
  }

  if (startingStacks.rooted >= 5 && !escalatedThisTurn.has('rooted')) {
    escalatedThisTurn.add('rooted');
    nextStacks.rooted = 0;
    nextStacks.restrained += 1;
    events.push('Rooted escalates to Restrained.');
  }

  KNOWN_STATUS_TYPES.forEach((type) => {
    setStatusStacks(participant, type, nextStacks[type] || 0);
  });

  // Also decay custom/unknown statuses by 1 stack.
  participant.statuses = participant.statuses
    .map((status) => {
      if (detectStatusType(status)) return status;
      const stacks = Math.max(0, Number(status.stacks || 1) - 1);
      if (stacks <= 0) return null;
      return { ...status, stacks };
    })
    .filter(Boolean);

  // Re-apply hierarchy after all mutations.
  enforceControlHierarchy(participant);

  clampParticipant(participant);
  return events;
}

function applyRecoverAction(participant, target = {}) {
  participant.statuses = normalizeStatuses(participant.statuses);
  const recoverable = getRecoverableStatuses(participant.statuses);
  if (!recoverable.length) return null;

  let matched = null;
  if (Number.isInteger(target?.statusIndex)) {
    matched = recoverable.find((entry) => entry.index === Number(target.statusIndex));
  }
  if (!matched && target?.statusId) {
    matched = recoverable.find((entry) => String(entry.status.id || '') === String(target.statusId));
  }
  if (!matched && target?.statusType) {
    const targetType = normalizeStatusToken(target.statusType);
    matched = recoverable.find((entry) => entry.type === targetType);
  }
  if (!matched && target?.statusName) {
    const targetName = normalizeStatusToken(target.statusName);
    matched = recoverable.find((entry) => normalizeStatusToken(entry.status.name) === targetName);
  }
  if (!matched) {
    [matched] = recoverable;
  }

  const status = matched.status;
  const nextStacks = Math.max(0, Number(status.stacks || 1) - 1);
  if (nextStacks <= 0) {
    participant.statuses.splice(matched.index, 1);
  } else {
    status.stacks = nextStacks;
  }
  return {
    name: status.name || matched.type || 'a condition',
    type: matched.type,
    remainingStacks: nextStacks
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (err) {
    return {};
  }
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

async function handleStatic(res, pathname) {
  let requestedPath = pathname === '/' ? '/index.html' : pathname;
  if (requestedPath === '/player') {
    requestedPath = '/player.html';
  }
  const normalized = path
    .normalize(requestedPath)
    .replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(PUBLIC_DIR, normalized);
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME_TYPES[ext] || 'text/plain; charset=utf-8';
  try {
    const file = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': type });
    res.end(file);
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

function handleSse(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache'
  });

  const clientId = randomUUID();
  sseClients.set(clientId, res);
  res.write(`data: ${JSON.stringify({ type: 'state', state: trackerState })}\n\n`);

  const keepAlive = setInterval(() => {
    if (res.writableEnded) {
      clearInterval(keepAlive);
      return;
    }
    res.write('event: ping\n');
    res.write('data: {}\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sseClients.delete(clientId);
  });
}

function broadcastState(reason) {
  trackerState.updatedAt = new Date().toISOString();
  const payload = `data: ${JSON.stringify({ type: 'state', state: trackerState, reason })}\n\n`;
  for (const [, client] of sseClients) {
    client.write(payload);
  }
}

function touchState() {
  trackerState.updatedAt = new Date().toISOString();
}

function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createZeroModifier() {
  return {
    apMax: 0,
    maxHp: 0,
    maxShield: 0,
    guardRestore: 0,
    damageBonus: 0
  };
}

function defaultSavingThrows() {
  const defaults = {};
  for (const key of ABILITY_KEYS) {
    defaults[key] = false;
  }
  return defaults;
}

function normalizeSavingThrows(value) {
  const normalized = defaultSavingThrows();
  if (!value || typeof value !== 'object') return normalized;
  for (const key of ABILITY_KEYS) {
    if (typeof value[key] === 'boolean') {
      normalized[key] = value[key];
    }
  }
  return normalized;
}

function defaultSkills() {
  const defaults = {};
  for (const key of SKILL_KEYS) {
    defaults[key] = { proficient: false, expert: false };
  }
  return defaults;
}

function normalizeSkills(value) {
  const normalized = defaultSkills();
  if (!value || typeof value !== 'object') return normalized;
  for (const key of SKILL_KEYS) {
    const entry = value[key];
    if (entry && typeof entry === 'object') {
      normalized[key] = {
        proficient: Boolean(entry.proficient),
        expert: Boolean(entry.expert)
      };
    }
  }
  return normalized;
}

function normalizeRelics(list) {
  if (!Array.isArray(list)) return [];
  return list.map((relic, index) => ({
    id: relic.id || randomUUID(),
    name: relic.name?.trim() || `Relic ${index + 1}`,
    ability: relic.ability || '',
    description: relic.description || '',
    modifiers: normalizeModifiers(relic.modifiers || {}),
    hp: typeof relic.hp === 'number' ? relic.hp : 0,
    ap: typeof relic.ap === 'number' ? relic.ap : 0
  }));
}

function normalizeDamageTypes(list = []) {
  if (!Array.isArray(list)) return [];
  const normalized = [];
  for (const entry of list) {
    if (typeof entry !== 'string') continue;
    const value = entry.trim();
    if (!value) continue;
    const exists = normalized.find((current) => current.toLowerCase() === value.toLowerCase());
    if (!exists) {
      normalized.push(value);
    }
  }
  return normalized;
}

function normalizeJournalCategory(value) {
  const token = String(value || '')
    .toLowerCase()
    .trim();
  if (token.startsWith('quest')) return 'quest';
  if (token.startsWith('achievement')) return 'achievement';
  return null;
}

function normalizeAbilityEntries(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry, index) => {
      if (entry == null) return null;
      if (typeof entry === 'string') {
        const description = entry.trim();
        if (!description) return null;
        return {
          id: randomUUID(),
          name: `Ability ${index + 1}`,
          description,
          automation: {}
        };
      }
      const name = String(entry.name || '').trim();
      const description = String(entry.description || entry.text || '').trim();
      if (!name && !description) return null;
      return {
        id: entry.id || randomUUID(),
        name: name || `Ability ${index + 1}`,
        description,
        automation: entry.automation && typeof entry.automation === 'object' ? entry.automation : {}
      };
    })
    .filter(Boolean);
}

function normalizeJournalEntries(list, category) {
  if (!Array.isArray(list)) return [];
  const normalizedCategory = normalizeJournalCategory(category);
  if (!normalizedCategory) return [];
  const deduped = new Map();
  list.forEach((entry, index) => {
    if (entry == null) return;
    const parsed = createJournalEntry(
      typeof entry === 'object' ? entry : { title: String(entry) },
      normalizedCategory,
      entry?.id || null,
      index
    );
    const key = String(parsed.id);
    deduped.set(key, parsed);
  });
  return Array.from(deduped.values());
}

function createJournalEntry(body = {}, category, forcedId = null, fallbackIndex = 0) {
  const normalizedCategory = normalizeJournalCategory(category);
  const titleRaw = body.title ?? body.name ?? `${normalizedCategory === 'quest' ? 'Quest' : 'Achievement'} ${fallbackIndex + 1}`;
  const descriptionRaw = body.description ?? body.text ?? body.details ?? '';
  const acknowledged = Boolean(body.acknowledged);
  const createdAt = body.createdAt || new Date().toISOString();
  const base = {
    id: forcedId || body.id || randomUUID(),
    title: String(titleRaw).trim() || `${normalizedCategory === 'quest' ? 'Quest' : 'Achievement'} ${fallbackIndex + 1}`,
    description: String(descriptionRaw).trim(),
    createdAt,
    acknowledged,
    acknowledgedAt: acknowledged ? body.acknowledgedAt || new Date().toISOString() : null
  };
  if (normalizedCategory === 'achievement') {
    base.automation = body.automation && typeof body.automation === 'object' ? body.automation : {};
  }
  return base;
}

function resolveJournalTargets(body = {}) {
  const target = String(body.target || 'participant').toLowerCase();
  if (target === 'all') {
    return trackerState.encounter.participants;
  }
  const participant = findParticipant(body.participantId);
  return participant ? [participant] : [];
}

function ensureBaseStats(participant) {
  if (!participant.baseStats) {
    participant.baseStats = {
      apMax: participant.apMax ?? 6,
      maxHp: participant.maxHp ?? 20,
      maxShield: participant.maxShield ?? 0,
      guardRestore: participant.guardRestore ?? DEFAULT_GUARD_RESTORE,
      damageBonus: participant.damageBonus ?? 0
    };
  }
  return participant.baseStats;
}

function normalizeModifiers(modifiers = {}) {
  const normalized = createZeroModifier();
  if (!modifiers) return normalized;
  for (const key of Object.keys(normalized)) {
    if (typeof modifiers[key] === 'number') {
      normalized[key] = modifiers[key];
    }
  }
  return normalized;
}

function hasModifierValue(modifiers) {
  return Object.values(modifiers).some((value) => value !== 0);
}

function addModifierTotals(target, addition) {
  for (const key of Object.keys(target)) {
    target[key] += addition[key] || 0;
  }
}

function computeSetBonuses(participant) {
  const counts = {};
  for (const card of participant.cards || []) {
    if (!card.set) continue;
    counts[card.set] = (counts[card.set] || 0) + 1;
  }
  const appliedBonuses = [];
  const totals = createZeroModifier();
  for (const [setName, count] of Object.entries(counts)) {
    const definitions = SET_LIBRARY[setName];
    if (!definitions) continue;
    definitions.forEach((bonus) => {
      if (count >= bonus.pieces) {
        const modifiers = normalizeModifiers(bonus.modifiers);
        appliedBonuses.push({
          set: setName,
          pieces: bonus.pieces,
          effect: bonus.effect,
          modifiers
        });
        addModifierTotals(totals, modifiers);
      }
    });
  }
  return { appliedBonuses, setTotals: totals };
}

function recalculateParticipant(participant) {
  participant.statuses = normalizeStatuses(participant.statuses);
  participant.abilities = normalizeAbilityEntries(participant.abilities);
  participant.quests = normalizeJournalEntries(participant.quests, 'quest');
  participant.achievements = normalizeJournalEntries(participant.achievements, 'achievement');
  const rootedStacks = getStatusStacks(participant, 'rooted');
  if (rootedStacks >= 5) {
    setStatusStacks(participant, 'rooted', 0);
    addStatusStacks(participant, 'restrained', 1);
  }
  enforceControlHierarchy(participant);
  participant.resistances = normalizeDamageTypes(participant.resistances);
  participant.vulnerabilities = normalizeDamageTypes(participant.vulnerabilities);
  const base = ensureBaseStats(participant);
  const totals = createZeroModifier();
  const cardModifiers = [];
  participant.relics = normalizeRelics(participant.relics);
  for (const card of participant.cards || []) {
    const modifiers = normalizeModifiers(card.modifiers);
    if (hasModifierValue(modifiers)) {
      cardModifiers.push({
        cardId: card.id,
        name: card.name,
        modifiers
      });
    }
    addModifierTotals(totals, modifiers);
  }
  for (const relic of participant.relics || []) {
    const modifiers = normalizeModifiers(relic.modifiers);
    if (typeof relic.hp === 'number') {
      modifiers.maxHp += relic.hp;
    }
    if (typeof relic.ap === 'number') {
      modifiers.apMax += relic.ap;
    }
    addModifierTotals(totals, modifiers);
  }
  const { appliedBonuses, setTotals } = computeSetBonuses(participant);
  addModifierTotals(totals, setTotals);

  participant.apMax = Math.max(1, Math.round((base.apMax ?? 0) + totals.apMax));
  participant.apCurrent = clampNumber(
    participant.apCurrent ?? participant.apMax,
    0,
    participant.apMax
  );
  participant.maxHp = Math.max(1, Math.round((base.maxHp ?? 0) + totals.maxHp));
  participant.hp = clampNumber(participant.hp ?? participant.maxHp, 0, participant.maxHp);
  participant.maxShield = Math.max(0, Math.round((base.maxShield ?? 0) + totals.maxShield));
  participant.shield = clampNumber(
    participant.shield ?? participant.maxShield,
    0,
    participant.maxShield
  );
  participant.guardRestore = Math.max(
    1,
    Math.round((base.guardRestore ?? DEFAULT_GUARD_RESTORE) + totals.guardRestore)
  );
  participant.damageBonus = Math.round((base.damageBonus ?? 0) + totals.damageBonus);
  participant.derivedBonuses = {
    base,
    totals,
    cardModifiers,
    setBonuses: appliedBonuses
  };
  clampParticipant(participant);
}

function importEncounter(encounter = {}) {
  trackerState.encounter = {
    name: encounter.name || 'Imported Encounter',
    round: Number(encounter.round) || 1,
    started: Boolean(encounter.started),
    participants: [],
    currentIndex: -1,
    log: Array.isArray(encounter.log) ? encounter.log.slice(-200) : []
  };
  const participants = Array.isArray(encounter.participants)
    ? encounter.participants.map((raw) => createParticipant(raw))
    : [];
  trackerState.encounter.participants = participants;
  const importedIndex = typeof encounter.currentIndex === 'number' ? encounter.currentIndex : -1;
  trackerState.encounter.currentIndex =
    participants.length === 0 ? -1 : Math.min(Math.max(importedIndex, 0), participants.length - 1);
  sortParticipants();
  ensureCurrentIndex();
}
