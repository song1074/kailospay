// server/src/_routes/contracts.js
import express from "express";
import multer from "multer";
import { pool } from "../../db.js";
const router = express.Router();
const upload = multer({ limits: { fileSize: 20 * 1024 * 1024 } });

router.post("/", async (req, res) => {
  try {
    const { title, category, amount } = req.body ?? {};
    const { rows } = await pool.query(
      `INSERT INTO contracts (title, category, amount) VALUES ($1,$2,$3) RETURNING id`,
      [title, category, amount || 0]
    );
    res.json({ ok: true, id: rows[0].id });
  } catch (e) {
    res.status(500).json({ ok: false, message: "임시저장 실패" });
  }
});

router.post("/:id/files", upload.array("files", 10), async (req, res) => {
  try {
    // 파일 저장/업로드 처리 (S3 등) — 여기서는 개수만 리턴
    res.json({ ok: true, count: (req.files || []).length });
  } catch (e) {
    res.status(500).json({ ok: false, message: "파일 업로드 실패" });
  }
});

export default router;
