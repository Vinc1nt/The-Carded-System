export function executeCustomActionForEncounter(body = {}, deps = {}) {
  const { resolveActor, markTurnActionTaken, pushLog, touchState, broadcastState } = deps;
  const participant = resolveActor(body.actorId);
  const text = body.text?.trim();
  if (!text) {
    return { error: 'Missing text' };
  }
  if (participant) {
    markTurnActionTaken(participant);
  }
  pushLog(text, participant?.id || null);
  touchState();
  broadcastState('custom_action');
  return { ok: true };
}

