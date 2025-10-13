// auth.js
import jwt from "jsonwebtoken";

export function authRequired(req, res, next) {
  const getJwtFromReq = (req) => {
    const fromHeader = req.headers.authorization?.split(" ")[1];
    const fromQuery = req.query.token;
    return (fromHeader || fromQuery || "").trim() || null;
  };

  const token = getJwtFromReq(req);
  if (!token) return res.status(401).json({ ok: false, message: "인증 필요" });
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email }
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "토큰 유효하지 않음" });
  }
}