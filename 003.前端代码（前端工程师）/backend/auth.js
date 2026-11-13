'use strict';
/* 密码与会话令牌工具（PRD 5.9）
   PBKDF2-SHA256：每账户独立随机盐、100,000 次迭代——密码永不明文存储 */
const crypto = require('crypto');

const ITERATIONS = 100000;
const KEY_LEN = 64;
const DIGEST = 'sha256';

/* 16 字节盐 → 32 位 hex（user.salt VARCHAR(64) 够用） */
function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

/* 32 字节随机会话令牌 → 64 位 hex（session.id VARCHAR(64)） */
function makeToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, ITERATIONS, KEY_LEN, DIGEST).toString('hex');
}

/* 恒定时间比较，防时序攻击 */
function verifyPassword(password, salt, expectedHex) {
  try {
    const actual = Buffer.from(hashPassword(password, salt), 'hex');
    const expected = Buffer.from(expectedHex, 'hex');
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

module.exports = { makeSalt, makeToken, hashPassword, verifyPassword };
