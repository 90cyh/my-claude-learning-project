/* ============================================================
   简记后端（PRD V1.0.2）：注册 / 登录 / 退出 / 会话
   Express + MySQL（004 数据库设计的 jianji 库）
   启动：npm start → http://localhost:3000
   静态托管 ../app（登录页 /login.html、注册页 /register.html）
   ============================================================ */
'use strict';
const path = require('path');
const express = require('express');
const crypto = require('crypto');
const pool = require('./db');
const { makeSalt, hashPassword, verifyPassword, makeToken } = require('./auth');

const PORT = process.env.PORT || 3000;
const COOKIE = 'jj_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;   // PRD 5.9 规则3：会话长期保持（一年）

const app = express();
app.use(express.json());

/* 静态托管前端页面 */
app.use(express.static(path.join(__dirname, '..', 'app')));

/* ---------- 工具 ---------- */

/* 解析 Cookie（不引入额外依赖） */
function getCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1 && part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/* 按 Cookie 令牌查当前用户（session 表 JOIN user 表） */
async function currentUser(req) {
  const token = getCookie(req, COOKIE);
  if (!token) return null;
  const [rows] = await pool.query(
    `SELECT u.id, u.username
       FROM session s JOIN user u ON u.id = s.user_id
      WHERE s.id = ?`,
    [token]
  );
  return rows[0] || null;
}

/* 建立会话：随机会话令牌写入 session 表 + HttpOnly Cookie 下发（PRD 5.9 规则3） */
async function createSession(res, userId) {
  const token = makeToken();
  await pool.query('INSERT INTO session (id, user_id) VALUES (?, ?)', [token, userId]);
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`);
}

/* 登录失败锁定（PRD 5.9 规则2：连续 5 次失败锁定 30 秒） */
const fails = new Map();
function lockedLeft(username) {
  const f = fails.get(username);
  if (f && Date.now() < f.until) return Math.ceil((f.until - Date.now()) / 1000);
  return 0;
}
function recordFail(username) {
  const f = fails.get(username) || { n: 0, until: 0 };
  f.n += 1;
  if (f.n >= 5) { f.until = Date.now() + 30 * 1000; f.n = 0; }
  fails.set(username, f);
}

/* ---------- API：/api/auth/* ---------- */

/* 注册（PRD 5.9 V1.0.2）：成功后跳转登录页（不直接建立会话）；同名 409；注册同时预置 4 个资金账户（PRD 5.7） */
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!/^[一-龥A-Za-z0-9_]{3,20}$/.test(username || ''))
    return res.status(400).json({ message: '账号名称需为 3~20 位中文/字母/数字/下划线' });
  if (typeof password !== 'string' || password.length < 6 || password.length > 64)
    return res.status(400).json({ message: '访问密码长度需为 6~64 位字符' });

  const conn = await pool.getConnection();
  try {
    const [dup] = await conn.query('SELECT id FROM user WHERE username = ?', [username]);
    if (dup.length) return res.status(409).json({ message: '该用户名已存在' });

    const id = crypto.randomUUID();
    const salt = makeSalt();
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO user (id, username, password_hash, salt) VALUES (?, ?, ?, ?)',
      [id, username, hashPassword(password, salt), salt]
    );
    await conn.query(
      `INSERT INTO account (user_id, name, icon, initial_balance, sort_order) VALUES
         (?, '微信',   'chat', 0, 1),
         (?, '支付宝', 'payments', 0, 2),
         (?, '现金',   'toll', 0, 3),
         (?, '银行卡', 'credit_card', 0, 4)`,
      [id, id, id, id]
    );
    await conn.commit();

    res.status(201).json({ username });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  } finally {
    conn.release();
  }
});

/* 登录（PRD 5.9）：统一错误文案不区分错因；连错 5 次锁 30 秒 */
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ message: '请输入用户名与密码' });
  const wait = lockedLeft(username);
  if (wait > 0)
    return res.status(429).json({ message: `失败次数过多，请 ${wait} 秒后再试` });

  try {
    const [rows] = await pool.query(
      'SELECT id, username, password_hash, salt FROM user WHERE username = ?',
      [username]
    );
    const user = rows[0];
    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      recordFail(username);
      return res.status(401).json({ message: '用户名或密码错误' });   // 统一文案（PRD 5.9 规则1）
    }
    fails.delete(username);
    await createSession(res, user.id);
    res.json({ username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 会话状态：前端门禁用（PRD 5.9 规则4） */
app.get('/api/auth/me', async (req, res) => {
  try {
    const user = await currentUser(req);
    if (!user) return res.status(401).json({ message: '未登录' });
    const [ext] = await pool.query(
      `SELECT u.avatar,
              (SELECT value FROM user_setting WHERE user_id = u.id AND \`key\` = 'theme') AS theme
         FROM user u WHERE u.id = ?`, [user.id]);
    res.json({ username: user.username, avatar: ext[0].avatar || null, theme: ext[0].theme || null });
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: '未登录' });
  }
});

/* 退出登录（PRD 5.9）：删 session 表记录 + 清 Cookie，数据保留 */
app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = getCookie(req, COOKIE);
    if (token) await pool.query('DELETE FROM session WHERE id = ?', [token]);
  } catch (err) {
    console.error(err);
  }
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
  res.json({ ok: true });
});

/* ---------- 首页汇总（PRD 6.2 首页动态化，PRD 5.4 统计口径） ---------- */

/* 设置/修改本月总预算（PRD 7.4：category_id 为空 = 总预算，按当月生效值存储） */
app.post('/api/budget', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  const amount = Number(req.body && req.body.amount);
  if (!(amount > 0) || amount > 99999999.99)
    return res.status(400).json({ message: '预算金额需大于 0 且不超过 99,999,999.99' });
  try {
    const [rows] = await pool.query(
      'SELECT id FROM budget WHERE user_id = ? AND category_id IS NULL LIMIT 1', [user.id]);
    if (rows.length) {
      await pool.query('UPDATE budget SET amount = ?, updated_at = NOW(3) WHERE id = ?', [amount, rows[0].id]);
    } else {
      await pool.query('INSERT INTO budget (user_id, category_id, amount) VALUES (?, NULL, ?)', [user.id, amount]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* ---------- 我的页（PRD 6.1 / 5.7 / 7.5） ---------- */

/* 打卡天数：从今天（今天未记则从昨天）往回连续每天有记录的最长天数 */
function calcStreak(dates) {
  const set = new Set(dates);
  const pad = (n) => String(n).padStart(2, '0');
  const dstr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const d = new Date();
  if (!set.has(dstr(d))) d.setDate(d.getDate() - 1);
  let streak = 0;
  while (set.has(dstr(d))) { streak += 1; d.setDate(d.getDate() - 1); }
  return streak;
}

/* 我的页汇总：资料 / 打卡 / 累计笔数 / 资金账户余额（余额来自视图 v_account_balance） */
app.get('/api/user/settings-summary', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  try {
    const uid = user.id;
    const [txDates] = await pool.query('SELECT DISTINCT date FROM transaction WHERE user_id = ?', [uid]);
    const [cntRows] = await pool.query('SELECT COUNT(*) AS c FROM transaction WHERE user_id = ?', [uid]);
    const [accounts] = await pool.query(
      'SELECT id, name, icon, balance FROM v_account_balance WHERE user_id = ? ORDER BY sort_order', [uid]);
    const [avatarRows] = await pool.query('SELECT avatar FROM user WHERE id = ?', [uid]);
    const [prefs] = await pool.query('SELECT `key`, value FROM user_setting WHERE user_id = ?', [uid]);
    const prefMap = {};
    prefs.forEach(function (r) { prefMap[r.key] = r.value; });
    res.json({
      username: user.username,
      avatar: avatarRows[0].avatar || null,
      streakDays: calcStreak(txDates.map(function (r) { return r.date; })),
      totalTxns: cntRows[0].c,
      accounts: accounts.map(function (a) {
        return { id: a.id, name: a.name, icon: a.icon, balance: +a.balance };
      }),
      totalBalance: +accounts.reduce(function (s, a) { return s + +a.balance; }, 0).toFixed(2),
      prefs: prefMap
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 上传头像：前端缩至 128×128 后以 dataURL 存入 user.avatar（要求保存在数据库） */
app.post('/api/user/avatar', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  const dataUrl = String((req.body && req.body.dataUrl) || '');
  if (!/^data:image\/(png|jpe?g|webp);base64,/.test(dataUrl) || dataUrl.length > 300000)
    return res.status(400).json({ message: '头像格式或大小不符合要求' });
  try {
    await pool.query('UPDATE user SET avatar = ? WHERE id = ?', [dataUrl, user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 偏好设置 upsert（PRD 7.5 user_setting）：theme / arith / privacy_mask */
app.post('/api/user/setting', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  const key = String((req.body && req.body.key) || '');
  const value = String((req.body && req.body.value) || '');
  if (!['theme', 'arith', 'privacy_mask'].includes(key))
    return res.status(400).json({ message: '不支持的设置项' });
  try {
    await pool.query(
      `INSERT INTO user_setting (user_id, \`key\`, value) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE value = VALUES(value)`, [user.id, key, value]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 新增资金账户（PRD 5.7） */
app.post('/api/account', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  const clean = String((req.body && req.body.name) || '').trim();
  if (!clean || clean.length > 20) return res.status(400).json({ message: '请输入 20 字内的账户名称' });
  const bal = Number((req.body && req.body.initial_balance) || 0);
  if (!(bal >= 0) || bal > 99999999.99) return res.status(400).json({ message: '初始余额需 ≥ 0' });
  try {
    const [r] = await pool.query(
      'INSERT INTO account (user_id, name, icon, initial_balance, sort_order) VALUES (?, ?, ?, ?, 99)',
      [user.id, clean, String((req.body && req.body.icon) || '💳').slice(0, 8), bal]);
    const [rows] = await pool.query('SELECT id, name, icon, balance FROM v_account_balance WHERE id = ?', [r.insertId]);
    res.status(201).json({ account: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 清空当前账本数据（交易 + 预算；保留账户/资料/偏好），前端需 RESET 二次确认 */
app.post('/api/user/data-reset', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  try {
    const [r1] = await pool.query('DELETE FROM transaction WHERE user_id = ?', [user.id]);
    const [r2] = await pool.query('DELETE FROM budget WHERE user_id = ?', [user.id]);
    res.json({ ok: true, txnsDeleted: r1.affectedRows, budgetsDeleted: r2.affectedRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 删除资金账户（PRD 5.7 规则4）：其下流水自动转为「未分配」（account_id SET NULL） */
app.delete('/api/account/:id', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: '账户 ID 无效' });
  try {
    const [rows] = await pool.query('SELECT id FROM account WHERE id = ? AND user_id = ?', [id, user.id]);
    if (!rows.length) return res.status(404).json({ message: '账户不存在' });
    const [txnRows] = await pool.query('SELECT COUNT(*) AS c FROM transaction WHERE account_id = ?', [id]);
    await pool.query('DELETE FROM account WHERE id = ? AND user_id = ?', [id, user.id]);
    res.json({ ok: true, txnsUnassigned: txnRows[0].c });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 首页全部卡片数据，一次请求返回（全部按当前登录用户计算） */
app.get('/api/home/summary', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  try {
    const uid = user.id;
    const pad = (n) => String(n).padStart(2, '0');
    const dstr = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();                     // m 为 0 基
    const monthStart = dstr(new Date(y, m, 1));
    const nextStart = dstr(new Date(y, m + 1, 1));
    const todayStr = dstr(now);
    const ydayStr = dstr(new Date(y, m, now.getDate() - 1));
    const prevStart = dstr(new Date(y, m - 1, 1));                        // 上月 1 日
    const prevEnd = dstr(new Date(y, m - 1, Math.min(now.getDate(), new Date(y, m, 0).getDate()))); // 上月同期截止日

    const [curRows] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS s, COUNT(*) AS c FROM transaction
        WHERE user_id = ? AND type = 'expense' AND date >= ? AND date < ?`, [uid, monthStart, nextStart]);
    const [prevRows] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS s FROM transaction
        WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ?`, [uid, prevStart, prevEnd]);
    const [recent] = await pool.query(
      `SELECT t.id, t.note, t.amount, t.date, c.name AS category_name, c.icon AS category_icon, a.name AS account_name
         FROM transaction t
         JOIN category c ON c.id = t.category_id
         LEFT JOIN account a ON a.id = t.account_id
        WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date < ?
        ORDER BY t.date DESC, t.created_at DESC, t.id DESC
        LIMIT 3`, [uid, monthStart, nextStart]);
    const [todayRows] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS s, COUNT(*) AS c FROM transaction
        WHERE user_id = ? AND type = 'expense' AND date = ?`, [uid, todayStr]);
    const [ydayRows] = await pool.query(
      `SELECT COALESCE(SUM(amount),0) AS s FROM transaction
        WHERE user_id = ? AND type = 'expense' AND date = ?`, [uid, ydayStr]);
    const [top2] = await pool.query(
      `SELECT c.name, SUM(t.amount) AS s
         FROM transaction t JOIN category c ON c.id = t.category_id
        WHERE t.user_id = ? AND t.type = 'expense' AND t.date = ?
        GROUP BY c.id, c.name ORDER BY s DESC LIMIT 2`, [uid, todayStr]);
    const [top3] = await pool.query(
      `SELECT t.note, t.amount, c.name AS category_name, c.color AS category_color
         FROM transaction t JOIN category c ON c.id = t.category_id
        WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date < ?
        ORDER BY t.amount DESC LIMIT 3`, [uid, monthStart, nextStart]);
    const [budgetRows] = await pool.query(
      'SELECT amount FROM budget WHERE user_id = ? AND category_id IS NULL LIMIT 1', [uid]);

    const monthExpense = +curRows[0].s;
    const todayTotal = +todayRows[0].s;
    const top2Data = top2.map(function (r) {
      return { name: r.name, pct: todayTotal > 0 ? +(r.s / todayTotal * 100).toFixed(1) : 0 };
    });
    const top3Items = top3.map(function (r) {
      return {
        title: r.note || r.category_name,
        categoryName: r.category_name,
        color: r.category_color,
        amount: +r.amount,
        pct: monthExpense > 0 ? +(r.amount / monthExpense * 100).toFixed(1) : 0
      };
    });
    const combinedPct = monthExpense > 0
      ? +(top3Items.reduce(function (s, x) { return s + x.amount; }, 0) / monthExpense * 100).toFixed(1)
      : 0;
    const b = budgetRows[0];
    const usedPct = b && +b.amount > 0 ? +(monthExpense / +b.amount * 100).toFixed(1) : 0;

    res.json({
      monthCN: y + '年' + (m + 1) + '月',
      monthExpense: monthExpense,
      monthCount: curRows[0].c,
      prevSamePeriodExpense: +prevRows[0].s,
      budget: b
        ? { set: true, amount: +b.amount, used: monthExpense, usedPct: usedPct,
            remaining: +(+b.amount - monthExpense).toFixed(2) }
        : { set: false },
      recent: recent.map(function (r) {
        return { id: r.id, title: r.note || r.category_name, categoryName: r.category_name,
                 icon: r.category_icon, date: r.date, amount: +r.amount, accountName: r.account_name };
      }),
      today: { expense: todayTotal, count: todayRows[0].c, yesterday: +ydayRows[0].s, top2: top2Data },
      top3: { items: top3Items, combinedPct: combinedPct }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* ---------- 明细页（PRD 5.3 列表 / 5.1 记账 / 5.5 导出） ---------- */

/* 月份工具：'YYYY-MM' → 当月首日 / 次月首日 */
function monthRange(mk) {
  const [y, m] = mk.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  const pad = (n) => String(n).padStart(2, '0');
  return {
    start: start.getFullYear() + '-' + pad(start.getMonth() + 1) + '-01',
    end: end.getFullYear() + '-' + pad(end.getMonth() + 1) + '-01'
  };
}

/* 表单元数据：分类树 / 资金账户 / 后端生成的当前日期与时刻 */
app.get('/api/transaction/meta', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  try {
    const [cats] = await pool.query(
      `SELECT id, name, type, parent_id, icon, color FROM category
        WHERE is_active = 1 ORDER BY type, parent_id, sort_order`);
    const [accts] = await pool.query(
      'SELECT id, name, icon FROM account WHERE user_id = ? AND is_active = 1 ORDER BY sort_order', [user.id]);
    const [now] = await pool.query("SELECT CURDATE() AS today, DATE_FORMAT(NOW(), '%H:%i') AS now");
    res.json({
      today: String(now[0].today),
      now: now[0].now,
      categories: cats,
      accounts: accts
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 可选月份：该用户有记账数据的月份（倒序）+ 当前月 */
app.get('/api/transaction/months', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  try {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const cur = now.getFullYear() + '-' + pad(now.getMonth() + 1);
    const [rows] = await pool.query(
      `SELECT DISTINCT DATE_FORMAT(date, '%Y-%m') AS mk
         FROM transaction WHERE user_id = ? ORDER BY mk DESC`, [user.id]);
    const list = rows.map(function (r) { return r.mk; });
    if (list.indexOf(cur) === -1) list.unshift(cur);
    res.json({ months: list, current: cur });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 明细列表：按月 + 类型 + 分类 + 关键词（备注/商家/标签）查询，返回按天分组 */
app.get('/api/transaction/list', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  try {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const mk = /^\d{4}-\d{2}$/.test(req.query.month || '')
      ? req.query.month
      : now.getFullYear() + '-' + pad(now.getMonth() + 1);
    const { start, end } = monthRange(mk);
    const type = ['expense', 'income'].includes(req.query.type) ? req.query.type : 'all';
    const cat = /^\d+$/.test(req.query.category || '') ? Number(req.query.category) : null;
    const q = String(req.query.q || '').trim();

    const where = ['t.user_id = ?', 't.date >= ?', 't.date < ?'];
    const params = [user.id, start, end];
    if (type !== 'all') { where.push('t.type = ?'); params.push(type); }
    if (cat !== null) { where.push('t.category_id = ?'); params.push(cat); }
    if (q) {
      where.push('(t.note LIKE ? OR c.name LIKE ? OR sc.name LIKE ? OR a.name LIKE ?)');
      const like = '%' + q + '%';
      params.push(like, like, like, like);
    }
    const [rows] = await pool.query(
      `SELECT t.id, t.type, t.amount, t.date, t.note, t.account_id,
              DATE_FORMAT(t.created_at, '%H:%i') AS time,
              t.created_at, t.updated_at,
              c.id AS cat_id, c.name AS cat_name, c.icon AS cat_icon, c.color AS cat_color,
              sc.id AS sub_id, sc.name AS sub_name,
              a.name AS account_name
         FROM transaction t
         JOIN category c ON c.id = t.category_id
         LEFT JOIN category sc ON sc.id = t.subcategory_id
         LEFT JOIN account a ON a.id = t.account_id
        WHERE ${where.join(' AND ')}
        ORDER BY t.date DESC, t.created_at DESC, t.id DESC`, params);

    let totalExpense = 0, totalIncome = 0;
    const map = new Map();
    rows.forEach(function (r) {
      if (r.type === 'expense') totalExpense += Number(r.amount);
      else totalIncome += Number(r.amount);
      if (!map.has(r.date)) map.set(r.date, []);
      map.get(r.date).push(r);
    });
    const groups = [...map.entries()].map(function (entry) {
      const items = entry[1].map(function (r) {
        return {
          id: r.id, type: r.type, amount: Number(r.amount), date: r.date,
          time: r.time, note: r.note || '', createdAt: r.created_at, updatedAt: r.updated_at,
          categoryId: r.cat_id, categoryName: r.cat_name, categoryIcon: r.cat_icon,
          categoryColor: r.cat_color, subCategoryId: r.sub_id, subCategoryName: r.sub_name,
          accountId: r.account_id, accountName: r.account_name
        };
      });
      return { date: entry[0], items: items };
    });

    res.json({
      month: mk,
      count: rows.length,
      totalExpense: Math.round(totalExpense * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      groups: groups
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 新增记账：日期与时刻由后端生成（未传 date 时取今天） */
app.post('/api/transaction', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  const body = req.body || {};
  const amount = Number(body.amount);
  if (!(amount > 0) || amount > 99999999.99)
    return res.status(400).json({ message: '金额需大于 0 且不超过 99,999,999.99' });
  const categoryId = Number(body.categoryId);
  if (!Number.isInteger(categoryId)) return res.status(400).json({ message: '请选择分类' });
  const note = String(body.note || '').trim().slice(0, 50);
  const accountId = body.accountId ? Number(body.accountId) : null;
  const subId = body.subCategoryId ? Number(body.subCategoryId) : null;
  try {
    const [catRows] = await pool.query('SELECT id, type FROM category WHERE id = ?', [categoryId]);
    if (!catRows.length) return res.status(400).json({ message: '分类不存在' });
    const type = catRows[0].type;
    /* 记账日期：后端生成（默认今天，允许补记过去 365 天内） */
    let date = String(body.date || '');
    const [todayRow] = await pool.query('SELECT CURDATE() AS d');
    const today = String(todayRow[0].d);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) date = today;
    if (date > today) return res.status(400).json({ message: '不能记录未来日期' });
    const minDate = new Date(); minDate.setDate(minDate.getDate() - 365);
    const pad = (n) => String(n).padStart(2, '0');
    const min = minDate.getFullYear() + '-' + pad(minDate.getMonth() + 1) + '-' + pad(minDate.getDate());
    if (date < min) return res.status(400).json({ message: '仅支持补记 365 天内的账' });

    const [r] = await pool.query(
      `INSERT INTO transaction (user_id, type, amount, category_id, subcategory_id, date, account_id, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, type, amount, categoryId, subId, date, accountId, note]);
    const [rows] = await pool.query(
      `SELECT t.id, t.type, t.amount, t.date, t.note, t.account_id,
              DATE_FORMAT(t.created_at, '%H:%i') AS time, t.created_at, t.updated_at,
              c.id AS cat_id, c.name AS cat_name, c.icon AS cat_icon, c.color AS cat_color,
              sc.id AS sub_id, sc.name AS sub_name, a.name AS account_name
         FROM transaction t
         JOIN category c ON c.id = t.category_id
         LEFT JOIN category sc ON sc.id = t.subcategory_id
         LEFT JOIN account a ON a.id = t.account_id
        WHERE t.id = ?`, [r.insertId]);
    const row = rows[0];
    res.status(201).json({
      record: {
        id: row.id, type: row.type, amount: Number(row.amount), date: row.date, time: row.time,
        note: row.note || '', createdAt: row.created_at, updatedAt: row.updated_at,
        categoryId: row.cat_id, categoryName: row.cat_name, categoryIcon: row.cat_icon,
        categoryColor: row.cat_color, subCategoryId: row.sub_id, subCategoryName: row.sub_name,
        accountId: row.account_id, accountName: row.account_name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 修改记账（日期与时刻由后端维护，不接受前端传入） */
app.put('/api/transaction/:id', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  const id = Number(req.params.id);
  const body = req.body || {};
  const amount = Number(body.amount);
  if (!Number.isInteger(id)) return res.status(400).json({ message: '流水 ID 无效' });
  if (!(amount > 0) || amount > 99999999.99)
    return res.status(400).json({ message: '金额需大于 0 且不超过 99,999,999.99' });
  const categoryId = Number(body.categoryId);
  if (!Number.isInteger(categoryId)) return res.status(400).json({ message: '请选择分类' });
  const note = String(body.note || '').trim().slice(0, 50);
  const accountId = body.accountId ? Number(body.accountId) : null;
  const subId = body.subCategoryId ? Number(body.subId || body.subCategoryId) : null;
  try {
    const [own] = await pool.query('SELECT id FROM transaction WHERE id = ? AND user_id = ?', [id, user.id]);
    if (!own.length) return res.status(404).json({ message: '流水不存在' });
    const [catRows] = await pool.query('SELECT id, type FROM category WHERE id = ?', [categoryId]);
    if (!catRows.length) return res.status(400).json({ message: '分类不存在' });
    await pool.query(
      `UPDATE transaction
          SET type = ?, amount = ?, category_id = ?, subcategory_id = ?, account_id = ?, note = ?
        WHERE id = ? AND user_id = ?`,
      [catRows[0].type, amount, categoryId, subId, accountId, note, id, user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 删除记账 */
app.delete('/api/transaction/:id', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: '流水 ID 无效' });
  try {
    const [r] = await pool.query('DELETE FROM transaction WHERE id = ? AND user_id = ?', [id, user.id]);
    if (!r.affectedRows) return res.status(404).json({ message: '流水不存在' });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

/* 导出所选月份的明细 CSV（PRD 5.5：UTF-8 BOM + 9 个固定字段） */
app.get('/api/transaction/export', async (req, res) => {
  const user = await currentUser(req);
  if (!user) return res.status(401).json({ message: '未登录' });
  try {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const mk = /^\d{4}-\d{2}$/.test(req.query.month || '')
      ? req.query.month
      : now.getFullYear() + '-' + pad(now.getMonth() + 1);
    const { start, end } = monthRange(mk);
    const [rows] = await pool.query(
      `SELECT t.id, t.type, t.amount, t.date, t.note, t.created_at,
              c.name AS cat_name, sc.name AS sub_name, a.name AS account_name
         FROM transaction t
         JOIN category c ON c.id = t.category_id
         LEFT JOIN category sc ON sc.id = t.subcategory_id
         LEFT JOIN account a ON a.id = t.account_id
        WHERE t.user_id = ? AND t.date >= ? AND t.date < ?
        ORDER BY t.id DESC`, [user.id, start, end]);   /* 默认按 id 从高到低（最新在前） */

    const cell = (v) => {
      const s = String(v == null ? '' : v);
      return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const header = ['交易ID', '类型', '金额', '一级分类', '二级分类', '日期', '账户', '备注', '创建时间'];
    const lines = [header.join(',')];
    rows.forEach(function (r) {
      lines.push([
        r.id, r.type === 'expense' ? '支出' : '收入', Number(r.amount).toFixed(2),
        r.cat_name, r.sub_name || '', r.date, r.account_name || '未分配', r.note || '', r.created_at
      ].map(cell).join(','));
    });
    const csv = '﻿' + lines.join('\r\n');
    const d = new Date();
    const ts = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="jianji-${mk}-${ts}.csv"`);
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
});

app.listen(PORT, () => {
  console.log(`简记后端已启动：http://localhost:${PORT}（登录页 /login.html）`);
});
