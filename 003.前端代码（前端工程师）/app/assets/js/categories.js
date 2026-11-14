/* ============================================================
   简记 · 分类图标与配色（共享）
   图标沿用原静态页的 Material Symbols 线性图标；配色为分类色 12% 淡染底
   + 分类色图形（PRD 6.3.6：文字永不穿数据色，识别靠图标与色点）。
   ============================================================ */
window.JIANCAT = (function () {
  'use strict';
  var SYM = {
    '餐饮': 'restaurant', '交通': 'directions_bus', '购物': 'shopping_bag',
    '居住': 'home', '娱乐': 'theater_comedy', '医疗': 'medical_services',
    '教育': 'menu_book', '人情': 'card_giftcard', '其他': 'category',
    '工资': 'payments', '奖金': 'emoji_events', '理财收益': 'trending_up', '退款': 'undo'
  };
  var CLS = {
    '餐饮': 'bg-cat-dining/15 text-cat-dining',
    '交通': 'bg-cat-transport/15 text-cat-transport',
    '购物': 'bg-cat-shopping/15 text-cat-shopping',
    '居住': 'bg-cat-housing/15 text-cat-housing',
    '娱乐': 'bg-cat-entertainment/15 text-cat-entertainment',
    '医疗': 'bg-cat-medical/15 text-cat-medical',
    '教育': 'bg-cat-edu/15 text-cat-edu',
    '人情': 'bg-cat-social/15 text-cat-social',
    '其他': 'bg-cat-other/15 text-cat-other',
    '工资': 'bg-cat-housing/15 text-cat-housing',
    '奖金': 'bg-cat-social/15 text-cat-social',
    '理财收益': 'bg-cat-transport/15 text-cat-transport',
    '退款': 'bg-cat-edu/15 text-cat-edu'
  };
  return {
    sym: function (name) { return SYM[name] || 'category'; },
    cls: function (name) { return CLS[name] || 'bg-cat-other/15 text-cat-other'; },
    textCls: function (name) { return (CLS[name] || 'bg-cat-other/15 text-cat-other').split(' ')[1]; }
  };
})();
