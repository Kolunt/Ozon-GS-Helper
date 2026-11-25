(function initOzonGsUtils(global) {
  if (global.__OZON_GS_UTILS__) {
    if (typeof module !== 'undefined' && module.exports) {
      module.exports = global.__OZON_GS_UTILS__;
    }
    return;
  }

  const GS = '\u001d';
  const AI91_KEY_LENGTH = 4;
  const HEADER_LENGTH = 18;

  function findAi91Index(code) {
    for (let i = HEADER_LENGTH; i < code.length - 1; i++) {
      if (code[i] === '9' && code[i + 1] === '1') {
        return i;
      }
    }
    return -1;
  }

  function findAi92Index(code, idx91) {
    if (idx91 === -1) return -1;

    const expected = idx91 + 2 + AI91_KEY_LENGTH;
    if (
      expected < code.length &&
      code[expected] === '9' &&
      code[expected + 1] === '2'
    ) {
      return expected;
    }

    for (let i = idx91 + 2; i < code.length - 1; i++) {
      if (code[i] === '9' && code[i + 1] === '2') {
        return i;
      }
    }

    return -1;
  }

  function insertGsSeparators(raw) {
    const code = raw.trim();

    if (/[\r\n]/.test(code)) return code;
    if (code.includes(GS)) return code;
    if (!/^01\d{14}21/.test(code)) return code;

    const idx91 = findAi91Index(code);
    const idx92 = findAi92Index(code, idx91);
    if (idx91 === -1 || idx92 === -1) return code;

    const withSecondGs = code.slice(0, idx92) + GS + code.slice(idx92);
    return withSecondGs.slice(0, idx91) + GS + withSecondGs.slice(idx91);
  }

  function looksLikeMarkingCode(text) {
    const trimmed = text.trim();
    if (/[\r\n]/.test(trimmed)) return false;
    return /^01\d{14}21/.test(trimmed) && !trimmed.includes(GS);
  }

  function isReadyToFormat(text) {
    const code = text.trim();
    if (!looksLikeMarkingCode(code)) return false;
    const idx91 = findAi91Index(code);
    return findAi92Index(code, idx91) !== -1;
  }

  function countGs(text) {
    return (text.match(/\u001d/g) || []).length;
  }

  const api = {
    insertGsSeparators,
    looksLikeMarkingCode,
    isReadyToFormat,
    findAi91Index,
    findAi92Index,
    countGs,
    GS,
  };

  global.__OZON_GS_UTILS__ = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(
  typeof globalThis !== 'undefined'
    ? globalThis
    : typeof window !== 'undefined'
      ? window
      : global
);
