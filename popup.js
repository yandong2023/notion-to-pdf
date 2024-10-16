let progressBar;

document.getElementById('generatePDF').addEventListener('click', async () => {
  console.log('Generate PDF button clicked');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  console.log('Current tab:', tab);
  if (!tab.url.includes('notion.so')) {
    showMessage('请在Notion页面上使用此扩展');
    return;
  }

  const includeSubpages = document.getElementById('includeSubpages').checked;

  // 创建进度条
  createProgressBar();

  chrome.tabs.sendMessage(tab.id, { 
    action: 'generatePDF',
    includeSubpages: includeSubpages
  }, (response) => {
    if (chrome.runtime.lastError) {
      console.error('Error:', chrome.runtime.lastError);
      showMessage('发生错误：' + chrome.runtime.lastError.message);
    } else if (response && response.success) {
      console.log('PDF generation result:', response.message);
      showMessage(response.message);
    } else {
      showMessage('生成PDF时发生错误：' + (response ? response.message : '未知错误'));
    }
  });
});

function showMessage(message) {
  alert(message);
}

function createProgressBar() {
  progressBar = document.createElement('div');
  progressBar.style.width = '100%';
  progressBar.style.height = '20px';
  progressBar.style.backgroundColor = '#f0f0f0';
  progressBar.style.marginTop = '10px';
  progressBar.style.position = 'relative';

  const progressInner = document.createElement('div');
  progressInner.style.width = '0%';
  progressInner.style.height = '100%';
  progressInner.style.backgroundColor = '#4CAF50';
  progressInner.style.position = 'absolute';
  progressInner.style.left = '0';
  progressInner.style.top = '0';

  const progressText = document.createElement('div');
  progressText.style.position = 'absolute';
  progressText.style.width = '100%';
  progressText.style.height = '100%';
  progressText.style.display = 'flex';
  progressText.style.alignItems = 'center';
  progressText.style.justifyContent = 'center';
  progressText.style.color = '#000';

  progressBar.appendChild(progressInner);
  progressBar.appendChild(progressText);
  document.body.appendChild(progressBar);
}

function updateProgress(progress) {
  if (progressBar) {
    const progressInner = progressBar.querySelector('div');
    const progressText = progressBar.querySelector('div:last-child');
    progressInner.style.width = `${progress}%`;
    progressText.textContent = `${progress}%`;
  }
}

// 监听来自 content script 的进度更新消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateProgress') {
    updateProgress(request.progress);
  }
});

function generatePDF() {
  console.log('generatePDF function started');
  
  // 模拟一些耗时操作
  for (let i = 0; i < 5; i++) {
    console.log(`Step ${i + 1} of generatePDF`);
  }

  console.log('generatePDF function completed');
  return 'PDF generation process completed';
}
