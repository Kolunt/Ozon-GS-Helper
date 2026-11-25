(function () {
  function syncEnabled(enabled) {
    document.documentElement.dataset.ozonGsEnabled = enabled ? '1' : '0';
  }

  chrome.storage.local.get({ enabled: true }, (result) => {
    syncEnabled(result.enabled);
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.enabled) {
      syncEnabled(changes.enabled.newValue);
    }
  });
})();
