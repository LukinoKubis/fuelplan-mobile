import { View } from 'react-native'
import { Text } from '@/components/Text'
import { Field } from '../../Field'
import { CardGrid, VarietyGroup } from '../Chips'
import { CUISINE_OPTIONS, VARIETY_OPTIONS } from '../options'

interface Step2Props {
  dietPref: string
  onDietPref: (v: string) => void
  dislikedFoods: string
  onDislikedFoods: (v: string) => void
  cuisines: string[]
  onToggleCuisine: (v: string) => void
  variety: string
  onVariety: (v: string) => void
}

export function Step2Food({ dietPref, onDietPref, dislikedFoods, onDislikedFoods, cuisines, onToggleCuisine, variety, onVariety }: Step2Props) {
  return (
    <View>
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-orange">Step 3 of 4</Text>
      <Text className="mb-2 font-display text-3xl leading-tight text-light-text dark:text-text">
        Food &{'\n'}
        <Text style={{ color: '#ff9a42' }}>preferences</Text>
      </Text>
      <Text className="mb-6 text-sm text-light-muted dark:text-muted">Your plan will be built around what you enjoy and what works for your body.</Text>

      <Field label="Dietary Restrictions & Allergies" value={dietPref} onChangeText={onDietPref} placeholder="e.g. no pork, lactose intolerant, nut allergy…" />
      <Field label="Foods You Dislike (optional)" value={dislikedFoods} onChangeText={onDislikedFoods} placeholder="e.g. broccoli, tuna, cottage cheese…" />

      <View className="mb-5">
        <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">Cuisine Style (optional)</Text>
        <CardGrid options={CUISINE_OPTIONS} value={cuisines} onChange={onToggleCuisine} multi columns={3} />
      </View>

      <View className="mb-5">
        <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">Meal Variety</Text>
        <VarietyGroup options={VARIETY_OPTIONS} value={variety} onChange={onVariety} />
      </View>
    </View>
  )
}
