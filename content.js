(() => {
  'use strict';

  const ROOT_ID = 'ink-fx-stage';
  const DEFAULTS = { enabled: true };
  const TRIGGER = 'ink';
  const EFFECT_URL = chrome.runtime.getURL('assets/ink-splash.png');

  let settings = { ...DEFAULTS };
  let lastTriggerAt = 0;
  let scanTimer = 0;
  let lastLocation = location.href;
  let pageHadTrigger = false;
  const inputMatchState = new WeakMap();

  const splashPreload = new Image();
  splashPreload.src = EFFECT_URL;
  if (splashPreload.decode) splashPreload.decode().catch(() => {});

  chrome.storage.sync.get(DEFAULTS, value => {
    settings = { ...DEFAULTS, ...value };
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.enabled) settings.enabled = changes.enabled.newValue;
    pageHadTrigger = false;
    schedulePageScan(80);
  });

  function editableText(target) {
    if (!(target instanceof Element)) return '';
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return target.value;
    }
    const editable = target.closest('[contenteditable="true"], [contenteditable="plaintext-only"]');
    return editable ? editable.textContent || '' : '';
  }

  function containsTrigger(text) {
    const escaped = TRIGGER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(String(text || ''));
  }

  function playEffect() {
    const now = Date.now();
    if (!settings.enabled || now - lastTriggerAt < 2300) return;
    lastTriggerAt = now;

    document.getElementById(ROOT_ID)?.remove();

    const stage = document.createElement('div');
    stage.id = ROOT_ID;
    stage.setAttribute('aria-hidden', 'true');

    const ring = document.createElement('div');
    ring.className = 'ink-fx-ring';
    stage.appendChild(ring);

    const character = document.createElement('div');
    character.className = 'ink-fx-character';

    const image = document.createElement('img');
    image.className = 'ink-fx-main';
    image.src = EFFECT_URL;
    image.alt = '';
    image.decoding = 'sync';

    character.appendChild(image);
    stage.appendChild(character);
    (document.documentElement || document.body).appendChild(stage);
    window.setTimeout(() => stage.remove(), 4250);
  }

  function checkEditableTarget(target) {
    if (!(target instanceof Element)) return;
    const matched = containsTrigger(editableText(target));
    const wasMatched = inputMatchState.get(target) || false;
    inputMatchState.set(target, matched);
    if (matched && !wasMatched) playEffect();
  }

  function pageContainsTrigger() {
    let url = location.href;
    try { url = decodeURIComponent(url); } catch { /* Keep encoded URL. */ }
    if (containsTrigger(`${document.title} ${url}`)) return true;

    const editables = document.querySelectorAll(
      'input[type="search"], input[type="text"], input:not([type]), textarea, ' +
      '[contenteditable="true"], [contenteditable="plaintext-only"]'
    );
    for (const element of editables) {
      if (containsTrigger(editableText(element))) return true;
    }

    return containsTrigger(document.body?.textContent?.slice(0, 50000) || '');
  }

  function scanPage() {
    scanTimer = 0;
    if (location.href !== lastLocation) {
      lastLocation = location.href;
      pageHadTrigger = false;
    }

    const hasTrigger = pageContainsTrigger();
    if (hasTrigger && !pageHadTrigger) {
      pageHadTrigger = true;
      playEffect();
    } else if (!hasTrigger) {
      pageHadTrigger = false;
    }
  }

  function schedulePageScan(delay = 420) {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scanPage, delay);
  }

  document.addEventListener('input', event => checkEditableTarget(event.target), true);
  document.addEventListener('compositionend', event => checkEditableTarget(event.target), true);
  document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing || event.repeat) return;
    if (containsTrigger(editableText(event.target))) playEffect();
  }, true);

  const observer = new MutationObserver(mutations => {
    if (mutations.every(mutation => mutation.target instanceof Element && mutation.target.closest?.(`#${ROOT_ID}`))) return;
    schedulePageScan();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  window.addEventListener('pageshow', () => schedulePageScan(120));
  window.addEventListener('popstate', () => schedulePageScan(120));
  window.setInterval(() => {
    if (location.href !== lastLocation) schedulePageScan(80);
  }, 1000);
  schedulePageScan(160);

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'INK_TEST_EFFECT') playEffect();
  });
})();
