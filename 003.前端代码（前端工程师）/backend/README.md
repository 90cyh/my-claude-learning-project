# 简记后端（Node.js + Express + MySQL）

PRD V1.0.2「云端账户」的实现：注册 / 登录 / 退出 / 服务端会话。

## 启动

```bash
# 前置：已执行 004 数据库初始化脚本（jianji 库）
cd 003.前端代码（前端工程师）/backend
npm install
npm start          # http://localhost:3000（静态托管 ../app，登录页 /login.html）
```

数据库连接见 `db.js`，可用环境变量覆盖：`DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME`。

## API（/api/auth/*）

| 方法 | 路径 | 请求 | 成功 | 失败 |
| --- | --- | --- | --- | --- |
| POST | /api/auth/register | `{username, password}` | 201 `{username}`（预置 4 个资金账户；注册后跳转登录页） | 400 校验失败 / 409 用户名已存在 |
| POST | /api/auth/login | `{username, password}` | 200 `{username}` | 401 用户名或密码错误（统一文案）/ 429 锁定倒计时 |
| GET | /api/auth/me | —（Cookie） | 200 `{username}` | 401 未登录 |
| POST | /api/auth/logout | —（Cookie） | 200 `{ok:true}` | — |

## 安全要点（PRD 5.9）

- 密码 PBKDF2-SHA256（独立盐、100,000 次迭代）哈希存储，永不明文；恒定时间比较防时序攻击；
- 会话：随机会话令牌写 `session` 表 + HttpOnly Cookie（一年有效），退出即删表记录；
- 登录失败统一文案「用户名或密码错误」；连续失败 5 次锁定 30 秒；
- 注册用事务保证：user 行 + 4 个预置资金账户要么全成、要么全不成。
