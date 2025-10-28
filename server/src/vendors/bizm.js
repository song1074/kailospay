// server/src/vendors/bizm.js
import fetch from "node-fetch";

const BASE        = process.env.BIZM_API_BASE || "https://alimtalk-api.bizmsg.kr";
const USERID      = process.env.BIZM_USER_ID;
const PROFILE_KEY = process.env.BIZM_SENDER_KEY;
const DEF_TPL_ID  = process.env.BIZM_TEMPLATE_ID || "julyupay7";

const TIMEOUT_MS  = Number(process.env.BIZM_TIMEOUT_MS || 10000);
const DEBUG       = String(process.env.BIZM_DEBUG || "false") === "true";

/** 버튼 제어
 * - BIZM_BUTTONS_JSON: 원문 JSON을 body에 그대로 merge (예: {"button1":{...},"button2":{...}})
 * - BIZM_BUTTON_NAME/BIZM_BUTTON_URL: 단일 WL 버튼 1개 생성
 * - 위 둘 다 없으면: 버튼 전송 안 함 (템플릿이 버튼 없어야 K105 회피)
 */
function buildButtonsFromEnv() {
  const jsonRaw = process.env.BIZM_BUTTONS_JSON && String(process.env.BIZM_BUTTONS_JSON).trim();
  if (jsonRaw) {
    try {
      const obj = JSON.parse(jsonRaw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      console.warn("[BIZM] BIZM_BUTTONS_JSON parse error:", e?.message || e);
      // JSON이 잘못됐으면 버튼을 아예 안 보냄 (K105 방지 위해 의도적 보수)
      return {};
    }
  }

  const name = process.env.BIZM_BUTTON_NAME && String(process.env.BIZM_BUTTON_NAME).trim();
  const url  = process.env.BIZM_BUTTON_URL && String(process.env.BIZM_BUTTON_URL).trim();
  if (name && url) {
    return {
      button1: {
        name,
        type: "WL",
        url_mobile: url,
        url_pc: url,
      },
    };
  }

  // 기본: 버튼 전송 안 함
  return {};
}

// 010 -> 8210 포맷
function to82(n) {
  let d = String(n).replace(/\D/g, "");
  if (d.startsWith("82")) return d;
  if (d.startsWith("0")) d = d.slice(1);
  return "82" + d;
}

async function fetchJSON(url, opts, timeoutMs = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const txt = await res.text();
    try { return JSON.parse(txt); } catch { return { raw: txt }; }
  } finally { clearTimeout(t); }
}

async function sendAlimtalkLegacy({ to, msg, templateId }) {
  if (!USERID || !PROFILE_KEY) {
    throw new Error("BIZM env missing: BIZM_USER_ID / BIZM_SENDER_KEY");
  }

  const body0 = {
    message_type: "at",
    phn: to82(to),
    profile: PROFILE_KEY,
    tmplId: templateId || DEF_TPL_ID,
    msg,
    reserveDt: "00000000000000",
    ...buildButtonsFromEnv(), // ✅ 버튼을 .env로 정확히 제어
  };
  const body = [body0];

  if (DEBUG) {
    const btnKeys = Object.keys(body0).filter(k => k.startsWith("button"));
    console.log("[BIZM][REQ]", {
      url: `${BASE}/v2/sender/send`,
      userid: USERID,
      tmplId: body0.tmplId,
      buttons: btnKeys.length ? btnKeys : "(none)",
      bodyPreview: { ...body0, msg: `[len=${(msg ?? "").length}]` },
    });
  }

  const out = await fetchJSON(`${BASE}/v2/sender/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      userid: USERID, // ✅ 레거시는 userid만
    },
    body: JSON.stringify(body),
  });

  if (DEBUG) console.log("[BIZM][RES]", out);

  const first = Array.isArray(out) ? out[0] : out;
  if (first?.code === "success" && first?.data?.type === "AT") {
    return { ok: true, code: "success", message: "OK", raw: out };
  }
  if (first?.code === "fail") {
    const err = new Error(`BizM fail: ${first.message}${first.originMessage ? ` (${first.originMessage})` : ""}`);
    err.bizm = first;
    throw err;
  }
  return { ok: false, raw: out };
}

export async function sendAlimtalk({ to, templateCode, message, rawMessage, msg }) {
  const finalMsg = message ?? rawMessage ?? msg;
  if (!finalMsg) throw new Error("message required");
  return sendAlimtalkLegacy({
    to,
    msg: finalMsg,
    templateId: templateCode || undefined,
  });
}

export default { sendAlimtalk };
