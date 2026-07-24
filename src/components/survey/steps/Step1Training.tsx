import { View } from 'react-native'
import { Text } from '@/components/Text'
import { CardGrid, PillGroup } from '../Chips'
import { COOKING_SKILL_OPTIONS, PREP_TIME_OPTIONS, TRAINING_DAYS_OPTIONS, TRAINING_STYLE_OPTIONS } from '../options'

interface Step1Props {
  trainingDays: string
  onTrainingDays: (v: string) => void
  trainingStyle: string
  onTrainingStyle: (v: string) => void
  cookingSkill: string
  onCookingSkill: (v: string) => void
  prepTime: string
  onPrepTime: (v: string) => void
}

/** Survey step 2/4 — training days/style, cooking skill, Sunday prep time. */
export function Step1Training({
  trainingDays,
  onTrainingDays,
  trainingStyle,
  onTrainingStyle,
  cookingSkill,
  onCookingSkill,
  prepTime,
  onPrepTime,
}: Step1Props) {
  return (
    <View>
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-blue">Step 2 of 4</Text>
      <Text className="mb-2 font-display text-3xl leading-tight text-light-text dark:text-text">
        How do{'\n'}
        <Text style={{ color: '#57a9ff' }}>you train?</Text>
      </Text>
      <Text className="mb-6 text-sm text-light-muted dark:text-muted">We'll match your calories and meal timing to your training load.</Text>

      <View className="mb-5">
        <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">Training Days Per Week</Text>
        <PillGroup options={TRAINING_DAYS_OPTIONS} value={trainingDays} onChange={onTrainingDays} />
      </View>

      <View className="mb-5">
        <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">Training Style</Text>
        <CardGrid options={TRAINING_STYLE_OPTIONS} value={trainingStyle} onChange={onTrainingStyle} columns={2} />
      </View>

      <View className="mb-5">
        <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">Cooking Skill</Text>
        <CardGrid options={COOKING_SKILL_OPTIONS} value={cookingSkill} onChange={onCookingSkill} columns={3} />
      </View>

      <View className="mb-5">
        <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">Sunday Prep Time</Text>
        <CardGrid options={PREP_TIME_OPTIONS} value={prepTime} onChange={onPrepTime} columns={3} />
      </View>
    </View>
  )
}
