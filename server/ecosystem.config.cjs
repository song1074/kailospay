module.exports = {
  apps: [
    {
      name: "kailospay-api",
      cwd: __dirname,                 // server 폴더를 작업 디렉토리로
      script: "node",
      args: "server.js",              // ← 실제 진입파일(예: server.js 또는 run.mjs)로 바꿔도 됨
      instances: 1,                   // CPU 코어 수만큼 늘리고 싶으면 "max"
      exec_mode: "fork",              // "cluster"로 바꿔도 됨
      watch: false,                   // 운영에서는 false 권장
      env: {                          // 공통
        NODE_ENV: "production",
      },
      env_production: {               // pm2 start ecosystem.config.js --env production
        NODE_ENV: "production"
      },
      // nvm을 쓸 때 특정 Node 버전 고정하고 싶으면 아래 interpreter 사용(선택):
      // interpreter: "/root/.nvm/versions/node/v22.*/bin/node"
      // 또는 시맨틱 링크: interpreter: process.env.HOME + "/.nvm/versions/node/$(node -v)/bin/node"
    }
  ]
};
