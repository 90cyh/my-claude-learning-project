/* ============================================================
   简记 · 统计页（PRD 5.4：月度总览 / 分类占比 / 支出趋势）
   数据来源：GET /api/stats/summary?month=YYYY-MM
   图表规范（dataviz）：环形图扇区间留 2px 表面色间隔、升序起始使最大项落在顶部、
   文字永不穿数据色、图例列表作为文字兜底视图、单序列图表不加图例。
   ============================================================ */
(function () {
  'use strict';

  var state = { month: '', mode: 'month', data: null };

  /* ---------- 工具 ---------- */
  function $(s) { return document.querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmt(n) {
    return Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtShort(n) { return Math.round(Number(n)).toLocaleString('zh-CN'); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function curMonth() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function addMonths(mk, n) {
    var p = mk.split('-').map(Number);
    var m = p[1] - 1 + n;
    var y = p[0] + Math.floor(m / 12);
    m = ((m % 12) + 12) % 12;
    return y + '-' + pad(m + 1);
  }

  /* 分类图标（沿用原静态页 Material Symbols 图标） */
  var CAT_SYM = {
    '餐饮': 'restaurant', '交通': 'directions_bus', '购物': 'shopping_bag',
    '居住': 'home', '娱乐': 'theater_comedy', '医疗': 'medical_services',
    '教育': 'menu_book', '人情': 'card_giftcard', '其他': 'category'
  };
  var CAT_CLS = {
    '餐饮': 'bg-cat-dining/15 text-cat-dining', '交通': 'bg-cat-transport/15 text-cat-transport',
    '购物': 'bg-cat-shopping/15 text-cat-shopping', '居住': 'bg-cat-housing/15 text-cat-housing',
    '娱乐': 'bg-cat-entertainment/15 text-cat-entertainment', '医疗': 'bg-cat-medical/15 text-cat-medical',
    '教育': 'bg-cat-edu/15 text-cat-edu', '人情': 'bg-cat-social/15 text-cat-social',
    '其他': 'bg-cat-other/15 text-cat-other'
  };
  function sym(name) { return CAT_SYM[name] || 'category'; }
  function cls(name) { return CAT_CLS[name] || 'bg-cat-other/15 text-cat-other'; }

  /* 预算四档状态色（PRD 6.3.3） */
  function tier(pct) {
    if (pct > 100) return { text: 'text-status-danger', bar: 'bg-status-danger', label: '已超支' };
    if (pct >= 90) return { text: 'text-status-warning', bar: 'bg-status-warning', label: pct.toFixed(0) + '% 消耗' };
    if (pct >= 61) return { text: 'text-status-caution', bar: 'bg-status-caution', label: pct.toFixed(0) + '% 消耗' };
    return { text: 'text-status-safe', bar: 'bg-status-safe', label: pct.toFixed(0) + '% 消耗' };
  }

  /* ---------- 加载 ---------- */
  function load() {
    fetch('/api/stats/summary?month=' + encodeURIComponent(state.month))
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        state.data = d;
        renderAll(d);
      })
      .catch(function (err) { console.error('统计加载失败：', err); });
  }

  /* ---------- 渲染 ---------- */
  function renderAll(d) {
    /* 顶部月份 */
    $('#st-month-label').textContent = d.monthCN;
    $('#st-days-tag').textContent = d.isCurrentMonth
      ? '(已结账' + d.elapsedDays + '天)'
      : '(共' + d.elapsedDays + '天)';

    renderKpi(d);
    renderDonut(d);
    renderTrend(d);
    renderInsight(d);
  }

  function renderKpi(d) {
    /* 卡1：本月总支出 + 环比 */
    $('#kpi-expense').textContent = '¥' + fmt(d.totalExpense);
    var deltaBox = $('#kpi-delta');
    var icon = $('#kpi-delta-icon');
    var text = $('#kpi-delta-text');
    if (d.deltaPct === null) {
      deltaBox.className = 'inline-flex items-center font-label-sm text-label-sm font-semibold text-text-muted';
      icon.textContent = 'horizontal_rule';
      text.textContent = '上月无记录';
    } else {
      var up = d.deltaPct > 0;
      deltaBox.className = 'inline-flex items-center font-label-sm text-label-sm font-semibold ' +
        (up ? 'text-status-danger' : 'text-flow-income');
      icon.textContent = up ? 'arrow_upward' : 'arrow_downward';
      text.textContent = Math.abs(d.deltaPct).toFixed(1) + '%';
    }

    /* 卡2：总收入（V1.1 未开放） */
    $('#kpi-income').textContent = d.totalIncome > 0 ? '¥' + fmt(d.totalIncome) : '—';
    $('#kpi-income-tag').textContent = d.totalIncome > 0 ? '本期收入合计' : 'V1.1 即将开放';

    /* 卡3：日均支出 */
    $('#kpi-daily').textContent = '¥' + fmt(d.dailyAvg);
    $('#kpi-daily-tag').textContent = '基于已记录 ' + d.elapsedDays + ' 天折算';

    /* 卡4：剩余总预算 */
    if (d.budget.set) {
      var t = tier(d.budget.usedPct);
      $('#kpi-budget').textContent = d.budget.remaining < 0
        ? '超支 ¥' + fmt(-d.budget.remaining)
        : '¥' + fmt(d.budget.remaining);
      $('#kpi-budget-pct').textContent = t.label;
      $('#kpi-budget-pct').className = 'font-label-sm text-label-sm font-semibold ' + t.text;
      $('#kpi-budget-bar').style.width = Math.min(d.budget.usedPct, 100) + '%';
      $('#kpi-budget-bar').className = 'h-full rounded-full transition-all duration-500 ' + t.bar;
    } else {
      $('#kpi-budget').textContent = '—';
      $('#kpi-budget-pct').textContent = '未设置预算';
      $('#kpi-budget-pct').className = 'font-label-sm text-label-sm font-semibold text-primary';
      $('#kpi-budget-bar').style.width = '0%';
    }
  }

  /* ---------- 环形图（分类占比） ---------- */
  function renderDonut(d) {
    var svg = $('#donut-svg');
    var legend = $('#donut-legend');
    var cats = d.categories || [];

    if (!cats.length) {
      svg.innerHTML = '<circle cx="50" cy="50" fill="none" r="38" stroke="#f6e7ee" stroke-width="13"></circle>';
      legend.innerHTML = '<div class="py-space-md text-center font-caption text-caption text-text-muted">这个月还没有支出记录 🌸</div>';
      $('#donut-subtitle').textContent = '暂无数据';
      $('#donut-count').textContent = '共 0 项';
      $('#donut-center-label').textContent = '—';
      $('#donut-center-pct').textContent = '—';
      $('#donut-center-amount').textContent = '—';
      return;
    }

    /* 升序排列：最小项先画，最大项落在顶部（12 点方向起） */
    var asc = cats.slice().sort(function (a, b) { return a.amount - b.amount; });
    var C = 2 * Math.PI * 38;          // 周长
    var gap = 1.14;                    // ≈2px 表面色间隔（viewBox 100 → 176px 渲染）
    var offset = 0;
    var segs = '<circle cx="50" cy="50" fill="none" r="38" stroke="#f6e7ee" stroke-width="13"></circle>';
    asc.forEach(function (c) {
      var len = Math.max(c.pct / 100 * C - gap, 0.6);
      segs += '<circle class="transition-all hover:opacity-80" cx="50" cy="50" fill="none" r="38" ' +
        'stroke="' + esc(c.color) + '" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-offset).toFixed(2) + '" stroke-width="13"></circle>';
      offset += len + gap;
    });
    svg.innerHTML = segs;

    /* 中心：最大项 */
    var top = cats[0];
    $('#donut-center-label').textContent = '最大项' + top.name;
    $('#donut-center-pct').textContent = top.pct.toFixed(1) + '%';
    $('#donut-center-amount').textContent = '¥' + fmt(top.amount);
    $('#donut-center-amount').className = 'font-caption text-caption font-medium ' + cls(top.name).split(' ')[1];

    /* 图例（文字兜底视图） */
    legend.innerHTML = cats.map(function (c) {
      return '<a class="h-10 px-space-sm rounded-lg hover:bg-surface-hero transition-colors flex items-center justify-between" href="transactions.html">' +
        '<div class="flex items-center gap-space-sm">' +
          '<span class="w-6 h-6 rounded ' + cls(c.name) + ' flex items-center justify-center">' +
            '<span class="material-symbols-outlined text-[15px]">' + sym(c.name) + '</span>' +
          '</span>' +
          '<span class="font-body-md text-body-md text-text-primary font-medium">' + esc(c.name) + '</span>' +
        '</div>' +
        '<div class="flex items-center gap-space-md">' +
          '<span class="font-body-sm text-body-sm text-text-muted">' + c.pct.toFixed(1) + '%</span>' +
          '<span class="font-body-md text-body-md text-flow-expense font-semibold">¥' + fmt(c.amount) + '</span>' +
        '</div>' +
      '</a>';
    }).join('');

    $('#donut-subtitle').textContent = cats.length + '大类别开销分布 · ' + top.name + '居首位';
    $('#donut-count').textContent = '共 ' + cats.length + ' 项';
  }

  /* ---------- 趋势图 ---------- */
  function renderTrend(d) {
    var data = state.mode === 'month' ? d.trendMonths : d.trendWeeks;
    var chart = $('#trend-chart');
    var title = $('#trend-title');
    var subtitle = $('#trend-subtitle');

    title.textContent = state.mode === 'month' ? '近 6 个月支出趋势' : '近 12 周支出趋势';

    var values = data.map(function (x) { return x.value; });
    var max = Math.max.apply(null, values.concat([1]));
    var mean = values.reduce(function (s, v) { return s + v; }, 0) / (values.length || 1);
    var cur = data[data.length - 1];
    var diffPct = mean > 0 ? +((cur.value - mean) / mean * 100).toFixed(1) : null;

    subtitle.textContent = (state.mode === 'month' ? '半年均值' : '12 周均值') + ' ¥' + fmt(mean) +
      (diffPct === null ? '' : ' · 本期相对' + (diffPct >= 0 ? '偏高 +' : '偏低 ') + diffPct + '%');

    if (!values.some(function (v) { return v > 0; })) {
      chart.innerHTML = '<div class="py-space-lg text-center font-caption text-caption text-text-muted">这段时间还没有记录 🌸</div>';
      return;
    }

    /* 均值基准线位置（按比例换算到容器高度） */
    var scaleMax = max * 1.12;                    // 顶部留白
    var meanTop = Math.max(0, Math.min(92, (1 - mean / scaleMax) * 100));

    var bars = data.map(function (x, i) {
      var h = x.value > 0 ? Math.max((x.value / scaleMax) * 100, 1.5) : 0;
      var isCur = x.current;
      var barCls = isCur
        ? 'w-full max-w-[42px] bg-primary group-hover:bg-tertiary rounded-t-lg transition-all duration-300 shadow-sm'
        : 'w-full max-w-[42px] bg-surface-container-high group-hover:bg-primary-container rounded-t-lg transition-all duration-300';
      var labelCls = isCur
        ? 'font-caption text-caption font-bold text-primary'
        : 'font-caption text-caption text-text-secondary group-hover:text-primary';
      var tipCls = isCur
        ? 'absolute -top-7 bg-primary text-on-primary px-space-xs py-space-2xs rounded font-caption text-caption whitespace-nowrap shadow-sm z-30 flex items-center gap-space-2xs'
        : 'opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-inverse-surface text-inverse-on-surface px-space-xs py-space-2xs rounded font-caption text-caption whitespace-nowrap shadow pointer-events-none z-30';
      return '<div class="flex flex-col items-center gap-space-xs group relative h-full justify-end">' +
        '<div class="' + tipCls + '">' +
          (isCur ? '<span>¥' + fmt(x.value) + '</span><span class="w-1.5 h-1.5 rounded-full bg-surface"></span>' : '¥' + fmtShort(x.value)) +
        '</div>' +
        '<div class="' + barCls + '" style="height: ' + h.toFixed(1) + '%;"></div>' +
        '<span class="' + labelCls + '">' + esc(x.label) + '</span>' +
      '</div>';
    }).join('');

    var gridCls = state.mode === 'month'
      ? 'grid grid-cols-6 h-48 gap-space-xs sm:gap-space-sm items-end z-20'
      : 'grid grid-cols-6 sm:grid-cols-12 h-48 gap-space-xs sm:gap-space-sm items-end z-20';

    chart.innerHTML =
      '<div class="w-full h-56 flex flex-col justify-end relative">' +
        '<div class="absolute left-0 right-0 z-10 flex items-center pointer-events-none" style="top:' + meanTop.toFixed(1) + '%">' +
          '<div class="w-full border-t border-dashed border-primary/40"></div>' +
          '<span class="shrink-0 ml-space-xs bg-surface-hero px-space-xs py-space-2xs rounded text-primary font-caption text-caption font-semibold">均值 ¥' + fmtShort(mean) + '</span>' +
        '</div>' +
        '<div class="' + gridCls + '">' + bars + '</div>' +
      '</div>';
  }

  /* ---------- 洞察建议 ---------- */
  function renderInsight(d) {
    var el = $('#insight-text');
    if (!el) return;
    if (!d.categories || !d.categories.length) {
      el.textContent = '小提示：记几笔账，就能看到你的开销结构啦 🌸';
      return;
    }
    var top = d.categories[0];
    var rest = d.categories.length > 1 ? d.categories[1] : null;
    var txt = '小提示：本月' + top.name + '占比达到 <strong class="text-primary font-semibold">' + top.pct.toFixed(1) + '%</strong>';
    if (rest) txt += '，其次是' + rest.name + '（' + rest.pct.toFixed(1) + '%）';
    txt += '，后半月可适当留意哦 🌸';
    el.innerHTML = txt;
  }

  /* 记账弹窗保存成功后刷新统计 */
  window.addEventListener('jianji:txn-changed', function () { load(); });

  /* ---------- 月份下拉 ---------- */
  function renderMonthMenu(months, current) {
    var menu = $('#st-month-menu');
    if (!menu) return;
    menu.innerHTML = months.map(function (mk) {
      var p = mk.split('-');
      var on = mk === current;
      return '<button class="w-full flex items-center justify-between px-space-md py-space-xs font-label-md text-label-md ' +
        (on ? 'bg-surface-hero text-primary' : 'text-text-primary hover:bg-surface-hero') +
        ' transition-colors text-left" data-month="' + mk + '">' +
        '<span>' + p[0] + '年 ' + (+p[1]) + '月</span>' +
        (on ? '<span class="material-symbols-outlined text-primary text-[16px]">check_circle</span>' : '') +
        '</button>';
    }).join('');
  }
  function loadMonths() {
    return fetch('/api/transaction/months').then(function (r) { return r.json(); })
      .then(function (d) { renderMonthMenu(d.months, state.month); })
      .catch(function () { /* 忽略 */ });
  }

  /* ---------- 事件 ---------- */
  function bindEvents() {
    $('#st-prev').addEventListener('click', function () {
      state.month = addMonths(state.month, -1);
      load(); loadMonths();
    });
    $('#st-next').addEventListener('click', function () {
      var next = addMonths(state.month, 1);
      if (next > curMonth()) { toast('已经是最新月份了'); return; }
      state.month = next;
      load(); loadMonths();
    });

    /* 月份下拉 */
    var toggle = $('#st-toggle');
    var menu = $('#st-month-menu');
    if (toggle && menu) {
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        loadMonths().then(function () { menu.classList.toggle('hidden'); });
      });
      menu.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-month]');
        if (!btn) return;
        state.month = btn.getAttribute('data-month');
        menu.classList.add('hidden');
        load();
      });
      document.addEventListener('click', function (e) {
        if (menu.classList.contains('hidden')) return;
        if (!menu.contains(e.target) && e.target !== toggle) menu.classList.add('hidden');
      });
    }

    /* 按月 / 按周切换 */
    $('#trend-seg').addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      $('#trend-seg').querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      state.mode = b.getAttribute('data-mode');
      if (state.data) renderTrend(state.data);
    });

    /* 导出报表：沿用明细页 CSV 导出（所选月份） */
    $('#exportBtn').addEventListener('click', function () {
      var url = '/api/transaction/export?month=' + encodeURIComponent(state.month);
      fetch(url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var disp = r.headers.get('Content-Disposition') || '';
        var m = disp.match(/filename="?([^"]+)"?/);
        return r.blob().then(function (b) { return { blob: b, name: m ? m[1] : 'jianji.csv' }; });
      }).then(function (f) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(f.blob);
        a.download = f.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 3000);
        toast('报表已导出 ✓');
      }).catch(function () { toast('导出失败，请稍后再试', true); });
    });
  }

  /* ---------- 启动 ---------- */
  state.month = curMonth();
  load();
  bindEvents();
  loadMonths();
})();
