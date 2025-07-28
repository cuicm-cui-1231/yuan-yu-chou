// 全局状态管理
const appState = {
  sections: ['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7', 'part8', 'part9', 'part10', 'part11', 'part12', 'part13', 'part14', 'part15', 'part16', 'part17', 'part18', 'part19', 'part20', 'part21', 'part22'],
  currentPage: 0,
  isAnimating: false,
  isInitializing: true,
  contentCache: {}
};

// DOM 元素引用
const domElements = {
  book: null,
  pages: null,
  prevBtn: null,
  nextBtn: null,
  pageIndicator: null
};

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
  initializeElements();
  setupEventListeners();
  loadInitialPage();
});

function initializeElements() {
  domElements.book = document.querySelector('.flip-book');
  if (domElements.book) {
    domElements.pages = document.querySelectorAll('.flip-page');
    domElements.prevBtn = document.querySelector('.prev-page');
    domElements.nextBtn = document.querySelector('.next-page');
    domElements.pageIndicator = document.querySelector('.page-indicator');
  }
}

function setupEventListeners() {
  // 导航按钮
  if (domElements.prevBtn) domElements.prevBtn.addEventListener('click', () => navigate('prev'));
  if (domElements.nextBtn) domElements.nextBtn.addEventListener('click', () => navigate('next'));
  
  // 键盘导航
  document.addEventListener('keydown', handleKeyboardNavigation);
  
  // 触摸事件
  setupTouchEvents();
  
  // 哈希路由
  window.addEventListener('hashchange', handleHashChange);
}

function loadInitialPage() {
  const savedPage = localStorage.getItem('lastViewedPage');
  const initialHash = savedPage || '#part1';
  
  // 初始化时不触发hashchange
  appState.ignoreHashChange = true;
  window.location.hash = initialHash;
  
  const initialSection = initialHash.substring(1);
  const pageIndex = findPageIndex(initialSection);
  
  if (pageIndex !== -1) {
    appState.currentPage = pageIndex;
    updatePageState(true);
    loadContent(initialSection);
  }
  
  // 标记初始化完成
  setTimeout(() => {
    appState.isInitializing = false;
    appState.ignoreHashChange = false;
  }, 500);
}

// 核心功能函数
async function loadContent(sectionId) {
  if (!sectionId || !appState.sections.includes(sectionId)) {
    console.warn(`无效章节: ${sectionId}`);
    return false;
  }

  const pageElement = document.querySelector(`.flip-page[data-section="${sectionId}"] .page-content`);
  if (!pageElement) return false;

  try {
    // 显示加载状态
    pageElement.innerHTML = '<div class="loading-spinner">加载中...</div>';

    // 检查缓存
    if (appState.contentCache[sectionId]) {
      pageElement.innerHTML = appState.contentCache[sectionId];
      return true;
    }

    // 获取内容
    const response = await fetch(`./chapters/${sectionId}.html?t=${Date.now()}`);
    if (!response.ok) throw new Error(`HTTP错误: ${response.status}`);
    
    const html = await response.text();
    if (!html.trim()) throw new Error('内容为空');

    // 更新DOM和缓存
    pageElement.innerHTML = html;
    appState.contentCache[sectionId] = html;
    
    // 预加载相邻章节
    preloadAdjacentChapters(sectionId);
    
    return true;
  } catch (error) {
    console.error(`加载失败: ${sectionId}`, error);
    pageElement.innerHTML = `
      <div class="error-state">
        <p>加载内容失败</p>
        <button onclick="loadContent('${sectionId}')">重试</button>
      </div>
    `;
    return false;
  }
}

// 导航控制
function navigate(direction) {
  if (appState.isAnimating) return;
  
  const newPage = direction === 'next' 
    ? Math.min(appState.currentPage + 1, domElements.pages.length - 1)
    : Math.max(appState.currentPage - 1, 0);

  if (newPage !== appState.currentPage) {
    const section = domElements.pages[newPage].getAttribute('data-section');
    appState.ignoreHashChange = true;
    window.location.hash = `#${section}`;
    animatePageTransition(newPage);
  }
}

function animatePageTransition(newPage) {
  appState.isAnimating = true;
  appState.currentPage = newPage;
  
  // 更新页面状态
  updatePageState();
  
  // 加载内容
  const section = domElements.pages[newPage].getAttribute('data-section');
  loadContent(section).finally(() => {
    appState.isAnimating = false;
    appState.ignoreHashChange = false;
    localStorage.setItem('lastViewedPage', `#${section}`);
  });
}

// 路由处理
function handleHashChange() {
  if (appState.ignoreHashChange || appState.isInitializing) {
    appState.ignoreHashChange = false;
    return;
  }

  const section = window.location.hash.substring(1);
  if (!appState.sections.includes(section)) return;

  const newPage = findPageIndex(section);
  if (newPage !== -1 && newPage !== appState.currentPage && !appState.isAnimating) {
    animatePageTransition(newPage);
  }
}

// 辅助函数
function findPageIndex(section) {
  return Array.from(domElements.pages).findIndex(
    page => page.getAttribute('data-section') === section
  );
}

function updatePageState(isInitialLoad = false) {
  domElements.pages.forEach((page, index) => {
    if (index < appState.currentPage) {
      page.classList.remove('flipping');
    } else if (index > appState.currentPage) {
      page.classList.add('flipping');
    }
    
    page.classList.toggle('active', index === appState.currentPage);
  });

  updateNavigationButtons();
  updatePageIndicator();
}

function updateNavigationButtons() {
  if (domElements.prevBtn && domElements.nextBtn) {
    domElements.prevBtn.disabled = appState.currentPage === 0;
    domElements.nextBtn.disabled = appState.currentPage === domElements.pages.length - 1;
  }
}

function updatePageIndicator() {
  if (domElements.pageIndicator) {
    const totalPages = domElements.pages.length - 1; // 减去封面
    const currentPageNum = appState.currentPage > 0 ? appState.currentPage : 1;
    domElements.pageIndicator.textContent = `${currentPageNum} / ${totalPages}`;
  }
}

// 输入处理
function handleKeyboardNavigation(e) {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    navigate('prev');
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    navigate('next');
  }
}

function setupTouchEvents() {
  let touchStartX = 0;
  
  domElements.book?.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  domElements.book?.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > 50) {
      diff > 0 ? navigate('next') : navigate('prev');
    }
  }, { passive: true });
}

// 预加载优化
function preloadAdjacentChapters(currentSection) {
  const currentIndex = appState.sections.indexOf(currentSection);
  const preloadRange = 2; // 前后预加载2章
  
  for (let i = 1; i <= preloadRange; i++) {
    if (currentIndex + i < appState.sections.length) {
      preloadChapter(appState.sections[currentIndex + i]);
    }
    if (currentIndex - i >= 0) {
      preloadChapter(appState.sections[currentIndex - i]);
    }
  }
}

async function preloadChapter(section) {
  if (appState.contentCache[section]) return;
  
  try {
    const response = await fetch(`./chapters/${section}.html?t=${Date.now()}`);
    if (response.ok) {
      const html = await response.text();
      appState.contentCache[section] = html;
    }
  } catch (error) {
    console.log(`预加载失败: ${section}`, error);
  }
}