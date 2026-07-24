import { Stack } from 'expo-router'

/**
 * Nested stack for the Recipes tab — list + detail, its own navigation depth
 * separate from the Fuel/Prep/Haul tabs (those are all views onto the
 * current plan; the recipe box is plan-independent). `index` renders the
 * shared app `Header` itself (see recipes/index.tsx) so the Tabs navigator's
 * own header is turned off for this tab in `(tabs)/_layout.tsx`.
 */
export default function RecipesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Recipe' }} />
    </Stack>
  )
}
