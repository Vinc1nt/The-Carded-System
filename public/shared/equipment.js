export const EQUIPMENT_DAMAGE_TYPES = Object.freeze([
  'Acid',
  'Bludgeoning',
  'Cold',
  'Fire',
  'Force',
  'Lightning',
  'Necrotic',
  'Piercing',
  'Poison',
  'Psychic',
  'Radiant',
  'Slashing',
  'Thunder'
]);

export const PHYSICAL_DAMAGE_TYPES = Object.freeze(['Bludgeoning', 'Piercing', 'Slashing']);

export const WEAPON_STYLE_OPTIONS = Object.freeze([
  { value: 'melee', label: 'Melee Weapon' },
  { value: 'ranged', label: 'Ranged Weapon' },
  { value: 'arcane', label: 'Arcane Implement (wand, orb, grimoire, etc.)' },
  { value: 'staff', label: 'Staff' }
]);

export const ARMOR_TYPE_OPTIONS = Object.freeze([
  { value: 'light', label: 'Light Armour' },
  { value: 'medium', label: 'Medium Armour' },
  { value: 'heavy', label: 'Heavy Armour' }
]);

export const REQUIREMENT_ABILITY_OPTIONS = Object.freeze([
  { value: 'none', label: 'No Requirement' },
  { value: 'strength', label: 'Strength' },
  { value: 'dexterity', label: 'Dexterity' },
  { value: 'either', label: 'STR or DEX (Finesse)' }
]);

const PHYSICAL_DAMAGE_TOKENS = new Set(PHYSICAL_DAMAGE_TYPES.map((entry) => normalizeEquipmentToken(entry)));
const MAGICAL_CARD_HINT_TOKENS = new Set([
  'acid',
  'cold',
  'curse',
  'fire',
  'force',
  'healing',
  'lightning',
  'magic',
  'necrotic',
  'poison',
  'psychic',
  'radiant',
  'spell',
  'thunder'
]);

export function normalizeEquipmentToken(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function normalizeEquipmentCategory(value = '') {
  const token = normalizeEquipmentToken(value);
  if (token === 'weapon' || token === 'weapons') return 'weapon';
  if (token === 'armor' || token === 'armour' || token === 'armors' || token === 'armours') return 'armor';
  if (token === 'shield' || token === 'shields') return 'shield';
  return '';
}

export function normalizeWeaponStyle(value = '') {
  const token = normalizeEquipmentToken(value);
  if (token === 'melee' || token === 'meleeweapon') return 'melee';
  if (token === 'ranged' || token === 'rangedweapon') return 'ranged';
  if (
    token === 'arcane' ||
    token === 'arcaneimplement' ||
    token === 'implement' ||
    token === 'wand' ||
    token === 'orb' ||
    token === 'grimoire' ||
    token === 'grimoires' ||
    token === 'tome' ||
    token === 'book' ||
    token === 'ring'
  ) {
    return 'arcane';
  }
  if (token === 'staff') return 'staff';
  return '';
}

export function normalizeArmorType(value = '') {
  const token = normalizeEquipmentToken(value);
  if (token === 'light' || token === 'lightarmor' || token === 'lightarmour') return 'light';
  if (token === 'medium' || token === 'mediumarmor' || token === 'mediumarmour') return 'medium';
  if (token === 'heavy' || token === 'heavyarmor' || token === 'heavyarmour') return 'heavy';
  return '';
}

export function normalizeRequirementAbility(value = '') {
  const token = normalizeEquipmentToken(value);
  if (token === 'strength' || token === 'str') return 'strength';
  if (token === 'dexterity' || token === 'dex' || token === 'de') return 'dexterity';
  if (token === 'either' || token === 'finesse' || token === 'strordex') return 'either';
  return 'none';
}

export function getDefaultWeaponHands(style = '') {
  const normalized = normalizeWeaponStyle(style);
  if (normalized === 'staff') return 2;
  return 1;
}

export function getDefaultWeaponCardBonus(style = '') {
  const normalized = normalizeWeaponStyle(style);
  if (normalized === 'staff') return 2;
  if (normalized === 'arcane') return 1;
  return 0;
}

export function getDefaultWeaponRequirementAbility(style = '') {
  const normalized = normalizeWeaponStyle(style);
  if (normalized === 'ranged') return 'dexterity';
  if (normalized === 'melee') return 'strength';
  return 'none';
}

export function getDefaultWeaponProficiencyGroup(style = '') {
  const normalized = normalizeWeaponStyle(style);
  if (normalized === 'arcane') return 'Arcane Implements';
  if (normalized === 'staff') return 'Staff';
  if (normalized === 'ranged') return 'Ranged Weapons';
  if (normalized === 'melee') return 'Melee Weapons';
  return '';
}

export function getDefaultArmorProperties(type = '') {
  const normalized = normalizeArmorType(type);
  if (normalized === 'medium') {
    return {
      maxShieldBonus: 4,
      shieldRegen: 2,
      strengthRequirement: 12,
      dexterityPenalty: 1
    };
  }
  if (normalized === 'heavy') {
    return {
      maxShieldBonus: 6,
      shieldRegen: 3,
      strengthRequirement: 14,
      dexterityPenalty: 2
    };
  }
  return {
    maxShieldBonus: 2,
    shieldRegen: 1,
    strengthRequirement: 0,
    dexterityPenalty: 0
  };
}

export function getWeaponCardMatchType(item = {}) {
  const style = normalizeWeaponStyle(item?.weaponStyle || item?.style || item?.subcategory);
  if (style === 'melee') return 'melee';
  if (style === 'ranged') return 'ranged';
  if (style === 'arcane' || style === 'staff') return 'spell';
  return '';
}

export function hasWeaponBasicAttack(item = {}) {
  const category = normalizeEquipmentCategory(item?.kind || item?.category || item?.type);
  const style = normalizeWeaponStyle(item?.weaponStyle || item?.style || item?.subcategory);
  return category === 'weapon' && (style === 'melee' || style === 'ranged');
}

export function classifyCardEquipmentMatch(card = {}, options = {}) {
  const typeToken = normalizeEquipmentToken(card?.type);
  const tags = new Set(
    (Array.isArray(card?.tags) ? card.tags : [])
      .map((entry) => normalizeEquipmentToken(entry))
      .filter(Boolean)
  );
  const range = Number.isFinite(Number(options.range)) ? Number(options.range) : Number(card?.range || 0);
  const damageTypeToken = normalizeEquipmentToken(options.damageType ?? card?.damageType ?? '');
  const baseDamage = Number(options.damage ?? card?.damage ?? 0);
  const secondaryDamage = Number(options.secondaryDamage ?? card?.secondaryDamage ?? 0);
  const isAttackLike =
    typeToken.includes('attack') ||
    tags.has('attack') ||
    Number.isFinite(baseDamage) && baseDamage > 0 ||
    Number.isFinite(secondaryDamage) && secondaryDamage > 0;

  if (tags.has('melee') || typeToken.includes('melee')) return 'melee';
  if (tags.has('ranged') || typeToken.includes('ranged')) return 'ranged';
  if (tags.has('spell') || typeToken.includes('spell')) return 'spell';

  if (damageTypeToken && PHYSICAL_DAMAGE_TOKENS.has(damageTypeToken)) {
    return range > 5 ? 'ranged' : 'melee';
  }

  if (damageTypeToken && isAttackLike) {
    return 'spell';
  }

  if ([...tags].some((entry) => MAGICAL_CARD_HINT_TOKENS.has(entry))) {
    return 'spell';
  }

  return '';
}
