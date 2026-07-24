import { useState } from 'react'
import { ActivityIndicator, Pressable, View } from 'react-native'
import { Image } from 'expo-image'
import { Text } from '@/components/Text'
import Svg, { Circle, Path } from 'react-native-svg'
import { useThemeColors } from '../../lib/themeColors'
import { pickRecipePhoto, takeRecipePhoto } from '../../lib/recipePhoto'

interface RecipePhotoPickerProps {
  photo?: string
  onChange: (photo: string) => void
}

/** Cosmetic cover-photo picker — a preview box plus Library/Camera buttons. Shared between the recipe-import review screen and the detail screen (for recipes that don't have one yet). */
export function RecipePhotoPicker({ photo, onChange }: RecipePhotoPickerProps) {
  const c = useThemeColors()
  const [busy, setBusy] = useState(false)

  async function handlePick(source: 'library' | 'camera') {
    setBusy(true)
    try {
      const result = source === 'library' ? await pickRecipePhoto() : await takeRecipePhoto()
      if (result) onChange(result)
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="mb-4">
      <View
        className="mb-2 h-40 w-full items-center justify-center overflow-hidden rounded-xl border"
        style={{ borderColor: c.border, backgroundColor: c.bg2 }}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
            <Circle cx={12} cy={13} r={4} />
          </Svg>
        )}
        {busy && (
          <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <ActivityIndicator color="#fff" />
          </View>
        )}
      </View>
      <View className="flex-row gap-2">
        <Pressable onPress={() => handlePick('library')} disabled={busy} className="flex-1 items-center rounded-xl border py-2" style={{ borderColor: c.border, opacity: busy ? 0.6 : 1 }}>
          <Text className="text-xs font-semibold" style={{ color: c.text }}>{photo ? 'Change Photo' : 'Choose Photo'}</Text>
        </Pressable>
        <Pressable onPress={() => handlePick('camera')} disabled={busy} className="flex-1 items-center rounded-xl border py-2" style={{ borderColor: c.border, opacity: busy ? 0.6 : 1 }}>
          <Text className="text-xs font-semibold" style={{ color: c.text }}>Take Photo</Text>
        </Pressable>
      </View>
    </View>
  )
}
