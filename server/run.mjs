// run.mjs — PM2로 ESM 서버 구동용 런처

// 1) .env를 가장 먼저 로드
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// (선택) 부팅 확인 로그
console.log('[BOOT] node =', process.version, 'exec =', process.execPath);
console.log('[BOOT] .env loaded');
console.log('[BOOT] EKYC_TEST_MODE =', process.env.EKYC_TEST_MODE);
console.log('[BOOT] IDCARD_FULL   =', process.env.CLOVA_EKYC_IDCARD_FULL);

// 2) 전역 에러 핸들러 (어디서 죽는지 위치 찍기)
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection:\n', reason?.stack || reason);
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception:\n', err?.stack || err);
  process.exit(1);
});

// 3) 서버 진입 (ESM dynamic import) + 에러 캐치
try {
  await import('./server.js');
  // server.js 내부에서 앱 실행/리슨을 시작합니다.
} catch (err) {
  console.error('[FATAL] Failed to start server\n', err?.stack || err);
  process.exit(1);
}

// 4) PM2 그레이스풀 종료 신호 처리 (선택)
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    console.log(`[BOOT] Received ${sig}, shutting down...`);
    // server.js에서 export한 stop()이 있다면 불러서 정리하도록 확장 가능
    // ex) (await import('./server.js')).stop?.().finally(() => process.exit(0));
    process.exit(0);
  });
}
