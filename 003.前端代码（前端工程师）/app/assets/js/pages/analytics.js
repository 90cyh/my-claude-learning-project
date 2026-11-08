/* 简记 · 统计页交互 */
(function () {
  'use strict';
  /* 导出报表按钮反馈（原型演示） */
  var exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function () {
      var originalText = exportBtn.innerHTML;
      exportBtn.innerHTML = '<span class="material-symbols-outlined text-[18px]">check</span><span>报表已导出 (CSV)</span>';
      setTimeout(function () {
        exportBtn.innerHTML = originalText;
      }, 2000);
    });
  }
  /* 收起洞察卡片 */
  var dismissBtn = document.getElementById('dismissInsightBtn');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', function () {
      var card = dismissBtn.closest('.bg-surface-hero');
      if (card) card.style.display = 'none';
    });
  }
})();
