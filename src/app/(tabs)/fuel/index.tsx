import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { usePlan } from '../../../state/PlanContext'
import { useAccount } from '../../../state/AccountContext'
import { SurveyFlow } from '../../../components/survey/SurveyFlow'
import { DayTabs } from '../../../components/fuel/DayTabs'
import { DayMacroBar } from '../../../components/fuel/DayMacroBar'
import { MealCard } from '../../../components/fuel/MealCard'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { createCheckout } from '../../../lib/client'
import { useThemeColors } from '../../../lib/themeColors'

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

  async function handleBuyPlans() {
    try {
      const { url } = await createCheckout('10')
      await WebBrowser.openBrowserAsync(url)
    } catch {
      /* non-critical */
    }
  }

  if (showSurvey) {
    return (
      <ErrorBoundary onReset={() => setSurveyMode(false)}>
        <SurveyFlow
          onGenerated={() => {
            setSurveyMode(false)
            setActiveDay(0)
            router.push('/modal/plan-name')
          }}
          onBuyPlans={handleBuyPlans}
          canCancel={!!plan}
          onCancel={() => setSurveyMode(false)}
        />
      </ErrorBoundary>
    )
  }

  const day = plan.days[Math.min(activeDay, plan.days.length - 1)]
  const isFavorite = (name: string) => favorites.some((f) => f.name === name)

  return (
    <ErrorBoundary onReset={() => setActiveDay(0)}>
      <View className="flex-1 bg-light-bg dark:bg-bg">
        <View className="flex-row items-center justify-between border-b px-4 py-2.5" style={{ borderColor: c.border, backgroundColor: c.card }}>
          <View className="flex-row gap-2">
            <Pressable onPress={() => router.push('/modal/history')} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: c.border }}>
              <Text className="text-xs font-semibold" style={{ color: c.muted }}>My Plans</Text>
            </Pressable>
            <Pressable onPress={() => setSurveyMode(true)} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: c.border }}>
              <Text className="text-xs font-semibold" style={{ color: c.muted }}>New Plan</Text>
            </Pressable>
          </View>
          <Text className="text-xs" style={{ color: c.muted }}>
            {remaining === null ? '' : remaining === 0 ? <Text style={{ color: c.red }}>No plans left</Text> : `${remaining} plans left`}
          </Text>
        </View>

        <DayTabs days={plan.days.map((d) => d.day)} active={activeDay} onChange={setActiveDay} />
        <DayMacroBar day={day} target={plan.summary} />

        <ScrollView contentContainerClassName="gap-3 p-4">
          {day.meals.map((meal, i) => (
            <MealCard
              key={i}
              meal={meal}
              eaten={!!eaten[`${day.day}-${i}`]}
              onToggleEaten={() => toggleEaten(`${day.day}-${i}`)}
              favorite={isFavorite(meal.name)}
              onToggleFavorite={() => toggleFavorite(meal.name)}
            />
          ))}
        </ScrollView>
      </View>
    </ErrorBoundary>
  )
}
