// server/clova.js
import axios from "axios";
import FormData from "form-data";

/* =========================
   ENV
   ========================= */
const ID_FULL =
  process.env.CLOVA_EKYC_IDCARD_FULL || // 권장: 완전 URL (예: /ekyc/v1/external/v1/2478/id-card/ocr)
  process.env.CLOVA_ID_FULL ||
  "";

const SECRET_HEADER = (process.env.CLOVA_EKYC_SECRET_HEADER || "X-SECRET-KEY").trim();
const SECRET =
  process.env.CLOVA_EKYC_SECRET ||
  process.env.CLOVA_ID_SECRET ||
  process.env.CLOVA_SECRET ||
  "";

const API_KEY =
  process.env.CLOVA_EKYC_APIGW_API_KEY ||
  process.env.CLOVA_APIGW_API_KEY ||
  process.env.CLOVA_ID_APIGW_API_KEY ||
  "";

const TIMEOUT = Number(process.env.CLOVA_EKYC_TIMEOUT_MS || 15000);
const EKYC_TEST = String(process.env.EKYC_TEST_MODE || "").toLowerCase() === "true";
const MIN_CONF = Number(process.env.EKYC_MIN_CONFIDENCE || 0.7);
const FILE_FIELD = (process.env.CLOVA_EKYC_FILE_FIELD || "file").trim();

/* =========================
   URL 보정
   - /document/id-card → /id-card
   - 마지막이 /id-card 이면 /ocr 덧붙임
   - 끝의 슬래시는 제거
   ========================= */
function normalizeIdcardUrl(u) {
  if (!u) return u;
  let url = String(u).trim();

  // /document/id-card → /id-card
  url = url.replace(/\/document\/id-card(\/?)/i, "/id-card$1");

  // 끝 슬래시 제거
  url = url.replace(/\/+$/, "");

  // /id-card로 끝나면 /ocr 추가
  if (/\/id-card$/i.test(url)) url = url + "/ocr";

  return url;
}

function buildUrl() {
  if (!ID_FULL) throw new Error("CLOVA eKYC id-card 설정 누락: FULL URL이 비어있음");
  return normalizeIdcardUrl(ID_FULL);
}

function buildHeaders(formHeaders = {}) {
  const h = { ...formHeaders, Accept: "application/json" };

  if (SECRET) h[SECRET_HEADER] = SECRET;

  // API 게이트웨이 키(있을 때만 추가) — 일반 키 인증은 이 한 헤더면 충분
  if (API_KEY) h["x-ncp-apigw-api-key"] = API_KEY;

  return h;
}

/**
 * 신분증 검증 호출
 * @param {Buffer} buffer - 이미지 버퍼
 * @param {string} filename
 * @param {string} mime
 * @returns {Promise<{verified:boolean, score:number|null, raw:any, state:string|null}>}
 */
export async function callClovaIdCard(buffer, filename = "id.jpg", mime = "image/jpeg") {
  if (!buffer || !buffer.length) throw new Error("id-card 이미지 버퍼가 비었습니다.");

  // 테스트 모드면 바로 통과
  if (EKYC_TEST) {
    return { verified: true, score: 1.0, raw: { testMode: true }, state: "SUCCESS" };
  }

  const url = buildUrl();

  const form = new FormData();
  // 필드명 기본값 'file' — 필요시 .env: CLOVA_EKYC_FILE_FIELD 로 변경
  form.append(FILE_FIELD, buffer, { filename, contentType: mime });

  const headers = buildHeaders(form.getHeaders());

  // 디버그(민감값 노출 방지)
  console.log("[CLOVA-ID] URL:", url);
  console.log("[CLOVA-ID] headers:", {
    secretHeader: SECRET_HEADER,
    hasSecret: !!SECRET,
    hasApiKey: !!API_KEY,
    fileField: FILE_FIELD,
  });

  const resp = await axios.post(url, form, {
    headers,
    timeout: TIMEOUT,
    validateStatus: () => true,
  });

  const { status, data } = resp;

  // raw 로그(최대 1000자)
  try {
    console.log("[CLOVA-ID][raw]", JSON.stringify(data).slice(0, 1000));
  } catch {
    console.log("[CLOVA-ID][raw]", String(data).slice(0, 300));
  }

  // HTTP 오류 직접 처리
  if (status >= 400) {
    throw new Error(`CLOVA 호출 실패: HTTP ${status}`);
  }

  // 게이트웨이 인증류 메시지 방어
  if (data?.status === 401 || data?.status === 403 || /로그인\s*해주세요/i.test(data?.message || "")) {
    throw new Error(`CLOVA 인증 실패: ${data?.message || data?.status || "401/403"}`);
  }

  // 성공 판정
  const j = data;
  const flat = (() => {
    try { return JSON.stringify(j); } catch { return ""; }
  })();
  const hasSuccessWord = /"SUCCESS"|"VALID"/i.test(flat);

  const verified =
    !!(
      j?.verified ||
      j?.ok ||
      j?.success ||
      j?.status === "SUCCESS" ||
      j?.result === "SUCCESS" ||
      j?.resultCode === "SUCCESS" ||
      j?.data?.verified ||
      j?.data?.status === "SUCCESS" ||
      j?.data?.result === "SUCCESS" ||
      j?.idCard?.verified ||
      j?.idCard?.result === "SUCCESS" ||
      j?.document?.validity === "VALID" ||
      hasSuccessWord
    );

  const score =
    j?.confidence ??
    j?.score ??
    j?.idCard?.confidence ??
    j?.data?.confidence ??
    null;

  const pass = verified || (typeof score === "number" && score >= MIN_CONF);
  const state = j?.result || j?.status || j?.data?.status || null;

  return { verified: !!pass, score: typeof score === "number" ? score : null, raw: data, state };
}

export default { callClovaIdCard };
