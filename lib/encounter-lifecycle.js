export function startEncounterLifecycle(state, startingRound = 1, deps = {}) {
  const {
    resetSetCombatState,
    ensureCurrentIndex,
    getCurrentParticipant,
    resetTurn,
    pushLog,
    touchState,
    broadcastState
  } = deps;
  const encounter = state?.encounter;
  if (!encounter) return;
  encounter.round = Number(startingRound) || 1;
  encounter.started = true;
  encounter.participants.forEach((participant) => {
    resetSetCombatState(participant);
    participant.turnActionCount = 0;
  });
  encounter.currentIndex = -1;
  encounter.currentTurnKey = '';
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

export function endEncounterLifecycle(state, deps = {}) {
  const { resetSetCombatState, pushLog, touchState, broadcastState } = deps;
  const encounter = state?.encounter;
  if (!encounter) return;
  encounter.started = false;
  encounter.round = 1;
  encounter.currentIndex = -1;
  encounter.currentTurnKey = '';
  encounter.participants.forEach((participant) => {
    resetSetCombatState(participant);
    participant.turnActionCount = 0;
    participant.guardUsedThisTurn = false;
  });
  pushLog('Encounter ended.');
  touchState();
  broadcastState('encounter_ended');
}

