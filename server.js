import { createServer } from 'http';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { GAME_LIMITS } from './lib/game-config.js';
import { getCardTierShieldBonus, getCardTierMasteryThresholds } from './lib/card-rules.js';
import {
  getAttributeScalingFromScores,
  getContextualDamageBonusFromScaling
} from './public/shared/stat-balance.js';
import {
  EQUIPMENT_DAMAGE_TYPES,
  classifyCardEquipmentMatch,
  getDefaultArmorProperties,
  getDefaultWeaponCardBonus,
  getDefaultWeaponHands,
  getDefaultWeaponProficiencyGroup,
  getDefaultWeaponRequirementAbility,
  getWeaponCardMatchType,
  hasWeaponBasicAttack,
  normalizeArmorType,
  normalizeEquipmentCategory,
  normalizeEquipmentToken,
  normalizeRequirementAbility,
  normalizeWeaponStyle
} from './public/shared/equipment.js';
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
import { CARD_PRESETS } from './public/card-presets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');
const PORT = process.env.PORT || 3000;
const CARD_PRESET_LOOKUP = buildCardPresetLookup(CARD_PRESETS);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function normalizePresetCardToken(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildCardPresetLookup(list = []) {
  const lookup = new Map();
  for (const entry of list || []) {
    if (!entry || typeof entry !== 'object' || !entry.card) continue;
    const candidates = [
      entry.id,
      entry.card.id,
      entry.card.name
    ];
    for (const candidate of candidates) {
      const token = normalizePresetCardToken(candidate);
      if (token && !lookup.has(token)) {
        lookup.set(token, entry);
      }
    }
  }
  return lookup;
}

function getCardPresetEntry(reference = '') {
  const token = normalizePresetCardToken(reference);
  return token ? CARD_PRESET_LOOKUP.get(token) || null : null;
}

function constructHasManualTurn(construct = {}) {
  return construct?.manualTurns === true || (Array.isArray(construct?.cardObjects) && construct.cardObjects.length > 0);
}

function constructCannotActOnSummonTurn(construct = {}) {
  return constructHasManualTurn(construct) && construct?.summonSicknessTurn === true;
}

function clampMasteryLevel(value, fallback = 1) {
  const raw = Number(value);
  if (!Number.isFinite(raw)) return Math.max(1, Math.min(4, Number(fallback) || 1));
  return Math.max(1, Math.min(4, Math.round(raw)));
}

function buildConstructCardObjects(sourceCard = {}) {
  const refs = Array.isArray(sourceCard?.constructCards)
    ? sourceCard.constructCards
    : String(sourceCard?.constructCards || sourceCard?.constructLinkedCard || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
  if (!refs.length) return [];
  const masteryByRef =
    sourceCard?.constructCardMasteryById && typeof sourceCard.constructCardMasteryById === 'object'
      ? sourceCard.constructCardMasteryById
      : {};
  const defaultMastery = clampMasteryLevel(sourceCard?.constructCardMasteryLevel ?? 1, 1);
  return refs
    .map((reference, index) => {
      const preset = getCardPresetEntry(reference);
      if (!preset?.card) return null;
      const refCandidates = [reference, preset.id, preset.card.id, preset.card.name];
      let masteryLevel = defaultMastery;
      for (const candidate of refCandidates) {
        const override = masteryByRef?.[candidate];
        if (Number.isFinite(Number(override))) {
          masteryLevel = clampMasteryLevel(override, defaultMastery);
          break;
        }
      }
      const normalized = normalizeCards([{
        ...structuredClone(preset.card),
        id: `${preset.card.id || randomUUID()}__construct__${index}`,
        masteryLevel,
        masteryUses: 0,
        active: true
      }])[0];
      return normalized ? { ...normalized, active: true } : null;
    })
    .filter(Boolean);
}

const STANDARD_ACTIONS = {
  move: {
    id: 'move',
    label: 'Move',
    summary: '1 AP → base 10 ft, modified by DEX; repeat as needed.',
    apCost: 1,
    detail: 'Move your current movement distance. DEX adds or subtracts 5 ft per modifier.',
    logText: 'moves.'
  },
  move_difficult: {
    id: 'move_difficult',
    label: 'Move (Difficult Terrain)',
    summary: '1 AP → base 5 ft in difficult terrain, modified by DEX.',
    apCost: 1,
    detail: 'When terrain is difficult, use your difficult-terrain movement distance instead.',
    logText: 'pushes through difficult terrain.'
  },
  disengage: {
    id: 'disengage',
    label: 'Disengage',
    summary: '2 AP: This turn’s movement does not provoke OAs.',
    apCost: 2,
    logText: 'disengages to avoid opportunity attacks.'
  },
  half_cover: {
    id: 'half_cover',
    label: 'Duck',
    summary: '1 AP: Gain Half Cover until the start of your next turn.',
    apCost: 1,
    logText: 'ducks behind half cover.'
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
    summary: '2 AP → Restore Shield based on Guard Restore (repeatable, max shield limit).',
    apCost: 2,
    logText: 'guards and restores shield.'
  },
  recover: {
    id: 'recover',
    label: 'Recover',
    summary: '2 AP: Remove 1 stack of Bleeding, Poisoned, or Burning.',
    apCost: 2,
    logText: 'recovers to reduce damaging stacks.'
  },
  cleanse: {
    id: 'cleanse',
    label: 'Cleanse',
    summary: '4 AP: Remove 1 control/debuff status.',
    apCost: 4,
    logText: 'uses a cleansing action.'
  }
};

const DEFAULT_GUARD_RESTORE = 3;
const MAX_ACTIVE_CARDS = GAME_LIMITS.maxActiveCards;
const MAX_ACTIVE_ZONES = GAME_LIMITS.maxActiveZones;
const SET_NAME_LOOKUP = buildSetNameLookup(SET_LIBRARY);

function getRuntimeStandardActionsForParticipant(participant = {}) {
  const moveFt = getParticipantMoveDistanceFt(participant);
  const difficultMoveFt = getParticipantMoveDistanceFt(participant, { difficultTerrain: true });
  const guardRestore = Math.max(0, Math.round(Number(participant?.guardRestore ?? DEFAULT_GUARD_RESTORE)));
  const moveApCost = Math.max(1, Number(participant?.derivedBonuses?.equipment?.moveApCost || 1));
  const movePenaltyNote =
    moveApCost > 1 ? ' Armour requirement unmet: movement costs extra AP.' : '';
  return {
    ...STANDARD_ACTIONS,
    move: {
      ...STANDARD_ACTIONS.move,
      apCost: moveApCost,
      summary: `${moveApCost} AP → ${moveFt} ft${moveFt > 0 ? ` (${Math.max(1, Math.round(moveFt / 5))} squares)` : ''}; repeat as needed.`,
      detail: `Move ${moveFt} ft.${movePenaltyNote}`,
      logText: `moves ${moveFt} ft.`
    },
    move_difficult: {
      ...STANDARD_ACTIONS.move_difficult,
      apCost: moveApCost,
      summary: `${moveApCost} AP → ${difficultMoveFt} ft in difficult terrain.`,
      detail: `When terrain is difficult, ${moveApCost} AP moves ${difficultMoveFt} ft.${movePenaltyNote}`,
      logText: `pushes through difficult terrain (${difficultMoveFt} ft).`
    },
    guard: {
      ...STANDARD_ACTIONS.guard,
      summary: `2 AP → Restore ${guardRestore} Shield (repeatable, max shield limit).`
    }
  };
}

const STATUS_LIBRARY = [
  {
    id: 'bleeding',
    name: 'Bleeding',
    defaultStacks: 1,
    description:
      'Damaging (bypasses Shield). Start of turn: take damage equal to stacks, then Bleeding loses 1 stack. If Bleeding is still 5+ stacks, gain Weakened 1 and reset Bleeding to 1 (max once/turn). Recover (2 AP) removes 1 stack.',
    tags: ['Damaging']
  },
  {
    id: 'poisoned',
    name: 'Poisoned',
    defaultStacks: 1,
    description:
      'Damaging (bypasses Shield). Start of turn: take damage equal to stacks, then Poisoned loses 1 stack. If Poisoned is still 5+ stacks, gain Fatigued 1 and reset Poisoned to 1 (max once/turn). Recover (2 AP) removes 1 stack.',
    tags: ['Damaging']
  },
  {
    id: 'burning',
    name: 'Burning',
    defaultStacks: 1,
    description:
      'Damaging (hits Shield first). Start of turn: take damage equal to stacks, then Burning loses 1 stack. Burning does not escalate. Recover (2 AP) removes 1 stack.',
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
  },
  {
    id: 'paralysed',
    name: 'Paralysed',
    defaultStacks: 1,
    description:
      'Control. Severe immobilization effect.',
    tags: ['Control']
  },
  {
    id: 'silenced',
    name: 'Silenced',
    defaultStacks: 1,
    description:
      'Debuff. You cannot use speech- or verbal-dependent abilities while this status is active.',
    tags: ['Debuff']
  },
  {
    id: 'charmed',
    name: 'Charmed',
    defaultStacks: 1,
    description:
      'Control/Debuff. Mental influence that may alter targeting or decision-making based on scenario rules.',
    tags: ['Control', 'Debuff']
  },
  {
    id: 'frightened',
    name: 'Frightened',
    defaultStacks: 1,
    description:
      'Control/Debuff. Fear effect that can limit movement or offensive actions based on scenario rules.',
    tags: ['Control', 'Debuff']
  },
  {
    id: 'suppressed',
    name: 'Suppressed',
    defaultStacks: 1,
    description:
      'Debuff. Cannot play cards while active. Different sources may add extra notes.',
    tags: ['Debuff']
  },
  {
    id: 'infernal_brand',
    name: 'Infernal Brand',
    defaultStacks: 1,
    description:
      'Debuff. Marked by a specific caster; that caster gains bonus damage on attacks against you while the brand lasts.',
    tags: ['Debuff']
  },
  {
    id: 'blood_curse',
    name: 'Blood Curse',
    defaultStacks: 1,
    description:
      'Debuff. Timed curse that causes HP loss at the start of your turn. Different sources may maintain separate curses.',
    tags: ['Debuff']
  },
  {
    id: 'curse_of_weakness',
    name: 'Curse of Weakness',
    defaultStacks: 1,
    description:
      'Debuff. Timed curse that reduces the damage dealt by your attacks while active.',
    tags: ['Debuff']
  },
  {
    id: 'half_cover',
    name: 'Half Cover',
    defaultStacks: 1,
    description:
      'Positional defense. GM adjudicates whether attacks are reduced or prevented by the available cover. Clears at the start of your next turn.',
    tags: ['Buff']
  },
  {
    id: 'mind_shield',
    name: 'Mind Shield',
    defaultStacks: 2,
    description:
      'Buff. Immune to Charmed and Frightened while active. Loses 1 stack at the start of your turn.',
    tags: ['Buff']
  },
  {
    id: 'enlarge',
    name: 'Enlarge',
    defaultStacks: 1,
    description: 'Buff. Gain +2 damage on melee attacks while active.',
    tags: ['Buff']
  },
  {
    id: 'reduce',
    name: 'Reduce',
    defaultStacks: 1,
    description: 'Debuff. Your attacks deal -2 damage while active.',
    tags: ['Debuff']
  },
  {
    id: 'two_step',
    name: 'Two Step',
    defaultStacks: 1,
    description:
      'Buff. At the end of each turn, resolve a 10 ft horizontal teleport if space is available. This tracker shows duration but does not enforce board occupancy.',
    tags: ['Buff', 'Custom']
  },
  {
    id: 'haste_matrix',
    name: 'Haste Matrix',
    defaultStacks: 1,
    description:
      'Buff. Gain +2 AP at the start of each turn while active. When it expires, Haste Crash applies on the next turn.',
    tags: ['Buff', 'Custom']
  },
  {
    id: 'haste_crash',
    name: 'Haste Crash',
    defaultStacks: 1,
    description: 'Debuff. Lose 4 AP at the start of your turn, then expire at the end of that turn.',
    tags: ['Debuff', 'Custom']
  },
  {
    id: 'polymorphed',
    name: 'Polymorphed',
    defaultStacks: 1,
    description:
      'Custom. The creature is transformed into a chosen form. The tracker records the duration and chosen form; the GM resolves the transformed statistics and capabilities.',
    tags: ['Control', 'Custom']
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
let characterPresetLibrary = [];

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
    teams: TEAM_OPTIONS,
    characterPresets: characterPresetLibrary.map((preset) => structuredClone(preset))
  };
}

function refreshReferenceData() {
  trackerState.reference = buildReferenceData();
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
    pauseState: null,
    log: []
  },
  reference: buildReferenceData(),
  updatedAt: new Date().toISOString()
};
const cardActionHistory = [];

const sseClients = new Map();

function normalizeAbilityScoreValue(value, fallback = 10) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  return rounded === 0 ? fallback : rounded;
}

function normalizeEquipmentText(value = '') {
  return String(value || '').trim();
}

function normalizeEquipmentInteger(value, fallback = 0, options = {}) {
  const parsed = Number(value);
  const min = Number.isFinite(Number(options.min)) ? Number(options.min) : Number.MIN_SAFE_INTEGER;
  const max = Number.isFinite(Number(options.max)) ? Number(options.max) : Number.MAX_SAFE_INTEGER;
  const normalized = Number.isFinite(parsed) ? Math.round(parsed) : Math.round(Number(fallback || 0));
  return Math.max(min, Math.min(max, normalized));
}

function normalizeSupportedEquipmentDamageType(value = '', fallback = '') {
  const token = String(value || '').trim();
  if (!token) return String(fallback || '').trim();
  const match = EQUIPMENT_DAMAGE_TYPES.find((entry) => entry.toLowerCase() === token.toLowerCase());
  return match || String(fallback || '').trim();
}

function createEmptyParticipantEquipment() {
  return {
    weapon: null,
    armor: null,
    shield: null
  };
}

function normalizeWeaponEquipmentSlot(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const name = normalizeEquipmentText(raw.name || raw.title);
  if (!name) return null;
  const weaponStyle = normalizeWeaponStyle(raw.weaponStyle || raw.style || raw.subcategory || raw.category);
  if (!weaponStyle) return null;
  const hasBasicAttack = hasWeaponBasicAttack({ kind: 'weapon', weaponStyle });
  const fallbackDamageType =
    weaponStyle === 'ranged'
      ? 'Piercing'
      : weaponStyle === 'melee'
        ? 'Slashing'
        : '';
  return {
    id: raw.id || randomUUID(),
    kind: 'weapon',
    name,
    weaponStyle,
    hands: normalizeEquipmentInteger(raw.hands, getDefaultWeaponHands(weaponStyle), { min: 1, max: 2 }),
    rangeFt: normalizeEquipmentInteger(raw.rangeFt ?? raw.range, weaponStyle === 'ranged' ? 30 : 5, { min: 0, max: 999 }),
    basicAttackApCost: hasBasicAttack
      ? normalizeEquipmentInteger(raw.basicAttackApCost ?? raw.apCost, 2, { min: 1, max: 99 })
      : 0,
    basicAttackDamage: hasBasicAttack
      ? normalizeEquipmentInteger(raw.basicAttackDamage ?? raw.damage, 0, { min: 0, max: 999 })
      : 0,
    basicAttackDamageType: hasBasicAttack
      ? normalizeSupportedEquipmentDamageType(raw.basicAttackDamageType ?? raw.damageType, fallbackDamageType)
      : '',
    cardBonusDamage: normalizeEquipmentInteger(raw.cardBonusDamage ?? raw.bonusDamage, getDefaultWeaponCardBonus(weaponStyle), {
      min: 0,
      max: 999
    }),
    requirementAbility: normalizeRequirementAbility(
      raw.requirementAbility ?? raw.requirementStat ?? raw.requirement ?? getDefaultWeaponRequirementAbility(weaponStyle)
    ),
    requirementScore: normalizeEquipmentInteger(raw.requirementScore ?? raw.requiredScore, 0, { min: 0, max: 99 }),
    proficiencyGroup: normalizeEquipmentText(raw.proficiencyGroup || getDefaultWeaponProficiencyGroup(weaponStyle)),
    notes: normalizeEquipmentText(raw.notes || raw.description)
  };
}

function normalizeArmorEquipmentSlot(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const name = normalizeEquipmentText(raw.name || raw.title);
  if (!name) return null;
  const armorType = normalizeArmorType(raw.armorType || raw.type || raw.category || raw.subcategory);
  if (!armorType) return null;
  const defaults = getDefaultArmorProperties(armorType);
  return {
    id: raw.id || randomUUID(),
    kind: 'armor',
    name,
    armorType,
    maxShieldBonus: normalizeEquipmentInteger(raw.maxShieldBonus ?? raw.shieldBonus, defaults.maxShieldBonus, { min: 0, max: 999 }),
    shieldRegen: normalizeEquipmentInteger(raw.shieldRegen ?? raw.shieldRegenPerTurn, defaults.shieldRegen, { min: 0, max: 999 }),
    strengthRequirement: normalizeEquipmentInteger(
      raw.strengthRequirement ?? raw.requirementScore ?? raw.requiredStrength,
      defaults.strengthRequirement,
      { min: 0, max: 99 }
    ),
    dexterityPenalty: normalizeEquipmentInteger(raw.dexterityPenalty ?? raw.dexPenalty, defaults.dexterityPenalty, {
      min: 0,
      max: 99
    }),
    notes: normalizeEquipmentText(raw.notes || raw.description)
  };
}

function normalizeShieldEquipmentSlot(raw = {}) {
  if (!raw || typeof raw !== 'object') return null;
  const name = normalizeEquipmentText(raw.name || raw.title);
  if (!name) return null;
  return {
    id: raw.id || randomUUID(),
    kind: 'shield',
    name,
    hands: 1,
    maxShieldBonus: normalizeEquipmentInteger(raw.maxShieldBonus ?? raw.shieldBonus, 3, { min: 0, max: 999 }),
    shieldRegen: normalizeEquipmentInteger(raw.shieldRegen ?? raw.shieldRegenPerTurn, 1, { min: 0, max: 999 }),
    notes: normalizeEquipmentText(raw.notes || raw.description)
  };
}

function normalizeParticipantEquipment(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    weapon: normalizeWeaponEquipmentSlot(source.weapon),
    armor: normalizeArmorEquipmentSlot(source.armor),
    shield: normalizeShieldEquipmentSlot(source.shield)
  };
}

function normalizeEquipmentProficiencyToken(value = '') {
  return normalizeEquipmentToken(value).replace(/armour/g, 'armor');
}

function getParticipantEquipmentProficiencyTokens(participant = {}, extraProficiencies = []) {
  const combined = [
    ...normalizeTextList(participant?.proficiencies),
    ...normalizeTextList(extraProficiencies)
  ];
  return new Set(combined.map((entry) => normalizeEquipmentProficiencyToken(entry)).filter(Boolean));
}

function hasParticipantEquipmentProficiency(participant = {}, group = '', options = {}) {
  const target = normalizeEquipmentProficiencyToken(group);
  if (!target) return true;
  const extraProficiencies = Array.isArray(options?.setProficiencies)
    ? options.setProficiencies
    : participant?.derivedBonuses?.setGrants?.proficiencies || [];
  const tokens = getParticipantEquipmentProficiencyTokens(participant, extraProficiencies);
  if (tokens.has(target)) return true;
  if (tokens.has('equipment') || tokens.has('allequipment')) return true;
  if (['meleeweapons', 'rangedweapons', 'arcaneimplements', 'staff'].includes(target)) {
    return tokens.has('weapon') || tokens.has('weapons') || tokens.has('allweapons');
  }
  return false;
}

function getParticipantAbilityForEquipmentCheck(effectiveStats = {}, participant = {}, ability = '') {
  const key = String(ability || '').trim().toLowerCase();
  const fromStats = Number(effectiveStats?.[key]);
  if (Number.isFinite(fromStats)) {
    return Math.round(fromStats);
  }
  return getEffectiveAbilityScore(participant, key);
}

function doesParticipantMeetEquipmentRequirement(participant = {}, effectiveStats = {}, requirementAbility = 'none', requirementScore = 0) {
  const normalizedAbility = normalizeRequirementAbility(requirementAbility);
  const minimum = Math.max(0, Number(requirementScore || 0));
  if (!minimum || normalizedAbility === 'none') return true;
  if (normalizedAbility === 'either') {
    return (
      getParticipantAbilityForEquipmentCheck(effectiveStats, participant, 'strength') >= minimum ||
      getParticipantAbilityForEquipmentCheck(effectiveStats, participant, 'dexterity') >= minimum
    );
  }
  return getParticipantAbilityForEquipmentCheck(effectiveStats, participant, normalizedAbility) >= minimum;
}

function getParticipantEquipmentSummary(participant = {}, effectiveStats = {}, options = {}) {
  const equipment = normalizeParticipantEquipment(participant?.equipment);
  const weapon = equipment.weapon;
  const armor = equipment.armor;
  const shield = equipment.shield;
  const armorType = normalizeArmorType(armor?.armorType);
  const handsUsed = Math.max(0, Number(weapon?.hands || 0)) + (shield ? 1 : 0);
  const handsExceeded = handsUsed > 2;
  const armorStrengthRequirement = Math.max(0, Number(armor?.strengthRequirement || 0));
  const armorStrengthMet =
    !armorStrengthRequirement ||
    getParticipantAbilityForEquipmentCheck(effectiveStats, participant, 'strength') >= armorStrengthRequirement;
  const weaponRequirementMet = doesParticipantMeetEquipmentRequirement(
    participant,
    effectiveStats,
    weapon?.requirementAbility,
    weapon?.requirementScore
  );
  const weaponProficient = weapon
    ? hasParticipantEquipmentProficiency(participant, weapon.proficiencyGroup, {
        setProficiencies: options?.setProficiencies
      })
    : true;
  const weaponStatPenalty = weapon && !weaponRequirementMet ? 2 : 0;
  const weaponProficiencyPenalty = weapon && !weaponProficient ? 2 : 0;
  const weaponApPenalty = Math.min(3, weaponStatPenalty + weaponProficiencyPenalty);
  const moveApCost = armor && (armorType === 'medium' || armorType === 'heavy') && !armorStrengthMet ? 2 : 1;
  const maxShieldBonus = Math.max(0, Number(armor?.maxShieldBonus || 0)) + Math.max(0, Number(shield?.maxShieldBonus || 0));
  const shieldRegen = Math.max(0, Number(armor?.shieldRegen || 0)) + Math.max(0, Number(shield?.shieldRegen || 0));
  const penaltyReasons = [];
  if (weapon && !weaponRequirementMet) {
    penaltyReasons.push('Requirement unmet');
  }
  if (weapon && !weaponProficient) {
    penaltyReasons.push('Not proficient');
  }
  return {
    weapon,
    armor,
    shield,
    handsUsed,
    handsAvailable: 2,
    handsExceeded,
    armorStrengthRequirement,
    armorStrengthMet,
    moveApCost,
    maxShieldBonus,
    shieldRegen,
    canHide: armorType !== 'heavy',
    dexterityPenalty: Math.max(0, Number(armor?.dexterityPenalty || 0)),
    weaponStyle: weapon ? normalizeWeaponStyle(weapon.weaponStyle) : '',
    weaponMatchType: weapon ? getWeaponCardMatchType(weapon) : '',
    weaponProficient,
    weaponRequirementMet,
    weaponStatPenalty,
    weaponProficiencyPenalty,
    weaponApPenalty,
    weaponPenaltyReasons: penaltyReasons
  };
}

function getParticipantWeaponContextForCard(participant = {}, card = {}, options = {}) {
  const equipmentSummary =
    participant?.derivedBonuses?.equipment && typeof participant.derivedBonuses.equipment === 'object'
      ? participant.derivedBonuses.equipment
      : getParticipantEquipmentSummary(participant);
  const weapon = equipmentSummary.weapon;
  const cardMatchType = classifyCardEquipmentMatch(card, options);
  const matches = Boolean(weapon && equipmentSummary.weaponMatchType && equipmentSummary.weaponMatchType === cardMatchType);
  return {
    weapon,
    cardMatchType,
    weaponMatchType: equipmentSummary.weaponMatchType || '',
    matches,
    damageBonus: matches ? Math.max(0, Number(weapon?.cardBonusDamage || 0)) : 0,
    apPenalty: matches ? Math.max(0, Number(equipmentSummary.weaponApPenalty || 0)) : 0,
    proficiencyPenalty: matches ? Math.max(0, Number(equipmentSummary.weaponProficiencyPenalty || 0)) : 0,
    statPenalty: matches ? Math.max(0, Number(equipmentSummary.weaponStatPenalty || 0)) : 0,
    proficient: Boolean(equipmentSummary.weaponProficient),
    requirementMet: Boolean(equipmentSummary.weaponRequirementMet)
  };
}

function normalizeParticipantNameToken(value = '') {
  return String(value || '').trim().toLowerCase();
}

function buildPresetSpawnParticipantName(rawName = '') {
  const baseName = String(rawName || '').trim() || 'Preset Character';
  const existingNames = new Set(
    (trackerState.encounter.participants || [])
      .map((participant) => normalizeParticipantNameToken(participant?.name))
      .filter(Boolean)
  );
  let suffix = existingNames.has(normalizeParticipantNameToken(baseName)) ? 2 : 1;
  let candidate = `${baseName} ${suffix}`;
  while (existingNames.has(normalizeParticipantNameToken(candidate))) {
    suffix += 1;
    candidate = `${baseName} ${suffix}`;
  }
  return candidate;
}

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
      return sendJson(res, { encounter: getEncounterExportPayload() });
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

    if (method === 'POST' && pathname === '/api/presets/characters') {
      const body = await readBody(req);
      const presetId = String(body?.presetId || '').trim();
      const participantId = String(body?.participantId || '').trim();
      let templateSource = null;
      if (participantId) {
        templateSource = findParticipant(participantId);
        if (!templateSource) {
          return sendJson(res, { error: 'Participant not found for preset save.' }, 404);
        }
      } else if (body?.template && typeof body.template === 'object') {
        templateSource = body.template;
      }
      if (!templateSource) {
        return sendJson(res, { error: 'Participant or preset template required.' }, 400);
      }
      const preset = upsertCharacterPreset({
        id: presetId || undefined,
        name: body?.name,
        description: body?.description,
        template: createParticipantPresetTemplate(templateSource, { name: body?.name })
      });
      touchState();
      broadcastState('character_preset_saved');
      return sendJson(res, { preset, presets: characterPresetLibrary });
    }

    if (pathname.startsWith('/api/presets/characters/')) {
      const [, , , presetId = '', subresource = ''] = pathname.split('/').filter(Boolean);
      const preset = characterPresetLibrary.find((entry) => entry.id === presetId);
      if (!preset) {
        return sendJson(res, { error: 'Character preset not found.' }, 404);
      }
      if (method === 'POST' && subresource === 'spawn') {
        const body = await readBody(req);
        const spawnBaseName = String(body?.name || preset.template?.name || preset.name || 'Preset Character').trim();
        const participant = createParticipant({
          ...structuredClone(preset.template),
          name: buildPresetSpawnParticipantName(spawnBaseName),
          team: Object.prototype.hasOwnProperty.call(body || {}, 'team') ? body.team : preset.template?.team
        });
        participant.hp = participant.maxHp;
        participant.shield = participant.maxShield;
        participant.apCurrent = participant.apMax;
        trackerState.encounter.participants.push(participant);
        sortParticipants();
        ensureCurrentIndex();
        pushLog(`${participant.name} joins the encounter from preset ${preset.name}.`);
        touchState();
        broadcastState('participant_added_from_preset');
        return sendJson(res, { participant, preset });
      }
      if (method === 'DELETE' && !subresource) {
        characterPresetLibrary = characterPresetLibrary.filter((entry) => entry.id !== presetId);
        refreshReferenceData();
        touchState();
        broadcastState('character_preset_removed');
        return sendJson(res, { ok: true });
      }
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

    if (method === 'POST' && pathname === '/api/actions/weapon-attack') {
      const body = await readBody(req);
      const result = executeWeaponAttackAction(body);
      if (result.error) {
        return sendJson(res, result, 400);
      }
      return sendJson(res, result);
    }

    if (method === 'POST' && pathname === '/api/cards/mastery-choice') {
      const body = await readBody(req);
      const result = executeSetCardMasteryChoiceAction(body);
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
  cardActionHistory.length = 0;
  clearEncounterPauseState();
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
  cardActionHistory.length = 0;
  clearEncounterPauseState();
  endEncounterLifecycle(trackerState, {
    resetSetCombatState,
    pushLog,
    touchState,
    broadcastState
  });
}

function executeStandardAction(body) {
  const constructRecord = body?.constructId ? findConstructWithOwner(body.constructId) : null;
  const actor = constructRecord?.construct || resolveActor(body?.participantId);
  const action = STANDARD_ACTIONS?.[body?.actionId];
  const pauseController = constructRecord?.owner || actor;
  if (constructRecord && !isCurrentConstructTurn(constructRecord.owner.id, constructRecord.construct.id)) {
    return { error: `${constructRecord.construct.name} can only use standard actions on its own turn.` };
  }
  if (constructRecord && constructCannotActOnSummonTurn(constructRecord.construct)) {
    return { error: `${constructRecord.construct.name} cannot act on the turn it was summoned.` };
  }
  const pauseError = getPauseActionError(pauseController, { label: action?.label || 'That action' });
  if (pauseError) {
    return { error: pauseError };
  }
  const result = executeStandardActionForEncounter(body, {
    standardActions: getRuntimeStandardActionsForParticipant(actor),
    defaultGuardRestore: DEFAULT_GUARD_RESTORE,
    resolveActor: () => actor,
    applyRecoverAction,
    applyCleanseAction,
    setStatusStacks,
    markTurnActionTaken,
    pushLog: (text, participantId = null, meta = {}) =>
      pushLog(
        text,
        constructRecord && participantId === constructRecord.construct.id
          ? constructRecord.owner.id
          : participantId,
        constructRecord && participantId === constructRecord.construct.id
          ? { ...meta, constructId: constructRecord.construct.id, constructTurn: true }
          : meta
      ),
    touchState,
    broadcastState
  });
  if (result?.error || !result?.participant || !result?.action) {
    return result;
  }
  const participant = result.participant;
  if (constructRecord) {
    constructRecord.owner.constructs = normalizeConstructs(
      (constructRecord.owner.constructs || []).map((entry) =>
        String(entry.id || '') === String(participant.id || '') ? participant : entry
      ),
      constructRecord.owner.id
    );
  }
  const actionId = String(result.action.id || '').toLowerCase();
  let changed = false;
  if (!constructRecord && actionId === 'move') {
    changed = applyShadowMovementProgress(participant, getParticipantMoveDistanceFt(participant)) > 0 || changed;
  } else if (!constructRecord && actionId === 'move_difficult') {
    changed =
      applyShadowMovementProgress(participant, getParticipantMoveDistanceFt(participant, { difficultTerrain: true })) > 0 ||
      changed;
  }
  if (!constructRecord && actionId === 'recover') {
    changed = maybeApplyDivineRecoverHealing(participant, participant, { triggeredBySelfRecover: true, silent: true }) > 0 || changed;
  }
  if (changed) {
    touchState();
    broadcastState('standard_action_set_bonus');
  }
  return result;
}

function spendCardAp(participant, apCost, options = {}) {
  const allowDebt = options.allowDebt === true;
  const available = Math.max(0, Number(participant?.apCurrent || 0));
  if (!allowDebt && available < apCost) {
    return { error: 'Not enough AP' };
  }
  const spentNow = Math.min(available, apCost);
  participant.apCurrent = Number(participant.apCurrent || 0) - spentNow;
  let debtAdded = 0;
  if (allowDebt && apCost > spentNow) {
    debtAdded = apCost - spentNow;
    participant.pendingApDebt = Math.max(0, Math.round(Number(participant.pendingApDebt || 0) + debtAdded));
  }
  if (!allowDebt) {
    participant.apCurrent = Math.max(0, participant.apCurrent);
  }
  return { spentNow, debtAdded };
}

function executeWeaponAttackAction(body = {}) {
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const pauseError = getPauseActionError(participant, { label: 'Weapon attack' });
  if (pauseError) {
    return { error: pauseError };
  }
  const equipmentSummary =
    participant?.derivedBonuses?.equipment && typeof participant.derivedBonuses.equipment === 'object'
      ? participant.derivedBonuses.equipment
      : getParticipantEquipmentSummary(participant);
  const weapon = equipmentSummary.weapon;
  if (!weapon || !hasWeaponBasicAttack(weapon)) {
    return { error: 'No equipped weapon basic attack available.' };
  }
  if (equipmentSummary.handsExceeded) {
    return { error: 'Your equipped loadout exceeds available hands.' };
  }
  const baseDamage = Math.max(0, Number(weapon.basicAttackDamage || 0));
  if (baseDamage <= 0) {
    return { error: `${weapon.name} does not have basic attack damage configured.` };
  }
  const targetId = String(body.targetId || '').trim();
  if (!targetId) {
    return { error: 'Target is required for a weapon attack.' };
  }
  const target = findTargetableEntity(targetId);
  if (!target) {
    return { error: 'Target not found' };
  }
  if (String(target.id || '') === String(participant.id || '')) {
    return { error: 'Weapon attacks cannot target self.' };
  }
  if (!isParticipantEnemy(participant, target)) {
    return { error: 'Weapon attacks can only target enemies.' };
  }
  if (equipmentSummary.weaponMatchType === 'ranged' && Number(target.rangedUntargetableTurns || 0) > 0) {
    return { error: `${target.name} cannot be targeted by ranged attacks right now.` };
  }
  const baseCost = Math.max(1, Number(weapon.basicAttackApCost || 0));
  const apCost = Math.max(1, baseCost + Math.max(0, Number(equipmentSummary.weaponApPenalty || 0)));
  const apSpend = spendCardAp(participant, apCost);
  if (apSpend.error) {
    return apSpend;
  }
  const fauxCard = {
    type: 'Attack',
    tags: [equipmentSummary.weaponMatchType],
    damageType: weapon.basicAttackDamageType || '',
    range: Math.max(0, Number(weapon.rangeFt || (equipmentSummary.weaponMatchType === 'ranged' ? 30 : 5)))
  };
  const nextAttackBonus = Math.max(0, Number(participant.nextAttackDamageBonus || 0));
  const attackStatusDamageModifier = getParticipantAttackStatusDamageModifier(participant, fauxCard, 1);
  const contextualDamageBonus = getParticipantCardDamageBonus(participant, fauxCard, {
    damageType: weapon.basicAttackDamageType || '',
    range: fauxCard.range
  }).total;
  const infernalBrandBonus = getInfernalBrandDamageBonus(target, participant.id);
  const rawDamage = Math.max(
    0,
    baseDamage +
      (participant.damageBonus || 0) +
      contextualDamageBonus +
      nextAttackBonus +
      infernalBrandBonus +
      attackStatusDamageModifier
  );
  const result = applyCardDamageWithType(target, rawDamage, weapon.basicAttackDamageType || '', {
    sourceEntityId: participant.id
  });
  const notes = [];
  if (nextAttackBonus > 0) {
    participant.nextAttackDamageBonus = 0;
    notes.push(`Consumes +${nextAttackBonus} next-attack damage bonus.`);
  }
  if (infernalBrandBonus > 0) {
    notes.push(`Infernal Brand adds +${infernalBrandBonus} damage.`);
  }
  if (equipmentSummary.weaponApPenalty > 0) {
    notes.push(`Equipment penalty adds +${equipmentSummary.weaponApPenalty} AP.`);
  }
  const mitigation =
    result.resisted && !result.vulnerable
      ? ' [Resisted]'
      : result.vulnerable && !result.resisted
        ? ' [Vulnerable]'
        : '';
  const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
  pushLog(
    `${participant.name} attacks ${target.name} with ${weapon.name} (${costText}) for ${result.finalDamage} ${
      weapon.basicAttackDamageType || 'damage'
    } (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}${notes.length ? ` ${notes.join(' ')}` : ''}`,
    participant.id,
    {
      weaponAttack: true,
      targetId: target.id,
      targetIds: [target.id],
      damageType: weapon.basicAttackDamageType || '',
      rawDamage,
      finalDamage: result.finalDamage
    }
  );
  markTurnActionTaken(participant);
  touchState();
  broadcastState('weapon_attack');
  return {
    participant,
    target,
    weapon,
    apCost,
    baseCost,
    result
  };
}

function applyCardProgression(card, participant, notes, options = {}) {
  const chargesMax = Math.max(0, Number(options.chargesMax || 0));
  const chargesCurrent = Math.max(0, Number(options.chargesCurrent || 0));
  let masteryChoicePrompt = null;
  card.masteryUses = Math.max(0, Number(card.masteryUses || 0)) + 1;
  const thresholds = normalizeCardThresholds(card.masteryThresholds, card.tier);
  const beforeLevel = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  let afterLevel = beforeLevel;
  if (card.masteryUses >= thresholds.level2) {
    afterLevel = Math.max(afterLevel, 2);
  }
  if (card.masteryUses >= thresholds.level3) {
    afterLevel = Math.max(afterLevel, 3);
  }
  if (card.masteryUses >= thresholds.level4) {
    afterLevel = Math.max(afterLevel, 4);
  }
  card.masteryLevel = Math.max(1, Math.min(4, afterLevel));
  if (afterLevel > beforeLevel) {
    notes.push(`Mastery increased to Level ${afterLevel}.`);
  }
  const masteryChoiceOptions = Array.isArray(card.masteryChoiceOptions) ? card.masteryChoiceOptions : [];
  if (afterLevel >= 2 && masteryChoiceOptions.length > 1 && !card.masteryChoiceSelected) {
    masteryChoicePrompt = {
      cardId: card.id,
      cardName: card.name,
      options: masteryChoiceOptions.map((option) => ({
        id: option.id,
        label: option.label || option.id
      }))
    };
    notes.push('Choose your Mastery 2 path now; the other option unlocks at Mastery 3.');
  }
  if (chargesMax > 0) {
    card.chargesMax = chargesMax;
    card.chargesCurrent = Math.max(0, chargesCurrent - 1);
    notes.push(`Charges: ${card.chargesCurrent}/${chargesMax}.`);
  }
  markTurnActionTaken(participant);
  return masteryChoicePrompt;
}

function executeConstructCardAction(body = {}) {
  const constructRecord = body?.constructId ? findConstructWithOwner(body.constructId) : null;
  if (!constructRecord?.owner || !constructRecord?.construct) {
    return { error: 'Construct required' };
  }
  const pauseError = getPauseActionError(constructRecord.owner, { label: 'That construct card' });
  if (pauseError) {
    return { error: pauseError };
  }
  const result = performConstructCardAction(constructRecord.owner, constructRecord.construct, body);
  if (result?.error) {
    return result;
  }
  constructRecord.owner.constructs = normalizeConstructs(
    (constructRecord.owner.constructs || []).map((entry) =>
      String(entry.id || '') === String(result.construct.id || '') ? result.construct : entry
    ),
    constructRecord.owner.id
  );
  for (const event of result.events || []) {
    pushLog(`${constructRecord.owner.name}'s ${event}`, constructRecord.owner.id, {
      constructId: result.construct.id,
      cardId: result.card?.id || '',
      constructTurn: true
    });
  }
  touchState();
  broadcastState('construct_card_action');
  return {
    participant: result.construct,
    construct: result.construct,
    owner: constructRecord.owner,
    card: result.card,
    target: result.target || null,
    masteryChoicePrompt: null
  };
}

function executeCardAction(body) {
  if (body?.constructId) {
    return executeConstructCardAction(body);
  }
  const context = resolveCardActionContext(body, { resolveActor, isCardActive });
  if (context.error) {
    return context;
  }
  const { participant, card } = context;
  const pauseError = getPauseActionError(participant, { label: card?.name || 'That card' });
  if (pauseError) {
    return { error: pauseError };
  }
  if (participantHasSuppressedCardLock(participant)) {
    return { error: `${participant.name} is Suppressed and cannot play cards.` };
  }
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
  const masteryLevel = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
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
  const customCardEffect = String(card.customCardEffect || '').trim().toLowerCase();
  const currentTurnParticipant = getCurrentParticipant();
  const isOffTurnForParticipant =
    Boolean(currentTurnParticipant?.id) && currentTurnParticipant.id !== participant.id;
  if (customCardEffect === 'arcane_no' && isOffTurnForParticipant && masteryLevel < 2) {
    return { error: 'No requires Mastery 2 to be used off-turn as a reaction.' };
  }
  const isArcaneNoReaction =
    customCardEffect === 'arcane_no' &&
    masteryLevel >= 2 &&
    isOffTurnForParticipant;
  if (customCardEffect === 'arcane_pause_button' && card?.effectState?.pauseButtonUsedLongRest === true) {
    return { error: 'Pause Button is available once per long rest.' };
  }
  if (isArcaneNoReaction) {
    apCost = Math.max(apCost, 4);
  }
  if (isArcaneNoReaction && Number(arcane.noReactionUsesTurn || 0) >= 3) {
    return { error: 'No can only be used as a reaction 3 times before your next turn.' };
  }
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
      getCardScaledEffectValue(card, 'constructShieldRestoreByLevel', masteryLevel, Number(card.constructShieldRestore || 0))
    )
  );
  const constructShieldRestoreTotal = getEffectShieldRestoreAmount(participant, constructShieldRestore);
  const constructShieldRestoreAlliesOnly = card.constructShieldRestoreAlliesOnly === true;
  const constructHeal = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'constructHealByLevel', masteryLevel, Number(card.constructHeal || 0))
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
  const constructBaseMaxHpRaw = getCardScaledValue(
    getCardScaledEffectValue(card, 'constructMaxHpByLevel', masteryLevel, Number(card.constructMaxHp ?? card.constructHp ?? 1)),
    masteryLevel,
    Number(card.constructMaxHp ?? card.constructHp ?? 1)
  );
  const constructBaseMaxHp = Number.isFinite(Number(constructBaseMaxHpRaw))
    ? Math.max(1, Math.round(Number(constructBaseMaxHpRaw)))
    : 1;
  const constructAuraRadiusFt = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'constructAuraRadiusByLevel', masteryLevel, Number(card.constructAuraRadiusFt || 0))
    )
  );
  const constructDetectDc = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'constructDetectDcByLevel', masteryLevel, Number(card.constructDetectDc || 0))
    )
  );
  const constructVisionRangeFt = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'constructVisionRangeByLevel', masteryLevel, Number(card.constructVisionRangeFt || 0))
    )
  );
  const constructUtilityKind = String(card.constructUtilityKind || '').trim().toLowerCase();
  const constructUtilityNote = String(card.constructUtilityNote || card.constructScoutNote || '').trim();
  const arcaneModifiedCard = arcane.modifiedCard?.cardId === card.id ? arcane.modifiedCard : null;
  if (arcaneModifiedCard?.mode === 'ap') {
    apCost = Math.max(1, apCost - 1);
  }
  const weaponContext = !isConstruct
    ? getParticipantWeaponContextForCard(participant, card, {
        masteryLevel,
        range: getCardScaledEffectValue(card, 'rangeByLevel', masteryLevel, Number(card.range || 0)),
        damageType,
        damage: baseDamage,
        secondaryDamage: secondaryBaseDamage
      })
    : { weapon: null, matches: false, damageBonus: 0, apPenalty: 0 };
  if (weaponContext.matches && weaponContext.apPenalty > 0) {
    apCost += weaponContext.apPenalty;
    notes.push(
      `${weaponContext.weapon?.name || 'Equipped weapon'} adds +${weaponContext.apPenalty} AP (${participant?.derivedBonuses?.equipment?.weaponPenaltyReasons?.join(', ') || 'equipment penalty'}).`
    );
  }
  if (!isArcaneNoReaction && participant.apCurrent < apCost) {
    return { error: 'Not enough AP' };
  }
  const nextAttackBonus = !isConstruct && baseDamage > 0
    ? Math.max(0, Number(participant.nextAttackDamageBonus || 0))
    : 0;
  const attackStatusDamageModifier = !isConstruct && !zoneCard
    ? getParticipantAttackStatusDamageModifier(participant, card, masteryLevel)
    : 0;
  const contextualPrimaryDamageBonus = !isConstruct && !zoneCard && baseDamage > 0
    ? getParticipantCardDamageBonus(participant, card, { masteryLevel, isZone: zoneCard }).total
    : 0;
  const contextualSecondaryDamageBonus = !isConstruct && !zoneCard && secondaryBaseDamage > 0
    ? getParticipantCardDamageBonus(participant, card, {
        masteryLevel,
        damageType: secondaryDamageType,
        isZone: zoneCard
      }).total
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
            (weaponContext.matches ? weaponContext.damageBonus : 0) +
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
          baseDamage +
            (participant.damageBonus || 0) +
            contextualPrimaryDamageBonus +
            (weaponContext.matches ? weaponContext.damageBonus : 0) +
            nextAttackBonus +
            (arcaneModifiedCard?.mode === 'damage' ? 2 : 0) +
            attackStatusDamageModifier
        )
      : 0;
  const secondaryRawDamage = isConstruct
    ? 0
    : secondaryBaseDamage > 0
      ? Math.max(
          0,
          secondaryBaseDamage +
            contextualSecondaryDamageBonus +
            (weaponContext.matches && baseDamage <= 0 ? weaponContext.damageBonus : 0) +
            attackStatusDamageModifier
        )
      : 0;
  const shieldRestoreBase = getCardScaledEffectValue(card, 'shieldRestoreByLevel', masteryLevel, 0);
  const shieldRestoreTotal = getCardShieldRestoreAmount(participant, shieldRestoreBase);
  let healTotal = Math.max(
    0,
    Math.round(getCardScaledEffectValue(card, 'healByLevel', masteryLevel, Number(card.heal || 0)))
  );
  if (healTotal > 0 && hasNature3) {
    healTotal += 2;
  }
  const moveDistanceBase = getCardScaledEffectValue(card, 'movementByLevel', masteryLevel, 0);
  const moveDistance = !isConstruct && moveDistanceBase > 0
    ? Math.max(0, Math.round(moveDistanceBase + Number(getParticipantAttributeScaling(participant).moveFtBonus || 0)))
    : moveDistanceBase;
  const pushDistance = getCardScaledEffectValue(card, 'pushDistanceByLevel', masteryLevel, 0);
  const pullDistance = getCardScaledEffectValue(card, 'pullDistanceByLevel', masteryLevel, 0);
  let statusApply = normalizeCardStatusApply(card, masteryLevel);
  const zoneStatusApply = zoneCard ? normalizeCardStatusApply(card, masteryLevel) : null;
  const zoneEnterStatusBase = zoneCard ? normalizeStatusApplyConfig(card.zoneEnterStatusApply, masteryLevel) : null;
  const zoneEnterStatusApply = zoneEnterStatusBase
    ? {
        ...zoneEnterStatusBase,
        stacks: Math.max(
          1,
          Math.round(
            getCardScaledEffectValue(card, 'zoneEnterStatusStacksByLevel', masteryLevel, zoneEnterStatusBase.stacks)
          )
        )
      }
    : null;
  const zoneEnterDamage = zoneCard
    ? Math.max(
        0,
        Math.round(getCardScaledEffectValue(card, 'zoneEnterDamageByLevel', masteryLevel, Number(card.zoneEnterDamage || 0)))
      )
    : 0;
  const zoneTickOnTurn = card.zoneTickOnTurn !== false;
  const zoneTriggerOnTargetAdd = zoneCard ? (card.zoneTriggerOnTargetAdd === true || zoneEnterDamage > 0 || Boolean(zoneEnterStatusApply)) : false;
  const zoneConsumeOnTrigger = zoneCard && card.zoneConsumeOnTrigger === true;
  const zoneShieldRestore = zoneCard
    ? getEffectShieldRestoreAmount(
        participant,
        Math.max(
          0,
          Math.round(getCardScaledEffectValue(card, 'zoneShieldRestoreByLevel', masteryLevel, Number(card.zoneShieldRestore || 0)))
        )
      )
    : 0;
  const zoneHeal = zoneCard
    ? Math.max(
        0,
        Math.round(getCardScaledEffectValue(card, 'zoneHealByLevel', masteryLevel, Number(card.zoneHeal || 0)))
      )
    : 0;
  const zoneShieldRestoreAlliesOnly = zoneCard ? card.zoneShieldRestoreAlliesOnly !== false : false;
  const zoneHealAlliesOnly = zoneCard ? card.zoneHealAlliesOnly !== false : false;
  const zoneDetectDc = zoneCard
    ? Math.max(
        0,
        Math.round(getCardScaledEffectValue(card, 'zoneDetectDcByLevel', masteryLevel, Number(card.zoneDetectDc || 0)))
      )
    : 0;
  const zoneTriggerMode = zoneCard ? String(card.zoneTriggerMode || '').trim().toLowerCase() : '';
  const selfTarget = isSelfTargetCard(card, masteryLevel);
  const conditionalShieldDamageBonus = Math.max(
    0,
    Math.round(getCardScaledEffectValue(card, 'bonusDamageIfTargetHasShieldByLevel', masteryLevel, Number(card.bonusDamageIfTargetHasShield || 0)))
  );
  const conditionalNotActedDamageBonus = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'bonusDamageIfTargetNotActedByLevel',
        masteryLevel,
        Number(card.bonusDamageIfTargetNotActed || 0)
      )
    )
  );
  const conditionalBelowHalfHpDamageBonus = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'bonusDamageIfTargetBelowHalfHpByLevel',
        masteryLevel,
        Number(card.bonusDamageIfTargetBelowHalfHp || 0)
      )
    )
  );
  const conditionalDamagedCasterLastTurnBonus = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'bonusDamageIfTargetDamagedCasterLastTurnByLevel',
        masteryLevel,
        Number(card.bonusDamageIfTargetDamagedCasterLastTurn || 0)
      )
    )
  );
  const fullyBlockedHpDamage = Math.max(
    0,
    Math.round(getCardScaledEffectValue(card, 'directHpDamageOnFullyBlockedByLevel', masteryLevel, Number(card.directHpDamageOnFullyBlocked || 0)))
  );
  const conditionalTargetStatusId = detectStatusType({
    presetId: card.bonusDamageIfTargetHasStatusId,
    name: card.bonusDamageIfTargetHasStatusName
  });
  const conditionalTargetStatusBonus = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'bonusDamageIfTargetHasStatusByLevel',
        masteryLevel,
        Number(card.bonusDamageIfTargetHasStatus || 0)
      )
    )
  );
  const nextAttackGrant = Math.max(
    0,
    Math.round(getCardScaledEffectValue(card, 'nextAttackDamageBonusByLevel', masteryLevel, Number(card.nextAttackDamageBonus || 0)))
  );
  const cardUtilityNote = String(card.utilityNote || '').trim();
  const effectTextNote = String(card.effect || '').trim();
  const targetApNextTurnGrant = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'grantTargetApNextTurnByLevel',
        masteryLevel,
        Number(card.grantTargetApNextTurn || 0)
      )
    )
  );
  const selfApNextTurnGrant = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'selfApNextTurnByLevel',
        masteryLevel,
        Number(card.selfApNextTurn || 0)
      )
    )
  );
  const apGainNow = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'apGainByLevel',
        masteryLevel,
        Number(card.apGain || 0)
      )
    )
  );
  const removeStatusCount = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'removeStatusCountByLevel',
        masteryLevel,
        Number(card.removeStatusCount ?? card.cleanseStatusCount ?? 0)
      )
    )
  );
  const removeStatusIds = Array.isArray(card.removeStatusIds)
    ? card.removeStatusIds
        .map((entry) => detectStatusType({ presetId: entry, name: entry }))
        .filter(Boolean)
    : String(card.removeStatusIds || card.removeStatusId || '')
        .split(',')
        .map((entry) => detectStatusType({ presetId: entry, name: entry }))
        .filter(Boolean);
  const uniqueRemoveStatusIds = Array.from(new Set(removeStatusIds));
  const selectedRemoveStatusIds = Array.isArray(body.selectedRemoveStatusIds)
    ? body.selectedRemoveStatusIds
        .map((entry) => detectStatusType({ presetId: entry, name: entry }))
        .filter(Boolean)
    : String(body.selectedRemoveStatusIds || '')
        .split(',')
        .map((entry) => detectStatusType({ presetId: entry, name: entry }))
        .filter(Boolean);
  const uniqueSelectedRemoveStatusIds = Array.from(new Set(selectedRemoveStatusIds)).slice(
    0,
    Math.max(0, removeStatusCount)
  );
  const optionalRemoveStatusSelection = card.removeStatusSelectionOptional === true;
  const selfHpLossBase = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'selfHpLossByLevel',
        masteryLevel,
        Number(card.selfHpLoss || 0)
      )
    )
  );
  const selfHpLossPerRemovedStatus = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'selfHpLossPerRemovedStatusByLevel',
        masteryLevel,
        Number(card.selfHpLossPerRemovedStatus || 0)
      )
    )
  );
  const requestedHpSacrifice =
    body.useHpSacrifice === true ||
    String(body.useHpSacrifice || '').trim().toLowerCase() === 'true';
  const rayEnfeeblementEmpowered =
    customCardEffect === 'demonic_ray_of_enfeeblement' &&
    masteryLevel >= 3 &&
    requestedHpSacrifice;
  const selfHpLossTotal =
    selfHpLossBase +
    selfHpLossPerRemovedStatus * uniqueSelectedRemoveStatusIds.length +
    (rayEnfeeblementEmpowered ? 10 : 0);
  const rangedUntargetableTurnsGrant = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'rangedUntargetableTurnsByLevel',
        masteryLevel,
        Number(card.rangedUntargetableTurns || 0)
      )
    )
  );
  const guardActionBonusGrant = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(card, 'guardActionBonusByLevel', masteryLevel, Number(card.guardActionBonus || 0))
    )
  );
  const guardActionBonusTurnsGrant = Math.max(
    0,
    Math.round(
      getCardScaledEffectValue(
        card,
        'guardActionBonusTurnsByLevel',
        masteryLevel,
        Number(card.guardActionBonusTurns || 0)
      )
    )
  );
  const hasAttackDamage = baseDamage > 0 || secondaryBaseDamage > 0;
  const scaledRange = getCardScaledEffectValue(card, 'rangeByLevel', masteryLevel, Number(card.range || 0));
  const isRangedAttackCard = !isConstruct && !zoneCard && hasAttackDamage && Number(scaledRange || 0) > 5;

  const targetId = String(body.targetId || '').trim();
  const target = targetId ? findTargetableEntity(targetId) : null;
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
    .map((id) => findTargetableEntity(id))
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
  const applyTeamTargetRules = (targets = []) => {
    let filtered = Array.isArray(targets) ? targets : [];
    if (card.targetAlliesOnly === true) {
      filtered = filtered.filter((entry) => isParticipantAlly(participant, entry));
    }
    if (card.targetEnemiesOnly === true) {
      filtered = filtered.filter((entry) => isParticipantEnemy(participant, entry));
    }
    return filtered;
  };
  const primaryTargets = targetMode === 'all_others'
    ? applyTeamTargetRules(trackerState.encounter.participants.filter((entry) => entry.id !== participant.id))
    : targetMode === 'multi_select'
      ? selectedTargets
      : primaryTarget
        ? [primaryTarget]
        : [];
  const arcaneSplitTargetId = String(body.arcaneSplitTargetId || '').trim();
  const arcaneSplitTarget = arcaneSplitTargetId ? findTargetableEntity(arcaneSplitTargetId) : null;
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
  if (arcaneSplitTarget && card.targetAlliesOnly === true && !isParticipantAlly(participant, arcaneSplitTarget)) {
    return { error: `${card.name} can only target allies for Arcane split.` };
  }
  if (arcaneSplitTarget && card.targetEnemiesOnly === true && !isParticipantEnemy(participant, arcaneSplitTarget)) {
    return { error: `${card.name} can only target enemies for Arcane split.` };
  }
  if (arcaneSplitTargetId && !canArcaneSplit) {
    return { error: 'Arcane split requires a single-target non-self card with a valid second target.' };
  }
  const effectivePrimaryTargets = canArcaneSplit ? [primaryTarget, arcaneSplitTarget] : primaryTargets;
  const targetDetailsById = normalizeCardTargetDetails(body.targetDetails);
  const contestedEffect = getCardContestedEffectConfig(card, masteryLevel);
  if (contestedEffect && arcaneSplitTargetId) {
    return { error: 'Contested cards cannot use Arcane split.' };
  }

  const secondaryTargetId = String(body.secondaryTargetId || '').trim();
  const secondaryTarget = secondaryTargetId ? findTargetableEntity(secondaryTargetId) : null;
  const requiresTarget =
    targetMode !== 'all_others' &&
    targetMode !== 'none' &&
    !selfTarget &&
    !zoneCard &&
    ((isConstruct && (constructMode === 'damage' || constructMode === 'status') && card.constructAllowUntargetedDeploy !== true) ||
      (isConstruct && constructTargetRequired) ||
      (!isConstruct &&
        (hasAttackDamage ||
          shieldRestoreTotal > 0 ||
          healTotal > 0 ||
          Boolean(customCardEffect) ||
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
  if (card.targetEnemiesOnly === true) {
    const invalidTarget = primaryTargets.find((entry) => !isParticipantEnemy(participant, entry));
    if (invalidTarget) {
      return { error: `${card.name} can only target enemies.` };
    }
  }
  const invalidEntityTarget = primaryTargets.find((entry) => !isEntityKindAllowedForCard(card, entry));
  if (invalidEntityTarget) {
    return { error: `${card.name} cannot target ${isConstructEntity(invalidEntityTarget) ? 'constructs' : 'participants'}.` };
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
  if (isRangedAttackCard) {
    const protectedPrimary = effectivePrimaryTargets.find((entry) => Number(entry.rangedUntargetableTurns || 0) > 0);
    if (protectedPrimary) {
      return { error: `${protectedPrimary.name} cannot be targeted by ranged attacks right now.` };
    }
    if (secondaryTarget && Number(secondaryTarget.rangedUntargetableTurns || 0) > 0) {
      return { error: `${secondaryTarget.name} cannot be targeted by ranged attacks right now.` };
    }
  }
  let contestedResolutions = [];
  if (contestedEffect) {
    if (!effectivePrimaryTargets.length) {
      return { error: `${card.name} requires a target for its contested effect.` };
    }
    if (!['single', 'multi_select'].includes(targetMode)) {
      return { error: `${card.name} has an unsupported contested target mode.` };
    }
    const defaultChoiceId = contestedEffect.options.length === 1 ? contestedEffect.options[0].id : '';
    const choiceId = String(body.contestedChoiceId || body.contestedEffectId || defaultChoiceId).trim();
    const choice = contestedEffect.options.find((entry) => entry.id === choiceId);
    if (!choice) {
      return { error: `Choose a ${card.name} effect option.` };
    }
    const contestedTargetOutcomes = normalizeContestedTargetOutcomes(body.contestedTargetOutcomes);
    contestedResolutions = effectivePrimaryTargets.map((entry) => {
      const hostileTarget = contestedEffect.hostileOnly && isParticipantEnemy(participant, entry);
      const outcome =
        targetMode === 'multi_select'
          ? hostileTarget
            ? contestedTargetOutcomes[entry.id] || ''
            : 'success'
          : hostileTarget
            ? normalizeContestedOutcome(body.contestedOutcome)
            : 'success';
      return {
        target: entry,
        choice,
        hostileTarget,
        outcome: hostileTarget ? outcome : 'success'
      };
    });
    const unresolvedTarget = contestedResolutions.find((entry) => entry.hostileTarget && !entry.outcome);
    if (unresolvedTarget) {
      return { error: `Resolve whether ${unresolvedTarget.target.name} resists ${card.name}.` };
    }
  }
  if (customCardEffect === 'arcane_rift') {
    if (effectivePrimaryTargets.length !== 2) {
      return { error: 'Arcane Rift requires exactly 2 targets.' };
    }
    for (const entry of effectivePrimaryTargets) {
      const detail = targetDetailsById[entry.id];
      if (!detail) {
        return { error: `Enter Arcane Rift details for ${entry.name}.` };
      }
      if (!Number.isFinite(Number(detail.distanceFt)) || Number(detail.distanceFt) < 0) {
        return { error: `Enter a valid teleport distance for ${entry.name}.` };
      }
    }
  }
  if (customCardEffect === 'arcane_polymorph_matrix') {
    for (const entry of effectivePrimaryTargets) {
      const detail = targetDetailsById[entry.id];
      const formName = String(detail?.formName || detail?.form || '').trim();
      if (!formName) {
        return { error: `Enter a chosen form for ${entry.name}.` };
      }
    }
  }
  if (zoneCard) {
    participant.zones = normalizeZones(participant.zones, participant.id);
    if (participant.zones.length >= MAX_ACTIVE_ZONES) {
      return { error: `You can only have ${MAX_ACTIVE_ZONES} active zones at once.` };
    }
  }

  const currentActionSnapshot = createEncounterCardActionSnapshot();
  if (customCardEffect === 'arcane_no') {
    if (isArcaneNoReaction) {
      const previousAction = getLatestCardActionHistoryEntry();
      if (!previousAction?.snapshot) {
        return { error: 'No recent card effect is available to reverse.' };
      }
      if (!restoreEncounterFromCardSnapshot(previousAction.snapshot)) {
        return { error: 'Failed to restore the previous card state.' };
      }
      if (cardActionHistory.length) {
        cardActionHistory.pop();
      }
      const restoredParticipant = findParticipant(participant.id);
      if (!restoredParticipant) {
        return { error: 'The No user could not be resolved after reversing the previous card.' };
      }
      const restoredCard = (restoredParticipant.cards || []).find((entry) => String(entry.id || '') === String(card.id || ''));
      if (!restoredCard) {
        return { error: 'The No card could not be found after reversing the previous card.' };
      }
      const restoredArcane = ensureSetRuntime(restoredParticipant).arcane;
      const apSpend = spendCardAp(restoredParticipant, apCost, { allowDebt: true });
      if (apSpend.error) {
        return apSpend;
      }
      restoredArcane.noReactionUsesTurn = Math.max(0, Number(restoredArcane.noReactionUsesTurn || 0)) + 1;
      if (apSpend.debtAdded > 0) {
        notes.push(`Adds ${apSpend.debtAdded} AP debt to future turns.`);
      }
      notes.push(`Reverses the previous card: ${previousAction.cardName || previousAction.cardId || 'unknown card'}.`);
      const masteryChoicePrompt = applyCardProgression(restoredCard, restoredParticipant, notes, {
        chargesMax,
        chargesCurrent
      });
      const noteText = notes.length ? ` ${notes.join(' ')}` : '';
      const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
      pushLog(`${restoredParticipant.name} plays ${restoredCard.name} (${costText}).${noteText}`, restoredParticipant.id, {
        cardId: restoredCard.id,
        apCost,
        baseCost,
        targetId: null,
        targetIds: [],
        secondaryTargetId: null,
        arcaneSplitTargetId: null,
        targetMode: 'none',
        damageType: '',
        secondaryDamageType: '',
        rawDamage: 0,
        secondaryRawDamage: 0,
        finalDamage: 0,
        construct: null,
        zone: null,
        reversedCardId: previousAction.cardId || null,
        reversedCardName: previousAction.cardName || null,
        reaction: true
      });
      recordCardActionHistoryEntry({
        participantId: restoredParticipant.id,
        cardId: restoredCard.id,
        cardName: restoredCard.name,
        snapshot: currentActionSnapshot
      });
      touchState();
      broadcastState('card_action');
      return {
        participant: restoredParticipant,
        card: restoredCard,
        apCost,
        baseCost,
        target: null,
        targets: [],
        secondaryTarget: null,
        masteryChoicePrompt
      };
    }

    const zoneId = String(body.zoneId || '').trim();
    if (!zoneId) {
      return { error: 'Choose a zone to cancel.' };
    }
    const zoneResult = findZoneWithOwner(zoneId);
    if (!zoneResult?.owner || !zoneResult?.zone) {
      return { error: 'Selected zone was not found.' };
    }
    const apSpend = spendCardAp(participant, apCost);
    if (apSpend.error) {
      return apSpend;
    }
    zoneResult.owner.zones = normalizeZones(zoneResult.owner.zones, zoneResult.owner.id).filter(
      (entry) => String(entry.id || '') !== zoneResult.zone.id
    );
    ensureCurrentIndex();
    notes.push(`Cancels ${zoneResult.owner.name}'s zone ${zoneResult.zone.name}.`);
    const masteryChoicePrompt = applyCardProgression(card, participant, notes, {
      chargesMax,
      chargesCurrent
    });
    const noteText = notes.length ? ` ${notes.join(' ')}` : '';
    const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
    pushLog(`${participant.name} plays ${card.name} (${costText}).${noteText}`, participant.id, {
      cardId: card.id,
      apCost,
      baseCost,
      targetId: null,
      targetIds: [],
      secondaryTargetId: null,
      arcaneSplitTargetId: null,
      targetMode: 'none',
      damageType: '',
      secondaryDamageType: '',
      rawDamage: 0,
      secondaryRawDamage: 0,
      finalDamage: 0,
      construct: null,
      zone: null,
      cancelledZoneId: zoneResult.zone.id,
      cancelledZoneOwnerId: zoneResult.owner.id
    });
    recordCardActionHistoryEntry({
      participantId: participant.id,
      cardId: card.id,
      cardName: card.name,
      snapshot: currentActionSnapshot
    });
    touchState();
    broadcastState('card_action');
    return {
      participant,
      card,
      apCost,
      baseCost,
      target: null,
      targets: [],
      secondaryTarget: null,
      masteryChoicePrompt
    };
  }

  if (customCardEffect === 'arcane_two_step') {
    const apSpend = spendCardAp(participant, apCost);
    if (apSpend.error) {
      return apSpend;
    }
    const durationTurns = Math.max(
      0,
      Math.round(getCardScaledEffectValue(card, 'durationTurnsByLevel', masteryLevel, masteryLevel >= 2 ? 3 : 2))
    );
    upsertTimedStatus(participant, {
      presetId: 'two_step',
      name: 'Two Step',
      stacks: 1,
      notes: 'End of turn: resolve a 10 ft forward horizontal teleport if space is open.',
      remainingTurns: durationTurns
    });
    notes.push(`Two Step is active for ${durationTurns} turn${durationTurns === 1 ? '' : 's'}.`);
    notes.push('End-of-turn teleport resolution remains GM-adjudicated until map occupancy is tracked.');
    const masteryChoicePrompt = applyCardProgression(card, participant, notes, {
      chargesMax,
      chargesCurrent
    });
    const noteText = notes.length ? ` ${notes.join(' ')}` : '';
    const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
    pushLog(`${participant.name} plays ${card.name} (${costText}).${noteText}`, participant.id, {
      cardId: card.id,
      apCost,
      baseCost,
      targetId: participant.id,
      targetIds: [participant.id],
      secondaryTargetId: null,
      arcaneSplitTargetId: null,
      targetMode: 'self',
      damageType: '',
      secondaryDamageType: '',
      rawDamage: 0,
      secondaryRawDamage: 0,
      finalDamage: 0,
      construct: null,
      zone: null,
      customStatus: 'two_step'
    });
    recordCardActionHistoryEntry({
      participantId: participant.id,
      cardId: card.id,
      cardName: card.name,
      snapshot: currentActionSnapshot
    });
    touchState();
    broadcastState('card_action');
    return {
      participant,
      card,
      apCost,
      baseCost,
      target: participant,
      targets: [participant],
      secondaryTarget: null,
      masteryChoicePrompt
    };
  }

  if (customCardEffect === 'arcane_haste_matrix') {
    if (!primaryTarget || isConstructEntity(primaryTarget)) {
      return { error: 'Choose an allied creature to hasten.' };
    }
    if (!isParticipantAlly(participant, primaryTarget)) {
      return { error: 'Haste Matrix can only target allies.' };
    }
    const effectState = card.effectState && typeof card.effectState === 'object' ? card.effectState : {};
    const targetCounts =
      effectState.hasteMatrixTargetCounts && typeof effectState.hasteMatrixTargetCounts === 'object'
        ? effectState.hasteMatrixTargetCounts
        : {};
    const priorCount = Math.max(0, Math.round(Number(targetCounts[primaryTarget.id] || 0)));
    if (priorCount >= 2) {
      return { error: `${primaryTarget.name} has already been targeted by Haste Matrix twice this encounter.` };
    }
    const apSpend = spendCardAp(participant, apCost);
    if (apSpend.error) {
      return apSpend;
    }
    const durationTurns = Math.max(
      0,
      Math.round(getCardScaledEffectValue(card, 'durationTurnsByLevel', masteryLevel, masteryLevel >= 2 ? 3 : 2))
    );
    upsertTimedStatus(primaryTarget, {
      presetId: 'haste_matrix',
      name: 'Haste Matrix',
      stacks: 1,
      notes: 'Start of turn: gain +2 AP. On expiry: gain Haste Crash (-4 AP next turn).',
      remainingTurns: durationTurns
    });
    card.effectState = {
      ...effectState,
      hasteMatrixTargetCounts: {
        ...targetCounts,
        [primaryTarget.id]: priorCount + 1
      }
    };
    notes.push(
      `${primaryTarget.name} gains Haste Matrix for ${durationTurns} turn${durationTurns === 1 ? '' : 's'} (${priorCount + 1}/2 encounter uses on this target).`
    );
    const masteryChoicePrompt = applyCardProgression(card, participant, notes, {
      chargesMax,
      chargesCurrent
    });
    const noteText = notes.length ? ` ${notes.join(' ')}` : '';
    const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
    pushLog(`${participant.name} plays ${card.name} (${costText}).${noteText}`, participant.id, {
      cardId: card.id,
      apCost,
      baseCost,
      targetId: primaryTarget.id,
      targetIds: [primaryTarget.id],
      secondaryTargetId: null,
      arcaneSplitTargetId: null,
      targetMode: 'single',
      damageType: '',
      secondaryDamageType: '',
      rawDamage: 0,
      secondaryRawDamage: 0,
      finalDamage: 0,
      construct: null,
      zone: null,
      customStatus: 'haste_matrix'
    });
    recordCardActionHistoryEntry({
      participantId: participant.id,
      cardId: card.id,
      cardName: card.name,
      snapshot: currentActionSnapshot
    });
    touchState();
    broadcastState('card_action');
    return {
      participant,
      card,
      apCost,
      baseCost,
      target: primaryTarget,
      targets: [primaryTarget],
      secondaryTarget: null,
      masteryChoicePrompt
    };
  }

  if (customCardEffect === 'arcane_pause_button') {
    if (!trackerState.encounter.started) {
      return { error: 'Pause Button requires an active encounter.' };
    }
    if (!currentTurnParticipant || currentTurnParticipant.id !== participant.id) {
      return { error: 'Pause Button can only be used on your own turn.' };
    }
    if (getEncounterPauseState()) {
      return { error: 'Pause Button cannot be used while time is already paused.' };
    }
    const effectState = card.effectState && typeof card.effectState === 'object' ? card.effectState : {};
    if (effectState.pauseButtonUsedLongRest) {
      return { error: 'Pause Button is available once per long rest.' };
    }
    const apSpend = spendCardAp(participant, apCost);
    if (apSpend.error) {
      return apSpend;
    }
    const durationTurns = Math.max(
      1,
      Math.round(getCardScaledEffectValue(card, 'durationTurnsByLevel', masteryLevel, masteryLevel >= 2 ? 2 : 1))
    );
    const pauseAp = Math.max(
      0,
      Math.round(getCardScaledEffectValue(card, 'pauseApByLevel', masteryLevel, masteryLevel >= 2 ? 4 : 2))
    );
    card.effectState = {
      ...effectState,
      pauseButtonUsedLongRest: true
    };
    participant.pauseButtonSkipTurns = Math.max(0, Number(participant.pauseButtonSkipTurns || 0)) + 1;
    setEncounterPauseState({
      casterId: participant.id,
      sourceCardId: card.id,
      extraTurnsRemaining: durationTurns,
      apPerTurn: pauseAp,
      activeTurn: false
    });
    notes.push(
      `After this turn, time pauses for ${durationTurns} extra turn${durationTurns === 1 ? '' : 's'} and ${participant.name} may act with ${pauseAp} AP each paused turn.`
    );
    notes.push('While time is paused, zone timing, construct timing, incoming delayed effects, and round-based triggers are suspended.');
    notes.push(`${participant.name} will forfeit their next normal turn.`);
    const masteryChoicePrompt = applyCardProgression(card, participant, notes, {
      chargesMax,
      chargesCurrent
    });
    const noteText = notes.length ? ` ${notes.join(' ')}` : '';
    const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
    pushLog(`${participant.name} plays ${card.name} (${costText}).${noteText}`, participant.id, {
      cardId: card.id,
      apCost,
      baseCost,
      targetId: participant.id,
      targetIds: [participant.id],
      secondaryTargetId: null,
      arcaneSplitTargetId: null,
      targetMode: 'self',
      damageType: '',
      secondaryDamageType: '',
      rawDamage: 0,
      secondaryRawDamage: 0,
      finalDamage: 0,
      construct: null,
      zone: null,
      pauseButton: {
        extraTurnsRemaining: durationTurns,
        apPerTurn: pauseAp
      }
    });
    recordCardActionHistoryEntry({
      participantId: participant.id,
      cardId: card.id,
      cardName: card.name,
      snapshot: currentActionSnapshot
    });
    touchState();
    broadcastState('card_action');
    return {
      participant,
      card,
      apCost,
      baseCost,
      target: participant,
      targets: [participant],
      secondaryTarget: null,
      masteryChoicePrompt
    };
  }

  if (customCardEffect === 'demonic_infernal_brand') {
    if (!primaryTarget) {
      return { error: 'Infernal Brand requires a target.' };
    }
    const apSpend = spendCardAp(participant, apCost);
    if (apSpend.error) {
      return apSpend;
    }
    const durationTurns = Math.max(
      1,
      Math.round(getCardScaledEffectValue(card, 'durationTurnsByLevel', masteryLevel, 2))
    );
    const bonusDamage = Math.max(
      0,
      Math.round(
        getCardScaledEffectValue(
          card,
          'infernalBrandBonusDamageByLevel',
          masteryLevel,
          Number(card.infernalBrandBonusDamage || 2)
        )
      )
    );
    upsertTimedStatus(primaryTarget, {
      presetId: 'infernal_brand',
      name: 'Infernal Brand',
      stacks: 1,
      notes: `${participant.name}'s attacks deal +${bonusDamage} damage while active.`,
      remainingTurns: durationTurns,
      sourceParticipantId: participant.id,
      stackBySource: true,
      damageBonus: bonusDamage
    });
    notes.push(
      `${primaryTarget.name} is marked with Infernal Brand for ${durationTurns} turn${durationTurns === 1 ? '' : 's'} (+${bonusDamage} damage on ${participant.name}'s attacks).`
    );
    const masteryChoicePrompt = applyCardProgression(card, participant, notes, {
      chargesMax,
      chargesCurrent
    });
    const noteText = notes.length ? ` ${notes.join(' ')}` : '';
    const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
    pushLog(`${participant.name} plays ${card.name} (${costText}).${noteText}`, participant.id, {
      cardId: card.id,
      apCost,
      baseCost,
      targetId: primaryTarget.id,
      targetIds: [primaryTarget.id],
      secondaryTargetId: null,
      arcaneSplitTargetId: null,
      targetMode: 'single',
      damageType: '',
      secondaryDamageType: '',
      rawDamage: 0,
      secondaryRawDamage: 0,
      finalDamage: 0,
      construct: null,
      zone: null,
      customStatus: 'infernal_brand',
      infernalBrand: {
        durationTurns,
        bonusDamage
      }
    });
    recordCardActionHistoryEntry({
      participantId: participant.id,
      cardId: card.id,
      cardName: card.name,
      snapshot: currentActionSnapshot
    });
    touchState();
    broadcastState('card_action');
    return {
      participant,
      card,
      apCost,
      baseCost,
      target: primaryTarget,
      targets: [primaryTarget],
      secondaryTarget: null,
      masteryChoicePrompt
    };
  }

  if (customCardEffect === 'demonic_blood_curse') {
    if (!primaryTarget || isConstructEntity(primaryTarget)) {
      return { error: 'Blood Curse requires a creature target.' };
    }
    const apSpend = spendCardAp(participant, apCost);
    if (apSpend.error) {
      return apSpend;
    }
    const durationTurns = Math.max(
      1,
      Math.round(getCardScaledEffectValue(card, 'durationTurnsByLevel', masteryLevel, 2))
    );
    const hpLossPerTurn = Math.max(
      0,
      Math.round(
        getCardScaledEffectValue(
          card,
          'bloodCurseHpLossByLevel',
          masteryLevel,
          Number(card.bloodCurseHpLoss || 3)
        )
      )
    );
    upsertTimedStatus(primaryTarget, {
      presetId: 'blood_curse',
      name: 'Blood Curse',
      stacks: 1,
      notes: `Lose ${hpLossPerTurn} HP at the start of your turn while active.`,
      remainingTurns: durationTurns,
      sourceParticipantId: participant.id,
      stackBySource: true,
      hpLossPerTurn
    });
    notes.push(
      `${primaryTarget.name} is afflicted with Blood Curse for ${durationTurns} turn${durationTurns === 1 ? '' : 's'} (${hpLossPerTurn} HP loss each turn).`
    );
    const masteryChoicePrompt = applyCardProgression(card, participant, notes, {
      chargesMax,
      chargesCurrent
    });
    const noteText = notes.length ? ` ${notes.join(' ')}` : '';
    const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
    pushLog(`${participant.name} plays ${card.name} (${costText}).${noteText}`, participant.id, {
      cardId: card.id,
      apCost,
      baseCost,
      targetId: primaryTarget.id,
      targetIds: [primaryTarget.id],
      secondaryTargetId: null,
      arcaneSplitTargetId: null,
      targetMode: 'single',
      damageType: '',
      secondaryDamageType: '',
      rawDamage: 0,
      secondaryRawDamage: 0,
      finalDamage: 0,
      construct: null,
      zone: null,
      customStatus: 'blood_curse',
      bloodCurse: {
        durationTurns,
        hpLossPerTurn
      }
    });
    recordCardActionHistoryEntry({
      participantId: participant.id,
      cardId: card.id,
      cardName: card.name,
      snapshot: currentActionSnapshot
    });
    touchState();
    broadcastState('card_action');
    return {
      participant,
      card,
      apCost,
      baseCost,
      target: primaryTarget,
      targets: [primaryTarget],
      secondaryTarget: null,
      masteryChoicePrompt
    };
  }

  if (customCardEffect === 'demonic_curse_of_weakness') {
    if (!primaryTarget || isConstructEntity(primaryTarget)) {
      return { error: 'Curse of Weakness requires a creature target.' };
    }
    const apSpend = spendCardAp(participant, apCost);
    if (apSpend.error) {
      return apSpend;
    }
    const durationTurns = Math.max(
      1,
      Math.round(getCardScaledEffectValue(card, 'durationTurnsByLevel', masteryLevel, 2))
    );
    const attackDamageModifier = Math.round(
      getCardScaledEffectValue(
        card,
        'curseOfWeaknessDamageModifierByLevel',
        masteryLevel,
        Number(card.curseOfWeaknessDamageModifier || -3)
      )
    );
    upsertTimedStatus(primaryTarget, {
      presetId: 'curse_of_weakness',
      name: 'Curse of Weakness',
      stacks: 1,
      notes: `Your attacks deal ${attackDamageModifier} damage while active.`,
      remainingTurns: durationTurns,
      attackDamageModifier
    });
    notes.push(
      `${primaryTarget.name}'s attacks deal ${attackDamageModifier} damage for ${durationTurns} turn${durationTurns === 1 ? '' : 's'}.`
    );
    const masteryChoicePrompt = applyCardProgression(card, participant, notes, {
      chargesMax,
      chargesCurrent
    });
    const noteText = notes.length ? ` ${notes.join(' ')}` : '';
    const costText = apCost === baseCost ? `${apCost} AP` : `${apCost} AP (from ${baseCost})`;
    pushLog(`${participant.name} plays ${card.name} (${costText}).${noteText}`, participant.id, {
      cardId: card.id,
      apCost,
      baseCost,
      targetId: primaryTarget.id,
      targetIds: [primaryTarget.id],
      secondaryTargetId: null,
      arcaneSplitTargetId: null,
      targetMode: 'single',
      damageType: '',
      secondaryDamageType: '',
      rawDamage: 0,
      secondaryRawDamage: 0,
      finalDamage: 0,
      construct: null,
      zone: null,
      customStatus: 'curse_of_weakness',
      curseOfWeakness: {
        durationTurns,
        attackDamageModifier
      }
    });
    recordCardActionHistoryEntry({
      participantId: participant.id,
      cardId: card.id,
      cardName: card.name,
      snapshot: currentActionSnapshot
    });
    touchState();
    broadcastState('card_action');
    return {
      participant,
      card,
      apCost,
      baseCost,
      target: primaryTarget,
      targets: [primaryTarget],
      secondaryTarget: null,
      masteryChoicePrompt
    };
  }

  participant.apCurrent = Math.max(0, participant.apCurrent - apCost);

  if (!isConstruct && selfHpLossTotal > 0) {
    const hpLoss = Math.min(Math.max(0, Number(participant.hp || 0)), selfHpLossTotal);
    if (hpLoss > 0) {
      participant.hp = Math.max(0, participant.hp - hpLoss);
      notes.push(`${participant.name} loses ${hpLoss} HP.`);
    }
    if (rayEnfeeblementEmpowered && statusApply) {
      statusApply = { ...statusApply, stacks: Math.max(2, Number(statusApply.stacks || 1)) };
      notes.push('Ray of Enfeeblement is empowered to apply Weakened 2.');
    }
  }

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
    hasAttackDamage ||
    shieldRestoreTotal > 0 ||
    healTotal > 0 ||
    Boolean(customCardEffect) ||
    moveDistance > 0 ||
    pushDistance > 0 ||
    pullDistance > 0 ||
    Boolean(statusApply) ||
    nextAttackGrant > 0 ||
    targetApNextTurnGrant > 0 ||
    selfApNextTurnGrant > 0 ||
    apGainNow > 0 ||
    removeStatusCount > 0 ||
    uniqueRemoveStatusIds.length > 0 ||
    rangedUntargetableTurnsGrant > 0 ||
    (guardActionBonusGrant > 0 && guardActionBonusTurnsGrant > 0) ||
    Boolean(contestedEffect);
  const demonicStatusProc = Boolean(statusApply) && ['bleeding', 'poisoned', 'burning'].includes(statusApply?.id);
  const addDamageResult = (damageTarget, amount, type, source = 'primary', options = {}) => {
    if (!damageTarget || amount <= 0) return;
    if (customCardEffect === 'demonic_gaze_into_the_abyss' && getStatusStacks(damageTarget, 'blinded') > 0) {
      notes.push(`${damageTarget.name} is Blinded and unaffected by ${card.name}.`);
      return;
    }
    const shieldConditionalBonus = Math.max(0, Number(options.bonusIfTargetHasShield || 0));
    const notActedConditionalBonus = Math.max(0, Number(options.bonusIfTargetNotActed || 0));
    const belowHalfHpConditionalBonus = Math.max(0, Number(options.bonusIfTargetBelowHalfHp || 0));
    const damagedCasterLastTurnBonus = Math.max(0, Number(options.bonusIfTargetDamagedCasterLastTurn || 0));
    const directHpOnFullyBlocked = Math.max(0, Number(options.directHpOnFullyBlocked || 0));
    const bleedingBefore = getStatusStacks(damageTarget, 'bleeding');
    const hadStatusesBefore = Array.isArray(damageTarget.statuses) && damageTarget.statuses.length > 0;
    const infernalBrandBonus = getInfernalBrandDamageBonus(damageTarget, participant.id);
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
    let notActedBonusApplied = 0;
    let belowHalfHpBonusApplied = 0;
    let damagedCasterLastTurnBonusApplied = 0;
    let targetStatusBonusApplied = 0;
    let infernalBrandBonusApplied = 0;
    if (setDamageBonus > 0) {
      appliedAmount += setDamageBonus;
    }
    if (shieldConditionalBonus > 0 && damageTarget.shield > 0) {
      appliedAmount += shieldConditionalBonus;
      shieldBonusApplied = shieldConditionalBonus;
    }
    if (notActedConditionalBonus > 0 && !hasParticipantActedThisRound(damageTarget)) {
      appliedAmount += notActedConditionalBonus;
      notActedBonusApplied = notActedConditionalBonus;
    }
    if (
      belowHalfHpConditionalBonus > 0 &&
      Number(damageTarget.maxHp || 0) > 0 &&
      Number(damageTarget.hp || 0) * 2 < Number(damageTarget.maxHp || 0)
    ) {
      appliedAmount += belowHalfHpConditionalBonus;
      belowHalfHpBonusApplied = belowHalfHpConditionalBonus;
    }
    if (damagedCasterLastTurnBonus > 0 && didEntityDamageParticipantLastTurn(participant, damageTarget)) {
      appliedAmount += damagedCasterLastTurnBonus;
      damagedCasterLastTurnBonusApplied = damagedCasterLastTurnBonus;
    }
    if (
      conditionalTargetStatusBonus > 0 &&
      conditionalTargetStatusId &&
      getStatusStacks(damageTarget, conditionalTargetStatusId) > 0
    ) {
      appliedAmount += conditionalTargetStatusBonus;
      targetStatusBonusApplied = conditionalTargetStatusBonus;
    }
    if (infernalBrandBonus > 0) {
      appliedAmount += infernalBrandBonus;
      infernalBrandBonusApplied = infernalBrandBonus;
    }
    const result = applyCardDamageWithType(damageTarget, appliedAmount, type, {
      sourceEntityId: participant.id
    });
    result.shieldBonusDamage = shieldBonusApplied;
    result.notActedBonusDamage = notActedBonusApplied;
    result.belowHalfHpBonusDamage = belowHalfHpBonusApplied;
    result.damagedCasterLastTurnBonusDamage = damagedCasterLastTurnBonusApplied;
    result.targetStatusBonusDamage = targetStatusBonusApplied;
    result.targetStatusBonusStatusId = conditionalTargetStatusId;
    result.infernalBrandBonusDamage = infernalBrandBonusApplied;
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
    const destroyedConstruct = removeDefeatedConstructByEntity(damageTarget);
    if (destroyedConstruct) {
      result.destroyedConstruct = destroyedConstruct.construct;
      result.destroyedConstructOwner = destroyedConstruct.owner;
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
  if (!isConstruct && apGainNow > 0) {
    participant.apCurrent = Math.max(0, participant.apCurrent + apGainNow);
    notes.push(`Gains +${apGainNow} AP this turn.`);
  }
  if (isConstruct) {
    constructDeployResult = deployConstructFromCard(participant, card, {
      masteryLevel,
      targetId: primaryTarget?.id || null,
      targetIds: effectivePrimaryTargets.map((entry) => entry.id),
      baseDamage,
      damageType,
      bonusDamage: constructDamageBonus,
      durationBonusTurns: constructDurationBonus,
      mode: constructMode,
      statusId: constructStatusId,
      statusName: constructStatusName,
      statusStacks: constructStatusStacks,
      shieldRestore: constructShieldRestoreTotal,
      shieldRestoreAlliesOnly: constructShieldRestoreAlliesOnly,
      heal: constructHeal,
      healAlliesOnly: constructHealAlliesOnly,
      healTargetOnly: constructHealTargetOnly,
      triggerOnTargetTurn: constructTriggerOnTargetTurn,
      maxHpCasterConBonus: constructMaxHpCasterConBonus,
      maxHpOverride: constructBaseMaxHp,
      auraRadiusFt: constructAuraRadiusFt,
      detectDc: constructDetectDc,
      visionRangeFt: constructVisionRangeFt,
      utilityKind: constructUtilityKind,
      utilityNote: constructUtilityNote
    });
    const constructDurationText =
      constructDeployResult.construct.remainingTurns > 0
        ? `${constructDeployResult.construct.remainingTurns} turn${constructDeployResult.construct.remainingTurns === 1 ? '' : 's'}`
        : 'until removed';
    notes.push(
      `Deploys ${constructDeployResult.construct.name} (${describeConstructSummary(constructDeployResult.construct)}, ${constructDurationText}).`
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
      shieldRestoreAlliesOnly: zoneShieldRestoreAlliesOnly,
      healAlliesOnly: zoneHealAlliesOnly
    });
    const zone = zoneDeployResult.zone;
    if (zone.triggerOnTargetAdd && effectivePrimaryTargets.length) {
      effectivePrimaryTargets.forEach((entry) => {
        const events = applyZoneTargetAddTriggers(participant, zone, entry);
        events.forEach((event) => notes.push(event));
      });
    }
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
          bonusIfTargetNotActed: conditionalNotActedDamageBonus,
          bonusIfTargetBelowHalfHp: conditionalBelowHalfHpDamageBonus,
          bonusIfTargetDamagedCasterLastTurn: conditionalDamagedCasterLastTurnBonus,
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
      const recipients = targetMode === 'all_others' ? primaryTargets : effectivePrimaryTargets;
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
      const recipients = targetMode === 'all_others' ? primaryTargets : effectivePrimaryTargets;
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
      const divineShieldGain = getEffectShieldRestoreAmount(participant, 2);
      const shieldRecipients = [];
      for (const ally of healedAllies) {
        const beforeShield = ally.shield;
        ally.shield = Math.min(ally.maxShield, ally.shield + divineShieldGain);
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
    if (optionalRemoveStatusSelection && !uniqueSelectedRemoveStatusIds.length) {
      // Cards like Infernal Offering can optionally cleanse; a blank selection means "heal only".
    } else {
    const cleanseTargets =
      targetMode === 'all_others'
        ? primaryTargets
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
      if (uniqueSelectedRemoveStatusIds.length) {
        for (const statusId of uniqueSelectedRemoveStatusIds) {
          if (removedStatuses.length >= removeStatusCount) break;
          const existingStacks = getStatusStacks(statusTarget, statusId);
          if (existingStacks <= 0) continue;
          setStatusStacks(statusTarget, statusId, 0);
          removedStatuses.push(statusDisplayName(statusId));
        }
      } else {
        for (let index = 0; index < removeStatusCount; index += 1) {
          const removed = clearOneStatusEffect(statusTarget);
          if (!removed) break;
          removedStatuses.push(removed);
        }
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
  }

  if (!isConstruct && uniqueRemoveStatusIds.length > 0) {
    const specificCleanseTargets =
      targetMode === 'all_others'
        ? primaryTargets
        : targetMode === 'multi_select'
          ? effectivePrimaryTargets
          : selfTarget
            ? [participant]
            : primaryTarget
              ? [primaryTarget]
              : [participant];
    const specificCleanseSummaries = [];
    for (const statusTarget of specificCleanseTargets) {
      if (!statusTarget) continue;
      const removedStatuses = [];
      for (const statusId of uniqueRemoveStatusIds) {
        const existingStacks = getStatusStacks(statusTarget, statusId);
        if (existingStacks <= 0) continue;
        setStatusStacks(statusTarget, statusId, 0);
        removedStatuses.push(statusDisplayName(statusId));
      }
      enforceControlHierarchy(statusTarget);
      if (removedStatuses.length) {
        specificCleanseSummaries.push(`${statusTarget.name} (${removedStatuses.join(', ')})`);
      }
    }
    if (specificCleanseSummaries.length) {
      notes.push(`Removes specific statuses: ${specificCleanseSummaries.join('; ')}.`);
    } else {
      notes.push('No matching statuses were found for specific cleanse.');
    }
  }

  for (const contestedResolution of contestedResolutions) {
    if (!contestedResolution) continue;
    if (contestedResolution.outcome === 'resisted') {
      const backlashAmount = Math.max(0, Number(contestedEffect?.resistedCasterDamage || 0));
      if (backlashAmount > 0) {
        const backlash = applyCardDamageWithType(
          participant,
          backlashAmount,
          contestedEffect?.resistedDamageType || 'Psychic',
          { sourceEntityId: contestedResolution.target.id }
        );
        const destroyedCasterConstruct = removeDefeatedConstructByEntity(participant);
        if (destroyedCasterConstruct) {
          backlash.destroyedConstruct = destroyedCasterConstruct.construct;
        }
        notes.push(
          `${contestedResolution.target.name} resists. ${participant.name} takes ${backlash.finalDamage} ${
            contestedEffect?.resistedDamageType || 'Psychic'
          } damage (${backlash.shieldDamage} Shield, ${backlash.hpDamage} HP).${
            backlash.preventedByDivine ? ' [Reversed by Divine]' : ''
          }`
        );
      } else {
        notes.push(`${contestedResolution.target.name} resists ${card.name}.`);
      }
      continue;
    }
    if (contestedResolution.outcome === 'success') {
      contestedResolution.choice.clearStatuses.forEach((entry) => {
        removeStatusEntry(contestedResolution.target, { id: entry, name: entry });
      });
      const appliedStatus = upsertTimedStatus(contestedResolution.target, {
        presetId: contestedResolution.choice.statusId,
        name: contestedResolution.choice.statusName,
        notes: contestedResolution.choice.statusNotes,
        stacks: contestedResolution.choice.statusStacks,
        remainingTurns: contestedResolution.choice.durationTurns
      });
      if (appliedStatus) {
        notes.push(
          `Applies ${appliedStatus.name}${appliedStatus.stacks > 1 ? ` ${appliedStatus.stacks}` : ''} to ${contestedResolution.target.name}${
            appliedStatus.remainingTurns > 0
              ? ` for ${appliedStatus.remainingTurns} turn${appliedStatus.remainingTurns === 1 ? '' : 's'}`
              : ''
          }.`
        );
      }
    }
  }

  if (!isConstruct && customCardEffect === 'arcane_polymorph_matrix') {
    const polymorphSummaries = [];
    for (const contestedResolution of contestedResolutions) {
      if (!contestedResolution || contestedResolution.outcome !== 'success') continue;
      const detail = targetDetailsById[contestedResolution.target.id] || {};
      const formName = String(detail.formName || detail.form || '').trim();
      if (!formName) continue;
      const appliedStatus = upsertTimedStatus(contestedResolution.target, {
        presetId: 'polymorphed',
        name: 'Polymorphed',
        stacks: 1,
        notes: `Form: ${formName}. GM resolves transformed statistics and capabilities.`,
        remainingTurns: Math.max(0, Number(contestedResolution.choice?.durationTurns || 0))
      });
      if (appliedStatus) {
        polymorphSummaries.push(`${contestedResolution.target.name} -> ${formName}`);
      }
    }
    if (polymorphSummaries.length) {
      notes.push(`Chosen forms: ${polymorphSummaries.join('; ')}.`);
    }
  }

  if (!isConstruct && rangedUntargetableTurnsGrant > 0) {
    participant.rangedUntargetableTurns = Math.max(
      Math.max(0, Number(participant.rangedUntargetableTurns || 0)),
      rangedUntargetableTurnsGrant
    );
    notes.push(`Cannot be targeted by ranged attacks for ${participant.rangedUntargetableTurns} turn(s).`);
  }

  if (!isConstruct && guardActionBonusGrant > 0 && guardActionBonusTurnsGrant > 0) {
    participant.guardActionBonus = Math.max(
      Math.max(0, Number(participant.guardActionBonus || 0)),
      guardActionBonusGrant
    );
    participant.guardActionBonusTurns = Math.max(
      Math.max(0, Number(participant.guardActionBonusTurns || 0)),
      guardActionBonusTurnsGrant
    );
    notes.push(
      `Guard action gains +${participant.guardActionBonus} Shield for ${participant.guardActionBonusTurns} turn(s).`
    );
  }

  if (!isConstruct && targetApNextTurnGrant > 0) {
    const apTargets =
      targetMode === 'all_others'
        ? primaryTargets
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

  if (!isConstruct && selfApNextTurnGrant > 0) {
    participant.pendingApNextTurn = Math.max(
      0,
      Math.round(Number(participant.pendingApNextTurn || 0) + selfApNextTurnGrant)
    );
    notes.push(`${participant.name} gains +${selfApNextTurnGrant} AP on their next turn.`);
  }

  if (!isConstruct && moveDistance > 0) {
    notes.push(`Moves ${moveDistance} ft.`);
    applyShadowMovementProgress(participant, moveDistance, notes);
  }
  if (!isConstruct && pushDistance > 0) {
    const pushTargets =
      targetMode === 'all_others'
        ? primaryTargets
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
        ? primaryTargets
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
  if (!isConstruct && customCardEffect === 'arcane_rift') {
    const teleportedTargets = [];
    const backlashDamageType = String(card.backlashDamageType || 'Psychic').trim();
    for (const entry of effectivePrimaryTargets) {
      const detail = targetDetailsById[entry.id] || {};
      const distanceFt = Math.max(0, Math.round(Number(detail.distanceFt || 0)));
      const willing = detail.willing === true;
      teleportedTargets.push(`${entry.name} (${distanceFt} ft${willing ? ', willing' : ', unwilling'})`);
      if (!willing && distanceFt > 0) {
        const backlashAmount = Math.max(0, Math.ceil(distanceFt * 1.5));
        const backlash = applyCardDamageWithType(participant, backlashAmount, backlashDamageType, {
          sourceEntityId: entry.id
        });
        const mitigation =
          backlash.resisted && !backlash.vulnerable
            ? ' [resisted]'
            : backlash.vulnerable && !backlash.resisted
              ? ' [vulnerable]'
              : '';
        notes.push(
          `Arcane Rift backlash from ${entry.name}: ${participant.name} takes ${backlash.finalDamage} ${backlashDamageType} damage (${backlash.shieldDamage} Shield, ${backlash.hpDamage} HP).${mitigation}${
            backlash.preventedByDivine ? ' [Reversed by Divine]' : ''
          }`
        );
      }
    }
    if (teleportedTargets.length) {
      notes.push(`Arcane Rift teleports ${teleportedTargets.join('; ')}.`);
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
        ? primaryTargets
        : targetMode === 'multi_select'
          ? effectivePrimaryTargets
        : selfTarget
          ? [participant]
          : primaryTarget
            ? effectivePrimaryTargets
            : [];
    if (statusTargets.length) {
      const appliedTargets = [];
      statusTargets.forEach((statusTarget) => {
        if (statusApply.isCustom) {
          addCustomStatus(statusTarget, {
            name: statusApply.name,
            stacks: statusStacks,
            notes: statusApply.notes
          });
          appliedTargets.push(statusTarget.name);
        } else {
          if (addStatusStacks(statusTarget, statusApply.id, statusStacks)) {
            appliedTargets.push(statusTarget.name);
          }
        }
        enforceControlHierarchy(statusTarget);
      });
      if (appliedTargets.length) {
        notes.push(
          `Applies ${statusApply.name || statusDisplayName(statusApply.id)} ${statusStacks} to ${appliedTargets.join(', ')}.`
        );
      }
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
        ? primaryTargets
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

  const masteryChoicePrompt = applyCardProgression(card, participant, notes, {
    chargesMax,
    chargesCurrent
  });
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
          const notActedConditional =
            entry.result.notActedBonusDamage > 0
              ? ` [+${entry.result.notActedBonusDamage} vs Unacted]`
              : '';
          const belowHalfConditional =
            entry.result.belowHalfHpBonusDamage > 0
              ? ` [+${entry.result.belowHalfHpBonusDamage} vs <50% HP]`
              : '';
          const statusConditional =
            entry.result.targetStatusBonusDamage > 0
              ? ` [+${entry.result.targetStatusBonusDamage} vs ${
                  statusDisplayName(entry.result.targetStatusBonusStatusId) || 'status'
                }]`
              : '';
          const fullyBlocked =
            entry.result.directHpDamage > 0
              ? ` [Fully Blocked: +${entry.result.directHpDamage} direct HP]`
              : '';
          const setBonus = entry.result.setBonusDamage > 0 ? ` [+${entry.result.setBonusDamage} set bonus]` : '';
          const divineReverse = entry.result.preventedByDivine ? ' [Reversed by Divine]' : '';
          const destroyedConstruct = entry.result.destroyedConstruct ? ' [Construct destroyed]' : '';
          return `${entry.target.name} takes ${entry.result.finalDamage} ${entry.damageType || 'damage'} (${entry.result.shieldDamage} Shield, ${entry.result.hpDamage} HP).${mitigation}${conditional}${notActedConditional}${belowHalfConditional}${statusConditional}${fullyBlocked}${setBonus}${divineReverse}${destroyedConstruct}`;
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
  recordCardActionHistoryEntry({
    participantId: participant.id,
    cardId: card.id,
    cardName: card.name,
    snapshot: currentActionSnapshot
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
    zone: zoneDeployResult?.zone || null,
    masteryChoicePrompt
  };
}

function executeSetCardMasteryChoiceAction(body = {}) {
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const cardId = String(body.cardId || '').trim();
  if (!cardId) {
    return { error: 'cardId is required' };
  }
  participant.cards = normalizeCards(participant.cards);
  const card = participant.cards.find((entry) => String(entry.id || '').trim() === cardId);
  if (!card) {
    return { error: 'Card not found' };
  }
  const options = Array.isArray(card.masteryChoiceOptions) ? card.masteryChoiceOptions : [];
  if (!options.length) {
    return { error: 'Card has no mastery choice options' };
  }
  const masteryLevel = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  if (masteryLevel < 2) {
    return { error: 'Mastery choice is available at Mastery 2 or higher' };
  }
  const choiceId = String(body.choiceId || '').trim();
  const selected = options.find((entry) => String(entry.id || '').trim() === choiceId);
  if (!selected) {
    return { error: 'Invalid mastery choice option' };
  }
  const existingChoiceId = String(card.masteryChoiceSelected || '').trim();
  if (existingChoiceId && existingChoiceId !== selected.id) {
    return { error: 'Mastery choice already selected for this card' };
  }
  card.masteryChoiceSelected = selected.id;
  recalculateParticipant(participant);
  pushLog(`${participant.name} selects ${selected.label} for ${card.name} mastery.`, participant.id, {
    cardId: card.id,
    masteryChoiceId: selected.id
  });
  touchState();
  broadcastState('card_mastery_choice');
  return { participant, card };
}

function executeRemoveConstructAction(body) {
  const participant = resolveActor(body?.participantId);
  const pauseError = getPauseActionError(participant, { label: 'Construct removal' });
  if (pauseError) {
    return { error: pauseError };
  }
  return executeRemoveConstructActionForEncounter(body, {
    resolveActor,
    pushLog,
    touchState,
    broadcastState
  });
}

function executeRetargetConstructAction(body) {
  const participant = resolveActor(body?.participantId);
  const pauseError = getPauseActionError(participant, { label: 'Construct retargeting' });
  if (pauseError) {
    return { error: pauseError };
  }
  return executeRetargetConstructActionForEncounter(body, {
    resolveActor,
    findTargetableEntity,
    pushLog,
    touchState,
    broadcastState
  });
}

function executeMoveConstructAction(body) {
  const participant = resolveActor(body?.participantId);
  const pauseError = getPauseActionError(participant, { label: 'Construct movement' });
  if (pauseError) {
    return { error: pauseError };
  }
  const constructId = String(body?.constructId || '').trim();
  if (constructId) {
    const found = findConstructWithOwner(constructId);
    if (found?.construct && constructHasManualTurn(found.construct) && !isCurrentConstructTurn(found.owner.id, found.construct.id)) {
      return { error: `${found.construct.name} can only move on its own turn.` };
    }
    if (found?.construct && constructCannotActOnSummonTurn(found.construct)) {
      return { error: `${found.construct.name} cannot act on the turn it was summoned.` };
    }
  }
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

function findZoneWithOwner(zoneId) {
  const targetId = String(zoneId || '').trim();
  if (!targetId) return null;
  for (const participant of trackerState.encounter.participants || []) {
    if (!participant?.id) continue;
    const zone = findZone(participant, targetId);
    if (zone) {
      return { owner: participant, zone };
    }
  }
  return null;
}

function executeAddZoneTargetAction(body) {
  const participant = resolveActor(body?.participantId);
  const pauseError = getPauseActionError(participant, { label: 'Zone targeting' });
  if (pauseError) {
    return { error: pauseError };
  }
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
  const participant = resolveActor(body?.participantId);
  const pauseError = getPauseActionError(participant, { label: 'Zone targeting' });
  if (pauseError) {
    return { error: pauseError };
  }
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
  const pauseError = getPauseActionError(participant, { label: 'Set ally assignment' });
  if (pauseError) {
    return { error: pauseError };
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
  const pauseError = getPauseActionError(participant, { label: 'Set ally removal' });
  if (pauseError) {
    return { error: pauseError };
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
  const pauseError = getPauseActionError(participant, { label: 'Set bonus activation' });
  if (pauseError) {
    return { error: pauseError };
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
  const participant = resolveActor(body?.actorId);
  const pauseError = getPauseActionError(participant, { label: 'Custom action' });
  if (pauseError) {
    return { error: pauseError };
  }
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
    participant.apCurrent = normalizeCurrentAp(ap, participant.apMax);
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
    'apCurrent',
    'hp',
    'shield',
    'mastery',
    'nextAttackDamageBonus',
    'pendingApNextTurn',
    'pendingApDebt',
    'pauseButtonSkipTurns'
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
  if (body.equipment && typeof body.equipment === 'object') {
    update.equipment = normalizeParticipantEquipment(body.equipment);
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
  if (Array.isArray(body.immunities)) {
    update.immunities = normalizeImmunities(body.immunities);
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
  const normalizedStats = {};
  for (const key of ABILITY_KEYS) {
    normalizedStats[key] = normalizeAbilityScoreValue(body?.stats?.[key], 10);
  }
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
    initiative: 0,
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
    equipment: normalizeParticipantEquipment(body.equipment),
    currencies: normalizeCurrencyEntries(body.currencies),
    quests: normalizeJournalEntries(body.quests, 'quest'),
    achievements: normalizeJournalEntries(body.achievements, 'achievement'),
    resistances: normalizeDamageTypes(body.resistances),
    vulnerabilities: normalizeDamageTypes(body.vulnerabilities),
    immunities: normalizeImmunities(body.immunities),
    notes: body.notes || '',
    setFocus: body.setFocus || '',
    stats: normalizedStats,
    proficiencyBonus: typeof body.proficiencyBonus === 'number' ? body.proficiencyBonus : 2,
    savingThrows: normalizeSavingThrows(body.savingThrows),
    skills: normalizeSkills(body.skills),
    relics: normalizeRelics(body.relics),
    turnActionCount: Number.isFinite(Number(body.turnActionCount)) ? Math.max(0, Number(body.turnActionCount)) : 0,
    lastActedRound: Number.isFinite(Number(body.lastActedRound)) ? Number(body.lastActedRound) : 0,
    setRuntime: normalizeSetRuntime(body.setRuntime),
    guardUsedThisTurn: false,
    guardRestore: baseStats.guardRestore,
    shieldRegen: 0,
    damageBonus: baseStats.damageBonus,
    nextAttackDamageBonus: Number.isFinite(Number(body.nextAttackDamageBonus))
      ? Math.max(0, Math.round(Number(body.nextAttackDamageBonus)))
      : 0,
    pendingApNextTurn: Number.isFinite(Number(body.pendingApNextTurn))
      ? Math.max(0, Math.round(Number(body.pendingApNextTurn)))
      : 0,
    pendingApDebt: Number.isFinite(Number(body.pendingApDebt))
      ? Math.max(0, Math.round(Number(body.pendingApDebt)))
      : 0,
    pauseButtonSkipTurns: Number.isFinite(Number(body.pauseButtonSkipTurns))
      ? Math.max(0, Math.round(Number(body.pauseButtonSkipTurns)))
      : 0,
    rangedUntargetableTurns: Number.isFinite(Number(body.rangedUntargetableTurns))
      ? Math.max(0, Math.round(Number(body.rangedUntargetableTurns)))
      : 0,
    guardActionBonus: Number.isFinite(Number(body.guardActionBonus))
      ? Math.max(0, Math.round(Number(body.guardActionBonus)))
      : 0,
    guardActionBonusTurns: Number.isFinite(Number(body.guardActionBonusTurns))
      ? Math.max(0, Math.round(Number(body.guardActionBonusTurns)))
      : 0,
    baseStats,
    derivedBonuses: {
      base: baseStats,
      totals: createZeroModifier(),
      abilityBonuses: createZeroAbilityBonuses(),
      effectiveStats: buildEffectiveAbilityScores(normalizedStats, createZeroAbilityBonuses()),
      attributeScaling: getAttributeScalingFromScores(buildEffectiveAbilityScores(normalizedStats, createZeroAbilityBonuses())),
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
  if (typeof body.apCurrent !== 'number') {
    participant.apCurrent = participant.apMax;
  }
  if (typeof body.hp !== 'number') {
    participant.hp = participant.maxHp;
  }
  if (typeof body.shield !== 'number') {
    participant.shield = participant.maxShield;
  }
  return participant;
}

function createParticipantPresetTemplate(source = {}, options = {}) {
  const body = source && typeof source === 'object' ? source : {};
  const baseStats = body.baseStats && typeof body.baseStats === 'object' ? body.baseStats : {};
  const maxHpSource = Number.isFinite(Number(body.maxHp)) ? Number(body.maxHp) : Number(baseStats.maxHp);
  const maxShieldSource = Number.isFinite(Number(body.maxShield)) ? Number(body.maxShield) : Number(baseStats.maxShield);
  const apMaxSource = Number.isFinite(Number(body.apMax)) ? Number(body.apMax) : Number(baseStats.apMax);
  const baseGuardRestoreSource = Number.isFinite(Number(body.baseGuardRestore))
    ? Number(body.baseGuardRestore)
    : Number(baseStats.guardRestore);
  const baseDamageBonusSource = Number.isFinite(Number(body.baseDamageBonus))
    ? Number(body.baseDamageBonus)
    : Number(baseStats.damageBonus);
  const maxHp = Number.isFinite(maxHpSource) ? Math.max(1, Math.round(maxHpSource)) : 20;
  const maxShield = Number.isFinite(maxShieldSource) ? Math.max(0, Math.round(maxShieldSource)) : 0;
  const apMax = Number.isFinite(apMaxSource) ? Math.max(1, Math.round(apMaxSource)) : 6;
  const name = String(options.name || body.name || 'Preset Character').trim() || 'Preset Character';
  const tags = Array.isArray(body.tags)
    ? body.tags.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  const stats = {};
  for (const key of ABILITY_KEYS) {
    stats[key] = normalizeAbilityScoreValue(body?.stats?.[key], 10);
  }
  return {
    name,
    team: normalizeTeamName(body.team),
    setFocus: String(body.setFocus || '').trim(),
    apMax,
    maxHp,
    maxShield,
    mastery: Number.isFinite(Number(body.mastery)) ? Math.max(1, Math.round(Number(body.mastery))) : 1,
    cards: structuredClone(normalizeCards(body.cards)),
    tags,
    abilities: structuredClone(normalizeAbilityEntries(body.abilities)),
    proficiencies: normalizeTextList(body.proficiencies),
    languages: normalizeTextList(body.languages),
    inventory: structuredClone(normalizeInventoryEntries(body.inventory)),
    equipment: structuredClone(normalizeParticipantEquipment(body.equipment)),
    currencies: structuredClone(normalizeCurrencyEntries(body.currencies)),
    resistances: normalizeDamageTypes(body.resistances),
    vulnerabilities: normalizeDamageTypes(body.vulnerabilities),
    immunities: normalizeImmunities(body.immunities),
    notes: String(body.notes || '').trim(),
    stats,
    proficiencyBonus: Number.isFinite(Number(body.proficiencyBonus)) ? Math.round(Number(body.proficiencyBonus)) : 2,
    savingThrows: structuredClone(normalizeSavingThrows(body.savingThrows)),
    skills: structuredClone(normalizeSkills(body.skills)),
    relics: structuredClone(normalizeRelics(body.relics)),
    baseGuardRestore: Number.isFinite(baseGuardRestoreSource)
      ? Math.round(baseGuardRestoreSource)
      : DEFAULT_GUARD_RESTORE,
    baseDamageBonus: Number.isFinite(baseDamageBonusSource)
      ? Math.round(baseDamageBonusSource)
      : 0
  };
}

function normalizeCharacterPreset(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const presetName = String(source.name || source.template?.name || source.participant?.name || 'Preset Character').trim() || 'Preset Character';
  const templateSource =
    source.template && typeof source.template === 'object'
      ? source.template
      : source.participant && typeof source.participant === 'object'
        ? source.participant
        : source;
  const createdAt = String(source.createdAt || new Date().toISOString());
  const updatedAt = String(source.updatedAt || createdAt);
  return {
    id: String(source.id || randomUUID()),
    name: presetName,
    description: String(source.description || '').trim(),
    template: createParticipantPresetTemplate(templateSource, { name: presetName }),
    createdAt,
    updatedAt
  };
}

function normalizeCharacterPresetLibrary(list = []) {
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const normalized = [];
  for (const entry of list) {
    const preset = normalizeCharacterPreset(entry);
    if (!preset.id || seenIds.has(preset.id)) continue;
    seenIds.add(preset.id);
    normalized.push(preset);
  }
  return normalized;
}

function upsertCharacterPreset(raw = {}) {
  const preset = normalizeCharacterPreset(raw);
  const existingIndex = characterPresetLibrary.findIndex((entry) => entry.id === preset.id);
  if (existingIndex >= 0) {
    preset.createdAt = characterPresetLibrary[existingIndex].createdAt || preset.createdAt;
    characterPresetLibrary[existingIndex] = preset;
  } else {
    characterPresetLibrary.push(preset);
  }
  refreshReferenceData();
  return preset;
}

function getEncounterExportPayload() {
  return {
    ...structuredClone(trackerState.encounter),
    characterPresets: structuredClone(characterPresetLibrary)
  };
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

function beginPausedTurn(participant, pauseState) {
  participant.apCurrent = Math.max(0, Number(pauseState?.apPerTurn || 0));
  participant.guardUsedThisTurn = false;
  participant.turnActionCount = 0;
  participant.lastActedRound = trackerState.encounter.round;
  resetSetTurnState(participant);
  return [`acts while Pause Button holds the world still (${participant.apCurrent} AP).`];
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
  const pauseStateAtAdvance = direction > 0 ? getEncounterPauseState() : null;
  const previousWasPausedTurn = Boolean(
    direction > 0 &&
      pauseStateAtAdvance?.activeTurn &&
      previousEntry?.kind === 'participant' &&
      previousEntry.participantId === pauseStateAtAdvance.casterId
  );
  if (direction > 0 && previousEntry?.kind === 'participant') {
    const previousActor = findParticipant(previousEntry.participantId);
    if (previousActor) {
      if (!previousWasPausedTurn) {
        const timedStatusEvents = decrementTimedStatusesAtEndOfTurn(previousActor);
        timedStatusEvents.forEach((event) => pushLog(`${previousActor.name} ${event}`, previousActor.id));
        const endEvents = applyEndOfTurnSetEffects(previousActor);
        endEvents.forEach((event) => pushLog(`${previousActor.name} ${event}`, previousActor.id));
      }
      const pauseState = pauseStateAtAdvance;
      if (pauseState && pauseState.casterId === previousActor.id) {
        if (pauseState.activeTurn) {
          pauseState.activeTurn = false;
        }
        if (pauseState.extraTurnsRemaining > 0) {
          pauseState.extraTurnsRemaining -= 1;
          pauseState.activeTurn = true;
          setEncounterPauseState(pauseState);
          setCurrentTurnByIndex(entries, previousIndex);
          const pauseEvents = beginPausedTurn(previousActor, pauseState);
          pauseEvents.forEach((event) => pushLog(`${previousActor.name} ${event}`, previousActor.id, { pauseTurn: true }));
          pushLog(`Time remains paused. ${previousActor.name} takes a paused turn (AP ${previousActor.apCurrent}).`, previousActor.id, {
            pauseTurn: true
          });
          touchState();
          broadcastState('turn_advanced');
          return;
        }
        clearEncounterPauseState();
      }
    }
  }
  if (direction > 0 && previousEntry?.kind === 'construct') {
    const previousOwner = findParticipant(previousEntry.participantId);
    const previousConstruct = previousOwner ? findConstructWithOwner(previousEntry.constructId)?.construct : null;
    if (previousOwner && previousConstruct) {
      const endEvents = finishConstructTurn(previousOwner, previousConstruct);
      endEvents.forEach((event) =>
        pushLog(`${previousOwner.name}'s ${event}`, previousOwner.id, {
          constructId: previousConstruct.id,
          constructTurn: true
        })
      );
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
  } else if (entry?.kind === 'construct') {
    const owner = findParticipant(entry.participantId);
    const construct = owner ? findConstructWithOwner(entry.constructId)?.construct : null;
    if (owner && construct) {
      const startEvents = beginConstructTurn(owner, construct);
      owner.constructs = normalizeConstructs(
        (owner.constructs || []).map((item) => (String(item.id || '') === String(construct.id || '') ? construct : item)),
        owner.id
      );
      startEvents.forEach((event) =>
        pushLog(`${owner.name}'s ${construct.name} ${event}`, owner.id, {
          constructId: construct.id,
          constructTurn: true
        })
      );
      pushLog(`It is now ${owner.name}'s construct turn: ${construct.name} (AP ${construct.apCurrent}).`, owner.id, {
        constructId: construct.id,
        constructTurn: true
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
  runtime.demonic.damagedByLastTurnIds = normalizeIdList(runtime.demonic.damagedByPendingIds || []);
  runtime.demonic.damagedByPendingIds = [];
  const events = [];
  const shieldRegen = Math.max(0, Math.round(Number(participant.shieldRegen || 0)));
  if (shieldRegen > 0 && participant.maxShield > 0 && participant.shield < participant.maxShield) {
    const beforeShield = participant.shield;
    participant.shield = Math.min(participant.maxShield, participant.shield + shieldRegen);
    const restored = participant.shield - beforeShield;
    if (restored > 0) {
      events.push(`regenerates ${restored} Shield from equipment.`);
    }
  }
  const rangedUntargetableTurns = Math.max(0, Number(participant.rangedUntargetableTurns || 0));
  if (rangedUntargetableTurns > 0) {
    participant.rangedUntargetableTurns = Math.max(0, rangedUntargetableTurns - 1);
    if (participant.rangedUntargetableTurns <= 0) {
      events.push('is no longer protected from ranged targeting.');
    }
  }
  const guardActionBonusTurns = Math.max(0, Number(participant.guardActionBonusTurns || 0));
  if (guardActionBonusTurns > 0) {
    participant.guardActionBonusTurns = Math.max(0, guardActionBonusTurns - 1);
    if (participant.guardActionBonusTurns <= 0) {
      participant.guardActionBonus = 0;
      events.push('loses the temporary Guard boost.');
    }
  } else if (Number(participant.guardActionBonus || 0) > 0) {
    participant.guardActionBonus = 0;
  }
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
  if (Number(participant.pendingApDebt || 0) > 0) {
    const debt = Math.max(0, Math.round(Number(participant.pendingApDebt || 0)));
    participant.apCurrent -= debt;
    participant.pendingApDebt = Math.max(0, debt - participant.apMax);
    events.push(`loses ${debt} AP to reaction debt.`);
  }
  let resolvedEvents = events;
  if (options.applyStatusTick) {
    const statusEvents = applyStartOfTurnStatusEffects(participant);
    const constructEvents = applyConstructStartOfTurnEffects(participant);
    const incomingConstructEvents = applyIncomingConstructTurnEffects(participant);
    resolvedEvents = [...events, ...statusEvents, ...constructEvents, ...incomingConstructEvents];
  }
  if (Number(participant.pauseButtonSkipTurns || 0) > 0) {
    participant.apCurrent = 0;
    participant.pauseButtonSkipTurns = Math.max(0, Number(participant.pauseButtonSkipTurns || 0) - 1);
    resolvedEvents = [...resolvedEvents, 'forfeits this turn from Pause Button.'];
  }
  return resolvedEvents;
}

function clampParticipant(participant) {
  participant.apCurrent = normalizeCurrentAp(participant.apCurrent, participant.apMax);
  participant.hp = clampNumber(participant.hp, 0, participant.maxHp);
  participant.shield = clampNumber(participant.shield, 0, participant.maxShield);
}

function getCurrentTurnEntry() {
  return getCurrentTurnEntryForEncounter(trackerState.encounter, normalizeZones);
}

function getCurrentParticipant() {
  return getCurrentParticipantForEncounter(trackerState.encounter, normalizeZones);
}

function isCurrentConstructTurn(ownerId, constructId) {
  const entry = getCurrentTurnEntry();
  return (
    entry?.kind === 'construct' &&
    String(entry.participantId || '') === String(ownerId || '') &&
    String(entry.constructId || '') === String(constructId || '')
  );
}

function findParticipant(id) {
  return findParticipantInEncounter(trackerState.encounter, id);
}

function isConstructEntity(target) {
  return String(target?.entityKind || '').trim().toLowerCase() === 'construct';
}

function findConstructWithOwner(id) {
  const targetId = String(id || '').trim();
  if (!targetId) return null;
  for (const owner of trackerState.encounter.participants || []) {
    if (!owner) continue;
    owner.constructs = normalizeConstructs(owner.constructs, owner.id);
    const construct = (owner.constructs || []).find((entry) => String(entry.id || '').trim() === targetId);
    if (construct) {
      return { owner, construct };
    }
  }
  return null;
}

function getConstructCardObjects(construct = {}) {
  return normalizeCards(
    Array.isArray(construct?.cardObjects)
      ? construct.cardObjects
      : Array.isArray(construct?.constructCardObjects)
        ? construct.constructCardObjects
        : []
  ).map((card) => ({ ...card, active: true }));
}

function findConstructCard(construct = {}, cardId = '') {
  const cards = getConstructCardObjects(construct);
  if (!cards.length) return { cards, card: null };
  const targetId = String(cardId || '').trim();
  const card = targetId
    ? cards.find((entry) => String(entry.id || '').trim() === targetId) || null
    : cards.find((entry) => entry.active !== false) || cards[0] || null;
  return { cards, card };
}

function findLowestHpEnemyTargetForOwner(owner, options = {}) {
  if (!owner?.id) return null;
  const excludeIds = new Set(
    (Array.isArray(options.excludeIds) ? options.excludeIds : [options.excludeIds])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  );
  return getEncounterTargetablesForOwner(owner)
    .filter((entry) => entry?.id && !excludeIds.has(String(entry.id || '')))
    .filter((entry) => Number(entry.hp || 0) > 0)
    .filter((entry) => isParticipantEnemy(owner, entry))
    .sort((left, right) => {
      const hpCompare = Number(left.hp || 0) - Number(right.hp || 0);
      if (hpCompare !== 0) return hpCompare;
      const maxHpCompare = Number(left.maxHp || 0) - Number(right.maxHp || 0);
      if (maxHpCompare !== 0) return maxHpCompare;
      return String(left.name || '').localeCompare(String(right.name || ''));
    })[0] || null;
}

function getEncounterTargetablesForOwner(owner) {
  const entries = [];
  for (const participant of trackerState.encounter.participants || []) {
    if (!participant?.id) continue;
    entries.push(participant);
    for (const construct of participant.constructs || []) {
      if (!construct?.id) continue;
      entries.push({
        ...construct,
        entityKind: 'construct',
        ownerId: participant.id
      });
    }
  }
  return entries.filter((entry) => String(entry.id || '').trim() !== String(owner?.id || '').trim());
}

function maybeAssignConstructPriorityTarget(owner, construct) {
  if (!owner?.id || !construct?.id) return null;
  const current = construct.targetId ? findTargetableEntity(construct.targetId) : null;
  if (current && Number(current.hp || 0) > 0) {
    return current;
  }
  if (String(construct.targetPriority || '').trim().toLowerCase() === 'lowest_hp_enemy') {
    const target = findLowestHpEnemyTargetForOwner(owner, { excludeIds: [construct.id] });
    if (target?.id) {
      construct.targetId = target.id;
      return target;
    }
  }
  return current || null;
}

function findTargetableEntity(id) {
  return findParticipant(id) || findConstructWithOwner(id)?.construct || null;
}

function findTargetableOwner(target) {
  if (!target) return null;
  if (isConstructEntity(target)) {
    return findParticipant(target.ownerId);
  }
  return findParticipant(target.id) || target;
}

function removeDefeatedConstructByEntity(target) {
  if (!isConstructEntity(target) || Number(target?.hp || 0) > 0) return null;
  const found = findConstructWithOwner(target.id);
  if (!found) return null;
  found.owner.constructs = (found.owner.constructs || []).filter((entry) => String(entry.id || '') !== String(target.id || ''));
  return found;
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

function createEncounterCardActionSnapshot() {
  return structuredClone({
    name: trackerState.encounter.name,
    round: trackerState.encounter.round,
    started: trackerState.encounter.started,
    currentIndex: trackerState.encounter.currentIndex,
    currentTurnKey: trackerState.encounter.currentTurnKey,
    pauseState: trackerState.encounter.pauseState,
    participants: trackerState.encounter.participants || [],
    log: trackerState.encounter.log || []
  });
}

function recordCardActionHistoryEntry(entry = {}) {
  if (!entry?.snapshot) return null;
  const historyEntry = {
    id: randomUUID(),
    at: new Date().toISOString(),
    participantId: String(entry.participantId || '').trim(),
    cardId: String(entry.cardId || '').trim(),
    cardName: String(entry.cardName || '').trim(),
    snapshot: entry.snapshot
  };
  cardActionHistory.push(historyEntry);
  if (cardActionHistory.length > 30) {
    cardActionHistory.shift();
  }
  return historyEntry;
}

function getLatestCardActionHistoryEntry() {
  return cardActionHistory.length ? cardActionHistory[cardActionHistory.length - 1] : null;
}

function restoreEncounterFromCardSnapshot(snapshot = null) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  trackerState.encounter.name = String(snapshot.name || trackerState.encounter.name || 'Untitled Encounter');
  trackerState.encounter.round = Number(snapshot.round) || 1;
  trackerState.encounter.started = Boolean(snapshot.started);
  trackerState.encounter.currentIndex =
    typeof snapshot.currentIndex === 'number' ? snapshot.currentIndex : -1;
  trackerState.encounter.currentTurnKey = String(snapshot.currentTurnKey || '');
  trackerState.encounter.pauseState =
    snapshot.pauseState && typeof snapshot.pauseState === 'object'
      ? structuredClone(snapshot.pauseState)
      : null;
  trackerState.encounter.participants = Array.isArray(snapshot.participants)
    ? snapshot.participants.map((entry) => createParticipant(entry))
    : [];
  trackerState.encounter.log = Array.isArray(snapshot.log) ? snapshot.log.slice(-200) : [];
  sortParticipants();
  ensureCurrentIndex();
  return true;
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
  participant.pauseButtonSkipTurns = 0;
  resetEncounterCardState(participant);
  resetLongRestCardState(participant);
  return result;
}

function normalizeEncounterPauseState(state = null) {
  if (!state || typeof state !== 'object') return null;
  const casterId = String(state.casterId || '').trim();
  if (!casterId) return null;
  return {
    casterId,
    sourceCardId: String(state.sourceCardId || '').trim(),
    extraTurnsRemaining: Math.max(0, Math.round(Number(state.extraTurnsRemaining || 0))),
    apPerTurn: Math.max(0, Math.round(Number(state.apPerTurn || 0))),
    activeTurn: state.activeTurn === true
  };
}

function getEncounterPauseState() {
  const normalized = normalizeEncounterPauseState(trackerState.encounter.pauseState);
  trackerState.encounter.pauseState = normalized;
  return normalized;
}

function setEncounterPauseState(state = null) {
  trackerState.encounter.pauseState = normalizeEncounterPauseState(state);
  return trackerState.encounter.pauseState;
}

function clearEncounterPauseState() {
  trackerState.encounter.pauseState = null;
}

function isPauseButtonTimingSuspended() {
  const pauseState = getEncounterPauseState();
  return pauseState?.activeTurn === true;
}

function getPauseActionError(participant, options = {}) {
  const pauseState = getEncounterPauseState();
  if (!pauseState || !participant) return '';
  if (pauseState.casterId === participant.id) return '';
  const label = String(options.label || 'That action').trim() || 'That action';
  const caster = findParticipant(pauseState.casterId);
  return `${label} cannot be used while Pause Button is active${caster ? ` (${caster.name} controls the paused turn).` : '.'}`;
}

function participantHasSuppressedCardLock(participant) {
  if (!participant) return false;
  participant.statuses = normalizeStatuses(participant.statuses);
  return (participant.statuses || []).some((status) => {
    if (detectStatusType(status) !== 'suppressed') return false;
    return Math.max(0, Number(status.stacks || 0)) > 0;
  });
}

function resetEncounterCardState(participant) {
  if (!participant) return;
  participant.cards = normalizeCards(
    (participant.cards || []).map((card) => {
      if (!card || typeof card !== 'object') return card;
      const effectState = card.effectState && typeof card.effectState === 'object' ? { ...card.effectState } : {};
      delete effectState.hasteMatrixTargetCounts;
      return {
        ...card,
        effectState
      };
    })
  );
}

function resetLongRestCardState(participant) {
  if (!participant) return;
  participant.cards = normalizeCards(
    (participant.cards || []).map((card) => {
      if (!card || typeof card !== 'object') return card;
      const effectState = card.effectState && typeof card.effectState === 'object' ? { ...card.effectState } : {};
      if (effectState.pauseButtonUsedLongRest) {
        effectState.pauseButtonUsedLongRest = false;
      }
      return {
        ...card,
        effectState
      };
    })
  );
}

function normalizeStatusToken(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function detectCustomStatusEffect(status) {
  const token = normalizeStatusToken(status?.presetId || status?.name || status?.id || '');
  if (token === 'twostep') return 'two_step';
  if (token === 'hastematrix') return 'haste_matrix';
  if (token === 'hastecrash') return 'haste_crash';
  if (token === 'polymorphed' || token === 'polymorph') return 'polymorphed';
  return null;
}

function findCustomStatus(participant, effectId = '') {
  const target = String(effectId || '').trim();
  if (!participant || !target) return null;
  participant.statuses = normalizeStatuses(participant.statuses);
  return (participant.statuses || []).find((status) => detectCustomStatusEffect(status) === target) || null;
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
    if (token.includes('paralysed') || token.includes('paralyzed') || token.includes('paralyse') || token.includes('paralyze')) return 'paralysed';
    if (token.includes('silenced') || token.includes('silence')) return 'silenced';
    if (token.includes('charmed') || token.includes('charm')) return 'charmed';
    if (token.includes('frightened') || token.includes('frighten')) return 'frightened';
    if (token.includes('infernalbrand')) return 'infernal_brand';
    if (token.includes('bloodcurse')) return 'blood_curse';
    if (token.includes('curseofweakness')) return 'curse_of_weakness';
    if (token.includes('suppressed') || token.includes('suppress')) return 'suppressed';
    if (token.includes('halfcover')) return 'half_cover';
    if (token.includes('mindshield')) return 'mind_shield';
    if (token.includes('enlarge')) return 'enlarge';
    if (token.includes('reduce') || token.includes('reduced')) return 'reduce';
  }
  return null;
}

function isSourceScopedStatus(status = {}, type = detectStatusType(status)) {
  const sourceParticipantId = String(status?.sourceParticipantId || '').trim();
  if (status?.stackBySource === true) return true;
  return type === 'infernal_brand' && Boolean(sourceParticipantId);
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

function getCleanseStatusApCost(type) {
  return 4;
}

function getCleanseableStatuses(statuses = []) {
  const cleanseable = new Set([
    'rooted',
    'restrained',
    'silenced',
    'charmed',
    'frightened',
    'infernal_brand',
    'blood_curse',
    'curse_of_weakness',
    'suppressed',
    'paralysed',
    'stunned'
  ]);
  return statuses
    .map((status, index) => {
      const detected = detectStatusType(status);
      if (!cleanseable.has(detected)) return null;
      return {
        status,
        index,
        type: detected,
        apCost: getCleanseStatusApCost(detected)
      };
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
    stunned: 'Stunned',
    paralysed: 'Paralysed',
    silenced: 'Silenced',
    charmed: 'Charmed',
    frightened: 'Frightened',
    infernal_brand: 'Infernal Brand',
    blood_curse: 'Blood Curse',
    curse_of_weakness: 'Curse of Weakness',
    suppressed: 'Suppressed',
    half_cover: 'Half Cover',
    mind_shield: 'Mind Shield',
    enlarge: 'Enlarge',
    reduce: 'Reduce'
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
  'stunned',
  'paralysed',
  'silenced',
  'charmed',
  'frightened',
  'suppressed',
  'half_cover',
  'mind_shield'
];

const MIND_SHIELD_IMMUNITIES = ['Charmed', 'Frightened'];

function buildStatusMergeKey(status, fallbackIndex = 0) {
  const type = detectStatusType(status);
  const sourceScoped = isSourceScopedStatus(status, type);
  const sourceParticipantId = String(status?.sourceParticipantId || '').trim();
  if (type) {
    if (sourceScoped && sourceParticipantId) {
      return `type:${type}:source:${sourceParticipantId}`;
    }
    return `type:${type}`;
  }
  const token = normalizeStatusToken(status?.name || status?.presetId || status?.id || '');
  if (token) {
    if (sourceScoped && sourceParticipantId) {
      return `name:${token}:source:${sourceParticipantId}`;
    }
    return `name:${token}`;
  }
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
    const parsedRemainingTurns = Number(rawStatus.remainingTurns);
    const remainingTurns = Number.isFinite(parsedRemainingTurns) ? Math.max(0, Math.round(parsedRemainingTurns)) : 0;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        id: rawStatus.id || randomUUID(),
        presetId: type || rawStatus.presetId || '',
        name: type ? statusDisplayName(type) : rawStatus.name || rawStatus.presetId || 'Status',
        stacks,
        notes: rawStatus.notes || '',
        remainingTurns,
        sourceParticipantId: String(rawStatus.sourceParticipantId || '').trim(),
        stackBySource: rawStatus.stackBySource === true,
        damageBonus: Number.isFinite(Number(rawStatus.damageBonus))
          ? Math.max(0, Math.round(Number(rawStatus.damageBonus)))
          : 0,
        attackDamageModifier: Number.isFinite(Number(rawStatus.attackDamageModifier))
          ? Math.round(Number(rawStatus.attackDamageModifier))
          : 0,
        hpLossPerTurn: Number.isFinite(Number(rawStatus.hpLossPerTurn))
          ? Math.max(0, Math.round(Number(rawStatus.hpLossPerTurn)))
          : 0
      });
      return;
    }
    if (type && !isSourceScopedStatus(rawStatus, type)) {
      existing.stacks += stacks;
    } else {
      existing.stacks = Math.max(existing.stacks, stacks);
    }
    if (!existing.notes && rawStatus.notes) {
      existing.notes = rawStatus.notes;
    }
    if (!existing.sourceParticipantId && rawStatus.sourceParticipantId) {
      existing.sourceParticipantId = String(rawStatus.sourceParticipantId || '').trim();
    }
    existing.stackBySource = existing.stackBySource || rawStatus.stackBySource === true;
    existing.damageBonus = Math.max(
      Number(existing.damageBonus || 0),
      Number.isFinite(Number(rawStatus.damageBonus)) ? Math.max(0, Math.round(Number(rawStatus.damageBonus))) : 0
    );
    if (Number.isFinite(Number(rawStatus.attackDamageModifier))) {
      const incomingAttackDamageModifier = Math.round(Number(rawStatus.attackDamageModifier));
      const currentAttackDamageModifier = Number(existing.attackDamageModifier || 0);
      if (Math.abs(incomingAttackDamageModifier) > Math.abs(currentAttackDamageModifier)) {
        existing.attackDamageModifier = incomingAttackDamageModifier;
      }
    }
    existing.hpLossPerTurn = Math.max(
      Number(existing.hpLossPerTurn || 0),
      Number.isFinite(Number(rawStatus.hpLossPerTurn)) ? Math.max(0, Math.round(Number(rawStatus.hpLossPerTurn))) : 0
    );
    existing.remainingTurns = Math.max(existing.remainingTurns || 0, remainingTurns);
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
  if (nextStacks > 0 && isStatusImmune(participant, type)) {
    const currentStacks = matches.reduce((total, entry) => total + Math.max(0, Number(entry.status?.stacks || 0)), 0);
    if (!matches.length || nextStacks > currentStacks) {
      return false;
    }
  }
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
    return nextStacks > 0;
  }
  const [first, ...rest] = matches;
  if (nextStacks <= 0) {
    [first, ...rest]
      .sort((a, b) => b.index - a.index)
      .forEach((entry) => participant.statuses.splice(entry.index, 1));
    return true;
  }
  first.status.stacks = nextStacks;
  if (!first.status.name) first.status.name = statusDisplayName(type);
  if (!first.status.presetId) first.status.presetId = type;
  rest
    .sort((a, b) => b.index - a.index)
    .forEach((entry) => participant.statuses.splice(entry.index, 1));
  return true;
}

function addStatusStacks(participant, type, amount = 1) {
  const existing = getStatusStacks(participant, type);
  const increment = Math.max(1, Number(amount || 1));
  return setStatusStacks(participant, type, existing + increment);
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
  const amount = getStatusEffectDamageAmount(participant, damage);
  if (!amount) return 0;
  const runtime = ensureSetRuntime(participant);
  if (hasSetBonus(participant, 'Divine', 7) && !runtime.divine.reverseDamageUsedEncounter) {
    runtime.divine.reverseDamageUsedEncounter = true;
    return 0;
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
  return totalDamageTaken;
}

function triggerBeastBleedingRestore(victim) {
  for (const owner of trackerState.encounter.participants || []) {
    if (!owner || owner.id === victim.id) continue;
    if (!hasSetBonus(owner, 'Beast', 7)) continue;
    if (!isParticipantEnemy(owner, victim)) continue;
    const shieldGain = getEffectShieldRestoreAmount(owner, 2);
    const beforeShield = owner.shield;
    owner.shield = Math.min(owner.maxShield, owner.shield + shieldGain);
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
  if (isPauseButtonTimingSuspended()) return [];
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
    const dealt = applyStatusDamage(participant, type, stacks);
    if (type === 'bleeding' && dealt > 0) {
      triggerBeastBleedingRestore(participant);
    }
    if (dealt > 0) {
      events.push(`takes ${dealt} ${statusDisplayName(type)} damage at start of turn.`);
    }
  });

  participant.statuses = normalizeStatuses(participant.statuses);
  for (const status of participant.statuses || []) {
    const hpLossPerTurn = Math.max(0, Number(status?.hpLossPerTurn || 0));
    if (hpLossPerTurn <= 0 || participant.hp <= 0) continue;
    const hpLoss = Math.min(participant.hp, getStatusEffectDamageAmount(participant, hpLossPerTurn));
    if (hpLoss <= 0) continue;
    participant.hp = Math.max(0, participant.hp - hpLoss);
    events.push(`loses ${hpLoss} HP from ${status.name || 'a curse'}.`);
  }

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

  if (startingStacks.stunned <= 0) {
    const hasteMatrixStatus = findCustomStatus(participant, 'haste_matrix');
    if (hasteMatrixStatus) {
      participant.apCurrent += 2;
      events.push('gains +2 AP from Haste Matrix.');
    }
  }
  const hasteCrashStatus = findCustomStatus(participant, 'haste_crash');
  if (hasteCrashStatus) {
    participant.apCurrent -= 4;
    events.push('loses 4 AP from Haste Crash.');
  }

  const escalatedThisTurn = new Set();
  const nextStacks = {};
  KNOWN_STATUS_TYPES.forEach((type) => {
    const reduction = isStatusResisted(participant, type) ? 2 : 1;
    nextStacks[type] = Math.max(0, (startingStacks[type] || 0) - reduction);
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

  // Re-apply hierarchy after all mutations.
  enforceControlHierarchy(participant);

  clampParticipant(participant);
  return events;
}

function performConstructActivation(owner, construct, target, options = {}) {
  const refreshed = {
    ...construct,
    apCurrent:
      options.refreshAp === true
        ? Math.max(0, Number(construct.apMax || 0))
        : Math.max(0, Number(construct.apCurrent ?? construct.apMax ?? 0))
  };
  const prefix = String(options.prefix || '');
  const events = [];
  const mode = normalizeConstructMode(refreshed.mode || refreshed.constructMode) || 'damage';
  if ((mode === 'damage' || mode === 'status') && !target) {
    events.push(`${prefix}${refreshed.name} has no valid target this turn.`);
    return { construct: refreshed, events };
  }
  if (mode === 'status' && target) {
    const stacks = Math.max(1, Number(refreshed.statusStacks || 1));
    const statusType = detectStatusType({
      presetId: refreshed.statusId,
      name: refreshed.statusName
    });
    if (statusType) {
      if (addStatusStacks(target, statusType, stacks)) {
        if (!isConstructEntity(target)) enforceControlHierarchy(target);
        events.push(
          `${prefix}${refreshed.name} applies ${statusDisplayName(statusType)} x${stacks} to ${target.name}.`
        );
      }
    } else {
      const statusName = String(refreshed.statusName || refreshed.statusId || 'Status').trim();
      target.statuses = normalizeStatuses([
        ...(target.statuses || []),
        {
          id: randomUUID(),
          presetId: String(refreshed.statusId || '').trim(),
          name: statusName,
          stacks,
          notes: 'Applied by construct.'
        }
      ]);
      events.push(`${prefix}${refreshed.name} applies ${statusName} x${stacks} to ${target.name}.`);
    }
    const forceDamage = Math.max(0, Number(refreshed.damage || 0));
    if (forceDamage > 0) {
      const result = applyCardDamageWithType(target, forceDamage, 'Force', {
        sourceEntityId: refreshed.id
      });
      const mitigation =
        result.resisted && !result.vulnerable
          ? ' [Resisted]'
          : result.vulnerable && !result.resisted
            ? ' [Vulnerable]'
            : '';
      events.push(
        `${prefix}${refreshed.name} deals ${result.finalDamage} Force to ${target.name} (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}`
      );
    }
    return { construct: refreshed, events };
  }
  if (mode === 'damage' && target) {
    const damage = Math.max(0, Number(refreshed.damage || 0));
    const damageType = String(refreshed.damageType || '').trim();
    if (damage > 0) {
      const result = applyCardDamageWithType(target, damage, damageType, {
        sourceEntityId: refreshed.id
      });
      const mitigation =
        result.resisted && !result.vulnerable
          ? ' [Resisted]'
          : result.vulnerable && !result.resisted
            ? ' [Vulnerable]'
            : '';
      events.push(
        `${prefix}${refreshed.name} hits ${target.name} for ${result.finalDamage} ${damageType || 'damage'} (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}`
      );
    }
    return { construct: refreshed, events };
  }
  if (mode === 'utility') {
    const shieldRestore = Math.max(0, Number(refreshed.shieldRestore || 0));
    const heal = Math.max(0, Number(refreshed.heal || 0));
    const auraRadiusFt = Math.max(0, Number(refreshed.auraRadiusFt || 0));
    const detectDc = Math.max(0, Number(refreshed.detectDc || 0));
    const visionRangeFt = Math.max(0, Number(refreshed.visionRangeFt || 0));
    const utilityKind = String(refreshed.utilityKind || '').trim().toLowerCase();
    const utilityNote = String(refreshed.utilityNote || '').trim();
    if (shieldRestore > 0) {
      const assignedTargets = (refreshed.targetIds || [])
        .map((id) => findParticipant(id))
        .filter(Boolean);
      const recipients = assignedTargets.length
        ? assignedTargets.filter((entry) => !refreshed.shieldRestoreAlliesOnly || isParticipantAlly(owner, entry))
        : refreshed.shieldRestoreAlliesOnly
          ? (trackerState.encounter.participants || []).filter((entry) => isParticipantAlly(owner, entry))
          : [owner];
      const restoredTargets = [];
      for (const entry of recipients) {
        const beforeShield = entry.shield;
        entry.shield = Math.min(entry.maxShield, entry.shield + shieldRestore);
        const restored = entry.shield - beforeShield;
        if (restored > 0) restoredTargets.push(`${entry.name} (+${restored})`);
      }
      const auraText = auraRadiusFt > 0 ? ` within ${auraRadiusFt} ft` : '';
      if (restoredTargets.length) {
        events.push(`${prefix}${refreshed.name} restores Shield${auraText} to ${restoredTargets.join(', ')}.`);
      } else {
        events.push(`${prefix}${refreshed.name} pulses${auraText} but no Shield is restored.`);
      }
      return { construct: refreshed, events };
    }
    if (heal > 0) {
      const recipients = refreshed.healTargetOnly && target
        ? [target]
        : refreshed.healAlliesOnly
          ? (trackerState.encounter.participants || []).filter((entry) => isParticipantAlly(owner, entry))
          : [owner];
      const healedTargets = [];
      for (const entry of recipients) {
        const beforeHp = entry.hp;
        entry.hp = Math.min(entry.maxHp, entry.hp + heal);
        const restored = entry.hp - beforeHp;
        if (restored > 0) healedTargets.push(`${entry.name} (+${restored})`);
      }
      if (healedTargets.length) {
        events.push(`${prefix}${refreshed.name} restores HP to ${healedTargets.join(', ')}.`);
      } else {
        events.push(`${prefix}${refreshed.name} pulses but no HP is restored.`);
      }
      return { construct: refreshed, events };
    }
    if (utilityKind === 'scout') {
      const detailParts = [];
      if (visionRangeFt > 0) detailParts.push(`vision ${visionRangeFt} ft`);
      if (detectDc > 0) detailParts.push(`detect DC ${detectDc}`);
      if (utilityNote) detailParts.push(utilityNote);
      events.push(
        detailParts.length
          ? `${prefix}${refreshed.name} relays scouting intel (${detailParts.join(', ')}).`
          : `${prefix}${refreshed.name} relays scouting intel.`
      );
      return { construct: refreshed, events };
    }
    if (utilityKind === 'factory') {
      events.push(
        utilityNote
          ? `${prefix}${refreshed.name} coordinates war production (${utilityNote}).`
          : `${prefix}${refreshed.name} coordinates war production.`
      );
      return { construct: refreshed, events };
    }
    events.push(`${prefix}${refreshed.name} remains active.`);
  }
  return { construct: refreshed, events };
}

function performConstructCardAction(owner, construct, body = {}, options = {}) {
  if (!owner?.id || !construct?.id) {
    return { error: 'Construct required' };
  }
  if (!constructHasManualTurn(construct)) {
    return { error: `${construct.name || 'This construct'} has no manual card actions.` };
  }
  if (options.bypassTurnCheck !== true && !isCurrentConstructTurn(owner.id, construct.id)) {
    return { error: `${construct.name || 'This construct'} can only use cards on its own turn.` };
  }
  if (constructCannotActOnSummonTurn(construct)) {
    return { error: `${construct.name || 'This construct'} cannot act on the turn it was summoned.` };
  }
  const normalizedConstruct = normalizeConstructs([construct], owner.id)[0] || construct;
  const { cards, card } = findConstructCard(normalizedConstruct, body.cardId);
  if (!card) {
    return { error: 'Construct card not found.' };
  }
  const apCost = Math.max(0, Number(card.apCost || 0));
  if (Number(normalizedConstruct.apCurrent || 0) < apCost) {
    return { error: `${normalizedConstruct.name} does not have enough AP.` };
  }
  let target = null;
  const explicitTargetId = String(body.targetId || '').trim();
  if (explicitTargetId) {
    target = findTargetableEntity(explicitTargetId);
    if (!target) {
      return { error: 'Target not found.' };
    }
  } else if (normalizedConstruct.targetId) {
    target = findTargetableEntity(normalizedConstruct.targetId);
  }
  const targetMode = normalizeCardTargetMode(card);
  const selfTarget = isSelfTargetCard(card, Number(card.masteryLevel || 1));
  const requiresTarget = targetMode !== 'none' && !selfTarget && targetMode !== 'all_others';
  if (requiresTarget && !target) {
    return options.allowNoTarget === true
      ? { construct: normalizedConstruct, card, target: null, events: [`${normalizedConstruct.name} has no valid target.`] }
      : { error: 'Target is required for this construct card.' };
  }
  if (!selfTarget && target && card.allowSelfTarget === false && target.id === normalizedConstruct.id) {
    return { error: `${card.name} cannot target self.` };
  }
  if (target && card.targetAlliesOnly === true && !isParticipantAlly(owner, target)) {
    return { error: `${card.name} can only target allies.` };
  }
  if (target && card.targetEnemiesOnly === true && !isParticipantEnemy(owner, target)) {
    return { error: `${card.name} can only target enemies.` };
  }
  if (target && !isEntityKindAllowedForCard(card, target)) {
    return { error: `${card.name} cannot target ${isConstructEntity(target) ? 'constructs' : 'participants'}.` };
  }

  normalizedConstruct.apCurrent = Math.max(0, Number(normalizedConstruct.apCurrent || 0) - apCost);
  normalizedConstruct.turnActionCount = Math.max(0, Number(normalizedConstruct.turnActionCount || 0)) + 1;
  normalizedConstruct.lastActedRound = trackerState.encounter.round;
  if (target?.id) {
    normalizedConstruct.targetId = target.id;
  }
  const damage = Math.max(0, Number(getCardDamageAtCurrentMastery(card) || 0));
  const damageType = String(card.damageType || '').trim() || 'damage';
  const events = [];
  if (target && damage > 0) {
    const result = applyCardDamageWithType(target, damage, damageType, {
      sourceEntityId: normalizedConstruct.id
    });
    const mitigation =
      result.resisted && !result.vulnerable
        ? ' [Resisted]'
        : result.vulnerable && !result.resisted
          ? ' [Vulnerable]'
          : '';
    events.push(
      `${normalizedConstruct.name} uses ${card.name} on ${target.name} for ${result.finalDamage} ${damageType} (${result.shieldDamage} Shield, ${result.hpDamage} HP).${mitigation}`
    );
    const destroyedConstruct = removeDefeatedConstructByEntity(target);
    if (destroyedConstruct) {
      events.push(`${destroyedConstruct.construct.name} is destroyed.`);
    }
  } else if (target) {
    events.push(`${normalizedConstruct.name} uses ${card.name} on ${target.name}.`);
  } else {
    events.push(`${normalizedConstruct.name} uses ${card.name}.`);
  }

  normalizedConstruct.cardObjects = cards.map((entry) =>
    entry.id === card.id ? { ...card } : entry
  );
  normalizedConstruct.cards = normalizedConstruct.cardObjects.map((entry) => entry.name).filter(Boolean);
  return {
    owner,
    construct: normalizedConstruct,
    card,
    target,
    events
  };
}

function beginConstructTurn(owner, construct) {
  if (!owner?.id || !construct?.id) return [];
  if (constructCannotActOnSummonTurn(construct)) {
    construct.apCurrent = 0;
  } else {
    construct.apCurrent = Math.max(0, Number(construct.apMax || 0));
  }
  construct.guardUsedThisTurn = false;
  construct.turnActionCount = 0;
  construct.lastActedRound = trackerState.encounter.round;
  if (constructCannotActOnSummonTurn(construct)) {
    return ['cannot act on the turn it was summoned.'];
  }
  return applyStartOfTurnStatusEffects(construct);
}

function finishConstructTurn(owner, construct) {
  if (!owner?.id || !construct?.id) return [];
  const events = decrementTimedStatusesAtEndOfTurn(construct);
  if (constructCannotActOnSummonTurn(construct)) {
    construct.summonSicknessTurn = false;
    owner.constructs = normalizeConstructs(
      (owner.constructs || []).map((entry) => (String(entry.id || '') === String(construct.id || '') ? construct : entry)),
      owner.id
    );
    return events;
  }
  const currentTurns = Math.max(0, Number(construct.remainingTurns || 0));
  if (currentTurns > 0) {
    const remainingTurns = Math.max(0, currentTurns - 1);
    if (remainingTurns > 0) {
      construct.remainingTurns = remainingTurns;
    } else {
      owner.constructs = normalizeConstructs(
        (owner.constructs || []).filter((entry) => String(entry.id || '') !== String(construct.id || '')),
        owner.id
      );
      events.push(`${construct.name} expires.`);
      return events;
    }
  }
  owner.constructs = normalizeConstructs(
    (owner.constructs || []).map((entry) => (String(entry.id || '') === String(construct.id || '') ? construct : entry)),
    owner.id
  );
  return events;
}

function updateConstructDurationAfterActivation(construct, nextConstructs, events, options = {}) {
  const currentTurns = Math.max(0, Number(construct.remainingTurns || 0));
  const prefix = String(options.prefix || '');
  if (currentTurns > 0) {
    const remainingTurns = Math.max(0, currentTurns - 1);
    if (remainingTurns > 0) {
      nextConstructs.push({ ...construct, remainingTurns });
    } else {
      events.push(`${prefix}${construct.name} expires.`);
    }
    return;
  }
  nextConstructs.push(construct);
}

function applyConstructStartOfTurnEffects(participant) {
  if (isPauseButtonTimingSuspended()) return [];
  participant.constructs = normalizeConstructs(participant.constructs, participant.id);
  if (!participant.constructs.length) return [];
  const events = [];
  const nextConstructs = [];
  for (const construct of participant.constructs) {
    if (constructHasManualTurn(construct)) {
      nextConstructs.push(construct);
      continue;
    }
    const refreshed = {
      ...construct,
      apCurrent: Math.max(0, Number(construct.apMax || 0))
    };
    const mode = normalizeConstructMode(refreshed.mode || refreshed.constructMode) || 'damage';
    const target = refreshed.targetId ? findTargetableEntity(refreshed.targetId) : null;
    const triggerOnTargetTurn = refreshed.triggerOnTargetTurn === true;
    if (triggerOnTargetTurn && target && target.id !== participant.id) {
      nextConstructs.push(refreshed);
      continue;
    }
    const activation = performConstructActivation(participant, refreshed, target, { refreshAp: true });
    events.push(...activation.events);
    updateConstructDurationAfterActivation(activation.construct, nextConstructs, events);
  }
  participant.constructs = nextConstructs;
  return events;
}

function applyIncomingConstructTurnEffects(participant) {
  if (isPauseButtonTimingSuspended()) return [];
  if (!participant) return [];
  const events = [];
  for (const owner of trackerState.encounter.participants || []) {
    if (!owner || owner.id === participant.id) continue;
    owner.constructs = normalizeConstructs(owner.constructs, owner.id);
    if (!owner.constructs.length) continue;
    const nextConstructs = [];
    for (const construct of owner.constructs) {
      if (constructHasManualTurn(construct)) {
        nextConstructs.push(construct);
        continue;
      }
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
      const activation = performConstructActivation(owner, refreshed, participant, {
        prefix: `${owner.name}'s `
      });
      events.push(...activation.events);
      updateConstructDurationAfterActivation(activation.construct, nextConstructs, events, {
        prefix: `${owner.name}'s `
      });
    }
    owner.constructs = nextConstructs;
    clampParticipant(owner);
  }
  clampParticipant(participant);
  return events;
}

function applyZoneTurnEffects(participant, zone) {
  if (isPauseButtonTimingSuspended()) return [];
  if (!participant || !zone) return [];
  participant.zones = normalizeZones(participant.zones, participant.id);
  const entry = participant.zones.find((item) => String(item.id) === String(zone.id));
  if (!entry) return [`${participant.name}'s zone no longer exists.`];
  const tickOnTurn = entry.tickOnTurn !== false;
  const turnStatusType = detectStatusType({ presetId: entry.statusId, name: entry.statusName });
  const turnStatusName = String(entry.statusName || entry.statusId || '').trim();
  const turnStatusNotes = String(entry.statusNotes || '').trim();
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
    const canDamageTarget = tickOnTurn && amount > 0 && !(allied && nature5);
    if (!canDamageTarget) {
      if (tickOnTurn && allied && nature5 && amount > 0) {
        events.push(`${participant.name}'s zone ${entry.name} does not damage ally ${target.name}.`);
      }
      if (tickOnTurn || turnStatusType || zoneShieldRestore > 0 || zoneHeal > 0) {
        events.push(`${participant.name}'s zone ${entry.name} affects ${target.name}.`);
      }
    } else {
      const result = applyCardDamageWithType(target, amount, entry.damageType, {
        sourceEntityId: participant.id
      });
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
    if (tickOnTurn && (turnStatusType || turnStatusName) && !(allied && nature5)) {
      if (turnStatusType) {
        addStatusStacks(target, turnStatusType, turnStatusStacks);
        enforceControlHierarchy(target);
        events.push(
          `${participant.name}'s zone ${entry.name} applies ${statusDisplayName(turnStatusType)} ${turnStatusStacks} to ${target.name}.`
        );
      } else {
        addCustomStatus(target, {
          name: turnStatusName,
          stacks: turnStatusStacks,
          notes: turnStatusNotes
        });
        events.push(
          `${participant.name}'s zone ${entry.name} applies ${turnStatusName} ${turnStatusStacks} to ${target.name}.`
        );
      }
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
      const natureShieldGain = getEffectShieldRestoreAmount(participant, 4);
      const beforeShield = target.shield;
      target.shield = Math.min(target.maxShield, target.shield + natureShieldGain);
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
    const result = applyCardDamageWithType(target, enterDamage, entry.enterDamageType || entry.damageType, {
      sourceEntityId: participant.id
    });
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
  const enterStatusName = String(entry.enterStatusName || entry.enterStatusId || '').trim();
  const enterStatusNotes = String(entry.enterStatusNotes || '').trim();
  const enterStatusStacks = Math.max(1, Number(entry.enterStatusStacks || 1));
  if ((enterStatusType || enterStatusName) && !blockedByNature) {
    if (enterStatusType) {
      addStatusStacks(target, enterStatusType, enterStatusStacks);
      enforceControlHierarchy(target);
      events.push(
        `${participant.name}'s zone ${entry.name} applies ${statusDisplayName(enterStatusType)} ${enterStatusStacks} to ${target.name}.`
      );
    } else {
      addCustomStatus(target, {
        name: enterStatusName,
        stacks: enterStatusStacks,
        notes: enterStatusNotes
      });
      events.push(
        `${participant.name}'s zone ${entry.name} applies ${enterStatusName} ${enterStatusStacks} to ${target.name}.`
      );
    }
  }
  if (blockedByNature && (enterDamage > 0 || enterStatusType || enterStatusName)) {
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

function applyCleanseAction(participant, target = {}, options = {}) {
  const preview = options?.preview === true;
  participant.statuses = normalizeStatuses(participant.statuses);
  const cleanseable = getCleanseableStatuses(participant.statuses);
  if (!cleanseable.length) return null;

  let matched = null;
  if (Number.isInteger(target?.statusIndex)) {
    matched = cleanseable.find((entry) => entry.index === Number(target.statusIndex));
  }
  if (!matched && target?.statusId) {
    matched = cleanseable.find((entry) => String(entry.status.id || '') === String(target.statusId));
  }
  if (!matched && target?.statusType) {
    const targetType = normalizeStatusToken(target.statusType);
    matched = cleanseable.find((entry) => entry.type === targetType);
  }
  if (!matched && target?.statusName) {
    const targetName = normalizeStatusToken(target.statusName);
    matched = cleanseable.find((entry) => normalizeStatusToken(entry.status.name) === targetName);
  }
  if (!matched) {
    [matched] = [...cleanseable].sort((a, b) => a.apCost - b.apCost || a.index - b.index);
  }
  if (!matched) return null;

  const status = matched.status;
  const result = {
    name: status.name || statusDisplayName(matched.type) || 'a condition',
    type: matched.type,
    apCost: matched.apCost
  };
  if (preview) {
    return result;
  }

  participant.statuses.splice(matched.index, 1);
  return result;
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

function normalizeCurrentAp(value, apMax) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return Math.max(0, Number(apMax || 0));
  }
  return Math.round(parsed);
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

function createZeroAbilityBonuses() {
  const bonuses = {};
  for (const key of ABILITY_KEYS) {
    bonuses[key] = 0;
  }
  return bonuses;
}

function normalizeAbilityBonuses(value = {}) {
  const normalized = createZeroAbilityBonuses();
  if (!value || typeof value !== 'object') return normalized;
  for (const key of ABILITY_KEYS) {
    const amount = Number(value[key]);
    if (Number.isFinite(amount)) {
      normalized[key] = Math.round(amount);
    }
  }
  return normalized;
}

function hasAbilityBonusValue(value = {}) {
  for (const key of ABILITY_KEYS) {
    if (Number(value[key] || 0) !== 0) return true;
  }
  return false;
}

function addAbilityBonusesTotals(target = {}, addition = {}) {
  for (const key of ABILITY_KEYS) {
    target[key] = Number(target[key] || 0) + Number(addition[key] || 0);
  }
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

function appendUniqueTextEntries(target = [], values = [], seen = new Set()) {
  for (const value of normalizeTextList(values)) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(value);
  }
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
  const total = getEffectiveAbilityScore(participant, key);
  return Math.floor((total - 10) / 2);
}

function getEffectiveAbilityScore(participant = {}, ability = '') {
  const key = String(ability || '').trim().toLowerCase();
  if (!ABILITY_KEYS.includes(key)) return 0;
  const derivedScore = Number(participant?.derivedBonuses?.effectiveStats?.[key]);
  if (Number.isFinite(derivedScore)) {
    return Math.round(derivedScore);
  }
  const safeBase = normalizeAbilityScoreValue(participant?.stats?.[key], 10);
  const bonus = Number(participant?.derivedBonuses?.abilityBonuses?.[key] || 0);
  return safeBase + (Number.isFinite(bonus) ? Math.round(bonus) : 0);
}

function getParticipantEffectiveAbilityScores(participant = {}) {
  const derived = participant?.derivedBonuses?.effectiveStats;
  if (derived && typeof derived === 'object') {
    return buildEffectiveAbilityScores(derived, createZeroAbilityBonuses());
  }
  return buildEffectiveAbilityScores(participant?.stats, participant?.derivedBonuses?.abilityBonuses);
}

function getParticipantAttributeScaling(participant = {}) {
  const derived = participant?.derivedBonuses?.attributeScaling;
  if (derived && typeof derived === 'object') {
    return {
      ...derived,
      modifiers: {
        ...(derived.modifiers || {})
      }
    };
  }
  return getAttributeScalingFromScores(getParticipantEffectiveAbilityScores(participant));
}

function getParticipantMoveDistanceFt(participant = {}, options = {}) {
  const scaling = getParticipantAttributeScaling(participant);
  return options.difficultTerrain === true
    ? Math.max(0, Math.round(Number(scaling.moveDifficultFt || 0)))
    : Math.max(0, Math.round(Number(scaling.moveFt || 0)));
}

function getCardShieldRestoreAmount(participant = {}, baseAmount = 0) {
  const base = Math.round(Number(baseAmount || 0));
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.max(0, base + getGlobalShieldRestoreBonus(participant));
}

function getEffectShieldRestoreAmount(participant = {}, baseAmount = 0) {
  const base = Math.round(Number(baseAmount || 0));
  if (!Number.isFinite(base) || base <= 0) return 0;
  return Math.max(0, base);
}

function getStatusEffectDamageAmount(participant = {}, baseAmount = 0) {
  const base = Math.round(Number(baseAmount || 0));
  if (!Number.isFinite(base) || base <= 0) return 0;
  const scaling = getParticipantAttributeScaling(participant);
  return Math.max(0, base + Math.round(Number(scaling.statusEffectDamageBonus || 0)));
}

function getParticipantCardDamageBonus(participant = {}, card = {}, options = {}) {
  const scaling = getParticipantAttributeScaling(participant);
  const damageType = String(options.damageType ?? card.damageType ?? '').trim();
  const rangeFallback = Number(card?.range || 0);
  const range = Number.isFinite(Number(options.range))
    ? Number(options.range)
    : getCardScaledEffectValue(card, 'rangeByLevel', options.masteryLevel || card.masteryLevel || 1, rangeFallback);
  return getContextualDamageBonusFromScaling(scaling, {
    damageType,
    range,
    rangeText: card?.rangeText || '',
    isZone: options.isZone === true,
    isConstruct: options.isConstruct === true
  });
}

function buildEffectiveAbilityScores(stats = {}, abilityBonuses = {}) {
  const totals = {};
  for (const key of ABILITY_KEYS) {
    const safeBase = normalizeAbilityScoreValue(stats?.[key], 10);
    const bonus = Number(abilityBonuses?.[key] || 0);
    totals[key] = safeBase + (Number.isFinite(bonus) ? Math.round(bonus) : 0);
  }
  return totals;
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

function normalizeCardThresholds(value, tier = 'Common') {
  const defaults = getCardTierMasteryThresholds(tier);
  const source = value && typeof value === 'object' ? value : {};
  const legacyLevel2 = Number(source.level2 ?? source.to2);
  const legacyLevel3 = Number(source.level3 ?? source.to3);
  const legacyLevel4 = Number(source.level4 ?? source.to4);
  const looksLikeLegacyLibraryFallback =
    Number.isFinite(legacyLevel2) &&
    Number.isFinite(legacyLevel3) &&
    legacyLevel2 === 25 &&
    legacyLevel3 === 55 &&
    (!Number.isFinite(legacyLevel4) || legacyLevel4 === 56);
  if (looksLikeLegacyLibraryFallback) {
    return { level2: defaults.level2, level3: defaults.level3, level4: defaults.level4 };
  }
  const level2Raw = Number(source.level2 ?? source.to2 ?? defaults.level2);
  const level2 = Number.isFinite(level2Raw) ? Math.max(1, Math.round(level2Raw)) : defaults.level2;
  const level3Raw = Number(source.level3 ?? source.to3 ?? defaults.level3);
  const level3Candidate = Number.isFinite(level3Raw) ? Math.round(level3Raw) : defaults.level3;
  const level3 = Math.max(level2 + 1, level3Candidate);
  const level4Raw = Number(source.level4 ?? source.to4 ?? defaults.level4);
  const level4Candidate = Number.isFinite(level4Raw) ? Math.round(level4Raw) : defaults.level4;
  const level4 = Math.max(level3 + 1, level4Candidate);
  return { level2, level3, level4 };
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
  const level4 = Number.isFinite(Number(source[4] ?? source.level4))
    ? Math.max(0, Number(source[4] ?? source.level4))
    : level3;
  return { 1: level1, 2: level2, 3: level3, 4: level4 };
}

function migrateKnownPresetCard(card = {}) {
  if (!card || typeof card !== 'object') return card;
  const name = String(card.name || '').trim().toLowerCase();
  const set = canonicalSetName(card.set);
  if (set === 'Elemental' && name === 'stone guard') {
    return {
      ...card,
      shieldRestoreByLevel: { 1: 3 },
      abilityBonusesByLevel: undefined,
      masteryChoiceOptions: [
        {
          id: 'shield_restore_4',
          label: 'Shield restored increases to 4',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            shieldRestoreByLevel: { 2: 4, 3: 4, 4: 4 }
          }
        },
        {
          id: 'constitution_plus_1',
          label: 'CON +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { constitution: 1 },
              3: { constitution: 1 },
              4: { constitution: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Shield restored increases to 4 or CON +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    };
  }
  if (set === 'Elemental' && name === 'wind step') {
    return {
      ...card,
      movementByLevel: { 1: 10 },
      abilityBonusesByLevel: undefined,
      utilityNote: 'Does not trigger opportunity attacks.',
      masteryChoiceOptions: [
        {
          id: 'movement_to_15',
          label: 'Movement increases to 15 ft',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            movementByLevel: { 2: 15, 3: 15, 4: 15 }
          }
        },
        {
          id: 'dexterity_plus_1',
          label: 'DEX +1',
          unlockLevel: 2,
          deferredUnlockLevel: 3,
          effects: {
            abilityBonusesByLevel: {
              2: { dexterity: 1 },
              3: { dexterity: 1 },
              4: { dexterity: 1 }
            }
          }
        }
      ],
      mastery: [
        'Level 1: Base.',
        'Level 2: Choose Movement increases to 15 ft or DEX +1.',
        'Level 3: Gain the option not chosen at Level 2.',
        'Level 4: Unlocks fusion eligibility.'
      ],
      fusion: 'Eligible for fusion at Mastery 4.'
    };
  }
  return card;
}

function normalizeNumberByLevelMap(value, minimum = 0) {
  if (!value || typeof value !== 'object') return null;
  const normalized = {};
  for (const level of [1, 2, 3, 4]) {
    const parsed = Number(value[level] ?? value[`level${level}`]);
    if (!Number.isFinite(parsed)) continue;
    normalized[level] = Math.max(minimum, Math.round(parsed));
  }
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeAbilityBonusesByLevel(value) {
  if (!value || typeof value !== 'object') return null;
  const normalized = {};
  for (const level of [1, 2, 3, 4]) {
    const raw = value[level] ?? value[`level${level}`];
    if (!raw || typeof raw !== 'object') continue;
    const abilityBonuses = normalizeAbilityBonuses(raw);
    if (!hasAbilityBonusValue(abilityBonuses)) continue;
    normalized[level] = abilityBonuses;
  }
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeMasteryChoiceId(value, fallback = '') {
  const token = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return token || fallback;
}

function normalizeMasteryChoiceOptions(value = []) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const normalized = [];
  value.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') return;
    const label = String(entry.label || entry.name || '').trim();
    const fallbackId = normalizeMasteryChoiceId(label, `choice_${index + 1}`);
    const id = normalizeMasteryChoiceId(entry.id, fallbackId);
    if (!id || seen.has(id)) return;
    seen.add(id);
    const unlockLevelRaw = Number(entry.unlockLevel ?? 2);
    const unlockLevel = Number.isFinite(unlockLevelRaw)
      ? Math.max(2, Math.min(4, Math.round(unlockLevelRaw)))
      : 2;
    const deferredUnlockLevelRaw = Number(entry.deferredUnlockLevel ?? unlockLevel + 1);
    const deferredUnlockLevel = Number.isFinite(deferredUnlockLevelRaw)
      ? Math.max(unlockLevel, Math.min(4, Math.round(deferredUnlockLevelRaw)))
      : Math.min(4, unlockLevel + 1);
    const effects = entry.effects && typeof entry.effects === 'object' ? entry.effects : {};
    const scaledEffects = {};
    const explicitScaledKeys = new Set(['damageBonusByLevel', 'damageByLevel', 'masteryDamageByLevel', 'abilityBonusesByLevel']);
    const candidateScaledKeys = new Set();
    for (const key of Object.keys(effects)) {
      if (key.endsWith('ByLevel')) candidateScaledKeys.add(key);
    }
    for (const key of Object.keys(entry)) {
      if (key.endsWith('ByLevel')) candidateScaledKeys.add(key);
    }
    for (const key of candidateScaledKeys) {
      if (explicitScaledKeys.has(key)) continue;
      const normalizedByLevel =
        normalizeNumberByLevelMap(effects[key], -9999) ||
        normalizeNumberByLevelMap(entry[key], -9999);
      if (normalizedByLevel) {
        scaledEffects[key] = normalizedByLevel;
      }
    }
    normalized.push({
      id,
      label: label || id,
      unlockLevel,
      deferredUnlockLevel,
      effects: {
        damageBonusByLevel:
          normalizeNumberByLevelMap(effects.damageBonusByLevel, -999) ||
          normalizeNumberByLevelMap(entry.damageBonusByLevel, -999),
        damageByLevel:
          normalizeNumberByLevelMap(effects.damageByLevel, 0) ||
          normalizeNumberByLevelMap(effects.masteryDamageByLevel, 0) ||
          normalizeNumberByLevelMap(entry.damageByLevel, 0) ||
          normalizeNumberByLevelMap(entry.masteryDamageByLevel, 0),
        abilityBonusesByLevel:
          normalizeAbilityBonusesByLevel(effects.abilityBonusesByLevel) ||
          normalizeAbilityBonusesByLevel(entry.abilityBonusesByLevel),
        ...scaledEffects
      }
    });
  });
  return normalized;
}

function getCardActiveMasteryChoiceOptions(card = {}, level = 1) {
  const choices = Array.isArray(card.masteryChoiceOptions) ? card.masteryChoiceOptions : [];
  if (!choices.length) return [];
  const selectedId = String(card.masteryChoiceSelected || '').trim();
  const hasSelected = Boolean(selectedId && choices.some((entry) => entry.id === selectedId));
  if (!hasSelected) {
    return [];
  }
  const currentLevel = Math.max(1, Math.min(4, Number(level || card.masteryLevel || 1)));
  const active = [];
  for (const choice of choices) {
    const unlockLevel = Math.max(2, Math.min(4, Number(choice.unlockLevel || 2)));
    const deferredUnlockLevel = Math.max(
      unlockLevel,
      Math.min(4, Number(choice.deferredUnlockLevel || unlockLevel + 1))
    );
    const activeFromLevel = choice.id === selectedId ? unlockLevel : deferredUnlockLevel;
    if (currentLevel >= activeFromLevel) {
      active.push(choice);
    }
  }
  return active;
}

function getCardAbilityBonusesAtLevel(card = {}, level = 1) {
  const parsedLevel = Math.max(1, Math.min(4, Number(level || card.masteryLevel || 1)));
  const bonuses = createZeroAbilityBonuses();
  const baseByLevel = normalizeAbilityBonusesByLevel(card.abilityBonusesByLevel);
  if (baseByLevel && typeof baseByLevel === 'object') {
    const direct = baseByLevel[parsedLevel] || baseByLevel[`level${parsedLevel}`];
    if (direct && typeof direct === 'object') {
      addAbilityBonusesTotals(bonuses, normalizeAbilityBonuses(direct));
    }
  }
  const activeChoices = getCardActiveMasteryChoiceOptions(card, parsedLevel);
  for (const choice of activeChoices) {
    const byLevel = choice.effects?.abilityBonusesByLevel;
    if (!byLevel || typeof byLevel !== 'object') continue;
    const direct = byLevel[parsedLevel] || byLevel[`level${parsedLevel}`];
    if (!direct || typeof direct !== 'object') continue;
    addAbilityBonusesTotals(bonuses, normalizeAbilityBonuses(direct));
  }
  return bonuses;
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
  const radius = getCardScaledEffectValue(card, 'zoneRadiusByLevel', level, Number(card.zoneRadius || 0));
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
      const cardObjects = getConstructCardObjects(entry);
      const cardNames = cardObjects.length ? cardObjects.map((card) => card.name).filter(Boolean) : cards;
      const targetIds = Array.isArray(entry.targetIds)
        ? Array.from(new Set(entry.targetIds.map((value) => String(value || '').trim()).filter(Boolean)))
        : [];
      return {
        id: entry.id || randomUUID(),
        entityKind: 'construct',
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
        remainingTurns: Number.isFinite(remainingTurns) ? Math.max(0, Math.round(remainingTurns)) : 1,
        targetId: String(entry.targetId || '').trim(),
        targetIds,
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
        maxShield: 0,
        shield: 0,
        apMax,
        apCurrent,
        moveFt,
        cards: cardNames,
        cardObjects,
        manualTurns: Boolean(entry.manualTurns ?? entry.constructManualTurns ?? (cardObjects.length > 0)),
        summonSicknessTurn: Boolean(entry.summonSicknessTurn),
        targetPriority: String(entry.targetPriority ?? entry.constructTargetPriority ?? '').trim().toLowerCase(),
        statuses: normalizeStatuses(entry.statuses),
        resistances: normalizeDamageTypes(entry.resistances),
        vulnerabilities: normalizeDamageTypes(entry.vulnerabilities),
        immunities: normalizeImmunities(entry.immunities),
        rangedUntargetableTurns: Math.max(0, Math.round(Number(entry.rangedUntargetableTurns || 0))),
        turnActionCount: Math.max(0, Math.round(Number(entry.turnActionCount || 0))),
        guardUsedThisTurn: entry.guardUsedThisTurn === true,
        lastActedRound: Math.max(0, Math.round(Number(entry.lastActedRound || 0))),
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
        statusNotes: String(entry.statusNotes || '').trim(),
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
        enterStatusNotes: String(entry.enterStatusNotes || '').trim(),
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
      const migratedCard = migrateKnownPresetCard(card);
      const tierName = String(migratedCard.tier || 'Common').trim() || 'Common';
      const thresholds = normalizeCardThresholds(migratedCard.masteryThresholds, tierName);
      const masteryUsesRaw = Number(migratedCard.masteryUses ?? migratedCard.uses ?? 0);
      let masteryUses = Number.isFinite(masteryUsesRaw) ? Math.max(0, Math.round(masteryUsesRaw)) : 0;
      const legacyLevel4 = Number(card?.masteryThresholds?.level4 ?? card?.masteryThresholds?.to4);
      if (Number.isFinite(legacyLevel4) && legacyLevel4 === 56 && masteryUses === 56) {
        masteryUses = thresholds.level4;
      }
      const masteryLevelRaw = Number(card.masteryLevel ?? card.level ?? 1);
      let masteryLevel = Number.isFinite(masteryLevelRaw) ? Math.max(1, Math.min(4, Math.round(masteryLevelRaw))) : 1;
      const impliedLevel =
        masteryUses >= thresholds.level4
          ? 4
          : masteryUses >= thresholds.level3
            ? 3
            : masteryUses >= thresholds.level2
              ? 2
              : 1;
      masteryLevel = Math.max(masteryLevel, impliedLevel);

      const damageRaw = Number(migratedCard.damage ?? migratedCard.baseDamage ?? 0);
      const damage = Number.isFinite(damageRaw) ? Math.max(0, Math.round(damageRaw)) : 0;
      const damageByLevel = normalizeCardDamageByLevel(migratedCard.masteryDamageByLevel, damage);
      const constructStatusStacksRaw = Number(
        migratedCard.constructStatusStacks ??
          migratedCard.statusStacks ??
          migratedCard.constructStacks ??
          1
      );
      const constructApRaw = Number(migratedCard.constructAp ?? migratedCard.constructApMax ?? migratedCard.ap ?? 2);
      const constructMaxHpRaw = Number(migratedCard.constructMaxHp ?? migratedCard.constructHp ?? migratedCard.hp ?? 1);
      const constructMoveFtRaw = Number(migratedCard.constructMoveFt ?? migratedCard.constructMove ?? 10);
      const cardChargesRaw = Number(migratedCard.chargesMax ?? migratedCard.maxCharges ?? migratedCard.charges ?? 0);
      const cardChargesMax = Number.isFinite(cardChargesRaw) ? Math.max(0, Math.round(cardChargesRaw)) : 0;
      const cardChargesCurrentRaw = Number(
        migratedCard.chargesCurrent ?? migratedCard.remainingCharges ?? cardChargesMax
      );
      const cardChargesCurrent =
        cardChargesMax > 0 && Number.isFinite(cardChargesCurrentRaw)
          ? Math.max(0, Math.min(cardChargesMax, Math.round(cardChargesCurrentRaw)))
          : 0;
      const explicitShieldSource = migratedCard.shieldBonus ?? migratedCard.bonusShield;
      const explicitShieldBonus =
        explicitShieldSource === '' || explicitShieldSource == null ? Number.NaN : Number(explicitShieldSource);
      const shieldBonus = Number.isFinite(explicitShieldBonus)
        ? explicitShieldBonus
        : getCardTierShieldBonus(tierName);
      const constructCards = Array.isArray(migratedCard.constructCards)
        ? migratedCard.constructCards
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        : String(migratedCard.constructCards || migratedCard.constructLinkedCard || '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean);
      const constructCard = isConstructCard(migratedCard);
      const masteryChoiceOptions = normalizeMasteryChoiceOptions(migratedCard.masteryChoiceOptions);
      const selectedChoiceId = String(migratedCard.masteryChoiceSelected || '').trim();
      const masteryChoiceSelected = masteryChoiceOptions.some((entry) => entry.id === selectedChoiceId)
        ? selectedChoiceId
        : '';

      return {
        ...migratedCard,
        id: migratedCard.id || randomUUID(),
        name: String(migratedCard.name || `Card ${index + 1}`).trim(),
        set: canonicalSetName(migratedCard.set),
        type: String(migratedCard.type || 'Attack').trim(),
        tier: tierName,
        active: migratedCard.active !== false,
        apCost: Number.isFinite(Number(migratedCard.apCost)) ? Number(migratedCard.apCost) : 0,
        range: Number.isFinite(Number(migratedCard.range)) ? Number(migratedCard.range) : 0,
        healthBonus: Number.isFinite(Number(migratedCard.healthBonus)) ? Number(migratedCard.healthBonus) : 0,
        shieldBonus,
        tags: Array.isArray(migratedCard.tags)
          ? migratedCard.tags.map((tag) => String(tag).trim()).filter(Boolean)
          : String(migratedCard.tags || '')
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean),
        effect: String(migratedCard.effect || '').trim(),
        mastery: Array.isArray(migratedCard.mastery)
          ? migratedCard.mastery.map((line) => String(line).trim()).filter(Boolean)
          : String(migratedCard.mastery || '')
              .split(/\n|,/)
              .map((line) => line.trim())
              .filter(Boolean),
        fusion: String(migratedCard.fusion || '').trim(),
        modifiers: normalizeModifiers(migratedCard.modifiers || {}),
        damage,
        damageType: autoCardDamageType(migratedCard),
        isZone: migratedCard.isZone === true || isZoneCard(migratedCard, masteryLevel),
        zoneRadius: Number.isFinite(Number(migratedCard.zoneRadius)) ? Math.max(0, Math.round(Number(migratedCard.zoneRadius))) : 0,
        zoneRadiusByLevel:
          migratedCard.zoneRadiusByLevel && typeof migratedCard.zoneRadiusByLevel === 'object'
            ? { ...migratedCard.zoneRadiusByLevel }
            : null,
        zoneDurationTurns: Number.isFinite(Number(migratedCard.zoneDurationTurns))
          ? Math.max(0, Math.round(Number(migratedCard.zoneDurationTurns)))
          : 0,
        constructDurationTurns: Number.isFinite(Number(migratedCard.constructDurationTurns ?? migratedCard.constructDuration ?? migratedCard.durationTurns))
          ? Math.max(0, Math.round(Number(migratedCard.constructDurationTurns ?? migratedCard.constructDuration ?? migratedCard.durationTurns)))
          : 1,
        constructMode: detectConstructMode(migratedCard, { infer: constructCard }),
        constructStatusId: String(
          migratedCard.constructStatusId ?? migratedCard.statusId ?? migratedCard.constructStatus ?? ''
        ).trim(),
        constructStatusName: String(migratedCard.constructStatusName ?? migratedCard.statusName ?? '').trim(),
        constructStatusStacks: Number.isFinite(constructStatusStacksRaw)
          ? Math.max(1, Math.round(constructStatusStacksRaw))
          : 1,
        constructAp: Number.isFinite(constructApRaw) ? Math.max(0, Math.round(constructApRaw)) : 0,
        constructMaxHp: Number.isFinite(constructMaxHpRaw) ? Math.max(1, Math.round(constructMaxHpRaw)) : 1,
        constructMoveFt: Number.isFinite(constructMoveFtRaw) ? Math.max(5, Math.round(constructMoveFtRaw)) : 10,
        constructCards,
        constructLinkedCard: constructCards[0] || '',
        effectState:
          migratedCard.effectState && typeof migratedCard.effectState === 'object'
            ? structuredClone(migratedCard.effectState)
            : {},
        chargesMax: cardChargesMax,
        chargesCurrent: cardChargesCurrent,
        masteryLevel,
        masteryUses,
        masteryThresholds: thresholds,
        masteryDamageByLevel: damageByLevel,
        abilityBonusesByLevel: normalizeAbilityBonusesByLevel(migratedCard.abilityBonusesByLevel),
        masteryChoiceOptions,
        masteryChoiceSelected
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
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const byLevel = normalizeCardDamageByLevel(card.masteryDamageByLevel, card.damage || 0);
  let damage =
    level >= 4
      ? byLevel[4]
      : level >= 3
        ? byLevel[3]
        : level >= 2
          ? byLevel[2]
          : byLevel[1];
  let overrideDamage = null;
  for (const option of getCardActiveMasteryChoiceOptions(card, level)) {
    const damageByLevel = option.effects?.damageByLevel;
    const override = Number(damageByLevel?.[level] ?? damageByLevel?.[`level${level}`]);
    if (Number.isFinite(override)) {
      overrideDamage = overrideDamage == null ? Math.round(override) : Math.max(overrideDamage, Math.round(override));
    }
    const damageBonusByLevel = option.effects?.damageBonusByLevel;
    const bonus = Number(damageBonusByLevel?.[level] ?? damageBonusByLevel?.[`level${level}`]);
    if (Number.isFinite(bonus)) {
      damage += Math.round(bonus);
    }
  }
  if (overrideDamage != null) {
    damage = overrideDamage;
  }
  return Math.max(0, Math.round(damage));
}

function getCardSecondaryDamageAtCurrentMastery(card) {
  const level = Math.max(1, Math.min(4, Number(card.masteryLevel || 1)));
  const fallback = Number(card.secondaryDamage || 0);
  const value = getCardScaledEffectValue(card, 'secondaryDamageByLevel', level, fallback);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function normalizeCardTargetMode(card = {}) {
  const token = String(card.targetMode || '').trim().toLowerCase();
  if (token === 'none' || token === 'untargeted' || token === 'no_target') return 'none';
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
  const scaled = getCardScaledEffectValue(card, 'multiTargetMaxByLevel', level, fallback);
  return Number.isFinite(Number(scaled)) ? Math.max(1, Math.round(Number(scaled))) : fallback;
}

function getCardScaledValue(source, level = 1, fallback = 0) {
  if (source == null) return fallback;
  const parsedLevel = Math.max(1, Math.min(4, Number(level || 1)));
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
  const order =
    parsedLevel === 4
      ? [4, 3, 2, 1]
      : parsedLevel === 3
        ? [3, 2, 1, 4]
        : parsedLevel === 2
          ? [2, 1, 3, 4]
          : [1, 2, 3, 4];
  for (const key of order) {
    const value = Number(source[key] ?? source[`level${key}`]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function getCardScaledEffectValue(card = {}, effectKey = '', level = 1, fallback = 0) {
  const key = String(effectKey || '').trim();
  if (!key) return fallback;
  const base = getCardScaledValue(card?.[key], level, fallback);
  const activeChoices = getCardActiveMasteryChoiceOptions(card, level);
  if (!activeChoices.length) return base;
  let override = null;
  for (const choice of activeChoices) {
    const scaled = getCardScaledValue(choice.effects?.[key], level, Number.NaN);
    if (!Number.isFinite(scaled)) continue;
    override = override == null ? Number(scaled) : Math.max(override, Number(scaled));
  }
  return override == null ? base : override;
}

function normalizeStatusApplyConfig(source, level = 1, options = {}) {
  if (!source || typeof source !== 'object') return null;
  const id = detectStatusType({ presetId: source.id, name: source.name });
  const customName = String(source.name || '').trim();
  const customNotes = String(source.notes || '').trim();
  if (!id && customName) {
    let stacks = Math.max(1, Math.round(getCardScaledValue(source.stacksByLevel, level, source.stacks ?? 1)));
    const stacksByLevelOverride = options?.stacksByLevelOverride;
    if (stacksByLevelOverride && typeof stacksByLevelOverride === 'object') {
      stacks = Math.max(1, Math.round(getCardScaledValue(stacksByLevelOverride, level, stacks)));
    }
    const stacksOverride = Number(options?.stacksOverride);
    if (Number.isFinite(stacksOverride)) {
      stacks = Math.max(1, Math.round(stacksOverride));
    }
    return {
      id: '',
      name: customName,
      notes: customNotes,
      stacks,
      isCustom: true
    };
  }
  if (!id) return null;
  let stacks = Math.max(1, Math.round(getCardScaledValue(source.stacksByLevel, level, source.stacks ?? 1)));
  const stacksByLevelOverride = options?.stacksByLevelOverride;
  if (stacksByLevelOverride && typeof stacksByLevelOverride === 'object') {
    stacks = Math.max(1, Math.round(getCardScaledValue(stacksByLevelOverride, level, stacks)));
  }
  const stacksOverride = Number(options?.stacksOverride);
  if (Number.isFinite(stacksOverride)) {
    stacks = Math.max(1, Math.round(stacksOverride));
  }
  return { id, stacks };
}

function normalizeCardStatusApply(card = {}, level = 1) {
  const base = normalizeStatusApplyConfig(card.statusApply, level);
  if (!base) return null;
  const stacks = Math.max(1, Math.round(getCardScaledEffectValue(card, 'statusApplyStacksByLevel', level, base.stacks)));
  return { ...base, stacks };
}

function isSelfTargetCard(card = {}, level = 1) {
  const rangeText = String(card.rangeText || '').trim().toLowerCase();
  if (rangeText === 'self') return true;
  const scaledRange = getCardScaledEffectValue(card, 'rangeByLevel', level, Number(card.range || 0));
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

function normalizeImmunityToken(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function normalizeImmunities(list = []) {
  if (!Array.isArray(list)) return [];
  const normalized = [];
  for (const entry of list) {
    const value = String(entry || '').trim();
    if (!value) continue;
    const token = normalizeImmunityToken(value);
    if (!token) continue;
    if (!normalized.some((current) => normalizeImmunityToken(current) === token)) {
      normalized.push(value);
    }
  }
  return normalized;
}

function getEffectiveImmunities(participant = {}) {
  const combined = normalizeImmunities(participant.immunities);
  if (getStatusStacks(participant, 'mind_shield') > 0) {
    return normalizeImmunities([...combined, ...MIND_SHIELD_IMMUNITIES]);
  }
  return combined;
}

function hasImmunityEntry(list = [], value = '') {
  const target = normalizeImmunityToken(value);
  if (!target) return false;
  return (list || []).some((entry) => normalizeImmunityToken(entry) === target);
}

function hasParticipantImmunity(participant = {}, value = '') {
  return hasImmunityEntry(getEffectiveImmunities(participant), value);
}

function getStatusMitigationCandidates(statusOrType = '') {
  const candidates = [];
  const push = (value) => {
    const normalized = String(value || '').trim();
    if (!normalized) return;
    if (!candidates.some((entry) => entry.toLowerCase() === normalized.toLowerCase())) {
      candidates.push(normalized);
    }
  };
  if (statusOrType && typeof statusOrType === 'object') {
    push(statusOrType.presetId);
    push(statusOrType.id);
    push(statusOrType.name);
  } else {
    push(statusOrType);
  }
  const detectedType = detectStatusType(
    statusOrType && typeof statusOrType === 'object'
      ? statusOrType
      : { presetId: statusOrType, id: statusOrType, name: statusOrType }
  );
  if (detectedType) {
    push(detectedType);
    push(statusDisplayName(detectedType));
  }
  return candidates;
}

function isStatusImmune(participant = {}, statusOrType = '') {
  return getStatusMitigationCandidates(statusOrType).some((candidate) => hasParticipantImmunity(participant, candidate));
}

function isStatusResisted(participant = {}, statusOrType = '') {
  return getStatusMitigationCandidates(statusOrType).some((candidate) => hasDamageTypeEntry(participant.resistances, candidate));
}

function applyCardDamageWithType(target, rawDamage, damageType = '', options = {}) {
  const baseDamage = Math.max(0, Number(rawDamage || 0));
  const immune = hasParticipantImmunity(target, damageType);
  const resisted = hasDamageTypeEntry(target.resistances, damageType);
  const vulnerable = hasDamageTypeEntry(target.vulnerabilities, damageType);
  let finalDamage = baseDamage;
  if (immune) {
    finalDamage = 0;
  } else if (resisted && !vulnerable) {
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
  if (totalDamageTaken > 0) {
    recordIncomingDamageSource(target, options);
  }
  return {
    baseDamage,
    finalDamage,
    immune,
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

function recordIncomingDamageSource(target, options = {}) {
  if (!target || isConstructEntity(target)) return;
  const sourceEntityId = String(options?.sourceEntityId || '').trim();
  if (!sourceEntityId || sourceEntityId === String(target.id || '').trim()) return;
  const runtime = ensureSetRuntime(target);
  runtime.demonic.damagedByPendingIds = normalizeIdList([
    ...(runtime.demonic.damagedByPendingIds || []),
    sourceEntityId
  ]);
}

function didEntityDamageParticipantLastTurn(participant, entity = null) {
  if (!participant || !entity || isConstructEntity(participant)) return false;
  const entityId = String(entity?.id || entity || '').trim();
  if (!entityId) return false;
  const runtime = ensureSetRuntime(participant);
  return normalizeIdList(runtime.demonic.damagedByLastTurnIds || []).includes(entityId);
}

function getInfernalBrandDamageBonus(target, sourceParticipantId = '') {
  if (!target) return 0;
  const sourceId = String(sourceParticipantId || '').trim();
  if (!sourceId) return 0;
  const statuses = normalizeStatuses(target.statuses);
  return statuses.reduce((maxBonus, status) => {
    if (detectStatusType(status) !== 'infernal_brand') return maxBonus;
    if (String(status.sourceParticipantId || '').trim() !== sourceId) return maxBonus;
    const bonus = Number.isFinite(Number(status.damageBonus))
      ? Math.max(0, Math.round(Number(status.damageBonus)))
      : 0;
    return Math.max(maxBonus, bonus);
  }, 0);
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
      noReactionUsesTurn: Math.max(0, Number(arcane.noReactionUsesTurn || 0)),
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
      pendingNextTurnAp: Math.max(0, Number(demonic.pendingNextTurnAp || 0)),
      damagedByPendingIds: normalizeIdList(demonic.damagedByPendingIds || []),
      damagedByLastTurnIds: normalizeIdList(demonic.damagedByLastTurnIds || [])
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
  const targetEntity = typeof target === 'string' ? findTargetableEntity(target) : target;
  const owner = findTargetableOwner(targetEntity);
  if (!owner?.id) return false;
  if (owner.id === source.id) {
    return isConstructEntity(targetEntity);
  }
  const allyIds = getSetAllyTargets(source);
  return allyIds.includes(owner.id);
}

function isParticipantEnemy(source, target) {
  if (!source || !target) return false;
  const targetEntity = typeof target === 'string' ? findTargetableEntity(target) : target;
  const owner = findTargetableOwner(targetEntity);
  if (!owner?.id || owner.id === source.id) return false;
  return !isParticipantAlly(source, targetEntity);
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

function addCustomStatus(participant, status = {}) {
  if (!participant || !status || typeof status !== 'object') return;
  const name = String(status.name || '').trim();
  if (!name) return;
  if (isStatusImmune(participant, status)) return;
  participant.statuses = normalizeStatuses(participant.statuses);
  const token = normalizeStatusToken(name);
  const current = Array.isArray(participant.statuses) ? [...participant.statuses] : [];
  const sourceScoped = isSourceScopedStatus(status, null);
  const sourceParticipantId = String(status.sourceParticipantId || '').trim();
  const existingIndex = current.findIndex((entry) => {
    if (detectStatusType(entry)) return false;
    if (normalizeStatusToken(entry?.name || entry?.presetId || entry?.id || '') !== token) return false;
    if (!sourceScoped) return true;
    return String(entry?.sourceParticipantId || '').trim() === sourceParticipantId;
  });
  const nextStatus = {
    id: existingIndex >= 0 ? current[existingIndex].id || randomUUID() : randomUUID(),
    presetId: '',
    name,
    stacks: Math.max(
      existingIndex >= 0 ? Number(current[existingIndex].stacks || 1) : 1,
      Number(status.stacks || 1)
    ),
    notes: String(status.notes || current[existingIndex]?.notes || '').trim(),
    remainingTurns: Math.max(0, Number(status.remainingTurns || current[existingIndex]?.remainingTurns || 0)),
    sourceParticipantId,
    stackBySource: sourceScoped,
    damageBonus: Number.isFinite(Number(status.damageBonus ?? current[existingIndex]?.damageBonus))
      ? Math.max(0, Math.round(Number(status.damageBonus ?? current[existingIndex]?.damageBonus)))
      : 0,
    attackDamageModifier: Number.isFinite(Number(status.attackDamageModifier ?? current[existingIndex]?.attackDamageModifier))
      ? Math.round(Number(status.attackDamageModifier ?? current[existingIndex]?.attackDamageModifier))
      : 0,
    hpLossPerTurn: Number.isFinite(Number(status.hpLossPerTurn ?? current[existingIndex]?.hpLossPerTurn))
      ? Math.max(0, Math.round(Number(status.hpLossPerTurn ?? current[existingIndex]?.hpLossPerTurn)))
      : 0
  };
  if (existingIndex >= 0) {
    current[existingIndex] = nextStatus;
  } else {
    current.push(nextStatus);
  }
  participant.statuses = normalizeStatuses(current);
}

function removeStatusEntry(participant, status = {}) {
  if (!participant) return false;
  participant.statuses = normalizeStatuses(participant.statuses);
  if (!participant.statuses.length) return false;
  const type = detectStatusType(status);
  const token = normalizeStatusToken(status.name || status.id || status.presetId || '');
  const before = participant.statuses.length;
  participant.statuses = participant.statuses.filter((entry) => {
    const entryType = detectStatusType(entry);
    if (type) return entryType !== type;
    if (token) {
      return normalizeStatusToken(entry?.name || entry?.presetId || entry?.id || '') !== token;
    }
    return true;
  });
  return participant.statuses.length !== before;
}

function upsertTimedStatus(participant, status = {}) {
  if (!participant || !status || typeof status !== 'object') return null;
  const type = detectStatusType(status);
  const name = String(status.name || (type ? statusDisplayName(type) : '')).trim();
  if (!type && !name) return null;
  if (isStatusImmune(participant, status)) return null;
  participant.statuses = normalizeStatuses(participant.statuses);
  const token = normalizeStatusToken(name || type);
  const current = Array.isArray(participant.statuses) ? [...participant.statuses] : [];
  const sourceScoped = isSourceScopedStatus(status, type);
  const sourceParticipantId = String(status.sourceParticipantId || '').trim();
  const existingIndex = current.findIndex((entry) => {
    const entryType = detectStatusType(entry);
    const sameSource = !sourceScoped || String(entry?.sourceParticipantId || '').trim() === sourceParticipantId;
    if (type) return entryType === type && sameSource;
    return normalizeStatusToken(entry?.name || entry?.presetId || entry?.id || '') === token && sameSource;
  });
  const existing = existingIndex >= 0 ? current[existingIndex] : null;
  const nextStatus = {
    id: existing?.id || randomUUID(),
    presetId: type || String(status.presetId || '').trim(),
    name: type ? statusDisplayName(type) : name,
    stacks: Math.max(1, Number(status.stacks || existing?.stacks || 1)),
    notes: String(status.notes || existing?.notes || '').trim(),
    remainingTurns: Math.max(0, Math.round(Number(status.remainingTurns || existing?.remainingTurns || 0))),
    sourceParticipantId,
    stackBySource: sourceScoped,
    damageBonus: Number.isFinite(Number(status.damageBonus ?? existing?.damageBonus))
      ? Math.max(0, Math.round(Number(status.damageBonus ?? existing?.damageBonus)))
      : 0,
    attackDamageModifier: Number.isFinite(Number(status.attackDamageModifier ?? existing?.attackDamageModifier))
      ? Math.round(Number(status.attackDamageModifier ?? existing?.attackDamageModifier))
      : 0,
    hpLossPerTurn: Number.isFinite(Number(status.hpLossPerTurn ?? existing?.hpLossPerTurn))
      ? Math.max(0, Math.round(Number(status.hpLossPerTurn ?? existing?.hpLossPerTurn)))
      : 0
  };
  if (existingIndex >= 0) {
    current[existingIndex] = nextStatus;
  } else {
    current.push(nextStatus);
  }
  participant.statuses = normalizeStatuses(current);
  return nextStatus;
}

function decrementTimedStatusesAtEndOfTurn(participant) {
  if (isPauseButtonTimingSuspended()) return [];
  if (!participant) return [];
  participant.statuses = normalizeStatuses(participant.statuses);
  if (!participant.statuses.length) return [];
  const events = [];
  const nextStatuses = [];
  for (const status of participant.statuses) {
    const remainingTurns = Math.max(0, Number(status?.remainingTurns || 0));
    if (remainingTurns <= 0) {
      nextStatuses.push(status);
      continue;
    }
    const customEffect = detectCustomStatusEffect(status);
    if (customEffect === 'two_step') {
      events.push('Two Step is active: resolve a 10 ft forward horizontal teleport if space permits.');
    }
    const reduction = isStatusResisted(participant, status) ? 2 : 1;
    const nextRemaining = Math.max(0, remainingTurns - reduction);
    if (nextRemaining > 0) {
      nextStatuses.push({ ...status, remainingTurns: nextRemaining });
    } else {
      if (customEffect === 'haste_matrix') {
        nextStatuses.push({
          id: randomUUID(),
          presetId: 'haste_crash',
          name: 'Haste Crash',
          stacks: 1,
          notes: 'Lose 4 AP at the start of your next turn.',
          remainingTurns: 1
        });
        events.push('Haste Matrix ends and leaves Haste Crash for the next turn.');
      }
      events.push(`${status.name} expires.`);
    }
  }
  participant.statuses = normalizeStatuses(nextStatuses);
  return events;
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

function isAttackCard(card = {}) {
  const type = String(card?.type || '').toLowerCase();
  if (type.includes('attack')) return true;
  const tags = Array.isArray(card?.tags) ? card.tags.map((entry) => String(entry || '').toLowerCase()) : [];
  return tags.includes('attack') || tags.includes('melee') || tags.includes('ranged');
}

function isMeleeAttackCard(card = {}, level = 1) {
  if (!isAttackCard(card)) return false;
  const tags = Array.isArray(card?.tags) ? card.tags.map((entry) => String(entry || '').toLowerCase()) : [];
  if (tags.includes('melee')) return true;
  if (tags.includes('ranged')) return false;
  const rangeText = String(card.rangeText || '').trim().toLowerCase();
  if (rangeText === 'touch') return true;
  const scaledRange = getCardScaledEffectValue(card, 'rangeByLevel', level, Number(card.range || 0));
  return Number(scaledRange || 0) <= 5;
}

function getParticipantAttackStatusDamageModifier(participant, card = {}, masteryLevel = 1) {
  if (!participant || !isAttackCard(card)) return 0;
  participant.statuses = normalizeStatuses(participant.statuses);
  let modifier = 0;
  if (getStatusStacks(participant, 'weakened') > 0) {
    modifier -= 2;
  }
  if (getStatusStacks(participant, 'reduce') > 0) {
    modifier -= 2;
  }
  if (getStatusStacks(participant, 'enlarge') > 0 && isMeleeAttackCard(card, masteryLevel)) {
    modifier += 2;
  }
  for (const status of participant.statuses || []) {
    modifier += Math.round(Number(status?.attackDamageModifier || 0));
  }
  return modifier;
}

function getCardAllowedEntityKinds(card = {}) {
  const source = Array.isArray(card?.targetEntityKinds)
    ? card.targetEntityKinds
    : String(card?.targetEntityKinds || '')
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);
  const allowed = Array.from(
    new Set(
      source
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter((entry) => entry === 'participant' || entry === 'construct')
    )
  );
  return allowed.length ? allowed : null;
}

function isEntityKindAllowedForCard(card = {}, target = null) {
  if (!target) return true;
  const allowed = getCardAllowedEntityKinds(card);
  if (!allowed?.length) return true;
  return allowed.includes(isConstructEntity(target) ? 'construct' : 'participant');
}

function normalizeContestedOutcome(value) {
  const token = String(value || '').trim().toLowerCase();
  if (!token) return '';
  if (['success', 'successful', 'succeeded', 'passed'].includes(token)) {
    return 'success';
  }
  if (['resisted', 'resist', 'unsuccessful', 'unsuccess', 'failed', 'failure', 'failed_to_cast'].includes(token)) {
    return 'resisted';
  }
  return '';
}

function normalizeContestedTargetOutcomes(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const normalized = {};
  Object.entries(value).forEach(([targetId, outcome]) => {
    const id = String(targetId || '').trim();
    if (!id) return;
    const resolved = normalizeContestedOutcome(outcome);
    if (resolved) {
      normalized[id] = resolved;
    }
  });
  return normalized;
}

function normalizeCardTargetDetails(value) {
  if (!Array.isArray(value)) return {};
  const normalized = {};
  value.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return;
    const targetId = String(entry.targetId || '').trim();
    if (!targetId) return;
    normalized[targetId] = {
      ...entry,
      targetId,
      willing:
        entry.willing === true ||
        String(entry.willing || '')
          .trim()
          .toLowerCase() === 'true',
      distanceFt: Number(entry.distanceFt ?? entry.distance ?? 0)
    };
  });
  return normalized;
}

function getCardContestedEffectConfig(card = {}, masteryLevel = 1) {
  const source = card?.contestedEffect;
  if (!source || typeof source !== 'object') return null;
  const options = (Array.isArray(source.options) ? source.options : [])
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const id = String(entry.id || '').trim();
      const label = String(entry.label || entry.name || entry.statusName || id).trim();
      const durationTurns = Math.max(
        0,
        Math.round(
          getCardScaledValue(
            entry.durationTurnsByLevel,
            masteryLevel,
            Number(entry.durationTurns ?? source.durationTurns ?? 0)
          )
        )
      );
      return id
        ? {
            id,
            label: label || id,
            statusId: String(entry.statusId || entry.id || '').trim(),
            statusName: String(entry.statusName || entry.name || label || '').trim(),
            statusNotes: String(entry.statusNotes || entry.notes || '').trim(),
            statusStacks: Math.max(
              1,
              Math.round(
                getCardScaledValue(
                  entry.statusStacksByLevel,
                  masteryLevel,
                  Number(entry.statusStacks || 1)
                )
              )
            ),
            durationTurns,
            clearStatuses: Array.isArray(entry.clearStatuses)
              ? entry.clearStatuses
              : String(entry.clearStatuses || '')
                  .split(',')
                  .map((value) => value.trim())
                  .filter(Boolean)
          }
        : null;
    })
    .filter(Boolean);
  if (!options.length) return null;
  return {
    hostileOnly: source.hostileOnly !== false,
    promptMode: String(source.promptMode || '').trim().toLowerCase(),
    resistedCasterDamage: Math.max(
      0,
      Math.round(
        getCardScaledValue(
          source.resistedCasterDamageByLevel,
          masteryLevel,
          Number(source.resistedCasterDamage || 0)
        )
      )
    ),
    resistedDamageType: String(source.resistedDamageType || 'Psychic').trim(),
    options
  };
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
    return `utility construct${utilityNote ? ` (${utilityNote})` : ''}${resources.length ? ` (${resources.join(', ')})` : ''}`;
  }
  return `${construct.damage || 0} ${construct.damageType || 'damage'}${resources.length ? ` (${resources.join(', ')})` : ''}`;
}

function deployConstructFromCard(participant, card, options = {}) {
  const masteryLevel = Math.max(1, Math.min(4, Number(options.masteryLevel || card?.masteryLevel || 1)));
  const baseDamage = Math.max(0, Number(options.baseDamage || 0));
  const bonusDamage = Math.max(0, Number(options.bonusDamage || 0));
  const damageType = String(options.damageType || '').trim();
  const mode = normalizeConstructMode(options.mode) || detectConstructMode(card);
  const statusId = String(options.statusId || '').trim();
  const normalizedStatusType = detectStatusType({ presetId: statusId, name: options.statusName });
  const statusName = String(options.statusName || (normalizedStatusType ? statusDisplayName(normalizedStatusType) : '')).trim();
  const statusStacks = Math.max(1, Number(options.statusStacks || 1));
  const durationBase = getCardScaledEffectValue(
    card,
    'constructDurationTurnsByLevel',
    masteryLevel,
    Number(card?.constructDurationTurns ?? card?.constructDuration ?? card?.durationTurns ?? 1)
  );
  const durationBonusTurns = Math.max(0, Number(options.durationBonusTurns || 0));
  const durationTurns = Math.max(
    0,
    (Number.isFinite(durationBase) ? Math.round(durationBase) : 1) + durationBonusTurns
  );
  const apMaxRaw = Number(card?.constructAp ?? card?.constructApMax ?? 2);
  const apMax = Number.isFinite(apMaxRaw) ? Math.max(0, Math.round(apMaxRaw)) : 0;
  const maxHpRaw = Number(options.maxHpOverride ?? card?.constructMaxHp ?? card?.constructHp ?? 1);
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
  const cardObjects = buildConstructCardObjects(card);
  const manualTurns = constructHasManualTurn({
    manualTurns: card?.constructManualTurns,
    cardObjects
  });
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
    entityKind: 'construct',
    ownerId: participant.id,
    sourceCardId: card.id || '',
    name: `${card.name}`,
    damage: finalDamage,
    baseDamage,
    damageBonus: appliedDamageBonus,
    damageType: finalDamageType,
    remainingTurns: durationTurns,
    targetId: String(options.targetId || '').trim(),
    targetIds: Array.from(new Set((options.targetIds || []).map((value) => String(value || '').trim()).filter(Boolean))),
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
    maxShield: 0,
    shield: 0,
    apMax,
    apCurrent: apMax,
    moveFt,
    cards: cardObjects.length ? cardObjects.map((entry) => entry.name).filter(Boolean) : cards,
    cardObjects,
    manualTurns,
    summonSicknessTurn: manualTurns,
    targetPriority: String(card?.constructTargetPriority || '').trim().toLowerCase(),
    statuses: [],
    resistances: [],
    vulnerabilities: [],
    immunities: [],
    rangedUntargetableTurns: 0,
    turnActionCount: 0,
    guardUsedThisTurn: false,
    lastActedRound: 0,
    tags: Array.isArray(card.tags) ? card.tags.map((tag) => String(tag).trim()).filter(Boolean) : [],
    createdAt: new Date().toISOString(),
    createdOrder: Date.now()
  };
  current.push(construct);
  participant.constructs = current;
  return { construct, displaced };
}

function deployZoneFromCard(participant, card, options = {}) {
  const level = Math.max(1, Math.min(4, Number(options.masteryLevel || card?.masteryLevel || 1)));
  const radiusRaw = getCardScaledEffectValue(card, 'zoneRadiusByLevel', level, Number(card.zoneRadius || 0));
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
    statusName: statusApply?.id ? statusDisplayName(statusApply.id) : String(statusApply?.name || '').trim(),
    statusNotes: String(statusApply?.notes || '').trim(),
    statusStacks: Math.max(1, Number(statusApply?.stacks || 1)),
    triggerOnTargetAdd: options.triggerOnTargetAdd === true,
    consumeOnTrigger: options.consumeOnTrigger === true,
    enterDamage: Math.max(0, Number(options.enterDamage || 0)),
    enterDamageType: String(options.enterDamageType || options.damageType || card?.damageType || '').trim(),
    enterStatusId: String(enterStatusApply?.id || '').trim(),
    enterStatusName: enterStatusApply?.id ? statusDisplayName(enterStatusApply.id) : String(enterStatusApply?.name || '').trim(),
    enterStatusNotes: String(enterStatusApply?.notes || '').trim(),
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
  runtime.arcane.noReactionUsesTurn = 0;
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
  runtime.demonic.damagedByPendingIds = [];
  runtime.demonic.damagedByLastTurnIds = [];
  runtime.divine.reverseDamageUsedEncounter = false;
  participant.pauseButtonSkipTurns = 0;
  participant.constructs = [];
  participant.zones = [];
  participant.lastActedRound = 0;
  participant.rangedUntargetableTurns = 0;
  participant.guardActionBonus = 0;
  participant.guardActionBonusTurns = 0;
  resetEncounterCardState(participant);
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
  const abilityBonuses = createZeroAbilityBonuses();
  const grantedProficiencies = [];
  const grantedLanguages = [];
  const seenProficiencies = new Set();
  const seenLanguages = new Set();
  for (const [setName, cards] of source.bySet.entries()) {
    const count = cards.length;
    const definitions = SET_LIBRARY[setName];
    if (!definitions) continue;
    definitions.forEach((bonus) => {
      if (count >= bonus.pieces) {
        const modifiers = normalizeModifiers(bonus.modifiers);
        const setAbilityBonuses = normalizeAbilityBonuses(bonus.abilityBonuses);
        const proficiencies = normalizeTextList(bonus.proficiencies);
        const languages = normalizeTextList(bonus.languages);
        appliedBonuses.push({
          id: bonus.id || `${setName.toLowerCase()}_${bonus.pieces}`,
          set: setName,
          pieces: bonus.pieces,
          effect: bonus.effect,
          modifiers,
          abilityBonuses: setAbilityBonuses,
          proficiencies,
          languages,
          activatable: bonus.activatable || null
        });
        addModifierTotals(totals, modifiers);
        addAbilityBonusesTotals(abilityBonuses, setAbilityBonuses);
        appendUniqueTextEntries(grantedProficiencies, proficiencies, seenProficiencies);
        appendUniqueTextEntries(grantedLanguages, languages, seenLanguages);
      }
    });
  }
  return {
    appliedBonuses,
    setTotals: totals,
    abilityBonuses,
    grantedProficiencies,
    grantedLanguages
  };
}

function recalculateParticipant(participant) {
  participant.statuses = normalizeStatuses(participant.statuses);
  const setRuntime = ensureSetRuntime(participant);
  sanitizeSetAllyTargets(participant);
  const normalizedStats = {};
  for (const key of ABILITY_KEYS) {
    normalizedStats[key] = normalizeAbilityScoreValue(participant?.stats?.[key], 10);
  }
  participant.stats = normalizedStats;
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
  participant.equipment = normalizeParticipantEquipment(participant.equipment);
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
  participant.immunities = normalizeImmunities(participant.immunities);
  const base = ensureBaseStats(participant);
  const totals = createZeroModifier();
  const abilityBonuses = createZeroAbilityBonuses();
  const cardModifiers = [];
  participant.relics = normalizeRelics(participant.relics);
  for (const card of cardGroups.activeCards) {
    const modifiers = normalizeModifiers(card.modifiers);
    addAbilityBonusesTotals(
      abilityBonuses,
      getCardAbilityBonusesAtLevel(card, Math.max(1, Math.min(4, Number(card.masteryLevel || 1))))
    );
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
  const {
    appliedBonuses,
    setTotals,
    abilityBonuses: setAbilityBonuses,
    grantedProficiencies,
    grantedLanguages
  } = computeSetBonuses(participant, cardGroups);
  addModifierTotals(totals, setTotals);
  addAbilityBonusesTotals(abilityBonuses, setAbilityBonuses);

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
  const armorDexterityPenalty = Math.max(0, Number(participant?.equipment?.armor?.dexterityPenalty || 0));
  if (armorDexterityPenalty > 0) {
    abilityBonuses.dexterity -= armorDexterityPenalty;
  }
  const effectiveStats = buildEffectiveAbilityScores(participant.stats, abilityBonuses);
  const equipmentSummary = getParticipantEquipmentSummary(participant, effectiveStats, {
    setProficiencies: grantedProficiencies
  });
  if (equipmentSummary.maxShieldBonus > 0) {
    totals.maxShield += equipmentSummary.maxShieldBonus;
  }
  const attributeScaling = getAttributeScalingFromScores(effectiveStats);
  participant.apMax = Math.max(1, Math.round(((base.apMax ?? 0) + totals.apMax) * overchargeMultiplier));
  participant.apCurrent = normalizeCurrentAp(participant.apCurrent ?? participant.apMax, participant.apMax);
  participant.maxHp = Math.max(
    1,
    Math.round(((base.maxHp ?? 0) + totals.maxHp + attributeScaling.maxHpBonus) * overchargeMultiplier)
  );
  participant.hp = clampNumber(participant.hp ?? participant.maxHp, 0, participant.maxHp);
  participant.maxShield = Math.max(
    0,
    Math.round(((base.maxShield ?? 0) + totals.maxShield + attributeScaling.maxShieldBonus) * overchargeMultiplier)
  );
  participant.shield = clampNumber(
    participant.shield ?? participant.maxShield,
    0,
    participant.maxShield
  );
  participant.guardRestore = Math.max(
    1,
    Math.round((base.guardRestore ?? DEFAULT_GUARD_RESTORE) + totals.guardRestore)
  );
  participant.shieldRegen = Math.max(0, Math.round(Number(equipmentSummary.shieldRegen || 0)));
  participant.damageBonus = Math.round((base.damageBonus ?? 0) + totals.damageBonus);
  participant.nextAttackDamageBonus = Number.isFinite(Number(participant.nextAttackDamageBonus))
    ? Math.max(0, Math.round(Number(participant.nextAttackDamageBonus)))
    : 0;
  participant.rangedUntargetableTurns = Number.isFinite(Number(participant.rangedUntargetableTurns))
    ? Math.max(0, Math.round(Number(participant.rangedUntargetableTurns)))
    : 0;
  participant.guardActionBonusTurns = Number.isFinite(Number(participant.guardActionBonusTurns))
    ? Math.max(0, Math.round(Number(participant.guardActionBonusTurns)))
    : 0;
  participant.guardActionBonus = Number.isFinite(Number(participant.guardActionBonus))
    ? Math.max(0, Math.round(Number(participant.guardActionBonus)))
    : 0;
  if (participant.guardActionBonusTurns <= 0) {
    participant.guardActionBonus = 0;
  }
  participant.initiative = Math.round(Number(effectiveStats.dexterity || 0));
  participant.derivedBonuses = {
    base,
    totals,
    abilityBonuses,
    effectiveStats,
    attributeScaling,
    cardModifiers,
    cardLoadout: {
      maxActive: MAX_ACTIVE_CARDS,
      active: cardGroups.activeCards.length,
      total: participant.cards.length
    },
    setBonuses: appliedBonuses,
    setGrants: {
      abilityBonuses: setAbilityBonuses,
      proficiencies: grantedProficiencies,
      languages: grantedLanguages
    },
    equipment: equipmentSummary,
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
  if (Array.isArray(encounter.characterPresets)) {
    characterPresetLibrary = normalizeCharacterPresetLibrary(encounter.characterPresets);
  }
  trackerState.encounter = {
    name: encounter.name || 'Imported Encounter',
    round: Number(encounter.round) || 1,
    started: Boolean(encounter.started),
    participants: [],
    currentIndex: -1,
    currentTurnKey: String(encounter.currentTurnKey || ''),
    pauseState: normalizeEncounterPauseState(encounter.pauseState),
    log: Array.isArray(encounter.log) ? encounter.log.slice(-200) : []
  };
  cardActionHistory.length = 0;
  const participants = Array.isArray(encounter.participants)
    ? encounter.participants.map((raw) => createParticipant(raw))
    : [];
  trackerState.encounter.participants = participants;
  trackerState.encounter.currentIndex =
    typeof encounter.currentIndex === 'number' ? encounter.currentIndex : -1;
  sortParticipants();
  ensureCurrentIndex();
  refreshReferenceData();
}
