// Data helpers, normalization, active-play snapshots, and initial state.
function makeId(prefix = 'id') {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
  return el;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clampPoint(point) {
  return [clamp(point[0], 55, 945), clamp(point[1], 55, 665)];
}

function setStatus(text) {
  controls.statusText.textContent = text;
}

function syncPlayerSizeControl() {
  controls.playerSize.value = state.playerSize;
  controls.playerSizeValue.value = state.playerSize;
  controls.playerSizeValue.textContent = state.playerSize;
}

function syncEndCapSizeControl() {
  controls.endCapSize.value = state.endCapSize;
  controls.endCapSizeValue.value = state.endCapSize.toFixed(1);
  controls.endCapSizeValue.textContent = state.endCapSize.toFixed(1);
}

function activeRoute() {
  if (state.selectedType !== 'route') return null;
  return state.routes.find((route) => route.id === state.selectedId) || null;
}

function activeRouteStyle() {
  return normalizeRouteStyle(activeRoute() || state.routeStyle);
}

function syncLineStyleControls() {
  const style = activeRouteStyle();
  controls.lineColor.value = style.color;
  controls.lineWidth.value = style.width;
  controls.lineWidthValue.value = style.width;
  controls.lineWidthValue.textContent = style.width;
  controls.lineOpacity.value = style.opacity;
  controls.lineOpacityValue.value = style.opacity.toFixed(2);
  controls.lineOpacityValue.textContent = style.opacity.toFixed(2);
}

function syncRouteShapeControl() {
  const route = activeRoute();
  controls.routeShape.value = normalizeRouteMode(route?.mode || state.routeMode);
}

function syncPlaysetFileBadge() {
  const canWriteFile = Boolean(state.fileHandle);
  const hasFileSystemAccess = 'showSaveFilePicker' in window;
  const fileStatusLabel = canWriteFile ? 'Save Location' : 'File Name';
  const mobileFileName = state.fileName || 'Untitled Book';
  controls.playsetFileName.textContent = state.fileName
    ? `${fileStatusLabel}: ${state.fileName}`
    : 'Save Location: Not Selected';
  controls.playsetFileName.title = state.fileName ? state.fileName : 'Save Location Not Selected';
  if (controls.mobilePlaysetFileName) {
    if (controls.mobilePlaysetFileNameText) {
      controls.mobilePlaysetFileNameText.textContent = mobileFileName;
    } else {
      controls.mobilePlaysetFileName.textContent = mobileFileName;
    }
    controls.mobilePlaysetFileName.title = state.fileName
      ? `${fileStatusLabel}: ${state.fileName}`
      : 'Set book file name';
    controls.mobilePlaysetFileName.setAttribute('aria-label', state.fileName
      ? `Rename book file: ${state.fileName}`
      : 'Set book file name');
    controls.mobilePlaysetFileName.classList.toggle('is-empty', !state.fileName);
  }
  controls.savePlaysetFileBtn.disabled = !canWriteFile;
  controls.savePlaysetFileBtn.title = canWriteFile
    ? 'Overwrite the open JSON file'
    : 'Direct overwrite is unavailable in this browser. Use Save As.';

  if (canWriteFile) {
    controls.playsetFileHint.textContent = 'Overwrite Save will write directly to this JSON file.';
  } else if (hasFileSystemAccess) {
    controls.playsetFileHint.textContent = 'To save with overwrite, open a JSON file or choose a save location with "Save As".';
  } else {
    controls.playsetFileHint.textContent = 'This browser cannot overwrite files directly. Use "Save As" to download a JSON file.';
  }
  if (typeof syncBookOverviewView === 'function') syncBookOverviewView();
}

function syncPlaybookState() {
  updateActivePlay();
  state.playbook.formatVersion = PLAYBOOK_FORMAT_VERSION;
  state.playbook.activeFolderId = state.activeFolderId;
  state.playbook.activePlayId = state.activePlayId;
}

function selectionLabel() {
  if (!state.selectedId) return 'Not Selected';
  if (state.selectedType === 'player') {
    const player = state.players.find((item) => item.id === state.selectedId);
    const marker = markLabel(playerMark(player));
    const role = playerRoleLabel(player);
    return player ? `Offense ${player.label} ${role}${marker ? ` / ${marker}` : ''}` : 'Offense';
  }
  if (state.selectedType === 'defender') return 'Defense X';
  if (state.selectedType === 'route') {
    const route = state.routes.find((item) => item.id === state.selectedId);
    const labels = { route: 'Route', motion: 'Motion', pass: 'Pass', block: 'Block' };
    return labels[route?.type] || 'Line';
  }
  if (state.selectedType === 'annotation') return 'Comment';
  return 'Selected';
}

function normalizePlayerLabel(value, fallback = '1') {
  const clean = String(value ?? '').trim();
  const fallbackLabel = PLAYER_LABELS.includes(String(fallback)) ? String(fallback) : '1';
  return PLAYER_LABELS.includes(clean) ? clean : fallbackLabel;
}

function normalizePlayerRole(role, slotIndex = 0) {
  const fallback = PLAYER_SLOT_ROLES[slotIndex] || 'skill';
  const info = PLAYER_ROLES[String(role || fallback)] || PLAYER_ROLES[fallback] || PLAYER_ROLES.skill;
  return info.value;
}

function playerRoleInfo(playerOrRole) {
  const role = typeof playerOrRole === 'object' ? playerOrRole?.role : playerOrRole;
  return PLAYER_ROLES[String(role || '')] || PLAYER_ROLES.skill;
}

function playerRoleLabel(playerOrRole) {
  return playerRoleInfo(playerOrRole).label;
}

function pointFromEvent(event) {
  const pt = field.createSVGPoint();
  pt.x = event.clientX;
  pt.y = event.clientY;
  const transformed = pt.matrixTransform(field.getScreenCTM().inverse());
  const [x, y] = clampPoint([transformed.x, transformed.y]);
  return { x, y };
}

function activeFolder() {
  return state.playbook.folders.find((folder) => folder.id === state.activeFolderId);
}

function activePlay() {
  const folder = activeFolder();
  return folder?.plays.find((play) => play.id === state.activePlayId);
}

function playDisplayNumber(playId) {
  let number = 1;
  for (const folder of state.playbook.folders) {
    for (const play of folder.plays) {
      if (play.id === playId) return number;
      number += 1;
    }
  }
  return 0;
}

function playDisplayName(playOrName, playId = '') {
  const play = typeof playOrName === 'object' ? playOrName : null;
  const id = play?.id || playId;
  const name = (play?.name || playOrName || 'Untitled').toString();
  const number = playDisplayNumber(id);
  return number ? `(${number}) ${name}` : name;
}

function activePlayDisplayName() {
  const play = activePlay();
  return play ? playDisplayName(play) : playDisplayName(state.playName || 'New Play', state.activePlayId);
}

function currentPlaySnapshot() {
  return {
    id: state.activePlayId || makeId('play'),
    name: state.playName || 'Untitled',
    notes: state.notes || '',
    playerMarks: normalizePlayerMarks(state.playerMarks),
    playerSize: state.playerSize,
    endCapSize: state.endCapSize,
    defenseVisible: state.defenseVisible,
    defenseFormation: state.defenseFormation,
    sourceImage: state.sourceImage || '',
    routeMode: normalizeRouteMode(state.routeMode),
    routeStyle: normalizeRouteStyle(state.routeStyle),
    updatedAt: new Date().toISOString(),
    players: cloneData(state.players),
    defenders: cloneData(state.defenders),
    routes: cloneData(state.routes),
    annotations: cloneData(state.annotations)
  };
}

function normalizePlay(play) {
  const fallback = cloneData(defaultPlay);
  const sourcePlayers = play.players || fallback.players;
  const players = normalizePlayers(sourcePlayers);
  const playerMarks = normalizePlayerMarksForPlayers(play.playerMarks || fallback.playerMarks, players);
  const sourceImage = normalizeSourceImage(play.sourceImage || fallback.sourceImage);
  return {
    id: play.id || makeId('play'),
    name: play.name || fallback.name,
    notes: play.notes || '',
    playerMarks,
    playerSize: normalizePlayerSize(play.playerSize ?? fallback.playerSize),
    endCapSize: normalizeEndCapSize(play.endCapSize ?? fallback.endCapSize),
    defenseVisible: play.defenseVisible === false ? false : fallback.defenseVisible,
    defenseFormation: play.defenseFormation || fallback.defenseFormation,
    sourceImage,
    routeMode: normalizeRouteMode(play.routeMode || fallback.routeMode),
    routeStyle: normalizeRouteStyle(play.routeStyle || fallback.routeStyle),
    updatedAt: play.updatedAt || '',
    players,
    defenders: normalizeDefenders(play.defenders || fallback.defenders),
    routes: normalizeRoutes(play.routes || fallback.routes),
    annotations: cloneData(play.annotations || [])
  };
}

function normalizePlayerSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value)) return PLAYER_SIZE.default;
  return clamp(value, PLAYER_SIZE.min, PLAYER_SIZE.max);
}

function normalizeEndCapSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value)) return END_CAP_SIZE.default;
  return clamp(value, END_CAP_SIZE.min, END_CAP_SIZE.max);
}

function normalizeRouteEnd(end) {
  const value = String(end || 'arrow');
  return END_CAP_VALUES.has(value) ? value : 'arrow';
}

function normalizeSourceImage(sourceImage) {
  const value = String(sourceImage || '');
  return value.startsWith('data:image/') ? value : '';
}

function normalizeRouteColor(color) {
  const value = String(color || '').trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : ROUTE_STYLE.color;
}

function normalizeRouteWidth(width) {
  const value = Number(width);
  if (!Number.isFinite(value)) return ROUTE_STYLE.width;
  return clamp(Math.round(value), ROUTE_STYLE.minWidth, ROUTE_STYLE.maxWidth);
}

function normalizeRouteOpacity(opacity) {
  const value = Number(opacity);
  if (!Number.isFinite(value)) return ROUTE_STYLE.opacity;
  return clamp(value, ROUTE_STYLE.minOpacity, ROUTE_STYLE.maxOpacity);
}

function normalizeRouteMode(mode) {
  const value = String(mode || 'straight');
  return ROUTE_MODES.has(value) ? value : 'straight';
}

function normalizeRouteStyle(style = {}) {
  return {
    color: normalizeRouteColor(style.color),
    width: normalizeRouteWidth(style.width),
    opacity: normalizeRouteOpacity(style.opacity)
  };
}

function normalizePlayerMarks(marks) {
  if (!marks || typeof marks !== 'object' || Array.isArray(marks)) return {};
  return Object.entries(marks).reduce((result, [label, mark]) => {
    const cleanLabel = String(label || '').trim();
    const cleanMark = String(mark || '');
    if (cleanLabel && cleanMark && PLAYER_MARK_VALUES.has(cleanMark)) {
      result[cleanLabel] = cleanMark;
    }
    return result;
  }, {});
}

function playerMarkKey(player) {
  return player?.id || player?.label || '';
}

function playerSlotIndex(player) {
  return state.players.findIndex((item) => item.id === player?.id);
}

function canSwapPlayerNumber(player) {
  return playerSlotIndex(player) >= 2;
}

function normalizePlayerMarksForPlayers(marks, players) {
  const normalized = normalizePlayerMarks(marks);
  return players.reduce((result, player, index) => {
    const mark = normalized[player.id] || normalized[player.label] || normalized[PLAYER_LABELS[index]];
    if (mark) result[playerMarkKey(player)] = mark;
    return result;
  }, {});
}

function setPlayerMark(player, mark) {
  const key = playerMarkKey(player);
  if (!key) return;
  if (PLAYER_MARK_VALUES.has(mark)) state.playerMarks[key] = mark;
  else delete state.playerMarks[key];
}

function normalizePlayers(players) {
  const source = cloneData(players || []);
  return defaultPlay.players.map((base, index) => {
    const incoming = source[index] || {};
    const label = normalizePlayerLabel(incoming.label ?? base.label, PLAYER_LABELS[index] || base.label);
    const role = normalizePlayerRole(incoming.role || base.role, index);
    return {
      id: incoming.id || base.id,
      label,
      x: Number.isFinite(Number(incoming.x)) ? Number(incoming.x) : base.x,
      y: Number.isFinite(Number(incoming.y)) ? Number(incoming.y) : base.y,
      role
    };
  });
}

function normalizeDefenders(defenders) {
  const source = cloneData(defenders || []);
  return defaultPlay.defenders.map((base, index) => ({
    id: source[index]?.id || base.id,
    label: 'X',
    x: Number.isFinite(Number(source[index]?.x)) ? Number(source[index].x) : base.x,
    y: Number.isFinite(Number(source[index]?.y)) ? Number(source[index].y) : base.y
  }));
}

function normalizeRoutes(routes) {
  return cloneData(routes || []).map((route) => {
    const style = normalizeRouteStyle(route);
    return {
      ...route,
      ...style,
      type: route.type || 'route',
      end: normalizeRouteEnd(route.end),
      mode: normalizeRouteMode(route.mode),
      points: Array.isArray(route.points) ? route.points : []
    };
  });
}

function normalizePlaybook(playbook) {
  if (!playbook?.folders?.length) {
    return {
      formatVersion: PLAYBOOK_FORMAT_VERSION,
      activeFolderId: 'folder-default',
      activePlayId: 'play-default',
      folders: [
        {
          id: 'folder-default',
          name: 'My Playbook',
          plays: [normalizePlay(cloneData(defaultPlay))]
        }
      ]
    };
  }

  const folders = playbook.folders.map((folder, index) => ({
      id: folder.id || makeId('folder'),
      name: folder.name || `Folder ${index + 1}`,
      plays: Array.isArray(folder.plays) ? folder.plays.map(normalizePlay) : []
    }));
  let activeFolderId = folders.some((folder) => folder.id === playbook.activeFolderId)
    ? playbook.activeFolderId
    : folders[0].id;
  let folder = folders.find((item) => item.id === activeFolderId);
  let activePlayId = folder?.plays.some((play) => play.id === playbook.activePlayId)
    ? playbook.activePlayId
    : folder?.plays[0]?.id || null;

  if (!activePlayId) {
    const firstPlayableFolder = folders.find((item) => item.plays.length);
    if (firstPlayableFolder) {
      activeFolderId = firstPlayableFolder.id;
      folder = firstPlayableFolder;
      activePlayId = folder.plays[0].id;
    }
  }

  return {
    formatVersion: PLAYBOOK_FORMAT_VERSION,
    activeFolderId,
    activePlayId,
    folders
  };
}

function updateActivePlay() {
  if (!state.activePlayId) return;
  const folder = activeFolder();
  if (!folder) return;
  const play = currentPlaySnapshot();
  const index = folder.plays.findIndex((item) => item.id === play.id);
  if (index === -1) folder.plays.push(play);
  else folder.plays[index] = play;
}

function historySnapshot() {
  syncPlaybookState();
  return {
    playbook: cloneData(state.playbook),
    openFolderIds: Array.from(state.openFolderIds)
  };
}

function historyFingerprint(snapshot) {
  return JSON.stringify(snapshot, (key, value) => (key === 'updatedAt' ? undefined : value));
}

function resetHistory() {
  const snapshot = historySnapshot();
  state.undoStack = [snapshot];
  state.redoStack = [];
  state.historyFingerprint = historyFingerprint(snapshot);
  state.historyLastKey = '';
  state.historyLastAt = 0;
  if (typeof syncDockActionButtons === 'function') syncDockActionButtons();
}

function recordHistory(options = {}) {
  if (state.isRestoringHistory) return;
  const snapshot = historySnapshot();
  const fingerprint = historyFingerprint(snapshot);
  if (fingerprint === state.historyFingerprint) return;

  const now = Date.now();
  const historyKey = options.historyKey || '';
  const canCoalesce = historyKey
    && state.historyLastKey === historyKey
    && now - state.historyLastAt <= HISTORY_COALESCE_MS
    && state.undoStack.length > 1;

  if (canCoalesce) {
    state.undoStack[state.undoStack.length - 1] = snapshot;
  } else {
    state.undoStack.push(snapshot);
    if (state.undoStack.length > HISTORY_LIMIT) state.undoStack.shift();
  }

  state.redoStack = [];
  state.historyFingerprint = fingerprint;
  state.historyLastKey = historyKey;
  state.historyLastAt = now;
}

function restoreHistorySnapshot(snapshot) {
  state.isRestoringHistory = true;
  state.playbook = normalizePlaybook(cloneData(snapshot.playbook));
  state.activeFolderId = state.playbook.activeFolderId;
  state.activePlayId = state.playbook.activePlayId;

  const folderIds = new Set(state.playbook.folders.map((folder) => folder.id));
  const openFolderIds = (snapshot.openFolderIds || []).filter((folderId) => folderIds.has(folderId));
  state.openFolderIds = new Set(openFolderIds);
  if (state.activeFolderId) state.openFolderIds.add(state.activeFolderId);

  const play = activePlay();
  if (play) applyPlay(play);
  else clearActivePlayView(activeFolder()?.name ? `${activeFolder().name} Empty` : 'No Play Selected');
  state.isRestoringHistory = false;
}

function undoHistory() {
  const current = historySnapshot();
  if (historyFingerprint(current) !== state.historyFingerprint) {
    state.undoStack.push(current);
    if (state.undoStack.length > HISTORY_LIMIT) state.undoStack.shift();
  }

  if (state.undoStack.length <= 1) {
    setStatus('Undoなし');
    return false;
  }

  const snapshot = state.undoStack.pop();
  state.redoStack.push(snapshot);
  const previous = state.undoStack[state.undoStack.length - 1];
  restoreHistorySnapshot(previous);
  state.historyFingerprint = historyFingerprint(previous);
  state.historyLastKey = '';
  state.historyLastAt = 0;
  syncDockActionButtons();
  setStatus('Undo');
  return true;
}

function redoHistory() {
  if (!state.redoStack.length) {
    setStatus('Redoなし');
    return false;
  }

  const snapshot = state.redoStack.pop();
  state.undoStack.push(snapshot);
  if (state.undoStack.length > HISTORY_LIMIT) state.undoStack.shift();
  restoreHistorySnapshot(snapshot);
  state.historyFingerprint = historyFingerprint(snapshot);
  state.historyLastKey = '';
  state.historyLastAt = 0;
  syncDockActionButtons();
  setStatus('Redo');
  return true;
}

function canUndoHistory() {
  if (!state.undoStack.length) return false;
  return state.undoStack.length > 1 || historyFingerprint(historySnapshot()) !== state.historyFingerprint;
}

function canRedoHistory() {
  return state.redoStack.length > 0;
}

function saveLocal(showStatus = false, options = {}) {
  syncPlaybookState();
  if (options.recordHistory !== false) recordHistory(options);
  if (showStatus) setStatus('Updated');
  renderPlaybookSelectors();
  syncPlaysetFileBadge();
  if (typeof syncDockActionButtons === 'function') syncDockActionButtons();
}

function applyPlay(play) {
  const normalized = normalizePlay(play);
  state.activePlayId = normalized.id;
  state.playName = normalized.name;
  state.notes = normalized.notes;
  state.playerMarks = cloneData(normalized.playerMarks || {});
  state.playerSize = normalizePlayerSize(normalized.playerSize);
  state.endCapSize = normalizeEndCapSize(normalized.endCapSize);
  state.defenseVisible = Boolean(normalized.defenseVisible);
  state.defenseFormation = normalized.defenseFormation;
  state.sourceImage = normalized.sourceImage || '';
  state.routeMode = normalizeRouteMode(normalized.routeMode);
  state.routeStyle = normalizeRouteStyle(normalized.routeStyle);
  state.players = cloneData(normalized.players);
  state.defenders = cloneData(normalized.defenders);
  state.routes = cloneData(normalized.routes);
  state.annotations = cloneData(normalized.annotations);
  state.selectedId = null;
  state.selectedType = null;
  state.drag = null;
  state.routeDraft = null;

  controls.playNotes.value = state.notes;
  syncPlayerSizeControl();
  syncEndCapSizeControl();
  syncLineStyleControls();
  controls.playNotes.disabled = false;
  render();
}

function clearActivePlayView(label = 'No Play Selected') {
  state.activePlayId = null;
  state.playName = label;
  state.notes = '';
  state.playerMarks = {};
  state.playerSize = PLAYER_SIZE.default;
  state.endCapSize = END_CAP_SIZE.default;
  state.defenseVisible = defaultPlay.defenseVisible;
  state.defenseFormation = defaultPlay.defenseFormation;
  state.sourceImage = '';
  state.routeMode = 'straight';
  state.routeStyle = cloneData(defaultPlay.routeStyle);
  state.players = [];
  state.defenders = [];
  state.routes = [];
  state.annotations = [];
  state.selectedId = null;
  state.selectedType = null;
  state.drag = null;
  state.routeDraft = null;
  controls.playNotes.value = '';
  controls.playNotes.disabled = true;
  syncPlayerSizeControl();
  syncEndCapSizeControl();
  syncLineStyleControls();
  render();
}

function loadInitialState() {
  state.playbook = normalizePlaybook(null);
  state.activeFolderId = state.playbook.activeFolderId;
  state.activePlayId = state.playbook.activePlayId;
  state.openFolderIds = new Set(state.playbook.folders.map((folder) => folder.id));
  const play = activePlay();
  if (play) applyPlay(play);
  else clearActivePlayView('No Play Selected');
  syncPlaybookState();
  renderPlaybookSelectors();
  syncPlaysetFileBadge();
  resetHistory();
}
