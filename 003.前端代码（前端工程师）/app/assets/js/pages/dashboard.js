/* 简记 · 首页交互 */
(function () {
  'use strict';
  /* 移动端悬浮「快速记账」→ 前往明细页（记账抽屉在明细页） */
  var fab = document.getElementById('mobileFloatRecordBtn');
  if (fab) {
    fab.addEventListener('click', function () {
      location.href = 'transactions.html';
    });
  }
})();
