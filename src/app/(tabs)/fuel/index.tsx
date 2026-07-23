import { useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { usePlan } from '../../../state/PlanContext'
import { useAccount } from '../../../state/AccountContext'
import { SurveyFlow } from '../../../components/survey/SurveyFlow'
import { DayTabs } from '../../../components/fuel/DayTabs'
import { DayMacroBar } from '../../../components/fuel/DayMacroBar'
import { MealCard } from '../../../components/fuel/MealCard'
import { createCheckout } from '../../../lib/client'
import { useThemeColors } from '../../../lib/themeColors'

export default function FuelScreen() {
  const c = useThemeColors()
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
      // TODO(M4/settings): open this checkout URL via expo-web-browser once
      // the Settings screen (which also needs it for Top Up Plans) exists.
      console.log('checkout url', url)
    } catch {
      /* non-critical */
    }
  }

  if (showSurvey) {
    return (
      <SurveyFlow
        onGenerated={() => {
          setSurveyMode(false)
          setActiveDay(0)
        }}
        onBuyPlans={handleBuyPlans}
        canCancel={!!plan}
        onCancel={() => setSurveyMode(false)}
      />
    )
  }

  const day = plan.days[Math.min(activeDay, plan.days.length - 1)]
  const isFavorite = (name: string) => favorites.some((f) => f.name === name)

  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between border-b px-4 py-2.5" style={{ borderColor: c.border, backgroundColor: c.card }}>
        <Pressable onPress={() => setSurveyMode(true)} className="rounded-lg border px-2.5 py-1.5" style={{ borderColor: c.border }}>
          <Text className="text-xs font-semibold" style={{ color: c.muted }}>New Plan</Text>
        </Pressable>
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
    </SafeAreaView>
  )
}
