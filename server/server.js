// ===== imports =====
import dotenv from "dotenv";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// 항상 server 디렉토리의 .env를 로드
dotenv.config({ path: path.join(__dirname, ".env") });

import express from "express";
import cors from "cors";
import multer from "multer";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import fs from "fs";
import crypto from "crypto";

import { pool } from "./db.js";
import { callClovaIdCard } from "./clova.js"; // CLOVA eKYC 함수

import oneWonRouter from "./src/_routes/onewon.js";
import signupRouter from "./src/_routes/signup.js";

import registryApickRouter from "./src/_routes/registry_apick.js";
import apickAccountRouter from "./src/_routes/apick_account.js";

// --- TEMP HOTFIX: legacy patcher guard ---
if (typeof globalThis.patchMethods !== "function") {
  globalThis.patchMethods = function patchMethods() { /* no-op */ };
}

// ===== env / app =====
const EKYC_TEST_MODE = String(process.env.EKYC_TEST_MODE || "").toLowerCase() === "true";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
app.set("trust proxy", 1);

// -----------------------------
// CORS & Body Parsers
// -----------------------------
// .env의 ALLOWED_ORIGINS가 있으면 우선 사용, 없으면 기본값 사용
const ENV_ALLOWED = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = ENV_ALLOWED.length ? ENV_ALLOWED : [
  "http://localhost:5174",
  "http://kailospay.cafe24.com",
  "https://kailospay.cafe24.com",
];

// 안전장치: 예외로 프로세스가 죽지 않게
process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));
process.on("uncaughtException", (err) => console.error("[uncaughtException]", err));

app.use(
  cors({
    origin(origin, cb) {
      // Origin이 없으면(예: curl, 서버-서버 통신) 허용
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-token", "X-Admin-Token", "X-Internal-Call"],
  })
);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Health
app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/healthz", (_req, res) => { res.set("Cache-Control", "no-store"); res.send("OK"); });
app.get("/readyz", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.set("Cache-Control", "no-store"); res.json({ ok: true }); }
  catch { res.set("Cache-Control", "no-store"); res.status(500).json({ ok: false, error: "db" }); }
});

// -----------------------------
// 업로드 디렉토리
// -----------------------------
const UPLOAD_DIR = path.join(__dirname, "uploads");
const AVATAR_DIR = path.join(UPLOAD_DIR, "avatars");
const CONTRACT_UPLOAD_DIR = path.join(UPLOAD_DIR, "contracts");
for (const d of [UPLOAD_DIR, AVATAR_DIR, CONTRACT_UPLOAD_DIR]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
app.use("/uploads/avatars", express.static(AVATAR_DIR, { maxAge: "7d" }));

// -----------------------------
// 인증/관리자 헬퍼
// -----------------------------
const isAdminRequest = (req) => {
  const v = (req.headers["x-admin-token"] || req.query.admin_token || "").trim();
  return v !== "" && v === (process.env.ADMIN_TOKEN || "");
};
const getJwtFromReq = (req) => {
  const fromHeader = req.headers.authorization?.split(" ")[1];
  const fromQuery = req.query.token;
  return (fromHeader || fromQuery || "").trim() || null;
};
function authRequired(req, res, next) {
  const token = getJwtFromReq(req);
  if (!token) return res.status(401).json({ ok: false, message: "인증 필요" });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ ok: false, message: "토큰 유효하지 않음" }); }
}
async function adminRequired(req, res, next) {
  try {
    if (!req.user?.id) return res.status(401).json({ ok: false, message: "인증 필요" });
    const { rows } = await pool.query("SELECT is_admin FROM users WHERE id=$1", [req.user.id]);
    if (!rows?.[0]?.is_admin) return res.status(403).json({ ok: false, message: "관리자 전용" });
    next();
  } catch (e) { console.error("adminRequired 오류", e); res.status(500).json({ ok: false, message: "서버 오류" }); }
}

// eKYC 이벤트 기록 헬퍼
async function insertEkycEvent({ userId, contractId = null, status, score = null, raw = null, provider = "clova", }) {
  try {
    await pool.query(
      `INSERT INTO ekyc_events (user_id, contract_id, kind, provider, status, score, raw, created_at)
       VALUES ($1, $2, 'idcard', $3, $4, $5, $6, now())`,
      [userId ?? null, contractId, provider, status, score, JSON.stringify(raw ?? {})]
    );
  } catch (e) { console.warn("ekyc_events insert warn:", e?.message || e); }
}

// -----------------------------
// Multer 설정
// -----------------------------
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
    filename: (req, file, cb) => { const ext = path.extname(file.originalname).toLowerCase(); cb(null, `${req.user.id}-${Date.now()}${ext}`); },
  }),
  fileFilter: (_req, file, cb) => { if (!/^image\/(png|jpe?g|webp)$/.test(file.mimetype)) return cb(new Error("이미지 파일만 업로드 가능합니다.")); cb(null, true); },
  limits: { fileSize: 2 * 1024 * 1024 },
});

const storage = multer.diskStorage({
  destination(_req, _file, cb) { cb(null, UPLOAD_DIR); },
  filename(_req, file, cb) {
    const safe = (file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-200);
    const name = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`;
    cb(null, name);
  },
});
const upload = multer({ storage, limits: { files: 10, fileSize: 10 * 1024 * 1024 } });

const signupEkycUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const ekycUpload = signupEkycUpload;
const reverifyUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// -----------------------------
// DB bootstrap
// -----------------------------
async function ensureTables() {
  try { await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`); }
  catch (e) { console.warn("[warn] pgcrypto 확장 생성 실패(무시):", e?.message || e); }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      full_name TEXT,
      phone TEXT,
      avatar TEXT,
      marketing_opt_in BOOLEAN DEFAULT FALSE,
      ekyc_status TEXT,
      account_status TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      ekyc_request_id TEXT,
      ekyc_verified_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS uploads (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      mime TEXT,
      size BIGINT NOT NULL,
      saved_name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ DEFAULT now(),
      status TEXT,
      admin_note TEXT,
      reviewed_at TIMESTAMPTZ,
      reviewer_id INTEGER REFERENCES users(id),
      category TEXT,
      doc_type TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_uploads_user_id ON uploads(user_id);
    CREATE INDEX IF NOT EXISTS idx_uploads_category ON uploads(category);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      order_id UUID NOT NULL UNIQUE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT,
      amount INTEGER NOT NULL,
      status TEXT NOT NULL,
      method TEXT,
      customer_name TEXT,
      email TEXT,
      phone TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contracts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      category TEXT,
      amount INTEGER,
      status TEXT NOT NULL DEFAULT 'draft',
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      rejected_reason TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_contracts_user_id ON contracts(user_id);
    CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contract_files (
      id SERIAL PRIMARY KEY,
      contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      original_name TEXT NOT NULL,
      mime TEXT,
      size BIGINT NOT NULL,
      saved_name TEXT NOT NULL UNIQUE,
      doc_type TEXT,
      status TEXT,
      admin_note TEXT,
      reviewer_id INTEGER REFERENCES users(id),
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_contract_files_contract_id ON contract_files(contract_id);
    CREATE INDEX IF NOT EXISTS idx_contract_files_status ON contract_files(status);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ekyc_events (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      contract_id INTEGER REFERENCES contracts(id) ON DELETE CASCADE,
      kind TEXT,
      provider TEXT,
      status TEXT,
      score NUMERIC,
      raw JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_ekyc_events_user ON ekyc_events(user_id, contract_id, created_at DESC);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS onewon_verifies (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      request_id TEXT,
      verify_type TEXT,
      code TEXT,
      bank_code TEXT,
      account_no TEXT,
      account_name TEXT,
      status TEXT,
      provider_raw JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      confirmed_at TIMESTAMPTZ
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='onewon_verifies' AND column_name='verified_at'
      ) THEN
        UPDATE onewon_verifies SET confirmed_at = COALESCE(confirmed_at, verified_at);
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS company_info (
      id               SERIAL PRIMARY KEY,
      name             TEXT,
      ceo              TEXT,
      biz_no           TEXT,
      address          TEXT,
      phone            TEXT,
      email            TEXT,
      mail_order_no    TEXT,
      updated_at       TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`
    INSERT INTO company_info (name)
    SELECT 'KailosPay'
    WHERE NOT EXISTS (SELECT 1 FROM company_info)
  `);

  // FAQ/Guide/Notice 카테고리
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_categories (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,             -- 'faq' | 'guide' | 'notice'
      name TEXT NOT NULL,
      sort INT DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_board_categories_kind ON board_categories(kind);
  `);

  // 공통 게시물 테이블(FAQ/Guide/Notice 공용)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_posts (
      id SERIAL PRIMARY KEY,
      kind TEXT NOT NULL,             -- 'faq' | 'guide' | 'notice'
      category_id INT REFERENCES board_categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      body TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_board_posts_kind ON board_posts(kind);
    CREATE INDEX IF NOT EXISTS idx_board_posts_category ON board_posts(category_id);
  `);
  

  // 서비스 카테고리(관리자 전용, 3개만 사용)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS service_categories (
      id          SERIAL PRIMARY KEY,
      slug        TEXT UNIQUE NOT NULL,         -- 'rent' | 'goods' | 'salary'
      name        TEXT NOT NULL,                -- 표시명
      banner_url  TEXT,                         -- (옵션) 배너 이미지 URL
      recurring   BOOLEAN DEFAULT FALSE,        -- 정기결제 여부
      docs_note   TEXT,                         -- 확인서류 안내
      sort_order  INT DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT now(),
      updated_at  TIMESTAMPTZ DEFAULT now()
    );
  `);
  

  // 3개 기본 카테고리 시드(중복 방지)
  await pool.query(`
    INSERT INTO service_categories (slug, name, sort_order)
    VALUES 
      ('rent',   '임대료/월세', 1),
      ('goods',  '물품대금',   2),
      ('salary', '급여',       3)
    ON CONFLICT (slug) DO NOTHING;
  `);

  await pool.query(`
  -- 등기부 발급 요청 저장 (APICK 전용, user_id는 테스트 편의상 NULL 허용)
  CREATE TABLE IF NOT EXISTS registry_requests (
    id         BIGSERIAL PRIMARY KEY,
    user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
    vendor     TEXT NOT NULL DEFAULT 'apick',
    address    TEXT,
    unique_key TEXT,
    ic_id      TEXT,
    status     TEXT,
    message    TEXT,
    cost_point INTEGER,
    pdf_saved  TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );

  -- 과금/중복 방지를 위한 키들
  CREATE INDEX IF NOT EXISTS idx_registry_unique_key ON registry_requests(unique_key);
  CREATE INDEX IF NOT EXISTS idx_registry_ic_id     ON registry_requests(ic_id);
`);

  
}

// 보정: 기본 카테고리의 이름/정렬/필수값을 보장(존재는 ensureTables에서 이미 보장)
async function ensureServiceCategories() {
  const base = [
    { slug: 'rent', name: '임대료/월세', sort_order: 1 },
    { slug: 'goods', name: '물품대금', sort_order: 2 },
    { slug: 'salary', name: '급여', sort_order: 3 },
  ];
  for (const b of base) {
    await pool.query(
      `INSERT INTO service_categories (slug, name, sort_order)
         VALUES ($1,$2,$3)
       ON CONFLICT (slug)
         DO UPDATE SET
           name = EXCLUDED.name,
           sort_order = EXCLUDED.sort_order,
           updated_at = now()`,
      [b.slug, b.name, b.sort_order]
    );
  }
}

// -----------------------------
// Debug
// -----------------------------
app.get("/api/ping", (_req, res) => res.json({ ok: true }));
app.get("/api/_debug/db", async (_req, res) => {
  try {
    const { rows: db } = await pool.query("SELECT current_database() AS db");
    const { rows: c } = await pool.query("SELECT COUNT(*)::int AS cnt FROM uploads");
    res.json({ ok: true, db: db[0].db, uploads_count: c[0].cnt, env_db: process.env.PGDATABASE });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, message: "debug error" }); }
});

// -----------------------------
// Auth (회원가입 = eKYC 필수)
// -----------------------------
app.post("/api/signup", signupEkycUpload.single("idcard"), async (req, res) => {
  try {
    // 1) 입력값 정규화
    let { name, email, password, phone } = req.body ?? {};
    name = (name || "").trim();
    email = (email || "").trim().toLowerCase();
    password = String(password || "");

    if (!name || !email || !password || !req.file) {
      return res.status(400).json({ ok: false, message: "필수 항목 누락(이름/이메일/비번/신분증)" });
    }

    // 2) 전화번호 형식 검사
    const phoneNorm = phone ? String(phone).replace(/[-\s]/g, "") : null;
    if (phoneNorm && !/^\+?\d{9,15}$/.test(phoneNorm)) {
      return res.status(400).json({ ok: false, message: "연락처 형식을 확인하세요." });
    }

    // 3) 비밀번호 해시
    const hashed = await bcrypt.hash(password, 10);

    // 4) eKYC 호출
    const { verified, raw, score, state } = await callClovaIdCard(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // eKYC 이벤트 기록(회원 미생성 단계라 user_id: null)
    await insertEkycEvent({
      userId: null,
      status: verified ? "verified" : "unverified",
      score: score ?? null,
      raw,
      provider: "clova",
    });

    if (!verified) {
      return res.status(400).json({
        ok: false,
        message: "신분증 인증 실패",
        state,        // e.g. NOT_VERIFIED, REJECTED 등
        score,
        // 원인 파악용(운영 전용) - 필요 시 주석 처리 가능
        detail: raw?.message || raw?.error || raw,
      });
    }

    // 5) 가입 저장
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, phone, ekyc_status)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, email, phone, ekyc_status`,
      [name, email, hashed, phoneNorm, "verified"]
    );

    return res.json({ ok: true, user: rows[0] });
  } catch (e) {
    console.error("signup+ekyc 오류:", e?.response?.data || e);
    const msg = String(e?.message || "");
    if (msg.includes("duplicate key")) {
      return res.status(409).json({ ok: false, message: "이미 가입된 이메일입니다." });
    }
    return res.status(500).json({ ok: false, message: "회원가입 실패" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    const { rows } = await pool.query("SELECT id, email, password FROM users WHERE email=$1", [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ ok: false, message: "이메일 또는 비밀번호 오류" });
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || "1d" });
    res.json({ ok: true, token });
  } catch (e) { console.error("login error", e); res.status(500).json({ ok: false, message: "로그인 실패" }); }
});

app.get("/api/me", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT id,name,email,is_admin FROM users WHERE id=$1", [req.user.id]);
    res.json({ ok: true, user: rows[0] });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, message: "사용자 조회 실패" }); }
});

// 1원인증/온보딩 라우터
app.use("/api/onewon", oneWonRouter);
app.use("/api/onboarding", signupRouter);

// 에이픽api
if (String(process.env.REGISTRY_VENDOR || "").toLowerCase() === "apick") {
  app.use("/api/registry/apick", registryApickRouter);
  app.use("/api/apick/account", apickAccountRouter);
}

// -----------------------------
// Profile & Avatar
// -----------------------------
app.get("/api/me/profile", authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, email, full_name, phone, avatar, marketing_opt_in, ekyc_status, account_status
       FROM users WHERE id=$1`, [req.user.id]
  );
  return res.json({ ok: true, user: rows[0] });
});
app.put("/api/me/profile", authRequired, async (req, res) => {
  const { full_name, phone, marketing_opt_in } = req.body ?? {};
  if (phone && !/^\+?\d{9,15}$/.test(String(phone).replace(/[-\s]/g, "")))
    return res.status(400).json({ ok: false, message: "전화번호 형식을 확인하세요." });
  await pool.query(
    `UPDATE users SET
      full_name = COALESCE($2, full_name),
      phone = COALESCE($3, phone),
      marketing_opt_in = COALESCE($4, marketing_opt_in)
     WHERE id=$1`,
    [req.user.id, full_name ?? null, phone ?? null, marketing_opt_in ?? null]
  );
  return res.json({ ok: true });
});
app.post("/api/me/avatar", authRequired, avatarUpload.single("avatar"), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, message: "파일이 없습니다." });
  const { rows } = await pool.query(`SELECT avatar FROM users WHERE id=$1`, [req.user.id]);
  const prev = rows?.[0]?.avatar;
  if (prev) {
    const prevPath = path.join(AVATAR_DIR, path.basename(prev));
    fs.existsSync(prevPath) && fs.unlink(prevPath, (err) => { if (err) console.warn("avatar cleanup error:", err.message || err); });
  }
  await pool.query(`UPDATE users SET avatar=$2 WHERE id=$1`, [req.user.id, req.file.filename]);
  return res.json({ ok: true, url: `/uploads/avatars/${req.file.filename}` });
});

// 인증 상태 종합
app.get("/api/verifications/me", authRequired, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ekyc_status, account_status,
            EXISTS(SELECT 1 FROM uploads WHERE user_id=$1 AND status='approved') AS has_doc
     FROM users WHERE id=$1`, [req.user.id]
  );
  const u = rows[0] || {};
  const verified = u.ekyc_status === "verified" && u.account_status === "verified" && u.has_doc;
  return res.json({ ok: true, ekyc: u.ekyc_status ?? "unverified", account: u.account_status ?? "unverified", document: Boolean(u.has_doc), verified_for_payment: verified });
});

// -----------------------------
// Uploads (공용/내 목록)
// -----------------------------
app.get("/api/uploads", async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.user_id, u.original_name, u.mime, u.size, u.saved_name, u.created_at,
             u.admin_note, CASE WHEN u.status IS NOT NULL THEN TRUE ELSE FALSE END AS reviewed, u.status
        FROM uploads u
       ORDER BY u.created_at DESC`);
    res.json({ ok: true, uploads: rows });
  } catch (e) { console.error("업로드 목록 조회 실패:", e); res.status(500).json({ ok: false, message: "서버 오류" }); }
});
app.get("/api/uploads/my", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.original_name, u.mime, u.size, u.saved_name, u.created_at,
              u.admin_note, CASE WHEN u.status IS NOT NULL THEN TRUE ELSE FALSE END AS reviewed, u.status
         FROM uploads u WHERE u.user_id=$1 ORDER BY u.created_at DESC`, [req.user.id]
    );
    res.json({ ok: true, uploads: rows });
  } catch (e) { console.error(e); res.status(500).json({ ok: false, message: "업로드 목록 조회 실패" }); }
});

// 내부 헬퍼: 파일 메타 조회
async function getFileRow(savedName) {
  const { rows } = await pool.query(
    `SELECT id, user_id, original_name, saved_name, mime, size FROM uploads WHERE saved_name=$1 LIMIT 1`,
    [savedName]
  );
  return rows[0] || null;
}

// 미리보기/다운로드 (본인/관리자)
app.get("/api/uploads/preview/:filename", async (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    const row = await getFileRow(safe);
    if (!row) return res.status(404).send("파일 없음");

    if (isAdminRequest(req)) {
      const full = path.join(UPLOAD_DIR, row.saved_name);
      if (!fs.existsSync(full)) return res.status(404).send("파일 없음");
      if (row.mime) res.type(row.mime);
      return res.sendFile(full);
    }

    const token = getJwtFromReq(req);
    if (!token) return res.status(401).send("인증 필요");
    let decoded; try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).send("토큰 유효하지 않음"); }

    if (row.user_id !== decoded.id) {
      const { rows: urows } = await pool.query("SELECT is_admin FROM users WHERE id=$1", [decoded.id]);
      if (!urows?.[0]?.is_admin) return res.status(403).send("권한 없음");
    }

    const full = path.join(UPLOAD_DIR, row.saved_name);
    if (!fs.existsSync(full)) return res.status(404).send("파일 없음");
    if (row.mime) res.type(row.mime);
    return res.sendFile(full);
  } catch (e) { console.error(e); res.status(500).send("미리보기 오류"); }
});
app.get("/api/uploads/download/:filename", async (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    const row = await getFileRow(safe);
    if (!row) return res.status(404).send("파일 없음");

    if (isAdminRequest(req)) {
      const full = path.join(UPLOAD_DIR, row.saved_name);
      if (!fs.existsSync(full)) return res.status(404).send("파일 없음");
      return res.download(full, row.original_name);
    }

    const token = getJwtFromReq(req);
    if (!token) return res.status(401).send("인증 필요");
    let decoded; try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).send("토큰 유효하지 않음"); }

    const full = path.join(UPLOAD_DIR, row.saved_name);
    if (row.user_id !== decoded.id) {
      const { rows: urows } = await pool.query("SELECT is_admin FROM users WHERE id=$1", [decoded.id]);
      if (!urows?.[0]?.is_admin) return res.status(403).send("권한 없음");
    }
    if (!fs.existsSync(full)) return res.status(404).send("파일 없음");
    return res.download(full, row.original_name);
  } catch (e) { console.error(e); res.status(500).send("다운로드 오류"); }
});

// -----------------------------
// Admin APIs (JWT 관리자) - 업로드
// -----------------------------
app.get("/api/admin/uploads", authRequired, adminRequired, async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.user_id, u.original_name, u.saved_name, u.mime, u.size, u.created_at,
             u.admin_note, CASE WHEN u.status IS NOT NULL THEN TRUE ELSE FALSE END AS reviewed,
             u.status, u.category, u.doc_type,
             us.name  AS user_name, us.email AS user_email,
             ru.name  AS reviewer_name
        FROM uploads u
        LEFT JOIN users us ON u.user_id = us.id
        LEFT JOIN users ru ON u.reviewer_id = ru.id
       ORDER BY u.created_at DESC`);
    res.json({ ok: true, uploads: rows });
  } catch (e) { console.error("관리자 업로드 목록 오류:", e); res.status(500).json({ ok: false, message: "서버 오류" }); }
});
app.patch("/api/admin/uploads/:id/review", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  const { reviewed, note } = req.body ?? {};
  try {
    const { rows: curRows } = await pool.query("SELECT status, reviewed_at FROM uploads WHERE id = $1", [id]);
    if (curRows.length === 0) return res.status(404).json({ ok: false, message: "없음" });

    let newStatus = curRows[0].status;
    if (newStatus === null && reviewed === true) newStatus = "done";
    if (newStatus === "done" && reviewed === false) newStatus = null;

    await pool.query(
      `UPDATE uploads
         SET status = $1,
             admin_note = $2,
             reviewed_at = CASE WHEN $1 IS NULL THEN NULL ELSE COALESCE(reviewed_at, now()) END,
             reviewer_id = CASE WHEN $1 IS NULL THEN NULL ELSE $3 END
       WHERE id = $4`,
      [newStatus, note ?? null, req.user.id, id]
    );
    res.json({ ok: true });
  } catch (e) { console.error("리뷰 저장 오류:", e); res.status(500).json({ ok: false, message: "서버 오류" }); }
});
app.post("/api/admin/uploads/:id/approve", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: "유효하지 않은 ID" });
  try { await pool.query("UPDATE uploads SET status = 'approved', reviewed_at = now(), reviewer_id = $2 WHERE id = $1", [id, req.user.id]); return res.json({ ok: true }); }
  catch (e) { console.error("승인 오류", e); return res.status(500).json({ ok: false, message: "승인 처리 실패" }); }
});
app.post("/api/admin/uploads/:id/reject", authRequired, adminRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: "유효하지 않은 ID" });
  try { await pool.query("UPDATE uploads SET status = 'rejected', reviewed_at = now(), reviewer_id = $2 WHERE id = $1", [id, req.user.id]); return res.json({ ok: true }); }
  catch (e) { console.error("거절 오류", e); return res.status(500).json({ ok: false, message: "거절 처리 실패" }); }
});

// ============================
// Admin: Users list & delete
// ============================
app.get("/api/admin/users", authRequired, adminRequired, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10)));
    const offset = (page - 1) * limit;

    const params = [];
    let where = "WHERE 1=1";
    if (q) {
      const asId = /^\d+$/.test(q) ? Number(q) : null;
      if (asId != null) {
        params.push(`%${q}%`, `%${q}%`, `%${q}%`, asId);
        where += ` AND (name ILIKE $1 OR email ILIKE $2 OR COALESCE(phone,'') ILIKE $3 OR id = $4)`;
      } else {
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        where += ` AND (name ILIKE $1 OR email ILIKE $2 OR COALESCE(phone,'') ILIKE $3)`;
      }
    }

    const countSql = `SELECT COUNT(*)::int AS cnt FROM users ${where}`;
    const { rows: c } = await pool.query(countSql, params);
    const total = c[0]?.cnt ?? 0;

    const listSql = `
      SELECT id, name, email, phone, is_admin, created_at
      FROM users
      ${where}
      ORDER BY id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const { rows } = await pool.query(listSql, params);

    res.json({ ok: true, users: rows, total, page, limit });
  } catch (e) {
    console.error("admin users list error:", e);
    res.status(500).json({ ok: false, message: "사용자 목록 조회 실패" });
  }
});

app.delete("/api/admin/users/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "유효하지 않은 ID" });

    // 본인 계정 삭제 방지
    if (req.user?.id === id) {
      return res.status(400).json({ ok: false, message: "본인 계정은 삭제할 수 없습니다." });
    }

    const { rows: chk } = await pool.query("SELECT id FROM users WHERE id=$1", [id]);
    if (!chk.length) return res.status(404).json({ ok: false, message: "사용자 없음" });

    await pool.query("DELETE FROM users WHERE id=$1", [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("admin user delete error:", e);
    res.status(500).json({ ok: false, message: "삭제 실패" });
  }
});

// ============================
// Admin: Company
// ============================
app.get("/api/admin/company", authRequired, adminRequired, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, ceo, biz_no, address, phone, email, mail_order_no, updated_at
         FROM company_info
        ORDER BY id ASC
        LIMIT 1`
    );
    res.json({ ok: true, company: rows[0] || null });
  } catch (e) {
    console.error("company:get", e);
    res.status(500).json({ ok: false, message: "조회 실패" });
  }
});

app.put("/api/admin/company", authRequired, adminRequired, async (req, res) => {
  try {
    const { name, ceo, biz_no, address, phone, email, mail_order_no } = req.body ?? {};

    // 간단 검증
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ ok: false, message: "이메일 형식을 확인하세요." });
    }
    const phoneNorm = phone ? String(phone).replace(/[-\s]/g, "") : null;
    if (phoneNorm && !/^\+?\d{7,15}$/.test(phoneNorm)) {
      return res.status(400).json({ ok: false, message: "전화번호 형식을 확인하세요." });
    }

    // 단일 행 업데이트 (없으면 생성)
    const { rows: cur } = await pool.query(`SELECT id FROM company_info ORDER BY id ASC LIMIT 1`);
    if (cur.length === 0) {
      await pool.query(
        `INSERT INTO company_info (name, ceo, biz_no, address, phone, email, mail_order_no, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now())`,
        [name ?? null, ceo ?? null, biz_no ?? null, address ?? null, phoneNorm ?? null, email ?? null, mail_order_no ?? null]
      );
    } else {
      await pool.query(
        `UPDATE company_info
            SET name=$2, ceo=$3, biz_no=$4, address=$5, phone=$6, email=$7, mail_order_no=$8, updated_at=now()
          WHERE id=$1`,
        [cur[0].id, name ?? null, ceo ?? null, biz_no ?? null, address ?? null, phoneNorm ?? null, email ?? null, mail_order_no ?? null]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("company:update", e);
    res.status(500).json({ ok: false, message: "저장 실패" });
  }
});

// ============================
// Admin: Service Categories (3개 전용)
// ============================
app.get("/api/admin/service-categories", authRequired, adminRequired, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT slug, name, banner_url, recurring, docs_note, sort_order, updated_at
         FROM service_categories
        WHERE slug IN ('rent','goods','salary')
        ORDER BY sort_order ASC, id ASC`
    );
    res.json({ ok: true, categories: rows });
  } catch (e) {
    console.error("svc-categories:list", e);
    res.status(500).json({ ok: false, message: "목록 조회 실패" });
  }
});

app.put("/api/admin/service-categories/:slug", authRequired, adminRequired, async (req, res) => {
  try {
    const slug = String(req.params.slug || "").trim();
    if (!["rent", "goods", "salary"].includes(slug)) {
      return res.status(400).json({ ok: false, message: "허용되지 않은 카테고리" });
    }

    const { name, banner_url, recurring, docs_note } = req.body ?? {};

    // 간단 검증
    if (name != null && String(name).trim() === "") {
      return res.status(400).json({ ok: false, message: "표시명을 입력하세요." });
    }
    if (banner_url && !/^https?:\/\//i.test(String(banner_url))) {
      return res.status(400).json({ ok: false, message: "배너 URL은 http(s)여야 합니다." });
    }

    // 업데이트 (필드별 COALESCE)
    const { rows } = await pool.query(
      `UPDATE service_categories
          SET name       = COALESCE($2, name),
              banner_url = COALESCE($3, banner_url),
              recurring  = COALESCE($4, recurring),
              docs_note  = COALESCE($5, docs_note),
              updated_at = now()
        WHERE slug = $1
        RETURNING slug, name, banner_url, recurring, docs_note, sort_order, updated_at`,
      [
        slug,
        name == null ? null : String(name),
        banner_url == null ? null : String(banner_url),
        typeof recurring === "boolean" ? recurring : null,
        docs_note == null ? null : String(docs_note),
      ]
    );

    if (rows.length === 0) {
      // 혹시 누락되어 있다면 생성(upsert)
      const { rows: ins } = await pool.query(
        `INSERT INTO service_categories (slug, name, banner_url, recurring, docs_note, sort_order, updated_at)
         VALUES ($1, COALESCE($2,''),
                 $3, COALESCE($4,false),
                 $5,
                 CASE WHEN $1='rent' THEN 1 WHEN $1='goods' THEN 2 ELSE 3 END,
                 now())
         RETURNING slug, name, banner_url, recurring, docs_note, sort_order, updated_at`,
        [
          slug,
          name == null ? '' : String(name),
          banner_url == null ? null : String(banner_url),
          typeof recurring === "boolean" ? recurring : false,
          docs_note == null ? null : String(docs_note),
        ]
      );
      return res.json({ ok: true, category: ins[0] });
    }

    res.json({ ok: true, category: rows[0] });
  } catch (e) {
    console.error("svc-categories:update", e);
    res.status(500).json({ ok: false, message: "저장 실패" });
  }
});

// ============================
// Admin: Payment Requests (list & delete)
// ============================
app.get("/api/admin/payments", authRequired, adminRequired, async (req, res) => {
  try {
    const status = String(req.query.status || "").trim();
    const method = String(req.query.method || "").trim();
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10)));
    const offset = (page - 1) * limit;

    const params = [];
    let where = "WHERE 1=1";

    if (status) { params.push(status); where += ` AND status = $${params.length}`; }
    if (method) { params.push(method); where += ` AND COALESCE(method,'') = $${params.length}`; }

    if (q) {
      const isUuidLike = /^[0-9a-f-]{8,}$/i.test(q);
      if (isUuidLike) {
        params.push(q); const pOrder = params.length;
        params.push(`%${q}%`); const p1 = params.length;
        params.push(`%${q}%`); const p2 = params.length;
        params.push(`%${q}%`); const p3 = params.length;
        params.push(`%${q}%`); const p4 = params.length;
        where += ` AND (order_id = $${pOrder}
                     OR title ILIKE $${p1}
                     OR COALESCE(customer_name,'') ILIKE $${p2}
                     OR COALESCE(email,'') ILIKE $${p3}
                     OR COALESCE(phone,'') ILIKE $${p4})`;
      } else {
        params.push(`%${q}%`); const p1 = params.length;
        params.push(`%${q}%`); const p2 = params.length;
        params.push(`%${q}%`); const p3 = params.length;
        params.push(`%${q}%`); const p4 = params.length;
        where += ` AND (title ILIKE $${p1}
                     OR COALESCE(customer_name,'') ILIKE $${p2}
                     OR COALESCE(email,'') ILIKE $${p3}
                     OR COALESCE(phone,'') ILIKE $${p4})`;
      }
    }

    const { rows: c } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM payments ${where}`,
      params
    );
    const total = c[0]?.cnt ?? 0;

    const listSql = `
      SELECT id, order_id, user_id, title, amount, status, method,
             customer_name, email, phone, created_at, updated_at
        FROM payments
        ${where}
        ORDER BY id DESC
        LIMIT ${limit} OFFSET ${offset}
    `;
    const { rows } = await pool.query(listSql, params);

    res.json({ ok: true, payments: rows, total, page, limit });
  } catch (e) {
    console.error("admin payments list error:", e);
    res.status(500).json({ ok: false, message: "결제 요청 목록 조회 실패" });
  }
});

app.delete("/api/admin/payments/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "유효하지 않은 ID" });

    const { rows } = await pool.query(`SELECT id FROM payments WHERE id=$1`, [id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: "데이터 없음" });

    await pool.query(`DELETE FROM payments WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("admin payments delete error:", e);
    res.status(500).json({ ok: false, message: "삭제 실패" });
  }
});

// ============================
// Admin: Board Categories
// ============================
app.get("/api/admin/board/categories", authRequired, adminRequired, async (req, res) => {
  try {
    const kind = String(req.query.kind || "").trim(); // faq | guide | notice
    const { rows } = await pool.query(
      `SELECT id, kind, name, sort, created_at
         FROM board_categories
        WHERE ($1 = '' OR kind = $1)
        ORDER BY sort ASC, id ASC`,
      [kind]
    );
    res.json({ ok: true, categories: rows });
  } catch (e) {
    console.error("categories:list", e);
    res.status(500).json({ ok: false, message: "카테고리 조회 실패" });
  }
});

app.post("/api/admin/board/categories", authRequired, adminRequired, async (req, res) => {
  try {
    const { id, kind, name, sort } = req.body ?? {};
    if (!kind || !name) return res.status(400).json({ ok: false, message: "kind, name 필수" });

    if (id) {
      await pool.query(
        `UPDATE board_categories SET kind=$2, name=$3, sort=COALESCE($4,sort) WHERE id=$1`,
        [id, kind, name, sort ?? null]
      );
    } else {
      await pool.query(
        `INSERT INTO board_categories (kind, name, sort) VALUES ($1,$2,COALESCE($3,0))`,
        [kind, name, sort ?? 0]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("categories:save", e);
    res.status(500).json({ ok: false, message: "카테고리 저장 실패" });
  }
});

app.delete("/api/admin/board/categories/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID 오류" });
    await pool.query(`DELETE FROM board_categories WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("categories:delete", e);
    res.status(500).json({ ok: false, message: "카테고리 삭제 실패" });
  }
});

// ============================
// Admin: Board Posts (FAQ/Guide/Notice 공용)
// ============================
app.get("/api/admin/board/posts", authRequired, adminRequired, async (req, res) => {
  try {
    const kind = String(req.query.kind || "").trim();
    const categoryId = Number(req.query.category_id || 0);
    const q = String(req.query.q || "").trim();
    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || "50"), 10)));
    const offset = (page - 1) * limit;

    const params = [];
    let where = "WHERE 1=1";

    if (kind) { params.push(kind); where += ` AND kind = $${params.length}`; }
    if (categoryId) { params.push(categoryId); where += ` AND category_id = $${params.length}`; }
    if (q) {
      params.push(`%${q}%`); const p1 = params.length;
      params.push(`%${q}%`); const p2 = params.length;
      where += ` AND (title ILIKE $${p1} OR COALESCE(body,'') ILIKE $${p2})`;
    }

    const { rows: c } = await pool.query(`SELECT COUNT(*)::int AS cnt FROM board_posts ${where}`, params);
    const total = c[0]?.cnt ?? 0;

    const listSql = `
      SELECT p.id, p.kind, p.category_id, p.title, p.body, p.created_at, p.updated_at,
             c.name AS category_name
        FROM board_posts p
        LEFT JOIN board_categories c ON c.id = p.category_id
        ${where}
        ORDER BY p.id DESC
        LIMIT ${limit} OFFSET ${offset}
    `;
    const { rows } = await pool.query(listSql, params);
    res.json({ ok: true, posts: rows, total, page, limit });
  } catch (e) {
    console.error("posts:list", e);
    res.status(500).json({ ok: false, message: "게시물 조회 실패" });
  }
});

app.post("/api/admin/board/posts", authRequired, adminRequired, async (req, res) => {
  try {
    const { id, kind, category_id, title, body } = req.body ?? {};
    if (!kind || !title) return res.status(400).json({ ok: false, message: "kind, title 필수" });

    if (id) {
      await pool.query(
        `UPDATE board_posts
            SET kind=$2, category_id=$3, title=$4, body=$5, updated_at=now()
          WHERE id=$1`,
        [id, kind, category_id || null, title, body ?? null]
      );
    } else {
      await pool.query(
        `INSERT INTO board_posts (kind, category_id, title, body)
         VALUES ($1,$2,$3,$4)`,
        [kind, category_id || null, title, body ?? null]
      );
    }
    res.json({ ok: true });
  } catch (e) {
    console.error("posts:save", e);
    res.status(500).json({ ok: false, message: "게시물 저장 실패" });
  }
});

app.delete("/api/admin/board/posts/:id", authRequired, adminRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok: false, message: "ID 오류" });
    await pool.query(`DELETE FROM board_posts WHERE id=$1`, [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error("posts:delete", e);
    res.status(500).json({ ok: false, message: "게시물 삭제 실패" });
  }
});

// -----------------------------
// Rent (임대료/월세)
// -----------------------------
app.post("/api/rent/docs", authRequired, upload.array("files", 10), async (req, res) => {
  try {
    const files = req.files ?? [];
    if (!files.length) return res.status(400).json({ ok: false, message: "파일 없음" });

    const docType = req.body?.doc_type || null;
    const items = [];
    for (const f of files) {
      const { rows } = await pool.query(
        `INSERT INTO uploads (user_id, original_name, mime, size, saved_name, category, doc_type, status)
         VALUES ($1,$2,$3,$4,$5,'rent',$6,'pending')
         RETURNING id, user_id, original_name, mime, size, saved_name, created_at, status, doc_type`,
        [req.user.id, f.originalname, f.mimetype, f.size, f.filename, docType]
      );
      items.push(rows[0]);
    }
    res.json({ ok: true, items });
  } catch (e) { console.error("rent/docs 오류:", e); res.status(500).json({ ok: false, message: "업로드 실패" }); }
});
app.get("/api/rent/docs/my", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, original_name, mime, size, saved_name, created_at, status, doc_type
         FROM uploads WHERE user_id=$1 AND category='rent' ORDER BY created_at DESC`, [req.user.id]
    );
    res.json({ ok: true, uploads: rows });
  } catch (e) { console.error("rent/docs/my 오류:", e); res.status(500).json({ ok: false, message: "목록 조회 실패" }); }
});
app.post("/api/rent/ekyc", authRequired, signupEkycUpload.single("idcard"), async (req, res) => {
  try {
    if (EKYC_TEST_MODE) {
      await pool.query(`UPDATE users SET ekyc_status='verified', ekyc_verified_at=COALESCE(ekyc_verified_at, now()) WHERE id=$1`, [req.user.id]);
      await insertEkycEvent({ userId: req.user.id, status: "verified", provider: "test", raw: { testMode: true } });
      return res.json({ ok: true, ekyc: "verified", testMode: true });
    }
    if (!req.file) return res.status(400).json({ ok: false, message: "파일이 없습니다." });

    const { verified, raw, score, state } = await callClovaIdCard(req.file.buffer, req.file.originalname, req.file.mimetype);
    await pool.query(`UPDATE users SET ekyc_status=$2 WHERE id=$1`, [req.user.id, verified ? "verified" : "unverified"]);
    await insertEkycEvent({ userId: req.user.id, status: verified ? "verified" : "unverified", score: score ?? null, raw: { ...raw, state }, provider: "clova" });
    return res.json({ ok: true, ekyc: verified ? "verified" : "unverified", state, score });
  } catch (e) { console.error("rent/ekyc 오류:", e); res.status(500).json({ ok: false, message: "eKYC 실패" }); }
});

// 결제 전 요건 체크
app.get("/api/can-pay", authRequired, async (req, res) => {
  try {
    const { rows: doc } = await pool.query(
      `SELECT 1 FROM uploads WHERE user_id=$1 AND category='rent' AND status='approved' LIMIT 1`, [req.user.id]
    );
    const { rows: u } = await pool.query(`SELECT ekyc_status FROM users WHERE id=$1`, [req.user.id]);
    if (!doc.length) return res.json({ ok: true, canPay: false, message: "임대료/월세 서류 승인 후 결제 가능" });
    if ((u[0]?.ekyc_status || "") !== "verified") return res.json({ ok: true, canPay: false, message: "신분증 인증이 필요합니다." });
    return res.json({ ok: true, canPay: true });
  } catch (e) { console.error("can-pay 오류", e); res.status(500).json({ ok: false, message: "서버 오류" }); }
});
app.post("/api/payments/create", authRequired, async (req, res) => {
  const { title, amount, method, customer_name, email, phone } = req.body ?? {};
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0 || !method)
    return res.status(400).json({ ok: false, message: "필수 항목 누락 또는 금액 형식 오류" });
  try {
    const { rows: doc } = await pool.query(
      `SELECT 1 FROM uploads WHERE user_id=$1 AND category='rent' AND status='approved' LIMIT 1`, [req.user.id]
    );
    const { rows: u } = await pool.query(`SELECT ekyc_status FROM users WHERE id=$1`, [req.user.id]);
    if (!doc.length || (u[0]?.ekyc_status || "") !== "verified")
      return res.status(403).json({ ok: false, message: "결제 전 요건(서류 승인/신분증 인증) 필요" });

    const orderId = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO payments
        (order_id, user_id, title, amount, status, method, customer_name, email, phone, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8, now(), now())
       RETURNING *`,
      [orderId, req.user.id, title ?? "임대료/월세 결제", amt, method, customer_name ?? null, email ?? null, phone ?? null]
    );
    return res.json({ ok: true, payment: result.rows[0] });
  } catch (e) { console.error("결제 생성 오류", e); return res.status(500).json({ ok: false, message: "결제 생성 실패" }); }
});

/* =========================================================
   계약/문서/인증/제출 API
   ========================================================= */
// 1) 계약 CRUD
app.post("/api/contracts", authRequired, async (req, res) => {
  try {
    const { title, category, amount } = req.body ?? {};
    if (!title) return res.status(400).json({ ok: false, message: "title 필수" });
    const amt = amount == null ? null : Number(amount);
    const { rows } = await pool.query(
      `INSERT INTO contracts (user_id, title, category, amount, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'draft', now(), now()) RETURNING *`,
      [req.user.id, title, category ?? null, Number.isFinite(amt) ? amt : null]
    );
    res.json({ ok: true, contract: rows[0] });
  } catch (e) { console.error("contracts:create", e); res.status(500).json({ ok: false, message: "생성 실패" }); }
});
app.get("/api/contracts/my", authRequired, async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM contracts WHERE user_id=$1 ORDER BY created_at DESC`, [req.user.id]);
    res.json({ ok: true, contracts: rows });
  } catch (e) { console.error("contracts:list", e); res.status(500).json({ ok: false, message: "조회 실패" }); }
});
app.get("/api/contracts/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: "id 오류" });
  try {
    const { rows } = await pool.query(`SELECT * FROM contracts WHERE id=$1 AND user_id=$2`, [id, req.user.id]);
    if (!rows.length) return res.status(404).json({ ok: false, message: "없음" });
    res.json({ ok: true, contract: rows[0] });
  } catch (e) { console.error("contracts:get", e); res.status(500).json({ ok: false, message: "조회 실패" }); }
});
app.put("/api/contracts/:id", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: "id 오류" });
  const { title, category, amount } = req.body ?? {};
  const amt = amount == null ? null : Number(amount);
  try {
    const { rows: cur } = await pool.query(`SELECT status FROM contracts WHERE id=$1 AND user_id=$2`, [id, req.user.id]);
    if (!cur.length) return res.status(404).json({ ok: false, message: "없음" });
    if (!["draft", "rejected"].includes(cur[0].status))
      return res.status(409).json({ ok: false, message: "현재 상태에서 수정 불가" });
    await pool.query(
      `UPDATE contracts SET
         title = COALESCE($3, title),
         category = COALESCE($4, category),
         amount = COALESCE($5, amount),
         updated_at = now()
       WHERE id=$1 AND user_id=$2`,
      [id, req.user.id, title ?? null, category ?? null, Number.isFinite(amt) ? amt : null]
    );
    res.json({ ok: true });
  } catch (e) { console.error("contracts:update", e); res.status(500).json({ ok: false, message: "수정 실패" }); }
});
app.post("/api/contracts/:id/submit", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: "id 오류" });
  try {
    const { rows: own } = await pool.query(`SELECT status FROM contracts WHERE id=$1 AND user_id=$2`, [id, req.user.id]);
    if (!own.length) return res.status(404).json({ ok: false, message: "없음" });
    if (!["draft", "rejected"].includes(own[0].status))
      return res.status(409).json({ ok: false, message: "현재 상태에서 제출 불가" });

    const { rows: files } = await pool.query(`SELECT COUNT(*)::int AS cnt FROM contract_files WHERE contract_id=$1`, [id]);
    if ((files[0]?.cnt ?? 0) < 1) return res.status(400).json({ ok: false, message: "첨부 1건 이상 필요" });

    await pool.query(`UPDATE contracts SET status='submitted', submitted_at=now(), updated_at=now() WHERE id=$1 AND user_id=$2`, [id, req.user.id]);
    res.json({ ok: true });
  } catch (e) { console.error("contracts:submit", e); res.status(500).json({ ok: false, message: "제출 실패" }); }
});

// 2) 계약별 첨부
async function assertOwnContract(contractId, userId) {
  const { rows } = await pool.query(`SELECT 1 FROM contracts WHERE id=$1 AND user_id=$2 LIMIT 1`, [contractId, userId]);
  return !!rows.length;
}
const contractUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, CONTRACT_UPLOAD_DIR),
    filename: (req, file, cb) => {
      const cid = req._contractId ?? "nocid";
      const safe = (file.originalname || "file").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-180);
      cb(null, `${cid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safe}`);
    },
  }),
  limits: { files: 10, fileSize: 10 * 1024 * 1024 },
});
app.post("/api/contracts/:id/files",
  authRequired,
  (req, res, next) => { req._contractId = Number(req.params.id); if (!req._contractId) return res.status(400).json({ ok: false, message: "id 오류" }); next(); },
  contractUpload.array("files", 10),
  async (req, res) => {
    try {
      const contractId = req._contractId;
      if (!(await assertOwnContract(contractId, req.user.id))) return res.status(404).json({ ok: false, message: "계약 없음" });
      const docType = req.body?.doc_type || null;
      const files = req.files ?? [];
      if (!files.length) return res.status(400).json({ ok: false, message: "파일 없음" });

      const result = [];
      for (const f of files) {
        const { rows } = await pool.query(
          `INSERT INTO contract_files
             (contract_id, user_id, original_name, mime, size, saved_name, doc_type, status, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'pending', now())
           RETURNING id, contract_id, original_name, saved_name, mime, size, status, doc_type, created_at`,
          [contractId, req.user.id, f.originalname, f.mimetype, f.size, f.filename, docType]
        );
        result.push(rows[0]);
      }
      res.json({ ok: true, files: result });
    } catch (e) { console.error("contractFiles:upload", e); res.status(500).json({ ok: false, message: "업로드 실패" }); }
  }
);
app.get("/api/contracts/:id/files", authRequired, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ ok: false, message: "id 오류" });
  try {
    if (!(await assertOwnContract(id, req.user.id))) return res.status(404).json({ ok: false, message: "계약 없음" });
    const { rows } = await pool.query(
      `SELECT id, original_name, mime, size, saved_name, created_at, status, doc_type
         FROM contract_files WHERE contract_id=$1 ORDER BY created_at DESC`, [id]
    );
    res.json({ ok: true, files: rows });
  } catch (e) { console.error("contractFiles:list", e); res.status(500).json({ ok: false, message: "목록 실패" }); }
});

// 미리보기/다운로드 (계약 파일)
async function getContractFileBySavedName(saved) {
  const { rows } = await pool.query(
    `SELECT cf.*, c.user_id AS owner_id
       FROM contract_files cf JOIN contracts c ON c.id = cf.contract_id
      WHERE cf.saved_name=$1 LIMIT 1`, [saved]
  );
  return rows[0] || null;
}
app.get("/api/contracts/files/preview/:filename", async (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    const row = await getContractFileBySavedName(safe);
    if (!row) return res.status(404).send("파일 없음");

    if (isAdminRequest(req)) {
      const full = path.join(CONTRACT_UPLOAD_DIR, row.saved_name);
      if (!fs.existsSync(full)) return res.status(404).send("파일 없음");
      if (row.mime) res.type(row.mime);
      return res.sendFile(full);
    }

    const token = getJwtFromReq(req);
    if (!token) return res.status(401).send("인증 필요");
    let decoded; try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).send("토큰 유효하지 않음"); }

    if (row.owner_id !== decoded.id) {
      const { rows: urows } = await pool.query("SELECT is_admin FROM users WHERE id=$1", [decoded.id]);
      if (!urows?.[0]?.is_admin) return res.status(403).send("권한 없음");
    }

    const full = path.join(CONTRACT_UPLOAD_DIR, row.saved_name);
    if (!fs.existsSync(full)) return res.status(404).send("파일 없음");
    if (row.mime) res.type(row.mime);
    return res.sendFile(full);
  } catch (e) { console.error("contractFiles:preview", e); res.status(500).send("미리보기 오류"); }
});
app.get("/api/contracts/files/download/:filename", async (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    const row = await getContractFileBySavedName(safe);
    if (!row) return res.status(404).send("파일 없음");

    if (isAdminRequest(req)) {
      const full = path.join(CONTRACT_UPLOAD_DIR, row.saved_name);
      if (!fs.existsSync(full)) return res.status(404).send("파일 없음");
      return res.download(full, row.original_name);
    }

    const token = getJwtFromReq(req);
    if (!token) return res.status(401).send("인증 필요");
    let decoded; try { decoded = jwt.verify(token, process.env.JWT_SECRET); } catch { return res.status(401).send("토큰 유효하지 않음"); }

    const full = path.join(CONTRACT_UPLOAD_DIR, row.saved_name);
    if (row.owner_id !== decoded.id) {
      const { rows: urows } = await pool.query("SELECT is_admin FROM users WHERE id=$1", [decoded.id]);
      if (!urows?.[0]?.is_admin) return res.status(403).send("권한 없음");
    }
    if (!fs.existsSync(full)) return res.status(404).send("파일 없음");
    return res.download(full, row.original_name);
  } catch (e) { console.error("contractFiles:download", e); res.status(500).send("다운로드 오류"); }
});

// 3) 계약 eKYC
app.post("/api/contracts/:id/ekyc/idcard", authRequired, ekycUpload.single("idcard"), async (req, res) => {
  const contractId = Number(req.params.id);
  if (!contractId) return res.status(400).json({ ok: false, message: "id 오류" });
  try {
    if (EKYC_TEST_MODE) {
      await pool.query(`UPDATE users SET ekyc_status='verified', ekyc_verified_at=COALESCE(ekyc_verified_at, now()) WHERE id=$1`, [req.user.id]);
      await insertEkycEvent({ userId: req.user.id, contractId, status: "verified", provider: "test", raw: { testMode: true } });
      return res.json({ ok: true, ekyc: "verified", testMode: true });
    }
    if (!req.file) return res.status(400).json({ ok: false, message: "파일 없음" });

    const { rows: own } = await pool.query(`SELECT 1 FROM contracts WHERE id=$1 AND user_id=$2 LIMIT 1`, [contractId, req.user.id]);
    if (!own.length) return res.status(404).json({ ok: false, message: "계약 없음" });

    const { verified, raw, score, state } = await callClovaIdCard(req.file.buffer, req.file.originalname, req.file.mimetype);
    await pool.query(`UPDATE users SET ekyc_status=$2 WHERE id=$1`, [req.user.id, verified ? "verified" : "unverified"]);
    await insertEkycEvent({ userId: req.user.id, contractId, status: verified ? "verified" : "unverified", score: score ?? null, raw: { ...raw, state }, provider: "clova" });
    res.json({ ok: true, ekyc: verified ? "verified" : "unverified", state, score });
  } catch (e) { console.error("contracts:ekyc:idcard", e?.response?.data || e); res.status(502).json({ ok: false, message: "eKYC 실패" }); }
});
app.get("/api/contracts/:id/ekyc/status", authRequired, async (req, res) => {
  const contractId = Number(req.params.id);
  if (!contractId) return res.status(400).json({ ok: false, message: "id 오류" });
  try {
    const { rows: st } = await pool.query(
      `SELECT status, created_at, score FROM ekyc_events
        WHERE user_id=$1 AND contract_id=$2
        ORDER BY created_at DESC LIMIT 1`, [req.user.id, contractId]
    );
    const { rows: u } = await pool.query(`SELECT ekyc_status FROM users WHERE id=$1`, [req.user.id]);
    res.json({ ok: true, latest_event: st[0] ?? null, user_ekyc: u[0]?.ekyc_status ?? "unverified" });
  } catch (e) { console.error("contracts:ekyc:status", e); res.status(500).json({ ok: false, message: "조회 실패" }); }
});

// -----------------------------
// 테이블 보장 + 정적 서빙 + SPA Fallback + 에러핸들러 + 시작
// -----------------------------
ensureTables().catch((e) => console.error("ensureTables 실패:", e?.message || e));
ensureServiceCategories().catch((e) => console.error("ensureServiceCategories 실패:", e?.message || e)); // 기본 3개 카테고리 보정

app.use(express.static(path.join(__dirname, "dist")));

app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();
  const indexPath = path.join(__dirname, "dist", "index.html");
  if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
  return res.status(404).send("Not Found");
});

// 공통 에러 핸들러
app.use((err, _req, res, _next) => {
  console.error("[ERROR]", err);
  if (err?.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({ ok: false, message: "파일 용량 초과" });
  res.status(500).json({ ok: false, message: err?.message || "서버 오류" });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});