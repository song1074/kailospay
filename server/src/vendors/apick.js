// server/src/vendors/apick.js
import { Buffer } from "buffer";

/* ========================================================================
 * APICK vendor client
 *  - 주소(addr) / 법인등록번호(reg_num) / 사업자번호(biz_num) 모두 지원
 *  - FormData 사용 시 Content-Type 수동 지정 금지
 *  - 안전한 타임아웃/에러 메시지
 *  - 경로는 .env 로 오버라이드 가능(APICK_ISSUE_PATH / APICK_DOWNLOAD_PATH)
 * ===================================================================== */

// ENV --------------------------------------------------------------------
const BASE = String(process.env.APICK_BASE || "https://apick.app").replace(/\/$/, "");
const KEY  = process.env.APICK_AUTH_KEY;

// timeout: non-number/0/neg → 15000ms, and enforce min 1000ms
const _rawTO = Number(process.env.APICK_TIMEOUT_MS);
const REQ_TIMEOUT = Math.max(1000, Number.isFinite(_rawTO) && _rawTO > 0 ? _rawTO : 15000);

// ★ 경로 환경변수(필요 시 벤더 스펙에 맞춰 교체)
const ISSUE_PATH    = process.env.APICK_ISSUE_PATH    || "/rest/iros/2";
const DOWNLOAD_PATH = process.env.APICK_DOWNLOAD_PATH || "/rest/iros_download/2";
const REALNAME_PATH = process.env.APICK_REALNAME_PATH || "/rest/account_realname";

// Guards -----------------------------------------------------------------
function assertKey() {
  if (!KEY) throw new Error("APICK_AUTH_KEY 가 설정되어 있지 않습니다.");
}
function assertBase() {
  if (!/^https?:\/\//i.test(BASE)) {
    throw new Error(`APICK_BASE 값이 올바르지 않습니다: ${BASE}`);
  }
}

// Fetch with Abort timeout -----------------------------------------------
async function xfetch(url, init = {}) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), REQ_TIMEOUT);
  try {
    return await fetch(url, { signal: ac.signal, ...init });
  } catch (e) {
    if (e?.name === "AbortError") {
      throw new Error(`APICK 요청 타임아웃(${REQ_TIMEOUT}ms)`);
    }
    throw e;
  } finally {
    clearTimeout(t);
  }
}

const authHeaders = (extra = {}) => ({ "CL_AUTH_KEY": KEY, ...extra });

const parseJsonSafe = (text) => {
  try { return JSON.parse(text); } catch { return null; }
};

/** 발급(열람) 요청 — addr | reg_num | biz_num 중 1개 필요 */
export async function apickIssue(payload = {}) {
  assertKey(); assertBase();

  const url = `${BASE}${ISSUE_PATH}`;
  const fd = new FormData();

  // ★ 주소로도 가능 (부동산 등기)
  if (payload.addr)    fd.set("addr",    String(payload.addr).trim());
  if (payload.reg_num) fd.set("reg_num", String(payload.reg_num).trim());
  if (payload.biz_num) fd.set("biz_num", String(payload.biz_num).trim());

  if (!fd.has("addr") && !fd.has("reg_num") && !fd.has("biz_num")) {
    throw new Error("addr | reg_num | biz_num 중 하나는 필수입니다.");
  }

  const r = await xfetch(url, { method: "POST", headers: authHeaders(), body: fd });
  const text = await r.text();

  if (!r.ok) {
    const msg = text || `HTTP ${r.status}`;
    throw new Error(`APICK issue 실패: ${msg}`);
  }

  const json = parseJsonSafe(text);
  if (!json) throw new Error(`APICK issue 응답이 JSON이 아닙니다: ${text?.slice(0, 300)}`);

  // 응답 예: { data:{ ic_id,... }, api:{...} } 또는 { ic_id: ... }
  const ic_id = json.ic_id ?? json?.data?.ic_id;
  if (!ic_id) throw new Error(`APICK issue 응답에 ic_id가 없습니다: ${text?.slice(0, 300)}`);

  return { ...json, ic_id };
}

/** 다운로드: 준비중이면 { notReady:true } */
export async function apickDownload(ic_id, format = "pdf") {
  assertKey(); assertBase();
  if (!ic_id) throw new Error("ic_id는 필수입니다.");

  const url = `${BASE}${DOWNLOAD_PATH}`;
  const fd = new FormData();
  fd.set("ic_id", String(ic_id).trim());
  if (format && format !== "pdf") fd.set("format", format);

  const r = await xfetch(url, { method: "POST", headers: authHeaders(), body: fd });

  // APICK 특성: 헤더 result=2 → 처리중
  const resultHeader = r.headers.get("result"); // "1" 성공, "2" 처리중
  if (resultHeader === "2") {
    return { notReady: true, headers: Object.fromEntries(r.headers.entries()) };
  }

  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`APICK download 실패: HTTP ${r.status} ${msg}`);
  }

  const buf = Buffer.from(await r.arrayBuffer());
  const ct = (r.headers.get("Content-Type") || "").toLowerCase();

  if (format === "excel" || ct.includes("spreadsheet") || ct.includes("excel")) {
    return { notReady: false, xlsx: buf, headers: Object.fromEntries(r.headers.entries()) };
  }

  return { notReady: false, pdf: buf, headers: Object.fromEntries(r.headers.entries()) };
}

/** 계좌 실명조회 */
export async function apickAccountRealname({ bank_code, account, name = null }) {
  assertKey(); assertBase();
  if (!bank_code || !account) throw new Error("bank_code, account 는 필수입니다.");

  const url = `${BASE}${REALNAME_PATH}`;
  const fd = new FormData();
  fd.set("account_num", String(account).replace(/[^0-9-]/g, ""));
  fd.set("bank_code", String(bank_code).trim());

  const r = await xfetch(url, { method: "POST", headers: authHeaders(), body: fd });
  const text = await r.text();
  if (!r.ok) throw new Error(`APICK realname 실패: ${text || `HTTP ${r.status}`}`);

  const json = parseJsonSafe(text);
  if (!json) throw new Error(`APICK realname 응답 JSON 파싱 실패: ${text?.slice(0,300)}`);

  // APICK 응답 형식: { data: { 은행코드, 은행명, 계좌번호, 계좌실명, success }, api: { success, cost, ms, pl_id } }
  const data = json.data || {};
  const holderName = data.계좌실명 || data.accountName || null;
  const success = data.success === 1; // 1: 성공, 0: 실패, 3: timeout
  const cost = json?.api?.cost ?? null;

  return { raw: json, holderName, matched: success, cost };
}

// 기존 라우터에서 쓰기 쉬운 별칭
export const apickDownloadPdf = (ic_id) => apickDownload(ic_id, "pdf");