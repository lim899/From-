/*
 * 个人主页逻辑：
 *   1. 先用 profile.js 里的内容 + 快照立刻渲染，页面永远不空
 *   2. 后台拉 GitHub 资料覆盖上来（带 6 小时本地缓存，避开接口限流）
 *   3. 3D 卡片、首屏视差、滚动淡入 —— 全部在 prefers-reduced-motion 下自动关闭
 *
 * 想改内容请去 assets/profile.js，这里不用动。
 */
(function () {
  'use strict';

  var CFG = window.SITE || {};
  var USER = CFG.githubUser || '';
  var CACHE_KEY = 'site:gh:v1';
  var CACHE_TTL = 6 * 60 * 60 * 1000;   // 6 小时
  var MAX_TILT = 8;                     // 卡片倾斜角度上限（度）
  var MAX_SHIFT = 10;                   // 首屏视差位移上限（px）

  var reduceMotion = mq('(prefers-reduced-motion: reduce)');
  var coarse = mq('(hover: none)');

  function mq(q) {
    return !!(window.matchMedia && window.matchMedia(q).matches);
  }

  function $(id) { return document.getElementById(id); }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ------------------------------------------------------------------ 数据 */

  // 页面当前用的数据。GitHub 拉到新的就往上盖。
  var view = {
    name: CFG.name || USER,
    tagline: CFG.tagline || '',
    avatar: (CFG.fallback && CFG.fallback.avatar) || '',
    repos: normalizeRepos((CFG.fallback && CFG.fallback.repos) || [])
  };

  function repoUrl(name) {
    var over = CFG.linkOverrides || {};
    if (over[name]) return over[name];
    return 'https://github.com/' + USER + '/' + name;
  }

  function normalizeRepos(list) {
    var hide = (CFG.hideRepos || []).map(function (s) { return String(s).toLowerCase(); });

    return list
      .filter(function (r) {
        return r && r.name && hide.indexOf(String(r.name).toLowerCase()) === -1;
      })
      .map(function (r) {
        return {
          name: r.name,
          desc: r.desc || r.description || '',
          lang: r.lang || r.language || '',
          stars: r.stars || r.stargazers_count || 0,
          updated: r.updated || r.pushed_at || '',
          url: repoUrl(r.name),
          internal: !/^https?:/i.test(repoUrl(r.name))
        };
      })
      .sort(function (a, b) {
        if (b.stars !== a.stars) return b.stars - a.stars;
        return String(b.updated).localeCompare(String(a.updated));
      })
      .slice(0, CFG.maxRepos || 6);
  }

  /* -------------------------------------------------------------- 渲染 */

  function renderAll() {
    document.title = view.name + (CFG.role ? ' · ' + CFG.role : '');
    var d = document.querySelector('meta[name="description"]');
    if (d && view.tagline) d.setAttribute('content', view.name + ' —— ' + view.tagline);

    bind('name', view.name);
    bind('issue', CFG.issue || 'ISSUE 01');
    bind('year', String(new Date().getFullYear()));
    bind('handle', USER ? '@' + USER : '');

    all('[data-bind="github"]').forEach(function (el) {
      el.href = 'https://github.com/' + USER;
    });

    renderName();
    renderTagline();
    renderMeta();
    renderHeroLinks();
    renderAvatar();
    renderCards();
    renderFooter();
    setFavicon(view.name);
  }

  function bind(key, value) {
    all('[data-bind="' + key + '"]').forEach(function (el) { el.textContent = value; });
  }

  // 姓名逐字入场。reduced-motion 下直接给纯文本，不做动画。
  // 记住上次渲染的值：GitHub 数据回来后如果名字没变，就别把入场动画重放一遍。
  var lastName = null;

  function renderName() {
    var el = $('hero-name');
    if (!el || view.name === lastName) return;
    lastName = view.name;

    if (reduceMotion) { el.textContent = view.name; return; }

    var chars = Array.from(String(view.name));
    el.textContent = '';
    chars.forEach(function (ch, i) {
      var span = document.createElement('span');
      if (ch === ' ') {
        span.className = 'ch-space';
        span.innerHTML = '&nbsp;';
      } else {
        span.className = 'ch';
        span.textContent = ch;
        span.style.animationDelay = (0.12 + i * 0.045).toFixed(3) + 's';
      }
      el.appendChild(span);
    });
  }

  function renderTagline() {
    var el = $('hero-tagline');
    if (el) el.textContent = view.tagline;
  }

  function renderMeta() {
    var el = $('hero-meta');
    if (!el) return;

    var rows = [];
    if (CFG.role) rows.push(['身份', esc(CFG.role)]);
    if (CFG.location) rows.push(['所在', esc(CFG.location)]);
    if (USER) {
      rows.push(['GitHub',
        '<a href="https://github.com/' + esc(USER) + '" rel="noreferrer noopener">@' + esc(USER) + '</a>']);
    }
    if (CFG.email) {
      rows.push(['邮箱', '<a href="mailto:' + esc(CFG.email) + '">' + esc(CFG.email) + '</a>']);
    }

    el.innerHTML = rows.map(function (r) {
      return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>';
    }).join('');
  }

  // 首屏行动按钮：一个主按钮进作品区，后面跟着 profile.js 里配的链接
  function renderHeroLinks() {
    var el = $('hero-links');
    if (!el) return;

    var html = '<a class="btn btn-solid" href="#work">看看作品 <span aria-hidden="true">&darr;</span></a>';

    (CFG.links || []).forEach(function (l) {
      html += '<a class="btn" href="' + esc(l.url) + '" target="_blank" rel="noreferrer noopener">'
        + esc(l.label) + '</a>';
    });
    if (CFG.email) {
      html += '<a class="btn" href="mailto:' + esc(CFG.email) + '">写封邮件</a>';
    }

    el.innerHTML = html;
  }

  function renderAvatar() {
    var img = $('avatar');
    if (!img) return;
    img.alt = view.name + ' 的头像';
    if (view.avatar && img.src !== view.avatar) img.src = view.avatar;
  }

  function renderCards() {
    var box = $('cards');
    if (!box) return;

    box.innerHTML = view.repos.map(function (r, i) {
      var num = ('0' + (i + 1)).slice(-2);
      var badge = r.internal ? '<span class="card-badge">站内可玩</span>' : '';
      var lang = r.lang
        ? '<span class="card-lang"><i class="dot" style="background:' + langColor(r.lang) + '"></i>'
          + esc(r.lang) + '</span>'
        : '';
      var stars = r.stars > 0 ? '<span>★ ' + r.stars + '</span>' : '';
      var when = r.updated ? '<span>' + esc(monthOf(r.updated)) + '</span>' : '';
      var ext = r.internal ? '' : ' target="_blank" rel="noreferrer noopener"';

      return '<a class="card" href="' + esc(r.url) + '"' + ext + '>'
        + '<span class="card-index">' + num + '</span>'
        + '<h3 class="card-title">' + esc(r.name) + '</h3>'
        + '<p class="card-desc">' + (esc(r.desc) || '暂无描述') + '</p>'
        + '<span class="card-foot">' + lang + stars + when + badge
        + '<span class="card-arrow" aria-hidden="true">&rarr;</span></span>'
        + '</a>';
    }).join('');

    var note = $('work-note');
    if (note && USER) {
      note.innerHTML = '项目卡片由 GitHub 资料自动生成 · '
        + '<a href="https://github.com/' + esc(USER) + '?tab=repositories" '
        + 'target="_blank" rel="noreferrer noopener">在 GitHub 上看全部 &rarr;</a>';
    }

    if (!reduceMotion && !coarse) all('.card').forEach(initTilt);
  }

  function renderFooter() {
    var el = $('foot-links');
    if (!el) return;

    var links = (CFG.links || []).slice();
    if (CFG.email) links.push({ label: 'Email', url: 'mailto:' + CFG.email });
    links.push({ label: '金句收藏夹', url: './quotes/' });

    el.innerHTML = links.map(function (l) {
      var ext = /^https?:/i.test(l.url) ? ' target="_blank" rel="noreferrer noopener"' : '';
      return '<a href="' + esc(l.url) + '"' + ext + '>' + esc(l.label) + '</a>';
    }).join('');
  }

  // 用姓名首字生成 favicon，省掉一个二进制文件
  function setFavicon(name) {
    var link = $('favicon');
    var ch = Array.from(String(name || '').trim())[0];
    if (!link || !ch) return;

    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'>"
      + "<rect width='32' height='32' rx='7' fill='#16150f'/>"
      + "<text x='16' y='22.5' font-family='Georgia,serif' font-size='19' "
      + "fill='#e8b04b' text-anchor='middle'>" + esc(ch) + "</text></svg>";

    link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
  }

  function monthOf(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + ' 年 ' + (d.getMonth() + 1) + ' 月';
  }

  // 常见语言的官方色；没收录的按名字散列出一个稳定色相
  var LANG_COLORS = {
    javascript: '#f1e05a', typescript: '#3178c6', python: '#3572a5', go: '#00add8',
    rust: '#dea584', java: '#b07219', 'c++': '#f34b7d', c: '#555555', 'c#': '#178600',
    html: '#e34c26', css: '#563d7c', shell: '#89e051', ruby: '#701516', php: '#4f5d95',
    swift: '#f05138', kotlin: '#a97bff', dart: '#00b4ab', vue: '#41b883', lua: '#000080'
  };

  function langColor(lang) {
    var key = String(lang).toLowerCase();
    if (LANG_COLORS[key]) return LANG_COLORS[key];
    var h = 0;
    for (var i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 360;
    return 'hsl(' + h + ' 55% 55%)';
  }

  /* -------------------------------------------------- GitHub 数据获取 */

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var box = JSON.parse(raw);
      if (!box || box.user !== USER) return null;
      if (Date.now() - box.at > CACHE_TTL) return null;
      return box.data;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), user: USER, data: data }));
    } catch (e) { /* 隐私模式下写不进去，无所谓 */ }
  }

  function applyRemote(data) {
    if (!data) return;
    // 只在 GitHub 那边真有值时才覆盖手填内容，别把用户写的名字冲成空
    if (data.name) view.name = data.name;
    if (data.bio) view.tagline = data.bio;
    if (data.avatar) view.avatar = data.avatar;
    if (data.repos && data.repos.length) view.repos = normalizeRepos(data.repos);
    renderAll();
  }

  function loadGitHub() {
    if (!USER || !window.fetch) return;

    var cached = readCache();
    if (cached) { applyRemote(cached); return; }

    var api = 'https://api.github.com/users/' + encodeURIComponent(USER);
    var opts = { headers: { Accept: 'application/vnd.github+json' } };

    Promise.all([
      fetch(api, opts).then(okJson),
      fetch(api + '/repos?sort=updated&per_page=100', opts).then(okJson)
    ]).then(function (res) {
      var profile = res[0] || {};
      var repos = (res[1] || []).filter(function (r) {
        return !r.fork && !r.archived && !r.private;
      });

      var data = {
        name: profile.name || '',
        bio: profile.bio || '',
        avatar: profile.avatar_url || '',
        repos: repos.map(function (r) {
          return {
            name: r.name,
            desc: r.description || '',
            lang: r.language || '',
            stars: r.stargazers_count || 0,
            updated: r.pushed_at || r.updated_at || ''
          };
        })
      };

      writeCache(data);
      applyRemote(data);
    }).catch(function () {
      // 离线、限流（每小时 60 次）、403 —— 都不管，页面上还是快照内容
    });
  }

  function okJson(res) {
    if (!res.ok) throw new Error(res.status);
    return res.json();
  }

  /* -------------------------------------------------------------- 动效 */

  // 卡片 3D 倾斜 + 跟随指针的光泽
  function initTilt(card) {
    var raf = 0, rx = 0, ry = 0, mx = 50, my = 50;

    function apply() {
      raf = 0;
      card.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      card.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      card.style.setProperty('--mx', mx.toFixed(1) + '%');
      card.style.setProperty('--my', my.toFixed(1) + '%');
    }

    card.addEventListener('pointerenter', function () {
      card.classList.add('tilting');   // 跟手期间去掉回弹过渡
    });

    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      if (!r.width || !r.height) return;
      var px = (e.clientX - r.left) / r.width;
      var py = (e.clientY - r.top) / r.height;
      mx = px * 100;
      my = py * 100;
      ry = (px - 0.5) * 2 * MAX_TILT;
      rx = -(py - 0.5) * 2 * MAX_TILT;
      if (!raf) raf = requestAnimationFrame(apply);
    });

    card.addEventListener('pointerleave', function () {
      card.classList.remove('tilting');
      rx = ry = 0; mx = my = 50;
      if (!raf) raf = requestAnimationFrame(apply);
    });
  }

  // 首屏轻微视差：元素按 data-parallax 的系数反向偏移，上限 ±MAX_SHIFT
  function initParallax() {
    if (reduceMotion || coarse) return;

    var items = all('[data-parallax]');
    if (!items.length) return;

    var raf = 0, nx = 0, ny = 0;

    function apply() {
      raf = 0;
      items.forEach(function (el) {
        var k = parseFloat(el.getAttribute('data-parallax')) || 0;
        var f = Math.max(-1, Math.min(1, k / MAX_SHIFT));
        el.style.transform =
          'translate3d(' + (nx * MAX_SHIFT * f).toFixed(2) + 'px,'
          + (ny * MAX_SHIFT * f).toFixed(2) + 'px,0)';
      });
    }

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      nx = (e.clientX / window.innerWidth - 0.5) * 2;
      ny = (e.clientY / window.innerHeight - 0.5) * 2;
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
  }

  // 滚动淡入
  function initReveal() {
    var items = all('.reveal');

    if (reduceMotion || !window.IntersectionObserver) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    items.forEach(function (el) { io.observe(el); });

    // 兜底：视口尺寸变化等边界情况下 observer 偶尔会漏掉一个板块，
    // 那个板块就永远停在 opacity:0 —— 比没有动画糟得多。
    // 三秒后把「已经在视口里却还没亮」的补上，屏幕外的仍然留给滚动触发。
    setTimeout(function () {
      items.forEach(function (el) {
        if (el.classList.contains('in')) return;
        if (el.getBoundingClientRect().top < window.innerHeight) {
          el.classList.add('in');
          io.unobserve(el);
        }
      });
    }, 3000);
  }

  /* --------------------------------------------------------------- 启动 */

  renderAll();
  initParallax();
  initReveal();
  loadGitHub();
})();
