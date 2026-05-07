// Pointer interactions, route editing, selection deletion, flip, and clear actions.
function routeDefaultsForTool(tool) {
  const style = normalizeRouteStyle(state.routeStyle);
  const mode = normalizeRouteMode(tool === 'draw' ? 'draw' : controls.routeShape.value || state.routeMode);
  const end = END_CAP_VALUES.has(controls.endCap.value) ? controls.endCap.value : defaultEndCapForTool(tool);
  if (tool === 'block') return { type: 'block', end, mode, ...style };
  if (tool === 'pass') return { type: 'pass', end, mode, ...style };
  if (tool === 'motion') return { type: 'motion', end, mode: 'straight', ...style };
  return { type: 'route', end, mode, ...style };
}

function defaultEndCapForTool(tool) {
  if (tool === 'block') return 't';
  if (tool === 'motion' || tool === 'pass') return 'dot';
  return 'arrow';
}

function syncToolEndCapDefault(tool = state.tool) {
  if (!DRAW_TOOLS.includes(tool)) return;
  controls.endCap.value = defaultEndCapForTool(tool);
}

function pointDistance(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

function isPointInsidePlayerVisual(player, point) {
  const size = normalizePlayerSize(state.playerSize);
  const dx = Math.abs(point.x - player.x);
  const dy = Math.abs(point.y - player.y);
  const mark = playerMark(player);
  const padding = needsLargeTouchTargets() ? 4 : 2;
  if (mark === 'square' || (!mark && player.role === 'qb')) {
    return dx <= size + padding && dy <= size + padding;
  }
  if (mark === 'diamond') {
    return dx + dy <= size * 1.45 + padding;
  }
  if (mark === 'star') {
    return pointDistance([point.x, point.y], [player.x, player.y]) <= size * 1.26 + padding;
  }
  return pointDistance([point.x, point.y], [player.x, player.y]) <= size + padding;
}

function routeAnchorPlayerFromHit(hit, point) {
  if (hit?.kind !== 'player') return null;
  const player = state.players.find((item) => item.id === hit.id);
  if (!player) return null;
  return isPointInsidePlayerVisual(player, point) ? player : null;
}

function startRouteFromPoint(startPoint, event, player = null) {
  const defaults = routeDefaultsForTool(state.tool);
  const start = clampPoint(startPoint);
  const point = pointFromEvent(event);
  state.routeDraft = {
    ...defaults,
    input: 'drag',
    ...(player ? { playerId: player.id } : {}),
    undonePoints: [],
    points: [start, [point.x, point.y]]
  };
  state.drag = { kind: 'draw-route', start: [point.x, point.y], moved: false };
  setStatus('Drag or click points');
  drawTemp();
}

function startRoute(player, event) {
  startRouteFromPoint([player.x, player.y], event, player);
}

function startRouteAtPoint(point, event) {
  startRouteFromPoint([point.x, point.y], event);
}

function updateRouteDraft(event) {
  if (!state.routeDraft) return;
  const point = pointFromEvent(event);
  if (state.drag?.kind === 'draw-route' && pointDistance([point.x, point.y], state.drag.start) > 8) {
    state.drag.moved = true;
  }
  const points = state.routeDraft.points;
  points[points.length - 1] = [point.x, point.y];

  drawTemp();
}

function startFreehandRouteFromPoint(startPoint, player = null) {
  const defaults = routeDefaultsForTool('draw');
  const start = clampPoint(startPoint);
  state.routeDraft = {
    ...defaults,
    input: 'freehand',
    ...(player ? { playerId: player.id } : {}),
    undonePoints: [],
    points: [start]
  };
  state.drag = { kind: 'freehand-route', last: start };
  setStatus('Drawing');
  drawTemp();
}

function startFreehandRoute(player) {
  startFreehandRouteFromPoint([player.x, player.y], player);
}

function startFreehandRouteAtPoint(point) {
  startFreehandRouteFromPoint([point.x, point.y]);
}

function updateFreehandDraft(event) {
  if (!state.routeDraft) return;
  const point = pointFromEvent(event);
  const next = [point.x, point.y];
  const last = state.routeDraft.points[state.routeDraft.points.length - 1];
  if (!last || pointDistance(next, last) > 5) {
    state.routeDraft.points.push(next);
    state.drag.last = next;
    drawTemp();
  }
}

function startPolylineFromDraft(event) {
  if (!state.routeDraft) return;
  const point = pointFromEvent(event);
  state.routeDraft.input = 'poly';
  state.routeDraft.points = [state.routeDraft.points[0]];
  state.routeDraft.undonePoints = [];
  state.routeDraft.previewPoint = [point.x, point.y];
  state.drag = null;
  setStatus('Click points, Enter to finish');
  drawTemp();
  syncDockActionButtons();
}

function addPolylinePoint(point) {
  if (!state.routeDraft) return;
  const next = [point.x, point.y];
  const points = state.routeDraft.points;
  const previous = points[points.length - 1];
  if (!previous || pointDistance(next, previous) > 4) {
    points.push(next);
    state.routeDraft.undonePoints = [];
  }
  state.routeDraft.previewPoint = next;
  drawTemp();
  syncDockActionButtons();
}

function updatePolylinePreview(event) {
  if (!state.routeDraft) return;
  const point = pointFromEvent(event);
  state.routeDraft.previewPoint = [point.x, point.y];
  drawTemp();
}

function perpendicularDistance(point, start, end) {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSq = dx * dx + dy * dy;
  if (!lengthSq) return pointDistance(point, start);
  const t = clamp(((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSq, 0, 1);
  const projection = [start[0] + dx * t, start[1] + dy * t];
  return pointDistance(point, projection);
}

function simplifyPoints(points, tolerance = 5) {
  if (points.length <= 2) return points;
  let maxDistance = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i += 1) {
    const distance = perpendicularDistance(points[i], points[0], points[end]);
    if (distance > maxDistance) {
      maxDistance = distance;
      index = i;
    }
  }
  if (maxDistance <= tolerance) return [points[0], points[end]];
  return [
    ...simplifyPoints(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplifyPoints(points.slice(index), tolerance)
  ];
}

function finishRoute() {
  if (!state.routeDraft) return;
  let points = sanitizePoints(state.routeDraft.points);
  if (state.routeDraft.mode === 'draw') points = simplifyPoints(points, 6);
  if (state.routeDraft.mode === 'curve') points = simplifyPoints(points, 3);
  if (points.length >= 2 && routeLength(points) > 20) {
    const { input, previewPoint, undonePoints, ...draft } = state.routeDraft;
    const route = { id: makeId('route'), ...draft, points };
    state.routes.push(route);
    state.routeDraft = null;
    state.drag = null;
    state.tool = 'select';
    state.pendingPreset = null;
    syncToolButtons();
    syncPresetButtons();
    selectThing('route', route.id);
    saveLocal(false);
    setStatus('Line selected');
    return;
  }
  state.routeDraft = null;
  state.drag = null;
  setStatus('準備OK');
  render();
}

function targetFromEvent(event) {
  const node = event.target.closest('[data-id]');
  if (!node) return null;
  return {
    id: node.dataset.id,
    kind: node.dataset.kind,
    index: node.dataset.index === undefined ? null : Number(node.dataset.index)
  };
}

function moveLinkedRouteStarts(player) {
  state.routes.forEach((route) => {
    if (route.playerId === player.id && route.points[0]) route.points[0] = [player.x, player.y];
  });
}

function formationByValue(value) {
  return OFFENSE_FORMATIONS.find((formation) => formation.value === value) || null;
}

function defenseFormationByValue(value) {
  return DEFENSE_FORMATIONS.find((formation) => formation.value === value) || null;
}

function applyOffenseFormation(value) {
  const formation = formationByValue(value);
  if (!formation) return;

  state.routeDraft = null;
  state.drag = null;
  state.pendingPreset = null;
  state.players.forEach((player, index) => {
    const position = formation.positions[PLAYER_LABELS[index]];
    if (!position) return;
    [player.x, player.y] = clampPoint([fieldX(position[0]), fieldY(position[1])]);
    moveLinkedRouteStarts(player);
  });
  saveLocal(false);
  render();
  setStatus(formation.label);
}

function setQbDepth(depthYards, label = 'QB') {
  const center = state.players[0];
  const qb = state.players[1];
  if (!center || !qb) return;
  state.routeDraft = null;
  state.drag = null;
  state.pendingPreset = null;
  [qb.x, qb.y] = clampPoint([center.x, center.y + depthYards * FIELD_DIMENSIONS.yardScale]);
  moveLinkedRouteStarts(qb);
  saveLocal(false);
  render();
  setStatus(label);
}

function defensePointFromYards(position) {
  return clampPoint([fieldX(position[0]), fieldY(position[1])]);
}

function applyManDefenseFormation(formation) {
  const offenseByX = [...state.players].sort((a, b) => a.x - b.x);
  const manDefenders = formation.middleHelp ? state.defenders.slice(0, -1) : state.defenders;
  manDefenders.forEach((defender, index) => {
    const player = offenseByX[index];
    if (!player) return;
    const cluster = offenseByX.filter((item) => Math.abs(item.x - player.x) < 30);
    const clusterIndex = cluster.findIndex((item) => item.id === player.id);
    const offset = cluster.length > 1 ? (clusterIndex - (cluster.length - 1) / 2) * 34 : 0;
    [defender.x, defender.y] = clampPoint([player.x + offset, fieldY(formation.depth)]);
  });
  if (formation.middleHelp) {
    const helper = state.defenders[state.defenders.length - 1];
    [helper.x, helper.y] = defensePointFromYards(formation.middleHelp);
  }
}

function applyDefenseFormation(value) {
  const formation = defenseFormationByValue(value);
  if (!formation) return;

  state.routeDraft = null;
  state.drag = null;
  state.pendingPreset = null;
  state.defenseFormation = value;
  state.defenseVisible = true;
  if (formation.match === 'man') {
    applyManDefenseFormation(formation);
  } else {
    state.defenders.forEach((defender, index) => {
      const position = formation.positions[index];
      if (!position) return;
      [defender.x, defender.y] = defensePointFromYards(position);
    });
  }
  saveLocal(false);
  render();
  setStatus(formation.label);
}

function setDefenseVisible(visible, status = '') {
  state.defenseVisible = Boolean(visible);
  if (!state.defenseVisible && state.selectedType === 'defender') {
    state.selectedId = null;
    state.selectedType = null;
  }
  saveLocal(false);
  render();
  setStatus(status || (state.defenseVisible ? 'Defense ON' : 'Defense OFF'));
}

function toggleDefenseVisible() {
  setDefenseVisible(!state.defenseVisible);
}

function createAnnotation(point) {
  const text = prompt('Comment', 'Comment');
  if (!text) return;
  const id = makeId('text');
  state.annotations.push({ id, text, x: point.x, y: point.y });
  selectThing('annotation', id);
  saveLocal(false);
}

function syncPresetButtons() {
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.classList.toggle('is-pending', state.pendingPreset === button.dataset.preset);
  });
}

function routePresetDefinition(presetName, player) {
  if (!ROUTE_PRESETS.some((preset) => preset.value === presetName)) return null;
  const centerX = (FIELD_DIMENSIONS.left + FIELD_DIMENSIONS.right) / 2;
  const inside = player.x <= centerX ? 1 : -1;
  const outside = -inside;
  const presets = {
    go: {
      type: 'route',
      end: 'arrow',
      mode: 'straight',
      points: [[0, 0], [0, -8]]
    },
    out: {
      type: 'route',
      end: 'arrow',
      mode: 'straight',
      points: [[0, 0], [0, -4], [outside * 5, -4]]
    },
    in: {
      type: 'route',
      end: 'arrow',
      mode: 'straight',
      points: [[0, 0], [0, -5], [inside * 6, -5]]
    },
    slant: {
      type: 'route',
      end: 'arrow',
      mode: 'straight',
      points: [[0, 0], [inside * 5, -5]]
    },
    post: {
      type: 'route',
      end: 'arrow',
      mode: 'curve',
      points: [[0, 0], [0, -5], [inside * 5, -10]]
    },
    corner: {
      type: 'route',
      end: 'arrow',
      mode: 'curve',
      points: [[0, 0], [0, -5], [outside * 5, -10]]
    },
    curl: {
      type: 'route',
      end: 't',
      mode: 'curve',
      points: [[0, 0], [0, -7], [inside * 1.5, -6]]
    },
    motion: {
      type: 'motion',
      end: 'dot',
      mode: 'straight',
      points: [[0, 0], [outside * 7, 0]]
    },
    block: {
      type: 'block',
      end: 't',
      mode: 'straight',
      points: [[0, 0], [inside * 1.5, -2]]
    }
  };
  return presets[presetName] || null;
}

function createPresetRoute(player, presetName) {
  const preset = routePresetDefinition(presetName, player);
  if (!preset) return;
  const style = normalizeRouteStyle(state.routeStyle);
  const points = preset.points.map(([dx, dy]) => (
    clampPoint([player.x + dx * FIELD_DIMENSIONS.yardScale, player.y + dy * FIELD_DIMENSIONS.yardScale])
  ));
  const route = {
    id: makeId('route'),
    playerId: player.id,
    ...style,
    type: preset.type,
    end: preset.end,
    mode: preset.mode,
    points
  };
  state.routes.push(route);
  state.pendingPreset = null;
  selectThing('route', route.id);
  saveLocal(false);
  setStatus(`${presetName} route`);
}

function activateRoutePreset(presetName) {
  const player = state.selectedType === 'player'
    ? state.players.find((item) => item.id === state.selectedId)
    : null;
  if (player) {
    createPresetRoute(player, presetName);
    return;
  }
  state.pendingPreset = presetName;
  syncPresetButtons();
  setStatus('Select player');
}

function updateRouteMode(mode) {
  const cleanMode = normalizeRouteMode(mode);
  const route = activeRoute();
  if (route) {
    route.mode = cleanMode;
    saveLocal(false, { historyKey: `route-mode-${route.id}` });
    render();
    setStatus('Route Shape');
    return;
  }
  state.routeMode = cleanMode;
  saveLocal(false, { historyKey: 'route-mode-default' });
  syncRouteShapeControl();
  setStatus('Route Default');
}

function moveRoute(route, dx, dy) {
  route.points = route.points.map((point) => clampPoint([point[0] + dx, point[1] + dy]));
}

function focusModeCanvasWrap() {
  return document.body.classList.contains('is-focus-mode') ? document.querySelector('.canvas-wrap') : null;
}

function captureFieldPointer(event) {
  if (!field.setPointerCapture || field.hasPointerCapture?.(event.pointerId)) return;
  try {
    field.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture can fail if the browser has already cancelled the touch.
  }
}

function handlePointerDown(event) {
  const hit = targetFromEvent(event);
  const point = pointFromEvent(event);
  captureFieldPointer(event);

  if (focusModeCanvasWrap() && state.tool === 'select' && !hit) {
    const wrap = focusModeCanvasWrap();
    if (state.selectedId) {
      state.selectedId = null;
      state.selectedType = null;
      render();
    }
    state.drag = {
      kind: 'focus-pan',
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: wrap.scrollLeft,
      scrollTop: wrap.scrollTop
    };
    setStatus('Pan');
    return;
  }

  if (state.routeDraft?.input === 'poly') {
    addPolylinePoint(point);
    return;
  }

  if (hit?.kind === 'meta-book') {
    renameFolderById();
    return;
  }

  if (hit?.kind === 'meta-play') {
    renamePlayById();
    return;
  }

  if (hit?.kind === 'meta-notes') {
    editPlayNotesPrompt();
    return;
  }

  if (hit?.kind === 'route-point') {
    selectThing('route', hit.id);
    state.drag = { kind: 'route-point', id: hit.id, index: hit.index };
    return;
  }

  if (hit?.kind === 'route-insert') {
    const route = state.routes.find((item) => item.id === hit.id);
    if (!route) return;
    route.points.splice(hit.index + 1, 0, [point.x, point.y]);
    selectThing('route', hit.id);
    state.drag = { kind: 'route-point', id: hit.id, index: hit.index + 1 };
    return;
  }

  if (state.tool === 'text' && !hit) {
    createAnnotation(point);
    return;
  }

  if (state.pendingPreset) {
    const player = routeAnchorPlayerFromHit(hit, point);
    if (player) createPresetRoute(player, state.pendingPreset);
    if (player) return;
  }

  if (DRAW_TOOLS.includes(state.tool)) {
    const player = routeAnchorPlayerFromHit(hit, point);
    if (player && state.tool === 'draw') startFreehandRoute(player);
    else if (player) startRoute(player, event);
    else if (state.tool === 'draw') startFreehandRouteAtPoint(point);
    else startRouteAtPoint(point, event);
    return;
  }

  if (hit) {
    const selectedKind = hit.kind === 'route' ? 'route' : hit.kind;
    selectThing(selectedKind, hit.id);

    if (hit.kind === 'route') {
      state.drag = { kind: 'route-move', id: hit.id, last: point };
      return;
    }

    const collection = hit.kind === 'player' ? state.players : hit.kind === 'defender' ? state.defenders : state.annotations;
    const item = collection.find((entry) => entry.id === hit.id);
    if (item) {
      state.drag = { kind: hit.kind, id: hit.id, dx: item.x - point.x, dy: item.y - point.y };
    }
    return;
  }

  state.selectedId = null;
  state.selectedType = null;
  render();
}

function handlePointerMove(event) {
  if (state.routeDraft?.input === 'poly' && !state.drag) {
    updatePolylinePreview(event);
    return;
  }

  if (!state.drag) return;

  if (state.drag.kind === 'draw-route') {
    updateRouteDraft(event);
    return;
  }

  if (state.drag.kind === 'freehand-route') {
    updateFreehandDraft(event);
    return;
  }

  const point = pointFromEvent(event);

  if (state.drag.kind === 'focus-pan') {
    const wrap = focusModeCanvasWrap();
    if (!wrap) return;
    wrap.scrollLeft = state.drag.scrollLeft - (event.clientX - state.drag.startX);
    wrap.scrollTop = state.drag.scrollTop - (event.clientY - state.drag.startY);
    return;
  }

  if (state.drag.kind === 'route-point') {
    const route = state.routes.find((item) => item.id === state.drag.id);
    if (!route) return;
    route.points[state.drag.index] = [point.x, point.y];
    render();
    return;
  }

  if (state.drag.kind === 'route-move') {
    const route = state.routes.find((item) => item.id === state.drag.id);
    if (!route) return;
    const dx = point.x - state.drag.last.x;
    const dy = point.y - state.drag.last.y;
    moveRoute(route, dx, dy);
    state.drag.last = point;
    render();
    return;
  }

  const collection = state.drag.kind === 'player' ? state.players : state.drag.kind === 'defender' ? state.defenders : state.annotations;
  const item = collection.find((entry) => entry.id === state.drag.id);
  if (!item) return;
  item.x = point.x + state.drag.dx;
  item.y = point.y + state.drag.dy;
  if (state.drag.kind === 'player') moveLinkedRouteStarts(item);
  render();
}

function handlePointerUp(event) {
  if (state.drag?.kind === 'focus-pan') {
    state.drag = null;
    setStatus('準備OK');
    return;
  }

  if (state.drag?.kind === 'draw-route') {
    if (state.drag.moved) finishRoute();
    else startPolylineFromDraft(event);
    return;
  }

  if (state.drag?.kind === 'freehand-route') {
    finishRoute();
    return;
  }

  if (state.drag) saveLocal(false);
  state.drag = null;
}

function cancelPointerInteraction() {
  const shouldSave = Boolean(state.drag && !state.routeDraft && state.drag.kind !== 'focus-pan');
  const hadDraft = Boolean(state.routeDraft);
  state.drag = null;
  state.routeDraft = null;
  if (shouldSave) saveLocal(false);
  if (hadDraft) setStatus('Cancelled');
  render();
}

function editSelectedAnnotation() {
  if (state.selectedType !== 'annotation') return;
  const note = state.annotations.find((item) => item.id === state.selectedId);
  if (!note) return;
  const text = prompt('コメント', note.text);
  if (!text) return;
  note.text = text;
  saveLocal(false);
  render();
}

function editPlayNotesPrompt() {
  const text = prompt('Notes', state.notes || '');
  if (text === null) return;
  state.notes = text;
  controls.playNotes.value = text;
  saveLocal(false, { historyKey: 'play-notes' });
  render();
}

function deleteSelectedItem() {
  if (!state.selectedId) return;
  if (state.selectedType === 'route') state.routes = state.routes.filter((item) => item.id !== state.selectedId);
  if (state.selectedType === 'annotation') state.annotations = state.annotations.filter((item) => item.id !== state.selectedId);
  if (state.selectedType === 'player' || state.selectedType === 'defender') {
    setStatus('5v5固定');
    return;
  }
  state.selectedId = null;
  state.selectedType = null;
  saveLocal(false);
  render();
}

function flipPlay() {
  const flipX = (x) => 1000 - x;
  state.players.forEach((item) => { item.x = flipX(item.x); });
  state.defenders.forEach((item) => { item.x = flipX(item.x); });
  state.annotations.forEach((item) => { item.x = flipX(item.x); });
  state.routes.forEach((route) => {
    route.points = route.points.map(([x, y]) => [flipX(x), y]);
  });
  saveLocal(false);
  render();
}

function clearRoutes() {
  if (!state.routes.length) {
    setStatus('線なし');
    return;
  }
  state.routes = [];
  state.routeDraft = null;
  if (state.selectedType === 'route') {
    state.selectedId = null;
    state.selectedType = null;
  }
  saveLocal(false);
  setStatus('線を全消去');
  render();
}

function resetPlayDiagram() {
  if (!state.activePlayId) {
    setStatus('No Play');
    return;
  }

  const base = normalizePlay({
    ...cloneData(defaultPlay),
    id: state.activePlayId,
    name: state.playName,
    notes: state.notes
  });
  state.routeDraft = null;
  state.drag = null;
  state.pendingPreset = null;
  state.tool = 'select';
  state.selectedId = null;
  state.selectedType = null;
  state.playerMarks = cloneData(base.playerMarks);
  state.playerSize = base.playerSize;
  state.endCapSize = base.endCapSize;
  state.defenseVisible = base.defenseVisible;
  state.sourceImage = base.sourceImage;
  state.routeMode = base.routeMode;
  state.routeStyle = cloneData(base.routeStyle);
  state.players = base.players.map((player, index) => ({
    ...player,
    id: state.players[index]?.id || player.id
  }));
  state.defenders = base.defenders.map((defender, index) => ({
    ...defender,
    id: state.defenders[index]?.id || defender.id
  }));
  state.routes = [];
  state.annotations = [];
  syncToolButtons();
  syncPresetButtons();
  saveLocal(false);
  setStatus('Reset Play');
  render();
}

function updateLineStyle(partialStyle) {
  const route = activeRoute();
  if (route) {
    Object.assign(route, normalizeRouteStyle({ ...route, ...partialStyle }));
    saveLocal(false, { historyKey: `line-style-${route.id}` });
    drawRoutes();
    syncLineStyleControls();
    syncMobileLineControls();
    setStatus('Line Style');
    return;
  }

  state.routeStyle = normalizeRouteStyle({ ...state.routeStyle, ...partialStyle });
  saveLocal(false, { historyKey: 'line-style-default' });
  drawTemp();
  syncLineStyleControls();
  syncMobileLineControls();
  setStatus('Line Default');
}
