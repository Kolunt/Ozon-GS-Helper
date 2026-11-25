const checkbox = document.getElementById('enabled');
const formatButton = document.getElementById('format');
const status = document.getElementById('status');

chrome.storage.local.get({ enabled: true }, (result) => {
  checkbox.checked = result.enabled;
});

checkbox.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: checkbox.checked });
});

function setStatus(text, isError) {
  status.textContent = text;
  status.className = isError ? 'status error' : 'status ok';
}

formatButton.addEventListener('click', () => {
  setStatus('Форматирование...', false);

  chrome.runtime.sendMessage({ type: 'FORMAT_ACTIVE' }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus('Ошибка: ' + chrome.runtime.lastError.message, true);
      return;
    }

    if (!response?.ok) {
      const reasons = {
        no_input: 'Поставьте курсор в поле «Код маркировки»',
        empty: 'Поле пустое',
        not_ready: 'Код ещё не полный или неверный формат',
        already_formatted: 'GS-разделители уже добавлены',
        not_loaded: 'Перезагрузите вкладку Ozon',
        no_tab: 'Вкладка не найдена',
      };
      setStatus(reasons[response?.reason] || 'Не удалось отформатировать', true);
      return;
    }

    setStatus(
      'Готово: ' +
        response.lengthBefore +
        ' → ' +
        response.lengthAfter +
        ' симв. (GS невидим, добавлено ' +
        response.gsCount +
        ')',
      false
    );
  });
});
