import { createServer } from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { GAME_LIMITS } from './lib/game-config.js';
import { getCardTierShieldBonus } from './lib/card-rules.js';
import { startEncounterLifecycle, endEncounterLifecycle } from './lib/encounter-lifecycle.js';
import { executeStandardActionForEncounter } from './lib/actions/standard.js';
import { executeCustomActionForEncounter } from './lib/actions/custom.js';
import {
  executeRemoveConstructActionForEncounter,
  executeRetargetConstructActionForEncounter,
  executeMoveConstructActionForEncounter
} from './lib/actions/construct.js';
import {
  executeAddZoneTargetActionForEncounter,
  executeRemoveZoneTargetActionForEncounter
} from './lib/actions/zone-targets.js';
import { resolveCardActionContext } from './lib/actions/card-preflight.js';
import { applyShortRestForEncounter, applyLongRestForEncounter } from './lib/rest.js';
import { SET_LIBRARY, buildSetNameLookup } from './lib/set-library.js';
import {
  buildTurnEntriesForEncounter,
  getTurnEntryKeyForEncounter,
  setCurrentTurnByIndexForEncounter,
  ensureCurrentIndexForEncounter,
  resolveCurrentTurnIndexForAdvanceForEncounter,
  getCurrentTurnEntryForEncounter,
  findParticipantInEncounter,
  getCurrentParticipantForEncounter,
  findZoneInOwner
} from './lib/turn-order.js';

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
const MAX_ACTIVE_CARDS = GAME_LIMITS.maxActiveCards;
const MAX_ACTIVE_ZONES = GAME_LIMITS.maxActiveZones;
const SET_NAME_LOOKUP = buildSetNameLookup(SET_LIBRARY);

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

const ARCANE_DAMAGE_TYPE_OPTIONS = new Set([
  'acid',
  'bludgeoning',
  'cold',
  'fire',
  'force',
  'lightning',
  'necrotic',
  'piercing',
  'poison',
  'psychic',
  'radiant',
  'slashing',
  'thunder'
]);

const SHADOW_FINISHER_STATUS_TYPES = new Set([
  'blinded',
  'weakened',
  'fatigued',
  'rooted',
  'restrained',
  'stunned'
]);

const TEAM_OPTIONS = Object.freeze(['Team 1', 'Team 2', 'Team 3', 'Team 4']);

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
    statuses: STATUS_LIBRARY,
    teams: TEAM_OPTIONS
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
    currentTurnKey: '',
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
        const update = sanitizeParticipantUpdate(body, participant);
        Object.assign(participant, update);
        if (Object.prototype.hasOwnProperty.call(update, 'team')) {
          for (const entry of trackerState.encounter.participants || []) {
            recalculateParticipant(entry);
          }
        } else {
          recalculateParticipant(participant);
        }
        sortParticipants();
        ensureCurrentIndex();
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

    if (method === 'POST' && pathname === '/api/turn/end') {
      endEncounter();
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

    if (method === 'POST' && pathname === '/api/actions/card') {
      const body = await readBody(req);
      const result = executeCardAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/constructs/remove') {
      const body = await readBody(req);
      const result = executeRemoveConstructAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/constructs/target') {
      const body = await readBody(req);
      const result = executeRetargetConstructAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/constructs/move') {
      const body = await readBody(req);
      const result = executeMoveConstructAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/zones/target/add') {
      const body = await readBody(req);
      const result = executeAddZoneTargetAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/zones/target/remove') {
      const body = await readBody(req);
      const result = executeRemoveZoneTargetAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/set/activate') {
      const body = await readBody(req);
      const result = activateSetBonusAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/set/allies/add') {
      const body = await readBody(req);
      const result = executeAddSetAllyAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/set/allies/remove') {
      const body = await readBody(req);
      const result = executeRemoveSetAllyAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/actions/custom') {
      const body = await readBody(req);
      const result = executeCustomAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
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
  startEncounterLifecycle(trackerState, startingRound, {
    resetSetCombatState,
    ensureCurrentIndex,
    getCurrentParticipant,
    resetTurn,
    pushLog,
    touchState,
    broadcastState
  });
}

function endEncounter() {
  endEncounterLifecycle(trackerState, {
    resetSetCombatState,
    pushLog,
    touchState,
    broadcastState
  });
}

function executeStandardAction(body) {
  const result = executeStandardActionForEncounter(body, {
    standardActions: STANDARD_ACTIONS,
    defaultGuardRestore: DEFAULT_GUARD_RESTORE,
    resolveActor,
    applyRecoverAction,
    markTurnActionTaken,
    pushLog,
    touchState,
    broadcastState
  });
  if (result?.error || !result?.participant || !result?.action) {
    return result;
  }
  const participant = result.participant;
  const actionId = String(result.action.id || '').toLowerCase();
  let changed = false;
  if (actionId === 'move') {
    changed = applyShadowMovementProgress(participant, 10) > 0 || changed;
  } else if (actionId === 'move_difficult' || actionId === 'slip') {
    changed = applyShadowMovementProgress(participant, 5) > 0 || changed;
  }
  if (actionId === 'recover') {
    changed = maybeApplyDivineRecoverHealing(participant, participant, { triggeredBySelfRecover: true, silent: true }) > 0 || changed;
  }
  if (changed) {
    touchState();
    broadcastState('standard_action_set_bonus');
  }
  return result;
}

function executeCardAction(body) {
  const context = resolveCardActionContext(body, { resolveActor, isCardActive });
  if (context.error) {
    return context;
  }
  const { participant, card } = context;
  const setRuntime = ensureSetRuntime(participant);
  const machine = setRuntime.machine;
  const arcane = setRuntime.arcane;
  const beast = setRuntime.beast;
  const demonic = setRuntime.demonic;
  const divine = setRuntime.divine;
  const elemental = setRuntime.elemental;
  const nature = setRuntime.nature;
  const shadow = setRuntime.shadow;
  const setGroups = buildActiveCardGroups(participant);
  const hasArcane3 = hasSetBonus(participant, 'Arcane', 3, setGroups);
  const hasArcane5 = hasSetBonus(participant, 'Arcane', 5, setGroups);
  const hasBeast3 = hasSetBonus(participant, 'Beast', 3, setGroups);
  const hasBeast5 = hasSetBonus(participant, 'Beast', 5, setGroups);
  const hasBeast10 = hasSetBonus(participant, 'Beast', 10, setGroups);
  const hasDemonic3 = hasSetBonus(participant, 'Demonic', 3, setGroups);
  const hasDemonic5 = hasSetBonus(participant, 'Demonic', 5, setGroups);
  const hasDemonic10 = hasSetBonus(participant, 'Demonic', 10, setGroups);
  const hasDivine3 = hasSetBonus(participant, 'Divine', 3, setGroups);
  const hasElemental3 = hasSetBonus(participant, 'Elemental', 3, setGroups);
  const hasElemental5 = hasSetBonus(participant, 'Elemental', 5, setGroups);
  const hasElemental7 = hasSetBonus(participant, 'Elemental', 7, setGroups);
  const hasElemental10 = hasSetBonus(participant, 'Elemental', 10, setGroups);
  const hasNature3 = hasSetBonus(participant, 'Nature', 3, setGroups);
  const hasNature10 = hasSetBonus(participant, 'Nature', 10, setGroups);
  const hasShadow3 = hasSetBonus(participant, 'Shadow', 3, setGroups);
  const hasShadow7 = hasSetBonus(participant, 'Shadow', 7, setGroups);
  const hasShadow10 = hasSetBonus(participant, 'Shadow', 10, setGroups);
  const isElementalAttack = String(card?.set || '').toLowerCase() === 'elemental' && getCardDamageAtCurrentMastery(card) > 0;
  const masteryLevel = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  const baseCost = Math.max(0, Number(card.apCost || 0));
  let apCost = baseCost;
  const notes = [];
  const chargesMax = Math.max(
    0,
    Math.round(Number(card.chargesMax ?? card.maxCharges ?? card.charges ?? 0) || 0)
  );
  const chargesCurrent =
    chargesMax > 0
      ? Math.max(
          0,
          Math.round(Number(card.chargesCurrent ?? card.remainingCharges ?? chargesMax) || 0)
        )
      : 0;

  if (chargesMax > 0 && chargesCurrent <= 0) {
    return { error: 'No charges remaining' };
  }

  if (hasSetBonus(participant, 'Machine', 5) && machine.autoLoaderPrimed && isMachineAttackCard(card)) {
    const discounted = Math.max(1, apCost - 1);
    if (discounted < apCost) {
      apCost = discounted;
      machine.autoLoaderPrimed = false;
      machine.autoLoaderDiscountUsedTurn = true;
      notes.push('Auto-Loader discount applied (-1 AP).');
    }
  }

  if (participant.apCurrent < apCost) {
    return { error: 'Not enough AP' };
  }

  let damageType = String(card.damageType || '').trim();
  let secondaryDamageType = String(card.secondaryDamageType || '').trim() || damageType;
  const overrideDamageTypeRaw = String(body.overrideDamageType || '').trim();
  const overrideDamageType = normalizeDamageTypeOverride(overrideDamageTypeRaw);
  if (overrideDamageTypeRaw && !overrideDamageType) {
    return { error: `Unsupported damage type: ${overrideDamageTypeRaw}` };
  }
  if (overrideDamageType) {
    if (!hasArcane3) {
      return { error: 'Arcane 3-piece bonus is required to change damage type.' };
    }
    if (arcane.damageTypeShiftUsedTurn) {
      return { error: 'Arcane damage-type shift has already been used this turn.' };
    }
    damageType = overrideDamageType;
    secondaryDamageType = overrideDamageType;
    arcane.damageTypeShiftUsedTurn = true;
    notes.push(`Arcane Shift changes damage type to ${overrideDamageType}.`);
  }
  const baseDamage = getCardDamageAtCurrentMastery(card);
  const secondaryBaseDamage = getCardSecondaryDamageAtCurrentMastery(card);
  const isConstruct = isConstructCard(card);
  const zoneCard = !isConstruct && isZoneCard(card, masteryLevel);
  const targetMode = normalizeCardTargetMode(card);
  const secondaryTargetMode = normalizeSecondaryTargetMode(card);
  const multiTargetCap = targetMode === 'multi_select' ? getCardMultiTargetCap(card, masteryLevel) : 0;
  const allowSelfTarget = card.allowSelfTarget !== false;
  const constructDamageBonus = getMachineConstructDamageBonus(participant);
  const constructDurationBonus = getMachineConstructDurationBonus(participant);
  const constructMode = detectConstructMode(card);
  const constructStatusId = String(card.constructStatusId || '').trim();
  const constructStatusName = String(card.constructStatusName || '').trim();
  const constructStatusStacks = Math.max(1, Number(card.constructStatusStacks || 1));
  const constructShieldRestore = Math.max(
    0,
    Math.round(
      getCardScaledValue(card.constructShieldRestoreByLevel, masteryLevel, Number(card.constructShieldRestore || 0))
    )
  );
  const constructShieldRestoreAlliesOnly = card.constructShieldRestoreAlliesOnly === true;
  const constructHeal = Math.max(
    0,
    Math.round(
      getCardScaledValue(card.constructHealByLevel, masteryLevel, Number(card.constructHeal || 0))
    )
  );
  const constructHealAlliesOnly = card.constructHealAlliesOnly === true;
  const constructHealTargetOnly = card.constructHealTargetOnly === true;
  const constructTriggerOnTargetTurn = card.constructTriggerOnTargetTurn === true;
  const constructTargetRequired = card.constructTargetRequired === true;
  const constructMaxHpCasterConBonus =
    card.constructMaxHpFromCasterConMod === true
      ? getAbilityModifier(participant, 'constitution')
      : 0;
  const constructAuraRadiusFt = Math.max(
    0,
    Math.round(
      getCardScaledValue(card.constructAuraRadiusByLevel, masteryLevel, Number(card.constructAuraRadiusFt || 0))
    )
  );
  const constructDetectDc = Math.max(
    0,
    Math.round(
      getCardScaledValue(card.constructDetectDcByLevel, masteryLevel, Number(card.constructDetectDc || 0))
    )
  );
  const constructVisionRangeFt = Math.max(
    0,
    Math.round(
      getCardScaledValue(card.constructVisionRangeByLevel, masteryLevel, Number(card.constructVisionRangeFt || 0))
    )
  );
  const constructUtilityKind = String(card.constructUtilityKind || '').trim().toLowerCase();
  const constructUtilityNote = String(card.constructUtilityNote || card.constructScoutNote || '').trim();
  const arcaneModifiedCard = arcane.modifiedCard?.cardId === card.id ? arcane.modifiedCard : null;
  if (arcaneModifiedCard?.mode === 'ap') {
    apCost = Math.max(1, apCost - 1);
  }
  const nextAttackBonus = !isConstruct && baseDamage > 0
    ? Math.max(0, Number(participant.nextAttackDamageBonus || 0))
    : 0;
  const zoneTickDamage = zoneCard
    ? (() => {
        // Zone damage bonuses should only scale existing damage zones.
        // Pure sustain/healing zones do not gain incidental damage from set bonuses.
        const zoneBaseDamage = Math.max(0, Number(baseDamage || 0));
        if (zoneBaseDamage <= 0) return 0;
        return Math.max(
          0,
          zoneBaseDamage +
            (participant.damageBonus || 0) +
            (hasElemental7 ? 2 : 0) +
            (arcaneModifiedCard?.mode === 'damage' ? 2 : 0)
        );
      })()
    : 0;
  const rawDamage = isConstruct
    ? 0
    : zoneCard
      ? 0
    : baseDamage > 0
      ? Math.max(
          0,
          baseDamage + (participant.damageBonus || 0) + nextAttackBonus + (arcaneModifiedCard?.mode === 'damage' ? 2 : 0)
        )
      : 0;
  const secondaryRawDamage = isConstruct ? 0 : Math.max(0, secondaryBaseDamage);
  const shieldRestoreBase = getCardScaledValue(card.shieldRestoreByLevel, masteryLevel, 0);
  const shieldRestoreBonus = getGlobalShieldRestoreBonus(participant);
  const shieldRestoreTotal = Math.max(0, shieldRestoreBase + (shieldRestoreBase > 0 ? shieldRestoreBonus : 0));
  let healTotal = Math.max(
    0,
    Math.round(getCardScaledValue(card.healByLevel, masteryLevel, Number(card.heal || 0)))
  );
  if (healTotal > 0 && hasNature3) {
    healTotal += 2;
  }
  const moveDistance = getCardScaledValue(card.movementByLevel, masteryLevel, 0);
  const pushDistance = getCardScaledValue(card.pushDistanceByLevel, masteryLevel, 0);
  const pullDistance = getCardScaledValue(card.pullDistanceByLevel, masteryLevel, 0);
  const statusApply = normalizeCardStatusApply(card, masteryLevel);
  const zoneStatusApply = zoneCard ? normalizeCardStatusApply(card, masteryLevel) : null;
  const zoneEnterStatusApply = zoneCard ? normalizeStatusApplyConfig(card.zoneEnterStatusApply, masteryLevel) : null;
  const zoneEnterDamage = zoneCard
    ? Math.max(
        0,
        Math.round(getCardScaledValue(card.zoneEnterDamageByLevel, masteryLevel, Number(card.zoneEnterDamage || 0)))
      )
    : 0;
  const zoneTickOnTurn = card.zoneTickOnTurn !== false;
  const zoneTriggerOnTargetAdd = zoneCard ? (card.zoneTriggerOnTargetAdd === true || zoneEnterDamage > 0 || Boolean(zoneEnterStatusApply)) : false;
  const zoneConsumeOnTrigger = zoneCard && card.zoneConsumeOnTrigger === true;
  const zoneShieldRestore = zoneCard
    ? Math.max(
        0,
        Math.round(getCardScaledValue(card.zoneShieldRestoreByLevel, masteryLevel, Number(card.zoneShieldRestore || 0)))
      )
    : 0;
  const zoneHeal = zoneCard
    ? Math.max(
        0,
        Math.round(getCardScaledValue(card.zoneHealByLevel, masteryLevel, Number(card.zoneHeal || 0)))
      )
    : 0;
  const zoneDamageEnemiesOnly = zoneCard && card.zoneDamageEnemiesOnly === true;
  const zoneShieldRestoreAlliesOnly = zoneCard ? card.zoneShieldRestoreAlliesOnly !== false : false;
  const zoneHealAlliesOnly = zoneCard ? card.zoneHealAlliesOnly !== false : false;
  const zoneDetectDc = zoneCard
    ? Math.max(
        0,
        Math.round(getCardScaledValue(card.zoneDetectDcByLevel, masteryLevel, Number(card.zoneDetectDc || 0)))
      )
    : 0;
  const zoneTriggerMode = zoneCard ? String(card.zoneTriggerMode || '').trim().toLowerCase() : '';
  const selfTarget = isSelfTargetCard(card, masteryLevel);
  const conditionalShieldDamageBonus = Math.max(
    0,
    Math.round(getCardScaledValue(card.bonusDamageIfTargetHasShieldByLevel, masteryLevel, Number(card.bonusDamageIfTargetHasShield || 0)))
  );
  const fullyBlockedHpDamage = Math.max(
    0,
    Math.round(getCardScaledValue(card.directHpDamageOnFullyBlockedByLevel, masteryLevel, Number(card.directHpDamageOnFullyBlocked || 0)))
  );
  const nextAttackGrant = Math.max(
    0,
    Math.round(getCardScaledValue(card.nextAttackDamageBonusByLevel, masteryLevel, Number(card.nextAttackDamageBonus || 0)))
  );
  const cardUtilityNote = String(card.utilityNote || '').trim();
  const effectTextNote = String(card.effect || '').trim();
  const targetApNextTurnGrant = Math.max(
    0,
    Math.round(
      getCardScaledValue(
        card.grantTargetApNextTurnByLevel,
        masteryLevel,
        Number(card.grantTargetApNextTurn || 0)
      )
    )
  );
  const apGainNow = Math.max(
    0,
    Math.round(
      getCardScaledValue(
        card.apGainByLevel,
        masteryLevel,
        Number(card.apGain || 0)
      )
    )
  );
  const removeStatusCount = Math.max(
    0,
    Math.round(
      getCardScaledValue(
        card.removeStatusCountByLevel ?? card.cleanseStatusCountByLevel,
        masteryLevel,
        Number(card.removeStatusCount ?? card.cleanseStatusCount ?? 0)
      )
    )
  );

  const targetId = String(body.targetId || '').trim();
  const target = targetId ? findParticipant(targetId) : null;
  const targetIdsRaw = Array.isArray(body.targetIds)
    ? body.targetIds
    : String(body.targetIds || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  const targetIds = [];
  for (const value of targetIdsRaw) {
    const id = String(value || '').trim();
    if (!id || targetIds.includes(id)) continue;
    targetIds.push(id);
  }
  const selectedTargets = targetIds
    .map((id) => findParticipant(id))
    .filter(Boolean);
  if (targetMode === 'multi_select' && !selectedTargets.length && target) {
    selectedTargets.push(target);
  }
  if (targetMode === 'multi_select' && selectedTargets.length !== targetIds.length) {
    return { error: 'One or more selected targets were not found' };
  }
  if (targetMode === 'multi_select' && selectedTargets.length > multiTargetCap) {
    return { error: `Select up to ${multiTargetCap} targets` };
  }

  const primaryTarget = targetMode === 'multi_select'
    ? selectedTargets[0] || null
    : target;
  const primaryTargets = targetMode === 'all_others'
    ? trackerState.encounter.participants.filter((entry) => entry.id !== participant.id)
    : targetMode === 'multi_select'
      ? selectedTargets
      : primaryTarget
        ? [primaryTarget]
        : [];
  const arcaneSplitTargetId = String(body.arcaneSplitTargetId || '').trim();
  const arcaneSplitTarget = arcaneSplitTargetId ? findParticipant(arcaneSplitTargetId) : null;
  const canArcaneSplit =
    hasArcane5 &&
    !arcane.splitUsedTurn &&
    !isConstruct &&
    !zoneCard &&
    !selfTarget &&
    targetMode === 'single' &&
    primaryTarget &&
    arcaneSplitTarget &&
    arcaneSplitTarget.id !== primaryTarget.id;
  if (arcaneSplitTargetId && !arcaneSplitTarget) {
    return { error: 'Arcane split target not found' };
  }
  if (arcaneSplitTargetId && !hasArcane5) {
    return { error: 'Arcane 5-piece bonus is required for split targeting.' };
  }
  if (arcaneSplitTargetId && arcane.splitUsedTurn) {
    return { error: 'Arcane split has already been used this turn.' };
  }
  if (arcaneSplitTarget && arcaneSplitTarget.id === participant.id && !allowSelfTarget) {
    return { error: 'This card cannot target self for Arcane split.' };
  }
  if (arcaneSplitTargetId && !canArcaneSplit) {
    return { error: 'Arcane split requires a single-target non-self card with a valid second target.' };
  }
  const effectivePrimaryTargets = canArcaneSplit ? [primaryTarget, arcaneSplitTarget] : primaryTargets;

  const secondaryTargetId = String(body.secondaryTargetId || '').trim();
  const secondaryTarget = secondaryTargetId ? findParticipant(secondaryTargetId) : null;
  const requiresTarget =
    targetMode !== 'all_others' &&
    !selfTarget &&
    !zoneCard &&
    ((isConstruct && (constructMode === 'damage' || constructMode === 'status') && card.constructAllowUntargetedDeploy !== true) ||
      (isConstruct && constructTargetRequired) ||
      (!isConstruct &&
        (rawDamage > 0 ||
          shieldRestoreTotal > 0 ||
          healTotal > 0 ||
          Boolean(statusApply) ||
          pushDistance > 0 ||
          pullDistance > 0 ||
          nextAttackGrant > 0 ||
          targetApNextTurnGrant > 0)));
  if (requiresTarget && !primaryTargets.length) return { error: 'Target is required for this card effect' };
  if (
    isConstruct &&
    (constructMode === 'damage' || constructMode === 'status') &&
    card.constructAllowUntargetedDeploy !== true &&
    !primaryTarget
  ) {
    return { error: 'Target is required to deploy this construct' };
  }
  if (targetId && !target) {
    return { error: 'Target not found' };
  }
  if (!allowSelfTarget && !selfTarget && primaryTargets.some((entry) => entry.id === participant.id)) {
    return { error: 'This card cannot target self' };
  }
  if (card.targetAlliesOnly === true) {
    const invalidTarget = primaryTargets.find((entry) => !isParticipantAlly(participant, entry));
    if (invalidTarget) {
      return { error: `${card.name} can only target allies.` };
    }
  }
  if (secondaryTargetId && !secondaryTarget) {
    return { error: 'Secondary target not found' };
  }
  if (secondaryTarget && secondaryTarget.id === participant.id) {
    return { error: 'Secondary target cannot be self' };
  }
  if (secondaryTargetMode === 'adjacent' && secondaryTarget && primaryTarget && secondaryTarget.id === primaryTarget.id) {
    return { error: 'Secondary target must be different from the primary target' };
  }
  if (zoneCard) {
    participant.zones = normalizeZones(participant.zones, participant.id);
    if (participant.zones.length >= MAX_ACTIVE_ZONES) {
      return { error: `You can only have ${MAX_ACTIVE_ZONES} active zones at once.` };
    }
  }

  participant.apCurrent = Math.max(0, participant.apCurrent - apCost);

  let damageResult = null;
  const damageResults = [];
  let constructDeployResult = null;
  let zoneDeployResult = null;
  const shadowBleedTargets = [];
  const splitDamage = canArcaneSplit && rawDamage > 0 ? splitAmountBetweenTwo(rawDamage) : null;
  const splitShieldRestore = canArcaneSplit && shieldRestoreTotal > 0 ? splitAmountBetweenTwo(shieldRestoreTotal) : null;
  const splitHealing = canArcaneSplit && healTotal > 0 ? splitAmountBetweenTwo(healTotal) : null;
  const hasStructuredCardEffect =
    isConstruct ||
    zoneCard ||
    rawDamage > 0 ||
    secondaryRawDamage > 0 ||
    shieldRestoreTotal > 0 ||
    healTotal > 0 ||
    moveDistance > 0 ||
    pushDistance > 0 ||
    pullDistance > 0 ||
    Boolean(statusApply) ||
    nextAttackGrant > 0 ||
    targetApNextTurnGrant > 0 ||
    apGainNow > 0 ||
    removeStatusCount > 0;
  const demonicStatusProc = Boolean(statusApply) && ['bleeding', 'poisoned', 'burning'].includes(statusApply?.id);
  const addDamageResult = (damageTarget, amount, type, source = 'primary', options = {}) => {
    if (!damageTarget || amount <= 0) return;
    const shieldConditionalBonus = Math.max(0, Number(options.bonusIfTargetHasShield || 0));
    const directHpOnFullyBlocked = Math.max(0, Number(options.directHpOnFullyBlocked || 0));
    const bleedingBefore = getStatusStacks(damageTarget, 'bleeding');
    const hadStatusesBefore = Array.isArray(damageTarget.statuses) && damageTarget.statuses.length > 0;
    let setDamageBonus = 0;
    if (hasBeast5 && bleedingBefore > 0 && isParticipantEnemy(participant, damageTarget)) {
      setDamageBonus += 2;
    }
    if (hasShadow3 && isParticipantEnemy(participant, damageTarget) && !hasParticipantActedThisRound(damageTarget)) {
      setDamageBonus += 2;
    }
    const hasShadowFinisherDebuff = hasShadow7 && targetHasShadowFinisherDebuff(damageTarget) && isParticipantEnemy(participant, damageTarget);
    if (hasShadowFinisherDebuff) {
      setDamageBonus += 3;
    }
    if (hasElemental5 && isElementalAttack && targetIsInsideAnyZone(damageTarget.id) && isParticipantEnemy(participant, damageTarget)) {
      setDamageBonus += 2;
    }
    if (hasDemonic3 && demonicStatusProc) {
      setDamageBonus += 2;
    }
    let appliedAmount = Math.max(0, Number(amount || 0));
    let shieldBonusApplied = 0;
    if (setDamageBonus > 0) {
      appliedAmount += setDamageBonus;
    }
    if (shieldConditionalBonus > 0 && damageTarget.shield > 0) {
      appliedAmount += shieldConditionalBonus;
      shieldBonusApplied = shieldConditionalBonus;
    }
    const result = applyCardDamageWithType(damageTarget, appliedAmount, type);
    result.shieldBonusDamage = shieldBonusApplied;
    result.setBonusDamage = setDamageBonus;
    result.bleedingBefore = bleedingBefore;
    result.hadStatusesBefore = hadStatusesBefore;
    result.directHpDamage = 0;
    if (directHpOnFullyBlocked > 0 && result.shieldBefore > 0 && damageTarget.shield > 0) {
      const hpBypass = Math.min(damageTarget.hp, directHpOnFullyBlocked);
      if (hpBypass > 0) {
        damageTarget.hp = Math.max(0, damageTarget.hp - hpBypass);
        result.directHpDamage = hpBypass;
        result.hpDamage += hpBypass;
        result.finalDamage += hpBypass;
        result.hpAfter = damageTarget.hp;
      }
    }
    if (!damageResult) {
      damageResult = result;
    }
    damageResults.push({
      target: damageTarget,
      result,
      damageType: type,
      source
    });
    if (hasShadowFinisherDebuff) {
      addStatusStacks(damageTarget, 'bleeding', 1);
      enforceControlHierarchy(damageTarget);
      shadowBleedTargets.push(damageTarget.name);
    }
  };
  const others = trackerState.encounter.participants.filter((entry) => entry.id !== participant.id);
  if (!isConstruct && apGainNow > 0) {
    participant.apCurrent = Math.max(0, participant.apCurrent + apGainNow);
    notes.push(`Gains +${apGainNow} AP this turn.`);
  }
  if (isConstruct) {
    constructDeployResult = deployConstructFromCard(participant, card, {
      targetId: primaryTarget?.id || null,
      baseDamage,
      damageType,
      bonusDamage: constructDamageBonus,
      durationBonusTurns: constructDurationBonus,
      mode: constructMode,
      statusId: constructStatusId,
      statusName: constructStatusName,
      statusStacks: constructStatusStacks,
      shieldRestore: constructShieldRestore,
      shieldRestoreAlliesOnly: constructShieldRestoreAlliesOnly,
      heal: constructHeal,
      healAlliesOnly: constructHealAlliesOnly,
      healTargetOnly: constructHealTargetOnly,
      triggerOnTargetTurn: constructTriggerOnTargetTurn,
      maxHpCasterConBonus: constructMaxHpCasterConBonus,
      auraRadiusFt: constructAuraRadiusFt,
      detectDc: constructDetectDc,
      visionRangeFt: constructVisionRangeFt,
      utilityKind: constructUtilityKind,
      utilityNote: constructUtilityNote
    });
    notes.push(
      `Deploys ${constructDeployResult.construct.name} (${describeConstructSummary(constructDeployResult.construct)}, ${constructDeployResult.construct.remainingTurns} turn${constructDeployResult.construct.remainingTurns === 1 ? '' : 's'}).`
    );
    if (constructDeployResult.displaced.length) {
      const displacedNames = constructDeployResult.displaced.map((entry) => entry.name).join(', ');
      notes.push(`Replaced construct slot: ${displacedNames}.`);
    }
  } else if (zoneCard) {
    zoneDeployResult = deployZoneFromCard(participant, card, {
      masteryLevel,
      damage: zoneTickDamage,
      damageType,
      targetIds: effectivePrimaryTargets.map((entry) => entry.id),
      radiusBonusFt: arcaneModifiedCard?.mode === 'radius' ? 5 : 0,
      tickOnTurn: zoneTickOnTurn,
      statusApply: zoneStatusApply,
      triggerOnTargetAdd: zoneTriggerOnTargetAdd,
      consumeOnTrigger: zoneConsumeOnTrigger,
      enterDamage: zoneEnterDamage,
      enterDamageType: damageType || card.damageType || '',
      enterStatusApply: zoneEnterStatusApply,
      detectDc: zoneDetectDc,
      triggerMode: zoneTriggerMode,
      shieldRestore: zoneShieldRestore,
      heal: zoneHeal,
      damageEnemiesOnly: zoneDamageEnemiesOnly,
      shieldRestoreAlliesOnly: zoneShieldRestoreAlliesOnly,
      healAlliesOnly: zoneHealAlliesOnly
    });
    const zone = zoneDeployResult.zone;
    const durationText =
      zone.remainingTurns > 0
        ? `${zone.remainingTurns} turn${zone.remainingTurns === 1 ? '' : 's'}`
        : 'until removed';
    const triggerParts = [];
    if (zone.triggerOnTargetAdd) {
      triggerParts.push(zone.triggerMode ? zone.triggerMode.replace(/_/g, ' ') : 'on target add');
    }
    if (zone.detectDc > 0) {
      triggerParts.push(`detect DC ${zone.detectDc}`);
    }
    if (zone.shieldRestore > 0) {
      triggerParts.push(`restores ${zone.shieldRestore} Shield${zone.shieldRestoreAlliesOnly ? ' (allies)' : ''}`);
    }
    if (zone.heal > 0) {
      triggerParts.push(`restores ${zone.heal} HP${zone.healAlliesOnly ? ' (allies)' : ''}`);
    }
    const triggerText = triggerParts.length ? `, ${triggerParts.join(', ')}` : '';
    const targetText = zone.targetIds.length ? ` Targets: ${zone.targetIds.length}.` : '';
    notes.push(
      `Creates zone ${zone.name} (${zone.radiusFt} ft radius, ${zone.damage} ${zone.damageType || 'damage'}, ${durationText}${triggerText}).${targetText}`
    );
  } else {
    if (rawDamage > 0) {
      for (const [index, damageTarget] of effectivePrimaryTargets.entries()) {
        const amount = splitDamage ? splitDamage[index] : rawDamage;
        addDamageResult(damageTarget, amount, damageType, 'primary', {
          bonusIfTargetHasShield: conditionalShieldDamageBonus,
          directHpOnFullyBlocked: fullyBlockedHpDamage
        });
      }
    }

    if (secondaryRawDamage > 0) {
      let secondaryTargets = [];
      if (secondaryTargetMode === 'same') {
        secondaryTargets = effectivePrimaryTargets;
      } else if (secondaryTargetMode === 'adjacent') {
        if (secondaryTarget && (!primaryTarget || secondaryTarget.id !== primaryTarget.id)) {
          secondaryTargets = [secondaryTarget];
        }
      } else if (secondaryTarget) {
        secondaryTargets = [secondaryTarget];
      }
      if (secondaryTargetMode === 'adjacent' && !['all_others', 'multi_select'].includes(targetMode) && !secondaryTargets.length) {
        notes.push('No adjacent secondary target selected.');
      }
      for (const splashTarget of secondaryTargets) {
        addDamageResult(splashTarget, secondaryRawDamage, secondaryDamageType, 'secondary');
      }
    }
  }

  if (!isConstruct && nextAttackBonus > 0 && damageResults.length) {
    participant.nextAttackDamageBonus = 0;
    notes.push(`Consumes +${nextAttackBonus} next-attack damage bonus.`);
  }

  if (shadowBleedTargets.length) {
    notes.push(`Shadow finisher applies Bleeding 1 to ${Array.from(new Set(shadowBleedTargets)).join(', ')}.`);
  }

  if (hasBeast10 && !beast.bleedAttackApUsedTurn) {
    const proc = damageResults.some(
      (entry) => entry.result.bleedingBefore > 0 && isParticipantEnemy(participant, entry.target)
    );
    if (proc) {
      participant.apCurrent += 1;
      beast.bleedAttackApUsedTurn = true;
      notes.push('Beast set grants +1 AP for attacking a Bleeding enemy.');
    }
  }
  if (hasDemonic5 && !demonic.statusHealUsedTurn) {
    const proc = damageResults.some(
      (entry) => entry.result.hadStatusesBefore && isParticipantEnemy(participant, entry.target)
    );
    if (proc) {
      const beforeHp = participant.hp;
      participant.hp = Math.min(participant.maxHp, participant.hp + 2);
      const healed = participant.hp - beforeHp;
      demonic.statusHealUsedTurn = true;
      if (healed > 0) {
        notes.push(`Demonic set restores ${healed} HP.`);
      }
    }
  }
  if (hasDemonic10 && !demonic.nearbyKillApUsedTurn) {
    const proc = damageResults.some(
      (entry) => entry.result.hpBefore > 0 && entry.target.hp <= 0 && isParticipantEnemy(participant, entry.target)
    );
    if (proc) {
      participant.apCurrent += 1;
      demonic.nearbyKillApUsedTurn = true;
      notes.push('Demonic set grants +1 AP for a nearby kill.');
    }
  }

  if (!isConstruct && shieldRestoreTotal > 0) {
    const shieldTarget = selfTarget
      ? participant
      : targetMode === 'all_others'
        ? null
        : primaryTarget || participant;
    if (targetMode === 'all_others' || targetMode === 'multi_select') {
      const recipients = targetMode === 'all_others' ? others : effectivePrimaryTargets;
      const restoredTargets = [];
      recipients.forEach((entry) => {
        const beforeShield = entry.shield;
        entry.shield = Math.min(entry.maxShield, entry.shield + shieldRestoreTotal);
        const restored = entry.shield - beforeShield;
        if (restored > 0) {
          restoredTargets.push(`${entry.name} (+${restored})`);
        }
      });
      if (restoredTargets.length) {
        notes.push(`Restores Shield to ${restoredTargets.join(', ')}.`);
      }
    } else if (splitShieldRestore && effectivePrimaryTargets.length === 2) {
      const restoredTargets = [];
      effectivePrimaryTargets.forEach((entry, index) => {
        const beforeShield = entry.shield;
        entry.shield = Math.min(entry.maxShield, entry.shield + splitShieldRestore[index]);
        const restored = entry.shield - beforeShield;
        if (restored > 0) restoredTargets.push(`${entry.name} (+${restored})`);
      });
      if (restoredTargets.length) {
        notes.push(`Arcane split restores Shield to ${restoredTargets.join(', ')}.`);
      }
    } else if (shieldTarget) {
      const beforeShield = shieldTarget.shield;
      shieldTarget.shield = Math.min(shieldTarget.maxShield, shieldTarget.shield + shieldRestoreTotal);
      const restored = shieldTarget.shield - beforeShield;
      notes.push(`Restores ${restored} Shield${shieldTarget.id === participant.id ? '' : ` to ${shieldTarget.name}`}.`);
    }
  }

  if (!isConstruct && healTotal > 0) {
    const healTarget = selfTarget
      ? participant
      : targetMode === 'all_others'
        ? null
        : primaryTarget || participant;
    const healedAllies = [];
    if (targetMode === 'all_others' || targetMode === 'multi_select') {
      const recipients = targetMode === 'all_others' ? others : effectivePrimaryTargets;
      const healedTargets = [];
      recipients.forEach((entry) => {
        const beforeHp = entry.hp;
        entry.hp = Math.min(entry.maxHp, entry.hp + healTotal);
        const healed = entry.hp - beforeHp;
        if (healed > 0) {
          healedTargets.push(`${entry.name} (+${healed})`);
          if (isParticipantAlly(participant, entry)) {
            healedAllies.push(entry);
          }
        }
      });
      if (healedTargets.length) {
        notes.push(`Restores HP to ${healedTargets.join(', ')}.`);
      }
    } else if (splitHealing && effectivePrimaryTargets.length === 2) {
      const healedTargets = [];
      effectivePrimaryTargets.forEach((entry, index) => {
        const beforeHp = entry.hp;
        entry.hp = Math.min(entry.maxHp, entry.hp + splitHealing[index]);
        const healed = entry.hp - beforeHp;
        if (healed > 0) {
          healedTargets.push(`${entry.name} (+${healed})`);
          if (isParticipantAlly(participant, entry)) {
            healedAllies.push(entry);
          }
        }
      });
      if (healedTargets.length) {
        notes.push(`Arcane split restores HP to ${healedTargets.join(', ')}.`);
      }
    } else if (healTarget) {
      const beforeHp = healTarget.hp;
      healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + healTotal);
      const healed = healTarget.hp - beforeHp;
      notes.push(`Restores ${healed} HP${healTarget.id === participant.id ? '' : ` to ${healTarget.name}`}.`);
      if (healed > 0 && isParticipantAlly(participant, healTarget)) {
        healedAllies.push(healTarget);
      }
    }
    if (healedAllies.length && hasDivine3) {
      const shieldRecipients = [];
      for (const ally of healedAllies) {
        const beforeShield = ally.shield;
        ally.shield = Math.min(ally.maxShield, ally.shield + 2);
        const granted = ally.shield - beforeShield;
        if (granted > 0) {
          shieldRecipients.push(`${ally.name} (+${granted})`);
        }
      }
      if (shieldRecipients.length) {
        notes.push(`Divine set grants Shield to ${shieldRecipients.join(', ')}.`);
      }
    }
    if (healedAllies.length && hasNature10 && !nature.cleanseUsedTurn) {
      const cleanseTarget = healedAllies.find((entry) => (entry.statuses || []).length > 0);
      if (cleanseTarget) {
        const removed = clearOneStatusEffect(cleanseTarget);
        if (removed) {
          nature.cleanseUsedTurn = true;
          notes.push(`Nature set removes ${removed} from ${cleanseTarget.name}.`);
        }
      }
    }
  }

  if (!isConstruct && removeStatusCount > 0) {
    const cleanseTargets =
      targetMode === 'all_others'
        ? others
        : targetMode === 'multi_select'
          ? effectivePrimaryTargets
          : selfTarget
            ? [participant]
            : primaryTarget
              ? [primaryTarget]
              : [participant];
    const cleanseSummaries = [];
    for (const statusTarget of cleanseTargets) {
      if (!statusTarget) continue;
      const removedStatuses = [];
      for (let index = 0; index < removeStatusCount; index += 1) {
        const removed = clearOneStatusEffect(statusTarget);
        if (!removed) break;
        removedStatuses.push(removed);
      }
      enforceControlHierarchy(statusTarget);
      if (removedStatuses.length) {
        cleanseSummaries.push(`${statusTarget.name} (${removedStatuses.join(', ')})`);
      }
    }
    if (cleanseSummaries.length) {
      notes.push(`Removes up to ${removeStatusCount} status effect(s): ${cleanseSummaries.join('; ')}.`);
    } else {
      notes.push('No removable status effects were found.');
    }
  }

  if (!isConstruct && targetApNextTurnGrant > 0) {
    const apTargets =
      targetMode === 'all_others'
        ? others
        : targetMode === 'multi_select'
          ? effectivePrimaryTargets
          : (primaryTarget ? [primaryTarget] : []);
    const queuedTargets = [];
    for (const entry of apTargets) {
      if (!entry) continue;
      entry.pendingApNextTurn = Math.max(
        0,
        Math.round(Number(entry.pendingApNextTurn || 0) + targetApNextTurnGrant)
      );
      queuedTargets.push(`${entry.name} (+${targetApNextTurnGrant} AP next turn)`);
    }
    if (queuedTargets.length) {
      notes.push(`Queues AP for next turn: ${queuedTargets.join(', ')}.`);
    }
  }

  if (!isConstruct && moveDistance > 0) {
    notes.push(`Moves ${moveDistance} ft.`);
    applyShadowMovementProgress(participant, moveDistance, notes);
  }
  if (!isConstruct && pushDistance > 0) {
    const pushTargets =
      targetMode === 'all_others'
        ? others
        : targetMode === 'multi_select'
          ? effectivePrimaryTargets
          : primaryTarget
            ? effectivePrimaryTargets
            : [];
    if (pushTargets.length === 1) {
      notes.push(`Pushes ${pushTargets[0].name} ${pushDistance} ft.`);
    } else if (pushTargets.length > 1) {
      notes.push(`Pushes ${pushTargets.length} targets ${pushDistance} ft.`);
    }
  }
  if (!isConstruct && pullDistance > 0) {
    const pullTargets =
      targetMode === 'all_others'
        ? others
        : targetMode === 'multi_select'
          ? effectivePrimaryTargets
          : primaryTarget
            ? effectivePrimaryTargets
            : [];
    if (pullTargets.length === 1) {
      notes.push(`Pulls ${pullTargets[0].name} ${pullDistance} ft.`);
    } else if (pullTargets.length > 1) {
      notes.push(`Pulls ${pullTargets.length} targets ${pullDistance} ft.`);
    }
  }
  if (cardUtilityNote) {
    notes.push(cardUtilityNote);
  } else if (effectTextNote && !hasStructuredCardEffect) {
    notes.push(effectTextNote);
  }

  if (!isConstruct && !zoneCard && statusApply) {
    const statusStacks = resolveStatusStacksForCard(statusApply, {
      hasBeast3,
      hasElemental3,
      beastRuntime: beast,
      elementalRuntime: elemental
    });
    const statusTargets =
      targetMode === 'all_others'
        ? others
        : targetMode === 'multi_select'
          ? effectivePrimaryTargets
        : selfTarget
          ? [participant]
          : primaryTarget
            ? effectivePrimaryTargets
            : [];
    if (statusTargets.length) {
      statusTargets.forEach((statusTarget) => {
        addStatusStacks(statusTarget, statusApply.id, statusStacks);
        enforceControlHierarchy(statusTarget);
      });
      const names = statusTargets.map((entry) => entry.name).join(', ');
      notes.push(`Applies ${statusDisplayName(statusApply.id)} ${statusStacks} to ${names}.`);
      if (hasElemental10 && !elemental.burstUsedTurn) {
        const burstTargets = Array.from(
          new Map(
            statusTargets
              .filter((entry) => entry.id !== participant.id)
              .map((entry) => [entry.id, entry])
          ).values()
        );
        if (burstTargets.length) {
          burstTargets.forEach((entry) => {
            addDamageResult(entry, 3, damageType || 'Elemental', 'elemental_burst');
          });
          notes.push(`Elemental burst hits ${burstTargets.length} target${burstTargets.length === 1 ? '' : 's'} for 3.`);
        }
        elemental.burstUsedTurn = true;
      }
    }
  }

  if (!isConstruct && nextAttackGrant > 0) {
    const recipients =
      targetMode === 'all_others'
        ? others
        : targetMode === 'multi_select'
          ? effectivePrimaryTargets
          : selfTarget
            ? [participant]
            : primaryTarget
              ? effectivePrimaryTargets
              : [];
    if (recipients.length) {
      recipients.forEach((entry) => {
        const currentBonus = Number(entry.nextAttackDamageBonus || 0);
        entry.nextAttackDamageBonus = Math.max(0, currentBonus + nextAttackGrant);
      });
      const names = recipients.map((entry) => entry.name).join(', ');
      notes.push(`Grants +${nextAttackGrant} damage to next attack for ${names}.`);
    }
  }

  if (hasSetBonus(participant, 'Machine', 5) && isMachineCard(card) && !machine.autoLoaderTriggeredTurn) {
    machine.autoLoaderPrimed = true;
    machine.autoLoaderTriggeredTurn = true;
    notes.push('Auto-Loader primed for your next Machine Attack this turn.');
  }
  if (canArcaneSplit) {
    arcane.splitUsedTurn = true;
    notes.push(`Arcane split applies this card to ${primaryTarget.name} and ${arcaneSplitTarget.name}.`);
  }
  if (hasShadow10 && damageResults.length && !shadow.postAttackMoveUsedTurn) {
    shadow.postAttackMoveUsedTurn = true;
    notes.push('Shadow set lets you move 10 ft after attacking.');
  }

  card.masteryUses = Math.max(0, Number(card.masteryUses || 0)) + 1;
  const thresholds = normalizeCardThresholds(card.masteryThresholds);
  const beforeLevel = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  let afterLevel = beforeLevel;
  if (card.masteryUses >= thresholds.level2) {
    afterLevel = Math.max(afterLevel, 2);
  }
  if (card.masteryUses >= thresholds.level3) {
    afterLevel = Math.max(afterLevel, 3);
  }
  card.masteryLevel = Math.max(1, Math.min(3, afterLevel));
  if (afterLevel > beforeLevel) {
    notes.push(`Mastery increased to Level ${afterLevel}.`);
  }

  if (chargesMax > 0) {
    card.chargesMax = chargesMax;
    card.chargesCurrent = Math.max(0, chargesCurrent - 1);
    notes.push(`Charges: ${card.chargesCurrent}/${chargesMax}.`);
  }

  markTurnActionTaken(participant);
  const noteText = notes.length ? ` ${notes.join(' ')}` : '';
  const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
  const damageText = damageResults.length
    ? ` ${damageResults
        .map((entry) => {
          const mitigation = entry.result.resisted && !entry.result.vulnerable
            ? ' [Resisted]'
            : entry.result.vulnerable && !entry.result.resisted
              ? ' [Vulnerable]'
              : '';
          const conditional =
            entry.result.shieldBonusDamage > 0
              ? ` [+${entry.result.shieldBonusDamage} vs Shield]`
              : '';
          const fullyBlocked =
            entry.result.directHpDamage > 0
              ? ` [Fully Blocked: +${entry.result.directHpDamage} direct HP]`
              : '';
          const setBonus = entry.result.setBonusDamage > 0 ? ` [+${entry.result.setBonusDamage} set bonus]` : '';
          const divineReverse = entry.result.preventedByDivine ? ' [Reversed by Divine]' : '';
          return `${entry.target.name} takes ${entry.result.finalDamage} ${entry.damageType || 'damage'} (${entry.result.shieldDamage} Shield, ${entry.result.hpDamage} HP).${mitigation}${conditional}${fullyBlocked}${setBonus}${divineReverse}`;
        })
        .join(' ')}`
    : '';
  const totalFinalDamage = damageResults.reduce((total, entry) => total + Number(entry.result.finalDamage || 0), 0);
  pushLog(`${participant.name} plays ${card.name} (${costText}).${damageText}${noteText}`, participant.id, {
    cardId: card.id,
    apCost,
    baseCost,
    targetId: primaryTarget?.id || null,
    targetIds: effectivePrimaryTargets.map((entry) => entry.id),
    secondaryTargetId: secondaryTarget?.id || null,
    arcaneSplitTargetId: arcaneSplitTarget?.id || null,
    targetMode,
    damageType,
    secondaryDamageType,
    rawDamage,
    secondaryRawDamage,
    finalDamage: totalFinalDamage,
    construct: constructDeployResult?.construct || null,
    zone: zoneDeployResult?.zone || null
  });
  touchState();
  broadcastState('card_action');
  return {
    participant,
    card,
    apCost,
    baseCost,
    target: primaryTarget,
    targets: effectivePrimaryTargets,
    secondaryTarget,
    damageResult,
    damageResults,
    construct: constructDeployResult?.construct || null,
    zone: zoneDeployResult?.zone || null
  };
}

function executeRemoveConstructAction(body) {
  return executeRemoveConstructActionForEncounter(body, {
    resolveActor,
    pushLog,
    touchState,
    broadcastState
  });
}

function executeRetargetConstructAction(body) {
  return executeRetargetConstructActionForEncounter(body, {
    resolveActor,
    findParticipant,
    pushLog,
    touchState,
    broadcastState
  });
}

function executeMoveConstructAction(body) {
  return executeMoveConstructActionForEncounter(body, {
    resolveActor,
    normalizeConstructs,
    pushLog,
    touchState,
    broadcastState
  });
}

function findZone(participant, zoneId) {
  if (!participant || !zoneId) return null;
  participant.zones = normalizeZones(participant.zones, participant.id);
  return findZoneInOwner(participant, String(zoneId || ''));
}

function executeAddZoneTargetAction(body) {
  const result = executeAddZoneTargetActionForEncounter(body, {
    resolveActor,
    findParticipant,
    findZone,
    pushLog,
    touchState,
    broadcastState
  });
  if (result?.error) {
    return result;
  }
  const triggerEvents = applyZoneTargetAddTriggers(result.participant, result.zone, result.target);
  if (triggerEvents.length) {
    triggerEvents.forEach((event) =>
      pushLog(event, result.participant.id, {
        zoneId: result.zone?.id || '',
        targetId: result.target?.id || ''
      })
    );
    touchState();
    broadcastState('zone_target_triggered');
  }
  return { ...result, triggerEvents };
}

function executeRemoveZoneTargetAction(body) {
  return executeRemoveZoneTargetActionForEncounter(body, {
    resolveActor,
    findParticipant,
    findZone,
    pushLog,
    touchState,
    broadcastState
  });
}

function executeAddSetAllyAction(body) {
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const targetId = String(body.targetId || '').trim();
  if (!targetId) {
    return { error: 'targetId is required' };
  }
  const target = findParticipant(targetId);
  if (!target) {
    return { error: 'Target not found' };
  }
  if (target.id === participant.id) {
    return { error: 'You cannot add yourself as an ally target' };
  }
  const runtime = ensureSetRuntime(participant);
  const current = new Set(runtime.allies.targetIds || []);
  current.add(target.id);
  runtime.allies.targetIds = Array.from(current);
  sanitizeSetAllyTargets(participant);
  recalculateParticipant(participant);
  pushLog(`${participant.name} adds ${target.name} as an ally target for set effects.`, participant.id, {
    targetId: target.id
  });
  touchState();
  broadcastState('set_allies_updated');
  return { participant, target, allies: getSetAllyTargets(participant) };
}

function executeRemoveSetAllyAction(body) {
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const targetId = String(body.targetId || '').trim();
  if (!targetId) {
    return { error: 'targetId is required' };
  }
  const runtime = ensureSetRuntime(participant);
  const before = runtime.allies.targetIds.length;
  runtime.allies.targetIds = runtime.allies.targetIds.filter((id) => String(id) !== targetId);
  sanitizeSetAllyTargets(participant);
  recalculateParticipant(participant);
  if (runtime.allies.targetIds.length === before) {
    return { error: 'Target was not assigned as an ally' };
  }
  const target = findParticipant(targetId);
  pushLog(`${participant.name} removes ${target?.name || 'a target'} from ally set targets.`, participant.id, {
    targetId
  });
  touchState();
  broadcastState('set_allies_updated');
  return { participant, targetId, allies: getSetAllyTargets(participant) };
}

function activateSetBonusAction(body) {
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const abilityId = String(body.abilityId || '').trim().toLowerCase();
  if (!abilityId) {
    return { error: 'abilityId is required' };
  }
  const runtime = ensureSetRuntime(participant);
  if (abilityId === 'arcane_7_temp_copy') {
    if (!hasSetBonus(participant, 'Arcane', 7)) {
      return { error: 'Arcane 7-piece bonus is required.' };
    }
    if (runtime.arcane.copyUsedEncounter) {
      return { error: 'Arcane copy has already been used this encounter.' };
    }
    const sourceCardId = String(body.cardId || '').trim();
    if (!sourceCardId) {
      return { error: 'cardId is required for Arcane copy.' };
    }
    const sourceCard = (participant.cards || []).find((card) => String(card.id) === sourceCardId);
    if (!sourceCard) {
      return { error: 'Selected card not found.' };
    }
    const activeCount = getActiveParticipantCards(participant).length;
    if (activeCount >= MAX_ACTIVE_CARDS) {
      return { error: `No open active-card slot. Max ${MAX_ACTIVE_CARDS}.` };
    }
    const copy = normalizeCards([{
      ...sourceCard,
      id: randomUUID(),
      name: `${sourceCard.name} (Arcane Copy)`,
      temporarySource: 'arcane_7_temp_copy',
      active: true,
      masteryUses: 0
    }])[0];
    participant.cards = normalizeCards([...(participant.cards || []), copy]);
    runtime.arcane.copyUsedEncounter = true;
    recalculateParticipant(participant);
    pushLog(`${participant.name} uses Arcane 7-piece to copy ${sourceCard.name}.`, participant.id, {
      abilityId,
      cardId: copy.id,
      sourceCardId
    });
    touchState();
    broadcastState('set_activate_arcane_copy');
    return { participant, card: copy };
  }
  if (abilityId === 'arcane_10_modify_card') {
    if (!hasSetBonus(participant, 'Arcane', 10)) {
      return { error: 'Arcane 10-piece bonus is required.' };
    }
    if (runtime.arcane.modifiedCard?.cardId) {
      return { error: 'Arcane 10-piece card modification is already set for this encounter.' };
    }
    const cardId = String(body.cardId || '').trim();
    const mode = String(body.mode || '').trim().toLowerCase();
    if (!cardId) {
      return { error: 'cardId is required.' };
    }
    if (!['range', 'radius', 'damage', 'ap'].includes(mode)) {
      return { error: 'mode must be one of: range, radius, damage, ap' };
    }
    const selectedCard = (participant.cards || []).find((card) => String(card.id) === cardId);
    if (!selectedCard) {
      return { error: 'Selected card not found.' };
    }
    runtime.arcane.modifiedCard = { cardId, mode };
    pushLog(`${participant.name} applies Arcane 10-piece modification (${mode}) to ${selectedCard.name}.`, participant.id, {
      abilityId,
      cardId,
      mode
    });
    touchState();
    broadcastState('set_activate_arcane_modify');
    return { participant, cardId, mode };
  }
  if (abilityId === 'divine_10_sacred_overcharge') {
    if (!hasSetBonus(participant, 'Divine', 10)) {
      return { error: 'Divine 10-piece bonus is required.' };
    }
    if (runtime.divine.sacredOverchargeUsed) {
      return { error: 'Sacred Overcharge is available once per long rest.' };
    }
    const allyIds = getSetAllyTargets(participant);
    const allies = allyIds.map((id) => findParticipant(id)).filter(Boolean);
    if (!allies.length) {
      return { error: 'No allies found. Assign team members or add ally targets before using Sacred Overcharge.' };
    }
    participant.hp = 0;
    participant.shield = 0;
    const affectedAllies = [];
    allies.forEach((ally) => {
      const allyRuntime = ensureSetRuntime(ally);
      allyRuntime.divine.overchargeMultiplier = Math.max(1.5, Number(allyRuntime.divine.overchargeMultiplier || 1));
      recalculateParticipant(ally);
      ally.hp = ally.maxHp;
      ally.shield = ally.maxShield;
      ally.apCurrent = ally.apMax;
      affectedAllies.push(ally.name);
    });
    runtime.divine.sacredOverchargeUsed = true;
    recalculateParticipant(participant);
    pushLog(
      `${participant.name} uses Sacred Overcharge on ${affectedAllies.join(', ')}, sacrificing all current HP and Shield.`,
      participant.id,
      { abilityId, allyIds }
    );
    touchState();
    broadcastState('set_activate_divine_overcharge');
    return { participant, allies };
  }
  if (abilityId === 'divine_5_cleanse_heal') {
    if (!hasSetBonus(participant, 'Divine', 5)) {
      return { error: 'Divine 5-piece bonus is required.' };
    }
    const targetId = String(body.targetId || '').trim();
    if (!targetId) {
      return { error: 'targetId is required.' };
    }
    const target = findParticipant(targetId);
    if (!target) {
      return { error: 'Target not found.' };
    }
    if (!isParticipantAlly(participant, target)) {
      return { error: 'Target must be one of your allies.' };
    }
    const removed = clearOneStatusEffect(target);
    if (!removed) {
      return { error: `${target.name} has no removable statuses.` };
    }
    const beforeHp = target.hp;
    target.hp = Math.min(target.maxHp, target.hp + 4);
    const healed = target.hp - beforeHp;
    enforceControlHierarchy(target);
    recalculateParticipant(target);
    pushLog(
      `${participant.name} uses Divine cleanse on ${target.name}, removing ${removed}${healed > 0 ? ` and restoring ${healed} HP` : ''}.`,
      participant.id,
      { abilityId, targetId: target.id }
    );
    touchState();
    broadcastState('set_activate_divine_cleanse');
    return { participant, target, removedStatus: removed, healed };
  }
  return { error: `No activation handler configured for ${abilityId}.` };
}

function executeCustomAction(body) {
  return executeCustomActionForEncounter(body, {
    resolveActor,
    markTurnActionTaken,
    pushLog,
    touchState,
    broadcastState
  });
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
    'mastery',
    'nextAttackDamageBonus',
    'pendingApNextTurn'
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
  if (typeof body.team === 'string') update.team = normalizeTeamName(body.team);
  if (typeof body.notes === 'string') update.notes = body.notes;
  if (Array.isArray(body.cards)) update.cards = normalizeCards(body.cards);
  if (Array.isArray(body.constructs)) update.constructs = normalizeConstructs(body.constructs, current.id);
  if (Array.isArray(body.zones)) update.zones = normalizeZones(body.zones, current.id);
  if (Array.isArray(body.tags)) update.tags = body.tags;
  if (Array.isArray(body.statuses)) update.statuses = body.statuses;
  if (Array.isArray(body.abilities)) {
    update.abilities = normalizeAbilityEntries(body.abilities);
  }
  if (Array.isArray(body.proficiencies)) {
    update.proficiencies = normalizeTextList(body.proficiencies);
  }
  if (Array.isArray(body.languages)) {
    update.languages = normalizeTextList(body.languages);
  }
  if (Array.isArray(body.inventory)) {
    update.inventory = normalizeInventoryEntries(body.inventory);
  }
  if (Array.isArray(body.currencies)) {
    update.currencies = normalizeCurrencyEntries(body.currencies);
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
  if (body.setRuntime && typeof body.setRuntime === 'object') {
    update.setRuntime = normalizeSetRuntime(body.setRuntime);
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
    team: normalizeTeamName(body.team),
    initiative: typeof body.initiative === 'number' ? body.initiative : 0,
    apMax,
    apCurrent: typeof body.apCurrent === 'number' ? body.apCurrent : apMax,
    hp: typeof body.hp === 'number' ? body.hp : maxHp,
    maxHp,
    shield: typeof body.shield === 'number' ? body.shield : maxShield,
    maxShield,
    mastery: typeof body.mastery === 'number' ? body.mastery : 1,
    cards: normalizeCards(body.cards),
    constructs: normalizeConstructs(body.constructs, id),
    zones: normalizeZones(body.zones, id),
    tags: Array.isArray(body.tags) ? body.tags : [],
    statuses: Array.isArray(body.statuses) ? body.statuses : [],
    abilities: normalizeAbilityEntries(body.abilities),
    proficiencies: normalizeTextList(body.proficiencies),
    languages: normalizeTextList(body.languages),
    inventory: normalizeInventoryEntries(body.inventory),
    currencies: normalizeCurrencyEntries(body.currencies),
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
    turnActionCount: Number.isFinite(Number(body.turnActionCount)) ? Math.max(0, Number(body.turnActionCount)) : 0,
    lastActedRound: Number.isFinite(Number(body.lastActedRound)) ? Number(body.lastActedRound) : 0,
    setRuntime: normalizeSetRuntime(body.setRuntime),
    guardUsedThisTurn: false,
    guardRestore: baseStats.guardRestore,
    damageBonus: baseStats.damageBonus,
    nextAttackDamageBonus: Number.isFinite(Number(body.nextAttackDamageBonus))
      ? Math.max(0, Math.round(Number(body.nextAttackDamageBonus)))
      : 0,
    pendingApNextTurn: Number.isFinite(Number(body.pendingApNextTurn))
      ? Math.max(0, Math.round(Number(body.pendingApNextTurn)))
      : 0,
    baseStats,
    derivedBonuses: {
      base: baseStats,
      totals: createZeroModifier(),
      cardModifiers: [],
      cardLoadout: {
        maxActive: MAX_ACTIVE_CARDS,
        active: 0,
        total: 0
      },
      setBonuses: [],
      machineConstructs: {
        maxActive: 1,
        damageBonus: 0,
        durationBonusTurns: 0
      }
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

function buildTurnEntries() {
  return buildTurnEntriesForEncounter(trackerState.encounter, normalizeZones);
}

function getTurnEntryKey(entry) {
  return getTurnEntryKeyForEncounter(entry);
}

function setCurrentTurnByIndex(entries, index) {
  return setCurrentTurnByIndexForEncounter(trackerState.encounter, entries, index);
}

function ensureCurrentIndex() {
  ensureCurrentIndexForEncounter(trackerState.encounter, normalizeZones);
}

function fixCurrentIndexAfterRemoval() {
  ensureCurrentIndex();
}

function resolveCurrentTurnIndexForAdvance(entries, direction = 1) {
  return resolveCurrentTurnIndexForAdvanceForEncounter(trackerState.encounter, entries, direction);
}

function advanceTurn(direction = 1) {
  const entries = buildTurnEntries();
  if (!entries.length) {
    trackerState.encounter.currentIndex = -1;
    trackerState.encounter.currentTurnKey = '';
    return;
  }
  const previousIndex = resolveCurrentTurnIndexForAdvance(entries, direction);
  const previousEntry = previousIndex >= 0 ? entries[previousIndex] : null;
  if (direction > 0 && previousEntry?.kind === 'participant') {
    const previousActor = findParticipant(previousEntry.participantId);
    if (previousActor) {
      const endEvents = applyEndOfTurnSetEffects(previousActor);
      endEvents.forEach((event) => pushLog(`${previousActor.name} ${event}`, previousActor.id));
    }
  }

  let nextIndex = 0;
  if (previousIndex === -1) {
    nextIndex = 0;
  } else {
    nextIndex = (previousIndex + direction + entries.length) % entries.length;
  }
  if (
    direction > 0 &&
    nextIndex === 0 &&
    previousIndex !== -1
  ) {
    trackerState.encounter.round += 1;
  }

  const entry = setCurrentTurnByIndex(entries, nextIndex);
  if (entry?.kind === 'zone') {
    const owner = findParticipant(entry.participantId);
    const zone = findZone(owner, entry.zoneId);
    if (owner && zone) {
      const zoneEvents = applyZoneTurnEffects(owner, zone);
      zoneEvents.forEach((event) => pushLog(event, owner.id, { zoneId: zone.id, zoneTurn: true }));
      pushLog(`It is now ${owner.name}'s zone effect: ${zone.name}.`, owner.id, {
        zoneId: zone.id,
        zoneTurn: true
      });
    }
  } else {
    const actor = entry ? findParticipant(entry.participantId) : null;
    if (actor) {
      const startEvents = resetTurn(actor, { applyStatusTick: direction > 0 });
      startEvents.forEach((event) => pushLog(`${actor.name} ${event}`, actor.id));
      pushLog(`It is now ${actor.name}'s turn (AP ${actor.apCurrent}).`, actor.id);
    }
  }
  touchState();
  broadcastState('turn_advanced');
}

function resetTurn(participant, options = {}) {
  participant.apCurrent = participant.apMax;
  participant.guardUsedThisTurn = false;
  participant.turnActionCount = 0;
  participant.lastActedRound = trackerState.encounter.round;
  resetSetTurnState(participant);
  const runtime = ensureSetRuntime(participant);
  const events = [];
  if (runtime.demonic.pendingNextTurnAp > 0) {
    const bonus = Math.max(0, Math.round(Number(runtime.demonic.pendingNextTurnAp || 0)));
    participant.apCurrent += bonus;
    runtime.demonic.pendingNextTurnAp = 0;
    if (bonus > 0) {
      events.push(`gains +${bonus} AP from Demonic momentum.`);
    }
  }
  if (Number(participant.pendingApNextTurn || 0) > 0) {
    const bonus = Math.max(0, Math.round(Number(participant.pendingApNextTurn || 0)));
    participant.apCurrent += bonus;
    participant.pendingApNextTurn = 0;
    if (bonus > 0) {
      events.push(`gains +${bonus} AP from queued ally support.`);
    }
  }
  if (options.applyStatusTick) {
    const statusEvents = applyStartOfTurnStatusEffects(participant);
    const constructEvents = applyConstructStartOfTurnEffects(participant);
    const incomingConstructEvents = applyIncomingConstructTurnEffects(participant);
    return [...events, ...statusEvents, ...constructEvents, ...incomingConstructEvents];
  }
  return events;
}

function clampParticipant(participant) {
  participant.apCurrent = clampNumber(participant.apCurrent, 0, participant.apMax);
  participant.hp = clampNumber(participant.hp, 0, participant.maxHp);
  participant.shield = clampNumber(participant.shield, 0, participant.maxShield);
}

function getCurrentTurnEntry() {
  return getCurrentTurnEntryForEncounter(trackerState.encounter, normalizeZones);
}

function getCurrentParticipant() {
  return getCurrentParticipantForEncounter(trackerState.encounter, normalizeZones);
}

function findParticipant(id) {
  return findParticipantInEncounter(trackerState.encounter, id);
}

function resolveActor(id) {
  if (id) {
    return findParticipant(id);
  }
  const entry = getCurrentTurnEntry();
  if (!entry) return null;
  return findParticipant(entry.participantId);
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

function applyShortRest(participant) {
  return applyShortRestForEncounter(participant, {
    detectStatusType,
    normalizeStatusToken,
    pushLog
  });
}

function applyLongRest(participant) {
  const result = applyLongRestForEncounter(participant, { pushLog });
  const runtime = ensureSetRuntime(participant);
  runtime.divine.sacredOverchargeUsed = false;
  runtime.divine.overchargeMultiplier = 1;
  return result;
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
  const runtime = ensureSetRuntime(participant);
  if (hasSetBonus(participant, 'Divine', 7) && !runtime.divine.reverseDamageUsedEncounter) {
    runtime.divine.reverseDamageUsedEncounter = true;
    return;
  }
  let totalDamageTaken = 0;
  if (type === 'burning') {
    const shieldHit = Math.min(participant.shield, amount);
    participant.shield -= shieldHit;
    const hpHit = amount - shieldHit;
    if (hpHit > 0) {
      participant.hp = Math.max(0, participant.hp - hpHit);
    }
    totalDamageTaken = shieldHit + hpHit;
  } else {
    const beforeHp = participant.hp;
    participant.hp = Math.max(0, participant.hp - amount);
    totalDamageTaken = beforeHp - participant.hp;
  }
  if (totalDamageTaken >= 5 && hasSetBonus(participant, 'Demonic', 7)) {
    if (!runtime.demonic.damageTakenApQueuedTurn) {
      runtime.demonic.damageTakenApQueuedTurn = true;
      runtime.demonic.pendingNextTurnAp += 1;
    }
  }
}

function triggerBeastBleedingRestore(victim) {
  for (const owner of trackerState.encounter.participants || []) {
    if (!owner || owner.id === victim.id) continue;
    if (!hasSetBonus(owner, 'Beast', 7)) continue;
    if (!isParticipantEnemy(owner, victim)) continue;
    const beforeShield = owner.shield;
    owner.shield = Math.min(owner.maxShield, owner.shield + 2);
    const restored = owner.shield - beforeShield;
    if (restored > 0) {
      pushLog(`${owner.name} restores ${restored} Shield from Beast set as Bleeding damages ${victim.name}.`, owner.id, {
        source: 'beast_7_bleed_restore_shield',
        targetId: victim.id
      });
    }
  }
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
    if (type === 'bleeding') {
      triggerBeastBleedingRestore(participant);
    }
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

function applyConstructStartOfTurnEffects(participant) {
  participant.constructs = normalizeConstructs(participant.constructs, participant.id);
  if (!participant.constructs.length) return [];
  const events = [];
  const nextConstructs = [];
  for (const construct of participant.constructs) {
    const refreshed = {
      ...construct,
      apCurrent: Math.max(0, Number(construct.apMax || 0))
    };
    const mode = normalizeConstructMode(refreshed.mode || refreshed.constructMode) || 'damage';
    const target = refreshed.targetId ? findParticipant(refreshed.targetId) : null;
    const triggerOnTargetTurn = refreshed.triggerOnTargetTurn === true;
    if (triggerOnTargetTurn && target && target.id !== participant.id) {
      nextConstructs.push(refreshed);
      continue;
    }
    if ((mode === 'damage' || mode === 'status') && !target) {
      events.push(`${refreshed.name} has no valid target this turn.`);
    } else if (mode === 'status' && target) {
      const stacks = Math.max(1, Number(refreshed.statusStacks || 1));
      const statusType = detectStatusType({
        presetId: refreshed.statusId,
        name: refreshed.statusName
      });
      if (statusType) {
        addStatusStacks(target, statusType, stacks);
        events.push(
          `${refreshed.name} applies ${statusDisplayName(statusType)} x${stacks} to ${target.name}.`
        );
      } else {
        const statusName = String(refreshed.statusName || refreshed.statusId || 'Status').trim();
        target.statuses = normalizeStatuses([...(target.statuses || []), {
          id: randomUUID(),
          presetId: String(refreshed.statusId || '').trim(),
          name: statusName,
          stacks,
          notes: 'Applied by construct.'
        }]);
        events.push(`${refreshed.name} applies ${statusName} x${stacks} to ${target.name}.`);
      }
      const forceDamage = Math.max(0, Number(refreshed.damage || 0));
      if (forceDamage > 0) {
        const result = applyCardDamageWithType(target, forceDamage, 'Force');
        const mitigation =
          result.resisted && !result.vulnerable
            ? ' [Resisted]'
            : result.vulnerable && !result.resisted
              ? ' [Vulnerable]'
              : '';
        events.push(
          `${refreshed.name} deals ${result.finalDamage} Force to ${target.name} (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}`
        );
      }
    } else if (mode === 'damage' && target) {
      const damage = Math.max(0, Number(refreshed.damage || 0));
      const damageType = String(refreshed.damageType || '').trim();
      if (damage > 0) {
        const result = applyCardDamageWithType(target, damage, damageType);
        const mitigation =
          result.resisted && !result.vulnerable
            ? ' [Resisted]'
            : result.vulnerable && !result.resisted
              ? ' [Vulnerable]'
              : '';
        events.push(
          `${refreshed.name} hits ${target.name} for ${result.finalDamage} ${damageType || 'damage'} (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}`
        );
      }
    } else if (mode === 'utility') {
      const shieldRestore = Math.max(0, Number(refreshed.shieldRestore || 0));
      const heal = Math.max(0, Number(refreshed.heal || 0));
      const auraRadiusFt = Math.max(0, Number(refreshed.auraRadiusFt || 0));
      const detectDc = Math.max(0, Number(refreshed.detectDc || 0));
      const visionRangeFt = Math.max(0, Number(refreshed.visionRangeFt || 0));
      const utilityKind = String(refreshed.utilityKind || '').trim().toLowerCase();
      const utilityNote = String(refreshed.utilityNote || '').trim();
      if (shieldRestore > 0) {
        const recipients = refreshed.shieldRestoreAlliesOnly
          ? (trackerState.encounter.participants || []).filter((entry) => isParticipantAlly(participant, entry))
          : [participant];
        const restoredTargets = [];
        for (const entry of recipients) {
          const beforeShield = entry.shield;
          entry.shield = Math.min(entry.maxShield, entry.shield + shieldRestore);
          const restored = entry.shield - beforeShield;
          if (restored > 0) {
            restoredTargets.push(`${entry.name} (+${restored})`);
          }
        }
        const auraText = auraRadiusFt > 0 ? ` within ${auraRadiusFt} ft` : '';
        if (restoredTargets.length) {
          events.push(`${refreshed.name} restores Shield${auraText} to ${restoredTargets.join(', ')}.`);
        } else {
          events.push(`${refreshed.name} pulses${auraText} but no Shield is restored.`);
        }
      } else if (heal > 0) {
        const recipients = refreshed.healTargetOnly && target
          ? [target]
          : refreshed.healAlliesOnly
            ? (trackerState.encounter.participants || []).filter((entry) => isParticipantAlly(participant, entry))
            : [participant];
        const healedTargets = [];
        for (const entry of recipients) {
          const beforeHp = entry.hp;
          entry.hp = Math.min(entry.maxHp, entry.hp + heal);
          const restored = entry.hp - beforeHp;
          if (restored > 0) {
            healedTargets.push(`${entry.name} (+${restored})`);
          }
        }
        if (healedTargets.length) {
          events.push(`${refreshed.name} restores HP to ${healedTargets.join(', ')}.`);
        } else {
          events.push(`${refreshed.name} pulses but no HP is restored.`);
        }
      } else if (utilityKind === 'scout') {
        const detailParts = [];
        if (visionRangeFt > 0) detailParts.push(`vision ${visionRangeFt} ft`);
        if (detectDc > 0) detailParts.push(`detect DC ${detectDc}`);
        if (utilityNote) detailParts.push(utilityNote);
        events.push(
          detailParts.length
            ? `${refreshed.name} relays scouting intel (${detailParts.join(', ')}).`
            : `${refreshed.name} relays scouting intel.`
        );
      } else if (utilityKind === 'factory') {
        events.push(
          utilityNote
            ? `${refreshed.name} coordinates war production (${utilityNote}).`
            : `${refreshed.name} coordinates war production.`
        );
      } else {
        events.push(`${refreshed.name} remains active.`);
      }
    }
    const remainingTurns = Math.max(0, Number(refreshed.remainingTurns || 0) - 1);
    if (remainingTurns > 0) {
      nextConstructs.push({ ...refreshed, remainingTurns });
    } else {
      events.push(`${refreshed.name} expires.`);
    }
  }
  participant.constructs = nextConstructs;
  return events;
}

function applyIncomingConstructTurnEffects(participant) {
  if (!participant) return [];
  const events = [];
  for (const owner of trackerState.encounter.participants || []) {
    if (!owner || owner.id === participant.id) continue;
    owner.constructs = normalizeConstructs(owner.constructs, owner.id);
    if (!owner.constructs.length) continue;
    const nextConstructs = [];
    for (const construct of owner.constructs) {
      const refreshed = {
        ...construct,
        apCurrent: Math.max(0, Number(construct.apCurrent ?? construct.apMax ?? 0))
      };
      const mode = normalizeConstructMode(refreshed.mode || refreshed.constructMode) || 'damage';
      const targetsThisTurn =
        refreshed.triggerOnTargetTurn === true &&
        String(refreshed.targetId || '') === participant.id;
      if (!targetsThisTurn) {
        nextConstructs.push(refreshed);
        continue;
      }
      if ((mode === 'damage' || mode === 'status') && !participant) {
        events.push(`${owner.name}'s ${refreshed.name} has no valid target this turn.`);
      } else if (mode === 'status') {
        const stacks = Math.max(1, Number(refreshed.statusStacks || 1));
        const statusType = detectStatusType({
          presetId: refreshed.statusId,
          name: refreshed.statusName
        });
        if (statusType) {
          addStatusStacks(participant, statusType, stacks);
          enforceControlHierarchy(participant);
          events.push(
            `${owner.name}'s ${refreshed.name} applies ${statusDisplayName(statusType)} x${stacks} to ${participant.name}.`
          );
        }
        const forceDamage = Math.max(0, Number(refreshed.damage || 0));
        if (forceDamage > 0) {
          const result = applyCardDamageWithType(participant, forceDamage, 'Force');
          const mitigation =
            result.resisted && !result.vulnerable
              ? ' [Resisted]'
              : result.vulnerable && !result.resisted
                ? ' [Vulnerable]'
                : '';
          events.push(
            `${owner.name}'s ${refreshed.name} deals ${result.finalDamage} Force to ${participant.name} (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}`
          );
        }
      } else if (mode === 'damage') {
        const damage = Math.max(0, Number(refreshed.damage || 0));
        const damageType = String(refreshed.damageType || '').trim();
        if (damage > 0) {
          const result = applyCardDamageWithType(participant, damage, damageType);
          const mitigation =
            result.resisted && !result.vulnerable
              ? ' [Resisted]'
              : result.vulnerable && !result.resisted
                ? ' [Vulnerable]'
                : '';
          events.push(
            `${owner.name}'s ${refreshed.name} hits ${participant.name} for ${result.finalDamage} ${damageType || 'damage'} (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}`
          );
        }
      } else if (mode === 'utility') {
        const shieldRestore = Math.max(0, Number(refreshed.shieldRestore || 0));
        const heal = Math.max(0, Number(refreshed.heal || 0));
        if (shieldRestore > 0) {
          const recipients = refreshed.shieldRestoreAlliesOnly
            ? [participant].filter((entry) => isParticipantAlly(owner, entry))
            : [participant];
          const restoredTargets = [];
          for (const entry of recipients) {
            const beforeShield = entry.shield;
            entry.shield = Math.min(entry.maxShield, entry.shield + shieldRestore);
            const restored = entry.shield - beforeShield;
            if (restored > 0) {
              restoredTargets.push(`${entry.name} (+${restored})`);
            }
          }
          if (restoredTargets.length) {
            events.push(`${owner.name}'s ${refreshed.name} restores Shield to ${restoredTargets.join(', ')}.`);
          }
        } else if (heal > 0) {
          const recipients = refreshed.healTargetOnly
            ? [participant]
            : refreshed.healAlliesOnly
              ? [participant].filter((entry) => isParticipantAlly(owner, entry))
              : [participant];
          const healedTargets = [];
          for (const entry of recipients) {
            const beforeHp = entry.hp;
            entry.hp = Math.min(entry.maxHp, entry.hp + heal);
            const restored = entry.hp - beforeHp;
            if (restored > 0) {
              healedTargets.push(`${entry.name} (+${restored})`);
            }
          }
          if (healedTargets.length) {
            events.push(`${owner.name}'s ${refreshed.name} restores HP to ${healedTargets.join(', ')}.`);
          }
        }
      }
      const remainingTurns = Math.max(0, Number(refreshed.remainingTurns || 0) - 1);
      if (remainingTurns > 0) {
        nextConstructs.push({ ...refreshed, remainingTurns });
      } else {
        events.push(`${owner.name}'s ${refreshed.name} expires.`);
      }
    }
    owner.constructs = nextConstructs;
    clampParticipant(owner);
  }
  clampParticipant(participant);
  return events;
}

function applyZoneTurnEffects(participant, zone) {
  if (!participant || !zone) return [];
  participant.zones = normalizeZones(participant.zones, participant.id);
  const entry = participant.zones.find((item) => String(item.id) === String(zone.id));
  if (!entry) return [`${participant.name}'s zone no longer exists.`];
  const tickOnTurn = entry.tickOnTurn !== false;
  const turnStatusType = detectStatusType({ presetId: entry.statusId, name: entry.statusName });
  const turnStatusStacks = Math.max(1, Number(entry.statusStacks || 1));
  const targets = (entry.targetIds || [])
    .map((id) => findParticipant(id))
    .filter(Boolean);
  if (!targets.length) {
    return [`${participant.name}'s zone ${entry.name} has no targets.`];
  }
  const events = [];
  const nature5 = hasSetBonus(participant, 'Nature', 5);
  const nature7 = hasSetBonus(participant, 'Nature', 7);
  const zoneShieldRestore = Math.max(0, Number(entry.shieldRestore || 0));
  const zoneHeal = Math.max(0, Number(entry.heal || 0));
  for (const target of targets) {
    const allied = isParticipantAlly(participant, target);
    const amount = Math.max(0, Number(entry.damage || 0));
    const canDamageTarget =
      tickOnTurn &&
      amount > 0 &&
      (!entry.damageEnemiesOnly || !allied) &&
      !(allied && nature5);
    if (!canDamageTarget) {
      if (tickOnTurn && allied && nature5 && amount > 0) {
        events.push(`${participant.name}'s zone ${entry.name} does not damage ally ${target.name}.`);
      } else if (tickOnTurn && amount > 0 && entry.damageEnemiesOnly && allied) {
        events.push(`${participant.name}'s zone ${entry.name} skips ally ${target.name}.`);
      }
      if (tickOnTurn || turnStatusType || zoneShieldRestore > 0 || zoneHeal > 0) {
        events.push(`${participant.name}'s zone ${entry.name} affects ${target.name}.`);
      }
    } else {
      const result = applyCardDamageWithType(target, amount, entry.damageType);
      const mitigation =
        result.resisted && !result.vulnerable
          ? ' [Resisted]'
          : result.vulnerable && !result.resisted
            ? ' [Vulnerable]'
            : '';
      events.push(
        `${participant.name}'s zone ${entry.name} hits ${target.name} for ${result.finalDamage} ${entry.damageType || 'damage'} (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}`
      );
    }
    if (tickOnTurn && turnStatusType && !(allied && nature5) && !(entry.damageEnemiesOnly && allied)) {
      addStatusStacks(target, turnStatusType, turnStatusStacks);
      enforceControlHierarchy(target);
      events.push(
        `${participant.name}'s zone ${entry.name} applies ${statusDisplayName(turnStatusType)} ${turnStatusStacks} to ${target.name}.`
      );
    }
    if (zoneShieldRestore > 0 && (!entry.shieldRestoreAlliesOnly || allied)) {
      const beforeShield = target.shield;
      target.shield = Math.min(target.maxShield, target.shield + zoneShieldRestore);
      const restored = target.shield - beforeShield;
      if (restored > 0) {
        events.push(`${participant.name}'s zone ${entry.name} restores ${restored} Shield to ${target.name}.`);
      }
    }
    if (zoneHeal > 0 && (!entry.healAlliesOnly || allied)) {
      const beforeHp = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + zoneHeal);
      const healed = target.hp - beforeHp;
      if (healed > 0) {
        events.push(`${participant.name}'s zone ${entry.name} restores ${healed} HP to ${target.name}.`);
      }
    }
    if (allied && nature7) {
      const beforeShield = target.shield;
      target.shield = Math.min(target.maxShield, target.shield + 4);
      const restored = target.shield - beforeShield;
      if (restored > 0) {
        events.push(`${participant.name}'s Nature set restores ${restored} Shield to ${target.name} inside ${entry.name}.`);
      }
    }
  }
  if (Number(entry.remainingTurns || 0) > 0) {
    entry.remainingTurns = Math.max(0, Number(entry.remainingTurns || 0) - 1);
    if (entry.remainingTurns <= 0) {
      participant.zones = participant.zones.filter((item) => String(item.id) !== String(entry.id));
      events.push(`${participant.name}'s zone ${entry.name} expires.`);
    }
  }
  clampParticipant(participant);
  return events;
}

function applyZoneTargetAddTriggers(participant, zone, target) {
  if (!participant || !zone || !target) return [];
  participant.zones = normalizeZones(participant.zones, participant.id);
  const entry = participant.zones.find((item) => String(item.id) === String(zone.id));
  if (!entry || entry.triggerOnTargetAdd !== true) return [];
  const events = [];
  const allied = isParticipantAlly(participant, target);
  const nature5 = hasSetBonus(participant, 'Nature', 5);
  const blockedByNature = allied && nature5;
  const enterDamage = Math.max(0, Number(entry.enterDamage || 0));
  if (enterDamage > 0 && !blockedByNature) {
    const result = applyCardDamageWithType(target, enterDamage, entry.enterDamageType || entry.damageType);
    const mitigation =
      result.resisted && !result.vulnerable
        ? ' [Resisted]'
        : result.vulnerable && !result.resisted
          ? ' [Vulnerable]'
          : '';
    events.push(
      `${participant.name}'s zone ${entry.name} triggers on ${target.name} for ${result.finalDamage} ${entry.enterDamageType || entry.damageType || 'damage'} (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}`
    );
  }
  const enterStatusType = detectStatusType({ presetId: entry.enterStatusId, name: entry.enterStatusName });
  const enterStatusStacks = Math.max(1, Number(entry.enterStatusStacks || 1));
  if (enterStatusType && !blockedByNature) {
    addStatusStacks(target, enterStatusType, enterStatusStacks);
    enforceControlHierarchy(target);
    events.push(
      `${participant.name}'s zone ${entry.name} applies ${statusDisplayName(enterStatusType)} ${enterStatusStacks} to ${target.name}.`
    );
  }
  if (blockedByNature && (enterDamage > 0 || enterStatusType)) {
    events.push(`${participant.name}'s zone ${entry.name} does not trigger on ally ${target.name}.`);
  }
  if (entry.consumeOnTrigger === true) {
    participant.zones = participant.zones.filter((item) => String(item.id) !== String(entry.id));
    events.push(`${participant.name}'s zone ${entry.name} is consumed on trigger.`);
  }
  clampParticipant(participant);
  clampParticipant(target);
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
  if (requestedPath === '/cards') {
    requestedPath = '/cards.html';
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

function normalizeTeamName(value) {
  return String(value || '').trim().slice(0, 32);
}

function normalizeTextList(list = []) {
  if (!Array.isArray(list)) return [];
  const normalized = [];
  const seen = new Set();
  for (const entry of list) {
    const value = String(entry || '').trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(value);
  }
  return normalized;
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

function getAbilityModifier(participant = {}, ability = '') {
  const key = String(ability || '').trim().toLowerCase();
  if (!ABILITY_KEYS.includes(key)) return 0;
  const score = Number(participant?.stats?.[key]);
  const safeScore = Number.isFinite(score) ? score : 10;
  return Math.floor((safeScore - 10) / 2);
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

function normalizeCardThresholds(value) {
  const source = value && typeof value === 'object' ? value : {};
  const level2Raw = Number(source.level2 ?? source.to2 ?? 25);
  const level2 = Number.isFinite(level2Raw) ? Math.max(1, Math.round(level2Raw)) : 25;
  const level3Raw = Number(source.level3 ?? source.to3 ?? 55);
  const level3Candidate = Number.isFinite(level3Raw) ? Math.round(level3Raw) : 55;
  const level3 = Math.max(level2 + 1, level3Candidate);
  return { level2, level3 };
}

function normalizeCardDamageByLevel(value, fallbackDamage = 0) {
  const base = Math.max(0, Number(fallbackDamage || 0));
  const source = value && typeof value === 'object' ? value : {};
  const level1 = Number.isFinite(Number(source[1] ?? source.level1))
    ? Math.max(0, Number(source[1] ?? source.level1))
    : base;
  const level2 = Number.isFinite(Number(source[2] ?? source.level2))
    ? Math.max(0, Number(source[2] ?? source.level2))
    : level1;
  const level3 = Number.isFinite(Number(source[3] ?? source.level3))
    ? Math.max(0, Number(source[3] ?? source.level3))
    : level2;
  return { 1: level1, 2: level2, 3: level3 };
}

function autoCardDamageType(card = {}) {
  if (card.damageType) return String(card.damageType).trim();
  const tags = Array.isArray(card.tags) ? card.tags : [];
  const candidates = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder'];
  for (const candidate of candidates) {
    if (tags.find((tag) => String(tag).toLowerCase() === candidate.toLowerCase())) {
      return candidate;
    }
  }
  return '';
}

function isConstructCard(card = {}) {
  if (card?.isConstruct === false) return false;
  if (card?.isZone === true) return false;
  if (card?.isConstruct === true) return true;
  const tags = Array.isArray(card?.tags) ? card.tags : [];
  return tags.some((tag) => {
    const token = String(tag || '').trim().toLowerCase();
    return token === 'construct' || token === 'turret';
  });
}

function isZoneCard(card = {}, level = 1) {
  if (card?.isZone === true) return true;
  const radius = getCardScaledValue(card.zoneRadiusByLevel, level, Number(card.zoneRadius || 0));
  if (Number(radius || 0) > 0) return true;
  if (Number(card.zoneDurationTurns || 0) > 0) return true;
  return false;
}

function normalizeConstructMode(value = '') {
  const token = String(value || '').trim().toLowerCase();
  if (token === 'damage' || token === 'status' || token === 'utility') return token;
  return '';
}

function detectConstructMode(card = {}, options = {}) {
  const explicit = normalizeConstructMode(card.constructMode);
  if (explicit) return explicit;
  if (options.infer === false) return '';
  const statusId = String(card.constructStatusId || '').trim();
  if (statusId) return 'status';
  const statusName = String(card.constructStatusName || '').trim();
  if (statusName) return 'status';
  const byLevel = normalizeCardDamageByLevel(card.masteryDamageByLevel, card.damage || card.baseDamage || 0);
  if (Number(byLevel[1] || 0) > 0 || Number(byLevel[2] || 0) > 0 || Number(byLevel[3] || 0) > 0) {
    return 'damage';
  }
  return 'utility';
}

function normalizeConstructs(list = [], ownerId = '') {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const name = String(entry.name || entry.title || '').trim();
      if (!name) return null;
      const damage = Number(entry.damage ?? entry.baseDamage ?? 0);
      const remainingTurns = Number(entry.remainingTurns ?? entry.turns ?? entry.duration ?? 1);
      const mode =
        normalizeConstructMode(entry.mode || entry.constructMode) ||
        (String(entry.statusId || entry.constructStatusId || entry.statusName || entry.constructStatusName || '').trim()
          ? 'status'
          : Number(entry.damage ?? entry.baseDamage ?? 0) > 0
            ? 'damage'
            : 'utility');
      const statusStacksRaw = Number(entry.statusStacks ?? entry.constructStatusStacks ?? 1);
      const maxHpRaw = Number(entry.maxHp ?? entry.constructMaxHp ?? entry.hp ?? 1);
      const maxHp = Number.isFinite(maxHpRaw) ? Math.max(1, Math.round(maxHpRaw)) : 1;
      const hpRaw = Number(entry.hp ?? entry.currentHp ?? maxHp);
      const hp = Number.isFinite(hpRaw) ? Math.max(0, Math.min(maxHp, Math.round(hpRaw))) : maxHp;
      const apMaxRaw = Number(entry.apMax ?? entry.constructAp ?? entry.ap ?? 2);
      const apMax = Number.isFinite(apMaxRaw) ? Math.max(0, Math.round(apMaxRaw)) : 0;
      const apCurrentRaw = Number(entry.apCurrent ?? entry.currentAp ?? apMax);
      const apCurrent = Number.isFinite(apCurrentRaw)
        ? Math.max(0, Math.min(apMax, Math.round(apCurrentRaw)))
        : apMax;
      const moveFtRaw = Number(entry.moveFt ?? entry.constructMoveFt ?? entry.constructMove ?? 10);
      const moveFt = Number.isFinite(moveFtRaw) ? Math.max(5, Math.round(moveFtRaw)) : 10;
      const cards = Array.isArray(entry.cards)
        ? entry.cards
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        : String(entry.cards || entry.constructCards || entry.constructLinkedCard || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
      return {
        id: entry.id || randomUUID(),
        ownerId: String(entry.ownerId || ownerId || '').trim(),
        sourceCardId: entry.sourceCardId || '',
        name,
        damage: Number.isFinite(damage) ? Math.max(0, Math.round(damage)) : 0,
        baseDamage: Number.isFinite(Number(entry.baseDamage))
          ? Math.max(0, Math.round(Number(entry.baseDamage)))
          : Number.isFinite(damage)
            ? Math.max(0, Math.round(damage))
            : 0,
        damageBonus: Number.isFinite(Number(entry.damageBonus))
          ? Math.max(0, Math.round(Number(entry.damageBonus)))
          : 0,
        damageType: String(entry.damageType || '').trim(),
        remainingTurns: Number.isFinite(remainingTurns) ? Math.max(1, Math.round(remainingTurns)) : 1,
        targetId: String(entry.targetId || '').trim(),
        mode,
        statusId: String(entry.statusId || entry.constructStatusId || '').trim(),
        statusName: String(entry.statusName || entry.constructStatusName || '').trim(),
        statusStacks: Number.isFinite(statusStacksRaw) ? Math.max(1, Math.round(statusStacksRaw)) : 1,
        shieldRestore: Number.isFinite(Number(entry.shieldRestore ?? entry.constructShieldRestore))
          ? Math.max(0, Math.round(Number(entry.shieldRestore ?? entry.constructShieldRestore)))
          : 0,
        shieldRestoreAlliesOnly: Boolean(entry.shieldRestoreAlliesOnly ?? entry.constructShieldRestoreAlliesOnly),
        heal: Number.isFinite(Number(entry.heal ?? entry.constructHeal))
          ? Math.max(0, Math.round(Number(entry.heal ?? entry.constructHeal)))
          : 0,
        healAlliesOnly: Boolean(entry.healAlliesOnly ?? entry.constructHealAlliesOnly),
        healTargetOnly: Boolean(entry.healTargetOnly ?? entry.constructHealTargetOnly),
        triggerOnTargetTurn: Boolean(entry.triggerOnTargetTurn ?? entry.constructTriggerOnTargetTurn),
        auraRadiusFt: Number.isFinite(Number(entry.auraRadiusFt ?? entry.constructAuraRadiusFt))
          ? Math.max(0, Math.round(Number(entry.auraRadiusFt ?? entry.constructAuraRadiusFt)))
          : 0,
        detectDc: Number.isFinite(Number(entry.detectDc ?? entry.constructDetectDc))
          ? Math.max(0, Math.round(Number(entry.detectDc ?? entry.constructDetectDc)))
          : 0,
        visionRangeFt: Number.isFinite(Number(entry.visionRangeFt ?? entry.constructVisionRangeFt))
          ? Math.max(0, Math.round(Number(entry.visionRangeFt ?? entry.constructVisionRangeFt)))
          : 0,
        utilityKind: String(entry.utilityKind ?? entry.constructUtilityKind ?? '').trim().toLowerCase(),
        utilityNote: String(entry.utilityNote ?? entry.constructUtilityNote ?? '').trim(),
        maxHp,
        hp,
        apMax,
        apCurrent,
        moveFt,
        cards,
        tags: Array.isArray(entry.tags)
          ? entry.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : [],
        createdAt: entry.createdAt || new Date().toISOString(),
        createdOrder: Number.isFinite(Number(entry.createdOrder))
          ? Number(entry.createdOrder)
          : index
      };
    })
    .filter(Boolean);
}

function normalizeZones(list = [], ownerId = '') {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const name = String(entry.name || entry.title || '').trim();
      if (!name) return null;
      const damage = Number(entry.damage ?? entry.baseDamage ?? 0);
      const radiusRaw = Number(entry.radiusFt ?? entry.radius ?? entry.zoneRadius ?? 0);
      const remainingRaw = Number(entry.remainingTurns ?? entry.durationTurns ?? entry.zoneDurationTurns ?? 0);
      return {
        id: entry.id || randomUUID(),
        ownerId: String(entry.ownerId || ownerId || '').trim(),
        sourceCardId: String(entry.sourceCardId || '').trim(),
        name,
        damage: Number.isFinite(damage) ? Math.max(0, Math.round(damage)) : 0,
        damageType: String(entry.damageType || '').trim(),
        radiusFt: Number.isFinite(radiusRaw) ? Math.max(0, Math.round(radiusRaw)) : 0,
        remainingTurns: Number.isFinite(remainingRaw) ? Math.max(0, Math.round(remainingRaw)) : 0,
        tickOnTurn: entry.tickOnTurn !== false,
        statusId: String(entry.statusId || '').trim(),
        statusName: String(entry.statusName || '').trim(),
        statusStacks: Number.isFinite(Number(entry.statusStacks))
          ? Math.max(1, Math.round(Number(entry.statusStacks)))
          : 1,
        triggerOnTargetAdd: entry.triggerOnTargetAdd === true,
        consumeOnTrigger: entry.consumeOnTrigger === true,
        enterDamage: Number.isFinite(Number(entry.enterDamage))
          ? Math.max(0, Math.round(Number(entry.enterDamage)))
          : 0,
        enterDamageType: String(entry.enterDamageType || entry.damageType || '').trim(),
        enterStatusId: String(entry.enterStatusId || '').trim(),
        enterStatusName: String(entry.enterStatusName || '').trim(),
        enterStatusStacks: Number.isFinite(Number(entry.enterStatusStacks))
          ? Math.max(1, Math.round(Number(entry.enterStatusStacks)))
          : 1,
        shieldRestore: Number.isFinite(Number(entry.shieldRestore ?? entry.zoneShieldRestore))
          ? Math.max(0, Math.round(Number(entry.shieldRestore ?? entry.zoneShieldRestore)))
          : 0,
        heal: Number.isFinite(Number(entry.heal ?? entry.zoneHeal))
          ? Math.max(0, Math.round(Number(entry.heal ?? entry.zoneHeal)))
          : 0,
        damageEnemiesOnly: Boolean(entry.damageEnemiesOnly ?? entry.zoneDamageEnemiesOnly),
        shieldRestoreAlliesOnly: entry.shieldRestoreAlliesOnly !== false,
        healAlliesOnly: entry.healAlliesOnly !== false,
        detectDc: Number.isFinite(Number(entry.detectDc ?? entry.zoneDetectDc))
          ? Math.max(0, Math.round(Number(entry.detectDc ?? entry.zoneDetectDc)))
          : 0,
        triggerMode: String(entry.triggerMode ?? entry.zoneTriggerMode ?? '').trim().toLowerCase(),
        targetIds: Array.isArray(entry.targetIds)
          ? Array.from(new Set(entry.targetIds.map((value) => String(value || '').trim()).filter(Boolean)))
          : [],
        tags: Array.isArray(entry.tags)
          ? entry.tags.map((value) => String(value || '').trim()).filter(Boolean)
          : [],
        createdAt: entry.createdAt || new Date().toISOString(),
        createdOrder: Number.isFinite(Number(entry.createdOrder))
          ? Number(entry.createdOrder)
          : index
      };
    })
    .filter(Boolean);
}

function normalizeCards(list = []) {
  if (!Array.isArray(list)) return [];
  const normalized = list
    .map((card, index) => {
      if (!card || typeof card !== 'object') return null;
      const thresholds = normalizeCardThresholds(card.masteryThresholds);
      const masteryUsesRaw = Number(card.masteryUses ?? card.uses ?? 0);
      const masteryUses = Number.isFinite(masteryUsesRaw) ? Math.max(0, Math.round(masteryUsesRaw)) : 0;
      const masteryLevelRaw = Number(card.masteryLevel ?? card.level ?? 1);
      let masteryLevel = Number.isFinite(masteryLevelRaw) ? Math.max(1, Math.min(3, Math.round(masteryLevelRaw))) : 1;
      const impliedLevel = masteryUses >= thresholds.level3 ? 3 : masteryUses >= thresholds.level2 ? 2 : 1;
      masteryLevel = Math.max(masteryLevel, impliedLevel);

      const damageRaw = Number(card.damage ?? card.baseDamage ?? 0);
      const damage = Number.isFinite(damageRaw) ? Math.max(0, Math.round(damageRaw)) : 0;
      const damageByLevel = normalizeCardDamageByLevel(card.masteryDamageByLevel, damage);
      const constructStatusStacksRaw = Number(
        card.constructStatusStacks ??
          card.statusStacks ??
          card.constructStacks ??
          1
      );
      const constructApRaw = Number(card.constructAp ?? card.constructApMax ?? card.ap ?? 2);
      const constructMaxHpRaw = Number(card.constructMaxHp ?? card.constructHp ?? card.hp ?? 1);
      const constructMoveFtRaw = Number(card.constructMoveFt ?? card.constructMove ?? 10);
      const cardChargesRaw = Number(card.chargesMax ?? card.maxCharges ?? card.charges ?? 0);
      const cardChargesMax = Number.isFinite(cardChargesRaw) ? Math.max(0, Math.round(cardChargesRaw)) : 0;
      const cardChargesCurrentRaw = Number(
        card.chargesCurrent ?? card.remainingCharges ?? cardChargesMax
      );
      const cardChargesCurrent =
        cardChargesMax > 0 && Number.isFinite(cardChargesCurrentRaw)
          ? Math.max(0, Math.min(cardChargesMax, Math.round(cardChargesCurrentRaw)))
          : 0;
      const tierName = String(card.tier || 'Common').trim() || 'Common';
      const explicitShieldSource = card.shieldBonus ?? card.bonusShield;
      const explicitShieldBonus =
        explicitShieldSource === '' || explicitShieldSource == null ? Number.NaN : Number(explicitShieldSource);
      const shieldBonus = Number.isFinite(explicitShieldBonus)
        ? explicitShieldBonus
        : getCardTierShieldBonus(tierName);
      const constructCards = Array.isArray(card.constructCards)
        ? card.constructCards
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        : String(card.constructCards || card.constructLinkedCard || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
      const constructCard = isConstructCard(card);

      return {
        ...card,
        id: card.id || randomUUID(),
        name: String(card.name || `Card ${index + 1}`).trim(),
        set: canonicalSetName(card.set),
        type: String(card.type || 'Attack').trim(),
        tier: tierName,
        active: card.active !== false,
        apCost: Number.isFinite(Number(card.apCost)) ? Number(card.apCost) : 0,
        range: Number.isFinite(Number(card.range)) ? Number(card.range) : 0,
        healthBonus: Number.isFinite(Number(card.healthBonus)) ? Number(card.healthBonus) : 0,
        shieldBonus,
        tags: Array.isArray(card.tags)
          ? card.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : String(card.tags || '')
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
        effect: String(card.effect || '').trim(),
        mastery: Array.isArray(card.mastery)
          ? card.mastery.map((line) => String(line).trim()).filter(Boolean)
          : String(card.mastery || '')
              .split(/\n|,/)
              .map((line) => line.trim())
              .filter(Boolean),
        fusion: String(card.fusion || '').trim(),
        modifiers: normalizeModifiers(card.modifiers || {}),
        damage,
        damageType: autoCardDamageType(card),
        isZone: card.isZone === true || isZoneCard(card, masteryLevel),
        zoneRadius: Number.isFinite(Number(card.zoneRadius)) ? Math.max(0, Math.round(Number(card.zoneRadius))) : 0,
        zoneRadiusByLevel:
          card.zoneRadiusByLevel && typeof card.zoneRadiusByLevel === 'object'
            ? { ...card.zoneRadiusByLevel }
            : null,
        zoneDurationTurns: Number.isFinite(Number(card.zoneDurationTurns))
          ? Math.max(0, Math.round(Number(card.zoneDurationTurns)))
          : 0,
        constructDurationTurns: Number.isFinite(Number(card.constructDurationTurns ?? card.constructDuration ?? card.durationTurns))
          ? Math.max(1, Math.round(Number(card.constructDurationTurns ?? card.constructDuration ?? card.durationTurns)))
          : 1,
        constructMode: detectConstructMode(card, { infer: constructCard }),
        constructStatusId: String(
          card.constructStatusId ?? card.statusId ?? card.constructStatus ?? ''
        ).trim(),
        constructStatusName: String(card.constructStatusName ?? card.statusName ?? '').trim(),
        constructStatusStacks: Number.isFinite(constructStatusStacksRaw)
          ? Math.max(1, Math.round(constructStatusStacksRaw))
          : 1,
        constructAp: Number.isFinite(constructApRaw) ? Math.max(0, Math.round(constructApRaw)) : 0,
        constructMaxHp: Number.isFinite(constructMaxHpRaw) ? Math.max(1, Math.round(constructMaxHpRaw)) : 1,
        constructMoveFt: Number.isFinite(constructMoveFtRaw) ? Math.max(5, Math.round(constructMoveFtRaw)) : 10,
        constructCards,
        constructLinkedCard: constructCards[0] || '',
        chargesMax: cardChargesMax,
        chargesCurrent: cardChargesCurrent,
        masteryLevel,
        masteryUses,
        masteryThresholds: thresholds,
        masteryDamageByLevel: damageByLevel
      };
    })
    .filter(Boolean);
  let activeCount = 0;
  for (const card of normalized) {
    if (card.active && activeCount < MAX_ACTIVE_CARDS) {
      card.active = true;
      activeCount += 1;
    } else {
      card.active = false;
    }
  }
  return normalized;
}

function getCardDamageAtCurrentMastery(card) {
  const level = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  const byLevel = normalizeCardDamageByLevel(card.masteryDamageByLevel, card.damage || 0);
  if (level >= 3) return byLevel[3];
  if (level >= 2) return byLevel[2];
  return byLevel[1];
}

function getCardSecondaryDamageAtCurrentMastery(card) {
  const level = Math.max(1, Math.min(3, Number(card.masteryLevel || 1)));
  const fallback = Number(card.secondaryDamage || 0);
  const value = getCardScaledValue(card.secondaryDamageByLevel, level, fallback);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function normalizeCardTargetMode(card = {}) {
  const token = String(card.targetMode || '').trim().toLowerCase();
  if (token === 'all_others' || token === 'all-targets') return 'all_others';
  if (token === 'multi' || token === 'multi_select' || token === 'multi_up_to_3' || token === 'up_to_3') {
    return 'multi_select';
  }
  return 'single';
}

function normalizeSecondaryTargetMode(card = {}) {
  const token = String(card.secondaryTargetMode || '').trim().toLowerCase();
  if (token === 'same' || token === 'adjacent') return token;
  return '';
}

function getCardMultiTargetCap(card = {}, level = 1) {
  const fallback = Number.isFinite(Number(card.multiTargetMax))
    ? Math.max(1, Math.round(Number(card.multiTargetMax)))
    : 3;
  const scaled = getCardScaledValue(card.multiTargetMaxByLevel, level, fallback);
  return Number.isFinite(Number(scaled)) ? Math.max(1, Math.round(Number(scaled))) : fallback;
}

function getCardScaledValue(source, level = 1, fallback = 0) {
  if (source == null) return fallback;
  const parsedLevel = Math.max(1, Math.min(3, Number(level || 1)));
  if (typeof source === 'number') return Number.isFinite(source) ? source : fallback;
  if (typeof source === 'string') {
    const parsed = Number(source);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  if (typeof source !== 'object') return fallback;
  const direct = Number(source[parsedLevel]);
  if (Number.isFinite(direct)) return direct;
  const named = Number(source[`level${parsedLevel}`]);
  if (Number.isFinite(named)) return named;
  const order = parsedLevel === 3 ? [3, 2, 1] : parsedLevel === 2 ? [2, 1, 3] : [1, 2, 3];
  for (const key of order) {
    const value = Number(source[key] ?? source[`level${key}`]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function normalizeStatusApplyConfig(source, level = 1) {
  if (!source || typeof source !== 'object') return null;
  const id = detectStatusType({ presetId: source.id, name: source.name });
  if (!id) return null;
  const stacks = Math.max(1, Math.round(getCardScaledValue(source.stacksByLevel, level, source.stacks ?? 1)));
  return { id, stacks };
}

function normalizeCardStatusApply(card = {}, level = 1) {
  return normalizeStatusApplyConfig(card.statusApply, level);
}

function isSelfTargetCard(card = {}, level = 1) {
  const rangeText = String(card.rangeText || '').trim().toLowerCase();
  if (rangeText === 'self') return true;
  const scaledRange = getCardScaledValue(card.rangeByLevel, level, Number(card.range || 0));
  return Number(scaledRange || 0) <= 0;
}

function getGlobalShieldRestoreBonus(participant = {}) {
  const base = Number(participant.baseStats?.guardRestore ?? DEFAULT_GUARD_RESTORE);
  const total = Number(participant.guardRestore ?? base);
  if (!Number.isFinite(base) || !Number.isFinite(total)) return 0;
  return Math.max(0, Math.round(total - base));
}

function hasDamageTypeEntry(list = [], type = '') {
  const target = String(type || '').trim().toLowerCase();
  if (!target) return false;
  return (list || []).some((entry) => String(entry || '').trim().toLowerCase() === target);
}

function applyCardDamageWithType(target, rawDamage, damageType = '') {
  const baseDamage = Math.max(0, Number(rawDamage || 0));
  const resisted = hasDamageTypeEntry(target.resistances, damageType);
  const vulnerable = hasDamageTypeEntry(target.vulnerabilities, damageType);
  let finalDamage = baseDamage;
  if (resisted && !vulnerable) {
    finalDamage = Math.floor(baseDamage / 2);
  } else if (vulnerable && !resisted) {
    finalDamage = baseDamage * 2;
  }
  let preventedByDivine = false;
  const runtime = ensureSetRuntime(target);
  if (finalDamage > 0 && hasSetBonus(target, 'Divine', 7) && !runtime.divine.reverseDamageUsedEncounter) {
    runtime.divine.reverseDamageUsedEncounter = true;
    finalDamage = 0;
    preventedByDivine = true;
  }
  const shieldBefore = target.shield;
  const hpBefore = target.hp;
  const shieldDamage = Math.min(target.shield, finalDamage);
  target.shield = Math.max(0, target.shield - shieldDamage);
  const hpDamage = Math.max(0, finalDamage - shieldDamage);
  target.hp = Math.max(0, target.hp - hpDamage);
  const totalDamageTaken = shieldDamage + hpDamage;
  if (totalDamageTaken >= 5 && hasSetBonus(target, 'Demonic', 7) && !runtime.demonic.damageTakenApQueuedTurn) {
    runtime.demonic.damageTakenApQueuedTurn = true;
    runtime.demonic.pendingNextTurnAp += 1;
  }
  return {
    baseDamage,
    finalDamage,
    shieldDamage,
    hpDamage,
    resisted,
    vulnerable,
    shieldBefore,
    hpBefore,
    preventedByDivine,
    totalDamageTaken,
    shieldAfter: target.shield,
    hpAfter: target.hp
  };
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

function normalizeInventoryEntries(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((entry, index) => {
      if (entry == null) return null;
      if (typeof entry === 'string') {
        const name = entry.trim();
        if (!name) return null;
        return {
          id: randomUUID(),
          name,
          quantity: 1,
          description: '',
          tags: []
        };
      }
      const name = String(entry.name || entry.title || '').trim();
      if (!name) return null;
      const quantityRaw = Number(entry.quantity ?? entry.qty ?? 1);
      const quantity = Number.isFinite(quantityRaw) ? Math.max(1, Math.round(quantityRaw)) : 1;
      const tags = Array.isArray(entry.tags)
        ? entry.tags.map((tag) => String(tag).trim()).filter(Boolean)
        : String(entry.tags || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
      return {
        id: entry.id || randomUUID(),
        name: name || `Item ${index + 1}`,
        quantity,
        description: String(entry.description || '').trim(),
        tags
      };
    })
    .filter(Boolean);
}

function normalizeCurrencyEntries(list) {
  if (!Array.isArray(list)) return [];
  const normalized = [];
  const seenByName = new Map();
  list.forEach((entry, index) => {
    if (entry == null) return;
    let name = '';
    let amountRaw = 0;
    if (typeof entry === 'string') {
      name = entry.trim();
      amountRaw = 0;
    } else if (typeof entry === 'object') {
      name = String(entry.name || entry.title || '').trim();
      amountRaw = Number(entry.amount ?? entry.value ?? entry.quantity ?? 0);
    }
    if (!name) return;
    const amount = Number.isFinite(amountRaw) ? Math.max(0, Math.round(amountRaw)) : 0;
    const key = name.toLowerCase();
    const existingIndex = seenByName.get(key);
    if (existingIndex != null) {
      normalized[existingIndex] = {
        ...normalized[existingIndex],
        amount
      };
      return;
    }
    normalized.push({
      id: entry?.id || randomUUID(),
      name: name || `Currency ${index + 1}`,
      amount
    });
    seenByName.set(key, normalized.length - 1);
  });
  return normalized;
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

function normalizeJournalTemplate(template, category) {
  if (!template || typeof template !== 'object') return null;
  if (category === 'quest') {
    const normalized = {
      narrative: String(template.narrative || template.hook || '').trim(),
      objectivePrimary: String(template.objectivePrimary || template.primaryObjective || '').trim(),
      objectiveSecondary: String(template.objectiveSecondary || template.secondaryObjective || '').trim(),
      difficulty: String(template.difficulty || '').trim(),
      rewardPrimary: String(template.rewardPrimary || template.primaryReward || '').trim(),
      rewardBonus: String(template.rewardBonus || template.bonusReward || '').trim(),
      failureCondition: String(template.failureCondition || '').trim()
    };
    if (Object.values(normalized).some(Boolean)) {
      return normalized;
    }
    return null;
  }
  if (category === 'achievement') {
    const normalized = {
      requirement: String(template.requirement || '').trim(),
      reward: String(template.reward || template.rewardPrimary || '').trim(),
      flavor: String(template.flavor || template.description || '').trim()
    };
    if (Object.values(normalized).some(Boolean)) {
      return normalized;
    }
    return null;
  }
  return null;
}

function buildJournalTemplateDescription(template, category) {
  if (!template || !category) return '';
  if (category === 'quest') {
    const lines = [];
    if (template.narrative) {
      lines.push(`Description: ${template.narrative}`);
    }
    const objectives = [template.objectivePrimary, template.objectiveSecondary].filter(Boolean);
    if (objectives.length) {
      lines.push(`Objectives: ${objectives.join(' | ')}`);
    }
    if (template.difficulty) {
      lines.push(`Difficulty: ${template.difficulty}`);
    }
    const rewards = [template.rewardPrimary, template.rewardBonus].filter(Boolean);
    if (rewards.length) {
      lines.push(`Rewards: ${rewards.join(' | ')}`);
    }
    if (template.failureCondition) {
      lines.push(`Failure: ${template.failureCondition}`);
    }
    return lines.join('\n');
  }
  if (category === 'achievement') {
    const lines = [];
    if (template.requirement) {
      lines.push(`Requirement: ${template.requirement}`);
    }
    if (template.reward) {
      lines.push(`Reward: ${template.reward}`);
    }
    if (template.flavor) {
      lines.push(`Description: ${template.flavor}`);
    }
    return lines.join('\n');
  }
  return '';
}

function createJournalEntry(body = {}, category, forcedId = null, fallbackIndex = 0) {
  const normalizedCategory = normalizeJournalCategory(category);
  const titleRaw =
    body.title ?? body.name ?? `${normalizedCategory === 'quest' ? 'Quest' : 'Achievement'} ${fallbackIndex + 1}`;
  const title =
    String(titleRaw).trim() || `${normalizedCategory === 'quest' ? 'Quest' : 'Achievement'} ${fallbackIndex + 1}`;
  const template = normalizeJournalTemplate(body.template, normalizedCategory);
  const descriptionRaw = body.description ?? body.text ?? body.details ?? '';
  const description =
    String(descriptionRaw).trim() || (template ? buildJournalTemplateDescription(template, normalizedCategory) : '');
  const acknowledged = Boolean(body.acknowledged);
  const createdAt = body.createdAt || new Date().toISOString();
  const base = {
    id: forcedId || body.id || randomUUID(),
    title,
    description,
    createdAt,
    acknowledged,
    acknowledgedAt: acknowledged ? body.acknowledgedAt || new Date().toISOString() : null
  };
  if (template) {
    base.template = template;
  }
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

function normalizeSetRuntime(runtime = {}) {
  const source = runtime && typeof runtime === 'object' ? runtime : {};
  const machine = source.machine && typeof source.machine === 'object' ? source.machine : {};
  const allies = source.allies && typeof source.allies === 'object' ? source.allies : {};
  const arcane = source.arcane && typeof source.arcane === 'object' ? source.arcane : {};
  const beast = source.beast && typeof source.beast === 'object' ? source.beast : {};
  const demonic = source.demonic && typeof source.demonic === 'object' ? source.demonic : {};
  const divine = source.divine && typeof source.divine === 'object' ? source.divine : {};
  const elemental = source.elemental && typeof source.elemental === 'object' ? source.elemental : {};
  const nature = source.nature && typeof source.nature === 'object' ? source.nature : {};
  const shadow = source.shadow && typeof source.shadow === 'object' ? source.shadow : {};
  return {
    machine: {
      autoLoaderPrimed: Boolean(machine.autoLoaderPrimed),
      autoLoaderTriggeredTurn: Boolean(machine.autoLoaderTriggeredTurn),
      autoLoaderDiscountUsedTurn: Boolean(machine.autoLoaderDiscountUsedTurn)
    },
    allies: {
      targetIds: normalizeIdList(allies.targetIds || divine.allyTargetIds || [])
    },
    arcane: {
      damageTypeShiftUsedTurn: Boolean(arcane.damageTypeShiftUsedTurn),
      splitUsedTurn: Boolean(arcane.splitUsedTurn),
      copyUsedEncounter: Boolean(arcane.copyUsedEncounter),
      modifiedCard:
        arcane.modifiedCard && typeof arcane.modifiedCard === 'object'
          ? {
              cardId: String(arcane.modifiedCard.cardId || '').trim(),
              mode: String(arcane.modifiedCard.mode || '').trim().toLowerCase()
            }
          : null
    },
    beast: {
      extraBleedUsedTurn: Boolean(beast.extraBleedUsedTurn),
      bleedAttackApUsedTurn: Boolean(beast.bleedAttackApUsedTurn)
    },
    demonic: {
      statusHealUsedTurn: Boolean(demonic.statusHealUsedTurn),
      damageTakenApQueuedTurn: Boolean(demonic.damageTakenApQueuedTurn),
      nearbyKillApUsedTurn: Boolean(demonic.nearbyKillApUsedTurn),
      pendingNextTurnAp: Math.max(0, Number(demonic.pendingNextTurnAp || 0))
    },
    divine: {
      reverseDamageUsedEncounter: Boolean(divine.reverseDamageUsedEncounter),
      sacredOverchargeUsed: Boolean(divine.sacredOverchargeUsed),
      overchargeMultiplier: Number.isFinite(Number(divine.overchargeMultiplier))
        ? Math.max(1, Number(divine.overchargeMultiplier))
        : 1
    },
    elemental: {
      extraStatusUsedTurn: Boolean(elemental.extraStatusUsedTurn),
      burstUsedTurn: Boolean(elemental.burstUsedTurn)
    },
    nature: {
      cleanseUsedTurn: Boolean(nature.cleanseUsedTurn)
    },
    shadow: {
      moveDistanceThisTurn: Math.max(0, Number(shadow.moveDistanceThisTurn || 0)),
      moveBonusGrantedTurn: Boolean(shadow.moveBonusGrantedTurn),
      postAttackMoveUsedTurn: Boolean(shadow.postAttackMoveUsedTurn)
    }
  };
}

function canonicalSetName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return SET_NAME_LOOKUP[raw.toLowerCase()] || raw;
}

function ensureSetRuntime(participant) {
  participant.setRuntime = normalizeSetRuntime(participant.setRuntime);
  sanitizeSetAllyTargets(participant);
  return participant.setRuntime;
}

function normalizeIdList(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
  const seen = new Set();
  const normalized = [];
  for (const entry of source) {
    const id = String(entry || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

function sanitizeSetAllyTargets(participant) {
  if (!participant) return [];
  const runtime = participant.setRuntime || normalizeSetRuntime();
  runtime.allies.targetIds = normalizeIdList(runtime.allies.targetIds).filter(
    (id) => id !== participant.id
  );
  participant.setRuntime = runtime;
  return runtime.allies.targetIds;
}

function getSetAllyTargets(participant) {
  const runtime = ensureSetRuntime(participant);
  const manual = runtime.allies.targetIds || [];
  const teamAllies = getTeamAllyTargets(participant);
  return normalizeIdList([...manual, ...teamAllies]);
}

function getTeamAllyTargets(participant) {
  if (!participant?.id) return [];
  const sourceTeam = normalizeTeamName(participant.team).toLowerCase();
  if (!sourceTeam) return [];
  const allies = [];
  for (const entry of trackerState.encounter.participants || []) {
    if (!entry || entry.id === participant.id) continue;
    if (normalizeTeamName(entry.team).toLowerCase() === sourceTeam) {
      allies.push(entry.id);
    }
  }
  return allies;
}

function isParticipantAlly(source, target) {
  if (!source || !target) return false;
  const targetId = typeof target === 'string' ? target : target.id;
  if (!targetId || targetId === source.id) return false;
  if (!findParticipant(targetId)) return false;
  const allyIds = getSetAllyTargets(source);
  return allyIds.includes(targetId);
}

function isParticipantEnemy(source, target) {
  if (!source || !target) return false;
  const targetId = typeof target === 'string' ? target : target.id;
  if (!targetId || targetId === source.id) return false;
  return !isParticipantAlly(source, targetId);
}

function hasParticipantActedThisRound(participant) {
  return Number(participant?.lastActedRound || 0) === Number(trackerState.encounter.round || 0);
}

function targetIsInsideAnyZone(targetId) {
  const id = String(targetId || '').trim();
  if (!id) return false;
  for (const owner of trackerState.encounter.participants || []) {
    owner.zones = normalizeZones(owner.zones, owner.id);
    for (const zone of owner.zones) {
      if ((zone.targetIds || []).includes(id)) {
        return true;
      }
    }
  }
  return false;
}

function targetHasShadowFinisherDebuff(target) {
  if (!target) return false;
  for (const status of target.statuses || []) {
    const type = detectStatusType(status);
    if (type && SHADOW_FINISHER_STATUS_TYPES.has(type)) {
      return true;
    }
  }
  return false;
}

function splitAmountBetweenTwo(amount) {
  const total = Math.max(0, Math.round(Number(amount || 0)));
  const first = Math.floor(total / 2);
  const second = total - first;
  return [first, second];
}

function normalizeDamageTypeOverride(value) {
  const token = String(value || '').trim();
  if (!token) return '';
  const lower = token.toLowerCase();
  if (!ARCANE_DAMAGE_TYPE_OPTIONS.has(lower)) return '';
  return token;
}

function clearOneStatusEffect(target) {
  if (!target || !Array.isArray(target.statuses) || !target.statuses.length) return '';
  target.statuses = normalizeStatuses(target.statuses);
  if (!target.statuses.length) return '';
  const [removed] = target.statuses.splice(0, 1);
  return removed?.name || 'a status effect';
}

function resolveStatusStacksForCard(statusApply, deps = {}) {
  if (!statusApply) return 0;
  let stacks = Math.max(1, Number(statusApply.stacks || 1));
  if (deps.hasBeast3 && statusApply.id === 'bleeding' && !deps.beastRuntime.extraBleedUsedTurn) {
    stacks += 1;
    deps.beastRuntime.extraBleedUsedTurn = true;
  }
  if (
    deps.hasElemental3 &&
    ['burning', 'rooted', 'shock'].includes(statusApply.id) &&
    !deps.elementalRuntime.extraStatusUsedTurn
  ) {
    stacks += 1;
    deps.elementalRuntime.extraStatusUsedTurn = true;
  }
  return stacks;
}

function applyShadowMovementProgress(participant, distanceFt, notes = null) {
  const runtime = ensureSetRuntime(participant);
  if (!hasSetBonus(participant, 'Shadow', 5)) return 0;
  const increment = Math.max(0, Number(distanceFt || 0));
  if (!increment) return 0;
  runtime.shadow.moveDistanceThisTurn += increment;
  if (runtime.shadow.moveDistanceThisTurn >= 15 && !runtime.shadow.moveBonusGrantedTurn) {
    participant.nextAttackDamageBonus = Math.max(0, Number(participant.nextAttackDamageBonus || 0)) + 3;
    runtime.shadow.moveBonusGrantedTurn = true;
    if (Array.isArray(notes)) {
      notes.push('Shadow set grants +3 damage on your next attack (moved 15+ ft).');
    }
    return 3;
  }
  return 0;
}

function maybeApplyDivineRecoverHealing(actor, target, options = {}) {
  if (!actor || !target) return 0;
  if (!hasSetBonus(actor, 'Divine', 5)) return 0;
  if (!isParticipantAlly(actor, target)) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + 4);
  const healed = target.hp - before;
  if (healed > 0 && !options.silent) {
    pushLog(`${actor.name}'s Divine set restores ${healed} HP to ${target.name}.`, actor.id, {
      targetId: target.id,
      source: 'divine_5_cleanse_heal'
    });
    touchState();
    broadcastState('set_divine_heal');
  }
  return healed;
}

function getMachineSetRuntime(participant) {
  return ensureSetRuntime(participant).machine;
}

function getMachineConstructCap(participant) {
  const value = Number(participant?.derivedBonuses?.machineConstructs?.maxActive ?? 1);
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : 1;
}

function getMachineConstructDamageBonus(participant) {
  const value = Number(participant?.derivedBonuses?.machineConstructs?.damageBonus ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function getMachineConstructDurationBonus(participant) {
  const value = Number(participant?.derivedBonuses?.machineConstructs?.durationBonusTurns ?? 0);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function describeConstructSummary(construct = {}) {
  const mode = normalizeConstructMode(construct.mode || construct.constructMode) || 'damage';
  const resources = [];
  const hp = Number(construct.maxHp || 0);
  const ap = Number(construct.apMax || 0);
  const auraRadiusFt = Math.max(0, Number(construct.auraRadiusFt || 0));
  const detectDc = Math.max(0, Number(construct.detectDc || 0));
  const visionRangeFt = Math.max(0, Number(construct.visionRangeFt || 0));
  const utilityKind = String(construct.utilityKind || '').trim().toLowerCase();
  const utilityNote = String(construct.utilityNote || '').trim();
  if (hp > 0) resources.push(`HP ${hp}`);
  if (ap > 0) resources.push(`AP ${ap}`);
  if (mode === 'status') {
    const statusLabel = construct.statusName || statusDisplayName(detectStatusType({ presetId: construct.statusId, name: construct.statusName }) || construct.statusId || 'Status');
    const statusStacks = Math.max(1, Number(construct.statusStacks || 1));
    const forceText = Number(construct.damage || 0) > 0 ? ` + ${construct.damage} Force` : '';
    return `applies ${statusLabel} x${statusStacks}${forceText}${resources.length ? ` (${resources.join(', ')})` : ''}`;
  }
  if (mode === 'utility') {
    const shieldRestore = Math.max(0, Number(construct.shieldRestore || 0));
    const heal = Math.max(0, Number(construct.heal || 0));
    if (shieldRestore > 0) {
      const targetLabel = construct.shieldRestoreAlliesOnly ? 'allies' : 'self';
      const radiusText = auraRadiusFt > 0 ? ` within ${auraRadiusFt} ft` : '';
      return `utility construct (restores ${shieldRestore} Shield to ${targetLabel}${radiusText})${resources.length ? ` (${resources.join(', ')})` : ''}`;
    }
    if (heal > 0) {
      const targetLabel = construct.healTargetOnly
        ? 'target'
        : construct.healAlliesOnly
          ? 'allies'
          : 'self';
      const triggerText = construct.triggerOnTargetTurn ? ' on target turn' : '';
      return `utility construct (restores ${heal} HP to ${targetLabel}${triggerText})${resources.length ? ` (${resources.join(', ')})` : ''}`;
    }
    if (utilityKind === 'scout') {
      const details = [];
      if (visionRangeFt > 0) details.push(`vision ${visionRangeFt} ft`);
      if (detectDc > 0) details.push(`detect DC ${detectDc}`);
      if (utilityNote) details.push(utilityNote);
      return `scout construct${details.length ? ` (${details.join(', ')})` : ''}${resources.length ? ` (${resources.join(', ')})` : ''}`;
    }
    if (utilityKind === 'factory') {
      return `factory construct${utilityNote ? ` (${utilityNote})` : ''}${resources.length ? ` (${resources.join(', ')})` : ''}`;
    }
    return `utility construct${resources.length ? ` (${resources.join(', ')})` : ''}`;
  }
  return `${construct.damage || 0} ${construct.damageType || 'damage'}${resources.length ? ` (${resources.join(', ')})` : ''}`;
}

function deployConstructFromCard(participant, card, options = {}) {
  const baseDamage = Math.max(0, Number(options.baseDamage || 0));
  const bonusDamage = Math.max(0, Number(options.bonusDamage || 0));
  const damageType = String(options.damageType || '').trim();
  const mode = normalizeConstructMode(options.mode) || detectConstructMode(card);
  const statusId = String(options.statusId || '').trim();
  const normalizedStatusType = detectStatusType({ presetId: statusId, name: options.statusName });
  const statusName = String(options.statusName || (normalizedStatusType ? statusDisplayName(normalizedStatusType) : '')).trim();
  const statusStacks = Math.max(1, Number(options.statusStacks || 1));
  const durationBase = Number(card?.constructDurationTurns ?? card?.constructDuration ?? card?.durationTurns ?? 1);
  const durationBonusTurns = Math.max(0, Number(options.durationBonusTurns || 0));
  const durationTurns = Math.max(
    1,
    (Number.isFinite(durationBase) ? Math.round(durationBase) : 1) + durationBonusTurns
  );
  const apMaxRaw = Number(card?.constructAp ?? card?.constructApMax ?? 2);
  const apMax = Number.isFinite(apMaxRaw) ? Math.max(0, Math.round(apMaxRaw)) : 0;
  const maxHpRaw = Number(card?.constructMaxHp ?? card?.constructHp ?? 1);
  const maxHpCasterConBonus = Math.max(0, Math.round(Number(options.maxHpCasterConBonus || 0)));
  const maxHp = Number.isFinite(maxHpRaw)
    ? Math.max(1, Math.round(maxHpRaw) + maxHpCasterConBonus)
    : Math.max(1, 1 + maxHpCasterConBonus);
  const moveFtRaw = Number(card?.constructMoveFt ?? card?.constructMove ?? 10);
  const moveFt = Number.isFinite(moveFtRaw) ? Math.max(5, Math.round(moveFtRaw)) : 10;
  const shieldRestore = Math.max(0, Number(options.shieldRestore || 0));
  const shieldRestoreAlliesOnly = Boolean(options.shieldRestoreAlliesOnly);
  const heal = Math.max(0, Number(options.heal || 0));
  const healAlliesOnly = Boolean(options.healAlliesOnly);
  const healTargetOnly = Boolean(options.healTargetOnly);
  const triggerOnTargetTurn = Boolean(options.triggerOnTargetTurn);
  const auraRadiusFt = Math.max(0, Number(options.auraRadiusFt || 0));
  const detectDc = Math.max(0, Number(options.detectDc || 0));
  const visionRangeFt = Math.max(0, Number(options.visionRangeFt || 0));
  const utilityKind = String(options.utilityKind || '').trim().toLowerCase();
  const utilityNote = String(options.utilityNote || '').trim();
  const cards = Array.isArray(card?.constructCards)
    ? card.constructCards
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    : String(card?.constructLinkedCard || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  const appliedDamageBonus = mode === 'damage' || mode === 'status' ? bonusDamage : 0;
  const finalDamage =
    mode === 'damage'
      ? (baseDamage > 0 ? Math.max(0, baseDamage + appliedDamageBonus) : 0)
      : mode === 'status'
        ? appliedDamageBonus
        : 0;
  const finalDamageType = mode === 'status' ? 'Force' : damageType;
  const cap = getMachineConstructCap(participant);
  const current = normalizeConstructs(participant.constructs, participant.id);
  const displaced = [];
  while (current.length >= cap) {
    const removed = current.shift();
    if (removed) displaced.push(removed);
  }
  const construct = {
    id: randomUUID(),
    ownerId: participant.id,
    sourceCardId: card.id || '',
    name: `${card.name}`,
    damage: finalDamage,
    baseDamage,
    damageBonus: appliedDamageBonus,
    damageType: finalDamageType,
    remainingTurns: durationTurns,
    targetId: String(options.targetId || '').trim(),
    mode,
    statusId,
    statusName,
    statusStacks,
    shieldRestore,
    shieldRestoreAlliesOnly,
    heal,
    healAlliesOnly,
    healTargetOnly,
    triggerOnTargetTurn,
    auraRadiusFt,
    detectDc,
    visionRangeFt,
    utilityKind,
    utilityNote,
    maxHp,
    hp: maxHp,
    apMax,
    apCurrent: apMax,
    moveFt,
    cards,
    tags: Array.isArray(card.tags) ? card.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    createdAt: new Date().toISOString(),
    createdOrder: Date.now()
  };
  current.push(construct);
  participant.constructs = current;
  return { construct, displaced };
}

function deployZoneFromCard(participant, card, options = {}) {
  const level = Math.max(1, Math.min(3, Number(options.masteryLevel || card?.masteryLevel || 1)));
  const radiusRaw = getCardScaledValue(card.zoneRadiusByLevel, level, Number(card.zoneRadius || 0));
  const radiusBonusFt = Number.isFinite(Number(options.radiusBonusFt))
    ? Math.max(0, Math.round(Number(options.radiusBonusFt)))
    : 0;
  const radiusFt = Number.isFinite(Number(radiusRaw))
    ? Math.max(0, Math.round(Number(radiusRaw)) + radiusBonusFt)
    : radiusBonusFt;
  const durationRaw = Number(card.zoneDurationTurns ?? options.zoneDurationTurns ?? 0);
  const remainingTurns = Number.isFinite(durationRaw) ? Math.max(0, Math.round(durationRaw)) : 0;
  const statusApply = options.statusApply || null;
  const enterStatusApply = options.enterStatusApply || null;
  const detectDc = Math.max(0, Number(options.detectDc || 0));
  const triggerMode = String(options.triggerMode || '').trim().toLowerCase();
  const shieldRestore = Math.max(0, Number(options.shieldRestore || 0));
  const heal = Math.max(0, Number(options.heal || 0));
  const damageEnemiesOnly = Boolean(options.damageEnemiesOnly);
  const shieldRestoreAlliesOnly = options.shieldRestoreAlliesOnly !== false;
  const healAlliesOnly = options.healAlliesOnly !== false;
  const targetIds = Array.from(
    new Set(
      (options.targetIds || [])
        .map((value) => String(value || '').trim())
        .filter(Boolean)
    )
  );
  const zone = {
    id: randomUUID(),
    ownerId: participant.id,
    sourceCardId: String(card?.id || '').trim(),
    name: `${card?.name || 'Zone'}`,
    damage: Math.max(0, Number(options.damage || 0)),
    damageType: String(options.damageType || card?.damageType || '').trim(),
    radiusFt,
    remainingTurns,
    tickOnTurn: options.tickOnTurn !== false,
    statusId: String(statusApply?.id || '').trim(),
    statusName: statusApply?.id ? statusDisplayName(statusApply.id) : '',
    statusStacks: Math.max(1, Number(statusApply?.stacks || 1)),
    triggerOnTargetAdd: options.triggerOnTargetAdd === true,
    consumeOnTrigger: options.consumeOnTrigger === true,
    enterDamage: Math.max(0, Number(options.enterDamage || 0)),
    enterDamageType: String(options.enterDamageType || options.damageType || card?.damageType || '').trim(),
    enterStatusId: String(enterStatusApply?.id || '').trim(),
    enterStatusName: enterStatusApply?.id ? statusDisplayName(enterStatusApply.id) : '',
    enterStatusStacks: Math.max(1, Number(enterStatusApply?.stacks || 1)),
    shieldRestore,
    heal,
    damageEnemiesOnly,
    shieldRestoreAlliesOnly,
    healAlliesOnly,
    detectDc,
    triggerMode,
    targetIds,
    tags: Array.isArray(card?.tags) ? card.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    createdAt: new Date().toISOString(),
    createdOrder: Date.now()
  };
  const current = normalizeZones(participant.zones, participant.id);
  current.push(zone);
  participant.zones = current;
  return { zone };
}

function isCardActive(card = {}) {
  return card?.active !== false;
}

function getActiveParticipantCards(participant = {}) {
  return (participant.cards || []).filter((card) => isCardActive(card));
}

function addCardToGroupMap(map, key, card) {
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    existing.push(card);
  } else {
    map.set(key, [card]);
  }
}

function buildActiveCardGroups(participant = {}) {
  const activeCards = [];
  const bySet = new Map();
  const byTier = new Map();
  const bySetTier = new Map();
  for (const card of participant.cards || []) {
    if (!isCardActive(card)) continue;
    activeCards.push(card);
    const setName = canonicalSetName(card?.set);
    const tierName = String(card?.tier || '').trim();
    addCardToGroupMap(bySet, setName, card);
    addCardToGroupMap(byTier, tierName.toLowerCase(), card);
    if (setName && tierName) {
      addCardToGroupMap(bySetTier, `${setName.toLowerCase()}|${tierName.toLowerCase()}`, card);
    }
  }
  return { activeCards, bySet, byTier, bySetTier };
}

function getSetCardCount(participant, setName, groups = null) {
  const canonicalTarget = canonicalSetName(setName);
  if (!canonicalTarget) return 0;
  const source = groups || buildActiveCardGroups(participant);
  return source.bySet.get(canonicalTarget)?.length || 0;
}

function hasSetBonus(participant, setName, pieces, groups = null) {
  return getSetCardCount(participant, setName, groups) >= pieces;
}

function isMachineCard(card) {
  return String(card?.set || '').toLowerCase() === 'machine';
}

function isMachineAttackCard(card) {
  if (!isMachineCard(card)) return false;
  const type = String(card?.type || '').toLowerCase();
  if (type.includes('attack')) return true;
  const tags = Array.isArray(card?.tags)
    ? card.tags.map((tag) => String(tag).toLowerCase())
    : [];
  return tags.includes('attack') || tags.includes('melee') || tags.includes('ranged');
}

function resetSetTurnState(participant) {
  const runtime = ensureSetRuntime(participant);
  const machine = runtime.machine;
  machine.autoLoaderPrimed = false;
  machine.autoLoaderTriggeredTurn = false;
  machine.autoLoaderDiscountUsedTurn = false;
  runtime.arcane.damageTypeShiftUsedTurn = false;
  runtime.arcane.splitUsedTurn = false;
  runtime.beast.extraBleedUsedTurn = false;
  runtime.beast.bleedAttackApUsedTurn = false;
  runtime.demonic.statusHealUsedTurn = false;
  runtime.demonic.damageTakenApQueuedTurn = false;
  runtime.demonic.nearbyKillApUsedTurn = false;
  runtime.elemental.extraStatusUsedTurn = false;
  runtime.elemental.burstUsedTurn = false;
  runtime.nature.cleanseUsedTurn = false;
  runtime.shadow.moveDistanceThisTurn = 0;
  runtime.shadow.moveBonusGrantedTurn = false;
  runtime.shadow.postAttackMoveUsedTurn = false;
}

function resetSetCombatState(participant) {
  resetSetTurnState(participant);
  const runtime = ensureSetRuntime(participant);
  runtime.arcane.copyUsedEncounter = false;
  runtime.arcane.modifiedCard = null;
  runtime.divine.reverseDamageUsedEncounter = false;
  participant.constructs = [];
  participant.zones = [];
  participant.lastActedRound = 0;
  participant.cards = normalizeCards((participant.cards || []).filter((card) => card?.temporarySource !== 'arcane_7_temp_copy'));
}

function markTurnActionTaken(participant) {
  participant.turnActionCount = Math.max(0, Number(participant.turnActionCount || 0)) + 1;
}

function applyEndOfTurnSetEffects(participant) {
  void participant;
  return [];
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

function computeSetBonuses(participant, groups = null) {
  const source = groups || buildActiveCardGroups(participant);
  const appliedBonuses = [];
  const totals = createZeroModifier();
  for (const [setName, cards] of source.bySet.entries()) {
    const count = cards.length;
    const definitions = SET_LIBRARY[setName];
    if (!definitions) continue;
    definitions.forEach((bonus) => {
      if (count >= bonus.pieces) {
        const modifiers = normalizeModifiers(bonus.modifiers);
        appliedBonuses.push({
          id: bonus.id || `${setName.toLowerCase()}_${bonus.pieces}`,
          set: setName,
          pieces: bonus.pieces,
          effect: bonus.effect,
          modifiers,
          activatable: bonus.activatable || null
        });
        addModifierTotals(totals, modifiers);
      }
    });
  }
  return { appliedBonuses, setTotals: totals };
}

function recalculateParticipant(participant) {
  participant.statuses = normalizeStatuses(participant.statuses);
  const setRuntime = ensureSetRuntime(participant);
  sanitizeSetAllyTargets(participant);
  participant.cards = normalizeCards(participant.cards);
  const cardGroups = buildActiveCardGroups(participant);
  if (
    setRuntime.arcane.modifiedCard?.cardId &&
    !participant.cards.some((entry) => entry.id === setRuntime.arcane.modifiedCard.cardId)
  ) {
    setRuntime.arcane.modifiedCard = null;
  }
  participant.constructs = normalizeConstructs(participant.constructs, participant.id);
  participant.zones = normalizeZones(participant.zones, participant.id);
  participant.abilities = normalizeAbilityEntries(participant.abilities);
  participant.inventory = normalizeInventoryEntries(participant.inventory);
  participant.currencies = normalizeCurrencyEntries(participant.currencies);
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
  for (const card of cardGroups.activeCards) {
    const modifiers = normalizeModifiers(card.modifiers);
    const healthBonus = Number(card.healthBonus ?? 0);
    if (Number.isFinite(healthBonus) && healthBonus !== 0) {
      modifiers.maxHp += healthBonus;
    }
    const shieldBonus = Number(card.shieldBonus ?? 0);
    if (Number.isFinite(shieldBonus) && shieldBonus !== 0) {
      modifiers.maxShield += shieldBonus;
    }
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
  const { appliedBonuses, setTotals } = computeSetBonuses(participant, cardGroups);
  addModifierTotals(totals, setTotals);

  if (!hasSetBonus(participant, 'Machine', 5, cardGroups)) {
    setRuntime.machine.autoLoaderPrimed = false;
    setRuntime.machine.autoLoaderTriggeredTurn = false;
    setRuntime.machine.autoLoaderDiscountUsedTurn = false;
  }
  if (!hasSetBonus(participant, 'Arcane', 10, cardGroups)) {
    setRuntime.arcane.modifiedCard = null;
  }
  const machineConstructCap = hasSetBonus(participant, 'Machine', 10, cardGroups)
    ? 3
    : hasSetBonus(participant, 'Machine', 5, cardGroups)
      ? 2
      : 1;
  const machineConstructDamageBonus = hasSetBonus(participant, 'Machine', 7, cardGroups) ? 2 : 0;
  const machineConstructDurationBonus = hasSetBonus(participant, 'Machine', 7, cardGroups) ? 1 : 0;
  if (participant.constructs.length > machineConstructCap) {
    participant.constructs = participant.constructs.slice(participant.constructs.length - machineConstructCap);
  }

  const overchargeMultiplier = Math.max(1, Number(setRuntime.divine.overchargeMultiplier || 1));
  participant.apMax = Math.max(1, Math.round(((base.apMax ?? 0) + totals.apMax) * overchargeMultiplier));
  participant.apCurrent = clampNumber(
    participant.apCurrent ?? participant.apMax,
    0,
    participant.apMax
  );
  participant.maxHp = Math.max(1, Math.round(((base.maxHp ?? 0) + totals.maxHp) * overchargeMultiplier));
  participant.hp = clampNumber(participant.hp ?? participant.maxHp, 0, participant.maxHp);
  participant.maxShield = Math.max(0, Math.round(((base.maxShield ?? 0) + totals.maxShield) * overchargeMultiplier));
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
  participant.nextAttackDamageBonus = Number.isFinite(Number(participant.nextAttackDamageBonus))
    ? Math.max(0, Math.round(Number(participant.nextAttackDamageBonus)))
    : 0;
  participant.derivedBonuses = {
    base,
    totals,
    cardModifiers,
    cardLoadout: {
      maxActive: MAX_ACTIVE_CARDS,
      active: cardGroups.activeCards.length,
      total: participant.cards.length
    },
    setBonuses: appliedBonuses,
    machineConstructs: {
      maxActive: machineConstructCap,
      damageBonus: machineConstructDamageBonus,
      durationBonusTurns: machineConstructDurationBonus
    },
    setAutomation: {
      allyTargets: getSetAllyTargets(participant),
      overchargeMultiplier
    }
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
    currentTurnKey: String(encounter.currentTurnKey || ''),
    log: Array.isArray(encounter.log) ? encounter.log.slice(-200) : []
  };
  const participants = Array.isArray(encounter.participants)
    ? encounter.participants.map((raw) => createParticipant(raw))
    : [];
  trackerState.encounter.participants = participants;
  trackerState.encounter.currentIndex =
    typeof encounter.currentIndex === 'number' ? encounter.currentIndex : -1;
  sortParticipants();
  ensureCurrentIndex();
}
