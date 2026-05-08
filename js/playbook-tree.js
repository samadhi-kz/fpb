// Playbook tree rendering, drag/drop helpers, and tree event handlers.
const MOBILE_BOOK_LONG_PRESS_MS = 360;
const MOBILE_BOOK_DRAG_CANCEL_PX = 10;

function treeActionButton(action, text, title, dataset = {}, danger = false) {
  const button = document.createElement('button');
  button.className = `tree-action${danger ? ' danger' : ''}`;
  button.type = 'button';
  button.dataset.playbookAction = action;
  Object.entries(dataset).forEach(([key, value]) => { button.dataset[key] = value; });
  button.title = title;
  button.textContent = text;
  return button;
}

function renderPlaybookSelectors() {
  controls.playbookTree.replaceChildren();

  state.playbook.folders.forEach((folder) => {
    const folderNode = document.createElement('div');
    folderNode.className = 'tree-folder';
    folderNode.setAttribute('role', 'group');

    const isOpen = state.openFolderIds.has(folder.id);
    const isActiveFolder = folder.id === state.activeFolderId;
    const folderRow = document.createElement('div');
    folderRow.className = `tree-row tree-folder-row${isActiveFolder ? ' is-folder-active' : ''}`;
    folderRow.dataset.folderId = folder.id;
    folderRow.dataset.dragKind = 'folder';
    folderRow.draggable = true;
    folderRow.setAttribute('role', 'treeitem');
    folderRow.setAttribute('aria-expanded', String(isOpen));
    folderRow.title = 'Drag to reorder folder';

    const toggle = document.createElement('button');
    toggle.className = 'tree-toggle';
    toggle.type = 'button';
    toggle.dataset.playbookAction = 'toggle-folder';
    toggle.dataset.folderId = folder.id;
    toggle.title = isOpen ? '閉じる' : '開く';
    toggle.textContent = isOpen ? '▾' : '▸';

    const label = document.createElement('button');
    label.className = 'tree-label tree-folder-label';
    label.type = 'button';
    label.dataset.playbookAction = 'select-folder';
    label.dataset.folderId = folder.id;
    const folderIcon = document.createElement('span');
    folderIcon.className = 'tree-icon';
    folderIcon.textContent = '□';
    const folderName = document.createElement('span');
    folderName.className = 'tree-name';
    folderName.textContent = folder.name;
    label.append(folderIcon, folderName);

    const actions = document.createElement('div');
    actions.className = 'tree-actions';
    actions.append(
      treeActionButton('new-play', '+', 'Add a play to this folder', { folderId: folder.id }),
      treeActionButton('rename-folder', '✎', 'Rename folder', { folderId: folder.id }),
      treeActionButton('delete-folder', '×', 'Delete folder', { folderId: folder.id }, true)
    );
    folderRow.append(toggle, label, actions);
    folderNode.append(folderRow);

    if (isOpen) {
      const children = document.createElement('div');
      children.className = 'tree-children';
      if (!folder.plays.length) {
        const empty = document.createElement('div');
        empty.className = 'tree-empty';
        empty.textContent = 'Empty';
        children.append(empty);
      }
      folder.plays.forEach((play) => {
        const isActivePlay = isActiveFolder && play.id === state.activePlayId;
        const playRow = document.createElement('div');
        playRow.className = `tree-row tree-play-row${isActivePlay ? ' is-active' : ''}`;
        playRow.dataset.folderId = folder.id;
        playRow.dataset.playId = play.id;
        playRow.dataset.dragKind = 'play';
        playRow.draggable = true;
        playRow.setAttribute('role', 'treeitem');
        playRow.title = 'Drag to reorder play or move between folders';

        const spacer = document.createElement('span');
        spacer.className = 'tree-spacer';
        spacer.textContent = '⋮';

        const playLabel = document.createElement('button');
        playLabel.className = 'tree-label tree-play-label';
        playLabel.type = 'button';
        playLabel.dataset.playbookAction = 'select-play';
        playLabel.dataset.folderId = folder.id;
        playLabel.dataset.playId = play.id;
        const playIcon = document.createElement('span');
        playIcon.className = 'tree-icon';
        playIcon.textContent = '•';
        const playName = document.createElement('span');
        playName.className = 'tree-name';
        playName.textContent = play.name || 'Untitled';
        playLabel.append(playIcon, playName);

        const playActions = document.createElement('div');
        playActions.className = 'tree-actions';
        playActions.append(
          treeActionButton('rename-play', '✎', 'Rename play', { folderId: folder.id, playId: play.id }),
          treeActionButton('duplicate-play', '⧉', 'Duplicate', { folderId: folder.id, playId: play.id }),
          treeActionButton('delete-play', '×', 'Delete', { folderId: folder.id, playId: play.id }, true)
        );

        playRow.append(spacer, playLabel, playActions);
        children.append(playRow);
      });
      folderNode.append(children);
    }

    controls.playbookTree.append(folderNode);
  });
  renderDesktopPlaybookPreview();
  renderMobilePlaybookSelectors();
}

function appendPreviewRoute(svg, route) {
  if (!route.points || route.points.length < 2) return;
  const style = normalizeRouteStyle(route);
  const path = svgEl('path', {
    class: `mobile-preview-route ${route.type || 'route'}`,
    d: routePath(route),
    fill: 'none',
    stroke: style.color,
    'stroke-width': Math.max(8, style.width * 1.4),
    opacity: style.opacity,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  });
  if (route.type === 'pass') path.setAttribute('stroke-dasharray', '18 16');
  svg.append(path);
}

function previewPlayerFill(play, player, defender = false) {
  if (defender) return '#d8d8d8';
  const mark = play.playerMarks?.[player.id] || play.playerMarks?.[player.label] || '';
  if (mark === 'ring') return '#2f6fed';
  if (mark === 'star') return '#e71932';
  if (mark === 'diamond') return '#f3b43f';
  if (mark === 'square') return '#008579';
  return player.role === 'qb' ? '#00685f' : '#008579';
}

function createMobilePlayPreviewSvg(play) {
  const svg = svgEl('svg', {
    class: 'mobile-play-preview',
    viewBox: '0 0 1000 720',
    'aria-hidden': 'true'
  });
  svg.append(svgEl('rect', { class: 'mobile-preview-bg', x: 0, y: 0, width: 1000, height: 720 }));
  if (play.sourceImage) {
    svg.append(svgEl('image', {
      href: play.sourceImage,
      x: 140,
      y: 0,
      width: 720,
      height: 720,
      preserveAspectRatio: 'xMidYMid meet'
    }));
    return svg;
  }
  svg.append(svgEl('line', {
    class: 'mobile-preview-los',
    x1: FIELD_DIMENSIONS.left,
    y1: FIELD_DIMENSIONS.scrimmageY,
    x2: FIELD_DIMENSIONS.right,
    y2: FIELD_DIMENSIONS.scrimmageY
  }));
  (play.routes || []).forEach((route) => appendPreviewRoute(svg, route));
  if (play.defenseVisible !== false) {
    (play.defenders || []).forEach((defender) => {
      svg.append(svgEl('circle', {
        class: 'mobile-preview-defender',
        cx: defender.x,
        cy: defender.y,
        r: 24,
        fill: previewPlayerFill(play, defender, true)
      }));
    });
  }
  (play.players || []).forEach((player) => {
    svg.append(svgEl('circle', {
      class: 'mobile-preview-player',
      cx: player.x,
      cy: player.y,
      r: 27,
      fill: previewPlayerFill(play, player)
    }));
    const label = svgEl('text', {
      class: 'mobile-preview-player-text',
      x: player.x,
      y: player.y + 6
    });
    label.textContent = player.label;
    svg.append(label);
  });
  return svg;
}

function focusSelectedPlayForEditing() {
  if (typeof setBookOverviewOpen === 'function') setBookOverviewOpen(false, { quiet: true });
  if (typeof setMobileDockPanel === 'function') setMobileDockPanel('');
  if (document.body.classList.contains('is-focus-mode') && typeof centerFocusCanvas === 'function') {
    window.requestAnimationFrame(() => centerFocusCanvas());
  }
}

function renderDesktopPlaybookPreview() {
  if (!controls.playbookPreview) return;
  controls.playbookPreview.replaceChildren();
  if (controls.bookOverviewCount) {
    const playCount = state.playbook.folders.reduce((total, folder) => total + folder.plays.length, 0);
    controls.bookOverviewCount.textContent = `${state.playbook.folders.length} Folder / ${playCount} Play`;
  }

  state.playbook.folders.forEach((folder) => {
    const isActiveFolder = folder.id === state.activeFolderId;
    const folderGroup = document.createElement('section');
    folderGroup.className = `playbook-preview-folder${isActiveFolder ? ' is-active' : ''}`;

    const folderHeader = document.createElement('button');
    folderHeader.className = `playbook-preview-folder-header${isActiveFolder ? ' is-active' : ''}`;
    folderHeader.type = 'button';
    folderHeader.draggable = true;
    folderHeader.dataset.previewAction = 'select-folder';
    folderHeader.dataset.dragKind = 'folder';
    folderHeader.dataset.folderId = folder.id;
    folderHeader.title = 'Drag to reorder folder';
    folderHeader.append(
      Object.assign(document.createElement('span'), {
        className: 'playbook-preview-folder-name',
        textContent: folder.name || 'Folder'
      }),
      Object.assign(document.createElement('span'), {
        className: 'playbook-preview-folder-count',
        textContent: `${folder.plays.length} Play${folder.plays.length === 1 ? '' : 's'}`
      })
    );

    const grid = document.createElement('div');
    grid.className = 'playbook-preview-grid';
    if (!folder.plays.length) {
      const empty = document.createElement('div');
      empty.className = 'playbook-preview-empty';
      empty.textContent = 'Empty';
      grid.append(empty);
    }

    folder.plays.forEach((play) => {
      const isActivePlay = isActiveFolder && play.id === state.activePlayId;
      const card = document.createElement('button');
      card.className = `playbook-preview-card${isActivePlay ? ' is-active' : ''}`;
      card.type = 'button';
      card.draggable = true;
      card.dataset.previewAction = 'select-play';
      card.dataset.dragKind = 'play';
      card.dataset.folderId = folder.id;
      card.dataset.playId = play.id;
      card.title = `Open ${play.name || 'Untitled'}`;
      card.setAttribute('aria-label', `Open ${play.name || 'Untitled'}`);
      card.append(createMobilePlayPreviewSvg(play));
      const name = document.createElement('span');
      name.className = 'playbook-preview-play-name';
      name.textContent = play.name || 'Untitled';
      card.append(name);
      grid.append(card);
    });

    folderGroup.append(folderHeader, grid);
    controls.playbookPreview.append(folderGroup);
  });
}

function createMobileBookActions() {
  const actions = document.createElement('div');
  actions.className = 'mobile-book-actions';

  const playButton = document.createElement('button');
  playButton.className = 'mobile-book-add-button';
  playButton.type = 'button';
  playButton.dataset.mobilePlaybookAction = 'new-play';
  playButton.textContent = '+ Play';

  const folderButton = document.createElement('button');
  folderButton.className = 'mobile-book-add-button';
  folderButton.type = 'button';
  folderButton.dataset.mobilePlaybookAction = 'new-folder';
  folderButton.textContent = '+ Folder';

  const loadButton = document.createElement('button');
  loadButton.className = 'mobile-book-add-button mobile-book-load-button';
  loadButton.type = 'button';
  loadButton.dataset.mobilePlaybookAction = 'load-json';
  loadButton.title = 'Load playbook JSON';
  loadButton.textContent = 'Load JSON';

  const addButton = document.createElement('button');
  addButton.className = 'mobile-book-add-button mobile-book-add-json-button';
  addButton.type = 'button';
  addButton.dataset.mobilePlaybookAction = 'add-json';
  addButton.title = 'Add folders from JSON';
  addButton.textContent = 'Add JSON';

  actions.append(playButton, folderButton, loadButton, addButton);
  return actions;
}

function mobileBookControl(action, text, title, dataset = {}, danger = false, disabled = false) {
  const button = document.createElement('button');
  button.className = `mobile-book-control-button${danger ? ' danger' : ''}`;
  button.type = 'button';
  button.dataset.mobilePlaybookAction = action;
  Object.entries(dataset).forEach(([key, value]) => { button.dataset[key] = value; });
  button.title = title;
  button.setAttribute('aria-label', title);
  button.disabled = disabled;
  button.textContent = text;
  return button;
}

function renderMobilePlaybookSelectors() {
  if (!controls.mobilePlaybookList) return;
  controls.mobilePlaybookList.replaceChildren();
  controls.mobilePlaybookList.append(createMobileBookActions());

  const previewSection = document.createElement('section');
  previewSection.className = 'mobile-book-section';
  const previewTitle = document.createElement('div');
  previewTitle.className = 'mobile-book-section-title';
  previewTitle.textContent = 'Plays';
  const previewGrid = document.createElement('div');
  previewGrid.className = 'mobile-play-preview-grid';

  state.playbook.folders.forEach((folder) => {
    const folderGroup = document.createElement('div');
    const isActiveFolder = folder.id === state.activeFolderId;
    folderGroup.className = `mobile-play-preview-folder-group${isActiveFolder ? ' is-active' : ''}`;

    const folderLabel = document.createElement('div');
    folderLabel.className = 'mobile-play-preview-folder-label';
    folderLabel.textContent = folder.name || 'Folder';

    const folderGrid = document.createElement('div');
    folderGrid.className = 'mobile-play-preview-folder-grid';
    if (!folder.plays.length) {
      const empty = document.createElement('div');
      empty.className = 'mobile-book-empty mobile-play-preview-empty';
      empty.textContent = 'Empty';
      folderGrid.append(empty);
    }

    folder.plays.forEach((play) => {
      const isActivePlay = isActiveFolder && play.id === state.activePlayId;
      const button = document.createElement('button');
      button.className = `mobile-play-preview-card${isActivePlay ? ' is-active' : ''}`;
      button.type = 'button';
      button.dataset.mobilePlaybookAction = 'select-play';
      button.dataset.folderId = folder.id;
      button.dataset.playId = play.id;
      button.title = `Load ${play.name || 'Untitled'}`;
      button.setAttribute('aria-label', `Load ${play.name || 'Untitled'}`);
      button.append(createMobilePlayPreviewSvg(play));
      const title = document.createElement('span');
      title.className = 'mobile-play-preview-title';
      title.textContent = play.name || 'Untitled';
      const loadLabel = document.createElement('span');
      loadLabel.className = 'mobile-play-preview-load';
      loadLabel.textContent = isActivePlay ? 'Loaded' : 'Load';
      button.append(title, loadLabel);
      folderGrid.append(button);
    });

    folderGroup.append(folderLabel, folderGrid);
    previewGrid.append(folderGroup);
  });

  previewSection.append(previewTitle, previewGrid);
  controls.mobilePlaybookList.append(previewSection);

  const treeSection = document.createElement('section');
  treeSection.className = 'mobile-book-section';
  const treeTitle = document.createElement('div');
  treeTitle.className = 'mobile-book-section-title';
  treeTitle.textContent = 'Tree';
  treeSection.append(treeTitle);

  state.playbook.folders.forEach((folder, folderIndex) => {
    const folderBlock = document.createElement('div');
    folderBlock.className = 'mobile-book-folder';
    const isOpen = state.openFolderIds.has(folder.id);
    const isActiveFolder = folder.id === state.activeFolderId;

    const folderHeader = document.createElement('div');
    folderHeader.className = 'mobile-book-folder-header';
    folderHeader.dataset.dragKind = 'folder';
    folderHeader.dataset.folderId = folder.id;

    const folderButton = document.createElement('button');
    folderButton.className = `mobile-book-folder-button${isActiveFolder ? ' is-active' : ''}`;
    folderButton.type = 'button';
    folderButton.dataset.mobilePlaybookAction = 'toggle-folder';
    folderButton.dataset.folderId = folder.id;
    folderButton.textContent = `${isOpen ? '▾' : '▸'} ${folder.name}`;

    const folderActions = document.createElement('div');
    folderActions.className = 'mobile-book-inline-actions';
    folderActions.append(
      mobileBookControl('move-folder', '↑', 'Move folder up', { folderId: folder.id, direction: '-1' }, false, folderIndex === 0),
      mobileBookControl('move-folder', '↓', 'Move folder down', { folderId: folder.id, direction: '1' }, false, folderIndex === state.playbook.folders.length - 1),
      mobileBookControl('delete-folder', '×', 'Delete folder', { folderId: folder.id }, true, state.playbook.folders.length <= 1)
    );

    folderHeader.append(folderButton, folderActions);
    folderBlock.append(folderHeader);

    if (isOpen) {
      const playList = document.createElement('div');
      playList.className = 'mobile-book-play-list';
      if (!folder.plays.length) {
        const empty = document.createElement('div');
        empty.className = 'mobile-book-empty';
        empty.textContent = 'Empty';
        playList.append(empty);
      }
      folder.plays.forEach((play, playIndex) => {
        const isActivePlay = isActiveFolder && play.id === state.activePlayId;
        const playItem = document.createElement('div');
        playItem.className = 'mobile-book-play-item';
        playItem.dataset.dragKind = 'play';
        playItem.dataset.folderId = folder.id;
        playItem.dataset.playId = play.id;

        const playButton = document.createElement('button');
        playButton.className = `mobile-book-play-button${isActivePlay ? ' is-active' : ''}`;
        playButton.type = 'button';
        playButton.dataset.mobilePlaybookAction = 'select-play';
        playButton.dataset.folderId = folder.id;
        playButton.dataset.playId = play.id;
        playButton.textContent = play.name || 'Untitled';

        const playActions = document.createElement('div');
        playActions.className = 'mobile-book-inline-actions';
        const upDisabled = playIndex === 0 && folderIndex === 0;
        const downDisabled = playIndex === folder.plays.length - 1 && folderIndex === state.playbook.folders.length - 1;
        playActions.append(
          mobileBookControl('move-play', '↑', 'Move play up or to previous folder', { folderId: folder.id, playId: play.id, direction: '-1' }, false, upDisabled),
          mobileBookControl('move-play', '↓', 'Move play down or to next folder', { folderId: folder.id, playId: play.id, direction: '1' }, false, downDisabled),
          mobileBookControl('delete-play', '×', 'Delete play', { folderId: folder.id, playId: play.id }, true, totalPlayCount() <= 1)
        );

        playItem.append(playButton, playActions);
        playList.append(playItem);
      });
      folderBlock.append(playList);
    }

    treeSection.append(folderBlock);
  });

  controls.mobilePlaybookList.append(treeSection);
}

function handleMobilePlaybookClick(event) {
  if (state.suppressMobileBookClick) {
    event.preventDefault();
    state.suppressMobileBookClick = false;
    return;
  }
  const button = event.target.closest('[data-mobile-playbook-action]');
  if (!button || !controls.mobilePlaybookList?.contains(button)) return;
  const { mobilePlaybookAction, folderId, playId } = button.dataset;
  if (mobilePlaybookAction === 'toggle-folder') {
    if (state.openFolderIds.has(folderId)) state.openFolderIds.delete(folderId);
    else state.openFolderIds.add(folderId);
    render();
  }
  if (mobilePlaybookAction === 'new-play') {
    createNewPlay();
    focusSelectedPlayForEditing();
  }
  if (mobilePlaybookAction === 'new-folder') {
    createNewFolder();
    focusSelectedPlayForEditing();
  }
  if (mobilePlaybookAction === 'load-json') {
    openPlaysetFile();
  }
  if (mobilePlaybookAction === 'add-json') {
    openAddPlaysetFile();
  }
  if (mobilePlaybookAction === 'move-folder') {
    moveFolderByStep(folderId, Number(button.dataset.direction));
  }
  if (mobilePlaybookAction === 'delete-folder') {
    deleteFolderById(folderId);
  }
  if (mobilePlaybookAction === 'move-play') {
    movePlayByStep(folderId, playId, Number(button.dataset.direction));
  }
  if (mobilePlaybookAction === 'delete-play') {
    deletePlayById(folderId, playId);
  }
  if (mobilePlaybookAction === 'select-play') {
    selectPlay(folderId, playId);
    focusSelectedPlayForEditing();
  }
}

function mobileBookPayloadFromRow(row) {
  if (!row?.dataset.dragKind) return null;
  return {
    kind: row.dataset.dragKind,
    folderId: row.dataset.folderId,
    playId: row.dataset.playId || null
  };
}

function mobileBookFolderHeaderForRow(row) {
  if (row.classList.contains('mobile-book-folder-header')) return row;
  return row.closest('.mobile-book-folder')?.querySelector('.mobile-book-folder-header') || null;
}

function mobileBookDropPosition(clientY, row) {
  const rect = row.getBoundingClientRect();
  return clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

function mobileBookDropRowFromPoint(clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  if (!element || !controls.mobilePlaybookList?.contains(element)) return null;
  const row = element.closest('.mobile-book-folder-header, .mobile-book-play-item');
  if (row) return row;
  return element.closest('.mobile-book-empty')?.closest('.mobile-book-folder')?.querySelector('.mobile-book-folder-header') || null;
}

function mobileBookDropTargetFromPoint(clientX, clientY) {
  const drag = state.mobileBookDrag?.payload;
  if (!drag) return null;
  const row = mobileBookDropRowFromPoint(clientX, clientY);
  if (!row || !controls.mobilePlaybookList?.contains(row)) return null;

  if (drag.kind === 'folder') {
    const folderRow = mobileBookFolderHeaderForRow(row);
    if (!folderRow || folderRow.dataset.folderId === drag.folderId) return null;
    return {
      kind: 'folder',
      row: folderRow,
      folderId: folderRow.dataset.folderId,
      position: mobileBookDropPosition(clientY, folderRow)
    };
  }

  if (drag.kind === 'play') {
    if (row.classList.contains('mobile-book-folder-header')) {
      return {
        kind: 'folder',
        row,
        folderId: row.dataset.folderId,
        position: 'inside'
      };
    }

    if (row.classList.contains('mobile-book-play-item') && row.dataset.playId !== drag.playId) {
      return {
        kind: 'play',
        row,
        folderId: row.dataset.folderId,
        playId: row.dataset.playId,
        position: mobileBookDropPosition(clientY, row)
      };
    }
  }

  return null;
}

function clearMobileBookDropIndicators(includeDragging = false) {
  if (!controls.mobilePlaybookList) return;
  controls.mobilePlaybookList
    .querySelectorAll('.is-mobile-drop-before, .is-mobile-drop-after, .is-mobile-drop-into')
    .forEach((row) => row.classList.remove('is-mobile-drop-before', 'is-mobile-drop-after', 'is-mobile-drop-into'));
  if (includeDragging) {
    controls.mobilePlaybookList
      .querySelectorAll('.is-mobile-book-dragging')
      .forEach((row) => row.classList.remove('is-mobile-book-dragging'));
  }
}

function markMobileBookDropTarget(target) {
  if (!target) return;
  if (target.position === 'before') target.row.classList.add('is-mobile-drop-before');
  else if (target.position === 'after') target.row.classList.add('is-mobile-drop-after');
  else target.row.classList.add('is-mobile-drop-into');
}

function updateMobileBookDragTarget(clientX, clientY) {
  const drag = state.mobileBookDrag;
  if (!drag?.dragging) return;
  clearMobileBookDropIndicators();
  drag.target = mobileBookDropTargetFromPoint(clientX, clientY);
  markMobileBookDropTarget(drag.target);
}

function scrollMobileBookPanelDuringDrag(clientY) {
  const panel = controls.mobilePlaybookList?.closest('.mobile-book-row');
  if (!panel) return;
  const rect = panel.getBoundingClientRect();
  const edge = 44;
  if (clientY < rect.top + edge) panel.scrollTop -= 14;
  else if (clientY > rect.bottom - edge) panel.scrollTop += 14;
}

function suppressMobileBookClickAfterDrag() {
  state.suppressMobileBookClick = true;
  window.setTimeout(() => {
    state.suppressMobileBookClick = false;
  }, 600);
}

function cancelMobileBookLongPress() {
  if (!state.mobileBookDrag) return;
  window.clearTimeout(state.mobileBookDrag.timerId);
  state.mobileBookDrag = null;
  document.body.classList.remove('is-mobile-book-long-drag');
}

function mobileBookDragRowFromTarget(target) {
  if (target.closest('.mobile-book-inline-actions, .mobile-book-add-button, .mobile-play-preview-card')) return null;
  const row = target.closest('.mobile-book-folder-header, .mobile-book-play-item');
  if (!row || !controls.mobilePlaybookList?.contains(row)) return null;
  return row;
}

function beginMobileBookLongPress(row, pointerId, clientX, clientY, touchIdentifier = null) {
  const payload = mobileBookPayloadFromRow(row);
  if (!payload) return;

  cancelMobileBookLongPress();
  state.mobileBookDrag = {
    pointerId,
    touchIdentifier,
    row,
    payload,
    startX: clientX,
    startY: clientY,
    lastX: clientX,
    lastY: clientY,
    timerId: 0,
    dragging: false,
    target: null
  };
  state.mobileBookDrag.timerId = window.setTimeout(
    () => startMobileBookLongDrag(pointerId),
    MOBILE_BOOK_LONG_PRESS_MS
  );
}

function startMobileBookLongDrag(pointerId) {
  const drag = state.mobileBookDrag;
  if (!drag || drag.pointerId !== pointerId) return;
  drag.dragging = true;
  drag.row.classList.add('is-mobile-book-dragging');
  document.body.classList.add('is-mobile-book-long-drag');
  suppressMobileBookClickAfterDrag();
  updateMobileBookDragTarget(drag.lastX, drag.lastY);
  setStatus('Drag to Move');
}

function handleMobilePlaybookPointerDown(event) {
  if (event.button !== undefined && event.button !== 0) return;
  const row = mobileBookDragRowFromTarget(event.target);
  if (!row) return;
  beginMobileBookLongPress(row, event.pointerId, event.clientX, event.clientY);
}

function handleMobilePlaybookPointerMove(event) {
  const drag = state.mobileBookDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;

  if (!drag.dragging) {
    const moved = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (moved > MOBILE_BOOK_DRAG_CANCEL_PX) cancelMobileBookLongPress();
    return;
  }

  event.preventDefault();
  scrollMobileBookPanelDuringDrag(event.clientY);
  updateMobileBookDragTarget(event.clientX, event.clientY);
}

function finishMobileBookDrag(event, cancelled = false) {
  const drag = state.mobileBookDrag;
  if (!drag) return;
  window.clearTimeout(drag.timerId);

  const wasDragging = drag.dragging;
  const payload = drag.payload;
  const target = cancelled ? null : (drag.target || mobileBookDropTargetFromPoint(drag.lastX, drag.lastY));
  clearMobileBookDropIndicators(true);
  state.mobileBookDrag = null;
  document.body.classList.remove('is-mobile-book-long-drag');

  if (!wasDragging) return;
  if (event.cancelable !== false) event.preventDefault();
  suppressMobileBookClickAfterDrag();
  if (!target) {
    setStatus('Move Cancelled');
    return;
  }
  if (payload.kind === 'folder') moveFolderByDrop(payload, target);
  if (payload.kind === 'play') movePlayByDrop(payload, target);
}

function finishMobileBookPointerDrag(event, cancelled = false) {
  const drag = state.mobileBookDrag;
  if (!drag || drag.pointerId !== event.pointerId) return;
  finishMobileBookDrag(event, cancelled);
}

function handleMobilePlaybookPointerUp(event) {
  finishMobileBookPointerDrag(event);
}

function handleMobilePlaybookPointerCancel(event) {
  finishMobileBookPointerDrag(event, true);
}

function handleMobilePlaybookContextMenu(event) {
  if (!state.mobileBookDrag) return;
  event.preventDefault();
}

function mobileBookTouchId(touch) {
  return `touch-${touch.identifier}`;
}

function mobileBookTouchFromList(list, identifier) {
  return Array.from(list || []).find((touch) => touch.identifier === identifier) || null;
}

function handleMobilePlaybookTouchStart(event) {
  if (event.touches.length !== 1) return;
  const touch = event.changedTouches[0];
  if (!touch) return;
  const row = mobileBookDragRowFromTarget(event.target);
  if (!row) return;
  beginMobileBookLongPress(row, mobileBookTouchId(touch), touch.clientX, touch.clientY, touch.identifier);
}

function handleMobilePlaybookTouchMove(event) {
  const drag = state.mobileBookDrag;
  if (!drag || drag.touchIdentifier === null) return;
  const touch = mobileBookTouchFromList(event.touches, drag.touchIdentifier);
  if (!touch) return;

  drag.lastX = touch.clientX;
  drag.lastY = touch.clientY;

  if (!drag.dragging) {
    const moved = Math.hypot(touch.clientX - drag.startX, touch.clientY - drag.startY);
    if (moved > MOBILE_BOOK_DRAG_CANCEL_PX) cancelMobileBookLongPress();
    return;
  }

  event.preventDefault();
  scrollMobileBookPanelDuringDrag(touch.clientY);
  updateMobileBookDragTarget(touch.clientX, touch.clientY);
}

function finishMobileBookTouchDrag(event, cancelled = false) {
  const drag = state.mobileBookDrag;
  if (!drag || drag.touchIdentifier === null) return;
  const touch = mobileBookTouchFromList(event.changedTouches, drag.touchIdentifier);
  if (!touch) return;
  drag.lastX = touch.clientX;
  drag.lastY = touch.clientY;
  finishMobileBookDrag(event, cancelled);
}

function clearTreeDropIndicators(includeDragging = false) {
  controls.playbookTree.querySelectorAll('.is-drop-before, .is-drop-after, .is-drop-into')
    .forEach((row) => row.classList.remove('is-drop-before', 'is-drop-after', 'is-drop-into'));
  if (includeDragging) {
    controls.playbookTree.querySelectorAll('.is-dragging')
      .forEach((row) => row.classList.remove('is-dragging'));
  }
}

function treePayloadFromRow(row) {
  if (!row?.dataset.dragKind) return null;
  return {
    kind: row.dataset.dragKind,
    folderId: row.dataset.folderId,
    playId: row.dataset.playId || null
  };
}

function dropPositionForRow(event, row) {
  const rect = row.getBoundingClientRect();
  return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
}

function folderRowForTreeRow(row) {
  if (row.classList.contains('tree-folder-row')) return row;
  return row.closest('.tree-folder')?.querySelector('.tree-folder-row') || null;
}

function treeDropTargetFromEvent(event) {
  const drag = state.treeDrag;
  if (!drag) return null;

  let row = event.target.closest('.tree-row');
  if (!row) row = event.target.closest('.tree-empty')?.closest('.tree-folder')?.querySelector('.tree-folder-row');
  if (!row || !controls.playbookTree.contains(row)) return null;

  if (drag.kind === 'folder') {
    const folderRow = folderRowForTreeRow(row);
    if (!folderRow || folderRow.dataset.folderId === drag.folderId) return null;
    return {
      kind: 'folder',
      row: folderRow,
      folderId: folderRow.dataset.folderId,
      position: dropPositionForRow(event, folderRow)
    };
  }

  if (drag.kind === 'play') {
    if (row.classList.contains('tree-folder-row')) {
      return {
        kind: 'folder',
        row,
        folderId: row.dataset.folderId,
        position: 'inside'
      };
    }

    if (row.classList.contains('tree-play-row') && row.dataset.playId !== drag.playId) {
      return {
        kind: 'play',
        row,
        folderId: row.dataset.folderId,
        playId: row.dataset.playId,
        position: dropPositionForRow(event, row)
      };
    }
  }

  return null;
}

function markTreeDropTarget(target) {
  if (!target) return;
  if (target.position === 'before') target.row.classList.add('is-drop-before');
  else if (target.position === 'after') target.row.classList.add('is-drop-after');
  else target.row.classList.add('is-drop-into');
}

function suppressTreeClickAfterDrop() {
  state.suppressTreeClick = true;
  window.setTimeout(() => {
    state.suppressTreeClick = false;
  }, 0);
}

function moveFolderByDrop(drag, target) {
  const folders = state.playbook.folders;
  const fromIndex = folders.findIndex((folder) => folder.id === drag.folderId);
  if (fromIndex === -1 || drag.folderId === target.folderId) return;

  saveLocal(false);
  const [folder] = folders.splice(fromIndex, 1);
  const targetIndex = folders.findIndex((item) => item.id === target.folderId);
  if (targetIndex === -1) {
    folders.splice(fromIndex, 0, folder);
    return;
  }

  folders.splice(target.position === 'after' ? targetIndex + 1 : targetIndex, 0, folder);
  saveLocal(true);
  setStatus('Folder Moved');
}

function movePlayByDrop(drag, target) {
  const sourceFolder = folderById(drag.folderId);
  const targetFolder = folderById(target.folderId);
  if (!sourceFolder || !targetFolder) return;

  saveLocal(false);
  const fromIndex = sourceFolder.plays.findIndex((play) => play.id === drag.playId);
  if (fromIndex === -1) return;

  const [play] = sourceFolder.plays.splice(fromIndex, 1);
  let insertIndex = targetFolder.plays.length;
  if (target.kind === 'play') {
    const targetIndex = targetFolder.plays.findIndex((item) => item.id === target.playId);
    if (targetIndex !== -1) insertIndex = target.position === 'after' ? targetIndex + 1 : targetIndex;
  }

  targetFolder.plays.splice(insertIndex, 0, play);
  state.openFolderIds.add(targetFolder.id);
  const movedActivePlay = state.activePlayId === play.id;
  const movedIntoActiveEmptyFolder = !state.activePlayId && state.activeFolderId === targetFolder.id;
  if (movedIntoActiveEmptyFolder) {
    state.activeFolderId = targetFolder.id;
    state.activePlayId = play.id;
    applyPlay(play);
    saveLocal(true);
    setStatus(sourceFolder === targetFolder ? 'Play Reordered' : 'Play Moved');
    return;
  }

  if (movedActivePlay) state.activeFolderId = targetFolder.id;

  saveLocal(true);
  render();
  setStatus(sourceFolder === targetFolder ? 'Play Reordered' : 'Play Moved');
}

function clearPreviewDropIndicators(includeDragging = false) {
  controls.playbookPreview?.querySelectorAll('.is-preview-drop-before, .is-preview-drop-after, .is-preview-drop-into')
    .forEach((row) => row.classList.remove('is-preview-drop-before', 'is-preview-drop-after', 'is-preview-drop-into'));
  if (includeDragging) {
    controls.playbookPreview?.querySelectorAll('.is-preview-dragging')
      .forEach((row) => row.classList.remove('is-preview-dragging'));
  }
}

function previewDropPosition(event, row) {
  const rect = row.getBoundingClientRect();
  if (row.classList.contains('playbook-preview-folder-header')) {
    return event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
  }
  return event.clientX < rect.left + rect.width / 2 ? 'before' : 'after';
}

function previewFolderHeaderForElement(element) {
  if (!element) return null;
  if (element.classList.contains('playbook-preview-folder-header')) return element;
  return element.closest('.playbook-preview-folder')?.querySelector('.playbook-preview-folder-header') || null;
}

function previewDropTargetFromEvent(event) {
  const drag = state.previewDrag;
  if (!drag || !controls.playbookPreview) return null;

  let row = event.target.closest('.playbook-preview-folder-header, .playbook-preview-card');
  if (!row) row = event.target.closest('.playbook-preview-empty');
  if (!row || !controls.playbookPreview.contains(row)) return null;

  if (drag.kind === 'folder') {
    const folderHeader = previewFolderHeaderForElement(row);
    if (!folderHeader || folderHeader.dataset.folderId === drag.folderId) return null;
    return {
      kind: 'folder',
      row: folderHeader,
      folderId: folderHeader.dataset.folderId,
      position: previewDropPosition(event, folderHeader)
    };
  }

  if (drag.kind === 'play') {
    if (row.classList.contains('playbook-preview-folder-header') || row.classList.contains('playbook-preview-empty')) {
      const folderHeader = previewFolderHeaderForElement(row);
      if (!folderHeader) return null;
      return {
        kind: 'folder',
        row: folderHeader,
        folderId: folderHeader.dataset.folderId,
        position: 'inside'
      };
    }

    if (row.classList.contains('playbook-preview-card') && row.dataset.playId !== drag.playId) {
      return {
        kind: 'play',
        row,
        folderId: row.dataset.folderId,
        playId: row.dataset.playId,
        position: previewDropPosition(event, row)
      };
    }
  }

  return null;
}

function markPreviewDropTarget(target) {
  if (!target) return;
  if (target.position === 'before') target.row.classList.add('is-preview-drop-before');
  else if (target.position === 'after') target.row.classList.add('is-preview-drop-after');
  else target.row.classList.add('is-preview-drop-into');
}

function suppressPreviewClickAfterDrop() {
  state.suppressPreviewClick = true;
  window.setTimeout(() => {
    state.suppressPreviewClick = false;
  }, 0);
}

function handlePlaybookPreviewDragStart(event) {
  const row = event.target.closest('.playbook-preview-folder-header[draggable="true"], .playbook-preview-card[draggable="true"]');
  if (!row || !controls.playbookPreview?.contains(row)) {
    event.preventDefault();
    return;
  }

  state.previewDrag = treePayloadFromRow(row);
  if (!state.previewDrag) {
    event.preventDefault();
    return;
  }

  row.classList.add('is-preview-dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', JSON.stringify(state.previewDrag));
}

function handlePlaybookPreviewDragOver(event) {
  if (!state.previewDrag) return;
  const target = previewDropTargetFromEvent(event);
  clearPreviewDropIndicators();
  if (!target) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  markPreviewDropTarget(target);
}

function handlePlaybookPreviewDrop(event) {
  if (!state.previewDrag) return;
  const drag = state.previewDrag;
  const target = previewDropTargetFromEvent(event);
  clearPreviewDropIndicators(true);
  state.previewDrag = null;
  if (!target) return;

  event.preventDefault();
  suppressPreviewClickAfterDrop();
  if (drag.kind === 'folder') moveFolderByDrop(drag, target);
  if (drag.kind === 'play') movePlayByDrop(drag, target);
}

function handlePlaybookPreviewDragEnd() {
  clearPreviewDropIndicators(true);
  state.previewDrag = null;
}

function handlePlaybookPreviewDragLeave(event) {
  if (!controls.playbookPreview?.contains(event.relatedTarget)) clearPreviewDropIndicators();
}

function handlePlaybookPreviewClick(event) {
  if (state.suppressPreviewClick) {
    event.preventDefault();
    state.suppressPreviewClick = false;
    return;
  }

  const button = event.target.closest('[data-preview-action]');
  if (!button || !controls.playbookPreview?.contains(button)) return;
  const { previewAction, folderId, playId } = button.dataset;
  if (previewAction === 'select-folder') selectFolder(folderId);
  if (previewAction === 'select-play') {
    selectPlay(folderId, playId);
    focusSelectedPlayForEditing();
  }
}

function handlePlaybookTreeDragStart(event) {
  const row = event.target.closest('.tree-row[draggable="true"]');
  if (!row || !controls.playbookTree.contains(row) || event.target.closest('.tree-action, .tree-toggle')) {
    event.preventDefault();
    return;
  }

  state.treeDrag = treePayloadFromRow(row);
  if (!state.treeDrag) {
    event.preventDefault();
    return;
  }

  row.classList.add('is-dragging');
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', JSON.stringify(state.treeDrag));
}

function handlePlaybookTreeDragOver(event) {
  if (!state.treeDrag) return;
  const target = treeDropTargetFromEvent(event);
  clearTreeDropIndicators();
  if (!target) return;

  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  markTreeDropTarget(target);
}

function handlePlaybookTreeDrop(event) {
  if (!state.treeDrag) return;
  const drag = state.treeDrag;
  const target = treeDropTargetFromEvent(event);
  clearTreeDropIndicators(true);
  state.treeDrag = null;
  if (!target) return;

  event.preventDefault();
  suppressTreeClickAfterDrop();
  if (drag.kind === 'folder') moveFolderByDrop(drag, target);
  if (drag.kind === 'play') movePlayByDrop(drag, target);
}

function handlePlaybookTreeDragEnd() {
  clearTreeDropIndicators(true);
  state.treeDrag = null;
}

function handlePlaybookTreeDragLeave(event) {
  if (!controls.playbookTree.contains(event.relatedTarget)) clearTreeDropIndicators();
}

function handlePlaybookTreeClick(event) {
  if (state.suppressTreeClick) {
    event.preventDefault();
    state.suppressTreeClick = false;
    return;
  }

  const button = event.target.closest('[data-playbook-action]');
  if (!button || !controls.playbookTree.contains(button)) return;
  const { playbookAction, folderId, playId } = button.dataset;

  if (playbookAction === 'toggle-folder') {
    if (state.openFolderIds.has(folderId)) state.openFolderIds.delete(folderId);
    else state.openFolderIds.add(folderId);
    renderPlaybookSelectors();
    return;
  }

  if (playbookAction === 'select-folder') selectFolder(folderId);
  if (playbookAction === 'select-play') selectPlay(folderId, playId);
  if (playbookAction === 'new-play') createNewPlay(folderId);
  if (playbookAction === 'rename-folder') renameFolderById(folderId);
  if (playbookAction === 'rename-play') renamePlayById(folderId, playId);
  if (playbookAction === 'duplicate-play') duplicatePlayById(folderId, playId);
  if (playbookAction === 'delete-play') deletePlayById(folderId, playId);
  if (playbookAction === 'delete-folder') deleteFolderById(folderId);
}

function handlePlaybookTreeDoubleClick(event) {
  const playLabel = event.target.closest('[data-playbook-action="select-play"]');
  if (playLabel && controls.playbookTree.contains(playLabel)) {
    renamePlayById(playLabel.dataset.folderId, playLabel.dataset.playId);
    return;
  }
  const folderLabel = event.target.closest('[data-playbook-action="select-folder"]');
  if (!folderLabel || !controls.playbookTree.contains(folderLabel)) return;
  renameFolderById(folderLabel.dataset.folderId);
}
