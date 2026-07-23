import { Text, View } from 'react-native'
import { Field } from '../../Field'

interface Step0Props {
  name: string
  onNameChange: (name: string) => void
}

export function Step0Start({ name, onNameChange }: Step0Props) {
  return (
    <View>
      <Text className="mb-1 text-xs font-bold uppercase tracking-wide text-lime">Step 1 of 4</Text>
      <Text className="mb-2 font-display text-3xl leading-tight text-light-text dark:text-text">Let's get{'\n'}started</Text>
      <Text className="mb-6 text-sm text-light-muted dark:text-muted">Tell us your name so we can personalise your plan.</Text>

      <Field label="First Name (optional)" value={name} onChangeText={onNameChange} placeholder="e.g. Alex" />
    </View>
  )
}
