export function executeAddZoneTargetActionForEncounter(body = {}, deps = {}) {
  const { resolveActor, findParticipant, findZone, pushLog, touchState, broadcastState } = deps;
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const zoneId = String(body.zoneId || '').trim();
  if (!zoneId) {
    return { error: 'zoneId is required' };
  }
  const targetId = String(body.targetId || '').trim();
  if (!targetId) {
    return { error: 'targetId is required' };
  }
  const target = findParticipant(targetId);
  if (!target) {
    return { error: 'Target not found' };
  }
  const zone = findZone(participant, zoneId);
  if (!zone) {
    return { error: 'Zone not found' };
  }
  const ids = new Set(Array.isArray(zone.targetIds) ? zone.targetIds : []);
  ids.add(target.id);
  zone.targetIds = Array.from(ids);
  pushLog(`${participant.name} adds ${target.name} to zone ${zone.name}.`, participant.id, {
    zoneId: zone.id,
    targetId: target.id
  });
  touchState();
  broadcastState('zone_target_added');
  return { participant, zone, target };
}

export function executeRemoveZoneTargetActionForEncounter(body = {}, deps = {}) {
  const { resolveActor, findParticipant, findZone, pushLog, touchState, broadcastState } = deps;
  const participant = resolveActor(body.participantId);
  if (!participant) {
    return { error: 'Participant required' };
  }
  const zoneId = String(body.zoneId || '').trim();
  if (!zoneId) {
    return { error: 'zoneId is required' };
  }
  const targetId = String(body.targetId || '').trim();
  if (!targetId) {
    return { error: 'targetId is required' };
  }
  const zone = findZone(participant, zoneId);
  if (!zone) {
    return { error: 'Zone not found' };
  }
  const before = Array.isArray(zone.targetIds) ? zone.targetIds.length : 0;
  zone.targetIds = (zone.targetIds || []).filter((id) => String(id) !== targetId);
  if (zone.targetIds.length === before) {
    return { error: 'Target was not assigned to this zone' };
  }
  const target = findParticipant(targetId);
  pushLog(
    `${participant.name} removes ${target?.name || 'a target'} from zone ${zone.name}.`,
    participant.id,
    { zoneId: zone.id, targetId }
  );
  touchState();
  broadcastState('zone_target_removed');
  return { participant, zone, targetId };
}

