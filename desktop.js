(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (min, max, value) => Math.min(max, Math.max(min, value));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  const desktop = $('#sezDesktop');
  if (!desktop) return;

  const screen = $('#sezScreen');
  const device = $('#sezDevice');
  const homeView = $('#sezHomeView');
  const appLayer = $('#sezAppLayer');
  const sleepButton = $('#sezSleep');
  const homeIndicator = $('#sezHomeIndicator');
  const toast = $('#sezToast');
  const glare = $('#sezGlare');
  const brightnessOverlay = $('#sezBrightnessOverlay');
  const searchInput = $('#sezSearchInput');
  const searchResults = $('#sezSearchResults');
  const searchEmpty = $('#sezSearchEmpty');
  const openTriggers = $$('[data-open-desktop]');
  const appViews = $$('.sez-app-view', desktop);
  const pageRoots = [$('.site-header'), $('main'), $('.site-footer')].filter(Boolean);

  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const viewsByName = new Map(appViews.map((view) => [view.dataset.sezView, view]));

  appViews.forEach((view) => {
    view.tabIndex = -1;
  });

  let isOpen = false;
  let isClosing = false;
  let isAppClosing = false;
  let lastTrigger = null;
  let activeView = null;
  let activeName = '';
  let activeTrigger = null;
  let appCloseTimer = null;
  let openFocusTimer = null;
  let toastTimer = null;
  let noteSaveTimer = null;
  let photoReturnFocus = null;

  const state = {
    wallpaper: 'aurora',
    accent: 'mint',
    glare: true,
    motion: true,
    wifi: true,
    brightness: 88,
    volume: 62,
    track: 0,
    playing: false,
  };

  const accents = {
    mint: { value: '#bdffea', rgb: '189, 255, 234' },
    peach: { value: '#ffc9ae', rgb: '255, 201, 174' },
    blue: { value: '#a9ccff', rgb: '169, 204, 255' },
  };

  const tracks = [
    {
      title: 'Liquid Hours',
      artist: 'SEZ · Ambient 01',
      colors: ['#1b5d7b', '#583a8e', 'rgba(189, 255, 234, .64)'],
      freqs: [130.81, 196.0, 261.63, 329.63],
    },
    {
      title: 'Glass Rain',
      artist: 'SEZ · Ambient 02',
      colors: ['#71304d', '#92613b', 'rgba(255, 188, 160, .62)'],
      freqs: [146.83, 174.61, 220.0, 293.66],
    },
    {
      title: 'Slow Light',
      artist: 'SEZ · Ambient 03',
      colors: ['#116160', '#2b477f', 'rgba(155, 222, 255, .64)'],
      freqs: [110.0, 164.81, 220.0, 277.18],
    },
  ];

  const focusState = {
    mode: 25,
    total: 25 * 60,
    remaining: 25 * 60,
    running: false,
    interval: null,
  };

  const ambient = {
    context: null,
    master: null,
    filter: null,
    voices: [],
    lfo: null,
  };

  /* ------------------------------------------------------------------
     Clock & greeting
  ------------------------------------------------------------------ */

  function greetingForHour(hour) {
    if (hour >= 5 && hour < 11) return '早安';
    if (hour >= 11 && hour < 14) return '午安';
    if (hour >= 14 && hour < 19) return '下午好';
    if (hour >= 19 && hour < 24) return '晚上好';
    return '夜深了';
  }

  function updateClock() {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const date = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`;
    const greeting = greetingForHour(now.getHours());

    $$('[data-sez-clock]', desktop).forEach((element) => {
      element.textContent = time;
    });
    $$('[data-sez-date]', desktop).forEach((element) => {
      element.textContent = date;
    });
    $$('[data-sez-greeting]', desktop).forEach((element) => {
      element.textContent = greeting;
    });
  }

  window.setInterval(updateClock, 30_000);

  /* ------------------------------------------------------------------
     Small helpers
  ------------------------------------------------------------------ */

  function showToast(message) {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => {
      toast.classList.remove('is-visible');
    }, 2200);
  }

  function setRangeFill(input) {
    if (!input) return;
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    const percent = max === min ? 0 : clamp(0, 100, ((value - min) / (max - min)) * 100);
    input.style.setProperty('--sez-fill', `${percent}%`);
  }

  function getFocusable() {
    const candidates = $$('button, input, textarea, select, [tabindex]:not([tabindex="-1"])', desktop);
    return candidates.filter((element) => {
      if (element.disabled) return false;
      if (element.closest('[inert]')) return false;
      if (element.getAttribute('aria-hidden') === 'true') return false;
      const styles = window.getComputedStyle(element);
      return styles.visibility !== 'hidden' && styles.display !== 'none' && element.getClientRects().length > 0;
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
    pageRoots.forEach((root) => {
      root.inert = inert;
    });
  }

  /* ------------------------------------------------------------------
     Desktop open / close
  ------------------------------------------------------------------ */

  function openDesktop(trigger) {
    if (isOpen || isClosing) return;

    isOpen = true;
    lastTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
    updateClock();
    resetToHome();
    setPageInert(true);
    document.body.classList.add('sez-open');
    desktop.inert = false;
    desktop.setAttribute('aria-hidden', 'false');
    desktop.classList.add('is-visible');

    window.clearTimeout(openFocusTimer);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        desktop.classList.add('is-open');
      });
    });

    openFocusTimer = window.setTimeout(() => {
      if (isOpen) sleepButton?.focus({ preventScroll: true });
    }, reduceMotion.matches ? 30 : 300);
  }

  function closeDesktop() {
    if (!isOpen || isClosing) return;

    isClosing = true;
    window.clearTimeout(openFocusTimer);
    pauseFocusTimer();
    pauseAmbient();
    closePhotoViewer(true);
    resetToHome();
    desktop.classList.remove('is-open');

    window.setTimeout(() => {
      if (!isOpen && ambient.context && ambient.context.state === 'running') {
        ambient.context.suspend().catch(() => {});
      }
    }, 900);

    const delay = reduceMotion.matches ? 20 : 620;
    window.setTimeout(() => {
      desktop.classList.remove('is-visible');
      desktop.inert = true;
      desktop.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('sez-open');
      setPageInert(false);
      isOpen = false;
      isClosing = false;

      if (lastTrigger instanceof HTMLElement && lastTrigger.isConnected) {
        lastTrigger.focus({ preventScroll: true });
      }
    }, delay);
  }

  function resetToHome() {
    window.clearTimeout(appCloseTimer);
    isAppClosing = false;
    activeView = null;
    activeName = '';
    activeTrigger = null;
    appViews.forEach((view) => {
      view.classList.remove('is-open');
      view.style.zIndex = '';
      view.style.transformOrigin = '';
      view.inert = true;
      view.setAttribute('aria-hidden', 'true');
    });
    appLayer.classList.remove('is-active');
    appLayer.inert = true;
    appLayer.setAttribute('aria-hidden', 'true');
    homeView.inert = false;
    homeView.setAttribute('aria-hidden', 'false');
    homeView.classList.remove('is-app-open');
    closePhotoViewer(true);
  }

  function focusHomeFallback(name) {
    const fallback = $(`.sez-home-view [data-sez-open="${name}"]`);
    if (fallback) fallback.focus({ preventScroll: true });
    else homeIndicator?.focus({ preventScroll: true });
  }

  /* ------------------------------------------------------------------
     Apps & sheets
  ------------------------------------------------------------------ */

  function refreshApp(name) {
    if (name === 'control') syncControl();
    if (name === 'settings') syncSettings();
    if (name === 'focus') syncFocusUI();
    if (name === 'search') {
      searchInput.value = '';
      filterSearch('');
      window.setTimeout(() => {
        if (isOpen && activeName === 'search') searchInput.focus({ preventScroll: true });
      }, reduceMotion.matches ? 10 : 360);
    }
  }

  function openApp(name, trigger) {
    if (!isOpen || isClosing || isAppClosing) return;
    const view = viewsByName.get(name);
    if (!view || view === activeView) return;

    window.clearTimeout(openFocusTimer);

    const previous = activeView;
    const previousName = activeName;
    closePhotoViewer(true);

    if (previous) {
      previous.inert = true;
      previous.setAttribute('aria-hidden', 'true');
      previous.style.zIndex = '1';
      const fade = previous.animate(
        [{ opacity: 1 }, { opacity: 0 }],
        { duration: reduceMotion.matches ? 1 : 220, easing: 'ease-out', fill: 'forwards' }
      );
      fade.finished.then(() => {
        if (activeView !== previous) {
          previous.classList.remove('is-open');
          previous.style.zIndex = '';
        }
      }).catch(() => {});
    }

    appViews.forEach((candidate) => {
      if (candidate !== view && candidate !== previous) {
        candidate.classList.remove('is-open');
        candidate.inert = true;
        candidate.setAttribute('aria-hidden', 'true');
      }
    });

    activeView = view;
    activeName = name;
    activeTrigger = trigger || null;
    view.inert = false;
    view.setAttribute('aria-hidden', 'false');
    view.style.zIndex = '2';
    view.classList.add('is-open');

    appLayer.inert = false;
    appLayer.setAttribute('aria-hidden', 'false');
    appLayer.classList.add('is-active');
    homeView.inert = true;
    homeView.setAttribute('aria-hidden', 'true');
    homeView.classList.add('is-app-open');

    const scroll = $('.sez-view-scroll', view);
    if (scroll) scroll.scrollTop = 0;

    const screenRect = screen.getBoundingClientRect();
    const triggerRect = trigger?.getBoundingClientRect();
    let originX = screenRect.width / 2;
    let originY = screenRect.height / 2;
    if (triggerRect && triggerRect.width > 0) {
      originX = clamp(0, screenRect.width, triggerRect.left + triggerRect.width / 2 - screenRect.left);
      originY = clamp(0, screenRect.height, triggerRect.top + triggerRect.height / 2 - screenRect.top);
    }
    view.style.transformOrigin = `${originX}px ${originY}px`;

    if (!reduceMotion.matches && view.animate) {
      view.animate(
        [
          { opacity: 0, transform: 'scale(.1)' },
          { opacity: 1, transform: 'scale(1)' },
        ],
        { duration: 540, easing: 'cubic-bezier(.16, 1, .3, 1)' }
      );
    }

    if (previous) {
      appCloseTimer = window.setTimeout(() => {
        if (activeView !== previous) {
          previous.classList.remove('is-open');
          previous.style.zIndex = '';
          previous.inert = true;
        }
      }, 260);
    }

    refreshApp(name);

    window.setTimeout(() => {
      if (!isOpen || activeView !== view) return;
      if (name !== 'search') {
        view.focus({ preventScroll: true });
      }
    }, reduceMotion.matches ? 10 : 400);

    if (previousName && previousName !== name) {
      // The app underneath is intentionally left to finish its short fade.
    }
  }

  function closeApp() {
    if (!activeView || isAppClosing) return;

    isAppClosing = true;
    closePhotoViewer(true);
    window.clearTimeout(appCloseTimer);

    const view = activeView;
    const name = activeName;
    const trigger = activeTrigger;

    view.inert = true;
    view.setAttribute('aria-hidden', 'true');
    homeView.inert = false;
    homeView.setAttribute('aria-hidden', 'false');
    homeView.classList.remove('is-app-open');
    appLayer.classList.remove('is-active');
    appLayer.inert = true;
    appLayer.setAttribute('aria-hidden', 'true');

    const finish = () => {
      view.classList.remove('is-open');
      view.style.zIndex = '';
      view.inert = true;
      view.setAttribute('aria-hidden', 'true');
      if (activeView === view) {
        activeView = null;
        activeName = '';
        activeTrigger = null;
      }
      isAppClosing = false;

      if (isOpen) {
        const returnTarget = trigger && trigger.isConnected && !trigger.closest('[inert]') ? trigger : null;
        if (returnTarget && returnTarget.getClientRects().length) returnTarget.focus({ preventScroll: true });
        else focusHomeFallback(name);
      }
    };

    if (reduceMotion.matches || !view.animate) {
      finish();
      return;
    }

    const animation = view.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(.1)' },
      ],
      { duration: 360, easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'forwards' }
    );

    animation.finished.then(finish).catch(finish);
    window.setTimeout(() => {
      if (isAppClosing) finish();
    }, 520);
  }

  /* ------------------------------------------------------------------
     Photos
  ------------------------------------------------------------------ */

  const photoViewer = $('#sezPhotoViewer');
  const photoLarge = $('#sezPhotoLarge');
  const photoCaption = $('#sezPhotoCaption');
  const photoClose = $('#sezPhotoClose');
  const photosView = viewsByName.get('photos');
  const photosHead = photosView ? $('.sez-view-head', photosView) : null;
  const photosScroll = photosView ? $('.sez-view-scroll', photosView) : null;
  let photoViewerOpen = false;

  function setPhotosBehindViewer(inert) {
    [photosHead, photosScroll].forEach((element) => {
      if (!element) return;
      element.inert = inert;
      if (inert) element.setAttribute('aria-hidden', 'true');
      else element.removeAttribute('aria-hidden');
    });
  }

  function openPhoto(button) {
    if (!photoViewer || !photoLarge) return;
    const image = $('img', button);
    if (!image) return;

    photoLarge.src = image.src;
    photoLarge.alt = button.dataset.caption || 'SEZ 光的研究';
    if (photoCaption) photoCaption.textContent = button.dataset.caption || 'SEZ / LIGHT STUDY';
    photoReturnFocus = button;
    setPhotosBehindViewer(true);
    photoViewer.classList.add('is-open');
    photoViewer.setAttribute('aria-hidden', 'false');
    photoViewerOpen = true;
    photoClose?.focus({ preventScroll: true });
  }

  function closePhotoViewer(instant = false) {
    if (!photoViewer || !photoViewerOpen) return;
    photoViewer.classList.remove('is-open');
    photoViewer.setAttribute('aria-hidden', 'true');
    photoViewerOpen = false;
    setPhotosBehindViewer(false);
    if (!instant && isOpen && photoReturnFocus && !photoReturnFocus.closest('[inert]')) {
      photoReturnFocus.focus({ preventScroll: true });
    }
    photoReturnFocus = null;
  }

  photoClose?.addEventListener('click', () => closePhotoViewer());

  /* ------------------------------------------------------------------
     Notes
  ------------------------------------------------------------------ */

  const noteInput = $('#sezNoteInput');
  const noteState = $('#sezNoteState');
  const noteClear = $('#sezNoteClear');
  const NOTE_KEY = 'sez-liquid-note-v1';
  const DEFAULT_NOTE = '让光慢一点。\n\n今天，我把界面做成了液体的样子。';

  function readNote() {
    try {
      return window.localStorage.getItem(NOTE_KEY) ?? DEFAULT_NOTE;
    } catch (error) {
      return DEFAULT_NOTE;
    }
  }

  function writeNote(value) {
    try {
      window.localStorage.setItem(NOTE_KEY, value);
      if (noteState) noteState.textContent = 'SAVED';
      return true;
    } catch (error) {
      if (noteState) noteState.textContent = 'LOCAL';
      return false;
    }
  }

  if (noteInput) {
    noteInput.value = readNote();
    noteInput.addEventListener('input', () => {
      if (noteState) noteState.textContent = 'WRITING';
      window.clearTimeout(noteSaveTimer);
      noteSaveTimer = window.setTimeout(() => {
        writeNote(noteInput.value);
      }, 420);
    });
    noteInput.addEventListener('blur', () => {
      writeNote(noteInput.value);
    });
  }

  noteClear?.addEventListener('click', () => {
    if (!noteInput) return;
    noteInput.value = '';
    writeNote('');
    noteInput.focus({ preventScroll: true });
    showToast('纸页已经清空');
  });

  /* ------------------------------------------------------------------
     Wallpapers, accent, switches
  ------------------------------------------------------------------ */

  function setWallpaper(name, announce = false) {
    if (!name) return;
    state.wallpaper = name;
    $$('.sez-wallpapers img', desktop).forEach((image) => {
      image.classList.toggle('is-active', image.dataset.sezWallpaper === name);
    });
    $$('[data-sez-wallpaper-option]', desktop).forEach((button) => {
      const active = button.dataset.sezWallpaperOption === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (announce) {
      const labels = { aurora: '极光', dusk: '落日', tide: '潮汐' };
      showToast(`壁纸 · ${labels[name]}`);
    }
  }

  function setAccent(name, announce = false) {
    if (!accents[name]) return;
    state.accent = name;
    desktop.style.setProperty('--sez-accent', accents[name].value);
    desktop.style.setProperty('--sez-accent-rgb', accents[name].rgb);
    $$('[data-sez-accent]', desktop).forEach((button) => {
      const active = button.dataset.sezAccent === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (announce) {
      const labels = { mint: '薄荷', peach: '蜜桃', blue: '冰蓝' };
      showToast(`光色 · ${labels[name]}`);
    }
  }

  function syncSettingButtons(key) {
    const enabled = Boolean(state[key]);
    $$(`[data-sez-setting="${key}"]`, desktop).forEach((button) => {
      button.classList.toggle('is-on', enabled);
      if (button.getAttribute('role') === 'switch') {
        button.setAttribute('aria-checked', String(enabled));
      } else {
        button.setAttribute('aria-pressed', String(enabled));
      }
      const value = $('b', button);
      if (value) value.textContent = enabled ? 'ON' : 'OFF';
    });
  }

  function setGlare(enabled, announce = false) {
    state.glare = Boolean(enabled);
    device.classList.toggle('is-glare-off', !state.glare);
    syncSettingButtons('glare');
    if (announce) showToast(state.glare ? '高光 · 已开启' : '高光 · 已关闭');
  }

  function setMotion(enabled, announce = false) {
    state.motion = Boolean(enabled);
    desktop.classList.toggle('is-calm', !state.motion);
    syncSettingButtons('motion');
    if (announce) showToast(state.motion ? '流动 · 已开启' : '流动 · 已安静');
  }

  function syncWifi() {
    $$('[data-sez-quick="wifi"]', desktop).forEach((button) => {
      button.classList.toggle('is-on', state.wifi);
      button.setAttribute('aria-pressed', String(state.wifi));
      const value = $('b', button);
      if (value) value.textContent = state.wifi ? 'ON' : 'OFF';
    });
  }

  function syncSettings() {
    syncSettingButtons('glare');
    syncSettingButtons('motion');
    setWallpaper(state.wallpaper);
    setAccent(state.accent);
  }

  /* ------------------------------------------------------------------
     Brightness & volume
  ------------------------------------------------------------------ */

  const brightnessRange = $('#sezBrightness');
  const brightnessOutput = $('#sezBrightnessOut');
  const volumeRange = $('#sezVolume');
  const volumeOutput = $('#sezVolumeOut');
  const musicVolumeRange = $('#sezMusicVolume');

  function setBrightness(value) {
    state.brightness = clamp(30, 100, Number(value));
    if (brightnessOverlay) {
      brightnessOverlay.style.opacity = `${((100 - state.brightness) / 100) * 0.72}`;
    }
    if (brightnessRange) brightnessRange.value = String(state.brightness);
    if (brightnessOutput) brightnessOutput.textContent = `${Math.round(state.brightness)}%`;
    setRangeFill(brightnessRange);
  }

  function setVolume(value, source = null) {
    state.volume = clamp(0, 100, Number(value));
    [volumeRange, musicVolumeRange].forEach((input) => {
      if (!input || input === source) return;
      input.value = String(state.volume);
      setRangeFill(input);
    });
    if (source) setRangeFill(source);
    if (volumeOutput) volumeOutput.textContent = `${Math.round(state.volume)}%`;
    setAmbientVolume();
  }

  function syncControl() {
    syncWifi();
    syncSettingButtons('glare');
    syncSettingButtons('motion');
    if (brightnessRange) {
      brightnessRange.value = String(state.brightness);
      if (brightnessOutput) brightnessOutput.textContent = `${Math.round(state.brightness)}%`;
      setRangeFill(brightnessRange);
    }
    if (volumeRange) {
      volumeRange.value = String(state.volume);
      if (volumeOutput) volumeOutput.textContent = `${Math.round(state.volume)}%`;
      setRangeFill(volumeRange);
    }
  }

  brightnessRange?.addEventListener('input', () => {
    setBrightness(brightnessRange.value);
  });

  [volumeRange, musicVolumeRange].forEach((input) => {
    input?.addEventListener('input', () => setVolume(input.value, input));
  });

  /* ------------------------------------------------------------------
     Ambient audio
  ------------------------------------------------------------------ */

  const albumArt = $('#sezAlbumArt');
  const trackTitle = $('#sezTrackTitle');
  const trackArtist = $('#sezTrackArtist');
  const musicTag = $('#sezMusicTag');
  const musicView = $('[data-sez-view="music"]');
  const playButton = $('[data-sez-music-play]');
  const playIcon = $('#sezPlayIcon');
  const musicState = $('#sezMusicState');

  function setAmbientVolume() {
    if (!ambient.context || !ambient.master) return;
    const now = ambient.context.currentTime;
    const target = state.playing ? (state.volume / 100) * 0.09 : 0;
    ambient.master.gain.cancelScheduledValues(now);
    ambient.master.gain.setTargetAtTime(target, now, 0.28);
  }

  function ensureAmbient() {
    if (ambient.context) return true;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return false;

    const context = new AudioContextClass();
    const master = context.createGain();
    const filter = context.createBiquadFilter();
    master.gain.value = 0;
    filter.type = 'lowpass';
    filter.frequency.value = 1050;
    filter.Q.value = 0.7;
    filter.connect(master);
    master.connect(context.destination);

    const voices = tracks[state.track].freqs.map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const panner = context.createStereoPanner();

      oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = (index - 1.5) * 2.5;
      gain.gain.value = 0.038 / (index + 1);
      panner.pan.value = (index / Math.max(1, tracks[state.track].freqs.length - 1) - 0.5) * 1.1;

      oscillator.connect(gain);
      gain.connect(panner);
      panner.connect(filter);
      oscillator.start();

      return { oscillator, gain, panner };
    });

    const lfo = context.createOscillator();
    const lfoDepth = context.createGain();
    lfo.frequency.value = 0.047;
    lfoDepth.gain.value = 180;
    lfo.connect(lfoDepth);
    lfoDepth.connect(filter.frequency);
    lfo.start();

    ambient.context = context;
    ambient.master = master;
    ambient.filter = filter;
    ambient.voices = voices;
    ambient.lfo = lfo;

    return true;
  }

  function playAmbient() {
    if (!ensureAmbient()) {
      showToast('此浏览器暂不支持实时音频');
      return;
    }

    ambient.context.resume().catch(() => {});
    state.playing = true;
    setAmbientVolume();
    syncMusicUI();
  }

  function pauseAmbient() {
    state.playing = false;
    setAmbientVolume();
    syncMusicUI();
  }

  function tuneAmbient() {
    if (!ambient.context) return;
    const now = ambient.context.currentTime;
    tracks[state.track].freqs.forEach((frequency, index) => {
      const voice = ambient.voices[index];
      if (!voice) return;
      voice.oscillator.frequency.setTargetAtTime(frequency, now, 0.3);
    });
  }

  function setTrack(index) {
    state.track = (index + tracks.length) % tracks.length;
    const track = tracks[state.track];

    if (albumArt) {
      albumArt.style.setProperty('--art-a', track.colors[0]);
      albumArt.style.setProperty('--art-b', track.colors[1]);
      albumArt.style.setProperty('--art-c', track.colors[2]);
    }
    if (trackTitle) trackTitle.textContent = track.title;
    if (trackArtist) trackArtist.textContent = track.artist;
    if (musicTag) musicTag.textContent = `0${state.track + 1}`;

    tuneAmbient();
    syncMusicUI();
  }

  function syncMusicUI() {
    if (playIcon) playIcon.setAttribute('href', state.playing ? '#si-pause' : '#si-play');
    playButton?.setAttribute('aria-label', state.playing ? '暂停环境音乐' : '播放环境音乐');
    if (musicView) musicView.classList.toggle('is-playing', state.playing);
    if (musicState) {
      musicState.textContent = state.playing ? 'PLAYING / GENERATIVE' : 'TAP TO PLAY';
    }
    const dockMusic = $('.sez-dock [data-sez-open="music"]');
    dockMusic?.classList.toggle('is-playing', state.playing);
  }

  playButton?.addEventListener('click', () => {
    if (state.playing) pauseAmbient();
    else playAmbient();
  });

  $('[data-sez-music-prev]')?.addEventListener('click', () => {
    setTrack(state.track - 1);
    if (state.playing) playAmbient();
  });

  $('[data-sez-music-next]')?.addEventListener('click', () => {
    setTrack(state.track + 1);
    if (state.playing) playAmbient();
  });

  /* ------------------------------------------------------------------
     Focus timer
  ------------------------------------------------------------------ */

  const focusRing = $('#sezFocusRing');
  const focusTime = $('#sezFocusTime');
  const focusLabel = $('#sezFocusLabel');
  const focusToggle = $('#sezFocusToggle');
  const focusReset = $('#sezFocusReset');
  const focusModeButtons = $$('[data-sez-focus-mode]');

  function formatTime(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }

  function syncFocusUI() {
    if (focusTime) focusTime.textContent = formatTime(focusState.remaining);
    if (focusRing) {
      const progress = focusState.total > 0
        ? ((focusState.total - focusState.remaining) / focusState.total) * 100
        : 0;
      focusRing.style.setProperty('--focus-progress', `${clamp(0, 100, progress).toFixed(2)}%`);
    }
    if (focusLabel) focusLabel.textContent = focusState.remaining <= 0 ? 'COMPLETE' : (focusState.mode === 5 ? 'SHORT REST' : 'DEEP FOCUS');
    if (focusToggle) focusToggle.textContent = focusState.remaining <= 0 ? '重新开始' : (focusState.running ? '暂停专注' : '开始专注');
    focusModeButtons.forEach((button) => {
      const active = Number(button.dataset.sezFocusMode) === focusState.mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function stopFocusInterval() {
    if (focusState.interval) {
      window.clearInterval(focusState.interval);
      focusState.interval = null;
    }
  }

  function pauseFocusTimer() {
    focusState.running = false;
    stopFocusInterval();
    syncFocusUI();
  }

  function startFocusTimer() {
    if (focusState.running) return;
    if (focusState.remaining <= 0) {
      focusState.remaining = focusState.total;
    }
    focusState.running = true;
    stopFocusInterval();
    focusState.interval = window.setInterval(() => {
      focusState.remaining -= 1;
      if (focusState.remaining <= 0) {
        focusState.remaining = 0;
        pauseFocusTimer();
        showToast('专注完成 · 让光停一会儿');
      }
      syncFocusUI();
    }, 1000);
    syncFocusUI();
  }

  function setFocusMode(minutes) {
    pauseFocusTimer();
    focusState.mode = minutes;
    focusState.total = minutes * 60;
    focusState.remaining = focusState.total;
    syncFocusUI();
  }

  focusToggle?.addEventListener('click', () => {
    if (focusState.running) pauseFocusTimer();
    else startFocusTimer();
  });

  focusReset?.addEventListener('click', () => {
    pauseFocusTimer();
    focusState.remaining = focusState.total;
    syncFocusUI();
  });

  focusModeButtons.forEach((button) => {
    button.addEventListener('click', () => setFocusMode(Number(button.dataset.sezFocusMode)));
  });

  /* ------------------------------------------------------------------
     Search
  ------------------------------------------------------------------ */

  function filterSearch(query) {
    if (!searchResults) return;
    const needle = query.trim().toLowerCase();
    let visible = 0;
    $$('button', searchResults).forEach((button) => {
      const searchable = `${button.textContent} ${button.dataset.sezKeywords || ''}`.toLowerCase();
      const visibleItem = !needle || searchable.includes(needle);
      button.hidden = !visibleItem;
      if (visibleItem) visible += 1;
    });
    if (searchEmpty) searchEmpty.hidden = visible !== 0;
  }

  searchInput?.addEventListener('input', () => filterSearch(searchInput.value));
  searchInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const firstResult = $$('button', searchResults).find((button) => !button.hidden);
    if (firstResult) {
      event.preventDefault();
      firstResult.click();
    }
  });

  /* ------------------------------------------------------------------
     Event delegation inside the desktop
  ------------------------------------------------------------------ */

  desktop.addEventListener('click', (event) => {
    const target = event.target;

    if (target.closest('#sezSleep')) {
      closeDesktop();
      return;
    }

    const sleepAction = target.closest('[data-sez-action="sleep"]');
    if (sleepAction) {
      closeDesktop();
      return;
    }

    const back = target.closest('[data-sez-back]');
    if (back) {
      closeApp();
      return;
    }

    const photo = target.closest('[data-sez-photo]');
    if (photo) {
      openPhoto(photo);
      return;
    }

    const photoCloseButton = target.closest('#sezPhotoClose');
    if (photoCloseButton) {
      closePhotoViewer();
      return;
    }

    const wallpaperOption = target.closest('[data-sez-wallpaper-option]');
    if (wallpaperOption) {
      setWallpaper(wallpaperOption.dataset.sezWallpaperOption, true);
      return;
    }

    const accentOption = target.closest('[data-sez-accent]');
    if (accentOption) {
      setAccent(accentOption.dataset.sezAccent, true);
      return;
    }

    const setting = target.closest('[data-sez-setting]');
    if (setting) {
      const key = setting.dataset.sezSetting;
      if (key === 'glare') setGlare(!state.glare, true);
      if (key === 'motion') setMotion(!state.motion, true);
      return;
    }

    const quickWifi = target.closest('[data-sez-quick="wifi"]');
    if (quickWifi) {
      state.wifi = !state.wifi;
      syncWifi();
      showToast(state.wifi ? 'WI-FI · 已连接' : 'WI-FI · 已断开');
      return;
    }

    const appTrigger = target.closest('[data-sez-open]');
    if (appTrigger) {
      openApp(appTrigger.dataset.sezOpen, appTrigger);
    }
  });

  let suppressHomeClick = false;
  let homeSwipe = null;

  homeIndicator?.addEventListener('click', () => {
    if (suppressHomeClick) {
      suppressHomeClick = false;
      return;
    }
    if (activeView) closeApp();
    else {
      homeIndicator.classList.add('is-tapped');
      window.setTimeout(() => homeIndicator.classList.remove('is-tapped'), 400);
    }
  });

  homeIndicator?.addEventListener('pointerdown', (event) => {
    if (!activeView || !isOpen) return;
    homeSwipe = {
      pointerId: event.pointerId,
      startY: event.clientY,
      moved: false,
    };
    homeIndicator.setPointerCapture?.(event.pointerId);
  });

  homeIndicator?.addEventListener('pointermove', (event) => {
    if (!homeSwipe || !activeView || event.pointerId !== homeSwipe.pointerId) return;
    const delta = Math.min(0, event.clientY - homeSwipe.startY);
    if (delta < -4) homeSwipe.moved = true;
    if (!homeSwipe.moved) return;

    const progress = clamp(-110, 0, delta);
    const lift = Math.abs(progress);
    activeView.style.transform = `translateY(${-lift * 0.42}px) scale(${1 - lift * 0.00045})`;
    activeView.style.opacity = String(1 - Math.min(0.22, lift / 520));
  }, { passive: true });

  function endHomeSwipe(event) {
    if (!homeSwipe) return;
    const swipe = homeSwipe;
    homeSwipe = null;

    const delta = event.clientY - swipe.startY;
    if (activeView) {
      activeView.style.transform = '';
      activeView.style.opacity = '';
    }

    if (swipe.moved && delta < -28 && activeView) {
      suppressHomeClick = true;
      closeApp();
      window.setTimeout(() => {
        suppressHomeClick = false;
      }, 500);
    } else if (swipe.moved) {
      suppressHomeClick = true;
      window.setTimeout(() => {
        suppressHomeClick = false;
      }, 180);
    }
  }

  homeIndicator?.addEventListener('pointerup', endHomeSwipe, { passive: true });
  homeIndicator?.addEventListener('pointercancel', (event) => {
    if (homeSwipe && activeView) {
      activeView.style.transform = '';
      activeView.style.opacity = '';
    }
    homeSwipe = null;
    if (event.pointerId !== undefined) suppressHomeClick = false;
  }, { passive: true });

  /* ------------------------------------------------------------------
     Glare follows the pointer
  ------------------------------------------------------------------ */

  if (finePointer.matches && !reduceMotion.matches) {
    device.addEventListener('pointermove', (event) => {
      if (!state.glare) return;
      const rect = device.getBoundingClientRect();
      const x = clamp(0, 1, (event.clientX - rect.left) / rect.width);
      const y = clamp(0, 1, (event.clientY - rect.top) / rect.height);
      glare.style.setProperty('--glare-x', `${(x * 100).toFixed(1)}%`);
      glare.style.setProperty('--glare-y', `${(y * 100).toFixed(1)}%`);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------
     Keyboard
  ------------------------------------------------------------------ */

  document.addEventListener('keydown', (event) => {
    if (!isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (photoViewerOpen) closePhotoViewer();
      else if (activeView) closeApp();
      else closeDesktop();
      return;
    }

    trapFocus(event);
  });

  /* ------------------------------------------------------------------
     Open triggers & init
  ------------------------------------------------------------------ */

  openTriggers.forEach((trigger) => {
    trigger.addEventListener('click', () => openDesktop(trigger));
  });

  updateClock();
  setWallpaper('aurora');
  setAccent('mint');
  setGlare(true);
  setMotion(true);
  syncWifi();
  setBrightness(state.brightness);
  setVolume(state.volume);
  setTrack(0);
  syncFocusUI();
  syncMusicUI();

  desktop.inert = true;
  desktop.setAttribute('aria-hidden', 'true');
})();
