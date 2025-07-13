// 全局变量定义
const sections = ['part1', 'part2', 'part3', 'part4', 'part5', 'part6', 'part7', 'part8', 'part9', 'part10', 'part11', 'part12',  'part13', 'part14', 'part15', 'part16', 'part17', 'part18',  'part19', 'part20', 'part21', 'part22'];

// 缓存和DOM引用
const contentCache = {};
let book, pages, prevBtn, nextBtn, pageIndicator;
let currentPage = 0;
let isAnimating = false;
let ignoreHashChange = false; // 新增标志位

document.addEventListener('DOMContentLoaded', function() {
    // 初始化元素引用
    book = document.querySelector('.flip-book');
    if (book) {
        pages = document.querySelectorAll('.flip-page');
        prevBtn = document.querySelector('.prev-page');
        nextBtn = document.querySelector('.next-page');
        pageIndicator = document.querySelector('.page-indicator');
        
        initFlipBook();
    }

    // 初始化加载
    if (!window.location.hash) {
        window.location.hash = '#part1';
    } else {
        loadContent();
    }
    
    // 修改hashchange事件监听
    window.addEventListener('hashchange', () => {
        if (ignoreHashChange) return;
    
        const section = window.location.hash.substring(1);
        if (!sections.includes(section)) return;
    
        const newPage = Array.from(pages).findIndex(page => 
        page.getAttribute('data-section') === section
        );
    
        if (newPage !== -1 && newPage !== currentPage) {
            currentPage = newPage;
            updateButtons();
            updatePageIndicator();
        
            // 重置页面状态
            pages.forEach((page, index) => {
                if (index < currentPage) {
                    page.classList.remove('flipping');
                } else if (index > currentPage) {
                    page.classList.add('flipping');
                }
            });
        
            // 强制加载内容
            loadContent(section);
        }
    });
});

// 核心功能函数
// 修改loadContent函数，确保强制加载
// 修改loadContent函数
async function loadContent(sectionId) {
    // 1. 确定要加载的章节
    let section = sectionId || window.location.hash.substring(1);
    
    // 2. 处理无效章节的情况
    if (!section) {
        console.warn('未指定章节，默认加载 part1');
        section = 'part1';
        window.location.hash = '#part1';
    }

    // 3. 检查是否为有效章节
    if (!sections.includes(section)) {
        console.warn(`无效章节: ${section}，已跳过`);
        return false;
    }

    // 4. 查找目标容器
    const pageElement = document.querySelector(`.flip-page[data-section="${section}"]`);
    if (!pageElement) {
        console.error(`未找到章节容器: ${section}`);
        return false;
    }

    const pageContent = pageElement.querySelector('.page-content');
    if (!pageContent) {
        console.error(`章节容器中缺少内容区域: ${section}`);
        return false;
    }

    try {
        // 5. 显示加载状态
        pageContent.innerHTML = '<div class="loading-spinner">加载中...</div>';

        // 6. 获取内容（强制绕过缓存）
        const response = await fetch(`./chapters/${section}.html?t=${Date.now()}`, {
            cache: 'no-store'
        });

        // 7. 处理响应
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`章节文件不存在: ${section}.html`);
                showErrorState(section, '本章节内容暂未开放');
            } else {
                throw new Error(`HTTP错误! 状态码: ${response.status}`);
            }
            return false;
        }

        const html = await response.text();
        
        // 8. 空内容检查
        if (!html.trim()) {
            console.warn(`章节内容为空: ${section}`);
            showErrorState(section, '本章节内容为空');
            return false;
        }

        // 9. 更新DOM
        pageContent.innerHTML = html;
        updateActiveNav(section);
        
        // 10. 预加载相邻章节
        preloadAdjacentChapters(section);
        
        return true;
    } catch (error) {
        console.error(`加载 ${section} 失败:`, error);
        showErrorState(section, '加载内容失败，请稍后再试');
        return false;
    }
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
    const initialSection = hash || 'part1';
    
    currentPage = Array.from(pages).findIndex(page => 
        page.getAttribute('data-section') === initialSection
    );
    
    if (currentPage === -1) currentPage = 1; // 默认从part1开始
    
    // 初始化页面状态
    pages.forEach((page, index) => {
        if (index < currentPage && index > 0) { // 跳过封面页
            page.classList.remove('flipping');
            page.style.transform = 'rotateY(0deg)';
        } else if (index > currentPage) {
            page.classList.add('flipping');
            page.style.transform = 'rotateY(180deg)';
        }
    });
    
    // 加载当前页内容
    loadContent(initialSection).then(() => {
        updateButtons();
        updatePageIndicator();
        // 预加载所有其他章节
        sections.forEach(section => {
            if (section !== initialSection) {
                preloadChapter(section);
            }
        });
    });
}

// 修改flipPage函数
function flipPage(direction) {
    if (isAnimating) return;
    isAnimating = true;
    
    const coverPage = document.querySelector('[data-section="cover"]');
    const currentPageEl = pages[currentPage];
    
    if (direction === 'next' && currentPage < pages.length - 1) {
        // 处理从封面到part1的特殊过渡
        if (currentPage === 0 && coverPage) {
            coverPage.classList.add('flipped');
            coverPage.style.zIndex = 1;
        }
        
        currentPageEl.classList.add('flipping');
        currentPage++;
    } else if (direction === 'prev' && currentPage > 0) {
        currentPage--;
        const prevPage = pages[currentPage];
        
        // 处理回到封面的情况
        if (currentPage === 0 && coverPage) {
            coverPage.classList.remove('flipped');
            coverPage.style.zIndex = 100;
        } else {
            prevPage.classList.remove('flipping');
        }
    } else {
        isAnimating = false;
        return;
    }
    
    updateAfterFlip();
}


// 修改updateAfterFlip函数
function updateAfterFlip() {
    const currentPageEl = pages[currentPage];
    const section = currentPageEl.getAttribute('data-section');
    const coverPage = document.querySelector('[data-section="cover"]');
    
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

// 检测屏幕方向
function checkOrientation() {
  if (window.innerHeight > window.innerWidth) {
    // 竖屏状态
    alert("请将设备旋转至横屏模式");
    // 或者显示一个全屏提示
    document.querySelector('.rotate-message').style.display = 'flex';
    document.querySelector('.content').style.display = 'none';
  } else {
    // 横屏状态
    document.querySelector('.rotate-message').style.display = 'none';
    document.querySelector('.content').style.display = 'block';
  }
}

// 初始检查和窗口大小变化时检查
window.addEventListener('load', checkOrientation);
window.addEventListener('resize', checkOrientation);

