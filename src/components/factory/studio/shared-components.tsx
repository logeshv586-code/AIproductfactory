'use client'

import type { ReactNode } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { CUSTOMER_STEPS } from './constants'

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function Pill({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'blue' | 'green' | 'amber' | 'purple' }) {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-600',
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    purple: 'border-violet-200 bg-violet-50 text-violet-700',
  }
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium', tones[tone])}>{children}</span>
}

export function SectionTitle({ icon: Icon, eyebrow, title, text }: { icon: any; eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-2.5 text-blue-700 shadow-sm"><Icon className="h-5 w-5" /></div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
        {text && <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">{text}</p>}
      </div>
    </div>
  )
}

export function MetricCard({ label, value, helper, icon: Icon, tone = 'slate' }: { label: string; value: ReactNode; helper: string; icon: any; tone?: 'slate' | 'blue' | 'green' }) {
  const iconTone = tone === 'green' ? 'bg-emerald-50 text-emerald-600' : tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-500'
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <span className={cn('rounded-xl p-2', iconTone)}><Icon className="h-4 w-4" /></span>
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</div>
      <div className="mt-1 text-xs leading-5 text-slate-500">{helper}</div>
    </div>
  )
}

export function SimpleProgress({ current }: { current: number }) {
  return (
    <div className="grid gap-2 sm:grid-cols-4">
      {CUSTOMER_STEPS.map((step, index) => {
        const stepNumber = index + 1
        const complete = current > stepNumber
        const active = current === stepNumber
        return (
          <div key={step.number} className={cn(
            'rounded-2xl border px-4 py-3 transition',
            complete ? 'border-emerald-100 bg-emerald-50/80' : active ? 'border-blue-200 bg-blue-50/80 shadow-sm' : 'border-slate-200 bg-white/70',
          )}>
            <div className="flex items-center gap-2">
              <span className={cn(
                'grid h-7 w-7 place-items-center rounded-lg text-[11px] font-bold',
                complete ? 'bg-emerald-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500',
              )}>{complete ? <Check className="h-3.5 w-3.5" /> : step.number}</span>
              <span className="text-xs font-semibold text-slate-900">{step.title}</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">{step.text}</p>
          </div>
        )
      })}
    </div>
  )
}
