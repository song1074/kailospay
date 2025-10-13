// ekycAccount.js - 1원 인증 함수들 (필요시 사용)
import axios from "axios";

const SECRET = process.env.CLOVA_1WON_SECRET || "";
const SECRET_HEADER = process.env.CLOVA_1WON_SECRET_HEADER || "X-EKYC-SECRET";
const API_KEY = process.env.CLOVA_1WON_APIGW_API_KEY || "";
const BASE = process.env.CLOVA_1WON_ACCOUNT_BASE || "";
const TIMEOUT = Number(process.env.CLOVA_1WON_TIMEOUT_MS || 30000);

console.log("[ekycAccount] BASE =", BASE);

function buildHeaders() {
  const headers = { "Content-Type": "application/json" };
  
  if (SECRET) headers[SECRET_HEADER] = SECRET;
  if (API_KEY) headers["X-NCP-APIGW-API-KEY"] = API_KEY;
  
  return headers;
}

export async function ekycAccountVerify({
  bankCode, accountNumber, holderName, amount = 1, memoPrefix = "KP",
}) {
  if (!SECRET || !BASE) throw new Error("1원 인증 설정 누락");

  const url = `${BASE}/verify`;
  const memo = `${memoPrefix}-${Math.floor(100000 + Math.random() * 900000)}`;

  const payload = { 
    bankCode, 
    accountNo: accountNumber, 
    name: holderName, 
    amount, 
    text: memo,
    verifyType: "TEXT",
    requestId: `verify_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  };

  const headers = buildHeaders();
  
  try {
    const { data } = await axios.post(url, payload, { headers, timeout: TIMEOUT });
    const requestId = data?.requestId || payload.requestId;
    
    return { 
      requestId, 
      plainCode: memo.split("-")[1], 
      memo, 
      hint: `${memoPrefix}-******`, 
      raw: data 
    };
  } catch (e) {
    console.error("[ekycAccount:verify] fail", e?.response?.status, e?.response?.data);
    throw e;
  }
}

export async function ekycAccountConfirm({ requestId, code }) {
  if (!SECRET || !BASE) throw new Error("1원 인증 설정 누락");

  const url = `${BASE}/confirm`;
  const payload = { requestId, verifyValue: String(code).trim() };
  const headers = buildHeaders();

  try {
    const { data } = await axios.post(url, payload, { headers, timeout: TIMEOUT });
    const ok = data?.result === "SUCCESS" || data?.success === true;
    
    return { ok, raw: data };
  } catch (e) {
    console.error("[ekycAccount:confirm] fail", e?.response?.status, e?.response?.data);
    throw e;
  }
}