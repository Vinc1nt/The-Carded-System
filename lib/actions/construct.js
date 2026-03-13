export function executeRemoveConstructActionForEncounter(body = {}, deps = {}) {
  const { resolveActor, pushLog, touchState, broadcastState } = deps;
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const constructId = String(body.constructId || '').trim();
  if (!constructId) {
    return { error: 'constructId is required' };
  }
  const list = Array.isArray(participant.constructs) ? participant.constructs : [];
  const idx = list.findIndex((entry) => String(entry.id || '') === constructId);
  if (idx < 0) {
    return { error: 'Construct not found' };
  }
  const [removed] = list.splice(idx, 1);
  participant.constructs = list;
  pushLog(`${participant.name} removes construct ${removed.name}.`, participant.id);
  touchState();
  broadcastState('construct_removed');
  return { participant, removed };
}

export function executeRetargetConstructActionForEncounter(body = {}, deps = {}) {
  const { resolveActor, findParticipant, pushLog, touchState, broadcastState } = deps;
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const constructId = String(body.constructId || '').trim();
  if (!constructId) {
    return { error: 'constructId is required' };
  }
  const targetId = String(body.targetId || '').trim();
  if (!targetId) {
    return { error: 'targetId is required' };
  }
  const target = findParticipant(targetId);
  if (!target) {
    return { error: 'Target not found' };
  }
  const list = Array.isArray(participant.constructs) ? participant.constructs : [];
  const construct = list.find((entry) => String(entry.id || '') === constructId);
  if (!construct) {
    return { error: 'Construct not found' };
  }
  construct.targetId = target.id;
  pushLog(`${participant.name} retargets ${construct.name} to ${target.name}.`, participant.id);
  touchState();
  broadcastState('construct_retargeted');
  return { participant, construct };
}

export function executeMoveConstructActionForEncounter(body = {}, deps = {}) {
  const { resolveActor, normalizeConstructs, pushLog, touchState, broadcastState } = deps;
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const constructId = String(body.constructId || '').trim();
  if (!constructId) {
    return { error: 'constructId is required' };
  }
  const list = normalizeConstructs(participant.constructs, participant.id);
  const construct = list.find((entry) => String(entry.id || '') === constructId);
  if (!construct) {
    return { error: 'Construct not found' };
  }
  const apCost = 1;
  if (Number(construct.apCurrent || 0) < apCost) {
    return { error: `${construct.name} does not have enough AP` };
  }
  const baseMove = Math.max(5, Math.round(Number(construct.moveFt || 10)));
  const difficultTerrain = Boolean(body.difficultTerrain);
  const distance = difficultTerrain ? Math.max(5, Math.floor(baseMove / 2)) : baseMove;
  construct.apCurrent = Math.max(0, Number(construct.apCurrent || 0) - apCost);
  participant.constructs = list;
  pushLog(
    `${participant.name} commands ${construct.name} to move ${distance} ft (${construct.apCurrent}/${construct.apMax} AP left).`,
    participant.id
  );
  touchState();
  broadcastState('construct_moved');
  return { participant, construct, distance, apCost };
}
