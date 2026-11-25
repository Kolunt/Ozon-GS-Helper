(function () {
  if (window.__OZON_GS__) return;

  const utils = window.__OZON_GS_UTILS__;
  if (!utils) return;

  const { insertGsSeparators, looksLikeMarkingCode, isReadyToFormat, countGs } =
    utils;

  let reformatting = false;
  let hookInstalled = false;

  const nativeInputSet = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  ).set;
  const nativeInputGet = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  ).get;
  const nativeTextareaSet = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  ).set;
  const nativeTextareaGet = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype,
    'value'
  ).get;

  const watchedInputs = new Map();

  function isEnabled() {
    return document.documentElement?.dataset?.ozonGsEnabled !== '0';
  }

  function isTextInput(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  function escapeId(id) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      return CSS.escape(id);
    }
    return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function isMarkingInput(el) {
    if (!isTextInput(el)) return false;
    if (!el.id) return true;
    const label = document.querySelector(`label[for="${escapeId(el.id)}"]`);
    if (!label) return true;
    return label.textContent.includes('Код маркировки');
  }

  function resolveTextInput(eventOrNode) {
    const path =
      eventOrNode && typeof eventOrNode.composedPath === 'function'
        ? eventOrNode.composedPath()
        : [eventOrNode];

    for (const node of path) {
      if (isTextInput(node)) return node;
    }

    const target = eventOrNode?.target ?? eventOrNode;
    if (target?.closest) {
      const found = target.closest(
        'input, textarea, [contenteditable="true"], [contenteditable=""]'
      );
      if (found) return found;
    }

    const active = document.activeElement;
    if (isTextInput(active)) return active;

    return null;
  }

  function findMarkingInput(el) {
    if (el && isMarkingInput(el)) return el;
    const active = document.activeElement;
    if (isMarkingInput(active)) return active;
    const labeled = document.querySelector(
      'label[class*="c8s135-c4"]'
    );
    if (labeled?.htmlFor) {
      const input = document.getElementById(labeled.htmlFor);
      if (isTextInput(input)) return input;
    }
    return document.querySelector('input[id^="baseInput"]');
  }

  function readValue(el) {
    return el.isContentEditable ? el.textContent : el.value;
  }

  function dispatchInputEvents(el) {
    el.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        inputType: 'insertText',
      })
    );
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function writeValue(el, value) {
    if (el.isContentEditable) {
      el.textContent = value;
      dispatchInputEvents(el);
      return;
    }

    const lastValue = readValue(el);
    const nativeSet =
      el.tagName === 'TEXTAREA' ? nativeTextareaSet : nativeInputSet;

    nativeSet.call(el, value);

    if (el._valueTracker) {
      el._valueTracker.setValue(lastValue);
    }

    dispatchInputEvents(el);
  }

  function maybeFormatValue(value) {
    if (!value) return value;
    const trimmed = value.replace(/[\r\n]+$/, '');
    if (!isReadyToFormat(trimmed)) return value;
    const formatted = insertGsSeparators(trimmed);
    return formatted === trimmed ? value : formatted;
  }

  function formatField(el) {
    if (!el || !isTextInput(el)) {
      return { ok: false, reason: 'no_input' };
    }

    const before = readValue(el);
    if (!before) {
      return { ok: false, reason: 'empty' };
    }

    if (!isReadyToFormat(before)) {
      return { ok: false, reason: 'not_ready', before };
    }

    const formatted = insertGsSeparators(before.trim());
    if (formatted === before.trim()) {
      return { ok: false, reason: 'already_formatted', before };
    }

    reformatting = true;
    try {
      writeValue(el, formatted);
      if (!el.isContentEditable) {
        el.selectionStart = formatted.length;
        el.selectionEnd = formatted.length;
      }
    } finally {
      reformatting = false;
    }

    return {
      ok: true,
      before,
      after: formatted,
      gsCount: countGs(formatted),
      lengthBefore: before.length,
      lengthAfter: formatted.length,
    };
  }

  function formatActive() {
    return formatField(findMarkingInput());
  }

  function applyFormattedValue(el, value) {
    const formatted = maybeFormatValue(value);
    if (formatted === value) return false;

    reformatting = true;
    try {
      writeValue(el, formatted);
      if (!el.isContentEditable) {
        el.selectionStart = formatted.length;
        el.selectionEnd = formatted.length;
      }
    } finally {
      reformatting = false;
    }

    return true;
  }

  function maybeReformatElement(el) {
    if (!el || !isMarkingInput(el)) return false;
    return applyFormattedValue(el, readValue(el));
  }

  function scheduleReformat(el) {
    if (!el) return;
    [0, 16, 32, 64, 128, 256, 500].forEach((delay) => {
      setTimeout(() => maybeReformatElement(el), delay);
    });
  }

  function startWatching(el) {
    if (!el || watchedInputs.has(el)) return;

    let lastValue = readValue(el);
    const timerId = setInterval(() => {
      if (!document.contains(el)) {
        stopWatching(el);
        return;
      }

      const current = readValue(el);
      if (current !== lastValue) {
        lastValue = current;
        if (maybeReformatElement(el)) {
          lastValue = readValue(el);
        }
        return;
      }

      if (isReadyToFormat(current.replace(/[\r\n]+$/, ''))) {
        maybeReformatElement(el);
      }
    }, 30);

    watchedInputs.set(el, timerId);
  }

  function stopWatching(el) {
    const timerId = watchedInputs.get(el);
    if (timerId) {
      clearInterval(timerId);
      watchedInputs.delete(el);
    }
  }

  function handleBeforeInput(e) {
    if (!isEnabled() || reformatting) return;
    if (
      e.inputType !== 'insertText' &&
      e.inputType !== 'insertFromPaste' &&
      e.inputType !== 'insertReplacementText'
    ) {
      return;
    }

    const el = resolveTextInput(e);
    if (!el || !isMarkingInput(el)) return;

    const data = e.data ?? '';
    const start = el.selectionStart ?? readValue(el).length;
    const end = el.selectionEnd ?? start;
    const current = readValue(el);
    const nextValue = current.slice(0, start) + data + current.slice(end);

    if (!isReadyToFormat(nextValue.replace(/[\r\n]+$/, ''))) return;

    const formatted = insertGsSeparators(nextValue.trim());
    if (formatted === nextValue.trim()) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    writeValue(el, formatted);
  }

  function handlePaste(e) {
    if (!isEnabled()) return;

    const target = resolveTextInput(e);
    if (!target) return;

    const clipboard = e.clipboardData?.getData('text/plain');
    if (!clipboard || !looksLikeMarkingCode(clipboard)) return;

    const formatted = insertGsSeparators(clipboard);
    if (formatted === clipboard.trim()) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    writeValue(target, formatted);
    scheduleReformat(target);
  }

  function handleInput(e) {
    if (reformatting || !isEnabled()) return;
    scheduleReformat(resolveTextInput(e));
  }

  function handleKeyDown(e) {
    if (!isEnabled() || reformatting) return;

    const el = resolveTextInput(e);
    if (!el || !isMarkingInput(el)) return;

    if (e.key === 'Enter' || e.key === 'Tab') {
      const current = readValue(el).replace(/[\r\n]+$/, '');
      if (isReadyToFormat(current)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        formatField(el);
      }
      return;
    }

    scheduleReformat(el);
  }

  function handleKeyUp(e) {
    if (!isEnabled() || reformatting) return;
    scheduleReformat(resolveTextInput(e));
  }

  function handleFocusIn(e) {
    const el = resolveTextInput(e);
    if (!el) return;
    startWatching(el);
    scheduleReformat(el);
  }

  function handleFocusOut(e) {
    const el = resolveTextInput(e);
    if (!el) return;
    formatField(el);
    stopWatching(el);
  }

  function hookValueSetter(Proto, nativeSet, nativeGet) {
    const valueDescriptor = Object.getOwnPropertyDescriptor(Proto, 'value');
    if (!valueDescriptor?.set || valueDescriptor.configurable === false) return;

    Object.defineProperty(Proto, 'value', {
      configurable: true,
      enumerable: valueDescriptor.enumerable,
      get: function () {
        return nativeGet.call(this);
      },
      set: function (nextValue) {
        if (reformatting || typeof nextValue !== 'string') {
          nativeSet.call(this, nextValue);
          return;
        }

        const formatted = maybeFormatValue(nextValue);
        nativeSet.call(this, formatted);
      },
    });
  }

  function installValueHooks() {
    if (hookInstalled) return;
    hookInstalled = true;
    hookValueSetter(
      HTMLInputElement.prototype,
      nativeInputSet,
      nativeInputGet
    );
    hookValueSetter(
      HTMLTextAreaElement.prototype,
      nativeTextareaSet,
      nativeTextareaGet
    );
  }

  function hookElement(el) {
    if (!el || el.dataset?.ozonGsHooked === '1') return;
    el.dataset.ozonGsHooked = '1';
    el.addEventListener('beforeinput', handleBeforeInput, true);
    el.addEventListener('paste', handlePaste, true);
    el.addEventListener('input', handleInput, true);
    el.addEventListener('keydown', handleKeyDown, true);
    el.addEventListener('keyup', handleKeyUp, true);
    el.addEventListener('focus', handleFocusIn, true);
    el.addEventListener('blur', handleFocusOut, true);
  }

  function scanInputs(root) {
    if (!root?.querySelectorAll) return;
    root
      .querySelectorAll(
        'input, textarea, [contenteditable="true"], [contenteditable=""]'
      )
      .forEach(hookElement);
  }

  function installDomObserver() {
    scanInputs(document);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue;
          hookElement(node);
          scanInputs(node);
        }
      }
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function installGlobalListeners() {
    window.addEventListener('beforeinput', handleBeforeInput, true);
    window.addEventListener('paste', handlePaste, true);
    window.addEventListener('input', handleInput, true);
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('focusin', handleFocusIn, true);
    window.addEventListener('focusout', handleFocusOut, true);
  }

  function install() {
    installValueHooks();
    installGlobalListeners();
    document.documentElement.dataset.ozonGsInjected = '1';

    if (document.documentElement) {
      installDomObserver();
    } else {
      document.addEventListener('DOMContentLoaded', installDomObserver, {
        once: true,
      });
    }
  }

  window.__OZON_GS__ = {
    formatField,
    formatActive,
    version: '1.3.0',
  };

  install();
})();
