async function isExtensionLoaded(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    world: 'MAIN',
    func: () => Boolean(window.__OZON_GS__),
  });

  return Boolean(results[0]?.result);
}

async function ensureLoaded(tabId) {
  if (await isExtensionLoaded(tabId)) return;

  await chrome.scripting.executeScript({
    target: { tabId, allFrames: false },
    files: ['utils.js', 'content-main.js'],
    world: 'MAIN',
  });
}

async function runFormat(tabId) {
  await ensureLoaded(tabId);

  const results = await chrome.scripting.executeScript({
    target: { tabId, allFrames: true },
    world: 'MAIN',
    func: () => {
      if (window.__OZON_GS__?.formatActive) {
        return window.__OZON_GS__.formatActive();
      }
      return { ok: false, reason: 'not_loaded' };
    },
  });

  const formatted = results.map((entry) => entry.result).find((result) => result?.ok);
  if (formatted) return formatted;

  const fallback = results
    .map((entry) => entry.result)
    .find((result) => result && result.reason !== 'not_loaded');

  return fallback || { ok: false, reason: 'not_loaded' };
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'format-marking-code') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url?.startsWith('https://seller.ozon.ru/')) return;

  await runFormat(tab.id);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'FORMAT_ACTIVE') return;

  chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
    if (!tab?.id) {
      sendResponse({ ok: false, reason: 'no_tab' });
      return;
    }

    try {
      const result = await runFormat(tab.id);
      sendResponse(result);
    } catch (error) {
      sendResponse({ ok: false, reason: String(error) });
    }
  });

  return true;
});
