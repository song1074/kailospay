// server/src/_routes/signup.js
import "dotenv/config";
import express from "express";
import axios from "axios";
import bcrypt from "bcryptjs";
import multer from "multer";
import { pool } from "../../db.js";
import { callClovaIdCard } from "../../clova.js";

const router = express.Router();

/* ----------------------------- env helpers ----------------------------- */
const asBool = (v) => String(v ?? "").toLowerCase() === "true";
const ONEWON_TEST = asBool(process.env.ONEWON_TEST_MODE);

/** 같은 프로세스 내부로 호출할 때 쓸 베이스 URL */
function selfBase() {
  const port = Number(process.env.PORT || 4000);
  return process.env.SELF_ORIGIN || `http://127.0.0.1:${port}`;
}

/** 내부 호출 헤더 (권한 우회 토큰 + 안전한 authorization 전파) */
function internalHeaders(req) {
  const h = {
    "Content-Type": "application/json",
    "X-Internal-Call": process.env.INTERNAL_CALL_TOKEN || "",
  };
  // 방어적으로 전파
  try {
    if (req && req.headers && req.headers.authorization) {
      h.Authorization = req.headers.authorization;
    }
  } catch {}
  return h;
}

/* ------------------------------ DB helpers ----------------------------- */
async function findLatestRequestId(userId) {
  const q1 = await pool.query(
    `SELECT request_id
       FROM onewon_verifies
      WHERE user_id=$1
      ORDER BY created_at DESC
      LIMIT 1`,
    [userId]
  );
  if (q1.rows?.[0]?.request_id) return q1.rows[0].request_id;

  const q2 = await pool.query(
    `SELECT ekyc_request_id FROM users WHERE id=$1`,
    [userId]
  );
  return q2.rows?.[0]?.ekyc_request_id || null;
}

/* --------------------------- 1원 인증 호출부 ---------------------------- */
async function startOneWon(req, { userId, bankCode, accountNo, holderName }) {
  if (ONEWON_TEST) {
    await pool.query(
      `UPDATE users
          SET account_status='verified',
              ekyc_request_id=NULL,
              ekyc_verified_at = COALESCE(ekyc_verified_at, now())
        WHERE id=$1`,
      [userId]
    );
    return { ok: true, requestId: null, provider: { testMode: true } };
  }

  const base = selfBase();
  const { data } = await axios.post(
    `${base}/api/onewon/start`,
    { bankCode, accountNo, accountName: holderName, text: "KP" },
    {
      headers: internalHeaders(req),
      timeout: Number(process.env.CLOVA_1WON_TIMEOUT_MS || 15000),
      validateStatus: () => true,
    }
  );

  const requestId = data?.requestId || data?.provider?.requestId || null;

  if (userId && requestId) {
    try {
      await pool.query(
        `UPDATE onewon_verifies
            SET user_id=$1
          WHERE request_id=$2 AND (user_id IS NULL OR user_id<>$1)`,
        [userId, requestId]
      );
    } catch (e) {
      console.warn("[1WON] DB 저장 실패(무시):", e?.message || e);
    }
  }

  if (!data?.ok || !requestId) {
    return { ok: false, requestId, provider: data };
  }

  await pool.query(
    `UPDATE users SET ekyc_request_id=$2 WHERE id=$1`,
    [userId, requestId]
  );
  return { ok: true, requestId, provider: data?.provider || data };
}

async function confirmOneWon(req, { userId, requestId, verifyValue }) {
  if (ONEWON_TEST) {
    await pool.query(
      `UPDATE users SET account_status='verified' WHERE id=$1`,
      [userId]
    );
    return { ok: true, provider: { testMode: true } };
  }

  const rid = requestId || (await findLatestRequestId(userId));
  if (!rid) {
    return { ok: false, provider: { message: "진행중인 1원 인증 요청 없음" } };
  }

  const base = selfBase();
  const { data } = await axios.post(
    `${base}/api/onewon/confirm`,
    { requestId: rid, verifyValue: String(verifyValue).trim() },
    {
      headers: internalHeaders(req),
      timeout: Number(process.env.CLOVA_1WON_TIMEOUT_MS || 15000),
      validateStatus: () => true,
    }
  );

  const provider = data?.provider || data;
  const success =
    provider?.result === "SUCCESS" ||
    provider?.ok === true ||
    provider?.success === true ||
    provider?.status === "SUCCESS" ||
    provider?.code === "SUCCESS";

  if (success) {
    await pool.query(
      `UPDATE users SET account_status='verified' WHERE id=$1`,
      [userId]
    );
  }
  return { ok: !!success, provider };
}

/* ------------------------------ handlers ------------------------------- */
// /api/onboarding/start (1원 인증 시작)
async function startHandler(req, res) {
  const client = await pool.connect();
  try {
    const {
      userId,
      name,
      email,
      password,
      bankCode,
      accountNo,
      holderName,
    } = req.body ?? {};

    if (!bankCode || !accountNo || !holderName) {
      return res
        .status(400)
        .json({ ok: false, message: "bankCode/accountNo/holderName 필요" });
    }

    let uid = Number(userId) || null;

    // B) 기존 유저로 1원 시작
    if (uid) {
      const { rows } = await client.query(
        `SELECT id FROM users WHERE id=$1`,
        [uid]
      );
      if (!rows.length)
        return res.status(404).json({ ok: false, message: "사용자 없음" });

      const r = await startOneWon(req, {
        userId: uid,
        bankCode,
        accountNo,
        holderName,
      });
      if (!r.ok)
        return res
          .status(502)
          .json({ ok: false, message: "1원 인증 요청 실패", detail: r.provider });
      return res.json({
        ok: true,
        userId: uid,
        requestId: r.requestId,
        provider: r.provider,
      });
    }

    // A) 신규 가입 + 1원 시작
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ ok: false, message: "name/email/password 필요" });
    }

    // 이메일 중복
    {
      const { rows } = await client.query(
        `SELECT id FROM users WHERE email=$1 LIMIT 1`,
        [email]
      );
      if (rows.length)
        return res
          .status(409)
          .json({ ok: false, message: "이미 가입된 이메일입니다." });
    }

    const hashed = await bcrypt.hash(password, 10);

    await client.query("BEGIN");
    const { rows: created } = await client.query(
      `INSERT INTO users (name, email, password, ekyc_status, account_status)
       VALUES ($1,$2,$3,'pending','pending')
       RETURNING id`,
      [name, email.toLowerCase(), hashed]
    );
    uid = created[0].id;

    const r = await startOneWon(req, {
      userId: uid,
      bankCode,
      accountNo,
      holderName,
    });

    if (!r.ok) {
      await client.query("ROLLBACK");
      return res
        .status(502)
        .json({ ok: false, message: "1원 인증 요청 실패", detail: r.provider });
    }

    await client.query("COMMIT");
    return res.json({
      ok: true,
      userId: uid,
      requestId: r.requestId,
      provider: r.provider,
    });
  } catch (err) {
    try { await client.query("ROLLBACK"); } catch {}
    console.error(
      "[signup/start] error:",
      err?.response?.data || err?.message || err
    );
    return res.status(500).json({ ok: false, message: "회원가입 시작 실패" });
  } finally {
    client.release();
  }
}

// /api/onboarding/confirm (1원 인증 확인)
async function confirmHandler(req, res) {
  try {
    const { userId, requestId, authCode, code } = req.body ?? {};
    const uid = Number(userId) || null;
    const verifyValue = authCode ?? code;

    if (!uid) return res.status(400).json({ ok: false, message: "userId 필요" });
    if (!verifyValue)
      return res.status(400).json({ ok: false, message: "인증코드 필요" });

    const { rows } = await pool.query(
      `SELECT id FROM users WHERE id=$1`,
      [uid]
    );
    if (!rows.length)
      return res.status(404).json({ ok: false, message: "사용자 없음" });

    const r = await confirmOneWon(req, {
      userId: uid,
      requestId,
      verifyValue,
    });
    if (!r.ok)
      return res
        .status(400)
        .json({ ok: false, message: "1원 인증 실패", detail: r.provider });

    return res.json({ ok: true, provider: r.provider });
  } catch (err) {
    console.error(
      "[signup/confirm] error:",
      err?.response?.data || err?.message || err
    );
    return res.status(500).json({ ok: false, message: "1원 인증 확인 실패" });
  }
}

/* --------------------------- 신분증 인증 ---------------------------- */
const idcardUpload = multer({ 
  storage: multer.memoryStorage(), 
  limits: { fileSize: 20 * 1024 * 1024 } 
});

async function idcardHandler(req, res) {
  try {
    const { userId } = req.body;
    const uid = Number(userId) || null;

    if (!uid) {
      return res.status(400).json({ ok: false, message: "userId 필요" });
    }

    // 유저 확인
    const { rows } = await pool.query(
      `SELECT id, ekyc_status FROM users WHERE id=$1`,
      [uid]
    );
    if (!rows.length) {
      return res.status(404).json({ ok: false, message: "사용자 없음" });
    }

    // 파일 확인
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ ok: false, message: "신분증 이미지 필요" });
    }

    // CLOVA 호출
    const result = await callClovaIdCard(
      req.file.buffer,
      req.file.originalname || "idcard.jpg",
      req.file.mimetype || "image/jpeg"
    );

    if (!result.verified) {
      return res.status(400).json({
        ok: false,
        message: "신분증 인증 실패",
        detail: {
          score: result.score,
          state: result.state,
        },
      });
    }

    // DB 업데이트
    await pool.query(
      `UPDATE users 
       SET ekyc_status = 'verified',
           ekyc_verified_at = COALESCE(ekyc_verified_at, now())
       WHERE id = $1`,
      [uid]
    );

    return res.json({
      ok: true,
      verified: true,
      score: result.score,
      state: result.state,
    });

  } catch (err) {
    console.error(
      "[signup/idcard] error:",
      err?.response?.data || err?.message || err
    );
    return res.status(500).json({
      ok: false,
      message: "신분증 인증 실패",
      error: err?.message || String(err),
    });
  }
}

/* ----------------------------- route binds ----------------------------- */
// 1원 인증
router.post("/start", startHandler);
router.post("/confirm", confirmHandler);
router.post("/account/start", startHandler);   // 호환용
router.post("/account/confirm", confirmHandler);

// 신분증 인증
router.post("/idcard", idcardUpload.single("image"), idcardHandler);

export default router;