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

const PLAY_SHARE_HASH_KEY = 'play';
const PLAY_SHARE_PREFIX_RAW = 'p1.';
const PLAY_SHARE_PREFIX_GZIP = 'p1z.';
const BOOK_SHARE_HASH_KEY = 'book';
const BOOK_SHARE_PREFIX_RAW = 'b1.';
const BOOK_SHARE_PREFIX_GZIP = 'b1z.';
const LONG_SHARE_URL_WARNING_LENGTH = 4000;

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

function cleanPlaysetFileName(name, fallback = 'flag-playbook') {
  return fileNameWithJsonExtension(safeFileBase(name, fallback));
}

function suggestedPlaysetFileName() {
  return cleanPlaysetFileName(
    state.fileName || activeFolder()?.name || state.playbook?.folders?.[0]?.name,
    'flag-playbook'
  );
}

function setPlaysetFileName(name, options = {}) {
  const nextName = cleanPlaysetFileName(name, 'flag-playbook');
  if (!nextName) return false;
  if (state.fileHandle && state.fileHandle.name !== nextName) {
    state.fileHandle = null;
  }
  if (state.fileName === nextName) return true;
  state.fileName = nextName;
  syncPlaysetFileBadge();
  if (options.status !== false) setStatus('File Name Set');
  return true;
}

function promptPlaysetFileName(label = 'Book File Name') {
  const fallback = suggestedPlaysetFileName();
  const input = prompt(label, fallback);
  if (input === null) return '';
  return cleanPlaysetFileName(input || fallback, 'flag-playbook');
}

function renamePlaysetFileName() {
  const nextName = promptPlaysetFileName('Book File Name');
  if (!nextName) return false;
  return setPlaysetFileName(nextName);
}

function ensureBookLinkFileName() {
  if (state.fileName) {
    const normalizedName = cleanPlaysetFileName(state.fileName, 'flag-playbook');
    if (normalizedName !== state.fileName) setPlaysetFileName(normalizedName, { status: false });
    return normalizedName;
  }
  const nextName = promptPlaysetFileName('Book Link File Name');
  if (!nextName) return '';
  setPlaysetFileName(nextName, { status: false });
  return nextName;
}

function currentPlaysetJson() {
  syncPlaybookState();
  return JSON.stringify(state.playbook, null, 2);
}

function bytesToBase64Url(bytes) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
  const padded = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const base64 = padded.padEnd(Math.ceil(padded.length / 4) * 4, '=');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function gzipText(text) {
  if (!window.CompressionStream) return null;
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzipText(bytes) {
  if (!window.DecompressionStream) throw new Error('Compressed links are not supported in this browser');
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

function playbookForCurrentPlayLink() {
  syncPlaybookState();
  const folder = activeFolder();
  const play = currentPlaySnapshot();
  return {
    formatVersion: PLAYBOOK_FORMAT_VERSION,
    activeFolderId: folder?.id || 'shared-folder',
    activePlayId: play.id,
    folders: [
      {
        id: folder?.id || 'shared-folder',
        name: folder?.name || 'Shared Play',
        plays: [
          {
            ...play,
            sourceImage: ''
          }
        ]
      }
    ]
  };
}

function playbookWithoutSourceImages(playbook) {
  const clean = cloneData(playbook);
  clean.folders = (clean.folders || []).map((folder) => ({
    ...folder,
    plays: (folder.plays || []).map((play) => ({
      ...play,
      sourceImage: ''
    }))
  }));
  return clean;
}

function playbookForBookLink(fileName = '') {
  syncPlaybookState();
  const playbook = playbookWithoutSourceImages(state.playbook);
  if (fileName) playbook.fileName = cleanPlaysetFileName(fileName, 'flag-playbook');
  return playbook;
}

function encodePlaySharePayload(payload) {
  const text = JSON.stringify(payload);
  return `${PLAY_SHARE_PREFIX_RAW}${bytesToBase64Url(new TextEncoder().encode(text))}`;
}

async function encodeBookSharePayload(payload) {
  const text = JSON.stringify(payload);
  try {
    const gzipBytes = await gzipText(text);
    if (gzipBytes) return `${BOOK_SHARE_PREFIX_GZIP}${bytesToBase64Url(gzipBytes)}`;
  } catch (error) {
    console.warn('Book link compression failed; using raw payload.', error);
  }
  return `${BOOK_SHARE_PREFIX_RAW}${bytesToBase64Url(new TextEncoder().encode(text))}`;
}

async function decodeSharePayload(token, rawPrefix, gzipPrefix) {
  const value = String(token || '').trim();
  if (value.startsWith(gzipPrefix)) {
    const text = await gunzipText(base64UrlToBytes(value.slice(gzipPrefix.length)));
    return JSON.parse(text);
  }
  const rawValue = value.startsWith(rawPrefix)
    ? value.slice(rawPrefix.length)
    : value;
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(rawValue)));
}

async function decodePlaySharePayload(token) {
  return decodeSharePayload(token, PLAY_SHARE_PREFIX_RAW, PLAY_SHARE_PREFIX_GZIP);
}

async function decodeBookSharePayload(token) {
  return decodeSharePayload(token, BOOK_SHARE_PREFIX_RAW, BOOK_SHARE_PREFIX_GZIP);
}

function currentPageUrlWithoutHash() {
  const url = new URL(window.location.href);
  url.hash = '';
  return url.toString();
}

function shouldUseNativeLinkShare() {
  return Boolean(navigator.share)
    && (isAppleTouchDevice() || navigator.maxTouchPoints > 1 || /Android/i.test(navigator.userAgent));
}

async function copyText(text) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.warn('Clipboard API copy failed; trying legacy copy.', error);
    }
  }

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.left = '0';
  area.style.top = '0';
  area.style.width = '1px';
  area.style.height = '1px';
  area.style.opacity = '0';
  document.body.append(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, area.value.length);
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (error) {
    console.warn('Legacy clipboard copy failed.', error);
  }
  area.remove();
  return copied;
}

function selectShareCopyText(area) {
  area.focus();
  area.select();
  area.setSelectionRange(0, area.value.length);
}

function shareOpenHtmlFileName(title, label) {
  return `${safeFileBase(title || label || 'book-link', 'book-link')}-open.html`;
}

function jsonForHtmlScript(value) {
  return JSON.stringify(String(value))
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function jsonChunksForHtmlScript(value) {
  const text = String(value);
  const chunkSize = 1800;
  const chunks = [];
  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(jsonForHtmlScript(text.slice(index, index + chunkSize)));
  }
  return chunks.join(',\n        ');
}

function createShareOpenHtml(shareUrl, title, label) {
  const safeUrl = escapeHtml(shareUrl);
  const safeTitle = escapeHtml(title || label || 'Flag Play Board');
  return `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        background: #eef3f8;
        color: #111827;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(440px, 100%);
        display: grid;
        gap: 14px;
      }
      h1 {
        margin: 0;
        font-size: 24px;
        text-align: center;
      }
      p {
        margin: 0;
        color: #687386;
        line-height: 1.6;
        text-align: center;
      }
      a {
        display: inline-block;
        padding: 12px 16px;
        border-radius: 8px;
        background: #0a84ff;
        color: #fff;
        font-weight: 800;
        text-align: center;
        text-decoration: none;
      }
      button {
        min-height: 44px;
        border: 1px solid #c8d1dc;
        border-radius: 8px;
        background: #fff;
        color: #111827;
        font: inherit;
        font-weight: 800;
      }
      textarea {
        width: 100%;
        min-height: 96px;
        resize: vertical;
        padding: 10px;
        border: 1px solid #c8d1dc;
        border-radius: 8px;
        color: #111827;
        font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Flag Play Board</h1>
      <p>スマホでは自動でBookを開きます。PCで開かない場合はOpen Bookを押してください。</p>
      <a id="openBookButton" href="${safeUrl}" target="_blank" rel="noopener">Open Book</a>
      <button id="copyBookButton" type="button">Copy Link</button>
      <textarea id="bookUrl" readonly aria-label="Book Link">${safeUrl}</textarea>
    </main>
    <script>
      const bookUrl = [
        ${jsonChunksForHtmlScript(shareUrl)}
      ].join('');
      const openBookButton = document.getElementById('openBookButton');
      const copyBookButton = document.getElementById('copyBookButton');
      const bookUrlText = document.getElementById('bookUrl');

      openBookButton.href = bookUrl;
      bookUrlText.value = bookUrl;

      copyBookButton.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(bookUrl);
          copyBookButton.textContent = 'Copied';
        } catch {
          bookUrlText.focus();
          bookUrlText.select();
          document.execCommand('copy');
          copyBookButton.textContent = 'Selected';
        }
      });

      const isTouchDevice = navigator.maxTouchPoints > 0 || /Android|iPad|iPhone|iPod/i.test(navigator.userAgent);
      if (isTouchDevice) {
        window.setTimeout(() => {
          window.location.href = bookUrl;
        }, 450);
      }
    </script>
  </body>
</html>
`;
}

async function saveShareOpenHtml(shareUrl, title, label, filename) {
  const html = createShareOpenHtml(shareUrl, title, label);
  const htmlFileName = filename || shareOpenHtmlFileName(title, label);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });

  if (typeof File === 'function' && navigator.canShare && navigator.share) {
    const file = new File([blob], htmlFileName, { type: 'text/html' });
    let canShareFile = false;
    try {
      canShareFile = navigator.canShare({ files: [file] });
    } catch (error) {
      console.warn('HTML file sharing is not available.', error);
    }
    if (canShareFile) {
      try {
        await navigator.share({
          files: [file],
          title: title || label || 'Flag Play Board',
          text: 'Flag Play Board Book Link'
        });
        setStatus(`${label} HTML Shared (${shareUrl.length})`);
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') {
          setStatus('Cancelled');
          return false;
        }
        console.warn('Native HTML share failed; downloading file.', error);
      }
    }
  }

  downloadBlob(blob, htmlFileName);
  setStatus(`${label} HTML Saved (${shareUrl.length})`);
  return true;
}

function showManualShareLink(label, shareUrl, options = {}) {
  if (!document.body) {
    window.prompt(`${label}をコピーしてください。`, shareUrl);
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'share-copy-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const dialog = document.createElement('div');
  dialog.className = 'share-copy-dialog';

  const title = document.createElement('h2');
  title.textContent = `${label}をコピー`;

  const hint = document.createElement('p');
  hint.textContent = options.longWarning
    ? 'URLが長いため、LINEやメールで途中で切れる場合があります。Save HTMLでタップして開けるファイルとして共有できます。'
    : 'リンク欄は全選択されています。Copyボタン、または Command+C / Ctrl+C でコピーできます。';

  const area = document.createElement('textarea');
  area.className = 'share-copy-text';
  area.value = shareUrl;
  area.readOnly = true;
  area.setAttribute('aria-label', label);

  const actions = document.createElement('div');
  actions.className = 'share-copy-actions';

  const closeButton = document.createElement('button');
  closeButton.className = 'wide-button';
  closeButton.type = 'button';
  closeButton.textContent = 'Close';

  const copyButton = document.createElement('button');
  copyButton.className = 'wide-button primary';
  copyButton.type = 'button';
  copyButton.textContent = 'Copy';

  const saveHtmlButton = document.createElement('button');
  saveHtmlButton.className = 'wide-button';
  saveHtmlButton.type = 'button';
  saveHtmlButton.textContent = 'Save HTML';

  const close = () => overlay.remove();

  closeButton.addEventListener('click', close);
  saveHtmlButton.addEventListener('click', async () => {
    saveHtmlButton.disabled = true;
    saveHtmlButton.textContent = 'Saving...';
    const saved = await saveShareOpenHtml(
      shareUrl,
      options.title,
      label,
      options.htmlFileName || shareOpenHtmlFileName(options.title, label)
    );
    if (saved) {
      close();
      return;
    }
    saveHtmlButton.disabled = false;
    saveHtmlButton.textContent = 'Save HTML';
  });
  copyButton.addEventListener('click', async () => {
    if (await copyText(shareUrl)) {
      setStatus(`${label} Copied (${shareUrl.length})`);
      close();
      return;
    }
    selectShareCopyText(area);
    setStatus(`${label} Ready (${shareUrl.length})`);
  });
  area.addEventListener('focus', () => selectShareCopyText(area));
  area.addEventListener('click', () => selectShareCopyText(area));
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) close();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  actions.append(closeButton);
  if (options.includeHtmlDownload) actions.append(saveHtmlButton);
  actions.append(copyButton);
  dialog.append(title, hint, area, actions);
  overlay.append(dialog);
  document.body.append(overlay);
  window.requestAnimationFrame(() => selectShareCopyText(area));
}

async function deliverShareUrl(shareUrl, title, label, options = {}) {
  const shouldCopyAfterWarning = options.warnIfLong && shareUrl.length >= LONG_SHARE_URL_WARNING_LENGTH;
  if (shouldCopyAfterWarning) {
    showManualShareLink(label, shareUrl, {
      includeHtmlDownload: true,
      longWarning: true,
      htmlFileName: shareOpenHtmlFileName(title, label),
      title
    });
    setStatus(`${label} Ready (${shareUrl.length})`);
    return;
  }

  if (shouldUseNativeLinkShare() && /^https?:$/.test(new URL(shareUrl).protocol)) {
    try {
      await navigator.share({ title, text: 'Flag Play Board', url: shareUrl });
      setStatus(`${label} Shared (${shareUrl.length})`);
      return;
    } catch (error) {
      if (error?.name === 'AbortError') {
        setStatus('Cancelled');
        return;
      }
      console.warn('Native share failed; trying clipboard copy.', error);
    }
  }

  if (await copyText(shareUrl)) {
    setStatus(`${label} Copied (${shareUrl.length})`);
    return;
  }

  showManualShareLink(label, shareUrl);
  setStatus(`${label} Ready (${shareUrl.length})`);
}

async function shareCurrentPlayLink() {
  saveLocal(false);
  try {
    const playbook = playbookForCurrentPlayLink();
    const token = encodePlaySharePayload(playbook);
    const shareUrl = `${currentPageUrlWithoutHash()}#${PLAY_SHARE_HASH_KEY}=${token}`;
    const playName = playbook.folders[0]?.plays[0]?.name || 'Flag Play Board';
    await deliverShareUrl(shareUrl, playName, 'Play Link');
  } catch (error) {
    console.error(error);
    alert('Play Linkを作成できませんでした。JSON保存を使ってください。');
    setStatus('Play Link Failed');
  }
}

async function shareCurrentBookLink() {
  saveLocal(false);
  try {
    const fileName = ensureBookLinkFileName();
    if (!fileName) {
      setStatus('Cancelled');
      return;
    }
    const playbook = playbookForBookLink(fileName);
    const token = await encodeBookSharePayload(playbook);
    const shareUrl = `${currentPageUrlWithoutHash()}#${BOOK_SHARE_HASH_KEY}=${token}`;
    const bookName = fileName.replace(/\.json$/i, '') || activeFolder()?.name || 'Flag Play Board';
    await deliverShareUrl(shareUrl, bookName, 'Book Link', { warnIfLong: true });
  } catch (error) {
    console.error(error);
    alert('Book Linkを作成できませんでした。Bookが大きい場合はJSON保存を使ってください。');
    setStatus('Book Link Failed');
  }
}

function sharedTokenFromLocation(key) {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  if (!hash) return '';
  return new URLSearchParams(hash).get(key) || '';
}

function sharedPlayTokenFromLocation() {
  return sharedTokenFromLocation(PLAY_SHARE_HASH_KEY);
}

function sharedBookTokenFromLocation() {
  return sharedTokenFromLocation(BOOK_SHARE_HASH_KEY);
}

async function loadSharedPlayFromUrl() {
  const token = sharedPlayTokenFromLocation();
  if (!token) return false;
  try {
    const playbook = normalizeImportedPlaybook(await decodePlaySharePayload(token));
    state.playbook = playbook;
    state.activeFolderId = playbook.activeFolderId;
    state.activePlayId = playbook.activePlayId;
    state.fileHandle = null;
    state.fileName = 'Shared Play Link';
    state.openFolderIds = new Set(playbook.folders.map((folder) => folder.id));
    const play = activePlay();
    if (play) applyPlay(play);
    else clearActivePlayView('No Play Selected');
    saveLocal(false);
    syncPlaysetFileBadge();
    resetHistory();
    setStatus('Shared Play Loaded');
    return true;
  } catch (error) {
    console.error(error);
    alert('Play Linkを読み込めませんでした。リンクが途中で切れている可能性があります。');
    setStatus('Play Link Load Failed');
    return false;
  }
}

async function loadSharedBookFromUrl() {
  const token = sharedBookTokenFromLocation();
  if (!token) return false;
  try {
    const sharedPayload = await decodeBookSharePayload(token);
    const playbook = normalizeImportedPlaybook(sharedPayload);
    state.playbook = playbook;
    state.activeFolderId = playbook.activeFolderId;
    state.activePlayId = playbook.activePlayId;
    state.fileHandle = null;
    state.fileName = cleanPlaysetFileName(
      sharedPayload?.fileName || playbook.folders?.[0]?.name || 'shared-book',
      'shared-book'
    );
    state.openFolderIds = new Set(playbook.folders.map((folder) => folder.id));
    const play = activePlay();
    if (play) applyPlay(play);
    else clearActivePlayView('No Play Selected');
    saveLocal(false);
    syncPlaysetFileBadge();
    resetHistory();
    setStatus('Shared Book Loaded');
    return true;
  } catch (error) {
    console.error(error);
    alert('Book Linkを読み込めませんでした。リンクが途中で切れている可能性があります。');
    setStatus('Book Link Load Failed');
    return false;
  }
}

async function loadSharedLinkFromUrl() {
  return (await loadSharedBookFromUrl()) || (await loadSharedPlayFromUrl());
}

function downloadPlaysetJson(filename = 'flag-playbook.json') {
  const json = currentPlaysetJson();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileNameWithJsonExtension(filename);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
      title: `${folder.name} / ${playDisplayName(play)}`,
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
