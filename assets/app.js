/* 金句收藏夹 —— 纯前端，数据只存在本机浏览器里 */
(function () {
  'use strict';

  var QUOTES_KEY = 'jinju:quotes:v1';
  var PREFS_KEY = 'jinju:prefs:v1';
  var URL_RE = /(https?:\/\/[^\s，。、；）)】"']+)/;

  var quotes = [];
  var prefs = { autoSave: true };
  var filter = { q: '', tag: '', starOnly: false };
  var editingId = null;
  var toastTimer = null;

  var $ = function (id) { return document.getElementById(id); };

  /* ---------------- 存储 ---------------- */

  function load() {
    try {
      var raw = JSON.parse(localStorage.getItem(QUOTES_KEY) || '[]');
      quotes = Array.isArray(raw) ? raw.filter(function (q) { return q && q.text; }).map(clean) : [];
    } catch (e) {
      quotes = [];
    }
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      if (typeof p.autoSave === 'boolean') prefs.autoSave = p.autoSave;
    } catch (e) { /* 用默认值 */ }
  }

  function save() {
    try {
      localStorage.setItem(QUOTES_KEY, JSON.stringify(quotes));
    } catch (e) {
      toast('保存失败，浏览器存储可能已满');
    }
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* 忽略 */ }
  }

  function clean(q) {
    return {
      id: q.id || uid(),
      text: String(q.text || '').trim(),
      source: String(q.source || '').trim(),
      author: String(q.author || '').trim(),
      url: String(q.url || '').trim(),
      note: String(q.note || '').trim(),
      tags: Array.isArray(q.tags) ? q.tags.map(String).filter(Boolean) : parseTags(q.tags),
      star: !!q.star,
      createdAt: q.createdAt || new Date().toISOString()
    };
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function parseTags(s) {
    return String(s || '').split(/[,，、\s]+/).map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function norm(text) {
    return String(text || '').replace(/\s+/g, '').toLowerCase();
  }

  function findSame(text) {
    var n = norm(text);
    for (var i = 0; i < quotes.length; i++) {
      if (norm(quotes[i].text) === n) return quotes[i];
    }
    return null;
  }

  /* ---------------- 渲染 ---------------- */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    var now = new Date();
    var sameYear = d.getFullYear() === now.getFullYear();
    return (sameYear ? '' : d.getFullYear() + '年') + (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }

  function matches(q) {
    if (filter.starOnly && !q.star) return false;
    if (filter.tag && q.tags.indexOf(filter.tag) === -1) return false;
    if (!filter.q) return true;
    var hay = [q.text, q.source, q.author, q.note, q.tags.join(' ')].join(' ').toLowerCase();
    return filter.q.toLowerCase().split(/\s+/).filter(Boolean).every(function (word) {
      return hay.indexOf(word) !== -1;
    });
  }

  function sorted() {
    return quotes.slice().sort(function (a, b) {
      return String(b.createdAt).localeCompare(String(a.createdAt));
    });
  }

  function render() {
    renderTagbar();

    var list = $('list');
    var shown = sorted().filter(matches);
    list.innerHTML = '';

    if (!shown.length) {
      list.innerHTML = quotes.length
        ? '<div class="empty">没有匹配的句子</div>'
        : '<div class="empty"><strong>还没有金句</strong>点右下角的 ＋ 手动添加；'
          + '在手机上把这个页面「添加到主屏幕」后，读到好句子直接从分享菜单发过来就行。</div>';
    } else {
      shown.forEach(function (q) { list.appendChild(cardOf(q)); });
    }

    var total = quotes.length;
    $('count').textContent = total
      ? (shown.length === total ? '共 ' + total + ' 句' : '筛出 ' + shown.length + ' / ' + total + ' 句')
      : '';
  }

  function cardOf(q) {
    var el = document.createElement('article');
    el.className = 'card';
    el.dataset.id = q.id;

    var meta = [];
    if (q.author) meta.push(esc(q.author));
    if (q.source) meta.push('《' + esc(q.source) + '》');
    meta.push(fmtDate(q.createdAt));
    if (q.url) meta.push('<a href="' + esc(q.url) + '" target="_blank" rel="noreferrer noopener">原文</a>');

    var html = '<p class="card-text">' + esc(q.text) + '</p>'
      + '<p class="card-meta">' + meta.filter(Boolean).join(' · ') + '</p>';

    if (q.note) html += '<p class="card-note">' + esc(q.note) + '</p>';

    if (q.tags.length) {
      html += '<div class="card-tags">' + q.tags.map(function (t) {
        return '<button class="tag" type="button" data-act="tag" data-tag="' + esc(t) + '">#' + esc(t) + '</button>';
      }).join('') + '</div>';
    }

    html += '<div class="card-bar">'
      + '<button class="card-btn' + (q.star ? ' is-star' : '') + '" type="button" data-act="star">'
      + (q.star ? '★ 已星标' : '☆ 星标') + '</button>'
      + '<button class="card-btn" type="button" data-act="copy">复制</button>'
      + (navigator.share ? '<button class="card-btn" type="button" data-act="share">分享</button>' : '')
      + '<button class="card-btn" type="button" data-act="edit">编辑</button>'
      + '</div>';

    el.innerHTML = html;
    return el;
  }

  function renderTagbar() {
    var counts = {};
    quotes.forEach(function (q) {
      q.tags.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; });
    });
    var tags = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); });

    var bar = $('tagbar');
    bar.hidden = !tags.length;
    bar.innerHTML = tags.map(function (t) {
      return '<button class="chip' + (filter.tag === t ? ' is-on' : '') + '" type="button" data-tag="'
        + esc(t) + '">#' + esc(t) + ' ' + counts[t] + '</button>';
    }).join('');
  }

  function flash(id) {
    var el = document.querySelector('.card[data-id="' + id + '"]');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.animate(
      [{ boxShadow: '0 0 0 3px var(--gold)' }, { boxShadow: '0 0 0 0 transparent' }],
      { duration: 1400, easing: 'ease-out' }
    );
  }

  /* ---------------- 提示条 ---------------- */

  function toast(text, actionLabel, onAction) {
    var box = $('toast');
    var btn = $('toast-action');
    $('toast-text').textContent = text;

    btn.hidden = !actionLabel;
    if (actionLabel) {
      btn.textContent = actionLabel;
      btn.onclick = function () { hideToast(); onAction(); };
    }

    box.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, actionLabel ? 6000 : 2600);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    $('toast').hidden = true;
  }

  /* ---------------- 编辑抽屉 ---------------- */

  function openSheet(quote) {
    editingId = quote && quote.id ? quote.id : null;
    var q = quote || {};

    $('sheet-title').textContent = editingId ? '编辑金句' : '添加金句';
    $('f-text').value = q.text || '';
    $('f-source').value = q.source || '';
    $('f-author').value = q.author || '';
    $('f-tags').value = (q.tags || []).join(', ');
    $('f-url').value = q.url || '';
    $('f-note').value = q.note || '';
    $('btn-delete').hidden = !editingId;

    $('sheet').hidden = false;
    if (!q.text) setTimeout(function () { $('f-text').focus(); }, 60);
  }

  function closeSheet() {
    $('sheet').hidden = true;
    editingId = null;
  }

  function submitSheet(e) {
    e.preventDefault();
    var text = $('f-text').value.trim();
    if (!text) return;

    var data = {
      text: text,
      source: $('f-source').value.trim(),
      author: $('f-author').value.trim(),
      tags: parseTags($('f-tags').value),
      url: $('f-url').value.trim(),
      note: $('f-note').value.trim()
    };

    if (editingId) {
      var q = byId(editingId);
      if (q) {
        Object.keys(data).forEach(function (k) { q[k] = data[k]; });
      }
    } else {
      var dup = findSame(text);
      if (dup) {
        closeSheet();
        save();
        render();
        toast('这句已经收过了');
        flash(dup.id);
        return;
      }
      quotes.push(clean(data));
    }

    save();
    closeSheet();
    render();
    toast(editingId ? '已更新' : '已收藏');
  }

  function byId(id) {
    for (var i = 0; i < quotes.length; i++) {
      if (quotes[i].id === id) return quotes[i];
    }
    return null;
  }

  function removeById(id) {
    quotes = quotes.filter(function (q) { return q.id !== id; });
  }

  /* ---------------- 一键添加 ---------------- */

  function readParams() {
    var p = new URLSearchParams(location.search);
    var get = function () {
      for (var i = 0; i < arguments.length; i++) {
        var v = p.get(arguments[i]);
        if (v && v.trim()) return v.trim();
      }
      return '';
    };

    var text = get('q', 'quote', 'text', 'selection');
    var title = get('title');
    var url = get('url', 'link');

    // Android 分享常把链接拼在正文里，拆出来放到「链接」字段
    if (!url) {
      var m = text.match(URL_RE);
      if (m) {
        url = m[1];
        text = text.replace(m[1], '').trim();
      }
    }
    if (!text && title) { text = title; title = ''; }
    if (!text) return null;

    return {
      text: text.replace(/^["'“”「『]+|["'“”「』」]+$/g, '').trim(),
      source: get('src', 'source') || (title && norm(title) !== norm(text) ? title : ''),
      author: get('author', 'by'),
      tags: parseTags(get('tags', 'tag')),
      url: url,
      note: get('note'),
      auto: get('auto')
    };
  }

  function scrubUrl() {
    if (location.search && history.replaceState) {
      history.replaceState(null, '', location.pathname);
    }
  }

  function handleQuickAdd() {
    var incoming = readParams();
    if (!incoming) return;
    scrubUrl();

    var wantsAuto = incoming.auto
      ? !/^(0|false|no)$/i.test(incoming.auto)
      : prefs.autoSave;
    delete incoming.auto;

    var dup = findSame(incoming.text);
    if (dup) {
      render();
      toast('这句已经收过了');
      flash(dup.id);
      return;
    }

    if (!wantsAuto) {
      openSheet(incoming);
      return;
    }

    var q = clean(incoming);
    quotes.push(q);
    save();
    render();
    flash(q.id);
    toast('已收藏', '撤销', function () {
      removeById(q.id);
      save();
      render();
      toast('已撤销');
    });
  }

  /* ---------------- 导入导出 ---------------- */

  function download(name, text, type) {
    var blob = new Blob([text], { type: type + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function stamp() {
    return new Date().toISOString().slice(0, 10);
  }

  function toMarkdown() {
    return '# 金句收藏夹\n\n' + sorted().map(function (q) {
      var out = '> ' + q.text.replace(/\n/g, '\n> ') + '\n>\n> —— ';
      out += [q.author, q.source && '《' + q.source + '》'].filter(Boolean).join('，') || '佚名';
      if (q.url) out += ' ' + q.url;
      if (q.note) out += '\n\n' + q.note;
      if (q.tags.length) out += '\n\n' + q.tags.map(function (t) { return '#' + t; }).join(' ');
      return out + '\n\n' + fmtDate(q.createdAt);
    }).join('\n\n---\n\n') + '\n';
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (e) {
        toast('文件不是有效的 JSON');
        return;
      }
      var incoming = Array.isArray(parsed) ? parsed : parsed && parsed.quotes;
      if (!Array.isArray(incoming)) {
        toast('文件里没有找到句子');
        return;
      }
      var added = 0;
      incoming.forEach(function (raw) {
        if (!raw || !raw.text || findSame(raw.text)) return;
        quotes.push(clean(raw));
        added++;
      });
      save();
      render();
      toast(added ? '导入了 ' + added + ' 句' : '没有新句子');
    };
    reader.readAsText(file);
  }

  function copyText(text, okMsg) {
    var done = function () { toast(okMsg || '已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else {
      fallback();
    }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请长按选择'); }
      document.body.removeChild(ta);
    }
  }

  function quoteAsText(q) {
    var tail = [q.author, q.source && '《' + q.source + '》'].filter(Boolean).join('，');
    return q.text + (tail ? '\n—— ' + tail : '');
  }

  /* ---------------- 设置 ---------------- */

  function baseUrl() {
    return location.origin + location.pathname;
  }

  function bookmarkletCode() {
    return "javascript:(function(){var t=(''+(window.getSelection()||'')).trim()"
      + "||prompt('要收藏的句子');if(!t)return;window.open('" + baseUrl()
      + "?text='+encodeURIComponent(t)+'&url='+encodeURIComponent(location.href)"
      + "+'&title='+encodeURIComponent(document.title),'_blank');})()";
  }

  function openSettings() {
    $('opt-autosave').checked = prefs.autoSave;
    $('bookmarklet').value = bookmarkletCode();
    $('quickurl').textContent = baseUrl() + '?text=要收藏的句子';
    $('settings').hidden = false;
  }

  /* ---------------- 事件绑定 ---------------- */

  function bind() {
    $('btn-add').addEventListener('click', function () { openSheet(null); });
    $('btn-cancel').addEventListener('click', closeSheet);
    $('form').addEventListener('submit', submitSheet);

    $('btn-delete').addEventListener('click', function () {
      if (!editingId || !confirm('删除这一句？')) return;
      removeById(editingId);
      save();
      closeSheet();
      render();
      toast('已删除');
    });

    // 点遮罩关闭
    ['sheet', 'settings'].forEach(function (id) {
      $(id).addEventListener('click', function (e) {
        if (e.target === this) this.hidden = true;
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      $('sheet').hidden = true;
      $('settings').hidden = true;
    });

    $('search').addEventListener('input', function () {
      filter.q = this.value.trim();
      render();
    });

    $('btn-only-star').addEventListener('click', function () {
      filter.starOnly = !filter.starOnly;
      this.setAttribute('aria-pressed', String(filter.starOnly));
      render();
    });

    $('tagbar').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-tag]');
      if (!btn) return;
      filter.tag = filter.tag === btn.dataset.tag ? '' : btn.dataset.tag;
      render();
    });

    $('list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var card = e.target.closest('.card');
      var q = card && byId(card.dataset.id);
      if (!q) return;

      var act = btn.dataset.act;
      if (act === 'star') {
        q.star = !q.star;
        save();
        render();
      } else if (act === 'copy') {
        copyText(quoteAsText(q));
      } else if (act === 'share' && navigator.share) {
        navigator.share({ text: quoteAsText(q), url: q.url || undefined }).catch(function () { /* 用户取消 */ });
      } else if (act === 'edit') {
        openSheet(q);
      } else if (act === 'tag') {
        filter.tag = filter.tag === btn.dataset.tag ? '' : btn.dataset.tag;
        render();
      }
    });

    $('btn-settings').addEventListener('click', openSettings);
    $('btn-close-settings').addEventListener('click', function () { $('settings').hidden = true; });

    $('opt-autosave').addEventListener('change', function () {
      prefs.autoSave = this.checked;
      savePrefs();
    });

    $('btn-copy-bm').addEventListener('click', function () { copyText(bookmarkletCode()); });

    $('btn-export-json').addEventListener('click', function () {
      download('金句收藏夹-' + stamp() + '.json',
        JSON.stringify({ app: 'jinju', version: 1, exportedAt: new Date().toISOString(), quotes: sorted() }, null, 2),
        'application/json');
    });

    $('btn-export-md').addEventListener('click', function () {
      download('金句收藏夹-' + stamp() + '.md', toMarkdown(), 'text/markdown');
    });

    $('btn-import').addEventListener('click', function () { $('file-import').click(); });

    $('file-import').addEventListener('change', function () {
      if (this.files && this.files[0]) importFile(this.files[0]);
      this.value = '';
    });

    $('toast').addEventListener('click', function (e) {
      if (e.target.id !== 'toast-action') hideToast();
    });
  }

  /* ---------------- 启动 ---------------- */

  load();
  bind();
  render();
  handleQuickAdd();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function () { /* 离线能力可有可无 */ });
    });
  }
})();
