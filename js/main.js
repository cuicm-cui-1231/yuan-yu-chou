// 全局变量定义
const sections = ['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7', 'part8', 'part9', 'part10', 'part11', 'part12',  'part13', 'part14', 'part15', 'part16', 'part17', 'part18',  'part19', 'part20', 'part21', 'part22'];

// 缓存和DOM引用
const contentCache = {};
let book, pages, prevBtn, nextBtn, pageIndicator;
let currentPage = 0;
let isAnimating = false;
let ignoreHashChange = false; // 新增标志位
let isInitializing = true;
let isProcessingHashChange = false;
let coverPage;

document.addEventListener('DOMContentLoaded', function() {
    // 先初始化DOM引用
    book = document.querySelector('.flip-book');
    if (!book) return;
    
    pages = document.querySelectorAll('.flip-page');
    prevBtn = document.querySelector('.prev-page');
    nextBtn = document.querySelector('.next-page');
    pageIndicator = document.querySelector('.page-indicator');
    coverPage = document.querySelector('[data-section="cover"]');
    
    // 初始化翻书功能
    initFlipBook();
    
    // 加载上次浏览的页面或默认页面
    const lastPage = localStorage.getItem('lastViewedPage');
    const initialSection = lastPage && sections.includes(lastPage.substring(1)) ? lastPage : '#part1';
    
    ignoreHashChange = true;
    window.location.hash = initialSection;
    initCurrentPage();
    
    // 设置初始化完成标志
    setTimeout(() => {
        isInitializing = false;
        ignoreHashChange = false;
        // 强制加载当前页内容
        loadContent(initialSection.substring(1));
    }, 300);
    
    // 其他初始化
    setupMobileMenu();
    setupDarkMode();
});

window.addEventListener('hashchange', () => {
    saveCurrentPage();
    // 1. 忽略程序控制的hash变化
    if (ignoreHashChange || isProcessingHashChange) {
        ignoreHashChange = false;
        return;
    }

    // 2. 防止重复处理
    if (isAnimating) return;
    isProcessingHashChange = true;

    // 3. 获取目标章节
    const section = window.location.hash.substring(1);
    if (!sections.includes(section)) {
        isProcessingHashChange = false;
        return;
    }

    // 4. 查找对应页面索引
    const newPage = Array.from(pages).findIndex(page => 
        page.getAttribute('data-section') === section
    );

    // 5. 如果需要跳转页面
    if (newPage !== -1 && newPage !== currentPage) {
        currentPage = newPage;
        
        // 6. 更新页面状态
        updateButtons();
        updatePageIndicator();
        
        // 7. 执行翻页动画
        flipToPage(newPage, () => {
            isProcessingHashChange = false;
            localStorage.setItem('lastViewedPage', `#${section}`);
        });
    } else {
        isProcessingHashChange = false;
    }
});

// 新增的翻页函数
function flipToPage(targetPage, callback) {
    if (isAnimating) return;
    isAnimating = true;
    
    // 计算翻页方向
    const direction = targetPage > currentPage ? 'next' : 'prev';
    
    // 执行动画
    pages.forEach((page, index) => {
        if (direction === 'next') {
            if (index < targetPage) page.classList.remove('flipping');
            else if (index > currentPage) page.classList.add('flipping');
        } else {
            if (index > targetPage) page.classList.add('flipping');
            else if (index < currentPage) page.classList.remove('flipping');
        }
    });
    
    // 加载内容
    const section = pages[targetPage].getAttribute('data-section');
    loadContent(section).then(() => {
        currentPage = targetPage;
        updateAfterFlip();
        if (callback) callback();
    });
}

// 核心功能函数
// 修改loadContent函数，确保强制加载
// 修改loadContent函数
async function loadContent(sectionId) {
    let section = sectionId || window.location.hash.substring(1);
    if (!section) section = 'part1';

    const pageElement = document.querySelector(`.flip-page[data-section="${section}"]`);
    if (!pageElement) return false;

    const pageContent = pageElement.querySelector('.page-content');
    if (!pageContent) return false;

    try {
        // 显示加载状态
        pageContent.innerHTML = '<div class="loading-spinner">加载中...</div>';
        
        // 尝试获取真实内容
        let html = await tryFetchContent(section);
        
        // 如果获取失败，使用备用内容
        if (!html) {
            html = generateFallbackContent(section);
        }
        
        // 更新DOM
        pageContent.innerHTML = html;
        updateActiveNav(section);
        
        return true;
    } catch (error) {
        console.error(`加载 ${section} 失败:`, error);
        pageContent.innerHTML = generateErrorContent(section, error);
        return false;
    }
}

async function tryFetchContent(section) {
    try {
        const response = await fetch(`./chapters/${section}.html?t=${Date.now()}`, {
            cache: 'no-store',
            mode: 'no-cors'
        });
        
        if (!response.ok) throw new Error('HTTP错误');
        const html = await response.text();
        return html.trim() ? html : null;
    } catch (error) {
        console.warn(`无法加载 ${section}.html`, error);
        return null;
    }
}

function generateFallbackContent(section) {
    return `
        <div class="chapter-content">
            <h2>${section}</h2>
            <p>本章节内容正在建设中...</p>
            <p>最后更新时间: ${new Date().toLocaleString()}</p>
        </div>
    `;
}

function generateErrorContent(section, error) {
    return `
        <div class="error-state">
            <p>加载 ${section} 失败</p>
            <p>${error.message}</p>
            <button onclick="loadContent('${section}')">重试</button>
        </div>
    `;
}

// 增强的错误状态显示
function showErrorState(section, message) {
    const pageContent = document.querySelector(`.flip-page[data-section="${section}"] .page-content`);
    if (pageContent) {
        pageContent.innerHTML = `
            <div class="error-state">
                <p>${message}</p>
                <button onclick="loadContent('${section}')">重试</button>
            </div>
        `;
    }
}
function updatePageContent(section, html) {
    const pageContent = document.querySelector(`.flip-page[data-section="${section}"] .page-content`);
    if (pageContent) {
        pageContent.innerHTML = html;
        updateActiveNav(section);
    }
}



// 预加载功能
async function preloadAdjacentChapters(currentSection) {
    const currentIndex = sections.indexOf(currentSection);
    const preloadCount = 2; // 预加载前后2章
    
    for (let i = 1; i <= preloadCount; i++) {
        if (currentIndex + i < sections.length) {
            preloadChapter(sections[currentIndex + i]);
        }
        if (currentIndex - i >= 0) {
            preloadChapter(sections[currentIndex - i]);
        }
    }
}

async function preloadChapter(section) {
    if (contentCache[section]) return;
    
    try {
        const response = await fetch(`./chapters/${section}.html?t=${Date.now()}`);
        if (response.ok) {
            const html = await response.text();
            contentCache[section] = html;
        } else {
            console.log(`预加载 ${section} 失败: 文件不存在或服务器错误`);
        }
    } catch (error) {
        console.log(`预加载 ${section} 失败:`, error);
    }
}

// 翻书功能
function initFlipBook() {
    initPages();
    coverPage = document.querySelector('[data-section="cover"]')
    initCurrentPage();
    updateButtons();
    
    // 事件监听
    prevBtn.addEventListener('click', () => flipPage('prev'));
    nextBtn.addEventListener('click', () => flipPage('next'));
    document.addEventListener('keydown', handleKeyboardNavigation);
    setupTouchEvents();
}

function initPages() {
    pages.forEach((page, index) => {
        const isCover = page.getAttribute('data-section') === 'cover';
        
        // 重置所有页面状态
        page.classList.remove('active', 'flipped');
        page.style.transform = isCover ? 'rotateY(0deg)' : 'rotateY(180deg)';
        page.style.zIndex = isCover ? 100 : pages.length - index + 10;
        
        // 初始化part1为活动页
        if (index === 1) { // part1是第一个内容页
            page.classList.add('active');
            page.style.transform = 'rotateY(0deg)';
            page.style.zIndex = 50;
        }
    });
}

// 修改初始化部分
function initCurrentPage() {
    const hash = window.location.hash.substring(1);
    let initialSection = hash || 'part1';
    
    // 如果是初始化且无hash，不修改URL
    if (!hash && isInitializing) {
        initialSection = 'part1';
    } else if (!hash) {
        window.location.hash = '#part1';
        return;
    }

    currentPage = Array.from(pages).findIndex(page => 
        page.getAttribute('data-section') === initialSection
    );
    
    if (currentPage === -1) currentPage = 1;
    
    updateAfterFlip(true); // 新增参数表示初始化
}

// 修改flipPage函数
function flipPage(direction) {
    if (isAnimating) return;
    
    const newPage = direction === 'next' ? currentPage + 1 : currentPage - 1;
    
    // 边界检查
    if (newPage < 0 || newPage >= pages.length) {
        return;
    }
    
    isAnimating = true;
    
    // 处理封面页的特殊逻辑
    const coverPage = document.querySelector('[data-section="cover"]');
    if (currentPage === 0 && direction === 'next' && coverPage) {
        coverPage.classList.add('flipped');
        coverPage.style.zIndex = 1;
    } else if (newPage === 0 && direction === 'prev' && coverPage) {
        coverPage.classList.remove('flipped');
        coverPage.style.zIndex = 100;
    }
    
    // 设置动画类
    pages[currentPage].classList.add('flipping');
    if (direction === 'prev') {
        pages[newPage].classList.remove('flipping');
    }
    
    currentPage = newPage;
    updateAfterFlip();
}


// 修改updateAfterFlip函数
function updateAfterFlip(isInitialLoad = false) {
    const currentPageEl = pages[currentPage];
    const section = currentPageEl.getAttribute('data-section');
    
    // 初始化时不修改历史记录
    if (!isInitialLoad) {
        ignoreHashChange = true;
        history.replaceState(null, null, `#${section}`);
    }
    // 更新所有内容页状态
    pages.forEach((page, index) => {
        if (page === coverPage) return; // 跳过封面页
        
        if (index === currentPage) {
            page.classList.add('active');
            page.style.zIndex = 50;
            page.style.transform = 'rotateY(0deg)';
        } else {
            page.classList.remove('active');
            page.style.zIndex = Math.abs(index - currentPage) + 10;
        }
    });

    // 更新UI
    ignoreHashChange = true;
    updateButtons();
    updatePageIndicator();
    history.replaceState(null, null, `#${section}`);
    
    loadContent(section).then(() => {
        ignoreHashChange = false;
        isAnimating = false;
    });
}


function updateButtons() {
    prevBtn.disabled = currentPage === 0;
    nextBtn.disabled = currentPage === pages.length - 1;
}

function updatePageIndicator() {
    if (pageIndicator) {
        // 封面页不计入页码
        const totalPages = pages.length - 1;
        const currentPageNum = currentPage > 0 ? currentPage : 1;
        pageIndicator.textContent = `${currentPageNum} / ${totalPages}`;
    }
}

// 事件处理
function handleKeyboardNavigation(e) {
    if (e.key === 'ArrowLeft') {
        e.preventDefault(); // 阻止默认行为
        flipPage('prev');
    }
    if (e.key === 'ArrowRight') {
        e.preventDefault(); // 阻止默认行为
        flipPage('next');
    }
}
function setupTouchEvents() {
    let touchStartX = 0;
    book.addEventListener('touchstart', (e) => {
        touchStartX = e.touches[0].clientX;
    }, {passive: true});

    book.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].clientX;
        const diff = touchStartX - touchEndX;
        
        if (Math.abs(diff) > 50) {
            if (diff > 0) flipPage('next');
            else flipPage('prev');
        }
    }, {passive: true});
}

// 辅助功能
function updateActiveNav(section) {
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${section}`);
    });
}

function setupMobileMenu() {
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');
    
    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
}

function setupDarkMode() {
    const darkModeToggle = document.createElement('button');
    darkModeToggle.type = 'button'; // 添加这行
    darkModeToggle.className = 'dark-mode-toggle';
    darkModeToggle.innerHTML = '🌙';
    darkModeToggle.title = '切换夜间模式';
    document.body.appendChild(darkModeToggle);

    darkModeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        darkModeToggle.innerHTML = isDark ? '☀️' : '🌙';
        localStorage.setItem('darkMode', isDark);
    });

    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        darkModeToggle.innerHTML = '☀️';
    }
}

function setupHeartbeatAnimation() {
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const rate = 0.5 + x;
        document.documentElement.style.setProperty('--heart-rate', rate);
    });
}

// 防止滑动返回
let startX, startY;

document.addEventListener('touchstart', function(e) {
    startX = e.touches[0].pageX;
    startY = e.touches[0].pageY;
}, { passive: true });

document.addEventListener('touchmove', function(e) {
    const moveX = e.touches[0].pageX;
    const moveY = e.touches[0].pageY;
    
    // 判断是否为横向滑动
    if (Math.abs(moveX - startX) > Math.abs(moveY - startY)) {
        // 如果是横向滑动，阻止默认行为
        e.preventDefault();
    }
}, { passive: false });

function saveCurrentPage() {
    localStorage.setItem('lastViewedPage', window.location.hash);
}

function loadLastPage() {
    const lastPage = localStorage.getItem('lastViewedPage');
    if (lastPage && sections.includes(lastPage.substring(1))) {
        window.location.hash = lastPage;
    }
}