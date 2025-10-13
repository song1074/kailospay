// server/clova.js
import axios from "axios";
import FormData from "form-data";

/* =========================
   ENV
   공식 문서: https://api-fin.ncloud-docs.com/docs/ai-application-service-ekyc-api
   URL 형식: https://{apigwId}.apigw-pub.fin-ntruss.com/ekyc/v1/{domainId}/{signature}/id-card/document
   ========================= */
const HOST = (process.env.CLOVA_HOST || "").replace(/\/+$/, "");
const DID = process.env.CLOVA_EKYC_DID || "";
const SIG = process.env.CLOVA_EKYC_SIGNATURE || "";
const SECRET_HEADER = process.env.CLOVA_EKYC_SECRET_HEADER || "X-EKYC-SECRET";
const SECRET =
  process.env.CLOVA_EKYC_SECRET ||
  process.env.CLOVA_ID_SECRET ||
  process.env.CLOVA_SECRET ||
  "";
const API_KEY_ID =
  process.env.CLOVA_EKYC_APIGW_API_KEY_ID ||
  process.env.CLOVA_APIGW_API_KEY_ID ||
  process.env.CLOVA_ID_APIGW_API_KEY_ID ||
  "";
const API_KEY =
  process.env.CLOVA_EKYC_APIGW_API_KEY ||
  process.env.CLOVA_APIGW_API_KEY ||
  process.env.CLOVA_ID_APIGW_API_KEY ||
  "";
const TIMEOUT = Number(process.env.CLOVA_EKYC_TIMEOUT_MS || 15000);
const EKYC_TEST = String(process.env.EKYC_TEST_MODE || "").toLowerCase() === "true";
const MIN_CONF = Number(process.env.EKYC_MIN_CONFIDENCE || 0.7);

/* =========================
   URL 빌더 (공식 문서 기준)
   ========================= */
function buildIdCardOcrUrl() {
  if (!HOST || !DID) {
    throw new Error("CLOVA HOST/DID 환경변수가 누락되었습니다.");
  }

  // 테스트 모드: v1-doc 사용
  if (EKYC_TEST) {
    if (!SIG) {
      throw new Error("테스트 모드에서는 SIGNATURE가 필요합니다.");
    }
    // 테스트용 URL (문서 스테이지)
    const url = `${HOST}/ekyc/v1-doc/${DID}/${SIG}/id-card/document`;
    console.log("[CLOVA-ID][TEST] URL:", url);
    return url;
  }

  // 운영 모드: 공식 문서 형식
  // https://{apigwId}.apigw-pub.fin-ntruss.com/ekyc/v1/{domainId}/{signature}/id-card/document
  if (!SIG) {
    throw new Error("운영 모드에서도 SIGNATURE가 필요합니다.");
  }
  const url = `${HOST}/ekyc/v1/${DID}/${SIG}/id-card/document`;
  console.log("[CLOVA-ID][PROD] URL:", url);
  return url;
}

function buildHeaders(formHeaders = {}) {
  const h = { ...formHeaders, Accept: "application/json" };
  if (SECRET) h[SECRET_HEADER] = SECRET;
  if (API_KEY_ID) h["X-NCP-APIGW-API-KEY-ID"] = API_KEY_ID;
  if (API_KEY) h["X-NCP-APIGW-API-KEY"] = API_KEY;
  return h;
}

/**
 * 신분증 OCR/검증 호출
 * 
 * CLOVA eKYC Document API:
 * - 이미지를 업로드하여 신분증 정보를 추출하고 진위 검증까지 수행
 * - multipart/form-data로 이미지 전송
 * - 헤더: X-EKYC-SECRET (공식 문서 기준)
 */
export async function callClovaIdCard(
  buffer,
  filename = "id.jpg",
  mime = "image/jpeg"
) {
  if (!buffer || !buffer.length) {
    throw new Error("id-card 이미지 버퍼가 비었습니다.");
  }

  // 테스트 모드: 자동 통과
  if (EKYC_TEST) {
    console.log("[CLOVA-ID] TEST MODE - 자동 통과");
    return { 
      verified: true, 
      score: 1.0, 
      raw: { testMode: true }, 
      state: "SUCCESS" 
    };
  }

  const url = buildIdCardOcrUrl();
  const form = new FormData();
  
  // CLOVA eKYC 공식 문서: message 필드 필수
  const message = {
    images: [{ 
      format: mime.split('/')[1] || 'jpg', 
      name: 'idcard' 
    }],
    requestId: `req-${Date.now()}`,
    timestamp: Date.now()
  };
  form.append("message", JSON.stringify(message));
  
  // 파일 필드
  const fieldName = process.env.CLOVA_EKYC_FILE_FIELD || "file";
  form.append(fieldName, buffer, { filename, contentType: mime });

  const headers = buildHeaders(form.getHeaders());

  console.log("[CLOVA-ID] 요청 정보:", {
    url,
    secretHeader: SECRET_HEADER,
    hasSecret: !!SECRET,
    hasApiKeyId: !!API_KEY_ID,
    hasApiKey: !!API_KEY,
    fileField: fieldName,
    filename,
    mime,
  });

  let resp;
  try {
    resp = await axios.post(url, form, {
      headers,
      timeout: TIMEOUT,
      validateStatus: () => true,
    });
  } catch (err) {
    console.error("[CLOVA-ID] 요청 실패:", err.message);
    throw new Error(`CLOVA 호출 실패: ${err.message}`);
  }

  const { status, data } = resp;

  try {
    console.log("[CLOVA-ID] 응답:", {
      status,
      data: JSON.stringify(data).slice(0, 1000)
    });
  } catch {
    console.log("[CLOVA-ID] 응답:", {
      status,
      data: String(data).slice(0, 300)
    });
  }

  // 에러 처리
  const msg = (data && (data.message || data.msg)) || "";
  
  if (status === 401 || status === 403 || /로그인 해주세요/i.test(msg)) {
    throw new Error(`CLOVA 인증 실패: HTTP ${status} - ${msg || '인증 정보를 확인하세요'}`);
  }
  if (status === 404) {
    throw new Error(`CLOVA 호출 실패: HTTP 404 - URL이 잘못되었습니다. 경로: ${data?.path || 'unknown'}`);
  }
  if (status === 415) {
    throw new Error(`CLOVA 호출 실패: HTTP 415 - 지원하지 않는 미디어 타입`);
  }
  if (status >= 500) {
    throw new Error(`CLOVA 서버 오류: HTTP ${status}`);
  }
  if (status >= 400) {
    throw new Error(`CLOVA 호출 실패: HTTP ${status} - ${msg}`);
  }

  // 성공 응답 파싱
  const j = data || {};
  
  // CLOVA eKYC Document API 응답 구조
  const image = j?.images?.[0];
  const inferResult = image?.inferResult;
  const idCard = image?.idCard?.result;
  
  // 1. inferResult가 SUCCESS인지 확인
  const hasSuccessInfer = inferResult === "SUCCESS";
  
  // 2. isConfident 체크 (신뢰도)
  const isConfident = idCard?.isConfident === true;
  
  // 3. 필수 필드 존재 확인 (이름, 주민번호)
  const hasName = idCard?.ic?.name?.length > 0;
  const hasPersonalNum = idCard?.ic?.personalNum?.length > 0;
  
  // 4. 종합 검증: 모든 조건을 만족해야 통과
  const verified = hasSuccessInfer && isConfident && hasName && hasPersonalNum;

  // 신뢰도 점수 (있다면)
  const score = idCard?.confidence ?? null;
  
  // 상태 정보 (전체 idCard.result 반환)
  const state = idCard || null;

  console.log("[CLOVA-ID] 결과:", {
    verified,
    isConfident,
    hasName,
    hasPersonalNum,
    inferResult,
    score
  });

  return { 
    verified, 
    score: typeof score === "number" ? score : null, 
    raw: data, 
    state 
  };
}

export default { callClovaIdCard };