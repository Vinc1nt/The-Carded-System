const ABILITY_KEYS = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

export const ATTRIBUTE_BALANCE = Object.freeze({
  baseMoveFt: 10,
  difficultMoveFt: 5,
  meleeRangeFt: 5,
  strengthMeleeDamagePerModifier: 1,
  dexterityMoveFtPerModifier: 5,
  constitutionMaxHpPerModifier: 4,
  wisdomMaxShieldPerModifier: 4,
  intelligenceMagicDamagePerModifier: 1,
  charismaStatusEffectDamagePerModifier: 1,
  meleeDamageTypes: Object.freeze(['Bludgeoning', 'Piercing', 'Slashing']),
  directMagicDamageTypes: Object.freeze([
    'Acid',
    'Cold',
    'Fire',
    'Force',
    'Lightning',
    'Necrotic',
    'Poison',
    'Psychic',
    'Radiant',
    'Thunder'
  ])
});

function normalizeDamageType(value = '') {
  return String(value || '').trim().toLowerCase();
}

export function getAbilityModifierFromScore(score = 0) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.floor((value - 10) / 2);
}

export function getAbilityModifiersFromScores(scores = {}) {
  const modifiers = {};
  for (const key of ABILITY_KEYS) {
    modifiers[key] = getAbilityModifierFromScore(scores?.[key] ?? 0);
  }
  return modifiers;
}

export function getAttributeScalingFromScores(scores = {}) {
  const modifiers = getAbilityModifiersFromScores(scores);
  const moveFtBonus = modifiers.dexterity * ATTRIBUTE_BALANCE.dexterityMoveFtPerModifier;
  return {
    modifiers,
    moveFtBonus,
    moveFt: Math.max(0, ATTRIBUTE_BALANCE.baseMoveFt + moveFtBonus),
    moveDifficultFt: Math.max(0, ATTRIBUTE_BALANCE.difficultMoveFt + moveFtBonus),
    meleeDamageBonus: modifiers.strength * ATTRIBUTE_BALANCE.strengthMeleeDamagePerModifier,
    maxHpBonus: modifiers.constitution * ATTRIBUTE_BALANCE.constitutionMaxHpPerModifier,
    maxShieldBonus: modifiers.wisdom * ATTRIBUTE_BALANCE.wisdomMaxShieldPerModifier,
    magicDamageBonus: modifiers.intelligence * ATTRIBUTE_BALANCE.intelligenceMagicDamagePerModifier,
    statusEffectDamageBonus: modifiers.charisma * ATTRIBUTE_BALANCE.charismaStatusEffectDamagePerModifier
  };
}

export function isMeleeDamageType(damageType = '') {
  const token = normalizeDamageType(damageType);
  return ATTRIBUTE_BALANCE.meleeDamageTypes.some((entry) => normalizeDamageType(entry) === token);
}

export function isDirectMagicDamageType(damageType = '') {
  const token = normalizeDamageType(damageType);
  return ATTRIBUTE_BALANCE.directMagicDamageTypes.some((entry) => normalizeDamageType(entry) === token);
}

export function isMeleeAttackProfile(profile = {}) {
  if (profile?.isZone === true || profile?.isConstruct === true) return false;
  if (!isMeleeDamageType(profile?.damageType)) return false;
  const rangeText = String(profile?.rangeText || '').trim().toLowerCase();
  if (rangeText.includes('melee')) return true;
  const range = Number(profile?.range ?? 0);
  return Number.isFinite(range) && range <= ATTRIBUTE_BALANCE.meleeRangeFt;
}

export function isDirectMagicDamageProfile(profile = {}) {
  if (profile?.isZone === true || profile?.isConstruct === true) return false;
  return isDirectMagicDamageType(profile?.damageType);
}

export function getContextualDamageBonusFromScaling(scaling = {}, profile = {}) {
  const meleeDamageBonus = isMeleeAttackProfile(profile) ? Math.round(Number(scaling?.meleeDamageBonus || 0)) : 0;
  const magicDamageBonus = isDirectMagicDamageProfile(profile) ? Math.round(Number(scaling?.magicDamageBonus || 0)) : 0;
  return {
    meleeDamageBonus,
    magicDamageBonus,
    total: meleeDamageBonus + magicDamageBonus
  };
}
