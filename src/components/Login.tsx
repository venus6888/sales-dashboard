import { useState, type FormEvent } from 'react'
import { LoginError, login } from '../lib/crypto'
import type { Summary } from '../lib/data'

export default function Login({ onSuccess }: { onSuccess: (data: Summary, session: string) => void }) {
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!id || !password) return setError('아이디와 비밀번호를 입력하십시오.')
    setBusy(true)
    setError(null)
    try {
      const { data, session } = await login(id, password)
      onSuccess(data, session)
    } catch (err) {
      setError(err instanceof LoginError ? '아이디 또는 비밀번호가 올바르지 않습니다.' : String((err as Error).message ?? err))
      setBusy(false)
    }
  }

  const field = 'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none focus:border-accent'
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-[380px] rounded-2xl border border-line bg-surface p-7 shadow-sm">
        <p className="text-xs font-medium tracking-wide text-muted">로얄앤컴퍼니 · 내부용</p>
        <h1 className="mt-1 text-[20px] font-bold tracking-tight text-ink">매출 집중도 대시보드</h1>
        <p className="mt-1 text-[13px] text-ink2">권한이 있는 사용자만 열람할 수 있습니다.</p>

        <label className="mt-6 block text-[13px] font-medium text-ink2">
          아이디
          <input className={field} value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoFocus />
        </label>
        <label className="mt-3 block text-[13px] font-medium text-ink2">
          비밀번호
          <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>

        {error && <p role="alert" className="mt-3 text-[13px] text-crit">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-accent px-4 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? '확인 중…' : '로그인'}
        </button>
        <p className="mt-4 text-[11.5px] leading-relaxed text-muted">
          ※ 거래처별 매출 등 회사 내부 정보가 포함되어 있습니다. 화면 캡처·외부 공유에 주의하십시오.
        </p>
      </form>
    </div>
  )
}
