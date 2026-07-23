import { TextInput, View, type TextInputProps } from 'react-native'
import { Text } from '@/components/Text'

interface FieldProps extends TextInputProps {
  label: string
}

export function Field({ label, ...inputProps }: FieldProps) {
  return (
    <View className="mb-4">
      <Text className="mb-1.5 text-xs font-semibold text-light-muted dark:text-muted">{label}</Text>
      <View className="rounded-xl border border-light-border bg-light-bg2 px-3 py-2.5 dark:border-border dark:bg-bg2">
        <TextInput
          {...inputProps}
          placeholderTextColor="#7a8099"
          className="text-sm text-light-text dark:text-text"
        />
      </View>
    </View>
  )
}
