// server/src/_routes/onewon.js
import "dotenv/config"; // 반드시 최상단
import { Router } from "express";
import axios from "axios";
import jwt from "jsonwebtoken";
import { pool } from "../../db.js";

const router = Router();

/* =========================
 * ENV
 * ========================= */
const ACCOUNT_BASE  = process.env.CLOVA_1WON_ACCOUNT_BASE || "";
const SECRET_HEADER = process.env.CLOVA_1WON_SECRET_HEADER || "X-EKYC-SECRET";
const SECRET        = process.env.CLOVA_1WON_SECRET || "";
const API_KEY       = process.env.CLOVA_1WON_APIGW_API_KEY || "";
const TIMEOUT       = Number(process.env.CLOVA_1WON_TIMEOUT_MS || 30000);

// 상대 경로(기본값)
const VERIFY_PATH   = process.env.CLOVA_1WON_VERIFY_PATH  || "/account/verify";
const CONFIRM_PATH  = process.env.CLOVA_1WON_CONFIRM_PATH || "/account/confirm";

// 전체 URL 오버라이드(선택)
const VERIFY_FULL   = process.env.CLOVA_1WON_VERIFY_FULL  || "";
const CONFIRM_FULL  = process.env.CLOVA_1WON_CONFIRM_FULL || "";

// 내부 호출 토큰(화이트리스트)
const INTERNAL_CALL_TOKEN = process.env.INTERNAL_CALL_TOKEN || "";

// 테스트 모드
const TEST_MODE = String(process.env.ONEWON_TEST_MODE || "").toLowerCase() === "true";

/* 로그 */
console.log("[1WON] ACCOUNT_BASE =", ACCOUNT_BASE);
console.log("[1WON] SECRET       =", SECRET ? "(loaded)" : "(missing)");
console.log("[1WON] API_KEY      =", API_KEY ? "(loaded)" : "(missing)");
console.log("[1WON] VERIFY_PATH  =", VERIFY_PATH, "CONFIRM_PATH =", CONFIRM_PATH);
console.log("[1WON] FULL         =", { VERIFY_FULL: VERIFY_FULL || null, CONFIRM_FULL: CONFIRM_FULL || null });
console.log("[1WON] TEST_MODE    =", TEST_MODE);
console.log("[1WON] INTERNAL     =", INTERNAL_CALL_TOKEN ? "(enabled)" : "(disabled)");

/* =========================
 * helpers
 * ========================= */

// 내부/외부 인증 허용:
//  - 내부: X-Internal-Call == INTERNAL_CALL_TOKEN → { internal:true, userId:null }
//  - 외부: Authorization: Bearer <jwt>           → { internal:false, userId:<id> }
function requireWho(req, res) {
  const internal = (req.headers["x-internal-call"] || "").toString();
  if (INTERNAL_CALL_TOKEN && internal === INTERNAL_CALL_TOKEN) {
    return { internal: true, userId: null };
  }
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    res.status(401).json({ ok: false, error: "인증 필요" });
    return null;
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return { internal: false, userId: decoded.id };
  } catch {
    res.status(401).json({ ok: false, error: "토큰 유효하지 않음" });
    return null;
  }
}

function buildHeaders() {
  const h = { "Content-Type": "application/json" };
  if (SECRET) h[SECRET_HEADER] = SECRET;
  if (API_KEY) {
    // 게이트웨이에 따라 대/소문자 버전 모두 허용
    h["X-NCP-APIGW-API-KEY"] = API_KEY;
    h["x-ncp-apigw-api-key"] = API_KEY;
  }
  return h;
}

function buildUrl(kind) {
  if (kind === "verify"  && VERIFY_FULL)  return VERIFY_FULL;
  if (kind === "confirm" && CONFIRM_FULL) return CONFIRM_FULL;
  const tail = kind === "verify" ? VERIFY_PATH : CONFIRM_PATH;
  return `${ACCOUNT_BASE}${tail}`;
}

async function call1WonVerify({ requestId, text, bankCode, accountNo, name }) {
  if (TEST_MODE) {
    return {
      success: true, result: "SUCCESS", requestId,
      echo: { text, bankCode, accountNo, name }, testMode: true
    };
  }
  if (!ACCOUNT_BASE && !VERIFY_FULL) throw new Error("1원 인증 설정 누락(VERIFY)");
  const url = buildUrl("verify");
  const headers = buildHeaders();
  const body = { requestId, verifyType: "TEXT", text, bankCode, accountNo, name };
  console.log("[1WON][verify] URL:", url);
  console.log("[1WON][verify] Body:", body);
  const { data } = await axios.post(url, body, { headers, timeout: TIMEOUT });
  return data;
}

async function call1WonConfirm({ requestId, verifyValue }) {
  if (TEST_MODE) {
    return { success: true, result: "SUCCESS", requestId, echo: { verifyValue }, testMode: true };
  }
  if (!ACCOUNT_BASE && !CONFIRM_FULL) throw new Error("1원 인증 설정 누락(CONFIRM)");
  const url = buildUrl("confirm");
  const headers = buildHeaders();
  const body = { requestId, verifyValue };
  console.log("[1WON][confirm] URL:", url);
  console.log("[1WON][confirm] Body:", body);
  const { data } = await axios.post(url, body, { headers, timeout: TIMEOUT });
  return data;
}

/* =========================
 * routes
 * ========================= */

router.get("/_debug", (_req, res) => {
  res.json({
    ok: true,
    accountBase: ACCOUNT_BASE,
    hasSecret: !!SECRET,
    hasApiKey: !!API_KEY,
    secretHeader: SECRET_HEADER,
    verifyPath: VERIFY_PATH,
    confirmPath: CONFIRM_PATH,
    verifyFull: VERIFY_FULL || null,
    confirmFull: CONFIRM_FULL || null,
    testMode: TEST_MODE,
    internalEnabled: !!INTERNAL_CALL_TOKEN,
  });
});

router.post("/start", async (req, res) => {
  const who = requireWho(req, res);
  if (!who) return;

  try {
    const { bankCode, accountNo, accountName, text = "KP" } = req.body || {};
    if (!bankCode || !accountNo || !accountName) {
      return res.status(400).json({ ok: false, error: "bankCode/accountNo/accountName 필요" });
    }

    const requestId = `onewon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const provider = await call1WonVerify({
      requestId, text, bankCode, accountNo, name: accountName
    });

    // userId 없으면 NULL 로 저장(내부 호출)
    try {
      await pool.query(
        `INSERT INTO onewon_verifies
           (user_id, request_id, verify_type, code, bank_code, account_no, account_name, provider_raw, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now())`,
        [who.userId, requestId, "TEXT", text, bankCode, accountNo, accountName, JSON.stringify(provider)]
      );
    } catch (e) {
      console.warn("[1WON] DB 저장 실패(무시):", e?.message || e);
    }

    res.json({ ok: true, requestId, provider });
  } catch (e) {
    console.error("[1WON:start] Error:", e?.response?.data || e?.message || e);
    res.status(502).json({ ok: false, error: "1원 인증 요청 실패", detail: e?.response?.data || e?.message });
  }
});

router.post("/confirm", async (req, res) => {
  const who = requireWho(req, res);
  if (!who) return;

  try {
    const { requestId, verifyValue, code } = req.body || {};
    const value = (verifyValue ?? code ?? "").toString().trim(); // code도 허용
    if (!requestId || !value) {
      return res.status(400).json({ ok: false, error: "requestId/verifyValue 필요" });
    }

    const provider = await call1WonConfirm({ requestId, verifyValue: value });
    const success =
      provider?.result === "SUCCESS" ||
      provider?.ok === true ||
      provider?.success === true;

    try {
      await pool.query(
        `UPDATE onewon_verifies
           SET status=$1, provider_raw=$2,
               confirmed_at = CASE WHEN $3 THEN now() ELSE confirmed_at END
         WHERE request_id=$4 ${who.userId ? "AND (user_id=$5 OR user_id IS NULL)" : ""}`,
        who.userId
          ? [success ? "confirmed" : "failed", JSON.stringify(provider), success, requestId, who.userId]
          : [success ? "confirmed" : "failed", JSON.stringify(provider), success, requestId]
      );

      if (success && who.userId) {
        await pool.query(`UPDATE users SET account_status='verified' WHERE id=$1`, [who.userId]);
      }
    } catch (e) {
      console.warn("[1WON] DB 업데이트 실패(무시):", e?.message || e);
    }

    res.json({ ok: success, provider });
  } catch (e) {
    console.error("[1WON:confirm] Error:", e?.response?.data || e?.message || e);
    res.status(502).json({ ok: false, error: "확인 실패", detail: e?.response?.data || e?.message });
  }
});

export default router;
