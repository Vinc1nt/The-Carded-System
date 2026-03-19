const CARD_TIER_SHIELD_BONUS = Object.freeze({
  common: 1,
  uncommon: 1,
  rare: 2,
  'very rare': 3,
  veryrare: 3,
  epic: 4,
  legendary: 5
});

const CARD_TIER_MASTERY_THRESHOLDS = Object.freeze({
  common: Object.freeze({ level2: 10, level3: 25, level4: 50 }),
  uncommon: Object.freeze({ level2: 13, level3: 35, level4: 70 }),
  rare: Object.freeze({ level2: 15, level3: 45, level4: 100 }),
  'very rare': Object.freeze({ level2: 20, level3: 50, level4: 120 }),
  veryrare: Object.freeze({ level2: 20, level3: 50, level4: 120 }),
  epic: Object.freeze({ level2: 25, level3: 65, level4: 140 }),
  legendary: Object.freeze({ level2: 30, level3: 85, level4: 190 })
});

export function normalizeTierToken(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ');
}

export function getCardTierShieldBonus(tier = '') {
  return CARD_TIER_SHIELD_BONUS[normalizeTierToken(tier)] ?? 0;
}

export function getCardTierMasteryThresholds(tier = '') {
  const token = normalizeTierToken(tier);
  const match = CARD_TIER_MASTERY_THRESHOLDS[token] || CARD_TIER_MASTERY_THRESHOLDS.common;
  return { level2: match.level2, level3: match.level3, level4: match.level4 };
}
