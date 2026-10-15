import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Login from './components/Login'
import { Segmented, Select } from './components/ui'
import { loadDemo, resume } from './lib/crypto'
import { buildPeriods, monthly, snapshot, type Filters, type PeriodMode, type Summary } from './lib/data'
import { eok, num, ymd } from './lib/format'
import type { Ctx } from './lib/insights'
import { useTokens } from './lib/useTokens'
import Customers from './views/Customers'
import Overview from './views/Overview'
import Regions from './views/Regions'

type Tab = 'overview' | 'regions' | 'customers'
const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: '집중도 개요' },
  { value: 'regions', label: '지역 포트폴리오' },
  { value: 'customers', label: '거래처 의존도' },
]

// 같은 탭에서 새로고침할 때만 로그인을 유지한다 (탭을 닫으면 사라짐)
const SESSION_KEY = 'royal-dashboard-session'
const storage = {
  get: () => { try { return sessionStorage.getItem(SESSION_KEY) } catch { return null } },
  set: (v: string) => { try { sessionStorage.setItem(SESSION_KEY, v) } catch { /* 저장 불가 시 매번 로그인 */ } },
  clear: () => { try { sessionStorage.removeItem(SESSION_KEY) } catch { /* noop */ } },
}

// 데모 모드(vite --mode demo): 로그인 없이 공개용 더미 데이터를 연다
const DEMO = import.meta.env.MODE === 'demo'

export default function App() {
  return DEMO ? <DemoApp /> : <SecureApp />
}

function DemoApp() {
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    loadDemo().then(setData).catch((e: Error) => setError(e.message))
  }, [])
  if (error) return <Shell><p className="text-crit">{error}</p></Shell>
  if (!data) return <Shell><p className="text-muted">불러오는 중…</p></Shell>
  return <Dashboard data={data} />
}

function SecureApp() {
  const [data, setData] = useState<Summary | null>(null)
  const [checking, setChecking] = useState(() => storage.get() !== null)
  useEffect(() => {
    const s = storage.get()
    if (!s) return
    resume(s)
      .then(setData)
      .catch(storage.clear) // 데이터가 재암호화되면 기존 세션은 무효
      .finally(() => setChecking(false))
  }, [])

  const logout = () => {
    storage.clear()
    setData(null)
  }

  if (checking) return <Shell><p className="text-muted">불러오는 중…</p></Shell>
  if (!data) return <Login onSuccess={(d, session) => { storage.set(session); setData(d) }} />
  return <Dashboard data={data} onLogout={logout} />
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-[1400px] px-4 py-10 sm:px-6">{children}</div>
}

function Dashboard({ data, onLogout }: { data: Summary; onLogout?: () => void }) {
  const t = useTokens()
  // #regions 처럼 주소로 화면을 바로 열 수 있게 한다 (회의 자료 링크용)
  const [tab, setTabState] = useState<Tab>(() => TABS.find((x) => `#${x.value}` === location.hash)?.value ?? 'overview')
  const setTab = (v: Tab) => {
    setTabState(v)
    history.replaceState(null, '', `#${v}`)
  }
  const [mode, setMode] = useState<PeriodMode>('Q')
  const periods = useMemo(() => buildPeriods(data.dims.months, mode), [data, mode])
  const [periodKey, setPeriodKey] = useState<string>('')
  const [filters, setFilters] = useState<Filters>({ channel: -1, division: -1, category: -1, includeNonGeo: false })

  const period = periods.find((p) => p.key === periodKey) ?? periods[periods.length - 1]
  const idx = periods.indexOf(period)
  const prevPeriod = idx > 0 ? periods[idx - 1] : null

  const series = useMemo(() => monthly(data, filters), [data, filters])
  const cur = useMemo(() => snapshot(data, filters, period.months), [data, filters, period])
  const prev = useMemo(() => (prevPeriod ? snapshot(data, filters, prevPeriod.months) : null), [data, filters, prevPeriod])
  const ctx: Ctx = {
    data,
    cur,
    prev,
    series,
    lastMonth: period.months[period.months.length - 1],
    periodLabel: period.label,
    prevLabel: prevPeriod?.label ?? null,
  }
  const set = (k: keyof Filters) => (v: string) => setFilters((f) => ({ ...f, [k]: Number(v) }))
  const opts = (vals: string[]) => [{ value: -1, label: '전체' }, ...vals.map((v, i) => ({ value: i, label: v }))]

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-6 pb-10 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted">{DEMO ? '데모 · 가상 데이터' : '로얄앤컴퍼니 · 경영진 분기 회의용'}</p>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-ink">매출 집중도 대시보드</h1>
        </div>
        <div className="text-right text-xs text-ink2">
          <div>데이터 기준: <b className="tabular text-ink">{ymd(data.meta.dataTo)}</b> 출고분까지</div>
          <div className="text-muted">출처: {data.meta.source}{DEMO ? '' : ` · 사업장 ${data.meta.site} · 내부용`}</div>
          {onLogout && (
            <button onClick={onLogout} className="mt-1.5 rounded-md border border-line px-2.5 py-1 text-xs text-ink2 hover:bg-wash">
              로그아웃
            </button>
          )}
        </div>
      </header>

      <div className="sticky top-0 z-10 -mx-4 mt-4 border-b border-line bg-page/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Segmented label="기간 단위" value={mode} onChange={(v) => { setMode(v); setPeriodKey('') }} options={[{ value: 'Q', label: '분기' }, { value: 'M', label: '월' }]} />
          <Select label="기간" value={period.key} onChange={setPeriodKey} options={periods.map((p) => ({ value: p.key, label: p.label }))} />
          <Segmented label="채널" value={filters.channel} onChange={(v) => setFilters((f) => ({ ...f, channel: v }))} options={opts(data.dims.channels.filter((c) => c !== '미지정'))} />
          <Select label="사업부" value={filters.division} onChange={set('division')} options={opts(data.dims.divisions)} />
          <Select label="제품 대분류" value={filters.category} onChange={set('category')} options={opts(data.dims.categories)} />
          <label className="flex items-center gap-2 text-[13px] text-ink2">
            <input type="checkbox" checked={filters.includeNonGeo} onChange={(e) => setFilters((f) => ({ ...f, includeNonGeo: e.target.checked }))} className="h-4 w-4 accent-[var(--series1)]" />
            지역 지표에 비지역·온라인 포함
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1" role="tablist">
          {TABS.map((x) => (
            <button
              key={x.value}
              role="tab"
              aria-selected={tab === x.value}
              onClick={() => setTab(x.value)}
              className={`rounded-lg px-3.5 py-2 text-[14px] ${tab === x.value ? 'bg-surface font-semibold text-ink shadow-[inset_0_0_0_1px_var(--border)]' : 'text-ink2 hover:bg-wash'}`}
            >
              {x.label}
            </button>
          ))}
        </nav>
        <p className="text-xs text-ink2">
          <b className="text-ink">{period.label}</b> 순매출 <b className="tabular text-ink">{eok(cur.total)}</b>
          {prevPeriod && <span className="text-muted"> · 비교: {prevPeriod.label}</span>}
          {period.partial && <span className="text-muted"> · 미완결 분기</span>}
        </p>
      </div>

      <main className="mt-4">
        {tab === 'overview' && <Overview ctx={ctx} t={t} />}
        {tab === 'regions' && <Regions ctx={ctx} t={t} includeNonGeo={filters.includeNonGeo} />}
        {tab === 'customers' && <Customers ctx={ctx} t={t} />}
      </main>

      <footer className="mt-8 border-t border-line pt-4 text-[11.5px] leading-relaxed text-muted">
        <p>
          <b className="text-ink2">산출 기준</b> · {data.meta.rules.join(' · ')} · HHI = Σ(비중%)², 순매출이 음수인 항목 제외
        </p>
        {DEMO ? (
          <>
            <p>기간 {ymd(data.meta.dataFrom)} ~ {ymd(data.meta.dataTo)} · 생성 {data.meta.generatedAt.replace('T', ' ')} ({data.meta.sourceFile})</p>
            <p>※ 본 화면의 거래처명·금액은 모두 무작위로 만든 가상 데이터이며 실제 거래처·매출과 관계없습니다.</p>
          </>
        ) : (
          <>
            <p>
              원본 {num(data.meta.sourceRows)}행 중 사업장 {data.meta.site} {num(data.meta.siteRows)}행 집계 · 기간 {ymd(data.meta.dataFrom)} ~ {ymd(data.meta.dataTo)} · 생성 {data.meta.generatedAt.replace('T', ' ')}
            </p>
            <p>※ 본 화면은 회사 내부 정보(거래처별 매출)를 포함하므로 외부 공유에 주의하시기 바랍니다.</p>
          </>
        )}
      </footer>
    </div>
  )
}
