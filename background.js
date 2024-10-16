console.log('Background script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Received message in background:', request);
    if (request.action === "injectScript") {
        console.log('Attempting to inject script:', request.file);
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            files: [request.file]
        }, (results) => {
            if (chrome.runtime.lastError) {
                console.error('Error injecting script:', chrome.runtime.lastError);
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                console.log('Script injected successfully:', request.file);
                sendResponse({ success: true });
            }
        });
        return true;  // 表示我们会异步发送响应
    }
    if (request.action === "injectHtml2pdf") {
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            files: ['html2pdf.bundle.min.js']
        }, () => {
            if (chrome.runtime.lastError) {
                sendResponse({ error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true });
            }
        });
        return true;  // 表示我们会异步发送响应
    }
});
