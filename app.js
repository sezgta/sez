(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const clamp = (min, max, value) => Math.min(max, Math.max(min, value));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

  /* ------------------------------------------------------------------
     A small, honest clock
  ------------------------------------------------------------------ */

  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function updateClock() {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const date = `${now.getMonth() + 1}月${now.getDate()}日 · ${weekdays[now.getDay()]}`;

    $$('[data-clock]').forEach((element) => {
      element.textContent = time;
    });

    $$('[data-date]').forEach((element) => {
      element.textContent = date;
    });
  }

  updateClock();
  window.setInterval(updateClock, 30_000);

  /* ------------------------------------------------------------------
     Scroll state
  ------------------------------------------------------------------ */

  const header = $('#siteHeader');
  const progressBar = $('#scrollProgress');
  let scrollTicking = false;

  function updateScrollUI() {
    const scrollY = window.scrollY;
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = clamp(0, 1, scrollY / maxScroll);

    header?.classList.toggle('is-scrolled', scrollY > 24);

    if (progressBar) {
      progressBar.style.transform = `scaleX(${progress})`;
    }

    scrollTicking = false;
  }

  function requestScrollUI() {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateScrollUI);
  }

  window.addEventListener('scroll', requestScrollUI, { passive: true });
  window.addEventListener('resize', requestScrollUI, { passive: true });
  updateScrollUI();

  /* ------------------------------------------------------------------
     Reveal on scroll
  ------------------------------------------------------------------ */

  const revealElements = $$('.reveal');

  if (!('IntersectionObserver' in window) || reduceMotion.matches) {
    revealElements.forEach((element) => element.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    }, {
      threshold: 0.07,
      rootMargin: '0px 0px -7% 0px',
    });

    revealElements.forEach((element) => revealObserver.observe(element));
  }

  /* ------------------------------------------------------------------
     A pool of light that follows the cursor
  ------------------------------------------------------------------ */

  const pointerLight = $('#pointerLight');

  if (pointerLight && finePointer.matches && !reduceMotion.matches) {
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight * 0.34;
    let currentX = targetX;
    let currentY = targetY;
    let frameId = null;

    function renderPointerLight() {
      currentX += (targetX - currentX) * 0.085;
      currentY += (targetY - currentY) * 0.085;
      pointerLight.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0)`;

      if (Math.abs(targetX - currentX) < 0.15 && Math.abs(targetY - currentY) < 0.15) {
        frameId = null;
        return;
      }

      frameId = window.requestAnimationFrame(renderPointerLight);
    }

    window.addEventListener('pointermove', (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      pointerLight.classList.add('is-on');
      if (frameId === null) frameId = window.requestAnimationFrame(renderPointerLight);
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      pointerLight.classList.remove('is-on');
    });
  }

  /* ------------------------------------------------------------------
     Waking the glass
  ------------------------------------------------------------------ */

  const wakeVeil = $('#wakeVeil');
  const wakeStatus = $('#wakeStatus');
  const wakeButtons = $$('[data-wake]');
  let wakeTimeout = null;
  let statusTimeout = null;
  let hideTouchLensNow = () => {};

  function wakeGlass(button, event) {
    if (!wakeVeil) return;

    hideTouchLensNow();

    const rect = button?.getBoundingClientRect();
    const hasPointer = Number.isFinite(event?.clientX) && event.clientY > 0;
    const x = hasPointer ? event.clientX : rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
    const y = hasPointer ? event.clientY : rect ? rect.top + rect.height / 2 : window.innerHeight / 2;

    wakeVeil.style.setProperty('--wx', `${x}px`);
    wakeVeil.style.setProperty('--wy', `${y}px`);

    document.body.classList.remove('is-awake');
    void document.body.offsetWidth;
    document.body.classList.add('is-awake');

    wakeButtons.forEach((item) => item.classList.toggle('is-waking', item === button));

    window.clearTimeout(wakeTimeout);
    wakeTimeout = window.setTimeout(() => {
      document.body.classList.remove('is-awake');
      wakeButtons.forEach((item) => item.classList.remove('is-waking'));
    }, 1650);

    if (wakeStatus) {
      window.clearTimeout(statusTimeout);
      wakeStatus.textContent = '光，正在流动。';
      statusTimeout = window.setTimeout(() => {
        wakeStatus.textContent = '';
      }, 1800);
    }
  }

  wakeButtons.forEach((button) => {
    button.addEventListener('click', (event) => wakeGlass(button, event));
  });

  /* ------------------------------------------------------------------
     Hero stage — tilt, lens, trails and touch
  ------------------------------------------------------------------ */

  const heroStage = $('#heroStage');
  const stageLens = $('#stageLens');
  const lensTrailOne = $('#lensTrailOne');
  const lensTrailTwo = $('#lensTrailTwo');

  if (heroStage && stageLens && finePointer.matches && !reduceMotion.matches) {
    let targetTiltX = 0;
    let targetTiltY = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    let targetLensX = -200;
    let targetLensY = -200;
    let currentLensX = -200;
    let currentLensY = -200;
    let trailOneX = -200;
    let trailOneY = -200;
    let trailTwoX = -200;
    let trailTwoY = -200;
    let lensAngle = 0;
    let lensStretch = 1;
    let lensStarted = false;
    let frameId = null;

    function renderStage() {
      currentTiltX += (targetTiltX - currentTiltX) * 0.16;
      currentTiltY += (targetTiltY - currentTiltY) * 0.16;

      currentLensX += (targetLensX - currentLensX) * 0.3;
      currentLensY += (targetLensY - currentLensY) * 0.3;

      const deltaX = targetLensX - currentLensX;
      const deltaY = targetLensY - currentLensY;
      const lag = Math.hypot(deltaX, deltaY);

      const desiredStretch = 1 + Math.min(0.125, lag * 0.0032);
      lensStretch += (desiredStretch - lensStretch) * 0.2;

      if (lag > 0.8) {
        const desiredAngle = Math.atan2(deltaY, deltaX);
        const angleDelta = Math.atan2(
          Math.sin(desiredAngle - lensAngle),
          Math.cos(desiredAngle - lensAngle)
        );
        lensAngle += angleDelta * 0.18;
      }

      const crossStretch = 1 - (lensStretch - 1) * 0.56;

      const trailOneGoalX = targetLensX - Math.cos(lensAngle) * 54;
      const trailOneGoalY = targetLensY - Math.sin(lensAngle) * 54;
      const trailTwoGoalX = targetLensX - Math.cos(lensAngle) * 86;
      const trailTwoGoalY = targetLensY - Math.sin(lensAngle) * 86;

      trailOneX += (trailOneGoalX - trailOneX) * 0.17;
      trailOneY += (trailOneGoalY - trailOneY) * 0.17;
      trailTwoX += (trailTwoGoalX - trailTwoX) * 0.09;
      trailTwoY += (trailTwoGoalY - trailTwoY) * 0.09;

      heroStage.style.setProperty('--tilt-x', `${currentTiltX.toFixed(3)}deg`);
      heroStage.style.setProperty('--tilt-y', `${currentTiltY.toFixed(3)}deg`);

      stageLens.style.transform =
        `translate3d(${currentLensX.toFixed(2)}px, ${currentLensY.toFixed(2)}px, 0) ` +
        `translate(-50%, -50%) rotate(${lensAngle.toFixed(3)}rad) ` +
        `scale(${lensStretch.toFixed(3)}, ${crossStretch.toFixed(3)})`;

      if (lensTrailOne) {
        lensTrailOne.style.transform =
          `translate3d(${trailOneX.toFixed(2)}px, ${trailOneY.toFixed(2)}px, 0) ` +
          `translate(-50%, -50%) rotate(${lensAngle.toFixed(3)}rad) scale(${(lensStretch * 0.94).toFixed(3)})`;
      }

      if (lensTrailTwo) {
        lensTrailTwo.style.transform =
          `translate3d(${trailTwoX.toFixed(2)}px, ${trailTwoY.toFixed(2)}px, 0) ` +
          `translate(-50%, -50%)`;
      }

      const settled =
        Math.abs(targetTiltX - currentTiltX) < 0.002 &&
        Math.abs(targetTiltY - currentTiltY) < 0.002 &&
        Math.hypot(targetLensX - currentLensX, targetLensY - currentLensY) < 0.08 &&
        Math.abs(trailOneGoalX - trailOneX) < 0.2 &&
        Math.abs(trailOneGoalY - trailOneY) < 0.2 &&
        Math.abs(trailTwoGoalX - trailTwoX) < 0.3 &&
        Math.abs(trailTwoGoalY - trailTwoY) < 0.3;

      if (settled) {
        frameId = null;
        return;
      }

      frameId = window.requestAnimationFrame(renderStage);
    }

    function startStageRender() {
      if (frameId === null) frameId = window.requestAnimationFrame(renderStage);
    }

    heroStage.addEventListener('pointermove', (event) => {
      const rect = heroStage.getBoundingClientRect();
      const x = clamp(0, rect.width, event.clientX - rect.left);
      const y = clamp(0, rect.height, event.clientY - rect.top);
      const xRatio = x / rect.width;
      const yRatio = y / rect.height;

      targetTiltX = (0.5 - yRatio) * 4.6;
      targetTiltY = (xRatio - 0.5) * 5.2;
      targetLensX = x;
      targetLensY = y;

      if (!lensStarted) {
        currentLensX = x;
        currentLensY = y;
        trailOneX = x - 54;
        trailOneY = y;
        trailTwoX = x - 86;
        trailTwoY = y;
        lensStarted = true;
      }

      heroStage.style.setProperty('--mx', `${(xRatio * 100).toFixed(2)}%`);
      heroStage.style.setProperty('--my', `${(yRatio * 100).toFixed(2)}%`);
      heroStage.classList.add('is-lensing');
      stageLens.classList.add('is-visible');
      startStageRender();
    }, { passive: true });

    heroStage.addEventListener('pointerleave', () => {
      targetTiltX = 0;
      targetTiltY = 0;
      heroStage.classList.remove('is-lensing');
      stageLens.classList.remove('is-visible');
      startStageRender();
    });

    heroStage.addEventListener('pointerdown', (event) => {
      stageLens.classList.add('is-pressed');
      stageLens.style.setProperty('scale', '.91');

      if (event.pointerType === 'mouse' && event.button !== 0) return;

      const rect = heroStage.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'stage-click-ripple';
      ripple.style.left = `${event.clientX - rect.left}px`;
      ripple.style.top = `${event.clientY - rect.top}px`;
      heroStage.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 900);
    });

    window.addEventListener('pointerup', () => {
      stageLens.classList.remove('is-pressed');
      stageLens.style.removeProperty('scale');
    }, { passive: true });
  }

  // Touch screens get a short-lived lens at the point of contact.
  // Touch pointers are implicitly captured; still track the pointer id and
  // listen on the window so a finger that ends outside the stage cannot leave
  // a bubble stranded on screen.
  if (heroStage && stageLens && !reduceMotion.matches) {
    let hideTimer = null;
    let touchPointerId = null;
    let lensIsPressed = false;

    function clearLensTimer() {
      window.clearTimeout(hideTimer);
      hideTimer = null;
    }

    function dismissTouchLens(immediate = false) {
      clearLensTimer();
      touchPointerId = null;
      if (immediate) {
        stageLens.classList.remove('is-visible');
      } else {
        hideTimer = window.setTimeout(() => {
          stageLens.classList.remove('is-visible');
          hideTimer = null;
        }, 360);
      }
    }

    hideTouchLensNow = () => {
      clearLensTimer();
      touchPointerId = null;
      stageLens.classList.remove('is-visible');
      stageLens.classList.remove('is-pressed');
      stageLens.style.removeProperty('scale');
      lensIsPressed = false;
    };

    function placeTouchLens(event) {
      if (event.pointerType === 'mouse') return;
      if (touchPointerId !== null && event.pointerId !== touchPointerId) return;

      const rect = heroStage.getBoundingClientRect();
      const x = clamp(0, rect.width, event.clientX - rect.left);
      const y = clamp(0, rect.height, event.clientY - rect.top);

      stageLens.style.transform =
        `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%) scale(.95)`;
      stageLens.classList.add('is-visible');
      heroStage.style.setProperty('--mx', `${((x / rect.width) * 100).toFixed(2)}%`);
      heroStage.style.setProperty('--my', `${((y / rect.height) * 100).toFixed(2)}%`);
      clearLensTimer();
    }

    function beginTouchLens(event) {
      if (event.pointerType === 'mouse') return;
      touchPointerId = event.pointerId;
      placeTouchLens(event);
      try {
        heroStage.setPointerCapture(event.pointerId);
      } catch (error) {
        // Older Safari can refuse capture; the window listeners below still
        // guarantee that the lens is removed on release.
      }
    }

    function releaseTouchLens(event) {
      if (event.pointerType === 'mouse') return;
      if (touchPointerId !== null && event.pointerId !== undefined && event.pointerId !== touchPointerId) return;
      dismissTouchLens(false);
    }

    heroStage.addEventListener('pointerdown', beginTouchLens, { passive: true });
    heroStage.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' && event.pointerId === touchPointerId && event.buttons > 0) {
        placeTouchLens(event);
      }
    }, { passive: true });

    heroStage.addEventListener('pointerup', releaseTouchLens, { passive: true });
    heroStage.addEventListener('pointercancel', releaseTouchLens, { passive: true });
    heroStage.addEventListener('lostpointercapture', releaseTouchLens, { passive: true });
    window.addEventListener('pointerup', releaseTouchLens, { passive: true });
    window.addEventListener('pointercancel', releaseTouchLens, { passive: true });
    window.addEventListener('scroll', () => {
      if (touchPointerId !== null || stageLens.classList.contains('is-visible')) dismissTouchLens(true);
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') hideTouchLensNow();
    });
  }

  /* ------------------------------------------------------------------
     Lab — scene, material presets, ranges and a physical card
  ------------------------------------------------------------------ */

  const labStage = $('#labStage');
  const studioCard = $('#studioCard');
  const labToast = $('#labToast');
  const copyMaterialButton = $('#copyMaterial');
  const blurRange = $('#blurRange');
  const refractionRange = $('#refractionRange');
  const dispersionRange = $('#dispersionRange');
  const blurOutput = $('#blurOutput');
  const refractionOutput = $('#refractionOutput');
  const dispersionOutput = $('#dispersionOutput');
  const readoutBlur = $('#readoutBlur');
  const readoutRefraction = $('#readoutRefraction');
  const readoutDispersion = $('#readoutDispersion');
  const sceneMeta = $('#sceneMeta');
  const labSceneName = $('#labSceneName');
  const highlightSwitch = $('#highlightSwitch');

  const PRESETS = {
    soft: { blur: 18, refraction: 64, dispersion: 24, alpha: 0.18 },
    crystal: { blur: 8, refraction: 88, dispersion: 43, alpha: 0.09 },
    deep: { blur: 22, refraction: 51, dispersion: 15, alpha: 0.33 },
  };

  const SCENES = {
    aurora: { meta: 'AURORA / 01', label: 'AURORA / 01' },
    dusk: { meta: 'SUNSET / 02', label: 'SUNSET / 02' },
    tide: { meta: 'TIDE / 03', label: 'TIDE / 03' },
  };

  const settings = { ...PRESETS.soft };
  let presetTween = null;
  let toastTimeout = null;
  let copyLabelTimeout = null;

  function updateRangeFill(input) {
    if (!input) return;
    const min = Number(input.min) || 0;
    const max = Number(input.max) || 100;
    const value = Number(input.value) || 0;
    const percent = max === min ? 0 : clamp(0, 100, ((value - min) / (max - min)) * 100);
    input.style.setProperty('--fill', `${percent}%`);
  }

  function showLabToast(message) {
    if (!labToast) return;
    window.clearTimeout(toastTimeout);
    labToast.textContent = message;
    labToast.classList.add('is-visible');
    toastTimeout = window.setTimeout(() => {
      labToast.classList.remove('is-visible');
    }, 2400);
  }

  function syncLabUI() {
    if (!labStage) return;

    const blur = Math.round(settings.blur);
    const refraction = Math.round(settings.refraction);
    const dispersion = Math.round(settings.dispersion);

    labStage.style.setProperty('--glass-blur', `${settings.blur.toFixed(2)}px`);
    labStage.style.setProperty('--refraction', settings.refraction.toFixed(2));
    labStage.style.setProperty('--dispersion', settings.dispersion.toFixed(2));
    labStage.style.setProperty('--glass-alpha', settings.alpha.toFixed(3));

    if (blurRange) blurRange.value = String(blur);
    if (refractionRange) refractionRange.value = String(refraction);
    if (dispersionRange) dispersionRange.value = String(dispersion);

    if (blurOutput) blurOutput.textContent = `${blur} px`;
    if (refractionOutput) refractionOutput.textContent = String(refraction);
    if (dispersionOutput) dispersionOutput.textContent = String(dispersion);
    if (readoutBlur) readoutBlur.textContent = `${blur} px`;
    if (readoutRefraction) readoutRefraction.textContent = String(refraction);
    if (readoutDispersion) readoutDispersion.textContent = String(dispersion);

    [blurRange, refractionRange, dispersionRange].forEach(updateRangeFill);
  }

  function setPresetUI(name) {
    $$('.preset-option').forEach((button) => {
      const active = button.dataset.preset === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function clearPresetUI() {
    $$('.preset-option').forEach((button) => {
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed', 'false');
    });
  }

  function cancelPresetTween() {
    if (presetTween !== null) {
      window.cancelAnimationFrame(presetTween);
      presetTween = null;
    }
  }

  function animateToPreset(name) {
    const target = PRESETS[name];
    if (!target) return;

    cancelPresetTween();
    setPresetUI(name);

    const start = { ...settings };
    const startedAt = performance.now();
    const duration = reduceMotion.matches ? 1 : 460;
    const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

    function frame(now) {
      const progress = clamp(0, 1, (now - startedAt) / duration);
      const eased = easeOutCubic(progress);

      settings.blur = start.blur + (target.blur - start.blur) * eased;
      settings.refraction = start.refraction + (target.refraction - start.refraction) * eased;
      settings.dispersion = start.dispersion + (target.dispersion - start.dispersion) * eased;
      settings.alpha = start.alpha + (target.alpha - start.alpha) * eased;
      syncLabUI();

      if (progress < 1) {
        presetTween = window.requestAnimationFrame(frame);
      } else {
        presetTween = null;
      }
    }

    presetTween = window.requestAnimationFrame(frame);
  }

  function handleManualParameter(key, input) {
    cancelPresetTween();
    settings[key] = Number(input.value);
    clearPresetUI();
    syncLabUI();
  }

  function resetLabCard() {
    if (!studioCard) return;
    studioCard.style.setProperty('--card-rx', '0deg');
    studioCard.style.setProperty('--card-ry', '0deg');
    studioCard.style.setProperty('--gx', '26%');
    studioCard.style.setProperty('--gy', '18%');
  }

  if (labStage) {
    syncLabUI();

    [blurRange, refractionRange, dispersionRange].forEach((input) => {
      if (!input) return;
      const key = input.dataset.param;
      input.addEventListener('input', () => handleManualParameter(key, input));
      input.addEventListener('pointerdown', cancelPresetTween, { passive: true });
      updateRangeFill(input);
    });

    $$('.preset-option').forEach((button) => {
      button.addEventListener('click', () => animateToPreset(button.dataset.preset));
    });

    const resetButton = $('#resetMaterial');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        animateToPreset('soft');
        showLabToast('已回到晨雾材质');
      });
    }

    $$('.scene-option').forEach((button) => {
      button.addEventListener('click', () => {
        const scene = button.dataset.scene;
        if (!SCENES[scene]) return;

        labStage.dataset.scene = scene;
        $$('.scene-layer', labStage).forEach((layer) => {
          layer.classList.toggle('is-active', layer.dataset.sceneLayer === scene);
        });
        $$('.scene-option').forEach((option) => {
          const active = option === button;
          option.classList.toggle('is-active', active);
          option.setAttribute('aria-pressed', String(active));
        });

        if (sceneMeta) sceneMeta.textContent = SCENES[scene].meta;
        if (labSceneName) labSceneName.textContent = SCENES[scene].label;
      });
    });

    if (!reduceMotion.matches) {
      const placeLabLight = (event) => {
        const rect = labStage.getBoundingClientRect();
        const x = clamp(0, rect.width, event.clientX - rect.left);
        const y = clamp(0, rect.height, event.clientY - rect.top);
        const xPercent = (x / rect.width) * 100;
        const yPercent = (y / rect.height) * 100;

        labStage.style.setProperty('--lx', `${xPercent.toFixed(2)}%`);
        labStage.style.setProperty('--ly', `${yPercent.toFixed(2)}%`);

        if (studioCard) {
          const cardRect = studioCard.getBoundingClientRect();
          const cardX = clamp(0, 1, (event.clientX - cardRect.left) / cardRect.width);
          const cardY = clamp(0, 1, (event.clientY - cardRect.top) / cardRect.height);

          studioCard.style.setProperty('--card-rx', `${((0.5 - cardY) * 2.5).toFixed(2)}deg`);
          studioCard.style.setProperty('--card-ry', `${((cardX - 0.5) * 2.8).toFixed(2)}deg`);
          studioCard.style.setProperty('--gx', `${(cardX * 100).toFixed(1)}%`);
          studioCard.style.setProperty('--gy', `${(cardY * 100).toFixed(1)}%`);
        }
      };

      labStage.addEventListener('pointermove', placeLabLight, { passive: true });
      labStage.addEventListener('pointerdown', placeLabLight, { passive: true });
      labStage.addEventListener('pointerleave', resetLabCard);
    }

    if (highlightSwitch) {
      highlightSwitch.addEventListener('click', () => {
        const next = highlightSwitch.getAttribute('aria-checked') !== 'true';
        highlightSwitch.setAttribute('aria-checked', String(next));
        labStage.classList.toggle('is-highlight-off', !next);
      });
    }

    if (copyMaterialButton) {
      copyMaterialButton.addEventListener('click', async () => {
        const snapshot =
          `liquid-glass {\n  blur: ${Math.round(settings.blur)}px;\n  refraction: ${Math.round(settings.refraction)};\n  dispersion: ${Math.round(settings.dispersion)};\n}`;
        const copied = await copyText(snapshot);
        showLabToast(copied ? '这组材质已复制' : '复制失败，请手动选择');

        if (copied) {
          const label = $('span', copyMaterialButton);
          if (label) {
            window.clearTimeout(copyLabelTimeout);
            const originalLabel = label.dataset.original || label.textContent;
            label.dataset.original = originalLabel;
            label.textContent = '已复制，去用它';
            copyLabelTimeout = window.setTimeout(() => {
              label.textContent = originalLabel;
            }, 1900);
          }
        }
      });
    }
  }

  /* ------------------------------------------------------------------
     Toggle switches
  ------------------------------------------------------------------ */

  $$('.js-switch').forEach((button) => {
    button.addEventListener('click', () => {
      const next = button.getAttribute('aria-checked') !== 'true';
      button.setAttribute('aria-checked', String(next));

      const status = button.dataset.status ? document.getElementById(button.dataset.status) : null;
      if (status) {
        status.textContent = next ? button.dataset.on : button.dataset.off;
      }

      const wrapper = button.closest('.toggle-demo');
      if (wrapper) wrapper.classList.toggle('is-on', next);
    });
  });

  /* ------------------------------------------------------------------
     Standalone range input
  ------------------------------------------------------------------ */

  $$('.range:not([data-param])').forEach((input) => {
    const update = () => {
      updateRangeFill(input);
      if (input.dataset.output) {
        const output = document.getElementById(input.dataset.output);
        if (output) output.textContent = input.value;
      }
    };
    input.addEventListener('input', update);
    update();
  });

  /* ------------------------------------------------------------------
     The magnetic demo button
  ------------------------------------------------------------------ */

  const demoButton = $('#demoButton');

  if (demoButton) {
    if (finePointer.matches && !reduceMotion.matches) {
      demoButton.addEventListener('pointermove', (event) => {
        const rect = demoButton.getBoundingClientRect();
        const x = (event.clientX - (rect.left + rect.width / 2)) / rect.width;
        const y = (event.clientY - (rect.top + rect.height / 2)) / rect.height;
        demoButton.style.setProperty('--mag-x', `${(x * 7).toFixed(2)}px`);
        demoButton.style.setProperty('--mag-y', `${(y * 5).toFixed(2)}px`);
      }, { passive: true });

      demoButton.addEventListener('pointerleave', () => {
        demoButton.style.setProperty('--mag-x', '0px');
        demoButton.style.setProperty('--mag-y', '0px');
      });
    }

    demoButton.addEventListener('click', (event) => {
      const rect = demoButton.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.4;
      const ripple = document.createElement('span');
      const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
      const y = event.clientY ? event.clientY - rect.top : rect.height / 2;

      ripple.className = 'liquid-ripple';
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x - size / 2}px`;
      ripple.style.top = `${y - size / 2}px`;
      demoButton.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 850);
    });
  }

  /* ------------------------------------------------------------------
     Keyboard-friendly tabs with a liquid indicator
  ------------------------------------------------------------------ */

  function initTabs(root) {
    const tabs = $$('[role="tab"]', root);
    const pill = $('.tab-pill', root);
    const tablist = $('[role="tablist"]', root);
    if (!tabs.length || !pill || !tablist) return;

    let selectedIndex = Math.max(0, tabs.findIndex((tab) => tab.getAttribute('aria-selected') === 'true'));
    let resizeFrame = null;

    function movePill(immediate = false) {
      const activeTab = tabs[selectedIndex];
      if (!activeTab) return;

      if (immediate) pill.style.transition = 'none';
      pill.style.width = `${activeTab.offsetWidth}px`;
      pill.style.transform = `translateX(${activeTab.offsetLeft - 4}px)`;

      if (immediate) {
        window.requestAnimationFrame(() => {
          pill.style.transition = '';
        });
      }
    }

    function selectTab(index, moveFocus = false) {
      selectedIndex = (index + tabs.length) % tabs.length;

      tabs.forEach((tab, tabIndex) => {
        const selected = tabIndex === selectedIndex;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;

        const panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });

      movePill();
      if (moveFocus) tabs[selectedIndex].focus();
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => selectTab(index));
      tab.addEventListener('keydown', (event) => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();

        if (event.key === 'ArrowLeft') selectTab(selectedIndex - 1, true);
        if (event.key === 'ArrowRight') selectTab(selectedIndex + 1, true);
        if (event.key === 'Home') selectTab(0, true);
        if (event.key === 'End') selectTab(tabs.length - 1, true);
      });
    });

    window.requestAnimationFrame(() => movePill(true));
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => movePill(true));
    }

    window.addEventListener('resize', () => {
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        movePill(true);
        resizeFrame = null;
      });
    }, { passive: true });
  }

  $$('[data-tabs]').forEach(initTabs);

  /* ------------------------------------------------------------------
     Clipboard
  ------------------------------------------------------------------ */

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall through to the older method.
    }

    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      return copied;
    } catch (error) {
      return false;
    }
  }
})();
