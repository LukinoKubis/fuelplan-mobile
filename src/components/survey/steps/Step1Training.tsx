import { View } from 'react-native'
import { Text } from '@/components/Text'
import { CardGrid, PillGroup } from '../Chips'
import { TRAINING_DAYS_OPTIONS, TRAINING_STYLE_OPTIONS } from '../options'

interface Step1Props {
  trainingDays: string
  onTrainingDays: (v: string) => void
  trainingStyle: string
  onTrainingStyle: (v: string) => void
}

/** Survey step 2/4 — training days/style only. Cooking skill and prep time moved to Step2Food (they're food-prep questions, not training ones — this step used to ask both, which read as out of place under a "How do you train?" heading). */
export function Step1Training({ trainingDays, onTrainingDays, trainingStyle, onTrainingStyle }: Step1Props) {
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
    </View>
  )
}
