import type { ReactNode } from 'react'
import { THRESHOLDS } from '../config'

export function Card({ title, note, children, className = '' }: { title?: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      {title && (
        <header className="mb-3">
          <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
          {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
        </header>
      )}
      {children}
    </section>
  )
}

export type Level = 'ok' | 'warn' | 'danger'

export function customerLevel(share: number): Level {
  if (share >= THRESHOLDS.customerDanger) return 'danger'
  if (share >= THRESHOLDS.customerWarn) return 'warn'
  return 'ok'
}

// 상태는 색만으로 전달하지 않는다 — 아이콘 + 라벨 동반
export function StatusBadge({ level, label }: { level: Level; label?: string }) {
  if (level === 'ok') return null
  const danger = level === 'danger'
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${danger ? 'text-crit' : 'text-warn'}`}
      style={{ background: `color-mix(in srgb, var(${danger ? '--critical' : '--warning'}) 14%, transparent)` }}
    >
      <span aria-hidden>{danger ? '⛔' : '⚠'}</span>
      {label ?? (danger ? '위험' : '주의')}
    </span>
  )
}

export function StatTile({
  label,
  value,
  subject,
  delta,
  level = 'ok',
  levelLabel,
  footnote,
}: {
  label: string
  value: string
  subject?: string
  delta?: string
  level?: Level
  levelLabel?: string
  footnote?: string
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[13px] font-medium text-ink2">{label}</span>
        <StatusBadge level={level} label={levelLabel} />
      </div>
      <div className="mt-2 text-[28px] leading-none font-semibold tracking-tight text-ink">{value}</div>
      {subject && <div className="mt-1.5 truncate text-[13px] text-ink2" title={subject}>{subject}</div>}
      {delta && <div className="mt-1 text-xs text-muted">전 기간 대비 <span className="tabular text-ink2">{delta}</span></div>}
      {footnote && <div className="mt-auto pt-2 text-[11px] text-muted">{footnote}</div>}
    </div>
  )
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg border border-line bg-surface p-0.5">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-[13px] transition-colors ${
            o.value === value ? 'bg-wash font-semibold text-ink shadow-[inset_0_0_0_1px_var(--border)]' : 'text-ink2 hover:bg-wash'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Select({
  value,
  options,
  onChange,
  label,
}: {
  value: string | number
  options: { value: string | number; label: string }[]
  onChange: (v: string) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 text-[13px] text-ink2">
      <span className="shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export interface Insight {
  type: '이상 탐지' | '추세 경고' | '착시 경고' | '참고'
  text: string
  basis: string
}

export function InsightPanel({ items }: { items: Insight[] }) {
  return (
    <Card title="생각해 볼 지점" note="탐지 조건에 따라 자동 생성된 제안입니다. 결론이 아니므로 근거 수치를 함께 확인하십시오.">
      {items.length === 0 ? (
        <p className="text-[13px] text-muted">현재 조건에서 탐지된 항목이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {items.slice(0, 3).map((it, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-0.5 h-fit shrink-0 rounded-md bg-wash px-1.5 py-0.5 text-[11px] font-semibold text-ink2">{it.type}</span>
              <div className="min-w-0">
                <p className="text-[13.5px] text-ink">{it.text}</p>
                <p className="mt-0.5 text-[11.5px] text-muted">근거: {it.basis}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function ChartTooltip({ active, payload, label, fmt }: { active?: boolean; payload?: any[]; label?: string; fmt: (v: number, name: string) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-ink">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 text-ink2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}</span>
          <span className="tabular ml-auto pl-3 font-medium text-ink">{fmt(p.value, p.name)}</span>
        </div>
      ))}
    </div>
  )
}
