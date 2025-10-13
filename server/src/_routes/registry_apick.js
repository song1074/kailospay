// server/src/_routes/registry_apick.js
import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { pool } from "../../db.js";
import { apickIssue, apickDownloadPdf } from "../vendors/apick.js";

const router = Router();

// 저장 디렉토리 -----------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SAVE_DIR   = path.join(__dirname, "..", "..", "uploads", "registry");
if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

// helpers ----------------------------------------------------------------
const ok  = (res, body) => res.status(200).json(body);
const err = (res, code, e) => res.status(code).json({ ok: false, error: String(e?.message ?? e) });

// 발급 -------------------------------------------------------------------
router.post("/issue", async (req, res) => {
  const userId = req.user?.id || null; // 비로그인 허용
  const {
    address = null,
    uniqueKey = null,
    reg_num = null,
    biz_num = null,
  } = req.body ?? {};

  try {
    // 1) 중복 과금 방지(uniqueKey) — 최근 요청 재사용
    if (uniqueKey) {
      const { rows: ex } = await pool.query(
        `SELECT id, ic_id, status, pdf_saved
           FROM registry_requests
          WHERE unique_key = $1
          ORDER BY id DESC
          LIMIT 1`,
        [uniqueKey]
      );
      if (ex[0]) {
        const r = ex[0];
        if (r.status === "ready" && r.pdf_saved) {
          return ok(res, {
            ok: true,
            requestId: r.id,
            ic_id: r.ic_id,
            status: "ready",
            download: `/api/registry/apick/download/${r.id}`,
          });
        }
        return ok(res, { ok: true, requestId: r.id, ic_id: r.ic_id, status: r.status || "pending" });
      }
    }

    // 2) APICK 발급 – 주소/번호 중 우선순위대로 payload 구성
    //    apickIssue()는 address(부동산) 또는 reg_num/biz_num(법인) 중 하나를 받아야 함
    const payload = {};
    if (address) payload.address = String(address).trim();          // ★ 부동산 등기(주소) 키는 'address'
    else if (reg_num) payload.reg_num = String(reg_num).trim();     // ★ 법인(등기번호)
    else if (biz_num) payload.biz_num = String(biz_num).trim();     // ★ 법인(사업자번호)

    const out = await apickIssue(payload);

    // 응답에서 ic_id/메시지/비용 방어적 파싱
    const ic_id   = out?.ic_id ?? out?.data?.ic_id;
    const message = out?.message ?? out?.data?.message ?? null;
    const costPt  = out?.api?.cost ?? out?.data?.cost ?? out?.est_point ?? null;

    if (!ic_id) throw new Error("APICK 응답에 ic_id 없음");

    // 3) DB 기록 (provider/action/request_json 포함)
    const provider    = "apick";
    const action      = "issue";
    const requestJson = JSON.stringify({ address, reg_num, biz_num, uniqueKey });

    const { rows } = await pool.query(
      `INSERT INTO registry_requests
         (user_id, vendor, provider, action,
          address, unique_key, ic_id,
          status, message, cost_point, request_json,
          created_at, updated_at)
       VALUES
         ($1,'apick',$2,$3,
          $4,$5,$6,
          'pending',$7,$8,$9,
          now(), now())
       RETURNING id, ic_id, status`,
      [
        userId,
        provider,
        action,
        address || null,
        uniqueKey || null,
        ic_id,
        message,
        costPt,
        requestJson,
      ]
    );

    return ok(res, { ok: true, requestId: rows[0].id, ic_id: rows[0].ic_id, status: rows[0].status });
  } catch (e) {
    console.error("[apick/issue]", e);
    return err(res, 500, e);
  }
});

// 상태 확인 + 저장 -------------------------------------------------------
router.get("/status/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return err(res, 400, "bad id");

  try {
    const { rows } = await pool.query(
      `SELECT id, ic_id, status, pdf_saved
         FROM registry_requests
        WHERE id=$1`,
      [id]
    );
    const row = rows[0];
    if (!row) return err(res, 404, "not found");

    // 이미 저장된 경우
    if (row.status === "ready" && row.pdf_saved) {
      return ok(res, { ok: true, status: "ready", download: `/api/registry/apick/download/${row.id}` });
    }

    // APICK 다운로드 시도 (아직 준비 안됐으면 pending)
    const r = await apickDownloadPdf(row.ic_id);
    if (r?.notReady) return ok(res, { ok: true, status: "pending" });

    // PDF 저장
    const fname = `apick_${row.ic_id}.pdf`;
    fs.writeFileSync(path.join(SAVE_DIR, fname), r.pdf);

    await pool.query(
      `UPDATE registry_requests
          SET status='ready', pdf_saved=$2, updated_at=now()
        WHERE id=$1`,
      [id, fname]
    );

    return ok(res, { ok: true, status: "ready", download: `/api/registry/apick/download/${id}` });
  } catch (e) {
    console.error("[apick/status]", e);
    try {
      await pool.query(
        `UPDATE registry_requests
            SET status='failed', message=$2, updated_at=now()
          WHERE id=$1`,
        [Number(req.params.id), String(e?.message ?? e).slice(0, 500)]
      );
    } catch {}
    return err(res, 500, e);
  }
});

// 다운로드 ---------------------------------------------------------------
router.get("/download/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).send("bad id");

  try {
    const { rows } = await pool.query(
      `SELECT pdf_saved FROM registry_requests WHERE id=$1 LIMIT 1`,
      [id]
    );
    const row = rows[0];
    if (!row?.pdf_saved) return res.status(404).send("file not ready");

    const full = path.join(SAVE_DIR, row.pdf_saved);
    if (!fs.existsSync(full)) return res.status(404).send("file missing");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${row.pdf_saved}"`);
    fs.createReadStream(full).pipe(res);
  } catch (e) {
    console.error("[apick/download]", e);
    res.status(500).send("download error");
  }
});

export default router;
