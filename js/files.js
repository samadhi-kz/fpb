// JSON load/save, PNG export, and print/PDF export helpers.
function cleanExportSvg(clone, options = {}) {
  const embedStyles = options.embedStyles !== false;
  clone.querySelectorAll('.route-hit, .route-handle, .route-insert, .selected-ring').forEach((node) => node.remove());
  clone.querySelectorAll('.is-selected').forEach((node) => node.classList.remove('is-selected'));

  if (!embedStyles) return;

  let css = '';
  Array.from(document.styleSheets).forEach((sheet) => {
    try {
      Array.from(sheet.cssRules).forEach((rule) => {
        css += `${rule.cssText}\n`;
      });
    } catch {
      css += '';
    }
  });
  const style = svgEl('style');
  style.textContent = css;
  clone.insertBefore(style, clone.firstChild);
}

function safeFileBase(name, fallback = 'play') {
  return String(name || fallback).trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ') || fallback;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function cloneFieldForExport(options = {}) {
  const clone = field.cloneNode(true);
  clone.removeAttribute('id');
  clone.classList.add('field-export');
  clone.setAttribute('width', '2000');
  clone.setAttribute('height', '1440');
  cleanExportSvg(clone, options);
  return clone;
}

function serializeFieldForExport(options = {}) {
  return new XMLSerializer().serializeToString(cloneFieldForExport(options));
}

function createPngBlob() {
  const clone = cloneFieldForExport();
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 2000;
      canvas.height = 1440;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (pngBlob) resolve(pngBlob);
        else reject(new Error('PNG conversion failed'));
      }, 'image/png');
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PNG image failed'));
    };
    image.src = url;
  });
}

async function exportPng() {
  saveLocal(false);
  try {
    const pngBlob = await createPngBlob();
    downloadBlob(pngBlob, `${safeFileBase(state.playName)}.png`);
    setStatus('PNG Exported');
  } catch (error) {
    console.error(error);
    setStatus('PNG Failed');
  } finally {
    render();
  }
}

function isAppleTouchDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function createPhotoPreviewWindow() {
  if (!isAppleTouchDevice()) return null;
  const preview = window.open('', '_blank');
  if (!preview) return null;
  preview.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Photo</title>
    <style>
      body { margin: 0; padding: 16px; background: #f7f8fa; color: #16181d; font-family: system-ui, sans-serif; }
      p { margin: 0; font-weight: 800; }
    </style>
  </head>
  <body><p>画像を準備しています...</p></body>
</html>`);
  preview.document.close();
  return preview;
}

function createBookPrintWindow() {
  if (!isAppleTouchDevice()) return null;
  const preview = window.open('', '_blank');
  if (!preview) return null;
  preview.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>PDF Book</title>
    <style>
      body { margin: 0; padding: 16px; background: #f7f8fa; color: #16181d; font-family: system-ui, sans-serif; }
      p { margin: 0; font-weight: 800; }
    </style>
  </head>
  <body><p>PDF Bookを準備しています...</p></body>
</html>`);
  preview.document.close();
  return preview;
}

function openPhotoPreview(blob, filename, previewWindow = null) {
  const url = URL.createObjectURL(blob);
  const safeName = escapeHtml(filename);
  const preview = previewWindow || window.open('', '_blank');
  if (!preview) {
    downloadBlob(blob, filename);
    setStatus('Photo Downloaded');
    return;
  }
  preview.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeName}</title>
    <style>
      body { margin: 0; padding: 16px; background: #f7f8fa; color: #16181d; font-family: system-ui, sans-serif; }
      p { margin: 0 0 12px; font-weight: 800; }
      img { display: block; width: 100%; height: auto; background: #fff; border: 1px solid #d9dee5; border-radius: 8px; }
    </style>
  </head>
  <body>
    <p>iPhoneでは画像を長押しして「写真に保存」を選んでください。</p>
    <img src="${url}" alt="${safeName}">
  </body>
</html>`);
  preview.document.close();
  setStatus('Photo Preview');
}

async function savePhoto() {
  saveLocal(false);
  const previewWindow = createPhotoPreviewWindow();
  try {
    const filename = `${safeFileBase(state.playName)}.png`;
    const pngBlob = await createPngBlob();
    const file = new File([pngBlob], filename, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] }) && navigator.share) {
      previewWindow?.close();
      await navigator.share({ files: [file], title: state.playName || 'Flag Play Board' });
      setStatus('Photo Ready');
      return;
    }
    openPhotoPreview(pngBlob, filename, previewWindow);
  } catch (error) {
    previewWindow?.close();
    if (error?.name === 'AbortError') {
      setStatus('Cancelled');
      return;
    }
    console.error(error);
    setStatus('Photo Failed');
  }
}

function normalizeImportedPlaybook(data) {
  if (data?.formatVersion === PLAYBOOK_FORMAT_VERSION && Array.isArray(data.folders)) return normalizePlaybook(data);
  if (Array.isArray(data?.folders)) return normalizePlaybook(data);
  if (Array.isArray(data?.plays)) return normalizePlaybook({ folders: [data] });
  if (Array.isArray(data)) return normalizePlaybook({ folders: data });
  throw new Error('Invalid playset JSON');
}

function importedFolderCopy(folder) {
  return {
    ...cloneData(folder),
    id: makeId('folder'),
    name: folder.name || 'Imported Folder',
    plays: (folder.plays || []).map((play) => normalizePlay({
      ...cloneData(play),
      id: makeId('play')
    }))
  };
}

function fileNameWithJsonExtension(name) {
  const base = String(name || 'flag-playbook.json').trim() || 'flag-playbook.json';
  return base.toLowerCase().endsWith('.json') ? base : `${base}.json`;
}

function currentPlaysetJson() {
  syncPlaybookState();
  return JSON.stringify(state.playbook, null, 2);
}

function downloadPlaysetJson(filename = 'flag-playbook.json') {
  const json = currentPlaysetJson();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileNameWithJsonExtension(filename);
  link.click();
  URL.revokeObjectURL(url);
  setStatus('Saving JSON');
}

async function ensureWritePermission(handle) {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  const options = { mode: 'readwrite' };
  if (await handle.queryPermission(options) === 'granted') return true;
  return (await handle.requestPermission(options)) === 'granted';
}

async function writePlaysetToHandle(handle) {
  if (!(await ensureWritePermission(handle))) {
    throw new Error('File write permission was denied');
  }
  const writable = await handle.createWritable();
  await writable.write(currentPlaysetJson());
  await writable.close();
}

function handleFileError(error, action) {
  if (error?.name === 'AbortError') {
    setStatus('Cancelled');
    return;
  }
  console.error(error);
  alert(`Failed to ${action} playset. Please check the JSON file.`);
  setStatus(`${action} Failed`);
}

async function loadPlaysetFromText(text, fileName = '', fileHandle = null) {
  try {
    const importedPlaybook = normalizeImportedPlaybook(JSON.parse(text));
    state.playbook = importedPlaybook;
    state.activeFolderId = importedPlaybook.activeFolderId;
    state.activePlayId = importedPlaybook.activePlayId;
    state.fileHandle = fileHandle;
    state.fileName = fileName;
    state.openFolderIds = new Set(importedPlaybook.folders.map((folder) => folder.id));
    const play = activePlay();
    if (play) applyPlay(play);
    else clearActivePlayView('No Play Selected');
    saveLocal(false);
    syncPlaysetFileBadge();
    resetHistory();
    setStatus(fileName ? `${fileName} Loaded` : 'Load Complete');
  } catch (error) {
    handleFileError(error, '読込');
  }
}

async function addPlaysetFromText(text, fileName = '') {
  try {
    const importedPlaybook = normalizeImportedPlaybook(JSON.parse(text));
    const foldersToAdd = importedPlaybook.folders.map(importedFolderCopy);
    if (!foldersToAdd.length) {
      setStatus('No Folder');
      return;
    }

    saveLocal(false);
    state.playbook.folders.push(...foldersToAdd);
    foldersToAdd.forEach((folder) => state.openFolderIds.add(folder.id));

    const firstPlayableFolder = foldersToAdd.find((folder) => folder.plays.length);
    if (firstPlayableFolder) {
      state.activeFolderId = firstPlayableFolder.id;
      state.activePlayId = firstPlayableFolder.plays[0].id;
      applyPlay(firstPlayableFolder.plays[0]);
    } else {
      state.activeFolderId = foldersToAdd[0].id;
      state.activePlayId = null;
      clearActivePlayView(`${foldersToAdd[0].name} Empty`);
    }

    saveLocal(true);
    setStatus(fileName ? `${foldersToAdd.length} Folder Added` : 'Folder Added');
  } catch (error) {
    handleFileError(error, 'add');
  }
}

async function openPlaysetFile() {
  state.playsetFileMode = 'load';
  saveLocal(false);
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: PLAYSET_FILE_TYPES,
        excludeAcceptAllOption: false
      });
      const file = await handle.getFile();
      await loadPlaysetFromText(await file.text(), file.name, handle);
    } catch (error) {
      handleFileError(error, 'load');
    }
    return;
  }

  state.playsetFileMode = 'load';
  controls.playsetFileInput.click();
}

async function openAddPlaysetFile() {
  if ('showOpenFilePicker' in window) {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: PLAYSET_FILE_TYPES,
        excludeAcceptAllOption: false
      });
      const file = await handle.getFile();
      await addPlaysetFromText(await file.text(), file.name);
    } catch (error) {
      handleFileError(error, 'add');
    }
    return;
  }

  state.playsetFileMode = 'add';
  controls.playsetFileInput.click();
}

async function savePlaysetAs() {
  const suggestedName = fileNameWithJsonExtension(state.fileName || 'flag-playbook.json');
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName,
        types: PLAYSET_FILE_TYPES,
        excludeAcceptAllOption: false
      });
      await writePlaysetToHandle(handle);
      state.fileHandle = handle;
      state.fileName = handle.name || suggestedName;
      syncPlaysetFileBadge();
      setStatus('Saved As');
    } catch (error) {
      handleFileError(error, 'save');
    }
    return;
  }

  downloadPlaysetJson(suggestedName);
  state.fileHandle = null;
  state.fileName = suggestedName;
  syncPlaysetFileBadge();
  setStatus('Exporting JSON');
}

async function savePlaysetFile() {
  if (!state.fileHandle) {
    setStatus('Overwrite Unavailable');
    return;
  }

  try {
    await writePlaysetToHandle(state.fileHandle);
    state.fileName = state.fileHandle.name || state.fileName;
    syncPlaysetFileBadge();
    setStatus('Overwrite Saved');
  } catch (error) {
    handleFileError(error, 'save');
  }
}

function exportCurrentPdf() {
  cleanupPrintBook();
  saveLocal(false);
  state.selectedId = null;
  state.selectedType = null;
  render();
  setStatus('PDF Play');
  window.print();
}

function playEntries() {
  return state.playbook.folders.flatMap((folder) => (
    folder.plays.map((play) => ({ folder, play }))
  ));
}

function restoreActivePlay(folderId, playId) {
  state.activeFolderId = folderId;
  state.activePlayId = playId;
  const play = activePlay();
  if (play) applyPlay(play);
  else clearActivePlayView(activeFolder()?.name ? `${activeFolder().name} Empty` : 'No Play Selected');
}

function cleanupPrintBook() {
  if (state.printCleanup) {
    state.printCleanup();
    state.printCleanup = null;
  }
}

function buildBookPrintPages(entries, options = {}) {
  return entries.map(({ folder, play }) => {
    state.activeFolderId = folder.id;
    state.activePlayId = play.id;
    applyPlay(play);
    state.selectedId = null;
    state.selectedType = null;
    render();

    return {
      title: `${folder.name} / ${play.name || 'Untitled'}`,
      svg: serializeFieldForExport(options)
    };
  });
}

function appendBookPrintPages(container, pages) {
  container.replaceChildren();
  pages.forEach((item) => {
    const page = document.createElement('section');
    page.className = 'print-page';
    const heading = document.createElement('div');
    heading.className = 'print-page-title';
    heading.textContent = item.title;
    page.append(heading);
    page.insertAdjacentHTML('beforeend', item.svg);
    container.append(page);
  });
}

function writeStandaloneBookPrintPage(printWindow, pages) {
  const pageHtml = pages.map((item) => `
    <section class="print-page">
      <div class="print-page-title">${escapeHtml(item.title)}</div>
      ${item.svg}
    </section>
  `).join('');
  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>PDF Book</title>
    <style>
      @page { size: landscape; margin: 8mm; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #fff; color: #16181d; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      .print-toolbar { position: sticky; top: 0; z-index: 2; display: flex; gap: 10px; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid #d9dee5; background: rgba(247, 248, 250, .94); }
      .print-toolbar strong { font-size: 14px; }
      .print-toolbar button { min-height: 42px; padding: 0 14px; border: 0; border-radius: 8px; background: #00685f; color: #fff; font-weight: 900; }
      .print-page { break-after: page; page-break-after: always; break-inside: avoid; page-break-inside: avoid; padding: 8mm; background: #fff; }
      .print-page:last-child { break-after: auto; page-break-after: auto; }
      .print-page-title { margin: 0 0 3mm; color: #16181d; font-size: 14px; font-weight: 900; }
      .print-page svg { display: block; width: 244mm; max-width: 100%; height: auto; margin: 0 auto; }
      @media print {
        body { padding: 0; }
        .print-toolbar { display: none; }
        .print-page { padding: 0; }
      }
    </style>
  </head>
  <body>
    <div class="print-toolbar">
      <strong>PDF Book ${pages.length} plays</strong>
      <button type="button" onclick="window.print()">PDF Book</button>
    </div>
    <main>${pageHtml}</main>
    <script>
      window.addEventListener('load', () => {
        window.setTimeout(() => {
          try { window.focus(); window.print(); } catch (error) {}
        }, 350);
      });
    </script>
  </body>
</html>`);
  printWindow.document.close();
}

function waitForPrintLayout() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(resolve, 80);
      });
    });
  });
}

async function exportPlaybookPdf() {
  const standaloneWindow = createBookPrintWindow();
  cleanupPrintBook();
  saveLocal(false);
  const entries = playEntries();
  if (!entries.length) {
    standaloneWindow?.close();
    setStatus('No Plays');
    return;
  }

  const savedFolderId = state.activeFolderId;
  const savedPlayId = state.activePlayId;
  let pages;
  try {
    pages = buildBookPrintPages(entries, { embedStyles: Boolean(standaloneWindow) });
  } catch (error) {
    standaloneWindow?.close();
    restoreActivePlay(savedFolderId, savedPlayId);
    console.error(error);
    setStatus('PDF Book Failed');
    return;
  }

  restoreActivePlay(savedFolderId, savedPlayId);

  if (standaloneWindow) {
    writeStandaloneBookPrintPage(standaloneWindow, pages);
    setStatus(`PDF Book ${pages.length}`);
    return;
  }

  const printBook = document.querySelector('#printBook');
  appendBookPrintPages(printBook, pages);
  document.body.classList.add('is-printing-book');
  state.printCleanup = () => {
    document.body.classList.remove('is-printing-book');
    printBook.replaceChildren();
  };
  setStatus(`PDF Book ${entries.length}`);
  await waitForPrintLayout();
  window.print();
}
