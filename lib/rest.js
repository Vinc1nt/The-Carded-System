import { getAbilityModifierFromScore } from '../public/shared/stat-balance.js';

function removeMinorStatus(participant, deps = {}) {
  const { detectStatusType, normalizeStatusToken } = deps;
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

export function applyShortRestForEncounter(participant, deps = {}) {
  const { detectStatusType, normalizeStatusToken, pushLog } = deps;
  if (!participant) return;
  const rawConScore = participant.stats?.constitution ?? participant.stats?.con ?? 10;
  const conScore = Number(rawConScore) === 0 ? 10 : rawConScore;
  const conMod = getAbilityModifierFromScore(conScore);
  const healAmount = Math.max(1, 5 + conMod);
  participant.hp = Math.min(participant.maxHp, participant.hp + healAmount);
  removeMinorStatus(participant, { detectStatusType, normalizeStatusToken });
  pushLog(`${participant.name} completes a short rest and heals ${healAmount} HP.`, participant.id);
}

export function applyLongRestForEncounter(participant, deps = {}) {
  const { pushLog } = deps;
  if (!participant) return;
  participant.hp = participant.maxHp;
  participant.shield = participant.maxShield;
  participant.statuses = [];
  participant.constructs = [];
  participant.zones = [];
  participant.apCurrent = participant.apMax;
  participant.guardUsedThisTurn = false;
  pushLog(`${participant.name} takes a long rest and is fully restored.`, participant.id);
}
