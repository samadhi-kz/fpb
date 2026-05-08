// Folder/play CRUD and active play selection behavior.
function folderById(folderId) {
  return state.playbook.folders.find((folder) => folder.id === folderId);
}

function selectFolder(folderId) {
  const folder = folderById(folderId);
  if (!folder) return;
  saveLocal(false);
  state.activeFolderId = folder.id;
  state.openFolderIds.add(folder.id);
  const play = folder.plays.find((item) => item.id === state.activePlayId) || folder.plays[0];
  if (!play) {
    clearActivePlayView(`${folder.name} Empty`);
    setStatus(`${folder.name} Empty`);
    return;
  }
  state.activePlayId = play.id;
  applyPlay(play);
  setStatus(folder.name);
}

function selectPlay(folderId, playId) {
  const folder = folderById(folderId);
  const play = folder?.plays.find((item) => item.id === playId);
  if (!folder || !play) return;
  saveLocal(false);
  state.activeFolderId = folder.id;
  state.activePlayId = play.id;
  state.openFolderIds.add(folder.id);
  applyPlay(play);
  setStatus(play.name || 'Untitled');
}

function createNewPlay(folderId = state.activeFolderId) {
  saveLocal(false);
  const folder = folderById(folderId) || activeFolder();
  if (!folder) return;
  const play = normalizePlay({
    ...cloneData(defaultPlay),
    id: makeId('play'),
    name: `New Play ${folder.plays.length + 1}`,
    routes: [],
    annotations: [],
    notes: ''
  });
  folder.plays.push(play);
  state.activeFolderId = folder.id;
  state.activePlayId = play.id;
  state.openFolderIds.add(folder.id);
  applyPlay(play);
  saveLocal(true);
}

function createNewFolder() {
  saveLocal(false);
  const name = prompt('Folder Name', `Folder ${state.playbook.folders.length + 1}`);
  if (!name) return;
  const play = normalizePlay({ ...cloneData(defaultPlay), id: makeId('play'), name: 'New Play 1' });
  const folder = { id: makeId('folder'), name, plays: [play] };
  state.playbook.folders.push(folder);
  state.activeFolderId = folder.id;
  state.activePlayId = play.id;
  state.openFolderIds.add(folder.id);
  applyPlay(play);
  saveLocal(true);
}

function renameFolderById(folderId = state.activeFolderId) {
  const folder = folderById(folderId);
  if (!folder) return;
  const name = prompt('Folder Name', folder.name);
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed || trimmed === folder.name) return;
  folder.name = trimmed;
  saveLocal(false);
  render();
  setStatus('Folder Renamed');
}

function renamePlayById(folderId = state.activeFolderId, playId = state.activePlayId) {
  const folder = folderById(folderId);
  const play = folder?.plays.find((item) => item.id === playId);
  if (!folder || !play) return;
  const name = prompt('Play Name', play.name || 'Untitled');
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed || trimmed === play.name) return;
  play.name = trimmed;
  if (state.activeFolderId === folder.id && state.activePlayId === play.id) {
    state.playName = trimmed;
  }
  saveLocal(false);
  render();
  setStatus('Play Renamed');
}

function duplicatePlayById(folderId = state.activeFolderId, playId = state.activePlayId) {
  saveLocal(false);
  const folder = folderById(folderId);
  const source = folder?.plays.find((item) => item.id === playId);
  if (!folder || !source) return;
  const duplicate = normalizePlay({
    ...cloneData(source),
    id: makeId('play'),
    name: `${source.name || 'Untitled'} Copy`
  });
  const index = folder.plays.findIndex((item) => item.id === playId);
  folder.plays.splice(index + 1, 0, duplicate);
  state.activeFolderId = folder.id;
  state.activePlayId = duplicate.id;
  state.openFolderIds.add(folder.id);
  applyPlay(duplicate);
  saveLocal(true);
}

function duplicateCurrentPlay() {
  duplicatePlayById();
}

function duplicateFolderById(folderId = state.activeFolderId) {
  saveLocal(false);
  const sourceIndex = state.playbook.folders.findIndex((folder) => folder.id === folderId);
  const source = state.playbook.folders[sourceIndex];
  if (!source) return;
  const duplicate = {
    id: makeId('folder'),
    name: `${source.name || 'Folder'} Copy`,
    plays: (source.plays || []).map((play) => normalizePlay({
      ...cloneData(play),
      id: makeId('play')
    }))
  };
  state.playbook.folders.splice(sourceIndex + 1, 0, duplicate);
  state.activeFolderId = duplicate.id;
  state.openFolderIds.add(duplicate.id);
  if (duplicate.plays[0]) {
    state.activePlayId = duplicate.plays[0].id;
    applyPlay(duplicate.plays[0]);
  } else {
    clearActivePlayView(`${duplicate.name} Empty`);
  }
  saveLocal(true);
  setStatus('Folder Copied');
}

function totalPlayCount() {
  return state.playbook.folders.reduce((total, folder) => total + folder.plays.length, 0);
}

function firstPlayLocation(excludePlayId = '') {
  for (const folder of state.playbook.folders) {
    const play = folder.plays.find((item) => item.id !== excludePlayId);
    if (play) return { folder, play };
  }
  return null;
}

function deletePlayById(folderId = state.activeFolderId, playId = state.activePlayId) {
  const folder = folderById(folderId);
  if (!folder || totalPlayCount() <= 1) {
    setStatus('Last Play');
    return;
  }
  const index = folder.plays.findIndex((play) => play.id === playId);
  if (index === -1) return;
  const play = folder.plays[index];
  if (!confirm(`Delete "${play.name || 'Untitled'}"?`)) return;
  saveLocal(false);
  folder.plays.splice(index, 1);

  if (state.activeFolderId === folder.id && state.activePlayId === playId) {
    const nextPlay = folder.plays[Math.min(index, folder.plays.length - 1)];
    if (nextPlay) {
      state.activePlayId = nextPlay.id;
      applyPlay(nextPlay);
    } else {
      const nextLocation = firstPlayLocation(playId);
      if (nextLocation) {
        state.activeFolderId = nextLocation.folder.id;
        state.activePlayId = nextLocation.play.id;
        state.openFolderIds.add(nextLocation.folder.id);
        applyPlay(nextLocation.play);
      } else {
        clearActivePlayView(`${folder.name} Empty`);
      }
    }
    saveLocal(true);
  } else {
    saveLocal(true);
    render();
  }
}

function deleteCurrentPlay() {
  deletePlayById();
}

function deleteFolderById(folderId = state.activeFolderId) {
  if (state.playbook.folders.length <= 1) {
    setStatus('Last Folder');
    return;
  }
  const index = state.playbook.folders.findIndex((folder) => folder.id === folderId);
  if (index === -1) return;
  const folder = state.playbook.folders[index];
  if (!confirm(`Delete folder "${folder.name}"?`)) return;
  saveLocal(false);
  state.playbook.folders.splice(index, 1);
  state.openFolderIds.delete(folder.id);

  if (state.activeFolderId === folder.id) {
    const nextFolder = state.playbook.folders[Math.min(index, state.playbook.folders.length - 1)];
    state.activeFolderId = nextFolder.id;
    state.openFolderIds.add(nextFolder.id);
    if (nextFolder.plays[0]) {
      state.activePlayId = nextFolder.plays[0].id;
      applyPlay(nextFolder.plays[0]);
    } else {
      const nextLocation = firstPlayLocation();
      if (nextLocation) {
        state.activeFolderId = nextLocation.folder.id;
        state.activePlayId = nextLocation.play.id;
        state.openFolderIds.add(nextLocation.folder.id);
        applyPlay(nextLocation.play);
      } else {
        clearActivePlayView(`${nextFolder.name} Empty`);
      }
    }
  } else {
    render();
  }
  saveLocal(true);
}

function deleteCurrentFolder() {
  deleteFolderById();
}

function moveFolderByStep(folderId, direction) {
  const folders = state.playbook.folders;
  const fromIndex = folders.findIndex((folder) => folder.id === folderId);
  const toIndex = fromIndex + direction;
  if (fromIndex === -1 || toIndex < 0 || toIndex >= folders.length) return;

  saveLocal(false);
  const [folder] = folders.splice(fromIndex, 1);
  folders.splice(toIndex, 0, folder);
  saveLocal(true);
  setStatus('Folder Moved');
}

function movePlayByStep(folderId, playId, direction) {
  const step = direction < 0 ? -1 : 1;
  const folders = state.playbook.folders;
  const sourceFolderIndex = folders.findIndex((folder) => folder.id === folderId);
  const sourceFolder = folders[sourceFolderIndex];
  if (!sourceFolder) return;

  const fromIndex = sourceFolder.plays.findIndex((play) => play.id === playId);
  if (fromIndex === -1) return;

  let targetFolder = sourceFolder;
  let insertIndex = fromIndex + step;
  if (step < 0 && fromIndex === 0) {
    targetFolder = folders[sourceFolderIndex - 1];
    if (!targetFolder) return;
    insertIndex = targetFolder.plays.length;
  } else if (step > 0 && fromIndex === sourceFolder.plays.length - 1) {
    targetFolder = folders[sourceFolderIndex + 1];
    if (!targetFolder) return;
    insertIndex = 0;
  } else if (insertIndex < 0 || insertIndex >= sourceFolder.plays.length) {
    return;
  }

  saveLocal(false);
  const [play] = sourceFolder.plays.splice(fromIndex, 1);
  targetFolder.plays.splice(insertIndex, 0, play);
  state.openFolderIds.add(sourceFolder.id);
  state.openFolderIds.add(targetFolder.id);
  if (state.activePlayId === play.id) state.activeFolderId = targetFolder.id;
  saveLocal(true);
  setStatus(sourceFolder === targetFolder ? 'Play Reordered' : 'Play Moved');
}
