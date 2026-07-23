import { useState } from 'react'
import { Pressable, ScrollView, View } from 'react-native'
import { Text } from '@/components/Text'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg'
import { SettingsAction } from '../../components/shared/SettingsAction'
import { useTheme } from '../../state/ThemeContext'
import { usePlan } from '../../state/PlanContext'
import { useAccount } from '../../state/AccountContext'
import { createCheckout } from '../../lib/client'
import { useThemeColors } from '../../lib/themeColors'

export default function SettingsScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const { theme, toggleTheme } = useTheme()
  const { profile, resetEaten, resetShopChecks, clearPlan } = usePlan()
  const { email, remaining, logout } = useAccount()
  const [resetConfirm, setResetConfirm] = useState(false)
  const [topupBusy, setTopupBusy] = useState(false)

  async function handleTopUp() {
    setTopupBusy(true)
    try {
      const { url } = await createCheckout('10')
      await WebBrowser.openBrowserAsync(url)
    } finally {
      setTopupBusy(false)
    }
  }

  function handleFullReset() {
    if (!resetConfirm) {
      setResetConfirm(true)
      return
    }
    clearPlan()
    logout()
    router.replace('/(auth)/login')
  }

  return (
    <ScrollView contentContainerClassName="p-4" style={{ backgroundColor: c.bg }}>
      <View className="mb-5 rounded-xl border p-3.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
        <Text className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Current Profile</Text>
        <Row label="Name" value={profile.name || '—'} />
        <Row label="Email" value={email || '—'} />
        <Row label="Plans left" value={remaining === null ? '—' : String(remaining)} last />
      </View>

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Plans</Text>
      <View className="mb-4 gap-2">
        <SettingsAction icon={<BoltIcon />} title="Generate New Plan" desc="Keep your profile, get a fresh 7-day plan" onPress={() => { router.back(); router.push('/(tabs)/fuel') }} />
        <SettingsAction icon={<HistoryIcon />} iconColor={c.blue} title="My Plans" desc="Browse, restore or delete your saved plans" onPress={() => router.push('/modal/history')} />
      </View>

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Preferences</Text>
      <View className="mb-4">
        <SettingsAction
          icon={<ThemeIcon dark={theme === 'dark'} />}
          title="Appearance"
          desc={`Currently ${theme === 'dark' ? 'Dark' : 'Light'} mode`}
          trailing={
            <Pressable onPress={toggleTheme} className="h-6 w-11 justify-center rounded-full" style={{ backgroundColor: theme === 'dark' ? c.lime : c.border }}>
              <View className="h-5 w-5 rounded-full bg-white" style={{ marginLeft: theme === 'dark' ? 22 : 2 }} />
            </Pressable>
          }
        />
      </View>

      <Text className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Data</Text>
      <View className="mb-4 gap-2">
        <SettingsAction icon={<ResetIcon />} iconColor={c.blue} title="Reset Week Tracking" desc="Clear all eaten meals for a fresh start" onPress={resetEaten} />
        <SettingsAction icon={<CartIcon />} iconColor={c.orange} title="Reset Shopping List" desc="Uncheck all ticked items to shop again" onPress={resetShopChecks} />
        <SettingsAction icon={<BoltIcon />} title="Top Up Plans" desc={topupBusy ? 'Opening checkout…' : 'Buy more AI-generated meal plans'} onPress={handleTopUp} />
        <SettingsAction icon={<LogoutIcon />} title="Log Out" desc="Sign out of this account on this device" onPress={() => { logout(); router.replace('/(auth)/login') }} />
        <SettingsAction
          icon={<TrashIcon />}
          iconColor={c.red}
          danger
          title={resetConfirm ? 'Tap again to confirm' : 'Full Reset'}
          desc="Clear everything — plan and profile on this device"
          onPress={handleFullReset}
        />
      </View>

      <Text className="mt-2 text-center text-[11px] leading-relaxed" style={{ color: c.muted }}>
        Your plan and profile are stored locally on this device.{'\n'}Your account (email/credits) lives on the server.
      </Text>
    </ScrollView>
  )
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const c = useThemeColors()
  return (
    <View className="flex-row justify-between py-1.5" style={last ? undefined : { borderBottomWidth: 1, borderColor: c.border }}>
      <Text className="text-xs" style={{ color: c.muted }}>{label}</Text>
      <Text className="text-xs font-semibold" style={{ color: c.text }}>{value}</Text>
    </View>
  )
}

const ICON_PROPS = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

function BoltIcon() {
  const c = useThemeColors()
  return <Svg {...ICON_PROPS} stroke={c.lime}><Path d="M13 2L4.5 13.5H11L9 22L19.5 10H13L15 2H13z" /></Svg>
}
function HistoryIcon() {
  const c = useThemeColors()
  return (
    <Svg {...ICON_PROPS} stroke={c.blue}>
      <Path d="M3 3h5l1.5 9h9l1.5-9H15" />
      <Circle cx={9} cy={21} r={1} />
      <Circle cx={19} cy={21} r={1} />
      <Path d="M12 3v9" />
    </Svg>
  )
}
function ThemeIcon({ dark }: { dark: boolean }) {
  const c = useThemeColors()
  return dark ? (
    <Svg {...ICON_PROPS} stroke={c.lime}><Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></Svg>
  ) : (
    <Svg {...ICON_PROPS} stroke={c.lime}>
      <Circle cx={12} cy={12} r={5} />
      <Line x1={12} y1={1} x2={12} y2={3} />
      <Line x1={12} y1={21} x2={12} y2={23} />
    </Svg>
  )
}
function ResetIcon() {
  const c = useThemeColors()
  return (
    <Svg {...ICON_PROPS} stroke={c.blue}>
      <Polyline points="1 4 1 10 7 10" />
      <Path d="M3.51 15a9 9 0 1 0 .49-3.36" />
    </Svg>
  )
}
function CartIcon() {
  const c = useThemeColors()
  return (
    <Svg {...ICON_PROPS} stroke={c.orange}>
      <Circle cx={9} cy={21} r={1} />
      <Circle cx={20} cy={21} r={1} />
      <Path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </Svg>
  )
}
function LogoutIcon() {
  const c = useThemeColors()
  return (
    <Svg {...ICON_PROPS} stroke={c.lime}>
      <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <Polyline points="16 17 21 12 16 7" />
      <Line x1={21} y1={12} x2={9} y2={12} />
    </Svg>
  )
}
function TrashIcon() {
  const c = useThemeColors()
  return (
    <Svg {...ICON_PROPS} stroke={c.red}>
      <Polyline points="3 6 5 6 21 6" />
      <Path d="M19 6l-1 14H6L5 6" />
      <Path d="M10 11v6" />
      <Path d="M14 11v6" />
      <Path d="M9 6V4h6v2" />
    </Svg>
  )
}
