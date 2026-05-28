'use client';

import { useState, useEffect } from 'react';
import { Lock, CheckCircle, XCircle } from 'lucide-react';

export default function AccessPasswordModal({ isOpen, onClose }) {
  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPassword(localStorage.getItem('smart-excalidraw-access-password') || '');
      setUsePassword(localStorage.getItem('smart-excalidraw-use-password') === 'true');
    }
  }, [isOpen]);

  const handleValidate = async () => {
    if (!password) { setMessage('请输入访问密码'); setMessageType('error'); return; }
    setIsValidating(true); setMessage('');
    try {
      const response = await fetch('/api/auth/validate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await response.json();
      if (data.valid) { setMessage('密码验证成功'); setMessageType('success'); }
      else { setMessage(data.message || '密码验证失败'); setMessageType('error'); }
    } catch { setMessage('验证请求失败'); setMessageType('error'); }
    finally { setIsValidating(false); }
  };

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart-excalidraw-access-password', password);
      localStorage.setItem('smart-excalidraw-use-password', usePassword.toString());
      window.dispatchEvent(new CustomEvent('password-settings-changed', { detail: { usePassword } }));
    }
    setMessage('设置已保存'); setMessageType('success');
    setTimeout(() => onClose(), 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white/80 backdrop-blur-2xl rounded-3xl border border-white/15 shadow-[0_20px_60px_rgba(15,23,42,0.12)] w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-4">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-[var(--muted)]" />
            <h2 className="text-lg font-semibold tracking-tight text-[var(--fg)]">访问密码设置</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-xl text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 transition-all duration-200">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-7 pb-6 space-y-4">
          {message && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl ${messageType === 'success' ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
              {messageType === 'success' ? <CheckCircle size={15} className="text-emerald-500" /> : <XCircle size={15} className="text-red-500" />}
              <p className={`text-sm ${messageType === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>{message}</p>
            </div>
          )}

          <div className="px-4 py-3 rounded-xl bg-[var(--accent-indigo)]/5 border border-[var(--accent-indigo)]/10">
            <p className="text-xs text-[var(--accent-indigo)] font-medium mb-1">提示</p>
            <p className="text-xs text-[var(--accent-indigo)]/80">访问密码优先级高于前端 LLM 配置，启用后将使用服务器端配置</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--fg)] mb-1.5">访问密码</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入访问密码" className="w-full px-4 py-2.5 text-sm bg-black/4 border border-black/5 rounded-xl text-[var(--fg)] placeholder:text-[var(--muted)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--accent-indigo)]/30 transition-all duration-200" />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="rounded" />
              <span className="text-sm text-[var(--fg)]">启用访问密码</span>
            </label>
            <button onClick={handleValidate} disabled={isValidating} className="px-4 py-2 text-xs text-[var(--accent-indigo)] bg-[var(--accent-indigo)]/10 hover:bg-[var(--accent-indigo)]/20 rounded-xl transition-all duration-200 disabled:opacity-50">
              {isValidating ? '验证中...' : '验证密码'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-7 py-4 border-t border-black/5">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[var(--muted)] hover:text-[var(--fg)] hover:bg-black/5 rounded-xl transition-all duration-200">取消</button>
          <button onClick={handleSave} className="px-5 py-2 text-sm text-white bg-[var(--primary)] rounded-xl hover:bg-[var(--primary)]/90 active:scale-[0.98] transition-all duration-200 font-medium">保存</button>
        </div>
      </div>
    </div>
  );
}
