export function executeStandardActionForEncounter(body = {}, deps = {}) {
  const {
    standardActions,
    defaultGuardRestore,
    resolveActor,
    applyRecoverAction,
    markTurnActionTaken,
    pushLog,
    touchState,
    broadcastState
  } = deps;
  const action = standardActions?.[body.actionId];
  if (!action) {
    return { error: 'Unknown action' };
  }
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  if (action.id === 'guard' && participant.guardUsedThisTurn) {
    return { error: 'Guard already used this turn' };
  }
  const apCost = action.apCost;
  if (participant.apCurrent < apCost) {
    return { error: 'Not enough AP' };
  }
  participant.apCurrent = Math.max(0, participant.apCurrent - apCost);
  if (action.id === 'guard') {
    const before = participant.shield;
    const baseGuardRestore = participant.guardRestore ?? defaultGuardRestore;
    const temporaryGuardBonus =
      Number(participant.guardActionBonusTurns || 0) > 0
        ? Math.max(0, Number(participant.guardActionBonus || 0))
        : 0;
    const restoreAmount = Math.max(0, baseGuardRestore + temporaryGuardBonus);
    participant.shield = Math.min(participant.maxShield, participant.shield + restoreAmount);
    participant.guardUsedThisTurn = true;
    pushLog(
      `${participant.name} guards (${before} → ${participant.shield} Shield, +${restoreAmount}).`,
      participant.id
    );
  } else if (action.id === 'recover') {
    const recovered = applyRecoverAction(participant, {
      statusIndex: body.recoverStatusIndex,
      statusId: body.recoverStatusId,
      statusName: body.recoverStatusName,
      statusType: body.recoverStatusType
    });
    if (recovered) {
      pushLog(
        `${participant.name} recovers and reduces ${recovered.name} by 1 stack.`,
        participant.id
      );
    } else {
      pushLog(`${participant.name} attempts to recover but has no eligible stacks.`, participant.id);
    }
  } else {
    pushLog(`${participant.name} ${action.logText}`, participant.id);
  }
  markTurnActionTaken(participant);
  touchState();
  broadcastState('standard_action');
  return { participant, action: { ...action, appliedApCost: apCost } };
}
