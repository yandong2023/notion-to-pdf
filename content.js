console.log('Content script loaded');

// 添加一个函数来处理 PDF 生成
async function handlePDFGeneration(request) {
  console.log('Handling PDF generation request:', request);
  
  try {
    updateProgress(10); // 开始加载 html2pdf 库
    await loadHtml2pdf();
    
    if (typeof html2pdf === 'undefined') {
      throw new Error('html2pdf is still undefined after loading');
    }
    
    updateProgress(20); // 开始获取页面内容
    const contents = await getPageContents(request.includeSubpages);
    
    updateProgress(60); // 页面内容获取完成，开始生成 PDF
    
    const pdfContents = splitContentsBySize(contents, 10 * 1024 * 1024); // 10MB
    const pdfPromises = pdfContents.map((content, index) => generateSinglePDF(content, index));
    await Promise.all(pdfPromises);

    updateProgress(100); // PDF 生成完成
    console.log('All PDFs generation completed');
    return `Successfully generated ${pdfContents.length} PDF(s)`;
  } catch (error) {
    console.error('Error generating PDFs:', error);
    return 'Error generating PDFs: ' + error.message;
  }
}

// 新增函数：按大小拆分内容
function splitContentsBySize(contents, maxSize) {
  const pdfContents = [];
  let currentContent = '';
  let currentSize = 0;

  contents.forEach(content => {
    const contentSize = new Blob([content]).size;
    if (currentSize + contentSize > maxSize) {
      pdfContents.push(currentContent);
      currentContent = content;
      currentSize = contentSize;
    } else {
      currentContent += content;
      currentSize += contentSize;
    }
  });

  if (currentContent) {
    pdfContents.push(currentContent);
  }

  return pdfContents;
}

// 新增函数：生成单个 PDF
async function generateSinglePDF(content, index) {
  const element = document.createElement('div');
  element.innerHTML = content;
  
  const opt = {
    margin: 10,
    filename: `notion_export_${index + 1}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      logging: true
    },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  await html2pdf().set(opt).from(element).save();
  console.log(`PDF ${index + 1} generated`);
}

// 加载 html2pdf 库
function loadHtml2pdf() {
  return new Promise((resolve, reject) => {
    if (typeof html2pdf !== 'undefined') {
      console.log('html2pdf is already defined');
      resolve();
      return;
    }
    console.log('Requesting html2pdf injection');
    chrome.runtime.sendMessage({ action: "injectHtml2pdf" }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error injecting html2pdf:', chrome.runtime.lastError);
        reject(new Error(chrome.runtime.lastError.message));
      } else if (response.success) {
        console.log('html2pdf injected successfully');
        if (typeof html2pdf !== 'undefined') {
          resolve();
        } else {
          reject(new Error('html2pdf is still undefined after injection'));
        }
      } else {
        reject(new Error(response.error || 'Unknown error injecting html2pdf'));
      }
    });
  });
}

// 获取页面内容的函数
async function getPageContents(includeSubpages = true) {
  updateProgress(25); // 开始获取页面内容
  await waitForElement('.notion-page-content');
  
  updateProgress(30); // 开始展开可折叠内容
  await expandAllCollapsibleContent();
  
  const content = document.querySelector('.notion-page-content');
  if (!content) {
    console.warn('未找到 .notion-page-content 元素');
    return [];
  }
  
  const clonedContent = content.cloneNode(true);
  
  updateProgress(35); // 开始处理图片
  await processImages(clonedContent);
  
  const contents = [clonedContent.outerHTML];
  
  if (includeSubpages) {
    updateProgress(40); // 开始获取子页面内容
    console.log('开始获取��页面内容');
    const subpageContents = await getSubpagesContents(clonedContent);
    contents.push(...subpageContents);
    console.log('子页面内容获取完成');
  }
  
  updateProgress(55); // 页面内容处理完成
  return contents;
}

// 等待元素出现的函数
function waitForElement(selector) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) {
      return resolve(document.querySelector(selector));
    }

    const observer = new MutationObserver(mutations => {
      if (document.querySelector(selector)) {
        resolve(document.querySelector(selector));
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  });
}

// 展开所有可折叠的内容
async function expandAllCollapsibleContent() {
  const expandButtons = document.querySelectorAll('.notion-expandable-content button');
  for (const button of expandButtons) {
    button.click();
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待内容加载
  }
}

// 处理图片
async function processImages(element) {
  const images = element.querySelectorAll('img');
  for (const img of images) {
    if (img.src.startsWith('data:')) continue; // 跳过已经是 base64 的图片
    try {
      const response = await fetch(img.src, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      const blob = await response.blob();
      const reader = new FileReader();
      await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      img.src = reader.result;
    } catch (error) {
      console.error('处理图片时出错:', error);
    }
  }
}

// 获取子页面内容
async function getSubpagesContents(parentElement) {
  const subpageLinks = parentElement.querySelectorAll('a[href^="/"]');
  console.log(`Found ${subpageLinks.length} subpage links`);
  
  const subpageContents = [];
  
  for (let i = 0; i < subpageLinks.length; i++) {
    const link = subpageLinks[i];
    const subpageUrl = new URL(link.href, window.location.origin).href;
    console.log('Processing subpage:', subpageUrl);
    
    try {
      const subpageContent = await fetchSubpageContent(subpageUrl);
      if (subpageContent) {
        subpageContents.push(`<h1>${link.textContent}</h1>${subpageContent}`);
        console.log(`Subpage content added for ${subpageUrl}`);
      } else {
        console.warn(`No content found for ${subpageUrl}`);
        subpageContents.push(`<h1>${link.textContent}</h1><p>无法获取内容</p>`);
      }
    } catch (error) {
      console.error(`Error processing subpage ${subpageUrl}:`, error);
      subpageContents.push(`<h1>${link.textContent}</h1><p>处理时出错: ${error.message}</p>`);
    }
    
    updateProgress(40 + (i + 1) / subpageLinks.length * 15);
  }
  
  return subpageContents;
}

// 新增函数：获取子页面内容
async function fetchSubpageContent(url) {
  try {
    console.log(`Fetching content for ${url}`);
    const response = await fetch(url, { 
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    
    // 等待页面加载完成
    await waitForElement('.notion-page-content', doc);
    
    const content = doc.querySelector('.notion-page-content');
    if (content) {
      console.log(`Content found for ${url}`);
      const clonedContent = content.cloneNode(true);
      await processImages(clonedContent);
      await expandAllCollapsibleContent(clonedContent);
      return clonedContent.outerHTML;
    } else {
      console.warn(`No .notion-page-content found for ${url}`);
      // 尝试获取整个 body 内容
      const body = doc.body;
      if (body) {
        console.log(`Returning full body content for ${url}`);
        return body.innerHTML;
      }
    }
    console.error(`No content found for ${url}`);
    return null;
  } catch (error) {
    console.error(`Error fetching content for ${url}:`, error);
    return null;
  }
}

// 修改 waitForElement 函数以接受可选的 context 参数
function waitForElement(selector, context = document) {
  return new Promise(resolve => {
    if (context.querySelector(selector)) {
      return resolve(context.querySelector(selector));
    }

    const observer = new MutationObserver(mutations => {
      if (context.querySelector(selector)) {
        resolve(context.querySelector(selector));
        observer.disconnect();
      }
    });

    observer.observe(context === document ? document.body : context, {
      childList: true,
      subtree: true
    });

    // 设置超时，避免无限等待
    setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, 10000); // 10 秒超时
  });
}

// 修改 expandAllCollapsibleContent 函数以接受可选的 context 参数
async function expandAllCollapsibleContent(context = document) {
  const expandButtons = context.querySelectorAll('.notion-expandable-content button');
  for (const button of expandButtons) {
    button.click();
    await new Promise(resolve => setTimeout(resolve, 500)); // 等待内容加载
  }
}

// 在文件开头添加这个函数
function updateProgress(progress) {
  chrome.runtime.sendMessage({ action: 'updateProgress', progress: progress });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received in content script:', request);
  if (request.action === 'generatePDF') {
    console.log('Starting PDF generation process');
    handlePDFGeneration(request).then(result => {
      sendResponse({ success: true, message: result });
    }).catch(error => {
      sendResponse({ success: false, message: error.toString() });
    });
    return true; // 表示我们会异步发送响应
  }
});
