(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (min, max, value) => Math.min(max, Math.max(min, value));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  const overlay = $('#sezOS');
  if (!overlay) return;

  const workspace = $('#szosWorkspace');
  const windowsRoot = $('#szosWindows');
  const spot = $('#szosSpotlight');
  const spotInput = $('#szosSpotInput');
  const spotResults = $('#szosSpotResults');
  const control = $('#szosControl');
  const lightbox = $('#szosLightbox');
  const lightboxArt = $('#szosLightboxArt');
  const lightboxCaption = $('#szosLightboxCaption');
  const lightboxClose = $('#szosLightboxClose');
  const toastEl = $('#szosToast');
  const noteInput = $('#szosNoteInput');
  const noteState = $('#szosNoteState');
  const noteClear = $('#szosNoteClear');
  const brightnessInput = $('#szosBrightness');
  const brightnessOut = $('#szosBrightnessOut');
  const brightnessOverlay = $('#szosBrightnessOverlay');
  const volumeInput = $('#szosVolume');
  const volumeOut = $('#szosVolumeOut');
  const musicVolume = $('#szosMusicVolume');
  const musicPlay = $('#szosMusicPlay');
  const playIcon = $('#szosPlayIcon');
  const trackTitle = $('#szosTrackTitle');
  const trackArtist = $('#szosTrackArtist');
  const musicState = $('#szosMusicState');
  const album = $('#szosAlbum');
  const focusRing = $('#szosFocusRing');
  const focusTime = $('#szosFocusTime');
  const focusToggle = $('#szosFocusToggle');
  const focusReset = $('#szosFocusReset');
  const sunClockNodes = $$('[data-szos-clock]');
  const dateNodes = $$('[data-szos-date]');
  const pageRoots = [$('.site-header'), $('main'), $('.site-footer')].filter(Boolean);
  const windows = new Map($$('.szos-window', overlay).map((win) => [win.dataset.szosWindow, win]));
  const openTriggers = $$('[data-open-os]');
  const focusModes = $$('[data-szos-focus-mode]', overlay);

  overlay.tabIndex = -1;
  windows.forEach((win) => {
    win.tabIndex = -1;
    if (!$('.szos-resize', win)) {
      const grip = document.createElement('span');
      grip.className = 'szos-resize';
      grip.dataset.szosResize = '';
      grip.setAttribute('aria-hidden', 'true');
      win.appendChild(grip);
    }
  });

  let isOpen = false;
  let isClosing = false;
  let lastTrigger = null;
  let activeWindow = null;
  let topZ = 20;
  let historyPushed = false;
  let ignoreHistoryPop = false;
  let spotlightOpen = false;
  let controlOpen = false;
  let lightboxOpen = false;
  let lightboxReturnFocus = null;
  let toastTimer = null;
  let noteTimer = null;
  let dragState = null;
  let resizeState = null;
  let closeTimers = new Map();
  let selectedResult = 0;

  const state = {
    wall: 'aurora',
    accent: 'mint',
    calm: false,
    wifi: true,
    brightness: 88,
    volume: 62,
  };

  const accents = {
    mint: { value: '#bdffea', rgb: '189, 255, 234' },
    peach: { value: '#ffc9ae', rgb: '255, 201, 174' },
    blue: { value: '#a9ccff', rgb: '169, 204, 255' },
  };

  const appMeta = {
    welcome: { title: 'SEZ 欢迎', subtitle: 'LIQUID DESKTOP', icon: 'i-spark', keywords: 'sez welcome 欢迎 关于' },
    weather: { title: '天气', subtitle: 'WEATHER / SHANGHAI', icon: 'si-cloud-sun', keywords: 'weather 天气 shanghai' },
    notes: { title: '笔记', subtitle: 'NOTES / LOCAL', icon: 'si-note', keywords: 'notes note 笔记 便签' },
    photos: { title: '照片', subtitle: 'LIGHT STUDIES / 06', icon: 'si-photo', keywords: 'photos 照片 图库 light' },
    music: { title: '音乐', subtitle: 'GENERATIVE AMBIENT', icon: 'si-music', keywords: 'music 音乐 ambient 环境音' },
    settings: { title: '设置', subtitle: 'DESKTOP APPEARANCE', icon: 'si-gear', keywords: 'settings 设置 壁纸 光色' },
    focus: { title: '专注', subtitle: 'DEEP WORK / TIMER', icon: 'si-focus', keywords: 'focus 专注 计时' },
  };

  const presets = {
    welcome: { width: 680, height: 432, align: 'center', top: 58 },
    weather: { width: 520, height: 520, align: 'left', top: 64 },
    notes: { width: 660, height: 462, align: 'right', top: 64 },
    photos: { width: 690, height: 500, align: 'center', top: 48 },
    music: { width: 500, height: 548, align: 'right', top: 52 },
    settings: { width: 620, height: 474, align: 'center', top: 58 },
    focus: { width: 440, height: 540, align: 'center', top: 58 },
  };

  /* ------------------------------------------------------------------
     Clock
  ------------------------------------------------------------------ */

  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function updateClock() {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const date = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`;
    sunClockNodes.forEach((node) => { node.textContent = time; });
    dateNodes.forEach((node) => { node.textContent = date; });
  }

  updateClock();
  window.setInterval(updateClock, 30_000);

  /* ------------------------------------------------------------------
     Small helpers
  ------------------------------------------------------------------ */

  function showToast(message) {
    if (!toastEl) return;
    window.clearTimeout(toastTimer);
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), 2200);
  }

  function setRangeFill(input) {
    if (!input) return;
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    const percent = max === min ? 0 : clamp(0, 100, ((value - min) / (max - min)) * 100);
    input.style.setProperty('--szos-fill', `${percent}%`);
  }

  function getFocusable() {
    const candidates = $$('button, input, textarea, select, [tabindex]:not([tabindex="-1"])', overlay);
    return candidates.filter((element) => {
      if (element.disabled) return false;
      if (element.closest('[inert]')) return false;
      if (element.getAttribute('aria-hidden') === 'true') return false;
      const style = window.getComputedStyle(element);
      return style.visibility !== 'hidden' && style.display !== 'none' && element.getClientRects().length > 0;
    });
  }

  function trapFocus(event) {
    if (event.key !== 'Tab' || !isOpen) return;
    const focusables = getFocusable();
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  }

  function setPageInert(inert) {
    pageRoots.forEach((root) => { root.inert = inert; });
  }

  /* ------------------------------------------------------------------
     Wallpaper, accent, brightness
  ------------------------------------------------------------------ */

  function setWall(name, announce = false) {
    state.wall = name;
    $$('.szos-wall-img', overlay).forEach((image) => {
      image.classList.toggle('is-active', image.dataset.szosWall === name);
    });
    $$('[data-szos-wall]', overlay).forEach((button) => {
      button.classList.toggle('is-active', button.dataset.szosWall === name);
      if (button.hasAttribute('aria-pressed')) {
        button.setAttribute('aria-pressed', button.dataset.szosWall === name ? 'true' : 'false');
      }
    });
    if (announce) showToast(`壁纸 · ${name === 'aurora' ? '极光' : name === 'dusk' ? '暮日' : '潮汐'}`);
  }

  function setAccent(name, announce = false) {
    if (!accents[name]) return;
    state.accent = name;
    overlay.style.setProperty('--szos-accent', accents[name].value);
    overlay.style.setProperty('--szos-accent-rgb', accents[name].rgb);
    $$('[data-szos-accent]', overlay).forEach((button) => {
      button.setAttribute('aria-pressed', button.dataset.szosAccent === name ? 'true' : 'false');
    });
    if (announce) showToast(`光色 · ${name === 'mint' ? '薄荷' : name === 'peach' ? '蜜桃' : '冰蓝'}`);
  }

  function setBrightness(value) {
    state.brightness = clamp(20, 100, Number(value) || 0);
    if (brightnessInput) brightnessInput.value = state.brightness;
    if (brightnessOut) brightnessOut.textContent = `${state.brightness}%`;
    if (brightnessOverlay) brightnessOverlay.style.opacity = String((100 - state.brightness) / 100 * 0.72);
    setRangeFill(brightnessInput);
  }

  function setVolume(value, fromMusic = false) {
    state.volume = clamp(0, 100, Number(value) || 0);
    if (volumeInput) volumeInput.value = state.volume;
    if (volumeOut) volumeOut.textContent = `${state.volume}%`;
    setRangeFill(volumeInput);
    if (musicVolume) {
      if (!fromMusic) musicVolume.value = state.volume;
      setRangeFill(musicVolume);
    }
    if (music.master && music.context) {
      music.master.gain.setTargetAtTime((state.volume / 100) * 0.12, music.context.currentTime, .15);
    }
  }

  function setWifi(on) {
    state.wifi = Boolean(on);
    const wifiButton = $('[data-szos-quick="wifi"]', overlay);
    if (wifiButton) {
      wifiButton.setAttribute('aria-pressed', state.wifi ? 'true' : 'false');
      const small = $('small', wifiButton);
      if (small) small.textContent = state.wifi ? 'ON' : 'OFF';
    }
  }

  /* ------------------------------------------------------------------
     Window management
  ------------------------------------------------------------------ */

  function workspaceSize() {
    const rect = workspace.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  function ensureGeometry(win) {
    if (win.dataset.szosPlaced === 'true') return;
    const preset = presets[win.dataset.szosWindow] || presets.welcome;
    const { width, height } = workspaceSize();
    const w = Math.min(preset.width, Math.max(320, width - 64));
    const h = Math.min(preset.height, Math.max(280, height - 106));
    const left = preset.align === 'right'
      ? width - w - 74
      : preset.align === 'center'
        ? (width - w) / 2
        : 76;
    win.style.width = `${Math.round(w)}px`;
    win.style.height = `${Math.round(h)}px`;
    win.style.left = `${Math.round(clamp(16, width - w - 16, left))}px`;
    win.style.top = `${Math.round(clamp(12, height - h - 96, preset.top))}px`;
    win.dataset.szosPlaced = 'true';
  }

  function clampWindow(win) {
    const { width, height } = workspaceSize();
    const rect = win.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const left = parseFloat(win.style.left) || rect.left;
    const top = parseFloat(win.style.top) || rect.top;
    win.style.left = `${Math.round(clamp(8, Math.max(8, width - w - 8), left))}px`;
    win.style.top = `${Math.round(clamp(8, Math.max(8, height - h - 94), top))}px`;
  }

  function updateDock() {
    $$('.szos-dock [data-szos-open]', overlay).forEach((button) => {
      const win = windows.get(button.dataset.szosOpen);
      button.classList.toggle('is-running', Boolean(win && (win.classList.contains('is-open') || win.classList.contains('is-minimized'))));
    });
    const musicDock = $('.szos-dock [data-szos-open="music"]', overlay);
    if (musicDock) musicDock.classList.toggle('is-playing', music.playing);
  }

  function refocusStack() {
    if (topZ > 80) {
      const open = Array.from(windows.values())
        .filter((win) => win.classList.contains('is-open') || win.classList.contains('is-minimized'))
        .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0));
      open.forEach((win, index) => { win.style.zIndex = String(20 + index); });
      topZ = 20 + open.length;
    }
  }

  function focusWindow(win) {
    if (!win || !win.classList.contains('is-open') || win.classList.contains('is-minimized')) return;
    refocusStack();
    windows.forEach((candidate) => candidate.classList.remove('is-active'));
    win.classList.add('is-active');
    win.style.zIndex = String(++topZ);
    activeWindow = win;
  }

  function nextWindow() {
    const open = Array.from(windows.values())
      .filter((win) => win.classList.contains('is-open') && !win.classList.contains('is-minimized') && !win.classList.contains('is-closing'))
      .sort((a, b) => Number(b.style.zIndex || 0) - Number(a.style.zIndex || 0));
    return open.find((win) => win !== activeWindow) || null;
  }

  function updateCloseFocus(win) {
    if (!isOpen || activeWindow !== win) return;
    activeWindow = null;
    const next = nextWindow();
    if (next) {
      focusWindow(next);
      next.focus({ preventScroll: true });
    } else {
      overlay.focus({ preventScroll: true });
    }
  }

  function openWindow(name, trigger) {
    const win = windows.get(name);
    if (!win) return;

    ensureGeometry(win);
    window.clearTimeout(closeTimers.get(name));
    closeTimers.delete(name);
    win.classList.remove('is-closing', 'is-minimized');
    win.classList.add('is-open');
    win.inert = false;
    win.setAttribute('aria-hidden', 'false');
    if (!win.classList.contains('is-maximized')) clampWindow(win);
    focusWindow(win);
    updateDock();

    if (name === 'notes') {
      // Keep the desktop keyboard-first, but land close to the writing surface.
      win.focus({ preventScroll: true });
    } else {
      win.focus({ preventScroll: true });
    }

    if (trigger) {
      trigger.blur?.();
    }
  }

  function closeWindow(win, { instant = false } = {}) {
    if (!win || !win.classList.contains('is-open')) return;
    window.clearTimeout(closeTimers.get(win.dataset.szosWindow));
    win.classList.remove('is-active', 'is-minimized');
    win.classList.add('is-closing');
    win.inert = true;
    win.setAttribute('aria-hidden', 'true');
    updateCloseFocus(win);
    updateDock();

    const finish = () => {
      win.classList.remove('is-open', 'is-closing');
      win.style.zIndex = '';
      closeTimers.delete(win.dataset.szosWindow);
      updateDock();
    };

    if (instant || reduceMotion.matches) {
      finish();
      return;
    }

    closeTimers.set(win.dataset.szosWindow, window.setTimeout(finish, 320));
  }

  function minimizeWindow(win) {
    if (!win || !win.classList.contains('is-open')) return;
    win.classList.add('is-minimized');
    win.classList.remove('is-active');
    win.inert = true;
    win.setAttribute('aria-hidden', 'true');
    updateCloseFocus(win);
    updateDock();
  }

  function restoreWindow(win) {
    if (!win) return;
    win.classList.remove('is-minimized', 'is-closing');
    win.classList.add('is-open');
    win.inert = false;
    win.setAttribute('aria-hidden', 'false');
    focusWindow(win);
    updateDock();
    win.focus({ preventScroll: true });
  }

  function toggleMaximize(win) {
    if (!win) return;
    if (win.classList.contains('is-maximized')) {
      win.classList.remove('is-maximized');
      const saved = win.dataset.szosGeometry;
      if (saved) {
        try {
          const geometry = JSON.parse(saved);
          win.style.left = geometry.left;
          win.style.top = geometry.top;
          win.style.width = geometry.width;
          win.style.height = geometry.height;
        } catch (error) { /* keep the current size */ }
      }
    } else {
      win.dataset.szosGeometry = JSON.stringify({
        left: win.style.left,
        top: win.style.top,
        width: win.style.width,
        height: win.style.height,
      });
      win.classList.add('is-maximized');
    }
    focusWindow(win);
  }

  function showDesktop() {
    windows.forEach((win) => {
      if (win.classList.contains('is-open')) closeWindow(win, { instant: reduceMotion.matches });
    });
    activeWindow = null;
    overlay.focus({ preventScroll: true });
    showToast('桌面已清空，只留下光。');
  }

  function resetWindows(instant = true) {
    windows.forEach((win) => {
      window.clearTimeout(closeTimers.get(win.dataset.szosWindow));
      closeTimers.delete(win.dataset.szosWindow);
      win.classList.remove('is-open', 'is-minimized', 'is-closing', 'is-active', 'is-maximized');
      win.inert = true;
      win.setAttribute('aria-hidden', 'true');
      win.style.zIndex = '';
      if (instant) win.style.transform = '';
    });
    activeWindow = null;
    updateDock();
  }

  /* ------------------------------------------------------------------
     Open / close the computer desktop
  ------------------------------------------------------------------ */

  function openOS(trigger) {
    if (isOpen || isClosing) return;

    isOpen = true;
    lastTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
    updateClock();
    resetWindows();
    closeSpotlight(true);
    closeControl(true);
    closeLightbox(true);
    setPageInert(true);
    document.body.classList.add('szos-open');
    document.documentElement.classList.add('szos-lock');
    overlay.inert = false;
    overlay.setAttribute('aria-hidden', 'false');
    overlay.classList.add('is-visible');

    if (!historyPushed) {
      try {
        window.history.pushState({ ...(window.history.state || {}), sezOS: true }, '', window.location.href);
        historyPushed = true;
      } catch (error) {
        historyPushed = false;
      }
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        overlay.classList.add('is-open');
      });
    });

    window.setTimeout(() => {
      if (!isOpen) return;
      openWindow('welcome');
    }, reduceMotion.matches ? 20 : 320);
  }

  function closeOS(fromHistory = false) {
    if (!isOpen || isClosing) return;

    isClosing = true;
    closeSpotlight(true);
    closeControl(true);
    closeLightbox(true);
    pauseFocus();
    pauseMusic();
    resetWindows();
    overlay.classList.remove('is-open');

    window.setTimeout(() => {
      if (!isOpen && music.context && music.context.state === 'running') {
        music.context.suspend().catch(() => {});
      }
    }, 900);

    window.setTimeout(() => {
      overlay.classList.remove('is-visible');
      overlay.inert = true;
      overlay.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('szos-open');
      document.documentElement.classList.remove('szos-lock');
      setPageInert(false);
      isOpen = false;
      isClosing = false;

      if (historyPushed && !fromHistory) {
        historyPushed = false;
        ignoreHistoryPop = true;
        try {
          window.history.back();
        } catch (error) {
          ignoreHistoryPop = false;
        }
      } else if (fromHistory) {
        historyPushed = false;
      }

      if (lastTrigger instanceof HTMLElement && lastTrigger.isConnected) {
        lastTrigger.focus({ preventScroll: true });
      }
    }, reduceMotion.matches ? 20 : 540);
  }

  /* ------------------------------------------------------------------
     Dock, buttons and pointer gestures
  ------------------------------------------------------------------ */

  function makeWindowsInteractive() {
    windows.forEach((win) => {
      ensureGeometry(win);
      clampWindow(win);
    });
  }

  windowsRoot.addEventListener('pointerdown', (event) => {
    const win = event.target.closest('.szos-window');
    if (win) focusWindow(win);
  });

  if (finePointer.matches && !reduceMotion.matches) {
    windowsRoot.addEventListener('pointermove', (event) => {
      const win = event.target.closest('.szos-window');
      if (!win) return;
      const rect = win.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      win.style.setProperty('--szos-glint-x', `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
      win.style.setProperty('--szos-glint-y', `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
    }, { passive: true });
  }

  windowsRoot.addEventListener('dblclick', (event) => {
    const win = event.target.closest('.szos-window');
    if (!win) return;
    if (event.target.closest('button, input, textarea')) return;
    toggleMaximize(win);
  });

  windowsRoot.addEventListener('pointerdown', (event) => {
    const winbar = event.target.closest('.szos-winbar');
    if (!winbar || event.target.closest('button')) return;
    const win = winbar.closest('.szos-window');
    if (!win || win.classList.contains('is-maximized')) return;
    focusWindow(win);
    dragState = {
      win,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: parseFloat(win.style.left) || win.offsetLeft,
      top: parseFloat(win.style.top) || win.offsetTop,
    };
    win.classList.add('is-dragging');
    try { winbar.setPointerCapture(event.pointerId); } catch (error) { /* fallback to window */ }
    event.preventDefault();
  });

  windowsRoot.addEventListener('pointermove', (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const { win } = dragState;
    const { width, height } = workspaceSize();
    const rect = win.getBoundingClientRect();
    const maxLeft = Math.max(8, width - rect.width - 8);
    const maxTop = Math.max(8, height - rect.height - 94);
    win.style.left = `${Math.round(clamp(8, maxLeft, dragState.left + event.clientX - dragState.startX))}px`;
    win.style.top = `${Math.round(clamp(8, maxTop, dragState.top + event.clientY - dragState.startY))}px`;
  });

  function endDrag(event) {
    if (!dragState) return;
    dragState.win.classList.remove('is-dragging');
    dragState = null;
    if (event?.pointerId !== undefined) {
      try { windowsRoot.releasePointerCapture(event.pointerId); } catch (error) { /* noop */ }
    }
  }

  windowsRoot.addEventListener('pointerup', endDrag);
  windowsRoot.addEventListener('pointercancel', endDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);

  windowsRoot.addEventListener('pointerdown', (event) => {
    const win = event.target.closest('.szos-window');
    const grip = event.target.closest('.szos-resize');
    if (!win || !grip || win.classList.contains('is-maximized')) return;
    focusWindow(win);
    resizeState = {
      win,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      width: win.offsetWidth,
      height: win.offsetHeight,
    };
    win.classList.add('is-resizing');
    try { grip.setPointerCapture(event.pointerId); } catch (error) { /* noop */ }
    event.preventDefault();
  });

  windowsRoot.addEventListener('pointermove', (event) => {
    if (!resizeState || event.pointerId !== resizeState.pointerId) return;
    const { win, width, height, startX, startY } = resizeState;
    const { width: maxWidth, height: maxHeight } = workspaceSize();
    const nextWidth = clamp(320, Math.max(320, maxWidth - 20), width + event.clientX - startX);
    const nextHeight = clamp(260, Math.max(260, maxHeight - 100), height + event.clientY - startY);
    win.style.width = `${Math.round(nextWidth)}px`;
    win.style.height = `${Math.round(nextHeight)}px`;
  });

  function endResize(event) {
    if (!resizeState) return;
    resizeState.win.classList.remove('is-resizing');
    resizeState = null;
    if (event?.pointerId !== undefined) {
      try { windowsRoot.releasePointerCapture(event.pointerId); } catch (error) { /* noop */ }
    }
  }

  windowsRoot.addEventListener('pointerup', endResize);
  windowsRoot.addEventListener('pointercancel', endResize);
  window.addEventListener('pointerup', endResize);
  window.addEventListener('pointercancel', endResize);

  /* ------------------------------------------------------------------
     Dock / menu interactions
  ------------------------------------------------------------------ */

  function openFromTrigger(trigger) {
    const name = trigger.dataset.szosOpen;
    if (!name) return;
    const win = windows.get(name);
    if (!win) return;
    if (win.classList.contains('is-minimized')) restoreWindow(win);
    else openWindow(name, trigger);
    if (spotlightOpen) closeSpotlight();
    if (controlOpen) closeControl();
  }

  function toggleControl(force) {
    const next = typeof force === 'boolean' ? force : !controlOpen;
    controlOpen = next;
    control.classList.toggle('is-open', next);
    control.setAttribute('aria-hidden', next ? 'false' : 'true');
    if (next) {
      closeSpotlight(true);
      const first = getFocusable().find((element) => element.closest('#szosControl'));
      first?.focus({ preventScroll: true });
    }
  }

  function closeControl(instant = false) {
    if (!controlOpen && !control.classList.contains('is-open')) return;
    controlOpen = false;
    control.classList.remove('is-open');
    control.setAttribute('aria-hidden', 'true');
    if (!instant && isOpen) overlay.focus({ preventScroll: true });
  }

  function renderSpotlight(query = '') {
    if (!spotResults) return;
    const needle = query.trim().toLowerCase();
    const entries = Object.entries(appMeta).filter(([, meta]) => {
      return !needle || `${meta.title} ${meta.subtitle} ${meta.keywords}`.toLowerCase().includes(needle);
    });
    spotResults.innerHTML = '';
    selectedResult = 0;
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'szos-spot-empty';
      empty.textContent = '没有找到这束光，换个关键词试试。';
      spotResults.appendChild(empty);
      return;
    }
    entries.forEach(([name, meta], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.szosOpen = name;
      button.setAttribute('role', 'option');
      button.classList.toggle('is-selected', index === 0);
      const icon = document.createElement('span');
      icon.innerHTML = `<svg width="15" height="15" aria-hidden="true"><use href="#${meta.icon}"></use></svg>`;
      const copy = document.createElement('span');
      copy.style.display = 'flex';
      copy.style.flexDirection = 'column';
      const strong = document.createElement('strong');
      strong.textContent = meta.title;
      const small = document.createElement('small');
      small.textContent = meta.subtitle;
      copy.append(strong, small);
      const key = document.createElement('em');
      key.textContent = index === 0 ? 'ENTER' : '';
      button.append(icon, copy, key);
      spotResults.appendChild(button);
    });
  }

  function openSpotlight() {
    spotlightOpen = true;
    spot.classList.add('is-open');
    spot.setAttribute('aria-hidden', 'false');
    if (spotInput) {
      spotInput.value = '';
      renderSpotlight('');
      window.setTimeout(() => spotInput.focus({ preventScroll: true }), reduceMotion.matches ? 10 : 80);
    }
    closeControl(true);
  }

  function closeSpotlight(instant = false) {
    if (!spotlightOpen && !spot.classList.contains('is-open')) return;
    spotlightOpen = false;
    spot.classList.remove('is-open');
    spot.setAttribute('aria-hidden', 'true');
    if (!instant && isOpen) overlay.focus({ preventScroll: true });
  }

  function openLightbox(button) {
    if (!button || !lightbox) return;
    closeSpotlight(true);
    closeControl(true);
    const read = (name) => (button.style.getPropertyValue(name) || '').trim();
    const a = read('--p-a') || '#5b8cff';
    const b = read('--p-b') || '#1d394c';
    const c = read('--p-c') || '#6ce5cf';
    lightboxArt.style.background = `radial-gradient(circle at 30% 26%, rgba(255,255,255,.65), transparent 16%), radial-gradient(circle at 72% 72%, ${c}, transparent 50%), linear-gradient(140deg, ${a}, ${b})`;
    lightboxCaption.textContent = button.dataset.caption || 'SEZ / LIGHT STUDY';
    lightboxReturnFocus = button;
    const win = button.closest('.szos-window');
    if (win) { win.inert = true; win.setAttribute('aria-hidden', 'true'); }
    lightboxOpen = true;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    lightboxClose?.focus({ preventScroll: true });
  }

  function closeLightbox(instant = false) {
    if (!lightboxOpen && !lightbox.classList.contains('is-open')) return;
    lightboxOpen = false;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    const win = lightboxReturnFocus?.closest('.szos-window');
    if (win && win.classList.contains('is-open')) {
      win.inert = false;
      win.setAttribute('aria-hidden', 'false');
    }
    if (!instant && isOpen && lightboxReturnFocus?.isConnected) {
      lightboxReturnFocus.focus({ preventScroll: true });
    }
    lightboxReturnFocus = null;
  }

  /* ------------------------------------------------------------------
     Notes
  ------------------------------------------------------------------ */

  const NOTE_KEY = 'sez-desktop-note-v1';
  const DEFAULT_NOTE = '让光慢一点。\n\n今天，我把桌面做成了液体的样子。';

  function loadNote() {
    try { return window.localStorage.getItem(NOTE_KEY) ?? DEFAULT_NOTE; }
    catch (error) { return DEFAULT_NOTE; }
  }

  function saveNote(value) {
    try {
      window.localStorage.setItem(NOTE_KEY, value);
      if (noteState) noteState.textContent = 'SAVED';
    } catch (error) {
      if (noteState) noteState.textContent = 'LOCAL';
    }
  }

  if (noteInput) {
    noteInput.value = loadNote();
    noteInput.addEventListener('input', () => {
      if (noteState) noteState.textContent = 'WRITING';
      window.clearTimeout(noteTimer);
      noteTimer = window.setTimeout(() => saveNote(noteInput.value), 420);
    });
    noteInput.addEventListener('blur', () => saveNote(noteInput.value));
  }

  noteClear?.addEventListener('click', () => {
    if (!noteInput) return;
    noteInput.value = '';
    saveNote('');
    noteInput.focus({ preventScroll: true });
    showToast('纸页已经清空');
  });

  /* ------------------------------------------------------------------
     Music
  ------------------------------------------------------------------ */

  const tracks = [
    { title: 'Liquid Hours', artist: 'SEZ · Ambient 01', freqs: [130.81, 196, 261.63, 329.63], colors: ['#1a5875', '#55378b', '#6ce5cf'] },
    { title: 'Glass Rain', artist: 'SEZ · Ambient 02', freqs: [146.83, 174.61, 220, 293.66], colors: ['#6b2d4b', '#8b5d36', '#ffc49c'] },
    { title: 'Slow Light', artist: 'SEZ · Ambient 03', freqs: [110, 164.81, 220, 277.18], colors: ['#105c5c', '#2a447b', '#8bdcf7'] },
  ];

  const music = {
    context: null,
    master: null,
    filter: null,
    voices: [],
    lfo: null,
    track: 0,
    playing: false,
  };

  function ensureAudio() {
    if (music.context) return true;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    music.context = new AudioContext();
    music.master = music.context.createGain();
    music.master.gain.value = (state.volume / 100) * 0.12;
    music.filter = music.context.createBiquadFilter();
    music.filter.type = 'lowpass';
    music.filter.frequency.value = 760;
    music.filter.Q.value = 0.6;
    music.master.connect(music.filter);
    music.filter.connect(music.context.destination);
    music.lfo = music.context.createOscillator();
    music.lfo.frequency.value = 0.07;
    const lfoGain = music.context.createGain();
    lfoGain.gain.value = 220;
    music.lfo.connect(lfoGain);
    lfoGain.connect(music.filter.frequency);
    music.lfo.start();
    return true;
  }

  function stopVoices() {
    const now = music.context?.currentTime || 0;
    music.voices.forEach(({ osc, gain }) => {
      try {
        gain.gain.cancelScheduledValues(now);
        gain.gain.setTargetAtTime(0, now, .15);
        osc.stop(now + .55);
      } catch (error) { /* already stopped */ }
    });
    music.voices = [];
  }

  function startVoices() {
    if (!ensureAudio()) return;
    music.context.resume().catch(() => {});
    const now = music.context.currentTime;
    const track = tracks[music.track];
    track.freqs.forEach((freq, index) => {
      const osc = music.context.createOscillator();
      osc.type = index % 2 ? 'sine' : 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = index * 3 - 5;
      const gain = music.context.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(music.master);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.16 / (index + 1.4), now + 2.4);
      osc.start(now);
      music.voices.push({ osc, gain });
    });
  }

  function syncMusicUI() {
    const track = tracks[music.track];
    if (trackTitle) trackTitle.textContent = track.title;
    if (trackArtist) trackArtist.textContent = track.artist;
    if (musicState) musicState.textContent = music.playing ? 'PLAYING / GENERATIVE' : 'PAUSED / READY';
    if (playIcon) playIcon.setAttribute('href', music.playing ? '#si-pause' : '#si-play');
    if (musicPlay) musicPlay.setAttribute('aria-label', music.playing ? '暂停环境音乐' : '播放环境音乐');
    overlay.classList.toggle('is-playing', music.playing);
    if (album) {
      album.style.background = `radial-gradient(circle at 28% 21%, rgba(255,255,255,.65), transparent 18%), radial-gradient(circle at 73% 70%, ${track.colors[2]}, transparent 48%), linear-gradient(145deg, ${track.colors[0]}, ${track.colors[1]})`;
    }
    updateDock();
  }

  function setTrack(index) {
    music.track = (index + tracks.length) % tracks.length;
    if (music.playing) {
      stopVoices();
      startVoices();
    }
    syncMusicUI();
  }

  function playMusic() {
    if (!ensureAudio()) {
      showToast('当前浏览器不支持生成式音频');
      return;
    }
    if (music.playing) return;
    startVoices();
    music.playing = true;
    syncMusicUI();
  }

  function pauseMusic() {
    if (!music.playing) return;
    stopVoices();
    music.playing = false;
    syncMusicUI();
  }

  musicPlay?.addEventListener('click', () => {
    if (music.playing) pauseMusic();
    else playMusic();
  });
  $('[data-szos-music-prev]', overlay)?.addEventListener('click', () => setTrack(music.track - 1));
  $('[data-szos-music-next]', overlay)?.addEventListener('click', () => setTrack(music.track + 1));
  musicVolume?.addEventListener('input', () => {
    setVolume(musicVolume.value, true);
    if (music.master && music.context) {
      music.master.gain.setTargetAtTime((state.volume / 100) * 0.12, music.context.currentTime, .1);
    }
  });

  /* ------------------------------------------------------------------
     Focus timer
  ------------------------------------------------------------------ */

  const focusState = {
    mode: 25,
    total: 25 * 60,
    remaining: 25 * 60,
    running: false,
    interval: null,
  };

  function syncFocusUI() {
    if (focusTime) {
      const minutes = Math.floor(focusState.remaining / 60).toString().padStart(2, '0');
      const seconds = (focusState.remaining % 60).toString().padStart(2, '0');
      focusTime.textContent = `${minutes}:${seconds}`;
    }
    if (focusRing) {
      const progress = focusState.total ? ((focusState.total - focusState.remaining) / focusState.total) * 100 : 0;
      focusRing.style.setProperty('--focus-progress', progress.toFixed(2));
    }
    if (focusToggle) focusToggle.textContent = focusState.running ? '暂停专注' : '开始专注';
    focusModes.forEach((button) => {
      const active = Number(button.dataset.szosFocusMode) === focusState.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function startFocus() {
    if (focusState.running) return;
    if (focusState.remaining <= 0) focusState.remaining = focusState.total;
    focusState.running = true;
    focusState.interval = window.setInterval(() => {
      focusState.remaining = Math.max(0, focusState.remaining - 1);
      syncFocusUI();
      if (focusState.remaining === 0) {
        pauseFocus();
        showToast('专注完成。光已经走完了这一程。');
      }
    }, 1000);
    syncFocusUI();
  }

  function pauseFocus() {
    if (focusState.interval) window.clearInterval(focusState.interval);
    focusState.interval = null;
    focusState.running = false;
    syncFocusUI();
  }

  function setFocusMode(minutes) {
    pauseFocus();
    focusState.mode = minutes;
    focusState.total = minutes * 60;
    focusState.remaining = focusState.total;
    syncFocusUI();
  }

  focusToggle?.addEventListener('click', () => {
    if (focusState.running) pauseFocus();
    else startFocus();
  });

  focusReset?.addEventListener('click', () => {
    pauseFocus();
    focusState.remaining = focusState.total;
    syncFocusUI();
  });

  focusModes.forEach((button) => {
    button.addEventListener('click', () => setFocusMode(Number(button.dataset.szosFocusMode)));
  });

  /* ------------------------------------------------------------------
     Settings & control values
  ------------------------------------------------------------------ */

  brightnessInput?.addEventListener('input', () => setBrightness(brightnessInput.value));
  volumeInput?.addEventListener('input', () => setVolume(volumeInput.value));

  $$('[data-szos-wall]', overlay).forEach((button) => {
    button.addEventListener('click', () => setWall(button.dataset.szosWall, true));
  });

  $$('[data-szos-accent]', overlay).forEach((button) => {
    button.addEventListener('click', () => setAccent(button.dataset.szosAccent, true));
  });

  $('[data-szos-calm]', overlay)?.addEventListener('click', (event) => {
    const button = event.currentTarget;
    state.calm = !state.calm;
    overlay.classList.toggle('is-calm', state.calm);
    button.setAttribute('aria-pressed', state.calm ? 'true' : 'false');
    showToast(state.calm ? '光，正在慢下来。' : '光，重新开始流动。');
  });

  $('[data-szos-quick="wifi"]', overlay)?.addEventListener('click', () => {
    setWifi(!state.wifi);
    showToast(state.wifi ? 'WI-FI · 已连接' : 'WI-FI · 已断开');
  });

  $('[data-szos-control-close]', overlay)?.addEventListener('click', () => closeControl());
  $$('[data-szos-control]', overlay).forEach((button) => {
    button.addEventListener('click', () => toggleControl());
  });
  $$('[data-szos-spotlight]', overlay).forEach((button) => {
    button.addEventListener('click', () => (spotlightOpen ? closeSpotlight() : openSpotlight()));
  });
  $$('[data-szos-sleep]', overlay).forEach((button) => {
    button.addEventListener('click', () => closeOS());
  });

  spotInput?.addEventListener('input', () => renderSpotlight(spotInput.value));
  spotInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const buttons = $$('button', spotResults);
      const chosen = buttons[selectedResult] || buttons[0];
      if (chosen) {
        event.preventDefault();
        chosen.click();
      }
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const buttons = $$('button', spotResults);
      if (!buttons.length) return;
      selectedResult = (selectedResult + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons.forEach((button, index) => button.classList.toggle('is-selected', index === selectedResult));
      buttons[selectedResult].scrollIntoView({ block: 'nearest' });
    }
  });

  spotResults?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-szos-open]');
    if (!button) return;
    openFromTrigger(button);
  });

  spot?.addEventListener('click', (event) => {
    if (event.target === spot) closeSpotlight();
  });

  lightboxClose?.addEventListener('click', () => closeLightbox());
  lightbox?.addEventListener('click', (event) => {
    if (event.target === lightbox) closeLightbox();
  });

  $$('.szos-photo', overlay).forEach((button) => {
    button.addEventListener('click', () => openLightbox(button));
  });

  $$('[data-szos-open]', overlay).forEach((button) => {
    button.addEventListener('click', () => openFromTrigger(button));
  });

  /* Window chrome events, attached through the windows root. */
  windowsRoot.addEventListener('click', (event) => {
    const win = event.target.closest('.szos-window');
    if (!win) return;
    if (event.target.closest('[data-szos-close]')) closeWindow(win);
    else if (event.target.closest('[data-szos-min]')) minimizeWindow(win);
    else if (event.target.closest('[data-szos-max]')) toggleMaximize(win);
  });

  $$('[data-szos-desktop]', overlay).forEach((button) => {
    button.addEventListener('click', showDesktop);
  });

  $$('[data-szos-next-wall]', overlay).forEach((button) => {
    button.addEventListener('click', () => {
      const walls = ['aurora', 'dusk', 'tide'];
      setWall(walls[(walls.indexOf(state.wall) + 1) % walls.length], true);
    });
  });

  /* Any click outside the control or spotlight dismisses those top sheets. */
  overlay.addEventListener('click', (event) => {
    if (controlOpen && !event.target.closest('#szosControl') && !event.target.closest('[data-szos-control]')) {
      closeControl(true);
    }
    if (spotlightOpen && !event.target.closest('.szos-spot-panel') && !event.target.closest('[data-szos-spotlight]')) {
      closeSpotlight(true);
    }
  });

  /* ------------------------------------------------------------------
     Keyboard, history, viewport
  ------------------------------------------------------------------ */

  window.addEventListener('popstate', () => {
    if (ignoreHistoryPop) {
      ignoreHistoryPop = false;
      return;
    }
    if (!isOpen) return;
    historyPushed = false;
    closeOS(true);
  });

  document.addEventListener('keydown', (event) => {
    if (!isOpen) return;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      if (spotlightOpen) closeSpotlight();
      else openSpotlight();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      if (lightboxOpen) closeLightbox();
      else if (spotlightOpen) closeSpotlight();
      else if (controlOpen) closeControl();
      else if (activeWindow) closeWindow(activeWindow);
      else closeOS();
      return;
    }

    // A window itself is the programmatic focus target. The first Tab should
    // enter that window, not jump to the dock on the other side of the DOM.
    if (event.key === 'Tab' && activeWindow && document.activeElement === activeWindow) {
      const inner = getFocusable().filter((element) => activeWindow.contains(element));
      if (inner.length) {
        event.preventDefault();
        (event.shiftKey ? inner[inner.length - 1] : inner[0]).focus({ preventScroll: true });
        return;
      }
    }

    trapFocus(event);
  });

  window.addEventListener('resize', () => {
    if (!isOpen) return;
    windows.forEach((win) => {
      if (win.classList.contains('is-open') && !win.classList.contains('is-maximized')) clampWindow(win);
    });
  }, { passive: true });

  /* Keep drag gestures from turning into browser overscroll. */
  overlay.addEventListener('touchmove', (event) => {
    if (!isOpen || event.touches.length > 1) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('.szos-wbody, .szos-spot-results, .szos-control, textarea, input')) return;
    event.preventDefault();
  }, { passive: false });

  /* Long-lived visual state starts here. */
  setWall('aurora');
  setAccent('mint');
  setBrightness(state.brightness);
  setVolume(state.volume);
  setWifi(true);
  syncMusicUI();
  syncFocusUI();
  makeWindowsInteractive();

  openTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openOS(trigger));
  });

  overlay.inert = true;
  overlay.setAttribute('aria-hidden', 'true');
})();
