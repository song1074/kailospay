// server/db.js  (ESM)
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
const { Pool } = pkg;

// .env 로딩 (server/.env 우선)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

// SSL 설정
const useSSL = String(process.env.PGSSLMODE || "").toLowerCase() === "require";

// 커넥션 풀 생성
export const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
  max: 20,                 // 풀 최대 커넥션
  idleTimeoutMillis: 30000 // 유휴 연결 정리
});

// 로그/에러
pool.on("connect", () => console.log("✅ PostgreSQL 연결됨"));
pool.on("error", (err) => console.error("🛑 PostgreSQL 오류:", err));

// 기본 쿼리 헬퍼들 ------------------------------------------------------------
export async function query(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

export async function one(text, params) {
  const rows = await query(text, params);
  if (!rows.length) throw new Error("No data");
  return rows[0];
}

export async function oneOrNone(text, params) {
  const rows = await query(text, params);
  return rows[0] || null;
}

export async function none(text, params) {
  await pool.query(text, params);
}

// 트랜잭션 헬퍼 (선택 사용)
export async function tx(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // client 전용 헬퍼
    const helpers = {
      query: (q, v) => client.query(q, v).then(r => r.rows),
      one: async (q, v) => {
        const { rows } = await client.query(q, v);
        if (!rows.length) throw new Error("No data");
        return rows[0];
      },
      oneOrNone: async (q, v) => {
        const { rows } = await client.query(q, v);
        return rows[0] || null;
      },
      none: (q, v) => client.query(q, v).then(() => undefined),
    };

    const result = await callback(helpers);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

// (옵션) pgcrypto 확장 설치 시도: SKIP_PGCRYPTO=1 이면 건너뜀
(async () => {
  try {
    if (!String(process.env.SKIP_PGCRYPTO || "").trim()) {
      await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;");
    }
  } catch (e) {
    console.warn("[warn] pgcrypto 확장 생성 실패(무시):", e.message);
  }
})();

// 기본 내보내기(라우트에서 import db … 로 사용)
const db = { pool, query, one, oneOrNone, none, tx };
export default db;
