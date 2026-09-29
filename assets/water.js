/* A small damped wave simulation refracts the real HTML beneath it.
 * feDisplacementMap: https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feDisplacementMap
 * Only the low-resolution normal map is rasterized, never the page content.
 */
(() => {
  'use strict';
  const surface = document.querySelector('[data-water-surface]');
  const content = surface?.querySelector('[data-water-content]');
  if (!surface || !content || !window.ResizeObserver || !window.IntersectionObserver) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const map = document.createElement('canvas');
  const mapContext = map.getContext('2d', { alpha: false });
  const light = document.createElement('canvas');
  const lightContext = light.getContext('2d');
  if (!mapContext || !lightContext) return;
  light.className = 'water-light';
  light.setAttribute('aria-hidden', 'true');

  const svgNS = 'http://www.w3.org/2000/svg';
  const makeSVG = (name, attributes) => {
    const node = document.createElementNS(svgNS, name);
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    return node;
  };
  const definitions = makeSVG('svg', {
    class: 'water-filter-definitions', 'aria-hidden': 'true', focusable: 'false',
  });
  const filter = makeSVG('filter', {
    id: 'hero-water-refraction', filterUnits: 'userSpaceOnUse',
    'color-interpolation-filters': 'sRGB', x: '-12', y: '-12',
  });
  // Neutral normals outside the map preserve overhanging glyphs and focus rings.
  const neutral = makeSVG('feFlood', {
    x: '-12', y: '-12', 'flood-color': '#808080', result: 'water-neutral',
  });
  const mapImage = makeSVG('feImage', { x: '0', y: '0', preserveAspectRatio: 'none', result: 'water-normal' });
  const paddedMap = makeSVG('feComposite', {
    x: '-12', y: '-12', in: 'water-normal', in2: 'water-neutral', operator: 'over', result: 'water-padded-normal',
  });
  const displacement = makeSVG('feDisplacementMap', {
    x: '-12', y: '-12', in: 'SourceGraphic', in2: 'water-padded-normal', scale: '24', xChannelSelector: 'R', yChannelSelector: 'G',
  });
  filter.append(neutral, mapImage, paddedMap, displacement);
  definitions.append(filter);
  surface.append(definitions, light);

  let columns = 0;
  let rows = 0;
  let current, previous, damping, mapPixels, lightPixels;
  let frame = 0;
  let lastFrame = 0;
  let lastInput = 0;
  let lastPointer = null;
  let visible = false;
  let ready = false;
  let introduced = false;
  let failed = false;
  const frameInterval = 1000 / 30;

  function allowed() {
    return ready && visible && !failed && !motion.matches && !document.hidden && !document.querySelector('dialog[open]');
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = 0;
    lastFrame = 0;
    lastPointer = null;
    current?.fill(0);
    previous?.fill(0);
    lightContext.clearRect(0, 0, columns, rows);
    content.style.removeProperty('filter');
    surface.dataset.waterState = motion.matches ? 'reduced-motion' : allowed() ? 'idle' : 'paused';
  }

  function resize() {
    stop();
    const width = content.offsetWidth;
    const height = content.offsetHeight;
    if (!width || !height) { ready = false; return; }
    // Roughly 16–28k cells on desktop, with a hard cap on narrow, tall screens.
    columns = Math.min(224, Math.max(80, Math.round(width / 5)));
    rows = Math.min(220, Math.max(64, Math.round(columns * height / width)));
    map.width = light.width = columns;
    map.height = light.height = rows;
    current = new Float32Array(columns * rows);
    previous = new Float32Array(columns * rows);
    damping = new Float32Array(columns * rows);
    mapPixels = mapContext.createImageData(columns, rows);
    lightPixels = lightContext.createImageData(columns, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const edge = Math.min(x, y, columns - x - 1, rows - y - 1);
        // Absorb waves before they reach the section boundary.
        damping[y * columns + x] = .986 - Math.max(0, 8 - edge) * .014;
      }
    }
    light.style.left = `${content.offsetLeft}px`;
    light.style.top = `${content.offsetTop}px`;
    light.style.width = `${width}px`;
    light.style.height = `${height}px`;
    [filter, neutral, paddedMap, displacement].forEach((node) => {
      node.setAttribute('width', width + 24);
      node.setAttribute('height', height + 24);
    });
    mapImage.setAttribute('width', width);
    mapImage.setAttribute('height', height);
    ready = true;
    surface.dataset.waterState = allowed() ? 'idle' : 'paused';
  }

  function step() {
    let peak = 0;
    for (let y = 1; y < rows - 1; y++) {
      const start = y * columns;
      for (let x = 1; x < columns - 1; x++) {
        const i = start + x;
        const height = ((current[i - 1] + current[i + 1] + current[i - columns] + current[i + columns]) * .5 - previous[i]) * damping[i];
        previous[i] = height;
        peak = Math.max(peak, Math.abs(height));
      }
    }
    [current, previous] = [previous, current];
    return peak;
  }

  function paint() {
    const normal = mapPixels.data;
    const reflection = lightPixels.data;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < columns; x++) {
        const i = y * columns + x;
        const p = i * 4;
        const dx = x > 0 && x < columns - 1 ? current[i - 1] - current[i + 1] : 0;
        const dy = y > 0 && y < rows - 1 ? current[i - columns] - current[i + columns] : 0;
        normal[p] = 128 + Math.max(-68, Math.min(68, dx * 23));
        normal[p + 1] = 128 + Math.max(-68, Math.min(68, dy * 23));
        normal[p + 2] = 128;
        normal[p + 3] = 255;
        // Paired light and shadow from the same surface normals as refraction.
        const glint = dx * -.6 + dy * -.8;
        const bright = glint > 0;
        reflection[p] = bright ? 255 : 54;
        reflection[p + 1] = bright ? 255 : 71;
        reflection[p + 2] = bright ? 255 : 66;
        reflection[p + 3] = Math.min(bright ? 72 : 27, Math.abs(glint) * (bright ? 29 : 13));
      }
    }
    mapContext.putImageData(mapPixels, 0, 0);
    lightContext.putImageData(lightPixels, 0, 0);
    mapImage.setAttribute('href', map.toDataURL('image/png'));
    content.style.filter = 'url("#hero-water-refraction")';
  }

  function animate(now) {
    frame = 0;
    if (!allowed()) { stop(); return; }
    if (now - lastFrame >= frameInterval - 1) {
      lastFrame = now;
      step();
      const peak = step();
      // Damping normally reaches silence first; the deadline also bounds work.
      if ((peak < .025 && now - lastInput > 500) || now - lastInput > 6500) {
        stop();
        return;
      }
      try { paint(); }
      catch (_) { failed = true; stop(); return; }
    }
    frame = requestAnimationFrame(animate);
  }

  function disturb(x, y, strength = 1) {
    if (!allowed()) return;
    const centerX = x * columns;
    const centerY = y * rows;
    const radius = 4.5;
    for (let gy = Math.max(1, Math.floor(centerY - 9)); gy <= Math.min(rows - 2, centerY + 9); gy++) {
      for (let gx = Math.max(1, Math.floor(centerX - 9)); gx <= Math.min(columns - 2, centerX + 9); gx++) {
        const distance = (gx - centerX) ** 2 + (gy - centerY) ** 2;
        const ripple = Math.exp(-distance / (radius * radius)) * strength;
        const i = gy * columns + gx;
        current[i] += ripple;
        previous[i] += ripple * .55;
      }
    }
    lastInput = performance.now();
    surface.dataset.waterState = 'running';
    if (!frame) frame = requestAnimationFrame(animate);
  }

  function pointer(event) {
    if (!allowed() || (event.type === 'pointermove' && event.pointerType === 'touch')) return;
    const now = performance.now();
    const bounds = content.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    if (event.type === 'pointermove') {
      if (lastPointer && now - lastPointer.time < 45) return;
      const distance = lastPointer ? Math.hypot(event.clientX - lastPointer.x, event.clientY - lastPointer.y) : 20;
      if (distance < 5) return;
      disturb(x, y, Math.min(2.2, .85 + distance / 75));
    } else {
      disturb(x, y, event.pointerType === 'touch' ? 2.4 : 3.5);
    }
    lastPointer = { x: event.clientX, y: event.clientY, time: now };
  }

  surface.addEventListener('pointermove', pointer, { passive: true });
  surface.addEventListener('pointerdown', pointer, { passive: true });
  surface.addEventListener('pointerleave', () => { lastPointer = null; }, { passive: true });
  surface.addEventListener('pointercancel', () => { lastPointer = null; }, { passive: true });
  document.addEventListener('visibilitychange', stop);
  motion.addEventListener('change', stop);
  new ResizeObserver(resize).observe(content);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (!visible) stop();
    else if (!introduced && allowed()) {
      introduced = true;
      // One subtle opening wave; thereafter only the visitor stirs the surface.
      disturb(.73, .43, 1.6);
    }
  }).observe(surface);
  document.querySelectorAll('dialog').forEach((dialog) => {
    new MutationObserver(stop).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  });
  window.addEventListener('pagehide', stop);
  resize();
})();
