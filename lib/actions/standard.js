export function executeStandardActionForEncounter(body = {}, deps = {}) {
  const {
    standardActions,
    defaultGuardRestore,
    resolveActor,
    applyRecoverAction,
    applyCleanseAction,
    setStatusStacks,
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
  const recoverTarget = {
    statusIndex: body.recoverStatusIndex,
    statusId: body.recoverStatusId,
    statusName: body.recoverStatusName,
    statusType: body.recoverStatusType
  };
  const cleanseTarget = {
    statusIndex: body.cleanseStatusIndex,
    statusId: body.cleanseStatusId,
    statusName: body.cleanseStatusName,
    statusType: body.cleanseStatusType
  };
  let apCost = action.apCost;
  let cleansePreview = null;
  if (action.id === 'cleanse') {
    cleansePreview = applyCleanseAction?.(participant, cleanseTarget, { preview: true }) || null;
    if (!cleansePreview) {
      return { error: 'No eligible control/debuff status to cleanse.' };
    }
  }
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
    const recovered = applyRecoverAction(participant, recoverTarget);
    if (recovered) {
      pushLog(
        `${participant.name} recovers and reduces ${recovered.name} by 1 stack.`,
        participant.id
      );
    } else {
      pushLog(`${participant.name} attempts to recover but has no eligible stacks.`, participant.id);
    }
  } else if (action.id === 'half_cover') {
    setStatusStacks?.(participant, 'half_cover', 1);
    pushLog(`${participant.name} ducks behind half cover until their next turn.`, participant.id);
  } else if (action.id === 'cleanse') {
    const cleansed = applyCleanseAction?.(participant, cleanseTarget) || cleansePreview;
    if (cleansed) {
      pushLog(
        `${participant.name} cleanses ${cleansed.name} completely (${apCost} AP).`,
        participant.id
      );
    } else {
      pushLog(`${participant.name} attempts to cleanse but has no eligible status.`, participant.id);
    }
  } else {
    pushLog(`${participant.name} ${action.logText}`, participant.id);
  }
  markTurnActionTaken(participant);
  touchState();
  broadcastState('standard_action');
  return { participant, action: { ...action, appliedApCost: apCost } };
}
