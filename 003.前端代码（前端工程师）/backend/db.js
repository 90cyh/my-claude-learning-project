'use strict';
/* MySQL 连接池（004 数据库设计：jianji 库）
   默认指向本机 root；正式部署请改用环境变量
   DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME */
const mysql = require('mysql2/promise');

module.exports = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS,   // 本地开发默认；提交/部署前建议改走环境变量
  database: process.env.DB_NAME || 'jianji',
  charset: 'utf8mb4',
  connectionLimit: 10,
  dateStrings: true   /* DATE/DATETIME 按字符串返回（YYYY-MM-DD），避免时区偏移 */
});
