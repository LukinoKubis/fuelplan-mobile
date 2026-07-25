import { useMemo } from 'react'
import { Pressable, TextInput, View } from 'react-native'
import { Text } from '@/components/Text'
import type { MacroMode, Profile } from '../../../types/profile'
import { calculateGoalWeight, calculateMacros } from '../../../lib/macros'
import { ACTIVITY_OPTIONS } from '../options'
import { GoalPicker } from '../GoalPicker'
import { PaceSlider } from '../PaceSlider'
import { useThemeColors } from '../../../lib/themeColors'

interface Step3Props {
  profile: Profile
  onChange: (patch: Partial<Profile>) => void
}

/**
 * Survey step 4/4 — either manual macro entry, or a calc-mode path (body
 * stats + activity + a goal, expressed as a quick-select preset or a
 * target-weight/pace pair) that live-previews the resulting daily targets.
 */
export function Step3Macros({ profile, onChange }: Step3Props) {
  const c = useThemeColors()
  const setMode = (mode: MacroMode) => onChange({ mode })

  const weight = parseFloat(profile.weight)
  const height = parseFloat(profile.height)
  const age = parseFloat(profile.age)
  const activity = parseFloat(profile.activity)
  const goalWeight = parseFloat(profile.goalWeight)
  const activityLabel = ACTIVITY_OPTIONS.find((a) => a.value === profile.activity)?.label.split('—')[0].trim() || 'Moderately active'

  const goalWeightResult = useMemo(() => {
    if (profile.goalMode !== 'target' || !weight || !goalWeight) return null
    return calculateGoalWeight(weight, goalWeight, profile.goalWeeklyRate)
  }, [profile.goalMode, weight, goalWeight, profile.goalWeeklyRate])

  const effectiveOffset = profile.goalMode === 'target' ? (goalWeightResult ? -Math.round(goalWeightResult.cappedDailyDiff) : 0) : profile.goalOffset

  const calcResult = useMemo(() => {
    if (!weight || !height || !age) return null
    return calculateMacros({ weight, height, age, sex: profile.sex, activity, goalOffset: effectiveOffset })
  }, [weight, height, age, profile.sex, activity, effectiveOffset])

  return (
    <View>
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-lime">Step 4 of 4</Text>
      <Text className="mb-2 font-display text-3xl leading-tight text-light-text dark:text-text">Macros &{'\n'}your goal</Text>
      <Text className="mb-6 text-sm text-light-muted dark:text-muted">Set your daily targets. Enter them yourself or let us calculate from your stats.</Text>

      <View className="mb-5 flex-row gap-2">
        <Pressable
          onPress={() => setMode('manual')}
          className="flex-1 rounded-xl border px-3 py-3"
          style={{ borderColor: profile.mode === 'manual' ? c.lime : c.border, backgroundColor: profile.mode === 'manual' ? 'rgba(200,245,66,0.12)' : c.bg2 }}
        >
          <Text className="text-sm font-bold" style={{ color: c.text }}>I know my macros</Text>
          <Text className="text-xs" style={{ color: c.muted }}>Enter targets directly</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode('calc')}
          className="flex-1 rounded-xl border px-3 py-3"
          style={{ borderColor: profile.mode === 'calc' ? c.lime : c.border, backgroundColor: profile.mode === 'calc' ? 'rgba(200,245,66,0.12)' : c.bg2 }}
        >
          <Text className="text-sm font-bold" style={{ color: c.text }}>Calculate for me</Text>
          <Text className="text-xs" style={{ color: c.muted }}>From stats & goal</Text>
        </Pressable>
      </View>

      {profile.mode === 'manual' ? (
        <View>
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-light-muted dark:text-muted">Daily Targets</Text>
          <View className="flex-row flex-wrap gap-2">
            <NumField label="Calories" value={profile.mKcal} onChange={(v) => onChange({ mKcal: v })} placeholder="2000" />
            <NumField label="Protein (g)" value={profile.mProtein} onChange={(v) => onChange({ mProtein: v })} placeholder="180" />
            <NumField label="Carbs (g)" value={profile.mCarbs} onChange={(v) => onChange({ mCarbs: v })} placeholder="200" />
            <NumField label="Fat (g)" value={profile.mFat} onChange={(v) => onChange({ mFat: v })} placeholder="65" />
          </View>
        </View>
      ) : (
        <View>
          <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-light-muted dark:text-muted">Body Stats</Text>
          <View className="mb-3 flex-row flex-wrap gap-2">
            <NumField label="Weight (kg)" value={profile.weight} onChange={(v) => onChange({ weight: v })} placeholder="80" />
            <NumField label="Height (cm)" value={profile.height} onChange={(v) => onChange({ height: v })} placeholder="178" />
            <NumField label="Age" value={profile.age} onChange={(v) => onChange({ age: v })} placeholder="28" />
            <View style={{ width: '48%' }}>
              <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">Sex</Text>
              <View className="flex-row gap-2">
                {(['male', 'female'] as const).map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => onChange({ sex: s })}
                    className="flex-1 rounded-xl border px-3 py-2.5"
                    style={{ borderColor: profile.sex === s ? c.lime : c.border, backgroundColor: profile.sex === s ? 'rgba(200,245,66,0.12)' : c.bg2 }}
                  >
                    <Text className="text-center text-sm" style={{ color: profile.sex === s ? c.lime : c.text }}>
                      {s === 'male' ? 'Male' : 'Female'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View className="mb-4 rounded-xl border px-3 py-2.5" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
            <Text className="text-xs" style={{ color: c.muted }}>
              Activity level: <Text style={{ color: c.text }}>{activityLabel}</Text> — based on your {profile.trainingDays} training days/week from step 2
            </Text>
          </View>

          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wide text-light-muted dark:text-muted">Goal</Text>
            <View className="flex-row overflow-hidden rounded-lg border" style={{ borderColor: c.border }}>
              <Pressable onPress={() => onChange({ goalMode: 'preset' })} className="px-3 py-1.5" style={{ backgroundColor: profile.goalMode === 'preset' ? c.bg : 'transparent' }}>
                <Text className="text-xs font-semibold" style={{ color: profile.goalMode === 'preset' ? c.text : c.muted }}>Quick select</Text>
              </Pressable>
              <Pressable onPress={() => onChange({ goalMode: 'target' })} className="px-3 py-1.5" style={{ backgroundColor: profile.goalMode === 'target' ? c.bg : 'transparent' }}>
                <Text className="text-xs font-semibold" style={{ color: profile.goalMode === 'target' ? c.text : c.muted }}>Target weight</Text>
              </Pressable>
            </View>
          </View>

          {profile.goalMode === 'preset' ? (
            <View className="mb-4">
              <GoalPicker value={profile.goalOffset} onChange={(goalOffset) => onChange({ goalOffset })} />
            </View>
          ) : (
            <View className="mb-4 gap-3">
              <NumField label="Goal Weight (kg)" value={profile.goalWeight} onChange={(v) => onChange({ goalWeight: v })} placeholder="e.g. 75" full />
              <View>
                <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">Weekly pace</Text>
                <PaceSlider value={profile.goalWeeklyRate} onChange={(goalWeeklyRate) => onChange({ goalWeeklyRate })} />
              </View>
              {goalWeightResult && (
                <View className="rounded-xl border p-3" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
                  <Text className="mb-1.5 text-xs" style={{ color: c.text }}>{goalWeightResult.warningText}</Text>
                  <View className="flex-row flex-wrap gap-3">
                    <Text className="text-xs" style={{ color: c.muted }}>{Math.abs(goalWeightResult.totalChangeKg).toFixed(1)}kg total</Text>
                    <Text className="text-xs" style={{ color: c.muted }}>~{Math.ceil(goalWeightResult.weeksNeeded)} weeks</Text>
                    <Text className="text-xs" style={{ color: c.muted }}>
                      By {new Date(goalWeightResult.projectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Text>
                    <Text className="text-xs" style={{ color: c.muted }}>
                      {Math.abs(Math.round(goalWeightResult.cappedDailyDiff))} kcal/day{' '}
                      {goalWeightResult.cappedDailyDiff > 0 ? 'deficit' : goalWeightResult.cappedDailyDiff < 0 ? 'surplus' : ''}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {calcResult && (
            <View>
              <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-light-muted dark:text-muted">Your Calculated Targets</Text>
              <View className="flex-row justify-between rounded-xl border p-3" style={{ borderColor: c.border, backgroundColor: c.bg2 }}>
                <PreviewItem value={calcResult.macros.kcal} unit="kcal" />
                <PreviewItem value={calcResult.macros.protein} unit="protein g" />
                <PreviewItem value={calcResult.macros.carbs} unit="carbs g" />
                <PreviewItem value={calcResult.macros.fat} unit="fat g" />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  )
}

/** Numeric-keyboard labeled input, half or full width — local to this step (weight/height/age/macro fields). */
function NumField({ label, value, onChange, placeholder, full }: { label: string; value: string; onChange: (v: string) => void; placeholder: string; full?: boolean }) {
  const c = useThemeColors()
  return (
    <View style={{ width: full ? '100%' : '48%' }}>
      <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType="numeric"
        placeholderTextColor={c.muted}
        className="rounded-xl border px-3 py-2.5 text-sm text-light-text dark:text-text"
        style={{ borderColor: c.border, backgroundColor: c.bg2 }}
      />
    </View>
  )
}

/** One calculated-macro value in the "Your Calculated Targets" preview row. */
function PreviewItem({ value, unit }: { value: number; unit: string }) {
  return (
    <View className="items-center">
      <Text className="text-lg font-extrabold text-lime">{value}</Text>
      <Text className="text-[10px] text-light-muted dark:text-muted">{unit}</Text>
    </View>
  )
}
