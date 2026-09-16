import { terms } from './nlp-utils'

export function inferDomain(idea: string) {
  const value = idea.toLowerCase()
  if (/desktop|computer use|rpa|powerpoint|pptx|excel|xlsx|word|docx|office/.test(value)) return 'AI desktop & office automation'
  if (/sales|crm|lead|prospect|outreach/.test(value)) return 'Sales & CRM'
  if (/video|animation|image generation|diffusion/.test(value)) return 'Video & Media AI'
  if (/document|pdf|ocr|knowledge base|rag/.test(value)) return 'Documents & Knowledge'
  if (/automation|workflow|agent|process/.test(value)) return 'Business Automation'
  return 'General software product'
}

export function productArchetype(idea: string) {
  const value = idea.toLowerCase()
  if (/desktop|computer use|rpa/.test(value) && /vision|screen|screenshot/.test(value)) return 'vision driven desktop automation agent'
  if (/powerpoint|excel|word|office|pptx|xlsx|docx/.test(value)) return 'AI office automation assistant'
  if (/video|animation|diffusion/.test(value)) return 'AI media generation studio'
  if (/sales|crm|lead|outreach/.test(value)) return 'AI sales automation assistant'
  if (/invoice|billing|payment/.test(value)) return 'finance workflow automation assistant'
  return terms(idea, 8).join(' ') || 'AI software product'
}
