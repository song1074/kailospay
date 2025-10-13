import { useEffect, useState } from 'react';
import api from '../lib/api';

export default function Dashboard() {
  const [msg, setMsg] = useState('로딩 중...');

  useEffect(() => {
    api.get('/api/me/profile')
      .then((res) => setMsg(res.data.message))
      .catch(() => setMsg('인증 실패 또는 토큰 만료'));
  }, []);

  return (
    <div className="container-x py-10">
      <h2 className="text-2xl font-bold mb-2">대시보드</h2>
      <p>{msg}</p>
    </div>
  );
}
