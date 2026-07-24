import { Redirect, Tabs, useRouter } from 'expo-router'
import type { ColorValue } from 'react-native'
import Svg, { Line, Path, Rect } from 'react-native-svg'
import { useAccount } from '../../state/AccountContext'
import { usePlan } from '../../state/PlanContext'
import { Header } from '../../components/layout/Header'
import { useThemeColors } from '../../lib/themeColors'

const ICON_PROPS = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function FuelIcon({ color }: { color: ColorValue }) {
  return (
    <Svg {...ICON_PROPS} stroke={color}>
      <Path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  )
}
function PrepIcon({ color }: { color: ColorValue }) {
  return (
    <Svg {...ICON_PROPS} stroke={color}>
      <Rect x={6} y={3} width={12} height={18} rx={2} />
      <Line x1={9} y1={8} x2={15} y2={8} />
      <Line x1={9} y1={12} x2={15} y2={12} />
      <Line x1={9} y1={16} x2={13} y2={16} />
    </Svg>
  )
}
function HaulIcon({ color }: { color: ColorValue }) {
  return (
    <Svg {...ICON_PROPS} stroke={color}>
      <Path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </Svg>
  )
}
function RecipesIcon({ color }: { color: ColorValue }) {
  return (
    <Svg {...ICON_PROPS} stroke={color}>
      <Path d="M3 2v7c0 1.66 1.34 3 3 3v10" />
      <Path d="M6 2v6" />
      <Path d="M3 2v6" />
      <Path d="M18 2c-2.5 2.5-3 5-3 8s.5 5.5 3 8v4" />
    </Svg>
  )
}

export default function TabsLayout() {
  const { isAuthed } = useAccount()
  const { plan, surveyMode } = usePlan()
  const router = useRouter()
  const c = useThemeColors()

  if (!isAuthed) return <Redirect href="/(auth)/login" />

  // Mirrors the web app's `chromeHidden` — hide the header + tab bar
  // entirely during the survey full-takeover, same as the web app hiding
  // Header/BottomNav together.
  const chromeHidden = !plan || surveyMode

  return (
    <Tabs
      screenOptions={{
        header: chromeHidden ? undefined : () => <Header onOpenSettings={() => router.push('/modal/settings')} />,
        headerShown: !chromeHidden,
        tabBarStyle: chromeHidden ? { display: 'none' } : { backgroundColor: c.card, borderTopColor: c.border },
        tabBarActiveTintColor: c.lime,
        tabBarInactiveTintColor: c.muted,
      }}
    >
      <Tabs.Screen name="fuel/index" options={{ title: 'Fuel', tabBarIcon: ({ color }) => <FuelIcon color={color} /> }} />
      <Tabs.Screen name="prep/index" options={{ title: 'Prep', tabBarIcon: ({ color }) => <PrepIcon color={color} /> }} />
      <Tabs.Screen name="haul/index" options={{ title: 'Haul', tabBarIcon: ({ color }) => <HaulIcon color={color} /> }} />
      <Tabs.Screen name="recipes" options={{ title: 'Recipes', headerShown: false, tabBarIcon: ({ color }) => <RecipesIcon color={color} /> }} />
    </Tabs>
  )
}
