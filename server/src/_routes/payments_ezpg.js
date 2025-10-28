// server/src/_routes/payments_ezpg.js
import express from "express";
import { randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { pool } from "../../db.js";
import {
  buildAuthFormFields,
  verifySignData,
  approvePayment,
} from "../vendors/ezpg.js";

const router = express.Router();

// ----- 공통 env / 상수 -----
const MODE = (process.env.EZPG_MODE || "test").toLowerCase();
const DEFAULT_PAY_URL =
  MODE === "prod"
    ? "https://app.ezpgpayment.com/payment/v1/pay"
    : "https://testapp.ezpgpayment.com/payment/v1/pay";

// 강제 오버라이드가 있으면 사용
const PAY_URL = process.env.EZPG_PAY_URL || DEFAULT_PAY_URL;

const SELF = process.env.SELF_ORIGIN || "http://127.0.0.1:4000";
const SUCCESS_URL = process.env.PAYMENT_SUCCESS_URL || "/pay/success";
const FAIL_URL = process.env.PAYMENT_FAIL_URL || "/pay/fail";
const DEBUG_PAYMENTS = String(process.env.DEBUG_PAYMENTS || "").toLowerCase() === "true";

// ----- 공통 auth 헬퍼 -----
function getJwtFromReq(req) {
  const fromHeader = req.headers.authorization?.split(" ")[1];
  const fromQuery = req.query.token;
  return (fromHeader || fromQuery || "").trim() || null;
}
function authRequired(req, res, next) {
  const token = getJwtFromReq(req);
  if (!token) return res.status(401).json({ ok: false, message: "인증 필요" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "토큰 유효하지 않음" });
  }
}

// 1) 결제 준비: DB 레코드 만들고, EzPg 결제창 호출 폼 스펙 반환
router.post("/prepare", authRequired, async (req, res) => {
  try {
    const amount = Number(req.body?.amount || 0);
    const title = String(req.body?.title || "KailosPay 결제").slice(0, 100);
    const payMethod = req.body?.payMethod || "CARD";
    if (!Number.isFinite(amount) || amount < 100) {
      return res
        .status(400)
        .json({ ok: false, message: "유효하지 않은 금액(최소 100원)" });
    }

    const orderId = randomUUID();

    await pool.query(
      `INSERT INTO payments (order_id, user_id, title, amount, status, method, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'ready','ezpg',now(),now())`,
      [orderId, req.user.id, title, amount]
    );

    // EzPg가 인증/승인 결과를 서버에 POST할 콜백 URL
    const returnUrl = `${SELF}/api/payments/ezpg/return`;

    // 벤더 어댑터에서 폼 필드 작성
    const built = buildAuthFormFields({
      orderId,
      amount,
      title,
      buyerName: req.body?.customer_name || "",
      buyerTel: req.body?.phone || "",
      buyerEmail: req.body?.email || "",
      returnUrl,
      payMethod,
      clientIp:
        req.headers["x-forwarded-for"]?.split(",")[0] ||
        req.socket.remoteAddress ||
        "",
      reserved: JSON.stringify({ uid: req.user.id }),
    });

    // 안전 가드: action이 없거나 closeWindow 류면 강제로 pay URL 사용
    let action = built?.action || PAY_URL;
    if (/\/closeWindow(?:\/|$)/i.test(action)) {
      action = PAY_URL;
    }
    const method = (built?.method || "POST").toUpperCase();
    const fields = built?.fields || {};

    if (DEBUG_PAYMENTS) {
      console.log("[ezpg:prepare:debug]", {
        PAY_URL,
        action,
        method,
        orderId,
        amount,
        title,
        payMethod,
        returnUrl,
        fieldsKeys: Object.keys(fields),
      });
    }

    // 필수 필드 점검(없으면 즉시 실패로 돌려보내는 대신, 프론트가 메시지 출력)
    const required = ["mid", "orderId", "amount", "timestamp", "signature"];
    const miss = required.filter((k) => !fields[k]);
    if (miss.length) {
      return res.status(500).json({
        ok: false,
        message: `결제 필드 누락: ${miss.join(", ")}`,
      });
    }

    res.json({ ok: true, orderId, form: { action, method, fields } });
  } catch (e) {
    console.error("[ezpg:prepare]", e);
    res.status(500).json({ ok: false, message: "결제 준비 실패" });
  }
});

// 2) EzPg 인증 결과 수신 (POST 우선, 일부 환경은 GET 리다이렉트도 사용)
router.all("/return", express.urlencoded({ extended: false }), async (req, res) => {
  try {
    // EzPg가 보내주는 인증 응답 파라미터(대/소문자 구분에 주의)
    const payload = req.method === "GET" ? req.query : req.body || {};
    const {
      resultCd, resultMsg, nonce, tid, mid, pmCd,
      ordNo, goodsAmt, ediDate, mbsReserved,
      approvalUrl, netCancelUrl, payData, signData,
    } = payload;

    if (DEBUG_PAYMENTS) {
      console.log("[ezpg:return:debug]", {
        method: req.method,
        resultCd, resultMsg, tid, mid, ordNo, goodsAmt, ediDate,
        hasPayData: Boolean(payData),
        approvalUrl,
      });
    }

    // 인증 실패면 즉시 실패 페이지로
    if (String(resultCd) !== "0000") {
      console.warn("[ezpg:return] auth failed:", resultCd, resultMsg);
      const q = new URLSearchParams({
        orderId: String(ordNo || ""),
        code: String(resultCd || "auth_failed"),
        message: String(resultMsg || ""),
      }).toString();
      return res.redirect(`${FAIL_URL}?${q}`);
    }

    // signData 검증 (가이드: tid+mid+ediDate+goodsAmt+ordNo+KEY)
    const okSign = verifySignData({
      tid, mid, ediDate, goodsAmt, ordNo, signData,
    });
    if (!okSign) {
      console.warn("[ezpg:return] signData mismatch");
      const q = new URLSearchParams({
        orderId: String(ordNo || ""),
        code: "F407",
        message: "sign mismatch",
      }).toString();
      return res.redirect(`${FAIL_URL}?${q}`);
    }

    // 승인 API 호출(서버→EzPg)
    const apr = await approvePayment({
      approvalUrl,
      nonce, tid, ediDate, goodsAmt, mbsReserved, payData,
    });

    const approved =
      apr.ok && /(?:^|[&?])resultCd=0000(?:&|$)/.test(String(apr.body || ""));

    await pool.query(
      "UPDATE payments SET status=$2, updated_at=now() WHERE order_id=$1",
      [ordNo, approved ? "paid" : "failed"]
    );

    if (approved) {
      const q = new URLSearchParams({
        orderId: String(ordNo),
        amount: String(goodsAmt || ""),
        method: String(pmCd || "CARD"),
        status: "paid",
      }).toString();
      return res.redirect(`${SUCCESS_URL}?${q}`);
    }

    console.warn("[ezpg:approval] failed:", apr.status, String(apr.body).slice(0, 200));
    const q = new URLSearchParams({
      orderId: String(ordNo || ""),
      code: "approval_failed",
      message: "approval api failed",
    }).toString();
    return res.redirect(`${FAIL_URL}?${q}`);
  } catch (e) {
    console.error("[ezpg:return]", e);
    const q = new URLSearchParams({
      code: "server_error",
      message: "return handler exception",
    }).toString();
    return res.redirect(`${FAIL_URL}?${q}`);
  }
});

// (선택) 상태 조회
router.get("/status/:orderId", async (req, res) => {
  const { orderId } = req.params;
  const { rows } = await pool.query(
    `SELECT order_id, title, amount, status, method, created_at, updated_at
       FROM payments WHERE order_id=$1`,
    [orderId]
  );
  if (!rows.length) return res.status(404).json({ ok: false, message: "not found" });
  res.json({ ok: true, payment: rows[0] });
});

export default router;
