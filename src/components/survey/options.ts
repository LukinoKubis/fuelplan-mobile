// Ported verbatim from fuelplan-frontend/src/components/survey/options.ts
import type { ChipOption } from './Chips'

export const TRAINING_DAYS_OPTIONS: ChipOption[] = [
  { value: '2', label: '2 days' },
  { value: '3', label: '3 days' },
  { value: '4', label: '4 days' },
  { value: '5', label: '5 days' },
  { value: '6', label: '6 days' },
  { value: '7', label: 'Every day' },
]

export const TRAINING_STYLE_OPTIONS: ChipOption[] = [
  { value: 'weightlifting', label: 'Weights' },
  { value: 'crossfit', label: 'CrossFit' },
  { value: 'running', label: 'Running' },
  { value: 'cycling', label: 'Cycling' },
  { value: 'swimming', label: 'Swimming' },
  { value: 'calisthenics', label: 'Calisthenics' },
  { value: 'yoga', label: 'Yoga' },
  { value: 'general', label: 'General' },
]

export const COOKING_SKILL_OPTIONS: ChipOption[] = [
  { value: 'beginner', label: 'Beginner', sub: 'Simple meals' },
  { value: 'intermediate', label: 'Intermediate', sub: 'Varied recipes' },
  { value: 'advanced', label: 'Advanced', sub: 'Complex prep' },
]

export const PREP_TIME_OPTIONS: ChipOption[] = [
  { value: '1 hour', label: '1 hour', sub: 'Quick & simple' },
  { value: '2 hours', label: '2 hours', sub: 'Well balanced' },
  { value: '3+ hours', label: '3+ hours', sub: 'Full batch cook' },
]

export const CUISINE_OPTIONS: ChipOption[] = [
  { value: 'Mediterranean', label: 'Mediterranean' },
  { value: 'Asian', label: 'Asian' },
  { value: 'Mexican', label: 'Mexican' },
  { value: 'American', label: 'American' },
  { value: 'European', label: 'European' },
  { value: 'no preference', label: 'No preference' },
]

export const VARIETY_OPTIONS = [
  { value: 'repeat', title: 'Repeat meals', desc: 'Same 2–3 meals all week. Easiest for prep.' },
  { value: 'some variety', title: 'Some variety', desc: 'Mix of repeated and new meals. Recommended.' },
  { value: 'fully diverse', title: 'Fully diverse', desc: 'Different meal every day. Maximum variety.' },
]

export const ACTIVITY_OPTIONS = [
  { value: '1.2', label: 'Sedentary — desk job, no exercise' },
  { value: '1.375', label: 'Lightly active — 1–3 days/week' },
  { value: '1.55', label: 'Moderately active — 3–5 days/week' },
  { value: '1.725', label: 'Very active — 6–7 days/week' },
]

/**
 * TDEE activity multiplier, derived from the training-days answer already
 * collected in step 1 rather than asked again as its own question — the
 * two used to be separate steps asking essentially "how many days do you
 * work out" twice. `TRAINING_DAYS_OPTIONS` only goes down to 2 (no 0/1-day
 * option exists yet), so "Sedentary" is a defensive fallback rather than a
 * reachable path today.
 */
export function activityFromTrainingDays(trainingDays: string): string {
  const days = parseInt(trainingDays, 10)
  if (days >= 6) return '1.725'
  if (days >= 4) return '1.55'
  if (days >= 2) return '1.375'
  return '1.2'
}
