// SVG geometry, field drawing, player marks, and render orchestration.
function linePath(points) {
  if (points.length < 2) return '';
  return `M ${points[0][0]} ${points[0][1]} ` + points.slice(1).map((p) => `L ${p[0]} ${p[1]}`).join(' ');
}

function smoothPath(points) {
  if (points.length < 3) return linePath(points);
  const segments = [`M ${points[0][0]} ${points[0][1]}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1 = [
      p1[0] + (p2[0] - p0[0]) / 6,
      p1[1] + (p2[1] - p0[1]) / 6
    ];
    const cp2 = [
      p2[0] - (p3[0] - p1[0]) / 6,
      p2[1] - (p3[1] - p1[1]) / 6
    ];
    segments.push(`C ${cp1[0]} ${cp1[1]} ${cp2[0]} ${cp2[1]} ${p2[0]} ${p2[1]}`);
  }
  return segments.join(' ');
}

function zigzagPoints(points) {
  if (points.length < 2) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1];
    const b = points[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const length = Math.hypot(dx, dy);
    if (length < 12) {
      result.push(b);
      continue;
    }
    const nx = -dy / length;
    const ny = dx / length;
    const steps = Math.max(3, Math.ceil(length / 11));
    for (let j = 1; j < steps; j += 1) {
      const t = j / steps;
      const amp = j % 2 === 0 ? -6 : 6;
      result.push([a[0] + dx * t + nx * amp, a[1] + dy * t + ny * amp]);
    }
    result.push(b);
  }
  return result;
}

function displayPoints(route) {
  if (route.input === 'poly' && route.previewPoint && route.points.length) {
    const previous = route.points[route.points.length - 1];
    if (Math.hypot(route.previewPoint[0] - previous[0], route.previewPoint[1] - previous[1]) > 3) {
      return [...route.points, route.previewPoint];
    }
  }
  return route.points;
}

function routePath(route) {
  const points = displayPoints(route);
  if (route.type === 'motion') return linePath(zigzagPoints(points));
  if (route.mode === 'curve' || route.mode === 'draw') return smoothPath(points);
  return linePath(points);
}

function endGeometry(points) {
  const end = points[points.length - 1];
  const prev = points[points.length - 2] || [end[0] - 1, end[1]];
  const angle = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
  const nx = Math.cos(angle + Math.PI / 2);
  const ny = Math.sin(angle + Math.PI / 2);
  return { end, nx, ny };
}

function routeLength(points) {
  return points.slice(1).reduce((total, point, index) => {
    const previous = points[index];
    return total + Math.hypot(point[0] - previous[0], point[1] - previous[1]);
  }, 0);
}

function sanitizePoints(points) {
  const cleaned = [];
  points.forEach((point) => {
    const next = clampPoint(point);
    const previous = cleaned[cleaned.length - 1];
    if (!previous || Math.hypot(next[0] - previous[0], next[1] - previous[1]) > 4) {
      cleaned.push(next);
    }
  });
  return cleaned;
}

function needsLargeTouchTargets() {
  return window.matchMedia?.('(pointer: coarse)').matches || window.innerWidth <= 860;
}

function drawGrid() {
  layers.grid.replaceChildren();
  const { left, right, scrimmageY, yardScale, widthYards, gridStepYards, frontYards, backYards, xAxisGuides } = FIELD_DIMENSIONS;
  const top = scrimmageY - frontYards * yardScale;
  const bottom = scrimmageY + backYards * yardScale;
  const xFromYards = (yards) => left + yards * yardScale;
  const appendYardLabel = (text, x, y, vertical = false, anchor = 'start') => {
    const label = svgEl('text', {
      class: `yard-label${vertical ? ' vertical-yard-label' : ''}`,
      x,
      y,
      'text-anchor': anchor
    });
    label.textContent = text;
    layers.grid.append(label);
  };

  xAxisGuides.forEach((guide) => {
    const x = xFromYards(guide.yards);
    layers.grid.append(svgEl('line', {
      class: 'yard-line vertical-yard-line',
      x1: x,
      y1: top,
      x2: x,
      y2: bottom
    }));
    // Position labels outside the field
    if (guide.yards === 0) {
      appendYardLabel(guide.label, x - 10, top + 22, true, 'end');
    } else if (guide.yards === 25) {
      appendYardLabel(guide.label, x + 10, top + 22, true, 'start');
    } else {
      appendYardLabel(guide.label, x + 4, top - 10, true);
    }
  });

  [
    { yards: -20, label: 'Front 20yd' },
    { yards: -15, label: 'Front 15yd' },
    { yards: -10, label: 'Front 10yd' },
    { yards: -5, label: 'Front 5yd' },
    { yards: 0, label: 'Scrimmage', los: true },
    { yards: 5, label: 'Back 5yd' },
    { yards: 10, label: 'Back 10yd' }
  ].forEach((line) => {
    const y = scrimmageY + line.yards * yardScale;
    layers.grid.append(svgEl('line', {
      class: line.los ? 'los' : 'yard-line horizontal-yard-line',
      x1: left,
      y1: y,
      x2: right,
      y2: y
    }));
    // Position labels outside the field on the left
    appendYardLabel(line.label, left - 20, line.los ? y - 14 : y - 8, false, 'end');
  });
}

function drawRouteEnd(group, route) {
  if (route.end === 'none') return;
  const scale = state.endCapSize;
  const arrowScale = scale * 2;
  const dotScale = scale * 1.5;
  const style = normalizeRouteStyle(route);
  const attrs = {
    stroke: style.color,
    'stroke-width': style.width,
    opacity: style.opacity
  };
  if (route.end === 'arrow') {
    const { end } = endGeometry(route.points);
    const prev = route.points[route.points.length - 2] || [end[0] - 1, end[1]];
    const angle = Math.atan2(end[1] - prev[1], end[0] - prev[0]);
    const length = 20 * arrowScale;
    const spread = 10 * arrowScale;
    const x1 = end[0] - Math.cos(angle) * length + Math.cos(angle + Math.PI / 2) * spread;
    const y1 = end[1] - Math.sin(angle) * length + Math.sin(angle + Math.PI / 2) * spread;
    const x2 = end[0] - Math.cos(angle) * length - Math.cos(angle + Math.PI / 2) * spread;
    const y2 = end[1] - Math.sin(angle) * length - Math.sin(angle + Math.PI / 2) * spread;
    group.append(svgEl('path', {
      class: 'end-arrow',
      d: `M ${x1} ${y1} L ${end[0]} ${end[1]} L ${x2} ${y2}`,
      ...attrs
    }));
  }

  if (route.end === 'dot') {
    const { end } = endGeometry(route.points);
    group.append(svgEl('circle', {
      class: 'end-dot',
      cx: end[0],
      cy: end[1],
      r: 11 * dotScale,
      fill: style.color,
      opacity: style.opacity
    }));
  }

  if (route.end === 't') {
    const { end, nx, ny } = endGeometry(route.points);
    group.append(svgEl('line', {
      class: 'end-t',
      x1: end[0] - nx * 29 * scale,
      y1: end[1] - ny * 29 * scale,
      x2: end[0] + nx * 29 * scale,
      y2: end[1] + ny * 29 * scale,
      ...attrs
    }));
  }
}

function drawRouteHandles(group, route) {
  const touchSized = needsLargeTouchTargets();
  const handleRadius = touchSized ? 18 : 14;
  const insertRadius = touchSized ? 13 : 9;
  route.points.forEach((point, index) => {
    group.append(svgEl('circle', {
      class: 'route-handle',
      cx: point[0],
      cy: point[1],
      r: handleRadius,
      'data-id': route.id,
      'data-kind': 'route-point',
      'data-index': index
    }));
  });

  for (let i = 0; i < route.points.length - 1; i += 1) {
    const a = route.points[i];
    const b = route.points[i + 1];
    group.append(svgEl('circle', {
      class: 'route-insert',
      cx: (a[0] + b[0]) / 2,
      cy: (a[1] + b[1]) / 2,
      r: insertRadius,
      'data-id': route.id,
      'data-kind': 'route-insert',
      'data-index': i
    }));
  }
}

function drawRoutes() {
  layers.routeHits.replaceChildren();
  layers.routes.replaceChildren();
  const touchSized = needsLargeTouchTargets();
  state.routes.forEach((route) => {
    if (!route.points || route.points.length < 2) return;
    const selected = state.selectedType === 'route' && state.selectedId === route.id;
    const hitGroup = svgEl('g', { 'data-id': route.id, 'data-kind': 'route' });
    const group = svgEl('g');
    const d = routePath(route);
    const style = normalizeRouteStyle(route);

    hitGroup.append(svgEl('path', {
      class: 'route-hit',
      d,
      'stroke-width': Math.max(touchSized ? 46 : 34, style.width + (touchSized ? 34 : 24))
    }));
    group.append(svgEl('path', {
      class: `route ${route.type}${selected ? ' is-selected' : ''}`,
      d,
      stroke: style.color,
      'stroke-width': style.width,
      opacity: style.opacity
    }));
    drawRouteEnd(group, route);
    if (selected) drawRouteHandles(group, route);
    layers.routeHits.append(hitGroup);
    layers.routes.append(group);
  });
}

function starPath(cx, cy, outer = 48, inner = 23) {
  const points = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + i * Math.PI / 5;
    points.push(`${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`);
  }
  return points.join(' ');
}

function markLabel(mark) {
  if (!mark) return '';
  return PLAYER_MARK_OPTIONS.find((option) => option.value === mark)?.label || '';
}

function playerMark(player) {
  if (!player || !state.playerMarks) return '';
  return state.playerMarks[playerMarkKey(player)] || state.playerMarks[player.label] || '';
}

function playerShapeAttrs(fill, shadow = true) {
  return {
    fill,
    ...(shadow ? { filter: 'url(#softShadow)' } : {})
  };
}

function drawPlayer(player, defender = false) {
  const size = normalizePlayerSize(state.playerSize);
  const selectedRing = size + 7;
  const qbSize = size * 2;
  const hitPadding = needsLargeTouchTargets() ? 30 : 20;
  const mark = defender ? '' : playerMark(player);
  const group = svgEl('g', {
    class: `player ${defender ? 'defender' : `player-role-${player.role || 'normal'}`}`,
    transform: `translate(${player.x} ${player.y})`,
    'data-id': player.id,
    'data-kind': defender ? 'defender' : 'player'
  });
  const title = svgEl('title');
  title.textContent = defender ? 'Defense X' : `${player.label} ${playerRoleLabel(player)}`;
  group.append(title);
  group.append(svgEl('circle', { class: 'player-hit', cx: 0, cy: 0, r: size + hitPadding }));
  if (mark === 'ring') {
    group.append(svgEl('circle', { class: 'player-shape player-mark-ring-fill', cx: 0, cy: 0, r: size, ...playerShapeAttrs('#2f6fed') }));
  } else if (mark === 'star') {
    group.append(svgEl('polygon', { class: 'player-shape player-target', points: starPath(0, 0, size * 1.26, size * 0.61), ...playerShapeAttrs('#e71932') }));
  } else if (mark === 'diamond') {
    const diamondSize = size * 1.45;
    group.append(svgEl('polygon', {
      class: 'player-shape player-mark-diamond',
      points: `0,-${diamondSize} ${diamondSize},0 0,${diamondSize} -${diamondSize},0`,
      ...playerShapeAttrs('#f3b43f')
    }));
  } else if (mark === 'square') {
    group.append(svgEl('rect', { class: 'player-shape player-mark-square', x: -size, y: -size, width: size * 2, height: size * 2, ...playerShapeAttrs('#008579') }));
  } else if (player.role === 'qb') {
    group.append(svgEl('rect', { class: 'player-shape player-qb', x: -size, y: -size, width: qbSize, height: qbSize, ...playerShapeAttrs('#00685f') }));
  } else {
    group.append(svgEl('circle', { class: 'player-shape', cx: 0, cy: 0, r: size, ...playerShapeAttrs(defender ? '#d8d8d8' : '#008579', !defender) }));
  }
  if (state.selectedId === player.id) {
    group.append(svgEl('circle', { class: 'selected-ring', cx: 0, cy: 0, r: selectedRing, fill: 'none', stroke: '#f3b43f', 'stroke-width': 6 }));
  }
  group.append(svgEl('text', { class: 'player-text', x: 0, y: 3, fill: defender ? '#4b4f55' : '#ffffff', style: `font-size: ${Math.max(11, size * 1.1)}px` }));
  group.lastElementChild.textContent = player.label;
  return group;
}

function drawPlayers() {
  layers.defenders.replaceChildren();
  layers.players.replaceChildren();
  if (state.defenseVisible) {
    state.defenders.forEach((defender) => layers.defenders.append(drawPlayer(defender, true)));
  }
  state.players.forEach((player) => layers.players.append(drawPlayer(player, false)));
}

function textLength(text) {
  return Array.from(String(text || '')).length;
}

function approximateSvgTextWidth(text, fontSize = 16) {
  return Array.from(String(text || '')).reduce((total, char) => {
    if (/\s/.test(char)) return total + fontSize * 0.32;
    return total + fontSize * (/^[\x00-\x7F]$/.test(char) ? 0.58 : 1);
  }, 0);
}

function createSvgTextMeasurer(sourceElement) {
  const measurer = svgEl('text', {
    x: -10000,
    y: -10000,
    visibility: 'hidden',
    'aria-hidden': 'true'
  });
  const className = sourceElement.getAttribute('class');
  const style = sourceElement.getAttribute('style');
  if (className) measurer.setAttribute('class', className);
  if (style) measurer.setAttribute('style', style);
  field.append(measurer);

  const computed = window.getComputedStyle ? window.getComputedStyle(measurer) : null;
  const fontSize = Number.parseFloat(computed?.fontSize) || 16;
  return {
    measure(value) {
      measurer.textContent = String(value || '');
      try {
        return measurer.getComputedTextLength();
      } catch {
        return approximateSvgTextWidth(value, fontSize);
      }
    },
    remove() {
      measurer.remove();
    }
  };
}

function splitLongText(text, maxChars) {
  const chars = Array.from(String(text || ''));
  const chunks = [];
  for (let index = 0; index < chars.length; index += maxChars) {
    chunks.push(chars.slice(index, index + maxChars).join(''));
  }
  return chunks;
}

function wrapParagraph(text, maxChars) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let current = '';
  words.forEach((word) => {
    if (textLength(word) > maxChars) {
      if (current) {
        lines.push(current);
        current = '';
      }
      const chunks = splitLongText(word, maxChars);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1] || '';
      return;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (textLength(candidate) <= maxChars) {
      current = candidate;
      return;
    }

    if (current) lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines;
}

function splitLongTextByWidth(text, measure, maxWidth) {
  const chunks = [];
  let current = '';
  Array.from(String(text || '')).forEach((char) => {
    const candidate = `${current}${char}`;
    if (!current || measure(candidate) <= maxWidth) {
      current = candidate;
      return;
    }
    chunks.push(current);
    current = char;
  });
  if (current) chunks.push(current);
  return chunks;
}

function wrapParagraphByWidth(text, measure, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let current = '';
  words.forEach((word) => {
    if (measure(word) > maxWidth) {
      if (current) {
        lines.push(current);
        current = '';
      }
      const chunks = splitLongTextByWidth(word, measure, maxWidth);
      lines.push(...chunks.slice(0, -1));
      current = chunks[chunks.length - 1] || '';
      return;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (!current || measure(candidate) <= maxWidth) {
      current = candidate;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines;
}

function ellipsizeLineByWidth(text, measure, maxWidth) {
  const ellipsis = '...';
  const chars = Array.from(String(text || '').trimEnd());
  while (chars.length && measure(`${chars.join('')}${ellipsis}`) > maxWidth) {
    chars.pop();
  }
  return `${chars.join('').trimEnd()}${ellipsis}`;
}

function wrapTextLinesByWidth(text, measure, maxWidth, maxLines) {
  const lines = String(text || '').split(/\n/).flatMap((line) => wrapParagraphByWidth(line, measure, maxWidth));
  if (!Number.isFinite(maxLines) || lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  clipped[clipped.length - 1] = ellipsizeLineByWidth(clipped[clipped.length - 1], measure, maxWidth);
  return clipped;
}

function wrapTextLines(text, maxChars, maxLines) {
  const lines = String(text || '').split(/\n/).flatMap((line) => wrapParagraph(line, maxChars));
  if (!Number.isFinite(maxLines) || lines.length <= maxLines) return lines;
  const clipped = lines.slice(0, maxLines);
  const last = clipped[clipped.length - 1] || '';
  clipped[clipped.length - 1] = textLength(last) > maxChars - 3
    ? `${Array.from(last).slice(0, maxChars - 3).join('')}...`
    : `${last}...`;
  return clipped;
}

function appendMultilineText(textElement, text, x, lineHeight = 28, options = {}) {
  const maxLines = options.maxLines || 5;
  let lines;
  if (options.maxWidth) {
    const measurer = createSvgTextMeasurer(textElement);
    try {
      lines = wrapTextLinesByWidth(text, measurer.measure, options.maxWidth, maxLines);
    } finally {
      measurer.remove();
    }
  } else {
    lines = options.maxChars
      ? wrapTextLines(text, options.maxChars, maxLines)
      : String(text || '').split(/\n/).slice(0, maxLines);
  }
  lines.forEach((line, index) => {
    const tspan = svgEl('tspan', { x, dy: index === 0 ? 0 : lineHeight });
    tspan.textContent = line;
    textElement.append(tspan);
  });
  return lines.length;
}

function drawText() {
  layers.text.replaceChildren();
  state.annotations.forEach((note) => {
    const selected = state.selectedType === 'annotation' && state.selectedId === note.id;
    const text = svgEl('text', {
      class: `annotation${selected ? ' is-selected' : ''}`,
      x: note.x,
      y: note.y,
      'data-id': note.id,
      'data-kind': 'annotation'
    });
    appendMultilineText(text, note.text, note.x, 28);
    layers.text.append(text);
  });
}

function drawMeta() {
  layers.meta.replaceChildren();
  const metaX = 790;
  const metaWidth = 186;
  let y = 268;
  const bookName = activeFolder()?.name || 'My Play Book';
  const bookLabel = svgEl('text', {
    class: 'meta-book-label',
    x: metaX,
    y,
    'data-id': 'meta-book',
    'data-kind': 'meta-book'
  });
  const bookLines = appendMultilineText(bookLabel, bookName, metaX, 16, { maxWidth: metaWidth, maxLines: 2 });
  layers.meta.append(bookLabel);
  y += bookLines * 16 + 8;

  const title = svgEl('text', {
    class: 'meta-title',
    x: metaX,
    y,
    'data-id': 'meta-play',
    'data-kind': 'meta-play'
  });
  const titleLines = appendMultilineText(title, state.playName, metaX, 28, { maxWidth: metaWidth, maxLines: 3 });
  layers.meta.append(title);
  y += titleLines * 28 + 18;

  const notesLabel = svgEl('text', {
    class: 'meta-notes-label',
    x: metaX,
    y,
    'data-id': 'meta-notes',
    'data-kind': 'meta-notes'
  });
  notesLabel.textContent = 'Play Notes';
  layers.meta.append(notesLabel);

  if (state.notes) {
    y += 26;
    const notes = svgEl('text', {
      class: 'meta-notes',
      x: metaX,
      y,
      'data-id': 'meta-notes',
      'data-kind': 'meta-notes'
    });
    const maxNoteLines = Math.min(14, Math.max(3, Math.floor((690 - y) / 23) + 1));
    appendMultilineText(notes, state.notes, metaX, 23, { maxWidth: metaWidth, maxLines: maxNoteLines });
    layers.meta.append(notes);
  }
}

function drawTemp() {
  layers.temp.replaceChildren();
  syncDockActionButtons();
  if (!state.routeDraft) return;
  const points = displayPoints(state.routeDraft);
  if (points.length < 2) return;
  const previewRoute = { ...state.routeDraft, points };
  const group = svgEl('g');
  const style = normalizeRouteStyle(state.routeDraft);
  group.append(svgEl('path', {
    class: `route ${state.routeDraft.type} is-selected`,
    d: routePath(previewRoute),
    stroke: style.color,
    'stroke-width': style.width,
    opacity: style.opacity
  }));
  drawRouteEnd(group, previewRoute);
  layers.temp.append(group);
}

function renderDragUpdate(kind) {
  if (kind === 'route-point' || kind === 'route-move') {
    drawRoutes();
    return;
  }
  if (kind === 'player') {
    drawRoutes();
    drawPlayers();
    return;
  }
  if (kind === 'defender') {
    drawPlayers();
    return;
  }
  if (kind === 'annotation') {
    drawText();
    return;
  }
  render();
}

function drawMarkControls() {
  controls.markList.replaceChildren();
  state.players.forEach((player) => {
    const item = document.createElement('div');
    item.className = 'mark-item';
    const badge = document.createElement('button');
    const mark = playerMark(player);
    badge.className = `mark-badge mark-badge-button${mark ? ` is-${mark}` : ''}`;
    badge.type = 'button';
    badge.disabled = !canSwapPlayerNumber(player);
    badge.title = canSwapPlayerNumber(player) ? 'Swap 3/4/5 number' : '1 and 2 are fixed';
    badge.textContent = player.label;
    badge.addEventListener('click', () => renamePlayerById(player.id));
    const select = document.createElement('select');
    PLAYER_MARK_OPTIONS.forEach((option) => {
      const itemOption = document.createElement('option');
      itemOption.value = option.value;
      itemOption.textContent = option.label;
      select.append(itemOption);
    });
    select.value = mark;
    select.addEventListener('change', () => {
      setPlayerMark(player, select.value);
      saveLocal(false, { historyKey: `player-mark-${player.id}` });
      render();
      setStatus(select.value ? `Player ${player.label}: ${markLabel(select.value)}` : `Player ${player.label}: No mark`);
    });
    item.append(badge, select);
  controls.markList.append(item);
  });
}

function drawSourceImage() {
  layers.sourceImages.replaceChildren();
  if (!state.sourceImage) return false;
  layers.sourceImages.append(svgEl('image', {
    class: 'source-play-image',
    href: state.sourceImage,
    x: 140,
    y: 0,
    width: 720,
    height: 720,
    preserveAspectRatio: 'xMidYMid meet'
  }));
  return true;
}

function syncDockActionButtons() {
  const canDeleteFromDock = state.selectedType === 'route' || state.selectedType === 'annotation';
  const canClearRoutes = state.routes.length > 0;
  const canResetPlay = Boolean(state.activePlayId);
  const canFinishRoute = state.routeDraft?.input === 'poly'
    && state.routeDraft.points.length >= 2
    && routeLength(state.routeDraft.points) > 20;
  const canUndoFromDock = state.routeDraft ? true : canUndoHistory();
  const canRedoFromDock = state.routeDraft?.input === 'poly'
    ? Boolean(state.routeDraft.undonePoints?.length)
    : !state.routeDraft && canRedoHistory();
  document.querySelectorAll('[data-action="undo-history"]').forEach((button) => {
    button.setAttribute('aria-disabled', String(!canUndoFromDock));
  });
  document.querySelectorAll('[data-action="redo-history"]').forEach((button) => {
    button.setAttribute('aria-disabled', String(!canRedoFromDock));
  });
  document.querySelectorAll('[data-action="delete-selected"]').forEach((button) => {
    button.disabled = !canDeleteFromDock;
  });
  document.querySelectorAll('.mobile-delete-button').forEach((button) => {
    button.hidden = !canDeleteFromDock;
  });
  document.querySelectorAll('[data-action="clear-routes"]').forEach((button) => {
    button.disabled = !canClearRoutes;
  });
  document.querySelectorAll('[data-action="reset-play-diagram"]').forEach((button) => {
    button.disabled = !canResetPlay;
  });
  document.querySelectorAll('[data-action="finish-route"]').forEach((button) => {
    button.disabled = !canFinishRoute;
  });
  document.querySelectorAll('.mobile-finish-button').forEach((button) => {
    button.hidden = state.routeDraft?.input !== 'poly';
  });
}

function mobileRouteType(route) {
  if (route?.type === 'motion' || route?.type === 'pass') return route.type;
  return 'route';
}

function syncMobileLineControls() {
  const route = activeRoute();
  const hasRoute = Boolean(route);
  const selectedType = mobileRouteType(route);
  const selectedEnd = route?.end || '';
  const selectedColor = route ? normalizeRouteStyle(route).color : '';

  document.body.classList.toggle('has-selected-route', hasRoute);
  document.querySelectorAll('.mobile-line-row').forEach((row) => {
    row.hidden = !hasRoute;
    row.setAttribute('aria-hidden', String(!hasRoute));
  });
  document.querySelectorAll('[data-line-type]').forEach((button) => {
    button.disabled = !hasRoute;
    button.classList.toggle('is-active', hasRoute && button.dataset.lineType === selectedType);
  });
  document.querySelectorAll('[data-mobile-end-cap]').forEach((button) => {
    button.disabled = !hasRoute;
    button.classList.toggle('is-active', hasRoute && button.dataset.mobileEndCap === selectedEnd);
  });
  document.querySelectorAll('[data-mobile-line-color]').forEach((button) => {
    const buttonColor = normalizeRouteColor(button.dataset.mobileLineColor);
    button.disabled = !hasRoute;
    button.classList.toggle('is-active', hasRoute && buttonColor === selectedColor);
  });
}

function syncMobilePlayerControls() {
  const player = state.selectedType === 'player'
    ? state.players.find((item) => item.id === state.selectedId)
    : null;
  const hasPlayer = Boolean(player);
  const selectedMark = player ? playerMark(player) : '';

  document.body.classList.toggle('has-selected-player', hasPlayer);
  document.querySelectorAll('.mobile-player-row').forEach((row) => {
    row.hidden = !hasPlayer;
    row.setAttribute('aria-hidden', String(!hasPlayer));
  });
  document.querySelectorAll('[data-mobile-player-mark]').forEach((button) => {
    const mark = button.dataset.mobilePlayerMark;
    button.disabled = !hasPlayer;
    button.classList.toggle('is-active', hasPlayer && mark === selectedMark);
  });
  document.querySelectorAll('[data-action="rename-selected-player"]').forEach((button) => {
    const label = button.querySelector('span:last-child');
    const canRename = hasPlayer && canSwapPlayerNumber(player);
    button.disabled = !canRename;
    button.title = canRename
      ? `Swap player ${player.label} with 3, 4, or 5`
      : hasPlayer ? '1 and 2 are fixed' : 'Change player number';
    if (label && label !== button.querySelector('.tool-icon')) {
      label.textContent = hasPlayer ? `No.${player.label}` : 'No.';
    }
  });
}

function syncDefenseVisibilityControls() {
  document.querySelectorAll('[data-action="toggle-defense-visible"]').forEach((button) => {
    const label = button.querySelector('span:last-child');
    if (label && label !== button.querySelector('.tool-icon')) {
      label.textContent = state.defenseVisible ? 'Hide D' : 'Show D';
    } else {
      button.textContent = state.defenseVisible ? 'Hide D' : 'Show D';
    }
    button.title = state.defenseVisible ? 'Hide defense' : 'Show defense';
  });
}

function syncDefenseFormationButtons() {
  document.querySelectorAll('[data-defense-formation]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.defenseFormation === state.defenseFormation);
  });
}

function syncSelectionControls() {
  const selectedNote = state.selectedType === 'annotation'
    ? state.annotations.find((note) => note.id === state.selectedId)
    : null;
  controls.selectionBadge.textContent = selectionLabel();
  controls.selectedText.disabled = !selectedNote;
  controls.selectedText.value = selectedNote?.text || '';
  syncDockActionButtons();
  syncMobileDockPanels();
}

function render() {
  controls.titleLabel.textContent = state.playName;
  const folderName = activeFolder()?.name || '';
  controls.folderLabel.textContent = folderName;
  controls.folderLabel.style.display = folderName ? 'block' : 'none';
  if (controls.bookNoteName) {
    controls.bookNoteName.textContent = folderName || 'My Play Book';
  }
  if (controls.playNoteName) {
    controls.playNoteName.textContent = state.playName || 'New Play';
  }
  controls.defenseToggle.checked = state.defenseVisible;
  syncDefenseVisibilityControls();
  syncPlayerSizeControl();
  syncEndCapSizeControl();
  syncLineStyleControls();
  syncRouteShapeControl();
  syncDefenseFormationButtons();
  
  // Update arrow marker size
  const marker = field.querySelector('#routeArrow');
  if (marker) {
    marker.setAttribute('markerWidth', 8 * state.endCapSize);
    marker.setAttribute('markerHeight', 8 * state.endCapSize);
  }

  drawSourceImage();
  drawGrid();
  drawRoutes();
  drawTemp();
  drawPlayers();
  drawText();
  drawMeta();
  drawMarkControls();
  renderPlaybookSelectors();
  syncSelectionControls();
  syncPresetButtons();
  syncPlaysetFileBadge();
}

function revealMobileSelectionControls(type) {
  if (type !== 'route' && type !== 'player') return;
  if (document.body.classList.contains('is-focus-mode')) {
    document.body.classList.remove('is-dock-minimized');
    if (typeof syncFocusDockMinimizeButton === 'function') syncFocusDockMinimizeButton();
    if (typeof clampFocusDock === 'function') window.requestAnimationFrame(() => clampFocusDock());
  }
}

function selectThing(type, id) {
  state.selectedType = type;
  state.selectedId = id;
  revealMobileSelectionControls(type);
  if (type === 'route') {
    const route = state.routes.find((item) => item.id === id);
    if (route) controls.endCap.value = route.end;
  }
  render();
}
