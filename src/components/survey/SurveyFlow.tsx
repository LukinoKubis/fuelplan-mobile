import { useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Step0Start } from './steps/Step0Start'
import { Step1Training } from './steps/Step1Training'
import { Step2Food } from './steps/Step2Food'
import { Step3Macros } from './steps/Step3Macros'
import { LoadingOverlay } from '../shared/LoadingOverlay'
import { ErrorPanel } from '../shared/ErrorPanel'
import { usePlan } from '../../state/PlanContext'
import { useAccount } from '../../state/AccountContext'
import { ApiError, postClaude } from '../../lib/client'
import { buildGenerateRequest } from '../../lib/generatePrompt'
import { resolveProfileMacros } from '../../lib/macros'
import type { Plan } from '../../types/plan'
import { useThemeColors } from '../../lib/themeColors'

const TOTAL_STEPS = 4

interface SurveyFlowProps {
  onGenerated: () => void
  onBuyPlans: () => void
  canCancel: boolean
  onCancel: () => void
}

export function SurveyFlow({ onGenerated, onBuyPlans, canCancel, onCancel }: SurveyFlowProps) {
  const c = useThemeColors()
  const { profile, setProfile, setPlan, favorites } = usePlan()
  const { refreshRemaining } = useAccount()

  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<{ message: string; isOutOfPlans: boolean } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const patch = (p: Partial<typeof profile>) => setProfile(p)

  function toggleCuisine(value: string) {
    const exists = profile.cuisines.includes(value)
    setProfile({ cuisines: exists ? profile.cuisines.filter((v) => v !== value) : [...profile.cuisines, value] })
  }

  async function handleGenerate() {
    const macros = resolveProfileMacros(profile)
    if (!macros) {
      setError({ message: 'Please fill in all macro / stat fields.', isOutOfPlans: false })
      setStep(3)
      return
    }

    setLoading(true)
    setError(null)
    abortRef.current = new AbortController()

    try {
      const { system, messages, model, max_tokens } = buildGenerateRequest({ profile, macros, favorites })
      const response = await postClaude({ model, max_tokens, system, messages }, abortRef.current.signal)
      const rawText = response.content[0]?.text || ''
      const cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      let plan: Plan
      try {
        plan = JSON.parse(cleaned)
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Got invalid JSON back. Please try again.')
        plan = JSON.parse(match[0])
      }

      setPlan(plan, profile.name.trim() || 'Your')
      setLoading(false)
      refreshRemaining()
      onGenerated()
    } catch (err) {
      setLoading(false)
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof ApiError) {
        setError({ message: err.message, isOutOfPlans: err.status === 402 })
      } else {
        setError({ message: (err as Error).message || 'Unknown error occurred.', isOutOfPlans: false })
      }
    }
  }

  function handleCancelLoading() {
    abortRef.current?.abort()
    setLoading(false)
  }

  function next() {
    if (step === TOTAL_STEPS - 1) {
      handleGenerate()
      return
    }
    setStep((s) => s + 1)
  }

  function prev() {
    if (step === 0) {
      if (canCancel) onCancel()
      return
    }
    setStep((s) => s - 1)
  }

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-bg">
      <ScrollView contentContainerClassName="px-5 pb-28 pt-6" keyboardShouldPersistTaps="handled">
        <View className="mb-6 flex-row items-center gap-3">
          <View className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: c.border }}>
            <View className="h-full rounded-full bg-lime" style={{ width: `${(step / (TOTAL_STEPS - 1)) * 100}%` }} />
          </View>
          <Text className="text-xs font-semibold" style={{ color: c.muted }}>{step + 1}/4</Text>
        </View>

        {step === 0 && <Step0Start name={profile.name} onNameChange={(name) => patch({ name })} />}
        {step === 1 && (
          <Step1Training
            trainingDays={profile.trainingDays}
            onTrainingDays={(trainingDays) => patch({ trainingDays })}
            trainingStyle={profile.trainingStyle}
            onTrainingStyle={(trainingStyle) => patch({ trainingStyle })}
            cookingSkill={profile.cookingSkill}
            onCookingSkill={(cookingSkill) => patch({ cookingSkill })}
            prepTime={profile.prepTime}
            onPrepTime={(prepTime) => patch({ prepTime })}
          />
        )}
        {step === 2 && (
          <Step2Food
            dietPref={profile.dietPref}
            onDietPref={(dietPref) => patch({ dietPref })}
            dislikedFoods={profile.dislikedFoods}
            onDislikedFoods={(dislikedFoods) => patch({ dislikedFoods })}
            cuisines={profile.cuisines}
            onToggleCuisine={toggleCuisine}
            variety={profile.variety}
            onVariety={(variety) => patch({ variety })}
          />
        )}
        {step === 3 && <Step3Macros profile={profile} onChange={patch} />}
      </ScrollView>

      <View className="absolute inset-x-0 bottom-0 flex-row gap-3 border-t px-5 py-3" style={{ borderColor: c.border, backgroundColor: c.bg, paddingBottom: 24 }}>
        {(step > 0 || canCancel) && (
          <Pressable onPress={prev} className="rounded-xl border px-4 py-3" style={{ borderColor: c.border }}>
            <Text className="text-sm font-semibold" style={{ color: c.muted }}>Back</Text>
          </Pressable>
        )}
        <Pressable onPress={next} className="flex-1 items-center rounded-xl bg-lime py-3">
          <Text className="text-sm font-extrabold text-bg">{step === TOTAL_STEPS - 1 ? 'Generate My Plan' : 'Continue'}</Text>
        </Pressable>
      </View>

      {loading && <LoadingOverlay onCancel={handleCancelLoading} />}
      {error && (
        <ErrorPanel
          message={error.message}
          isOutOfPlans={error.isOutOfPlans}
          onRetry={() => {
            setError(null)
            handleGenerate()
          }}
          onDismiss={() => setError(null)}
          onTopUp={onBuyPlans}
        />
      )}
    </SafeAreaView>
  )
}
