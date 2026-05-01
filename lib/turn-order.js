export function buildTurnEntriesForEncounter(encounter, normalizeZones) {
  const entries = [];
  for (const participant of encounter.participants || []) {
    entries.push({
      kind: 'participant',
      participantId: participant.id
    });
    participant.zones = normalizeZones(participant.zones, participant.id);
    for (const zone of participant.zones) {
      if (zone?.tickOnTurn === false) continue;
      entries.push({
        kind: 'zone',
        participantId: participant.id,
        zoneId: zone.id
      });
    }
  }
  return entries;
}

export function getTurnEntryKeyForEncounter(entry) {
  if (!entry) return '';
  if (entry.kind === 'construct') {
    return `construct:${entry.participantId}:${entry.constructId}`;
  }
  if (entry.kind === 'zone') {
    return `zone:${entry.participantId}:${entry.zoneId}`;
  }
  return `participant:${entry.participantId}`;
}

export function setCurrentTurnByIndexForEncounter(encounter, entries, index) {
  if (!entries.length) {
    encounter.currentIndex = -1;
    encounter.currentTurnKey = '';
    return null;
  }
  const safeIndex = Math.min(Math.max(Number(index) || 0, 0), entries.length - 1);
  const entry = entries[safeIndex];
  encounter.currentIndex = safeIndex;
  encounter.currentTurnKey = getTurnEntryKeyForEncounter(entry);
  return entry;
}

function findFallbackIndexForLegacyTurnKey(entries = [], key = '') {
  const parts = String(key || '').split(':');
  if (parts[0] === 'construct' && parts[1]) {
    return entries.findIndex((entry) => entry.kind === 'participant' && String(entry.participantId || '') === String(parts[1] || ''));
  }
  return -1;
}

export function ensureCurrentIndexForEncounter(encounter, normalizeZones) {
  const entries = buildTurnEntriesForEncounter(encounter, normalizeZones);
  if (!entries.length) {
    encounter.currentIndex = -1;
    encounter.currentTurnKey = '';
    return;
  }
  const currentKey = String(encounter.currentTurnKey || '');
  if (currentKey) {
    const keyedIndex = entries.findIndex((entry) => getTurnEntryKeyForEncounter(entry) === currentKey);
    if (keyedIndex >= 0) {
      setCurrentTurnByIndexForEncounter(encounter, entries, keyedIndex);
      return;
    }
    const fallbackIndex = findFallbackIndexForLegacyTurnKey(entries, currentKey);
    if (fallbackIndex >= 0) {
      setCurrentTurnByIndexForEncounter(encounter, entries, fallbackIndex);
      return;
    }
  }
  const currentIndex = Number(encounter.currentIndex);
  if (Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < entries.length) {
    setCurrentTurnByIndexForEncounter(encounter, entries, currentIndex);
    return;
  }
  setCurrentTurnByIndexForEncounter(encounter, entries, 0);
}

export function resolveCurrentTurnIndexForAdvanceForEncounter(encounter, entries, direction = 1) {
  const key = String(encounter.currentTurnKey || '');
  if (key) {
    const keyedIndex = entries.findIndex((entry) => getTurnEntryKeyForEncounter(entry) === key);
    if (keyedIndex >= 0) return keyedIndex;
    const fallbackIndex = findFallbackIndexForLegacyTurnKey(entries, key);
    if (fallbackIndex >= 0) return fallbackIndex;
  }
  const rawIndex = Number(encounter.currentIndex);
  if (!Number.isInteger(rawIndex)) return -1;
  if (direction > 0) {
    return Math.min(entries.length - 1, Math.max(-1, rawIndex - 1));
  }
  return Math.min(entries.length - 1, Math.max(0, rawIndex));
}

export function getCurrentTurnEntryForEncounter(encounter, normalizeZones) {
  const entries = buildTurnEntriesForEncounter(encounter, normalizeZones);
  if (!entries.length) {
    encounter.currentIndex = -1;
    encounter.currentTurnKey = '';
    return null;
  }
  const currentKey = String(encounter.currentTurnKey || '');
  let index = -1;
  if (currentKey) {
    index = entries.findIndex((entry) => getTurnEntryKeyForEncounter(entry) === currentKey);
    if (index < 0) {
      index = findFallbackIndexForLegacyTurnKey(entries, currentKey);
    }
  } else {
    const raw = Number(encounter.currentIndex);
    if (Number.isInteger(raw) && raw >= 0 && raw < entries.length) {
      index = raw;
    }
  }
  if (index < 0) {
    index = 0;
  }
  setCurrentTurnByIndexForEncounter(encounter, entries, index);
  return entries[index];
}

export function findParticipantInEncounter(encounter, id) {
  return encounter.participants.find((entry) => entry.id === id);
}

export function getCurrentParticipantForEncounter(encounter, normalizeZones) {
  const entry = getCurrentTurnEntryForEncounter(encounter, normalizeZones);
  if (!entry) return null;
  return findParticipantInEncounter(encounter, entry.participantId) || null;
}

export function findZoneInOwner(owner, zoneId) {
  if (!owner) return null;
  return (owner.zones || []).find((entry) => entry.id === zoneId) || null;
}
