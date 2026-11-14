-- ============================================================
-- 简记（个人财务管理工具）数据库初始化脚本（MySQL 版）
-- 目标数据库：MySQL 8.0.16+（CHECK 约束自 8.0.16 起强制生效）
--            字符集必须 utf8mb4（分类图标含 emoji，utf8 会插入失败）
-- 设计依据：001/个人财务管理产品PRD-V1.0.1.md 第 5/7 章
--           002.产品UI原型（美术设计）/UI原型/（原 003/frontend，已归档）
-- 版本：V1.0.1-mysql | 日期：2026-11-09 | 撰写：数据库管理员（DBA）
-- 用法：mysql --default-character-set=utf8mb4 -u root -p < 简记数据库初始化脚本.sql
-- 配套文档：简记数据库设计文档.md（同目录，含 SQLite→MySQL 差异说明）
-- 可重复执行：CREATE TABLE IF NOT EXISTS + INSERT IGNORE
-- ============================================================

CREATE DATABASE IF NOT EXISTS jianji
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE jianji;

-- ============================================================
-- 1. 表设计（建表顺序已按外键依赖重排：被引用表先建）
-- ============================================================

-- ------------------------------------------------------------
-- 1.1 本地账户表 user（PRD 7.5 / 5.9）
-- 密码永不明文：仅存 PBKDF2-SHA256 哈希与独立随机盐
-- 注意：CHAR_LENGTH 按字符计数（中文用户名 3~20 字）；
--      MySQL 的 LENGTH() 按字节计数，不可用于此校验
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user (
    id            VARCHAR(36) NOT NULL PRIMARY KEY,          -- UUID（SQLite 版为 TEXT，MySQL 主键须 VARCHAR）
    username      VARCHAR(20) NOT NULL UNIQUE
                  CHECK (CHAR_LENGTH(username) BETWEEN 3 AND 20),  -- 3~20 字符（PRD 5.9）
    password_hash VARCHAR(255) NOT NULL,                     -- PBKDF2-SHA256 哈希
    salt          VARCHAR(64)  NOT NULL,                     -- 每账户独立随机盐
    avatar        LONGTEXT     NULL,                         -- 头像（前端缩至 128×128 的 base64 dataURL）
    created_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 1.2 会话表 session（PRD 7.5，可选表）
-- 应用以 localStorage 管理会话时可不使用；DB 落地会话时使用
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session (
    id       VARCHAR(64) NOT NULL PRIMARY KEY,               -- 会话令牌
    user_id  VARCHAR(36) NOT NULL,
    login_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_session_user FOREIGN KEY (user_id)
        REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 1.3 用户偏好表 user_setting（PRD 7.5：主题等，key-value）
-- 注意：key 是 MySQL 保留字，必须反引号
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_setting (
    user_id VARCHAR(36) NOT NULL,
    `key`   VARCHAR(50) NOT NULL,                            -- 如 theme / privacy_mask
    value   VARCHAR(255) NOT NULL,
    PRIMARY KEY (user_id, `key`),
    CONSTRAINT fk_setting_user FOREIGN KEY (user_id)
        REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 1.4 分类表 category（PRD 7.2 / 5.2）
-- 两级结构：parent_id 为空 = 一级分类；is_active = 逻辑删除标记
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category (
    id         INT           NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(6)    NOT NULL CHECK (CHAR_LENGTH(name) <= 6),   -- 分类名 ≤ 6 字符（PRD 7.2）
    type       VARCHAR(10)   NOT NULL CHECK (type IN ('expense', 'income')),
    parent_id  INT           NULL,
    icon       VARCHAR(16)   NOT NULL,                        -- 图标（如 🍜，utf8mb4 存储）
    color      VARCHAR(9)    NOT NULL,                        -- 色值（PRD 6.3.5 色板，如 #e8752e）
    sort_order INT           NOT NULL DEFAULT 0,
    is_active  TINYINT(1)    NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id)
        REFERENCES category(id) ON DELETE CASCADE             -- 二级分类随父级删除
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 1.5 资金账户表 account（PRD 7.3 / 5.7，V1.1 启用）
-- 余额不落库：初始余额 + 收入 − 支出，实时计算（见视图 v_account_balance）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS account (
    id              BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         VARCHAR(36)   NOT NULL,
    name            VARCHAR(20)   NOT NULL,                 -- 如：微信 / 支付宝 / 现金 / 银行卡
    icon            VARCHAR(16)   NOT NULL,
    initial_balance DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (initial_balance >= 0),
    sort_order      INT           NOT NULL DEFAULT 0,
    is_active       TINYINT(1)    NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    CONSTRAINT fk_account_user FOREIGN KEY (user_id)
        REFERENCES user(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 1.6 交易表 transaction（PRD 7.1 / 5.1，核心表）
-- 金额 DECIMAL(10,2)：精确小数，上限 99,999,999.99 恰好 10 位（PRD 5.1/7.1）
-- 恒为正数，方向由 type 决定；account 可空 = 未分配
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transaction (
    id             BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id        VARCHAR(36)   NOT NULL,                  -- 账户重置=数据全清（PRD 5.9）
    type           VARCHAR(10)   NOT NULL CHECK (type IN ('expense', 'income')),
    amount         DECIMAL(10,2) NOT NULL CHECK (amount > 0 AND amount <= 99999999.99),
    category_id    INT           NOT NULL,                  -- 一级分类删除前须由应用改指「其他」（PRD 5.2 规则3）
    subcategory_id INT           NULL,                      -- 二级可选，删除后置空（PRD 5.1）
    `date`         DATE          NOT NULL,                  -- 原生 DATE 类型（SQLite 版为 TEXT+GLOB 校验）
    account_id     BIGINT        NULL,                      -- 账户删除→转未分配（PRD 5.7 规则4）
    note           VARCHAR(50)   NULL,                      -- 备注 ≤ 50 字符（PRD 5.1）
    created_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at     DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_txn_user FOREIGN KEY (user_id)
        REFERENCES user(id) ON DELETE CASCADE,               -- 账户重置 = 级联全清（PRD 5.9）
    CONSTRAINT fk_txn_cat FOREIGN KEY (category_id)
        REFERENCES category(id) ON DELETE RESTRICT,          -- 强制应用先改指「其他」再删分类（PRD 5.2 规则3）
    CONSTRAINT fk_txn_subcat FOREIGN KEY (subcategory_id)
        REFERENCES category(id) ON DELETE SET NULL,
    CONSTRAINT fk_txn_account FOREIGN KEY (account_id)
        REFERENCES account(id) ON DELETE SET NULL            -- 账户删除→转未分配（PRD 5.7 规则4）
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 1.7 预算表 budget（PRD 7.4 / 5.6，V1.1 启用）
-- category_id 为空 = 总预算；按「当月生效值」存储，跨月沿用额度
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS budget (
    id          BIGINT        NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id     VARCHAR(36)   NOT NULL,
    category_id INT           NULL,                          -- 为空 = 总预算
    amount      DECIMAL(10,2) NOT NULL CHECK (amount > 0 AND amount <= 99999999.99),
    updated_at  DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_budget_user FOREIGN KEY (user_id)
        REFERENCES user(id) ON DELETE CASCADE,
    CONSTRAINT fk_budget_cat FOREIGN KEY (category_id)
        REFERENCES category(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- 2. 索引（PRD 7.1 索引建议 + 查询场景）
-- 外键列 InnoDB 会自动建索引；以下为查询场景的组合索引
-- ============================================================
CREATE INDEX idx_txn_user_date     ON transaction (user_id, `date`);              -- 明细页 / 月度汇总
CREATE INDEX idx_txn_user_cat_date ON transaction (user_id, category_id, `date`); -- 分类占比 / 下钻
CREATE INDEX idx_txn_account       ON transaction (account_id);                   -- 账户余额实时计算
CREATE INDEX idx_category_parent   ON category (parent_id);                       -- 二级分类树
CREATE INDEX idx_budget_user       ON budget (user_id);                           -- 预算页加载

-- ============================================================
-- 3. 触发器（数据完整性，PRD 5.1 / 5.2 / 7.1）
-- 注意：MySQL 触发器语法与 SQLite 不同——无 WHEN 子句，
--      用 IF + SIGNAL；批量执行需 DELIMITER 切换结束符
-- ============================================================
DELIMITER $$

-- 3.1 交易与分类的一致性：类型必须匹配；二级必须挂在本一级之下
--    （SQLite 版用 IS NOT + WHEN，MySQL 改写为 IF + SIGNAL）
CREATE TRIGGER trg_txn_category_consistency
BEFORE INSERT ON transaction
FOR EACH ROW
BEGIN
    IF (SELECT type FROM category WHERE id = NEW.category_id) <> NEW.type
       OR (NEW.subcategory_id IS NOT NULL
           AND NOT EXISTS (
               SELECT 1 FROM category
                WHERE id = NEW.subcategory_id
                  AND type = NEW.type
                  AND parent_id = NEW.category_id
           ))
    THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '交易与分类的类型/层级不一致';
    END IF;
END$$

-- 3.2 交易更新时自动维护 updated_at（PRD 7.1）
--    （SQLite 版为 AFTER UPDATE 回写，MySQL 必须用 BEFORE UPDATE + SET NEW，
--     AFTER 阶段不允许再改本行）
CREATE TRIGGER trg_txn_touch_updated
BEFORE UPDATE ON transaction
FOR EACH ROW
BEGIN
    SET NEW.updated_at = NOW(3);
END$$

DELIMITER ;

-- ============================================================
-- 4. 种子数据：内置分类（全局共享，PRD 5.2 + 6.3.5 色板）
-- 显式主键 + INSERT IGNORE，脚本可重复执行
-- ============================================================

-- 4.1 支出一级分类（id 1~9，色值见 PRD 6.3.5）
INSERT IGNORE INTO category (id, name, type, parent_id, icon, color, sort_order) VALUES
    (1, '餐饮', 'expense', NULL, '🍜', '#e8752e', 1),
    (2, '交通', 'expense', NULL, '🚕', '#4292e8', 2),
    (3, '购物', 'expense', NULL, '🛒', '#9a5cd8', 3),
    (4, '居住', 'expense', NULL, '🏠', '#2ca257', 4),
    (5, '娱乐', 'expense', NULL, '🎮', '#e65697', 5),
    (6, '医疗', 'expense', NULL, '💊', '#d43f56', 6),
    (7, '教育', 'expense', NULL, '📚', '#17a091', 7),
    (8, '人情', 'expense', NULL, '🎁', '#c99510', 8),
    (9, '其他', 'expense', NULL, '📌', '#9d8392', 9);

-- 4.2 支出二级分类（id 101+，PRD 5.2）
INSERT IGNORE INTO category (id, name, type, parent_id, icon, color, sort_order) VALUES
    (101, '早餐',     'expense', 1, '🥐', '#e8752e', 1),
    (102, '午餐',     'expense', 1, '🍱', '#e8752e', 2),
    (103, '晚餐',     'expense', 1, '🍲', '#e8752e', 3),
    (104, '零食饮料', 'expense', 1, '🥤', '#e8752e', 4),
    (105, '外卖',     'expense', 1, '🛵', '#e8752e', 5),
    (106, '公交地铁', 'expense', 2, '🚇', '#4292e8', 1),
    (107, '打车',     'expense', 2, '🚖', '#4292e8', 2),
    (108, '加油',     'expense', 2, '⛽', '#4292e8', 3),
    (109, '停车',     'expense', 2, '🅿️', '#4292e8', 4),
    (110, '日用品',   'expense', 3, '🧻', '#9a5cd8', 1),
    (111, '服饰',     'expense', 3, '👕', '#9a5cd8', 2),
    (112, '数码',     'expense', 3, '💻', '#9a5cd8', 3),
    (113, '美妆',     'expense', 3, '💄', '#9a5cd8', 4),
    (114, '房租',     'expense', 4, '🔑', '#2ca257', 1),
    (115, '水电燃气', 'expense', 4, '💡', '#2ca257', 2),
    (116, '物业',     'expense', 4, '🏢', '#2ca257', 3),
    (117, '家居',     'expense', 4, '🛋️', '#2ca257', 4),
    (118, '电影演出', 'expense', 5, '🎬', '#e65697', 1),
    (119, '游戏',     'expense', 5, '🕹️', '#e65697', 2),
    (120, '会员订阅', 'expense', 5, '📺', '#e65697', 3),
    (121, '旅行',     'expense', 5, '✈️', '#e65697', 4),
    (122, '门诊',     'expense', 6, '🏥', '#d43f56', 1),
    (123, '药品',     'expense', 6, '💊', '#d43f56', 2),
    (124, '体检',     'expense', 6, '🩺', '#d43f56', 3),
    (125, '书籍',     'expense', 7, '📖', '#17a091', 1),
    (126, '课程',     'expense', 7, '🎓', '#17a091', 2),
    (127, '培训',     'expense', 7, '📝', '#17a091', 3),
    (128, '礼物',     'expense', 8, '🎀', '#c99510', 1),
    (129, '红包',     'expense', 8, '🧧', '#c99510', 2),
    (130, '请客',     'expense', 8, '🍻', '#c99510', 3);

-- 4.3 收入一级分类（id 10~14，PRD 5.2：V1.1 生效，预置不露出）
INSERT IGNORE INTO category (id, name, type, parent_id, icon, color, sort_order) VALUES
    (10, '工资',     'income', NULL, '💰', '#1a7a42', 1),
    (11, '奖金',     'income', NULL, '🏆', '#1a7a42', 2),
    (12, '理财收益', 'income', NULL, '📈', '#1a7a42', 3),
    (13, '退款',     'income', NULL, '↩️', '#1a7a42', 4),
    (14, '其他',     'income', NULL, '📌', '#9d8392', 5);

-- ============================================================
-- 5. 视图（支撑 PRD 5.4 统计分析）
-- ============================================================

-- 5.1 月度总览：按用户×自然月汇总（PRD 5.4 视图 1）
CREATE OR REPLACE VIEW v_monthly_summary AS
SELECT user_id,
       DATE_FORMAT(`date`, '%Y-%m')                              AS month,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)    AS total_expense,
       SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END)    AS total_income,
       COUNT(*)                                                  AS txn_count
  FROM transaction
 GROUP BY user_id, DATE_FORMAT(`date`, '%Y-%m');

-- 5.2 分类占比：支出按分类汇总 + 占比（PRD 5.4 视图 2，窗口函数需 MySQL 8.0+）
CREATE OR REPLACE VIEW v_category_share AS
SELECT t.user_id,
       DATE_FORMAT(t.`date`, '%Y-%m')                             AS month,
       c.id                                                       AS category_id,
       c.name                                                     AS category_name,
       c.color                                                    AS category_color,
       SUM(t.amount)                                              AS amount,
       ROUND(SUM(t.amount) * 100.0
             / SUM(SUM(t.amount)) OVER (PARTITION BY t.user_id, DATE_FORMAT(t.`date`, '%Y-%m')), 2) AS pct
  FROM transaction t
  JOIN category c ON c.id = t.category_id
 WHERE t.type = 'expense'
 GROUP BY t.user_id, DATE_FORMAT(t.`date`, '%Y-%m'), c.id, c.name, c.color;

-- 5.3 资金账户余额（V1.1）：初始余额 + 收入 − 支出（PRD 5.7 规则 2，实时计算不落库）
CREATE OR REPLACE VIEW v_account_balance AS
SELECT a.id,
       a.user_id,
       a.name,
       a.icon,
       a.sort_order,
       a.initial_balance
       + COALESCE((SELECT SUM(t.amount) FROM transaction t
                   WHERE t.account_id = a.id AND t.type = 'income'),  0)
       - COALESCE((SELECT SUM(t.amount) FROM transaction t
                   WHERE t.account_id = a.id AND t.type = 'expense'), 0) AS balance
  FROM account a
 WHERE a.is_active = 1;

-- ============================================================
-- 6. 用户级数据模板（应用在注册成功后执行，PRD 5.7 / 5.9）
-- 资金账户属于用户级数据，不作为全局种子；注册后按预置模板创建：
-- ============================================================
-- INSERT INTO account (user_id, name, icon, initial_balance, sort_order) VALUES
--     (:user_id, '微信',   'chat', 0, 1),
--     (:user_id, '支付宝', 'payments', 0, 2),
--     (:user_id, '现金',   'toll', 0, 3),
--     (:user_id, '银行卡', 'credit_card', 0, 4);
-- 注：icon 存 Material Symbols 图标名（前端渲染线性图标），非 emoji

-- ============================================================
-- 7. 验证查询（执行后可手工核对）
-- ============================================================
-- SELECT type, COUNT(*) FROM category GROUP BY type;                           -- 期望：expense=39, income=5
-- SELECT table_name, table_type FROM information_schema.tables
--  WHERE table_schema = 'jianji' ORDER BY table_name;                          -- 期望：7 表 + 3 视图
-- SELECT * FROM v_monthly_summary;                                             -- 无数据时返回空集
