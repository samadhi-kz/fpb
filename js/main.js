// Browser event binding and app startup.
field.addEventListener('pointerdown', handlePointerDown);
field.addEventListener('pointermove', handlePointerMove);
field.addEventListener('pointerup', handlePointerUp);
field.addEventListener('pointercancel', cancelPointerInteraction);
field.addEventListener('dblclick', (event) => {
  if (state.routeDraft?.input === 'poly') {
    event.preventDefault();
    finishRoute();
    return;
  }
  const hit = targetFromEvent(event);
  if (hit?.kind === 'annotation') {
    selectThing('annotation', hit.id);
    editSelectedAnnotation();
  }
});

function syncToolButtons() {
  document.querySelectorAll('.tool-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tool === state.tool);
  });
}

document.querySelectorAll('.tool-button').forEach((button) => {
  button.addEventListener('click', () => {
    hidePlayerNumberPicker();
    if (state.bookOverviewOpen) setBookOverviewOpen(false, { quiet: true });
    state.tool = button.dataset.tool;
    state.pendingPreset = null;
    if (state.tool !== 'select') {
      state.selectedId = null;
      state.selectedType = null;
    }
    syncToolEndCapDefault(state.tool);
    syncToolButtons();
    syncPresetButtons();
    render();
    setStatus(button.title);
  });
});

controls.playbookTree.addEventListener('click', handlePlaybookTreeClick);
controls.playbookTree.addEventListener('dblclick', handlePlaybookTreeDoubleClick);
controls.playbookTree.addEventListener('dragstart', handlePlaybookTreeDragStart);
controls.playbookTree.addEventListener('dragover', handlePlaybookTreeDragOver);
controls.playbookTree.addEventListener('drop', handlePlaybookTreeDrop);
controls.playbookTree.addEventListener('dragend', handlePlaybookTreeDragEnd);
controls.playbookTree.addEventListener('dragleave', handlePlaybookTreeDragLeave);
controls.playbookPreview?.addEventListener('click', handlePlaybookPreviewClick);
controls.playbookPreview?.addEventListener('dragstart', handlePlaybookPreviewDragStart);
controls.playbookPreview?.addEventListener('dragover', handlePlaybookPreviewDragOver);
controls.playbookPreview?.addEventListener('drop', handlePlaybookPreviewDrop);
controls.playbookPreview?.addEventListener('dragend', handlePlaybookPreviewDragEnd);
controls.playbookPreview?.addEventListener('dragleave', handlePlaybookPreviewDragLeave);
controls.mobilePlaybookList?.addEventListener('click', handleMobilePlaybookClick);
controls.mobilePlaybookList?.addEventListener('dragstart', handleMobilePlayPreviewDragStart);
controls.mobilePlaybookList?.addEventListener('dragover', handleMobilePlayPreviewDragOver);
controls.mobilePlaybookList?.addEventListener('drop', handleMobilePlayPreviewDrop);
controls.mobilePlaybookList?.addEventListener('dragend', handleMobilePlayPreviewDragEnd);
controls.mobilePlaybookList?.addEventListener('dragleave', handleMobilePlayPreviewDragLeave);
controls.mobilePlaybookList?.addEventListener('pointerdown', handleMobilePlaybookPointerDown);
controls.mobilePlaybookList?.addEventListener('touchstart', handleMobilePlaybookTouchStart, { passive: true });
controls.mobilePlaybookList?.addEventListener('contextmenu', handleMobilePlaybookContextMenu);
document.addEventListener('pointermove', handleMobilePlaybookPointerMove, { passive: false });
document.addEventListener('pointerup', handleMobilePlaybookPointerUp);
document.addEventListener('pointercancel', handleMobilePlaybookPointerCancel);
document.addEventListener('touchmove', handleMobilePlaybookTouchMove, { passive: false });
document.addEventListener('touchend', finishMobileBookTouchDrag);
document.addEventListener('touchcancel', (event) => finishMobileBookTouchDrag(event, true));

controls.endCap.addEventListener('change', () => {
  if (state.selectedType !== 'route') return;
  const route = state.routes.find((item) => item.id === state.selectedId);
  if (!route) return;
  route.end = controls.endCap.value;
  saveLocal(false, { historyKey: `route-end-${route.id}` });
  render();
});

controls.defenseToggle.addEventListener('change', () => {
  setDefenseVisible(controls.defenseToggle.checked);
});

controls.playerSize.addEventListener('input', () => {
  state.playerSize = normalizePlayerSize(controls.playerSize.value);
  syncPlayerSizeControl();
  saveLocal(false, { historyKey: 'player-size' });
  drawPlayers();
});

controls.endCapSize.addEventListener('input', () => {
  state.endCapSize = normalizeEndCapSize(controls.endCapSize.value);
  syncEndCapSizeControl();
  saveLocal(false, { historyKey: 'end-cap-size' });
  drawRoutes();
});

controls.lineColor.addEventListener('input', () => {
  updateLineStyle({ color: controls.lineColor.value });
});

controls.lineWidth.addEventListener('input', () => {
  updateLineStyle({ width: controls.lineWidth.value });
});

controls.lineOpacity.addEventListener('input', () => {
  updateLineStyle({ opacity: controls.lineOpacity.value });
});

controls.routeShape.addEventListener('change', () => {
  updateRouteMode(controls.routeShape.value);
});

document.querySelectorAll('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => activateRoutePreset(button.dataset.preset));
});

document.querySelectorAll('[data-formation]').forEach((button) => {
  button.addEventListener('click', () => applyOffenseFormation(button.dataset.formation));
});

document.querySelectorAll('[data-defense-formation]').forEach((button) => {
  button.addEventListener('click', () => applyDefenseFormation(button.dataset.defenseFormation));
});

controls.playNotes.addEventListener('input', () => {
  state.notes = controls.playNotes.value;
  saveLocal(false, { historyKey: 'play-notes' });
  render();
});

controls.selectedText.addEventListener('input', () => {
  if (state.selectedType !== 'annotation') return;
  const note = state.annotations.find((item) => item.id === state.selectedId);
  if (!note) return;
  note.text = controls.selectedText.value;
  saveLocal(false, { historyKey: `annotation-${note.id}` });
  drawText();
});

controls.playsetFileInput.addEventListener('change', async () => {
  const [file] = controls.playsetFileInput.files;
  controls.playsetFileInput.value = '';
  if (!file) return;
  const text = await file.text();
  if (state.playsetFileMode === 'add') await addPlaysetFromText(text, file.name);
  else await loadPlaysetFromText(text, file.name, null);
  state.playsetFileMode = 'load';
});

document.querySelector('#newPlayBtn').addEventListener('click', () => createNewPlay());
document.querySelector('#newFolderBtn').addEventListener('click', createNewFolder);
document.querySelector('#newPlayInFolderBtn').addEventListener('click', () => createNewPlay());
document.querySelector('#deleteBtn').addEventListener('click', deleteSelectedItem);
document.querySelectorAll('[data-action="finish-route"]').forEach((button) => {
  button.addEventListener('click', finishRoute);
});
document.querySelectorAll('[data-action="delete-selected"]').forEach((button) => {
  button.addEventListener('click', deleteSelectedItem);
});
function bindTouchFriendlyCommand(selector, handler) {
  document.querySelectorAll(selector).forEach((button) => {
    let touchStart = null;
    let handledTouchAt = 0;
    button.addEventListener('click', (event) => {
      if (Date.now() - handledTouchAt < 600) return;
      event.preventDefault();
      handler(button, event);
    });
    button.addEventListener('touchstart', (event) => {
      const touch = event.changedTouches[0];
      touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
    }, { passive: true });
    button.addEventListener('touchend', (event) => {
      const touch = event.changedTouches[0];
      if (!touch || !touchStart) return;
      const moved = Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y);
      touchStart = null;
      if (moved > 10) return;
      event.preventDefault();
      handledTouchAt = Date.now();
      handler(button, event);
    }, { passive: false });
  });
}

bindTouchFriendlyCommand('[data-action="undo-history"]', undoCommand);
bindTouchFriendlyCommand('[data-action="redo-history"]', redoCommand);
bindTouchFriendlyCommand('[data-action="clear-routes"]', clearRoutes);
bindTouchFriendlyCommand('[data-action="reset-play-diagram"]', resetPlayDiagram);
bindTouchFriendlyCommand('[data-action="set-qb-setback"]', () => setQbDepth(2, 'Setback'));
bindTouchFriendlyCommand('[data-action="set-qb-shotgun"]', () => setQbDepth(5, 'Shotgun'));
bindTouchFriendlyCommand('[data-line-type]', (button) => updateSelectedRouteType(button.dataset.lineType));
bindTouchFriendlyCommand('[data-mobile-end-cap]', (button) => updateSelectedEndCap(button.dataset.mobileEndCap));
bindTouchFriendlyCommand('[data-mobile-line-color]', (button) => updateSelectedLineColor(button.dataset.mobileLineColor));
bindTouchFriendlyCommand('[data-mobile-player-mark]', (button) => updateSelectedPlayerMark(button.dataset.mobilePlayerMark));
bindTouchFriendlyCommand('[data-action="rename-selected-player"]', () => renamePlayerById());
bindTouchFriendlyCommand('[data-action="toggle-dock-minimized"]', toggleFocusDockMinimized);
bindTouchFriendlyCommand('[data-action="toggle-corner-minimized"]', toggleMobileCornerMinimized);
bindTouchFriendlyCommand('[data-action="toggle-mobile-draw-panel"]', toggleMobileDrawPanel);
bindTouchFriendlyCommand('[data-action="toggle-mobile-offense-panel"]', toggleMobileOffensePanel);
bindTouchFriendlyCommand('[data-action="toggle-mobile-defense-panel"]', toggleMobileDefensePanel);
bindTouchFriendlyCommand('[data-action="toggle-mobile-book-panel"]', toggleMobileBookPanel);
bindTouchFriendlyCommand('[data-action="toggle-mobile-plays-panel"]', toggleMobilePlaysPanel);
bindTouchFriendlyCommand('[data-action="toggle-mobile-tree-panel"]', toggleMobileTreePanel);
bindTouchFriendlyCommand('[data-action="toggle-mobile-export-panel"]', toggleMobileExportPanel);
bindTouchFriendlyCommand('[data-action="rename-playset-file"]', renamePlaysetFileName);
bindTouchFriendlyCommand('[data-action="mobile-load-json"]', openPlaysetFile);
bindTouchFriendlyCommand('[data-action="mobile-add-json"]', openAddPlaysetFile);
bindTouchFriendlyCommand('[data-action="mobile-save-photo"]', savePhoto);
bindTouchFriendlyCommand('[data-action="mobile-share-play-link"]', shareCurrentPlayLink);
bindTouchFriendlyCommand('[data-action="mobile-share-book-link"]', shareCurrentBookLink);
bindTouchFriendlyCommand('[data-action="mobile-pdf-current"]', exportCurrentPdf);
bindTouchFriendlyCommand('[data-action="mobile-pdf-book"]', exportPlaybookPdf);
bindTouchFriendlyCommand('[data-action="mobile-save-json"]', savePlaysetAs);
document.querySelectorAll('[data-action="toggle-defense-visible"]').forEach((button) => {
  button.addEventListener('click', toggleDefenseVisible);
});
document.querySelectorAll('[data-action="toggle-fullscreen"]').forEach((button) => {
  button.addEventListener('click', toggleFullscreen);
});
document.querySelectorAll('[data-action="flip-play"]').forEach((button) => {
  button.addEventListener('click', flipPlay);
});
document.querySelectorAll('[data-action="rename-active-folder"]').forEach((button) => {
  button.addEventListener('click', () => {
    if (state.bookOverviewOpen) return;
    renameFolderById();
  });
  button.addEventListener('keydown', (event) => {
    if (state.bookOverviewOpen) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    renameFolderById();
  });
});
document.querySelectorAll('[data-action="rename-active-play"]').forEach((button) => {
  button.addEventListener('click', () => {
    if (state.bookOverviewOpen) return;
    renamePlayById();
  });
  button.addEventListener('keydown', (event) => {
    if (state.bookOverviewOpen) return;
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    renamePlayById();
  });
});
document.querySelector('#openPlaysetBtn').addEventListener('click', openPlaysetFile);
document.querySelector('#savePlaysetFileBtn').addEventListener('click', savePlaysetFile);
document.querySelector('#savePlaysetAsBtn').addEventListener('click', savePlaysetAs);
document.querySelector('#exportLoadJsonBtn').addEventListener('click', openPlaysetFile);
document.querySelector('#exportAddJsonBtn').addEventListener('click', openAddPlaysetFile);
document.querySelector('#exportJsonBtn').addEventListener('click', savePlaysetAs);
controls.sharePlayLinkBtn?.addEventListener('click', shareTopbarLink);
document.querySelector('#sharePlayLinkExportBtn').addEventListener('click', shareCurrentPlayLink);
document.querySelector('#shareBookLinkExportBtn').addEventListener('click', shareCurrentBookLink);
document.querySelector('#savePhotoBtn')?.addEventListener('click', savePhoto);
document.querySelector('#pdfCurrentBtn').addEventListener('click', exportCurrentPdf);
document.querySelector('#pdfBookBtn').addEventListener('click', exportPlaybookPdf);
controls.bookOverviewToggleBtn?.addEventListener('click', () => toggleBookOverview());
controls.playerNumberPicker?.addEventListener('click', handlePlayerNumberPickerClick);

document.addEventListener('pointerdown', (event) => {
  if (!controls.playerNumberPicker || controls.playerNumberPicker.hidden) return;
  if (controls.playerNumberPicker.contains(event.target)) return;
  hidePlayerNumberPicker();
}, { capture: true });

function undoCommand() {
  if (state.routeDraft?.input === 'poly') {
    undoPolylinePoint();
    return;
  }
  if (state.routeDraft) {
    state.routeDraft = null;
    state.drag = null;
    render();
    setStatus('Cancelled');
    return;
  }
  undoHistory();
}

function redoCommand() {
  if (state.routeDraft?.input === 'poly') {
    redoPolylinePoint();
    return;
  }
  if (state.routeDraft) {
    setStatus('Drawing');
    return;
  }
  redoHistory();
}

function selectedRouteForDockEdit() {
  const route = activeRoute();
  if (!route) setStatus('線を選択');
  return route;
}

function updateSelectedRouteType(type) {
  const route = selectedRouteForDockEdit();
  if (!route) return;
  const nextType = ['route', 'motion', 'pass'].includes(type) ? type : 'route';
  route.type = nextType;
  saveLocal(false, { historyKey: `line-type-${route.id}` });
  render();
  setStatus(nextType === 'motion' ? 'Wave Line' : nextType === 'pass' ? 'Dotted Line' : 'Solid Line');
}

function updateSelectedEndCap(end) {
  const route = selectedRouteForDockEdit();
  if (!route) return;
  if (!END_CAP_VALUES.has(end)) return;
  route.end = end;
  controls.endCap.value = end;
  saveLocal(false, { historyKey: `route-end-${route.id}` });
  render();
  setStatus(end === 'arrow' ? 'Arrow End' : end === 't' ? 'T End' : end === 'dot' ? 'Dot End' : 'No End');
}

function updateSelectedLineColor(color) {
  const route = selectedRouteForDockEdit();
  if (!route) return;
  updateLineStyle({ color: normalizeRouteColor(color) });
}

function selectedPlayerForDockEdit() {
  if (state.selectedType !== 'player') {
    setStatus('選手を選択');
    return null;
  }
  const player = state.players.find((item) => item.id === state.selectedId);
  if (!player) setStatus('選手を選択');
  return player || null;
}

function updateSelectedPlayerMark(mark) {
  const player = selectedPlayerForDockEdit();
  if (!player) return;
  const nextMark = PLAYER_MARK_VALUES.has(mark) ? mark : 'ring';
  setPlayerMark(player, nextMark);
  saveLocal(false, { historyKey: `player-mark-${player.id}` });
  render();
  setStatus(`${player.label} Mark`);
}

function hidePlayerNumberPicker() {
  if (!controls.playerNumberPicker) return;
  controls.playerNumberPicker.hidden = true;
  controls.playerNumberPicker.removeAttribute('data-player-id');
}

function positionPlayerNumberPicker(clientX, clientY) {
  const picker = controls.playerNumberPicker;
  if (!picker) return;
  picker.hidden = false;
  const rect = picker.getBoundingClientRect();
  const left = clamp(clientX - rect.width / 2, 10, Math.max(10, window.innerWidth - rect.width - 10));
  const top = clamp(clientY - rect.height - 14, 10, Math.max(10, window.innerHeight - rect.height - 10));
  picker.style.left = `${left}px`;
  picker.style.top = `${top}px`;
}

function showPlayerNumberPicker(player, event = null) {
  if (!controls.playerNumberPicker || !player) {
    hidePlayerNumberPicker();
    return;
  }
  const picker = controls.playerNumberPicker;
  const canRename = canSwapPlayerNumber(player);
  const selectedMark = playerMark(player);
  const title = picker.querySelector('.player-picker-title');
  const numberRow = picker.querySelector('.player-picker-number-row');
  if (title) title.textContent = `No.${player.label}`;
  if (numberRow) {
    numberRow.hidden = !canRename;
    numberRow.setAttribute('aria-hidden', String(!canRename));
  }
  controls.playerNumberPicker.dataset.playerId = player.id;
  controls.playerNumberPicker.querySelectorAll('[data-player-number]').forEach((button) => {
    const active = button.dataset.playerNumber === player.label;
    button.disabled = !canRename;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  controls.playerNumberPicker.querySelectorAll('[data-player-mark]').forEach((button) => {
    const active = button.dataset.playerMark === selectedMark;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  positionPlayerNumberPicker(event?.clientX || window.innerWidth / 2, event?.clientY || window.innerHeight / 2);
  setStatus(canRename ? `No.${player.label} Options` : `No.${player.label} Shape`);
}

function handlePlayerNumberPickerClick(event) {
  const picker = controls.playerNumberPicker;
  const button = event.target.closest('[data-player-number], [data-player-mark]');
  if (!button || !picker?.contains(button)) return;
  const playerId = controls.playerNumberPicker.dataset.playerId;
  if (button.dataset.playerNumber) {
    renamePlayerById(playerId, button.dataset.playerNumber);
    hidePlayerNumberPicker();
    return;
  }

  const player = state.players.find((item) => item.id === playerId);
  const mark = button.dataset.playerMark;
  if (!player || !PLAYER_MARK_VALUES.has(mark)) {
    hidePlayerNumberPicker();
    return;
  }
  setPlayerMark(player, mark);
  saveLocal(false, { historyKey: `player-mark-${player.id}` });
  render();
  setStatus(`Player ${player.label}: ${markLabel(mark)}`);
  hidePlayerNumberPicker();
}

function renamePlayerById(playerId = state.selectedId, nextLabelOverride = null) {
  const player = state.players.find((item) => item.id === playerId);
  if (!player) {
    setStatus('選手を選択');
    return false;
  }
  if (!canSwapPlayerNumber(player)) {
    setStatus('1/2 Fixed');
    return false;
  }

  const input = nextLabelOverride ?? prompt('Swap Number (3, 4, 5)', player.label);
  if (input === null) return false;
  const nextLabel = normalizePlayerLabel(input, player.label);
  if (!nextLabel || nextLabel === player.label) return false;
  if (!PLAYER_SWAP_LABELS.has(nextLabel)) {
    alert('3, 4, 5 の中で選んでください。');
    setStatus('3/4/5 Only');
    return false;
  }

  const oldLabel = player.label;
  const targetPlayer = state.players.find((item) => item.id !== player.id && item.label === nextLabel);
  const markFromOldLabel = state.playerMarks[oldLabel];
  if (markFromOldLabel && !state.playerMarks[playerMarkKey(player)]) {
    setPlayerMark(player, markFromOldLabel);
  }
  if (targetPlayer) {
    const markFromNextLabel = state.playerMarks[nextLabel];
    if (markFromNextLabel && !state.playerMarks[playerMarkKey(targetPlayer)]) {
      setPlayerMark(targetPlayer, markFromNextLabel);
    }
    targetPlayer.label = oldLabel;
  }
  delete state.playerMarks[oldLabel];
  delete state.playerMarks[nextLabel];
  player.label = nextLabel;
  saveLocal(false, { historyKey: `player-label-${player.id}` });
  render();
  setStatus(targetPlayer ? `${oldLabel} / ${nextLabel} Swapped` : `Player ${oldLabel} -> ${nextLabel}`);
  return true;
}

function syncBookOverviewView() {
  const open = Boolean(state.bookOverviewOpen);
  document.body.classList.toggle('is-book-overview-open', open);
  if (controls.bookOverview) controls.bookOverview.hidden = !open;
  if (controls.canvasWrap) controls.canvasWrap.hidden = open;
  if (controls.folderLabel) {
    const folderName = activeFolder()?.name || '';
    controls.folderLabel.textContent = open ? 'Book List' : folderName;
    controls.folderLabel.style.display = open || folderName ? 'block' : 'none';
    controls.folderLabel.title = open ? 'Book list' : 'Rename playbook';
  }
  if (controls.titleLabel) {
    controls.titleLabel.textContent = open ? state.fileName || 'Unsaved Playbook' : activePlayDisplayName();
    controls.titleLabel.title = open ? 'Current playbook file' : 'Rename play';
    controls.titleLabel.setAttribute('aria-label', open ? 'Current playbook file' : 'Rename play');
  }
  if (controls.sharePlayLinkBtn) {
    controls.sharePlayLinkBtn.textContent = open ? 'Book Link' : '1 Play Link';
    controls.sharePlayLinkBtn.title = open ? 'Share full book link' : 'Share current play only';
    controls.sharePlayLinkBtn.setAttribute('aria-label', open ? 'Share full book link' : 'Share current play only');
  }
  if (controls.bookOverviewToggleBtn) {
    controls.bookOverviewToggleBtn.classList.toggle('is-active', open);
    controls.bookOverviewToggleBtn.setAttribute('aria-pressed', String(open));
    controls.bookOverviewToggleBtn.textContent = open ? 'Play' : 'Book List';
    controls.bookOverviewToggleBtn.title = open ? 'Back to play' : 'Show book list';
  }
}

function setBookOverviewOpen(open, options = {}) {
  const nextOpen = Boolean(open);
  state.bookOverviewOpen = nextOpen;
  hidePlayerNumberPicker();
  if (nextOpen) {
    saveLocal(false, { recordHistory: false });
    renderPlaybookSelectors();
  }
  syncBookOverviewView();
  if (!options.quiet) setStatus(nextOpen ? 'Book List' : activePlayDisplayName() || 'Ready');
}

function toggleBookOverview() {
  setBookOverviewOpen(!state.bookOverviewOpen);
}

function shareTopbarLink() {
  if (state.bookOverviewOpen) {
    shareCurrentBookLink();
    return;
  }
  shareCurrentPlayLink();
}

function undoPolylinePoint() {
  if (!state.routeDraft || state.routeDraft.input !== 'poly') return;
  if (state.routeDraft.points.length > 1) {
    const point = state.routeDraft.points.pop();
    if (point) {
      state.routeDraft.undonePoints = state.routeDraft.undonePoints || [];
      state.routeDraft.undonePoints.push(point);
    }
    const last = state.routeDraft.points[state.routeDraft.points.length - 1];
    state.routeDraft.previewPoint = last ? [...last] : null;
    drawTemp();
    syncDockActionButtons();
    setStatus('Point Undo');
    return;
  }
  state.routeDraft = null;
  state.drag = null;
  render();
  setStatus('Cancelled');
}

function redoPolylinePoint() {
  if (!state.routeDraft || state.routeDraft.input !== 'poly') return;
  const point = state.routeDraft.undonePoints?.pop();
  if (!point) {
    setStatus('No Redo');
    syncDockActionButtons();
    return;
  }
  state.routeDraft.points.push(point);
  state.routeDraft.previewPoint = [...point];
  drawTemp();
  syncDockActionButtons();
  setStatus('Point Redo');
}

document.addEventListener('keydown', (event) => {
  const isTextEditing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
    if (!isTextEditing) {
      event.preventDefault();
      if (event.shiftKey) redoCommand();
      else undoCommand();
    }
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'y') {
    if (!isTextEditing) {
      event.preventDefault();
      redoCommand();
    }
    return;
  }
  if (isFocusMode() && !isTextEditing) {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      focusZoomIn();
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      focusZoomOut();
      return;
    }
    if (event.key === '0') {
      event.preventDefault();
      resetFocusZoom();
      return;
    }
  }
  if (state.routeDraft?.input === 'poly' && !isTextEditing) {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishRoute();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      undoPolylinePoint();
      return;
    }
  }
  if ((event.key === 'Delete' || event.key === 'Backspace') && state.selectedId && !isTextEditing) {
    event.preventDefault();
    deleteSelectedItem();
  }
  if (event.key === 'Escape') {
    if (controls.playerNumberPicker && !controls.playerNumberPicker.hidden) {
      hidePlayerNumberPicker();
      return;
    }
    if (state.bookOverviewOpen) {
      setBookOverviewOpen(false);
      return;
    }
    if (isFocusMode()) {
      if (isMobileLayout()) {
        setStatus('Full Mode');
        return;
      }
      setFocusMode(false);
      return;
    }
    state.routeDraft = null;
    state.drag = null;
    state.selectedId = null;
    state.selectedType = null;
    state.pendingPreset = null;
    setStatus('準備OK');
    render();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    if (state.fileHandle) savePlaysetFile();
    else downloadPlaysetJson(state.fileName || 'flag-playbook.json');
  }
});

window.addEventListener('afterprint', () => setStatus('準備OK'));
window.addEventListener('afterprint', cleanupPrintBook);
window.addEventListener('blur', cancelPointerInteraction);

let resizeRenderFrame = null;
window.addEventListener('resize', () => {
  if (resizeRenderFrame) window.cancelAnimationFrame(resizeRenderFrame);
  resizeRenderFrame = window.requestAnimationFrame(() => {
    resizeRenderFrame = null;
    if (isFocusMode()) {
      setFocusFieldSize();
      clampFocusDock();
      centerFocusCanvas();
    }
    render();
  });
});

const mobileDock = document.querySelector('.mobile-dock');
const mobileDockHandle = document.querySelector('.mobile-dock-handle');
let focusDockDrag = null;
const focusZoomPointers = new Map();
let focusPinch = null;
let focusZoom = 1;
let focusBaseFieldWidth = 0;
let focusBaseFieldHeight = 0;
const FOCUS_ZOOM_MIN = 0.4;
const FOCUS_ZOOM_MAX = 2.8;
const FOCUS_ZOOM_STEP = 1.18;

window.addEventListener('fullscreenchange', () => {
  syncFullscreenButtons();
  setStatus(isFullViewActive() ? 'Exit Fullscreen' : 'Fullscreen');
});

function isMobileLayout() {
  const touchLayout = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches
    || navigator.maxTouchPoints > 1;
  return window.matchMedia?.('(max-width: 860px)').matches
    || window.innerWidth <= 860
    || (touchLayout && window.innerWidth <= 1366);
}

function isFocusMode() {
  return document.body.classList.contains('is-focus-mode');
}

function isFullViewActive() {
  return isFocusMode() || Boolean(document.fullscreenElement || document.webkitFullscreenElement);
}

function syncFullscreenButtons() {
  const active = isFullViewActive();
  document.querySelectorAll('[data-action="toggle-fullscreen"]').forEach((button) => {
    button.classList.toggle('is-full-active', active);
    button.setAttribute('aria-pressed', String(active));
    button.title = active ? 'Exit full view' : 'Full view';
    const label = button.querySelector('span:last-child');
    if (label && label !== button.querySelector('.tool-icon')) {
      label.textContent = active ? 'Exit' : 'Full';
    } else {
      button.textContent = active ? 'Exit Fullscreen' : 'Fullscreen';
    }
  });
  syncFocusDockMinimizeButton();
  syncMobileCornerMinimizeButton();
}

function focusZoomPercent() {
  return `${Math.round(focusZoom * 100)}%`;
}

function syncFocusDockMinimizeButton() {
  const minimized = document.body.classList.contains('is-dock-minimized');
  document.querySelectorAll('[data-action="toggle-dock-minimized"]').forEach((button) => {
    button.textContent = minimized ? '+' : '−';
    button.title = minimized ? 'Expand tools' : 'Minimize tools';
    button.setAttribute('aria-label', minimized ? 'Expand tools' : 'Minimize tools');
  });
}

function syncMobileCornerMinimizeButton() {
  const minimized = document.body.classList.contains('is-corner-minimized');
  document.querySelectorAll('[data-action="toggle-corner-minimized"]').forEach((button) => {
    button.textContent = minimized ? '+' : '−';
    button.title = minimized ? 'Expand book tools' : 'Minimize book tools';
    button.setAttribute('aria-label', minimized ? 'Expand book tools' : 'Minimize book tools');
  });
}

function syncMobileDockPanels() {
  const drawOpen = document.body.classList.contains('is-mobile-draw-open');
  const offenseOpen = document.body.classList.contains('is-mobile-offense-open');
  const defenseOpen = document.body.classList.contains('is-mobile-defense-open');
  const playsOpen = document.body.classList.contains('is-mobile-plays-open');
  const treeOpen = document.body.classList.contains('is-mobile-tree-open');
  const bookOpen = playsOpen || treeOpen || document.body.classList.contains('is-mobile-book-open');
  const exportOpen = document.body.classList.contains('is-mobile-export-open');
  document.querySelectorAll('.mobile-draw-row').forEach((row) => {
    row.hidden = !drawOpen;
    row.setAttribute('aria-hidden', String(!drawOpen));
  });
  syncMobileLineControls();
  syncMobilePlayerControls();
  document.querySelectorAll('.mobile-offense-row').forEach((row) => {
    row.hidden = !offenseOpen;
    row.setAttribute('aria-hidden', String(!offenseOpen));
  });
  document.querySelectorAll('.mobile-defense-row').forEach((row) => {
    row.hidden = !defenseOpen;
    row.setAttribute('aria-hidden', String(!defenseOpen));
  });
  document.querySelectorAll('.mobile-book-row').forEach((row) => {
    row.hidden = !bookOpen;
    row.setAttribute('aria-hidden', String(!bookOpen));
  });
  document.querySelectorAll('.mobile-export-row').forEach((row) => {
    row.hidden = !exportOpen;
    row.setAttribute('aria-hidden', String(!exportOpen));
  });
  document.querySelectorAll('[data-action="toggle-mobile-draw-panel"]').forEach((button) => {
    button.classList.toggle('is-active', drawOpen);
    button.setAttribute('aria-pressed', String(drawOpen));
  });
  document.querySelectorAll('[data-action="toggle-mobile-offense-panel"]').forEach((button) => {
    button.classList.toggle('is-active', offenseOpen);
    button.setAttribute('aria-pressed', String(offenseOpen));
  });
  document.querySelectorAll('[data-action="toggle-mobile-defense-panel"]').forEach((button) => {
    button.classList.toggle('is-active', defenseOpen);
    button.setAttribute('aria-pressed', String(defenseOpen));
  });
  document.querySelectorAll('[data-action="toggle-mobile-book-panel"]').forEach((button) => {
    button.classList.toggle('is-active', bookOpen);
    button.setAttribute('aria-pressed', String(bookOpen));
  });
  document.querySelectorAll('[data-action="toggle-mobile-plays-panel"]').forEach((button) => {
    button.classList.toggle('is-active', playsOpen);
    button.setAttribute('aria-pressed', String(playsOpen));
  });
  document.querySelectorAll('[data-action="toggle-mobile-tree-panel"]').forEach((button) => {
    button.classList.toggle('is-active', treeOpen);
    button.setAttribute('aria-pressed', String(treeOpen));
  });
  document.querySelectorAll('[data-action="toggle-mobile-export-panel"]').forEach((button) => {
    button.classList.toggle('is-active', exportOpen);
    button.setAttribute('aria-pressed', String(exportOpen));
  });
  syncMobileCornerMinimizeButton();
}

function setMobileDockPanel(panel) {
  const cornerPanel = panel === 'book' || panel === 'plays' || panel === 'tree' || panel === 'export';
  if (panel && !cornerPanel) document.body.classList.remove('is-dock-minimized');
  if (cornerPanel) document.body.classList.remove('is-corner-minimized');
  document.body.classList.toggle('is-mobile-draw-open', panel === 'draw');
  document.body.classList.toggle('is-mobile-offense-open', panel === 'offense');
  document.body.classList.toggle('is-mobile-defense-open', panel === 'defense');
  document.body.classList.toggle('is-mobile-book-open', panel === 'book');
  document.body.classList.toggle('is-mobile-plays-open', panel === 'plays');
  document.body.classList.toggle('is-mobile-tree-open', panel === 'tree');
  document.body.classList.toggle('is-mobile-export-open', panel === 'export');
  syncFocusDockMinimizeButton();
  syncMobileDockPanels();
}

function toggleMobileCornerMinimized() {
  const minimized = !document.body.classList.contains('is-corner-minimized');
  if (minimized) setMobileDockPanel('');
  document.body.classList.toggle('is-corner-minimized', minimized);
  syncMobileCornerMinimizeButton();
}

function toggleMobileDrawPanel() {
  const nextPanel = document.body.classList.contains('is-mobile-draw-open') ? '' : 'draw';
  setMobileDockPanel(nextPanel);
}

function toggleMobileOffensePanel() {
  const nextPanel = document.body.classList.contains('is-mobile-offense-open') ? '' : 'offense';
  setMobileDockPanel(nextPanel);
}

function toggleMobileDefensePanel() {
  const nextPanel = document.body.classList.contains('is-mobile-defense-open') ? '' : 'defense';
  setMobileDockPanel(nextPanel);
}

function toggleMobileBookPanel() {
  const nextPanel = document.body.classList.contains('is-mobile-book-open') ? '' : 'book';
  setMobileDockPanel(nextPanel);
}

function toggleMobilePlaysPanel() {
  const nextPanel = document.body.classList.contains('is-mobile-plays-open') ? '' : 'plays';
  setMobileDockPanel(nextPanel);
}

function toggleMobileTreePanel() {
  const nextPanel = document.body.classList.contains('is-mobile-tree-open') ? '' : 'tree';
  setMobileDockPanel(nextPanel);
}

function toggleMobileExportPanel() {
  const nextPanel = document.body.classList.contains('is-mobile-export-open') ? '' : 'export';
  setMobileDockPanel(nextPanel);
}

function clampFocusDockPosition(left, top) {
  const rect = mobileDock.getBoundingClientRect();
  const width = rect.width || 320;
  const height = rect.height || 120;
  return {
    left: clamp(left, 8, Math.max(8, window.innerWidth - width - 8)),
    top: clamp(top, 8, Math.max(8, window.innerHeight - height - 8))
  };
}

function setFocusDockPosition(left, top) {
  const next = clampFocusDockPosition(left, top);
  mobileDock.style.left = `${next.left}px`;
  mobileDock.style.top = `${next.top}px`;
}

function focusViewportSize() {
  const visual = window.visualViewport;
  return {
    width: Math.max(1, visual?.width || window.innerWidth || document.documentElement.clientWidth || 1),
    height: Math.max(1, visual?.height || window.innerHeight || document.documentElement.clientHeight || 1)
  };
}

function setFocusFieldSize() {
  const viewport = focusViewportSize();
  const isPortrait = viewport.height >= viewport.width;
  const baseWidth = viewport.width * (isPortrait ? 1.55 : 1.15);
  const targetHeight = isPortrait ? Math.max(baseWidth * 720 / 1000, viewport.height * 0.82) : baseWidth * 720 / 1000;
  focusBaseFieldWidth = Math.round(targetHeight * 1000 / 720);
  focusBaseFieldHeight = Math.round(targetHeight);
  applyFocusFieldSize();
}

function applyFocusFieldSize() {
  const width = Math.round((focusBaseFieldWidth || 1) * focusZoom);
  const height = Math.round((focusBaseFieldHeight || 1) * focusZoom);
  field.style.setProperty('--focus-field-width', `${width}px`);
  field.style.setProperty('--focus-field-height', `${height}px`);
}

function setFocusZoom(nextZoom, centerClientX = window.innerWidth / 2, centerClientY = window.innerHeight / 2) {
  const wrap = document.querySelector('.canvas-wrap');
  if (!wrap || !isFocusMode()) return;
  const oldWidth = field.getBoundingClientRect().width || focusBaseFieldWidth || 1;
  const oldHeight = field.getBoundingClientRect().height || focusBaseFieldHeight || 1;
  const wrapRect = wrap.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const fieldLeft = wrap.scrollLeft + fieldRect.left - wrapRect.left;
  const fieldTop = wrap.scrollTop + fieldRect.top - wrapRect.top;
  const contentX = wrap.scrollLeft + centerClientX - wrapRect.left - fieldLeft;
  const contentY = wrap.scrollTop + centerClientY - wrapRect.top - fieldTop;
  const ratioX = clamp(contentX / oldWidth, 0, 1);
  const ratioY = clamp(contentY / oldHeight, 0, 1);

  focusZoom = clamp(nextZoom, FOCUS_ZOOM_MIN, FOCUS_ZOOM_MAX);
  applyFocusFieldSize();

  const nextWidth = field.getBoundingClientRect().width || focusBaseFieldWidth || 1;
  const nextHeight = field.getBoundingClientRect().height || focusBaseFieldHeight || 1;
  wrap.scrollLeft = fieldLeft + ratioX * nextWidth - (centerClientX - wrapRect.left);
  wrap.scrollTop = fieldTop + ratioY * nextHeight - (centerClientY - wrapRect.top);
}

function changeFocusZoom(multiplier, centerClientX = window.innerWidth / 2, centerClientY = window.innerHeight / 2) {
  if (!isFocusMode()) {
    setStatus('Fullscreen first');
    return;
  }
  setFocusZoom(focusZoom * multiplier, centerClientX, centerClientY);
  setStatus(`Zoom ${focusZoomPercent()}`);
}

function focusZoomIn(button, event) {
  changeFocusZoom(FOCUS_ZOOM_STEP, event?.clientX || window.innerWidth / 2, event?.clientY || window.innerHeight / 2);
}

function focusZoomOut(button, event) {
  changeFocusZoom(1 / FOCUS_ZOOM_STEP, event?.clientX || window.innerWidth / 2, event?.clientY || window.innerHeight / 2);
}

function resetFocusZoom(button, event) {
  if (!isFocusMode()) {
    setStatus('Fullscreen first');
    return;
  }
  setFocusZoom(1, event?.clientX || window.innerWidth / 2, event?.clientY || window.innerHeight / 2);
  setStatus('Zoom 100%');
}

function clearFocusFieldSize() {
  focusZoom = 1;
  focusBaseFieldWidth = 0;
  focusBaseFieldHeight = 0;
  field.style.removeProperty('--focus-field-width');
  field.style.removeProperty('--focus-field-height');
}

function centerFocusCanvas() {
  const wrap = document.querySelector('.canvas-wrap');
  if (!wrap) return;
  const maxLeft = Math.max(0, wrap.scrollWidth - wrap.clientWidth);
  const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
  const wrapRect = wrap.getBoundingClientRect();
  const fieldRect = field.getBoundingClientRect();
  const fieldLeft = wrap.scrollLeft + fieldRect.left - wrapRect.left;
  const fieldTop = wrap.scrollTop + fieldRect.top - wrapRect.top;
  const fieldWidth = fieldRect.width || wrap.scrollWidth;
  const fieldHeight = fieldRect.height || wrap.scrollHeight;
  wrap.scrollLeft = clamp(fieldLeft + fieldWidth / 2 - wrap.clientWidth / 2, 0, maxLeft);
  wrap.scrollTop = clamp(fieldTop + fieldHeight * 0.62 - wrap.clientHeight * 0.52, 0, maxTop);
}

function placeFocusDockDefault() {
  setFocusFieldSize();
  window.requestAnimationFrame(() => {
    centerFocusCanvas();
  });
}

function clampFocusDock() {
  if (!mobileDock) return;
  mobileDock.style.left = '';
  mobileDock.style.top = '';
}

function setFocusMode(enabled) {
  if (enabled && state.bookOverviewOpen) setBookOverviewOpen(false, { quiet: true });
  document.body.classList.toggle('is-focus-mode', enabled);
  if (enabled) {
    placeFocusDockDefault();
    setStatus('Focus Mode');
  } else {
    document.body.classList.remove('is-dock-minimized');
    focusZoomPointers.clear();
    focusPinch = null;
    document.body.classList.remove('is-focus-pinching');
    clearFocusFieldSize();
    mobileDock.style.left = '';
    mobileDock.style.top = '';
    setStatus('準備OK');
  }
  syncFullscreenButtons();
  render();
}

function toggleFocusDockMinimized() {
  if (!isFocusMode()) return;
  document.body.classList.toggle('is-dock-minimized');
  syncFocusDockMinimizeButton();
}

function toggleFullscreen() {
  if (isMobileLayout() && isFocusMode()) {
    setStatus('Full Mode');
    return;
  }
  setFocusMode(!isFocusMode());
}

function focusPinchDistance(points) {
  return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

function focusPinchCenter(points) {
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2
  };
}

function beginFocusPinchIfReady() {
  if (!isFocusMode() || focusZoomPointers.size < 2 || focusPinch) return;
  const points = Array.from(focusZoomPointers.values()).slice(0, 2);
  const distance = focusPinchDistance(points);
  if (distance < 12) return;
  focusPinch = {
    startDistance: distance,
    startZoom: focusZoom,
    pointerIds: Array.from(focusZoomPointers.keys()).slice(0, 2)
  };
  cancelPointerInteraction();
  document.body.classList.add('is-focus-pinching');
  setStatus('Zoom');
}

function updateFocusPinch(event) {
  if (!focusPinch) return;
  const points = focusPinch.pointerIds.map((id) => focusZoomPointers.get(id));
  if (points.some((point) => !point)) return;
  event.preventDefault();
  const distance = focusPinchDistance(points);
  const center = focusPinchCenter(points);
  setFocusZoom(focusPinch.startZoom * (distance / focusPinch.startDistance), center.x, center.y);
}

function handleFocusWheelZoom(event) {
  if (!isFocusMode() || (!event.ctrlKey && !event.metaKey)) return;
  if (event.target.closest('.mobile-dock, .mobile-corner-actions')) return;
  event.preventDefault();
  const multiplier = Math.exp(-event.deltaY * 0.002);
  setFocusZoom(focusZoom * multiplier, event.clientX, event.clientY);
  setStatus(`Zoom ${focusZoomPercent()}`);
}

function handleFocusZoomPointerDown(event) {
  if (!isFocusMode() || event.pointerType !== 'touch') return;
  if (event.target.closest('.mobile-dock, .mobile-corner-actions')) return;
  focusZoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  beginFocusPinchIfReady();
  if (focusPinch) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function handleFocusZoomPointerMove(event) {
  if (!focusZoomPointers.has(event.pointerId)) return;
  focusZoomPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  updateFocusPinch(event);
}

function finishFocusZoomPointer(event) {
  if (!focusZoomPointers.has(event.pointerId)) return;
  focusZoomPointers.delete(event.pointerId);
  if (focusZoomPointers.size < 2) {
    focusPinch = null;
    document.body.classList.remove('is-focus-pinching');
  }
}

document.querySelector('.canvas-wrap')?.addEventListener('pointerdown', handleFocusZoomPointerDown, { capture: true });
document.querySelector('.canvas-wrap')?.addEventListener('wheel', handleFocusWheelZoom, { passive: false });
document.addEventListener('pointermove', handleFocusZoomPointerMove, { passive: false });
document.addEventListener('pointerup', finishFocusZoomPointer);
document.addEventListener('pointercancel', finishFocusZoomPointer);

mobileDockHandle?.addEventListener('pointerdown', (event) => {
  if (!isFocusMode()) return;
  event.preventDefault();
  const rect = mobileDock.getBoundingClientRect();
  focusDockDrag = {
    pointerId: event.pointerId,
    dx: event.clientX - rect.left,
    dy: event.clientY - rect.top
  };
  mobileDockHandle.setPointerCapture?.(event.pointerId);
});

mobileDockHandle?.addEventListener('pointermove', (event) => {
  if (!focusDockDrag || focusDockDrag.pointerId !== event.pointerId) return;
  event.preventDefault();
  setFocusDockPosition(event.clientX - focusDockDrag.dx, event.clientY - focusDockDrag.dy);
});

function endFocusDockDrag(event) {
  if (!focusDockDrag || focusDockDrag.pointerId !== event.pointerId) return;
  focusDockDrag = null;
}

mobileDockHandle?.addEventListener('pointerup', endFocusDockDrag);
mobileDockHandle?.addEventListener('pointercancel', endFocusDockDrag);

async function startApp() {
  syncFullscreenButtons();
  syncMobileDockPanels();
  syncBookOverviewView();
  setupSharedBookMessageImport();
  const loadedSharedLink = await loadSharedLinkFromUrl();
  if (!loadedSharedLink) loadInitialState();
  if (isMobileLayout()) {
    window.requestAnimationFrame(() => setFocusMode(true));
  }
}

startApp();
