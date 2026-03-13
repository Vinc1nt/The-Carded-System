const CARD_TIER_SHIELD_BONUS = Object.freeze({
  common: 1,
  uncommon: 1,
  rare: 2,
  'very rare': 3,
  veryrare: 3,
  epic: 4,
  legendary: 5
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

