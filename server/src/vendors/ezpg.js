// server/src/vendors/ezpg.js
import crypto from "crypto";

/**
 * ───────────────────────────────────────────────────────────────
 *  Fetch polyfill
 *  - Node 18+ 에서는 글로벌 fetch 사용
 *  - 구형/특수 런타임이면 node-fetch를 동적 import
 * ───────────────────────────────────────────────────────────────
 */
async function httpFetch(...args) {
  if (typeof fetch !== "undefined") return fetch(...args);
  const { default: nf } = await import("node-fetch");
  return nf(...args);
}

/**
 * ───────────────────────────────────────────────────────────────
 *  Env & Endpoint
 *   - 키 명이 문서/환경마다 달라 불일치가 발생해도 흡수하도록 alias 처리
 * ───────────────────────────────────────────────────────────────
 */
const MODE = String(process.env.EZPG_MODE || "test").toLowerCase();

// MID: EZPG_MID 또는 EZPG_MERCHANT_ID 둘 다 지원
const MID =
  process.env.EZPG_MID ||
  process.env.EZPG_MERCHANT_ID ||
  "";

// KEY: EZPG_MERCHANT_KEY 또는 EZPG_API_KEY 둘 다 지원
const KEY =
  process.env.EZPG_MERCHANT_KEY ||
  process.env.EZPG_API_KEY ||
  "";

// 베이스 URL: 명시되면 EZPG_ENDPOINT 우선, 없으면 모드별 기본값
const BASE =
  process.env.EZPG_ENDPOINT ||
  (MODE === "prod"
    ? "https://api.ezpgpayment.com"
    : "https://testapp.ezpgpayment.com");

const URLS = {
  request: `${BASE}/payment/v1/view/request`, // 결제창(인증) 진입
  approval: `${BASE}/payment/v1/approval`,    // 승인(서버→PG)
  cancel:   `${BASE}/payment/v1/cancel`,
  netCancel:`${BASE}/payment/v1/netCancel`,
};

/**
 * ───────────────────────────────────────────────────────────────
 *  Utils
 * ───────────────────────────────────────────────────────────────
 */
function sha256hex(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

export function nowEdiDate(d = new Date()) {
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}${MM}${dd}${hh}${mm}${ss}`;
}

/**
 * hashString = SHA256(mid + ediDate + goodsAmt + key)
 * - 결제창(인증) 요청 및 승인요청 공통
 */
export function buildHashString({ mid, ediDate, amount }) {
  const goodsAmt = String(amount);
  return sha256hex(`${mid}${ediDate}${goodsAmt}${KEY}`);
}

/**
 * 인증 응답 검증
 * signData == SHA256(tid + mid + ediDate + goodsAmt + ordNo + key)
 */
export function verifySignData({ tid, mid, ediDate, goodsAmt, ordNo, signData }) {
  const want = sha256hex(`${tid}${mid}${ediDate}${goodsAmt}${ordNo}${KEY}`);
  return want === String(signData || "");
}

/**
 * (옵션) Webhook 서명 검증 (문서 형태에 맞춰 사용)
 * - 기본 가정: signature = HMAC-SHA256(rawBody, WEBHOOK_SECRET)
 * - 필요시 timestamp를 포함해 검증하도록 확장 가능
 */
export function verifyEzpgWebhookSignature(rawBody, signature, _timestamp) {
  const secret =
    process.env.EZPG_WEBHOOK_SECRET ||
    process.env.EZPG_SIGNING_SECRET ||
    "";
  if (!secret) return false;
  try {
    const h = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    return h === String(signature || "");
  } catch {
    return false;
  }
}

/**
 * 결제창(인증) 호출에 필요한 form 필드 구성
 * - 프런트에서 <form method="POST" action={action}><input ... /></form> 제출
 */
export function buildAuthFormFields({
  orderId,            // ordNo
  amount,             // goodsAmt (숫자만)
  title,              // goodsNm
  buyerName,          // ordNm
  buyerTel,           // ordTel
  buyerEmail,         // ordEmail
  returnUrl,          // 인증 결과 받을 URL(절대경로 권장; 모바일 필수)
  payMethod = "CARD", // CARD | VACNT
  clientIp = "0.0.0.0",
  reserved = "",      // mbsReserved (왕복 데이터)
}) {
  const ediDate = nowEdiDate();
  const goodsAmt = String(amount);
  const hashString = buildHashString({ mid: MID, ediDate, amount: goodsAmt });

  const fields = {
    payMethod,      // Y
    mid: MID,       // Y
    goodsNm: title, // Y
    ordNo: orderId, // Y (Unique)
    goodsAmt,       // Y
    ordNm: buyerName || "",
    ordTel: buyerTel || "",
    ordEmail: buyerEmail || "",
    ordIp: clientIp || "",
    mbsReserved: reserved,
    returnUrl,      // Y
    ediDate,        // Y
    hashString,     // Y
  };

  return { action: URLS.request, method: "POST", fields };
}

/**
 * 승인 요청 (서버→EzPg)
 * - 인증 완료 콜백에서 받은 데이터(payData 등)를 가지고 서버에서 승인
 */
export async function approvePayment({
  approvalUrl,  // 인증응답에 명시될 수 있음
  nonce,
  tid,
  ediDate,
  goodsAmt,     // 인증응답의 금액(문자)
  mbsReserved,
  payData,      // 인증응답의 암호화 데이터
}) {
  const body = new URLSearchParams();
  body.set("nonce", nonce);
  body.set("tid", tid);
  body.set("ediDate", ediDate);
  body.set("mid", MID);
  body.set("goodsAmt", goodsAmt);
  if (mbsReserved) body.set("mbsReserved", mbsReserved);
  body.set("hashString", sha256hex(`${MID}${ediDate}${goodsAmt}${KEY}`));
  body.set("payData", payData);

  const resp = await httpFetch(approvalUrl || URLS.approval, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  // EzPg가 text/kv 혹은 JSON 등으로 응답할 수 있으므로 우선 text 수신
  const text = await resp.text();

  // JSON 시도 파싱(실패해도 무시)
  let json = null;
  try { json = JSON.parse(text); } catch {}

  return {
    ok: resp.ok,
    status: resp.status,
    raw: text,
    json,
  };
}
