import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import Svg, { Path, Polyline } from 'react-native-svg'
import { usePlan } from '../../../state/PlanContext'
import { useAccount } from '../../../state/AccountContext'
import { SurveyFlow } from '../../../components/survey/SurveyFlow'
import { DayTabs } from '../../../components/fuel/DayTabs'
import { DayMacroBar } from '../../../components/fuel/DayMacroBar'
import { MealCard } from '../../../components/fuel/MealCard'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'
import { createCheckout } from '../../../lib/client'
import { useThemeColors } from '../../../lib/themeColors'

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
        <View className="flex-row items-center justify-between gap-2 border-b px-4 py-3" style={{ borderColor: c.border, backgroundColor: c.card }}>
          <View className="flex-row gap-2">
            <Pressable
              onPress={() => setSurveyMode(true)}
              className="flex-row items-center gap-1.5 rounded-xl px-3.5 py-2"
              style={{ backgroundColor: c.lime }}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#0e0f11" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 5v14M5 12h14" />
              </Svg>
              <Text className="text-xs font-extrabold text-bg">New Plan</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/modal/history')}
              className="flex-row items-center gap-1.5 rounded-xl border px-3.5 py-2"
              style={{ borderColor: c.border, backgroundColor: c.bg2 }}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z" />
                <Polyline points="12 6 12 12 16 14" />
              </Svg>
              <Text className="text-xs font-bold" style={{ color: c.text }}>My Plans</Text>
            </Pressable>
          </View>
          {remaining !== null && (
            <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: remaining === 0 ? 'rgba(255,87,87,0.15)' : c.bg2 }}>
              <Text className="text-[11px] font-semibold" style={{ color: remaining === 0 ? c.red : c.muted }}>
                {remaining === 0 ? 'No plans left' : `${remaining} plans left`}
              </Text>
            </View>
          )}
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
              onReplace={() =>
                router.push({ pathname: '/(tabs)/recipes/library', params: { replaceDay: day.day, replaceMealIndex: String(i), replaceMealName: meal.name } })
              }
            />
          ))}
        </ScrollView>
      </View>
    </ErrorBoundary>
  )
}
