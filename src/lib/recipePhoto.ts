// Purely cosmetic cover photo for a saved recipe — unrelated to the
// TikTok video/on-screen-text reading in recipePrompt.ts/videoExtract.ts
// on the backend. Stored as a base64 data URI directly on the Recipe
// record (no image hosting infra exists yet, and the recipe box is a
// personal collection, not a public gallery, so this is fine at this
// scale) — resized/compressed here so that stays small.
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'

const MAX_WIDTH = 640
const JPEG_QUALITY = 0.6

async function compressToDataUri(uri: string): Promise<string> {
  const context = ImageManipulator.manipulate(uri).resize({ width: MAX_WIDTH })
  const image = await context.renderAsync()
  const result = await image.saveAsync({ compress: JPEG_QUALITY, format: SaveFormat.JPEG, base64: true })
  return `data:image/jpeg;base64,${result.base64}`
}

/** Launches the OS photo library picker, resizes/compresses the pick, and returns a ready-to-store base64 data URI — or null if cancelled/denied. */
export async function pickRecipePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) return null

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: true,
    aspect: [4, 3],
  })
  if (result.canceled || !result.assets[0]) return null
  return compressToDataUri(result.assets[0].uri)
}

/** Same as pickRecipePhoto() but takes a fresh photo with the camera instead. */
export async function takeRecipePhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync()
  if (!permission.granted) return null

  const result = await ImagePicker.launchCameraAsync({
    quality: 1,
    allowsEditing: true,
    aspect: [4, 3],
  })
  if (result.canceled || !result.assets[0]) return null
  return compressToDataUri(result.assets[0].uri)
}
