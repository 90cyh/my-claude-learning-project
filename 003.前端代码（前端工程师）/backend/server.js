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
         (?, '微信',   '💬', 0, 1),
         (?, '支付宝', '🅰️', 0, 2),
         (?, '现金',   '💵', 0, 3),
         (?, '银行卡', '💳', 0, 4)`,
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

app.listen(PORT, () => {
  console.log(`简记后端已启动：http://localhost:${PORT}（登录页 /login.html）`);
});
