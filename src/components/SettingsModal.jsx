import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

const API_CHECKS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', endpoint: '/api/anthropic/v1/messages', method: 'POST' },
  { id: 'youtube', label: 'YouTube Data API', endpoint: '/api/youtube/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw', method: 'GET' },
  { id: 'gemini', label: 'Gemini (이미지 생성)', endpoint: '/api/gemini/models', method: 'GET' },
];

export default function SettingsModal({ isOpen, onClose, globalState, updateState }) {
  const [clientId, setClientId] = useState(globalState.settings.googleClientId || '');
  const [statuses, setStatuses] = useState({});
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setClientId(globalState.settings.googleClientId || '');
      setStatuses({});
    }
  }, [isOpen, globalState.settings.googleClientId]);

  if (!isOpen) return null;

  const handleSave = () => {
    // Only Google Client ID is stored in browser (it's a public value)
    if (clientId) {
      localStorage.setItem('googleClientId', clientId);
    } else {
      localStorage.removeItem('googleClientId');
    }
    updateState('settings', { ...globalState.settings, googleClientId: clientId });
    onClose();
  };

  const testConnections = async () => {
    setIsTesting(true);
    const results = {};

    // Test Anthropic
    try {
      const res = await fetch('/api/anthropic/v1/messages', {
        method: 'POST',
        headers: { 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
      });
      results.anthropic = res.ok ? 'ok' : `error:${res.status}`;
    } catch (e) {
      results.anthropic = 'error:network';
    }

    // Test YouTube
    try {
      const res = await fetch('/api/youtube/channels?part=id&id=UC_x5XG1OV2P6uZZ5FSM9Ttw');
      results.youtube = res.ok ? 'ok' : `error:${res.status}`;
    } catch (e) {
      results.youtube = 'error:network';
    }

    // Test Gemini
    try {
      const res = await fetch('/api/gemini/models');
      results.gemini = res.ok ? 'ok' : `error:${res.status}`;
    } catch (e) {
      results.gemini = 'error:network';
    }

    setStatuses(results);
    setIsTesting(false);
  };

  const getStatusDisplay = (id) => {
    const s = statuses[id];
    if (!s) return null;
    if (s === 'ok') return <span style={{ color: '#16a34a', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><CheckCircle2 size={16} /> 연결됨</span>;
    return <span style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><XCircle size={16} /> 실패 ({s.replace('error:', '')})</span>;
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">설정</h2>
          <button className="modal-close" onClick={onClose}><X size={24} /></button>
        </div>
        <div className="modal-body">

          {/* Server-side API Keys Info */}
          <div style={{ padding: '1rem', backgroundColor: 'var(--gray-100)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontWeight: 600 }}>
              <AlertCircle size={16} color="var(--primary)" /> API 키 관리
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
              API 키는 <code style={{ backgroundColor: 'var(--gray-200)', padding: '0.125rem 0.25rem', borderRadius: '2px' }}>.env</code> 파일에서 서버 사이드로 관리됩니다.
              브라우저에는 키가 전달되지 않습니다.
            </p>
            <pre style={{ fontSize: '0.75rem', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--surface)', borderRadius: '4px', border: '1px solid var(--border)', overflowX: 'auto' }}>
{`ANTHROPIC_API_KEY=sk-ant-...
YOUTUBE_API_KEY=AIza...
GEMINI_API_KEY=AIza...
VITE_GOOGLE_CLIENT_ID=...apps.googleusercontent.com`}
            </pre>
          </div>

          {/* Connection Status */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <label className="form-label" style={{ margin: 0 }}>API 연결 상태</label>
              <button className="btn-secondary" onClick={testConnections} disabled={isTesting} style={{ fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}>
                {isTesting ? <><Loader2 className="animate-spin" size={14} /> 테스트 중...</> : '연결 테스트'}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {API_CHECKS.map(api => (
                <div key={api.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontWeight: 500 }}>{api.label}</span>
                  {getStatusDisplay(api.id) || <span style={{ color: 'var(--gray-400)', fontSize: '0.875rem' }}>미확인</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Google Client ID (public, stored in browser) */}
          <div className="form-group">
            <label className="form-label">Google OAuth Client ID (YouTube 업로드용)</label>
            <input
              type="text"
              className="form-control"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder="123456789.apps.googleusercontent.com"
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              OAuth Client ID는 공개 값으로, 브라우저에 저장됩니다.
              <code style={{ backgroundColor: 'var(--gray-200)', padding: '0.125rem 0.25rem', borderRadius: '2px', marginLeft: '0.25rem' }}>VITE_GOOGLE_CLIENT_ID</code>로 .env에 설정하면 자동 로드됩니다.
            </div>
          </div>

        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>취소</button>
          <button className="btn-primary" onClick={handleSave}>저장</button>
        </div>
      </div>
    </div>
  );
}
