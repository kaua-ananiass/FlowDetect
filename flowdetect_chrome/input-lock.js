(() => {
  if (globalThis.__flowDetectInputLockRefresh) return globalThis.__flowDetectInputLockRefresh();
  let runId = null, timer = null, notice = null, revision = 0;
  const events = ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick',
    'contextmenu', 'wheel', 'touchstart', 'touchmove', 'touchend', 'keydown', 'keyup', 'keypress',
    'beforeinput', 'paste', 'cut', 'drop', 'dragstart'];
  function disable() {
    revision++;
    runId = null;
    clearTimeout(timer);
    notice?.remove(); notice = null;
  }
  async function refresh() {
    const ticket = ++revision;
    try {
      let deadline;
      const state = await Promise.race([
        Promise.resolve(chrome.runtime.sendMessage({ type: 'flowdetect-input-lock-state' })).finally(() => clearTimeout(deadline)),
        new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Worker indisponível')), 2000); }),
      ]);
      if (ticket !== revision) return;
      clearTimeout(timer);
      if (!state?.locked) { disable(); return; }
      runId = state.runId;
      if (window === window.top && !notice && document.documentElement) {
        notice = document.createElement('div');
        notice.setAttribute('data-flowdetect-input-lock', 'true');
        notice.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:2147483647;pointer-events:none';
        const shadow = notice.attachShadow({ mode: 'closed' });
        const badge = document.createElement('div');
        badge.style.cssText = 'padding:8px 14px;border-radius:12px;background:#102030;color:#e8f6ff;font:12px/1.5 system-ui;box-shadow:0 4px 20px #0005;text-align:center';
        badge.textContent = 'Automação em execução · Interação bloqueada · Ctrl+Alt+Shift+L para liberar';
        shadow.append(badge);
        document.documentElement.append(notice);
      }
      // A lost worker or a completed run must never leave the document locked.
      timer = setTimeout(refresh, 1000);
    } catch (_) { if (ticket === revision) disable(); }
  }
  function block(event) {
    if (!runId || !event.isTrusted) return;
    if (event.type === 'keydown' && event.ctrlKey && event.altKey && event.shiftKey && event.code === 'KeyL') {
      const id = runId;
      disable();
      Promise.resolve(chrome.runtime.sendMessage({ type: 'flowdetect-input-lock-release', runId: id })).catch(() => {});
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  for (const name of events) window.addEventListener(name, block, { capture: true, passive: false });
  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'flowdetect-input-lock-refresh') refresh();
  });
  globalThis.__flowDetectInputLockRefresh = refresh;
  return refresh();
})();
