import { Stack } from 'expo-router'

/**
 * Nested stack for the Recipes tab — list + detail, its own navigation depth
 * separate from the Fuel/Prep/Haul tabs (those are all views onto the
 * current plan; the recipe box is plan-independent). `index` renders the
 * shared app `Header` itself (see recipes/index.tsx) so the Tabs navigator's
 * own header is turned off for this tab in `(tabs)/_layout.tsx`.
 *
 * `library`/`library-detail` are the shared recipe-library screens (browse
 * the admin-seeded catalog, distinct from `index`/`[id]` which are the
 * user's own saved recipes) — kept as flat siblings in this same stack
 * rather than a nested sub-stack, simplest given there are only two of them.
 */
export default function RecipesLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Recipe' }} />
      <Stack.Screen name="library" options={{ title: 'Recipe Library' }} />
      <Stack.Screen name="library-detail" options={{ title: 'Recipe' }} />
    </Stack>
  )
}
