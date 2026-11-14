'use strict';
/* MySQL 连接池（004 数据库设计：jianji 库）
 *
 * 密码等敏感配置**不入库**：优先读环境变量，其次读本地私有配置
 * backend/config.local.js（该文件已在 .gitignore 中），两者都无则报错。
 *
 *   方式一（推荐，环境变量）：
 *     DB_USER=root DB_PASS=你的密码 npm start
 *   方式二（本地私有文件）：
 *     cp config.example.js config.local.js 后填入密码
 */
const mysql = require('mysql2/promise');

let local = {};
try {
  local = require('./config.local.js');   // 不存在时会抛错，忽略即可
} catch (e) {
  local = {};
}

const pass = process.env.DB_PASS || local.password;
if (!pass) {
  console.error(
    '\n[简记后端] 未找到数据库密码：请设置环境变量 DB_PASS，' +
    '或复制 config.example.js 为 config.local.js 并填入密码（该文件不会提交到仓库）。\n'
  );
  process.exit(1);
}

module.exports = mysql.createPool({
  host: process.env.DB_HOST || local.host || '127.0.0.1',
  port: Number(process.env.DB_PORT || local.port || 3306),
  user: process.env.DB_USER || local.user || 'root',
  password: pass,
  database: process.env.DB_NAME || local.database || 'jianji',
  charset: 'utf8mb4',
  connectionLimit: 10,
  dateStrings: true   /* DATE/DATETIME 按字符串返回（YYYY-MM-DD），避免时区偏移 */
});
