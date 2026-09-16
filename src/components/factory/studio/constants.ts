import type { CustomerPriority } from './types'

export const EXAMPLES = [
  {
    title: 'WhatsApp lead tracker',
    text: 'Create a simple system that captures new WhatsApp leads, organizes them by status, reminds my team to follow up and shows which leads are most likely to convert.',
  },
  {
    title: 'AI sales assistant',
    text: 'Create an AI automation that researches a company, finds relevant prospects, drafts personalized outreach and requires manager approval before sending.',
  },
  {
    title: 'Local AI video studio',
    text: 'Build a local-first AI video generation product with a simple prompt and reference-image workflow, scene continuity and optimized execution on a consumer GPU.',
  },
  {
    title: 'Invoice follow-up',
    text: 'Build an assistant that reads unpaid invoices, reminds customers at the right time, tracks replies and asks a manager before sending sensitive follow-ups.',
  },
]

export const PRIORITIES: Array<{ id: CustomerPriority; title: string; text: string }> = [
  { id: 'speed', title: 'Launch quickly', text: 'Simpler plan with fewer moving parts.' },
  { id: 'balanced', title: 'Best balance', text: 'Strong quality without unnecessary complexity.' },
  { id: 'scale', title: 'Built to scale', text: 'More governance and long-term resilience.' },
]

export const CUSTOMER_STEPS = [
  { number: '01', title: 'Describe', text: 'Tell us the result you want in your own words.' },
  { number: '02', title: 'Understand & research', text: 'AI turns it into requirements and finds relevant evidence.' },
  { number: '03', title: 'Choose', text: 'Compare three plans written for normal people.' },
  { number: '04', title: 'Build & verify', text: 'Approve one plan, lock the sources and run the build checks.' },
]
