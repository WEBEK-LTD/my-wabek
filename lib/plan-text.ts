// Shows admin-written plan text (name, description, features) in the
// visitor's language. English text stays as written; known phrases are
// translated from locales/public/plan-text.ts; unknown phrases fall back to
// the original so nothing is ever hidden.
import { lookupPlanText } from '@/locales/public/plan-text'

export function localizePlanText(text: string | null | undefined, lang: string): string {
  if (!text) return text ?? ''
  if (lang === 'en') return text
  return lookupPlanText(text, lang) ?? text
}

export function localizePlan<P extends { name: string; description?: string | null; features?: string[] | null }>(plan: P, lang: string): P {
  if (lang === 'en') return plan
  return {
    ...plan,
    name: localizePlanText(plan.name, lang),
    description: plan.description ? localizePlanText(plan.description, lang) : plan.description,
    features: Array.isArray(plan.features) ? plan.features.map(f => localizePlanText(String(f), lang)) : plan.features,
  }
}
