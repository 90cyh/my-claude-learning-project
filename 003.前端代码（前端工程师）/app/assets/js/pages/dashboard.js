/* ============================================================
   简记 · 首页动态化（PRD 6.2 / 5.4 统计口径）
   数据来源：GET /api/home/summary（按当前登录用户实时计算）
   预算设置：POST /api/budget
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmt(n) {
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }
  /* 日期 → 「今天 / 昨天 / M月D日」 */
  function dateLabel(ds) {
    var pad = function (n) { return String(n).padStart(2, '0'); };
    var d = new Date();
    var today = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    var yday = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate() - 1);
    if (ds === today) return '今天';
    if (ds === yday) return '昨天';
    return (+ds.slice(5, 7)) + '月' + (+ds.slice(8, 10)) + '日';
  }

  /* 移动端悬浮「快速记账」→ 前往明细页 */
  var fab = document.getElementById('mobileFloatRecordBtn');
  if (fab) fab.addEventListener('click', function () { location.href = 'transactions.html'; });

  /* ---------- ① 顶栏：实时日期 + 问候（每分钟刷新） ---------- */
  function renderGreeting() {
    var d = new Date();
    var week = '日一二三四五六'[d.getDay()];
    var h = d.getHours();
    var greet = h < 11 ? '早上好' : h < 18 ? '下午好' : '晚上好';
    setText('greeting-line', (d.getMonth() + 1) + '月' + d.getDate() + '日 周' + week + ' · ' + greet + ' 🌸');
  }
  renderGreeting();
  setInterval(renderGreeting, 60 * 1000);

  /* ---------- ② 预算：四档状态色（PRD 6.3.3） ---------- */
  function tierInfo(pct) {
    if (pct > 100) return { cls: 'text-status-danger',  label: '超支 ' + (pct - 100).toFixed(0) + '%', bar: 'bg-status-danger' };
    if (pct >= 90) return { cls: 'text-status-warning', label: pct.toFixed(0) + '% 预警', bar: 'bg-status-warning' };
    if (pct >= 61) return { cls: 'text-status-caution', label: pct.toFixed(0) + '% 注意', bar: 'bg-status-caution' };
    return { cls: 'text-status-safe',   label: pct.toFixed(0) + '% 安全', bar: 'bg-status-safe' };
  }

  /* 点击「总预算使用」区域 → 设置/修改本月总预算 */
  function bindBudgetEditor() {
    var wrap = document.getElementById('budget-status-wrap');
    if (!wrap) return;
    wrap.style.cursor = 'pointer';
    wrap.title = '点击设置本月总预算';
    wrap.addEventListener('click', function () {
      var input = window.prompt('请输入本月总预算金额（元）', '');
      if (input === null) return;
      var v = parseFloat(input);
      if (!(v > 0) || v > 99999999.99) { window.alert('请输入大于 0 的金额'); return; }
      fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: v })
      }).then(function (r) {
        if (!r.ok) throw new Error();
        load();
      }).catch(function () { window.alert('保存失败，请稍后再试'); });
    });
  }

  /* ---------- ③ 汇总渲染 ---------- */
  function renderSummary(d) {
    /* 隐私打码（偏好 privacy_mask）：开启后所有金额显示为 ***** */
    var masked = window.JIANTHEME.getPref('privacy_mask') === '1';
    function m(v) { return masked ? '*****' : v; }
    /* Hero 卡：本月累计支出 + 明细数 + 上月同期对比（红涨绿跌，PRD 6.3.4） */
    setText('hero-month', d.monthCN);
    setText('hero-amount', m(fmt(d.monthExpense)));
    setText('hero-count', '共 ' + d.monthCount + ' 笔明细');
    var de = document.getElementById('hero-delta');
    if (de) {
      if (d.prevSamePeriodExpense > 0 && d.monthExpense > 0) {
        var p = (d.monthExpense - d.prevSamePeriodExpense) / d.prevSamePeriodExpense * 100;
        var up = p >= 0.05;
        de.textContent = (up ? '▲ ' : '▼ ') + Math.abs(p).toFixed(1) + '%';
        de.className = 'font-label-sm text-label-sm flex items-center ' + (up ? 'text-flow-expense' : 'text-flow-income');
      } else if (d.monthExpense > 0) {
        de.textContent = '上月无记录';
        de.className = 'font-label-sm text-label-sm flex items-center text-text-muted';
      } else {
        de.textContent = '—';
        de.className = 'font-label-sm text-label-sm flex items-center text-text-muted';
      }
    }

    /* 总预算使用（未设置 → 引导点击设置） */
    var st = document.getElementById('budget-status');
    var rem = document.getElementById('budget-remaining');
    var amt = document.getElementById('budget-amount');
    var bar = document.getElementById('budget-bar');
    if (st && d.budget.set) {
      var t = tierInfo(d.budget.usedPct);
      st.textContent = t.label;
      st.className = 'font-label-sm text-label-sm font-semibold ' + t.cls;
      var r = d.budget.remaining;
      if (rem) {
        rem.textContent = masked ? '*****' : (r < 0 ? '超支 ¥' + fmt(-r) : '¥' + fmt(r));
        rem.className = 'font-label-md text-label-md ' + (r < 0 ? 'text-flow-expense' : 'text-primary');
      }
      if (amt) amt.textContent = masked ? '*****' : '¥' + fmt(d.budget.amount);
      if (bar) {
        bar.style.width = Math.min(d.budget.usedPct, 100) + '%';
        bar.className = 'h-full rounded-full transition-all duration-500 ' + t.bar;
      }
    } else if (st) {
      st.textContent = '点击设置';
      st.className = 'font-label-sm text-label-sm font-semibold text-primary';
      if (rem) { rem.textContent = '—'; rem.className = 'font-label-md text-label-md text-primary'; }
      if (amt) amt.textContent = '—';
      if (bar) bar.style.width = '0%';
    }

    /* 近期收支流水（本月最近 3 笔支出，PRD 5.3 样式） */
    var list = document.getElementById('recentRecordsList');
    if (list) {
      if (!d.recent.length) {
        list.innerHTML = '<div class="py-space-md text-center font-caption text-caption text-text-muted">本月还没有支出记录，去明细页记一笔吧 🌸</div>';
      } else {
        list.innerHTML = d.recent.map(function (t) {
          return '<div class="h-12 flex items-center justify-between py-space-xs hover:bg-surface-container-low rounded-[8px] px-space-xs transition-colors">' +
            '<div class="flex items-center gap-space-sm min-w-0">' +
              '<div class="w-7 h-7 rounded-[8px] bg-surface-hero flex items-center justify-center text-[14px] shrink-0">' + esc(t.icon) + '</div>' +
              '<div class="flex flex-col min-w-0">' +
                '<span class="font-body-md text-body-md text-text-primary font-medium truncate">' + esc(t.title) + '</span>' +
                '<span class="font-caption text-caption text-text-muted">' + esc(dateLabel(t.date)) + ' · ' + esc(t.categoryName) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="text-right shrink-0">' +
              '<div class="font-label-md text-label-md text-flow-expense font-semibold">' + m('-¥' + fmt(t.amount)) + '</div>' +
              '<div class="font-caption text-caption text-text-muted">' + esc(t.accountName || '未分配') + '</div>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    /* 今日支出速览 + 占比最多两类 */
    setText('today-count', '已记 ' + d.today.count + ' 笔');
    setText('today-amount', m('¥' + fmt(d.today.expense)));
    var td = document.getElementById('today-delta');
    if (td) {
      if (d.today.yesterday > 0) {
        var diff = +(d.today.expense - d.today.yesterday).toFixed(2);
        td.textContent = diff === 0 ? '与昨日持平' : (diff > 0 ? '较昨日多 ¥' + fmt(diff) : '较昨日少 ¥' + fmt(-diff));
      } else {
        td.textContent = d.today.expense > 0 ? '昨日无记录' : '今天还没记账';
      }
    }
    for (var i = 1; i <= 2; i++) {
      var item = d.today.top2[i - 1];
      setText('top2-name-' + i, item ? item.name : '—');
      setText('top2-pct-' + i, item ? item.pct.toFixed(1) + '%' : '—');
    }

    /* 本月支出 Top 3（单笔最大 3 笔 + 各自占比 + 合计占比） */
    setText('top3-total', '占总额 ' + d.top3.combinedPct.toFixed(1) + '%');
    var box = document.getElementById('top3-list');
    if (box) {
      if (!d.top3.items.length) {
        box.innerHTML = '<div class="py-space-sm text-center font-caption text-caption text-text-muted">本月还没有支出记录 🌸</div>';
      } else {
        box.innerHTML = d.top3.items.map(function (it, idx) {
          var rank = idx + 1;
          return '<div class="flex flex-col gap-space-2xs">' +
            '<div class="flex items-center justify-between font-caption text-caption">' +
              '<div class="flex items-center gap-space-xs">' +
                '<span class="w-4 h-4 rounded-full font-bold text-[10px] flex items-center justify-center" style="background:' + esc(it.color) + '20;color:' + esc(it.color) + '">' + rank + '</span>' +
                '<span class="font-label-sm text-label-sm text-text-primary">' + esc(it.title) + '</span>' +
              '</div>' +
              '<div class="flex items-center gap-space-xs">' +
                '<span class="font-label-sm text-label-sm text-text-primary font-medium">' + m('¥' + fmt(it.amount)) + '</span>' +
                '<span class="text-text-muted">' + it.pct.toFixed(1) + '%</span>' +
              '</div>' +
            '</div>' +
            '<div class="w-full h-1.5 rounded-full bg-track-unfilled overflow-hidden">' +
              '<div class="h-full rounded-full" style="width:' + it.pct.toFixed(1) + '%;background:' + esc(it.color) + '"></div>' +
            '</div>' +
          '</div>';
        }).join('');
      }
    }

    renderTip(d);
  }

  /* ---------- 理财小贴士（动态：剩余天数 + 日均可用额度） ---------- */
  function renderTip(d) {
    var el = document.getElementById('tip-text');
    if (!el) return;
    var now = new Date();
    var daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    var remainDays = Math.max(daysInMonth - now.getDate() + 1, 0);   /* 含今天 */
    /* 未设置预算时默认 100 元（用户口径） */
    var budgetAmount = d.budget.set ? d.budget.amount : 100;
    var remain = budgetAmount - d.monthExpense;
    var daily = remainDays > 0 ? remain / remainDays : 0;
    if (daily < 0) daily = 0;
    el.textContent = '本月还剩 ' + remainDays + ' 天，日均预算建议保持在 ¥' + daily.toFixed(2) + ' 以内哦。';
  }

  /* 记账弹窗保存成功后刷新首页卡片 */
  window.addEventListener('jianji:txn-changed', function () { load(); });

  /* ---------- ④ 拉取汇总 ---------- */
  function load() {
    fetch('/api/home/summary')
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(renderSummary)
      .catch(function (err) { console.error('首页汇总加载失败：', err); });
  }

  bindBudgetEditor();
  load();
})();
