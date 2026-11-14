'use strict';
/* 本地数据库配置模板
 * 使用方法：复制为 config.local.js 并填入本机实际值（config.local.js 不会提交到仓库）
 *   cp config.example.js config.local.js
 * 也可直接用环境变量覆盖：DB_HOST / DB_PORT / DB_USER / DB_PASS / DB_NAME
 */
module.exports = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: '在此填入你的 MySQL 密码',
  database: 'jianji'
};
