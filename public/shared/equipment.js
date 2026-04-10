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
export const MAGIC_DAMAGE_TYPES = Object.freeze([
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
]);

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

function createWeaponCatalogEntry({
  id,
  name,
  category,
  weaponStyle,
  hands,
  basicAttackDamage = 0,
  basicAttackApCost = 0,
  basicAttackDamageType = '',
  cardBonusDamage = 0,
  requirementAbility = 'none',
  requirementScore = 0,
  proficiencyGroup = '',
  tags = [],
  notes = ''
}) {
  const normalizedStyle = normalizeWeaponStyle(weaponStyle);
  return Object.freeze({
    id,
    name,
    category,
    kind: 'weapon',
    weaponStyle: normalizedStyle,
    hands: Number.isFinite(Number(hands)) ? Math.max(1, Math.min(2, Math.round(Number(hands)))) : getDefaultWeaponHands(normalizedStyle),
    basicAttackDamage: Math.max(0, Math.round(Number(basicAttackDamage || 0))),
    basicAttackApCost: Math.max(0, Math.round(Number(basicAttackApCost || 0))),
    basicAttackDamageType: String(basicAttackDamageType || '').trim(),
    cardBonusDamage: Math.max(0, Math.round(Number(cardBonusDamage || 0))),
    requirementAbility: normalizeRequirementAbility(requirementAbility),
    requirementScore: Math.max(0, Math.round(Number(requirementScore || 0))),
    proficiencyGroup: String(proficiencyGroup || name || '').trim(),
    tags: Object.freeze((Array.isArray(tags) ? tags : []).map((entry) => String(entry || '').trim()).filter(Boolean)),
    notes: String(notes || '').trim()
  });
}

export const WEAPON_CATALOG = Object.freeze([
  createWeaponCatalogEntry({
    id: 'dagger',
    name: 'Dagger',
    category: 'Light Weapons',
    weaponStyle: 'melee',
    hands: 1,
    basicAttackDamage: 2,
    basicAttackApCost: 1,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 1,
    requirementAbility: 'either',
    requirementScore: 10,
    proficiencyGroup: 'Dagger',
    tags: ['Light', 'Finesse', 'Off-Hand']
  }),
  createWeaponCatalogEntry({
    id: 'club',
    name: 'Club',
    category: 'Light Weapons',
    weaponStyle: 'melee',
    hands: 1,
    basicAttackDamage: 2,
    basicAttackApCost: 1,
    basicAttackDamageType: 'Bludgeoning',
    cardBonusDamage: 1,
    requirementAbility: 'strength',
    requirementScore: 10,
    proficiencyGroup: 'Club',
    tags: ['Light']
  }),
  createWeaponCatalogEntry({
    id: 'shortsword',
    name: 'Shortsword',
    category: 'Standard Melee Weapons',
    weaponStyle: 'melee',
    hands: 1,
    basicAttackDamage: 3,
    basicAttackApCost: 2,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'either',
    requirementScore: 12,
    proficiencyGroup: 'Shortsword',
    tags: ['Finesse']
  }),
  createWeaponCatalogEntry({
    id: 'longsword',
    name: 'Longsword',
    category: 'Standard Melee Weapons',
    weaponStyle: 'melee',
    hands: 1,
    basicAttackDamage: 4,
    basicAttackApCost: 2,
    basicAttackDamageType: 'Slashing',
    cardBonusDamage: 2,
    requirementAbility: 'strength',
    requirementScore: 12,
    proficiencyGroup: 'Longsword',
    tags: ['Versatile']
  }),
  createWeaponCatalogEntry({
    id: 'spear',
    name: 'Spear',
    category: 'Standard Melee Weapons',
    weaponStyle: 'melee',
    hands: 1,
    basicAttackDamage: 3,
    basicAttackApCost: 2,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'strength',
    requirementScore: 12,
    proficiencyGroup: 'Spear',
    tags: ['Reach']
  }),
  createWeaponCatalogEntry({
    id: 'battleaxe',
    name: 'Battleaxe',
    category: 'Standard Melee Weapons',
    weaponStyle: 'melee',
    hands: 1,
    basicAttackDamage: 5,
    basicAttackApCost: 2,
    basicAttackDamageType: 'Slashing',
    cardBonusDamage: 2,
    requirementAbility: 'strength',
    requirementScore: 14,
    proficiencyGroup: 'Battleaxe',
    tags: ['Heavy']
  }),
  createWeaponCatalogEntry({
    id: 'greatsword',
    name: 'Greatsword',
    category: 'Heavy Melee Weapons',
    weaponStyle: 'melee',
    hands: 2,
    basicAttackDamage: 6,
    basicAttackApCost: 3,
    basicAttackDamageType: 'Slashing',
    cardBonusDamage: 3,
    requirementAbility: 'strength',
    requirementScore: 16,
    proficiencyGroup: 'Greatsword',
    tags: ['Heavy', 'Two-Handed']
  }),
  createWeaponCatalogEntry({
    id: 'greataxe',
    name: 'Greataxe',
    category: 'Heavy Melee Weapons',
    weaponStyle: 'melee',
    hands: 2,
    basicAttackDamage: 7,
    basicAttackApCost: 3,
    basicAttackDamageType: 'Slashing',
    cardBonusDamage: 3,
    requirementAbility: 'strength',
    requirementScore: 16,
    proficiencyGroup: 'Greataxe',
    tags: ['Heavy', 'Two-Handed']
  }),
  createWeaponCatalogEntry({
    id: 'glaive_halberd',
    name: 'Glaive / Halberd',
    category: 'Heavy Melee Weapons',
    weaponStyle: 'melee',
    hands: 2,
    basicAttackDamage: 5,
    basicAttackApCost: 3,
    basicAttackDamageType: 'Slashing',
    cardBonusDamage: 3,
    requirementAbility: 'strength',
    requirementScore: 16,
    proficiencyGroup: 'Glaive / Halberd',
    tags: ['Heavy', 'Reach', 'Two-Handed']
  }),
  createWeaponCatalogEntry({
    id: 'sling',
    name: 'Sling',
    category: 'Ranged Weapons (DEX-Based)',
    weaponStyle: 'ranged',
    hands: 1,
    basicAttackDamage: 2,
    basicAttackApCost: 1,
    basicAttackDamageType: 'Bludgeoning',
    cardBonusDamage: 1,
    requirementAbility: 'dexterity',
    requirementScore: 10,
    proficiencyGroup: 'Sling'
  }),
  createWeaponCatalogEntry({
    id: 'shortbow',
    name: 'Shortbow',
    category: 'Ranged Weapons (DEX-Based)',
    weaponStyle: 'ranged',
    hands: 2,
    basicAttackDamage: 3,
    basicAttackApCost: 2,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'dexterity',
    requirementScore: 12,
    proficiencyGroup: 'Shortbow'
  }),
  createWeaponCatalogEntry({
    id: 'longbow',
    name: 'Longbow',
    category: 'Ranged Weapons (DEX-Based)',
    weaponStyle: 'ranged',
    hands: 2,
    basicAttackDamage: 4,
    basicAttackApCost: 3,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'dexterity',
    requirementScore: 14,
    proficiencyGroup: 'Longbow',
    tags: ['Two-Handed']
  }),
  createWeaponCatalogEntry({
    id: 'hand_crossbow',
    name: 'Hand Crossbow',
    category: 'Crossbows',
    weaponStyle: 'ranged',
    hands: 1,
    basicAttackDamage: 3,
    basicAttackApCost: 2,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'dexterity',
    requirementScore: 12,
    proficiencyGroup: 'Hand Crossbow',
    tags: ['One-Handed']
  }),
  createWeaponCatalogEntry({
    id: 'light_crossbow',
    name: 'Light Crossbow',
    category: 'Crossbows',
    weaponStyle: 'ranged',
    hands: 2,
    basicAttackDamage: 4,
    basicAttackApCost: 3,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'dexterity',
    requirementScore: 14,
    proficiencyGroup: 'Light Crossbow'
  }),
  createWeaponCatalogEntry({
    id: 'heavy_crossbow',
    name: 'Heavy Crossbow',
    category: 'Crossbows',
    weaponStyle: 'ranged',
    hands: 2,
    basicAttackDamage: 6,
    basicAttackApCost: 4,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'dexterity',
    requirementScore: 16,
    proficiencyGroup: 'Heavy Crossbow',
    tags: ['Heavy']
  }),
  createWeaponCatalogEntry({
    id: 'pistol',
    name: 'Pistol',
    category: 'Modern Weapons',
    weaponStyle: 'ranged',
    hands: 1,
    basicAttackDamage: 3,
    basicAttackApCost: 1,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 1,
    requirementAbility: 'dexterity',
    requirementScore: 12,
    proficiencyGroup: 'Pistol',
    tags: ['Light']
  }),
  createWeaponCatalogEntry({
    id: 'smg',
    name: 'SMG',
    category: 'Modern Weapons',
    weaponStyle: 'ranged',
    hands: 1,
    basicAttackDamage: 4,
    basicAttackApCost: 2,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'dexterity',
    requirementScore: 14,
    proficiencyGroup: 'SMG'
  }),
  createWeaponCatalogEntry({
    id: 'assault_rifle',
    name: 'Assault Rifle',
    category: 'Modern Weapons',
    weaponStyle: 'ranged',
    hands: 2,
    basicAttackDamage: 5,
    basicAttackApCost: 2,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'dexterity',
    requirementScore: 14,
    proficiencyGroup: 'Assault Rifle',
    tags: ['Two-Handed']
  }),
  createWeaponCatalogEntry({
    id: 'shotgun',
    name: 'Shotgun',
    category: 'Modern Weapons',
    weaponStyle: 'ranged',
    hands: 2,
    basicAttackDamage: 6,
    basicAttackApCost: 3,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'strength',
    requirementScore: 16,
    proficiencyGroup: 'Shotgun',
    tags: ['Two-Handed', 'Heavy']
  }),
  createWeaponCatalogEntry({
    id: 'bolt_action_rifle',
    name: 'Bolt-Action Rifle',
    category: 'Modern Weapons',
    weaponStyle: 'ranged',
    hands: 2,
    basicAttackDamage: 7,
    basicAttackApCost: 4,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'dexterity',
    requirementScore: 16,
    proficiencyGroup: 'Bolt-Action Rifle',
    tags: ['Two-Handed', 'Heavy']
  }),
  createWeaponCatalogEntry({
    id: 'sniper_rifle',
    name: 'Sniper Rifle',
    category: 'Modern Weapons',
    weaponStyle: 'ranged',
    hands: 2,
    basicAttackDamage: 8,
    basicAttackApCost: 6,
    basicAttackDamageType: 'Piercing',
    cardBonusDamage: 2,
    requirementAbility: 'dexterity',
    requirementScore: 18,
    proficiencyGroup: 'Sniper Rifle',
    tags: ['Heavy']
  }),
  createWeaponCatalogEntry({
    id: 'wand',
    name: 'Wand',
    category: 'Magic Implements',
    weaponStyle: 'arcane',
    hands: 1,
    cardBonusDamage: 1,
    proficiencyGroup: 'Arcane Implements',
    notes: 'No basic attack.'
  }),
  createWeaponCatalogEntry({
    id: 'orb',
    name: 'Orb',
    category: 'Magic Implements',
    weaponStyle: 'arcane',
    hands: 1,
    cardBonusDamage: 1,
    proficiencyGroup: 'Arcane Implements',
    notes: 'No basic attack.'
  }),
  createWeaponCatalogEntry({
    id: 'book',
    name: 'Book',
    category: 'Magic Implements',
    weaponStyle: 'arcane',
    hands: 1,
    cardBonusDamage: 1,
    proficiencyGroup: 'Arcane Implements',
    notes: 'No basic attack.'
  }),
  createWeaponCatalogEntry({
    id: 'ring',
    name: 'Ring',
    category: 'Magic Implements',
    weaponStyle: 'arcane',
    hands: 1,
    cardBonusDamage: 1,
    proficiencyGroup: 'Arcane Implements',
    notes: 'No basic attack.'
  }),
  createWeaponCatalogEntry({
    id: 'staff',
    name: 'Staff',
    category: 'Magic Implements',
    weaponStyle: 'staff',
    hands: 2,
    cardBonusDamage: 2,
    proficiencyGroup: 'Staff',
    notes: 'No basic attack.'
  })
]);

const WEAPON_CATALOG_BY_ID = new Map(WEAPON_CATALOG.map((entry) => [entry.id, entry]));
const WEAPON_CATALOG_BY_NAME = new Map(
  WEAPON_CATALOG.map((entry) => [normalizeEquipmentToken(entry.name), entry])
);

const PHYSICAL_DAMAGE_TOKENS = new Set(PHYSICAL_DAMAGE_TYPES.map((entry) => normalizeEquipmentToken(entry)));
const MAGIC_DAMAGE_TOKENS = new Set(MAGIC_DAMAGE_TYPES.map((entry) => normalizeEquipmentToken(entry)));
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

export function getWeaponCatalogEntry(id = '') {
  return WEAPON_CATALOG_BY_ID.get(String(id || '').trim()) || null;
}

export function findWeaponCatalogEntryByName(name = '') {
  return WEAPON_CATALOG_BY_NAME.get(normalizeEquipmentToken(name)) || null;
}

export function isMagicDamageType(value = '') {
  return MAGIC_DAMAGE_TOKENS.has(normalizeEquipmentToken(value));
}

export function cardInflictsStatus(card = {}) {
  if (card?.statusApply && typeof card.statusApply === 'object') return true;
  if (Array.isArray(card?.contestedEffect?.options) && card.contestedEffect.options.length) return true;
  return false;
}

export function isMagicCard(card = {}, options = {}) {
  const tags = new Set(
    (Array.isArray(card?.tags) ? card.tags : [])
      .map((entry) => normalizeEquipmentToken(entry))
      .filter(Boolean)
  );
  const damageTypeToken = normalizeEquipmentToken(options.damageType ?? card?.damageType ?? '');
  const secondaryDamageTypeToken = normalizeEquipmentToken(options.secondaryDamageType ?? card?.secondaryDamageType ?? '');
  const baseDamage = Number(options.damage ?? card?.damage ?? 0);
  const secondaryDamage = Number(options.secondaryDamage ?? card?.secondaryDamage ?? 0);
  const hasDamage =
    (Number.isFinite(baseDamage) && baseDamage > 0) ||
    (Number.isFinite(secondaryDamage) && secondaryDamage > 0);
  if (!hasDamage) return false;
  return (
    isMagicDamageType(damageTypeToken) ||
    isMagicDamageType(secondaryDamageTypeToken) ||
    tags.has('spell') ||
    tags.has('magic') ||
    cardInflictsStatus(card)
  );
}

export function getWeaponAffectedCardLabel(item = {}) {
  const style = normalizeWeaponStyle(item?.weaponStyle || item?.style || item?.subcategory);
  if (style === 'melee') return '5 ft damage cards, including 5 ft magic cards';
  if (style === 'ranged') return 'ranged cards and damaging magic cards';
  if (style === 'arcane' || style === 'staff') return 'damaging magic cards';
  return 'matching cards';
}

export function getWeaponCardInteraction(weapon = {}, card = {}, options = {}) {
  const style = normalizeWeaponStyle(weapon?.weaponStyle || weapon?.style || weapon?.subcategory);
  const range = Number.isFinite(Number(options.range)) ? Number(options.range) : Number(card?.range || 0);
  const baseDamage = Number(options.damage ?? card?.damage ?? 0);
  const secondaryDamage = Number(options.secondaryDamage ?? card?.secondaryDamage ?? 0);
  const hasDamage =
    (Number.isFinite(baseDamage) && baseDamage > 0) ||
    (Number.isFinite(secondaryDamage) && secondaryDamage > 0);
  const magic = isMagicCard(card, options);
  let matches = false;
  let cardType = '';
  let matchLabel = '';

  if (style === 'melee') {
    matches = hasDamage && range > 0 && range <= 5;
    if (matches) {
      cardType = magic ? 'magic_melee' : 'melee';
      matchLabel = magic ? '5 ft magic damage card' : 'melee damage card';
    }
  } else if (style === 'ranged') {
    matches = hasDamage && (range > 10 || magic);
    if (matches) {
      cardType = magic ? 'magic' : 'ranged';
      matchLabel = magic ? 'damaging magic card' : 'ranged damage card';
    }
  } else if (style === 'arcane' || style === 'staff') {
    matches = hasDamage && magic;
    if (matches) {
      cardType = 'magic';
      matchLabel = 'damaging magic card';
    }
  }

  return {
    matches,
    cardType,
    matchLabel,
    hasDamage,
    isMagic: magic,
    range
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
  const range = Number.isFinite(Number(options.range)) ? Number(options.range) : Number(card?.range || 0);
  const baseDamage = Number(options.damage ?? card?.damage ?? 0);
  const secondaryDamage = Number(options.secondaryDamage ?? card?.secondaryDamage ?? 0);
  const hasDamage =
    (Number.isFinite(baseDamage) && baseDamage > 0) ||
    (Number.isFinite(secondaryDamage) && secondaryDamage > 0);
  if (hasDamage && range > 0 && range <= 5) return 'melee';
  if (hasDamage && range > 10) return 'ranged';
  if (isMagicCard(card, options)) return 'spell';
  return '';
}
