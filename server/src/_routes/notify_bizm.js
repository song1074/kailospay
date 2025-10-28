// server/src/_routes/notify_bizm.js
import { Router } from "express";
import { sendAlimtalk } from "../vendors/bizm.js"; // ✅ 경로 수정

const router = Router();
const DEBUG = String(process.env.BIZM_DEBUG || "false") === "true";

const onlyDigits = (s) => String(s ?? "").replace(/\D/g, "");
const maskPhone82 = (phn) => {
  const p = String(phn || "");
  return p.length < 6 ? p : `${p.slice(0, 4)}****${p.slice(-2)}`;
};

// 라우터 내부 JWT 인증(공용 미들웨어 의존 제거)
function getJwtFromReq(req) {
  const fromHeader = req.headers.authorization?.split(" ")[1];
  const fromQuery = req.query.token;
  return (fromHeader || fromQuery || "").trim() || null;
}
async function auth(req, res, next) {
  const token = getJwtFromReq(req);
  if (!token) return res.status(401).json({ ok: false, message: "인증 필요" });
  try {
    const jwt = (await import("jsonwebtoken")).default;
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "토큰 유효하지 않음" });
  }
}

/**
 * Body:
 *  - { phone: "010...", message: "..." } 또는 { phone: "010...", rawMessage: "..." }
 *  - 선택: templateCode (없으면 .env의 BIZM_TEMPLATE_ID 사용)
 */
router.post("/alimtalk/test", auth, async (req, res) => {
  try {
    const phone = onlyDigits(req.body?.phone);
    const message = req.body?.message ?? req.body?.rawMessage;
    const templateCode = req.body?.templateCode || undefined;

    if (!phone || !String(message ?? "").trim()) {
      return res.status(400).json({ ok: false, vendor: "bizm", code: "invalid_request", message: "phone/message 필요" });
    }

    if (DEBUG) {
      console.log("[/api/notify/alimtalk/test][REQ]", {
        phone: maskPhone82(phone),
        templateCode: templateCode || "(default)",
        messagePreview: `[len=${String(message).length}]`,
      });
    }

    const result = await sendAlimtalk({ to: phone, message, templateCode });

    const raw = result?.raw ?? result;
    const first = Array.isArray(raw) ? raw[0] : raw;
    const ok = !!result?.ok || first?.code === "success";

    const payload = {
      ok,
      vendor: "bizm",
      code: first?.code || (ok ? "success" : "unknown"),
      message: first?.message || (ok ? "OK" : "Unknown"),
      data: { type: first?.data?.type, msgid: first?.data?.msgid, phn: first?.data?.phn },
      raw,
    };

    if (DEBUG) console.log("[/api/notify/alimtalk/test][RES]", {
      ok: payload.ok, code: payload.code, msgid: payload.data?.msgid, phn: maskPhone82(payload.data?.phn), type: payload.data?.type,
    });

    return res.status(ok ? 200 : 502).json(payload);
  } catch (e) {
    const errMsg = e?.message || "send fail";
    const bizm = e?.bizm;
    const raw = bizm ? [bizm] : undefined;

    if (DEBUG) console.error("[/api/notify/alimtalk/test][ERROR]", errMsg, bizm || e);

    return res.status(502).json({
      ok: false, vendor: "bizm",
      code: bizm?.code || "send_fail",
      message: bizm?.message || errMsg,
      error: { originMessage: bizm?.originMessage },
      raw,
    });
  }
});

export default router; // ✅ default export
