const DEFAULTS = { enabled: true };
const enabled = document.querySelector('#enabled');
const status = document.querySelector('#status');

function showStatus(text) {
  status.textContent = text;
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => { status.textContent = ''; }, 2200);
}

chrome.storage.sync.get(DEFAULTS, settings => {
  enabled.checked = settings.enabled;
});

enabled.addEventListener('change', () => {
  chrome.storage.sync.set({ enabled: enabled.checked }, () => showStatus('已保存'));
});

document.querySelector('#test').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return showStatus('没有可预览的网页');
  chrome.tabs.sendMessage(tab.id, { type: 'INK_TEST_EFFECT' }, () => {
    if (chrome.runtime.lastError) showStatus('请先刷新当前网页');
    else showStatus('墨汁已弹出');
  });
});
