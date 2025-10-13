// server/src/_routes/apick_account.js
import { Router } from "express";
import { apickAccountRealname } from "../vendors/apick.js";

const router = Router();

const APICK_DEBUG = String(process.env.APICK_DEBUG || "").toLowerCase() === "1";
const APICK_ACCOUNT_TEST_MODE = String(process.env.APICK_ACCOUNT_TEST_MODE || "false").toLowerCase() === "true";

if (APICK_DEBUG || APICK_ACCOUNT_TEST_MODE) {
  console.log("\n[APICK Account] Configuration:");
  console.log("  - DEBUG:", APICK_DEBUG);
  console.log("  - TEST_MODE:", APICK_ACCOUNT_TEST_MODE);
}

function normName(s = "") {
  return String(s || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * POST /api/apick/account/verify
 * body: { bank_code | bankCode, account | accountNo, holderName | name }
 */
router.post("/verify", async (req, res) => {
  try {
    const bank_code = String(req.body?.bank_code || req.body?.bankCode || "").trim();
    const account = String(req.body?.account || req.body?.accountNo || "").replace(/[^\d-]/g, "");
    const holder = String(req.body?.holderName || req.body?.name || "").trim();

    if (APICK_DEBUG) {
      console.log("\n[APICK][/verify] Request:");
      console.log("  bank_code:", bank_code);
      console.log("  account:", account);
      console.log("  holder:", holder);
    }

    if (!bank_code || !account || !holder) {
      return res.status(400).json({
        ok: false,
        error: "bank_code, account, holderName are required",
      });
    }

    // ===== 테스트 모드 =====
    if (APICK_ACCOUNT_TEST_MODE) {
      console.log("[APICK] TEST MODE - Mock response");
      return res.json({
        ok: true,
        matched: true,
        reason: "test_mode",
        holderNameInput: holder,
        vendorHolderName: holder,
        cost: 60,
        vendorInfo: {
          testMode: true,
          message: "테스트 모드 - 실제 은행 조회 없음"
        },
      });
    }
    // ===== 테스트 모드 끝 =====

    // 실제 APICK API 호출
    const result = await apickAccountRealname({
      bank_code,
      account,
      name: holder,
    });

    if (APICK_DEBUG) {
      console.log("\n[APICK][/verify] APICK Response:");
      console.log("  holderName:", result.holderName);
      console.log("  matched:", result.matched);
      console.log("  cost:", result.cost);
      console.log("  raw:", JSON.stringify(result.raw, null, 2));
    }

    // ===== 중요: 이름 직접 비교 =====
    let matched = false;
    let reason = "";

    // APICK 조회 자체가 실패한 경우
    if (!result.matched) {
      matched = false;
      reason = "vendor_failed";
    }
    // APICK 조회는 성공했지만 예금주 이름을 받지 못한 경우
    else if (!result.holderName) {
      matched = false;
      reason = "no_vendor_name";
    }
    // 예금주 이름을 받았으면 입력값과 비교
    else {
      const normalizedInput = normName(holder);
      const normalizedVendor = normName(result.holderName);
      
      if (APICK_DEBUG) {
        console.log("  normalizedInput:", normalizedInput);
        console.log("  normalizedVendor:", normalizedVendor);
      }

      matched = normalizedInput === normalizedVendor;
      reason = matched ? "name_matched" : "name_mismatched";
    }

    if (APICK_DEBUG) {
      console.log("\n[APICK][/verify] Final result:");
      console.log("  matched:", matched);
      console.log("  reason:", reason);
    }

    return res.json({
      ok: true,
      matched,
      reason,
      holderNameInput: holder,
      vendorHolderName: result.holderName,
      cost: result.cost,
      vendorInfo: APICK_DEBUG ? result.raw : undefined,
    });
  } catch (e) {
    const code = e?.status && Number(e.status) >= 400 ? Number(e.status) : 500;

    if (APICK_DEBUG) {
      console.error("\n[APICK][/verify] Error:");
      console.error("  message:", e?.message);
      console.error("  stack:", e?.stack);
    }

    return res.status(code).json({
      ok: false,
      error: String(e?.message || e),
    });
  }
});

export default router;