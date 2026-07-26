import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import Svg, { Path, Polyline } from 'react-native-svg'
import { usePlan } from '../../../state/PlanContext'
import { useAccount } from '../../../state/AccountContext'
import { SurveyFlow } from '../../../components/survey/SurveyFlow'
import { CustomPlanFlow } from '../../../components/survey/CustomPlanFlow'
import { NewPlanChooser } from '../../../components/survey/NewPlanChooser'
import { DayTabs } from '../../../components/fuel/DayTabs'
import { DayMacroBar } from '../../../components/fuel/DayMacroBar'
import { MealCard } from '../../../components/fuel/MealCard'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { ApiError, createCheckout, postClaudeSuggest } from '../../../lib/client'
import { buildDayAdviceRequest } from '../../../lib/advicePrompt'
import { useThemeColors } from '../../../lib/themeColors'
import { friendlyErrorMessage } from '../../../lib/errorMessage'

/** Fuel tab — shows the survey (no plan yet / regenerating) or the day switcher + macro bar + meal cards. */
export default function FuelScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const { plan, favorites, eaten, toggleEaten, toggleFavorite, surveyMode, setSurveyMode } = usePlan()
  const { remaining } = useAccount()
  const [activeDay, setActiveDay] = useState(() => {
    const todayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })
    const todayIndex = plan?.days.findIndex((d) => d.day === todayName) ?? -1
    return todayIndex >= 0 ? todayIndex : 0
  })

  const showSurvey = !plan || surveyMode
  // Which new-plan path is active. null only happens for a brand-new user
  // (no plan yet) before they've picked one — NewPlanChooser handles that
  // case. Existing users pick directly via the two header pills below,
  // which always set this alongside setSurveyMode(true), so it's never
  // null when a plan already exists.
  const [flowMode, setFlowMode] = useState<'survey' | 'custom' | null>(null)

  const [advice, setAdvice] = useState<{ day: number; text: string } | null>(null)
  const [adviceLoading, setAdviceLoading] = useState(false)
  const [adviceError, setAdviceError] = useState('')

  async function handleGetAdvice() {
    if (!plan) return
    const day = plan.days[Math.min(activeDay, plan.days.length - 1)]
    setAdviceLoading(true)
    setAdviceError('')
    setAdvice(null)
    try {
      const { system, messages, model, max_tokens } = buildDayAdviceRequest(day, plan.summary)
      const response = await postClaudeSuggest({ model, max_tokens, system, messages })
      const text = response.content[0]?.text?.trim() || "Couldn't get advice this time — try again."
      setAdvice({ day: activeDay, text })
    } catch (err) {
      setAdviceError(err instanceof ApiError ? err.message : friendlyErrorMessage(err))
    } finally {
      setAdviceLoading(false)
    }
  }

  async function handleBuyPlans() {
    try {
      const { url } = await createCheckout('10')
      await WebBrowser.openBrowserAsync(url)
    } catch {
      /* non-critical */
    }
  }

  if (showSurvey) {
    if (!flowMode) {
      return <NewPlanChooser onGenerate={() => setFlowMode('survey')} onCustom={() => setFlowMode('custom')} />
    }
    return (
      <ErrorBoundary onReset={() => { setSurveyMode(false); setFlowMode(null) }}>
        {flowMode === 'survey' ? (
          <SurveyFlow
            onGenerated={() => {
              setSurveyMode(false)
              setFlowMode(null)
              setActiveDay(0)
              router.push('/modal/plan-name')
            }}
            onBuyPlans={handleBuyPlans}
            canCancel
            onCancel={() => { setSurveyMode(false); setFlowMode(null) }}
          />
        ) : (
          <CustomPlanFlow
            onCreated={() => {
              setSurveyMode(false)
              setFlowMode(null)
              setActiveDay(0)
              router.push('/modal/plan-name')
            }}
            canCancel
            onCancel={() => { setSurveyMode(false); setFlowMode(null) }}
          />
        )}
      </ErrorBoundary>
    )
  }

  const day = plan.days[Math.min(activeDay, plan.days.length - 1)]
  const isFavorite = (name: string) => favorites.some((f) => f.name === name)

  return (
    <ErrorBoundary onReset={() => setActiveDay(0)}>
      <View className="flex-1 bg-light-bg dark:bg-bg">
        <DayTabs days={plan.days.map((d) => d.day)} active={activeDay} onChange={setActiveDay} />
        <DayMacroBar day={day} target={plan.summary} />

        <ScrollView contentContainerClassName="gap-3 p-4">
          {day.meals.length === 0 ? (
            <View className="items-center rounded-2xl border border-dashed px-5 py-10" style={{ borderColor: c.border }}>
              <Text className="mb-1 text-center text-sm font-bold" style={{ color: c.text }}>No meals on {day.day} yet</Text>
              <Text className="mb-4 text-center text-xs" style={{ color: c.muted }}>
                Browse the recipe library and add meals one at a time to build this day yourself.
              </Text>
              <Pressable
                onPress={() => router.push({ pathname: '/(tabs)/recipes/library', params: { presetDay: day.day } })}
                className="items-center rounded-xl bg-lime px-5 py-2.5"
              >
                <Text className="text-sm font-extrabold text-bg">Browse Recipe Library →</Text>
              </Pressable>
            </View>
          ) : (
            day.meals.map((meal, i) => (
              <MealCard
                key={i}
                meal={meal}
                eaten={!!eaten[`${day.day}-${i}`]}
                onToggleEaten={() => toggleEaten(`${day.day}-${i}`)}
                favorite={isFavorite(meal.name)}
                onToggleFavorite={() => toggleFavorite(meal.name)}
                onReplace={() =>
                  router.push({ pathname: '/(tabs)/recipes/library', params: { replaceDay: day.day, replaceMealIndex: String(i), replaceMealName: meal.name } })
                }
              />
            ))
          )}
          {day.meals.length > 0 && (
            <Pressable
              onPress={() => router.push({ pathname: '/(tabs)/recipes/library', params: { presetDay: day.day } })}
              className="items-center rounded-xl border border-dashed px-4 py-3"
              style={{ borderColor: c.border }}
            >
              <Text className="text-xs font-bold" style={{ color: c.muted }}>+ Add another meal to {day.day}</Text>
            </Pressable>
          )}

          {/* Secondary actions — deliberately below the food, not competing with it for top-of-screen attention */}
          <View className="mt-2 gap-2 border-t pt-4" style={{ borderColor: c.border }}>
            <Pressable
              onPress={handleGetAdvice}
              disabled={adviceLoading}
              className="flex-row items-center justify-center gap-1.5 rounded-xl border px-3.5 py-2"
              style={{ borderColor: c.blue, backgroundColor: 'rgba(87,169,255,0.1)', opacity: adviceLoading ? 0.6 : 1 }}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c.blue} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
                <Path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
              </Svg>
              <Text className="text-xs font-bold" style={{ color: c.blue }}>
                {adviceLoading ? 'Thinking…' : `Get AI Advice for ${day.day}`}
              </Text>
            </Pressable>
            {adviceError ? <Text className="text-xs" style={{ color: c.red }}>{adviceError}</Text> : null}
            {advice && advice.day === activeDay && (
              <View className="rounded-xl border px-3.5 py-3" style={{ borderColor: c.blue, backgroundColor: 'rgba(87,169,255,0.08)' }}>
                <Text className="text-xs leading-5" style={{ color: c.text }}>{advice.text}</Text>
              </View>
            )}

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => { setSurveyMode(true); setFlowMode('survey') }}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl px-3 py-2"
                style={{ backgroundColor: c.lime }}
              >
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#0e0f11" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 5v14M5 12h14" />
                </Svg>
                <Text className="text-xs font-extrabold text-bg">Generate</Text>
              </Pressable>
              <Pressable
                onPress={() => { setSurveyMode(true); setFlowMode('custom') }}
                className="flex-1 flex-row items-center justify-center gap-1.5 rounded-xl border px-3 py-2"
                style={{ borderColor: c.border, backgroundColor: c.bg2 }}
              >
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </Svg>
                <Text className="text-xs font-bold" style={{ color: c.text }}>Custom</Text>
              </Pressable>
            </View>
            <View className="flex-row items-center justify-between gap-2">
              <Pressable
                onPress={() => router.push('/modal/history')}
                className="flex-row items-center gap-1.5 rounded-xl border px-3.5 py-2"
                style={{ borderColor: c.border, backgroundColor: c.bg2 }}
              >
                <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
                  <Polyline points="12 6 12 12 16 14" />
                </Svg>
                <Text className="text-xs font-bold" style={{ color: c.text }}>My Plans</Text>
              </Pressable>
              {remaining !== null && (
                <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: remaining === 0 ? 'rgba(255,87,87,0.15)' : c.bg2 }}>
                  <Text className="text-[11px] font-semibold" style={{ color: remaining === 0 ? c.red : c.muted }}>
                    {remaining === 0 ? 'No plans left' : `${remaining} plans left`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </View>
    </ErrorBoundary>
  )
}
