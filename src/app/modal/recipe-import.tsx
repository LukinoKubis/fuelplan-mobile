import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native'
import { Text } from '@/components/Text'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Svg, { Line } from 'react-native-svg'
import { useThemeColors } from '../../lib/themeColors'
import { ApiError, postClaude, saveRecipe } from '../../lib/client'
import { buildExtractRecipeRequest } from '../../lib/recipePrompt'
import { friendlyErrorMessage } from '../../lib/errorMessage'
import { useAccount } from '../../state/AccountContext'
import type { Recipe, RecipeIngredient } from '../../types/recipe'

type Stage = 'paste' | 'preview'

const EMPTY_MACROS = { kcal: 0, protein: 0, carbs: 0, fat: 0 }

/**
 * Turns pasted (or share-sheet-handed-off) recipe text into a structured,
 * editable Recipe and saves it to the user's recipe box. Always shows the
 * raw-text field first — this is the permanent landing screen for manual
 * paste, manual URL entry, and native share-intent alike. The URL field is
 * editable either way: `params.url` prefills it from a real OS share, but
 * a user can just as well paste a link in by hand (e.g. copied from
 * TikTok without using its share sheet), which drives the exact same
 * TikTok-oEmbed-prefill / Instagram-paste-prompt logic.
 */
export default function RecipeImportScreen() {
  const c = useThemeColors()
  const router = useRouter()
  const { refreshRemaining } = useAccount()
  const params = useLocalSearchParams<{ url?: string; text?: string }>()

  const [stage, setStage] = useState<Stage>('paste')
  const [rawText, setRawText] = useState(params.text || '')
  const [sourceUrl, setSourceUrl] = useState(params.url || '')
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState<Recipe | null>(null)
  const [prefetching, setPrefetching] = useState(false)

  const isTikTok = /tiktok\.com/i.test(sourceUrl)
  const isInstagram = /instagram\.com/i.test(sourceUrl)

  // TikTok's public oEmbed endpoint legitimately returns the full caption
  // in its `title` field (unauthenticated, ToS-safe — confirmed by a live
  // test call during planning). Instagram's oEmbed needs Meta App Review
  // for arbitrary posts and scraping is deliberately off the table, so
  // Instagram shares land with an empty field and a "paste the caption"
  // prompt instead. Reacts to `sourceUrl` changes (not just mount) so a
  // manually pasted TikTok link prefills the caption exactly like a
  // share-intent hand-off does — guarded on the caption already being
  // empty so it never clobbers something the user typed.
  useEffect(() => {
    if (!isTikTok || rawText.trim()) return
    let cancelled = false
    setPrefetching(true)
    fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { title?: string } | null) => {
        if (!cancelled && d?.title) setRawText(d.title)
      })
      .catch(() => {
        /* prefill is best-effort — the user can always paste manually */
      })
      .finally(() => {
        if (!cancelled) setPrefetching(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl])

  /** Sends the pasted text to Claude, parses the structured recipe back out, and advances to the editable preview. */
  async function handleExtract() {
    if (!rawText.trim()) return
    setError('')
    setExtracting(true)
    try {
      const { system, messages, model, max_tokens } = buildExtractRecipeRequest({ rawText, sourceUrl: sourceUrl || undefined })
      const response = await postClaude({ model, max_tokens, system, messages })
      const text = response.content[0]?.text || ''
      const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim()

      let parsed: Partial<Recipe>
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Got invalid JSON back. Please try again.')
        parsed = JSON.parse(match[0])
      }

      const platform: Recipe['sourcePlatform'] = !sourceUrl
        ? 'manual'
        : /tiktok\.com/i.test(sourceUrl)
          ? 'tiktok'
          : /instagram\.com/i.test(sourceUrl)
            ? 'instagram'
            : 'other'

      setDraft({
        id: 0,
        name: parsed.name || 'Untitled Recipe',
        ingredients: parsed.ingredients || [],
        steps: parsed.steps || [],
        macros: parsed.macros || EMPTY_MACROS,
        servings: parsed.servings,
        sourceUrl: sourceUrl || undefined,
        sourceCaption: rawText,
        sourcePlatform: platform,
        savedAt: new Date().toISOString(),
      })
      setStage('preview')
      refreshRemaining()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : friendlyErrorMessage(err))
    } finally {
      setExtracting(false)
    }
  }

  /** Saves the (possibly hand-edited) draft to the recipe box and closes the modal. */
  async function handleSave() {
    if (!draft) return
    setSaving(true)
    setError('')
    try {
      await saveRecipe(draft)
      router.back()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : friendlyErrorMessage(err))
      setSaving(false)
    }
  }

  function patchDraft(patch: Partial<Recipe>) {
    setDraft((d) => (d ? { ...d, ...patch } : d))
  }

  function patchMacro(key: keyof Recipe['macros'], value: string) {
    if (!draft) return
    const num = parseInt(value, 10)
    patchDraft({ macros: { ...draft.macros, [key]: Number.isFinite(num) ? num : 0 } })
  }

  function patchIngredient(index: number, patch: Partial<RecipeIngredient>) {
    if (!draft) return
    const next = draft.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing))
    patchDraft({ ingredients: next })
  }

  function addIngredient() {
    if (!draft) return
    patchDraft({ ingredients: [...draft.ingredients, { name: '', qty: '' }] })
  }

  function removeIngredient(index: number) {
    if (!draft) return
    patchDraft({ ingredients: draft.ingredients.filter((_, i) => i !== index) })
  }

  function patchStep(index: number, value: string) {
    if (!draft) return
    const next = draft.steps.map((s, i) => (i === index ? value : s))
    patchDraft({ steps: next })
  }

  function addStep() {
    if (!draft) return
    patchDraft({ steps: [...draft.steps, ''] })
  }

  function removeStep(index: number) {
    if (!draft) return
    patchDraft({ steps: draft.steps.filter((_, i) => i !== index) })
  }

  if (stage === 'paste') {
    return (
      <ScrollView contentContainerClassName="p-4" style={{ backgroundColor: c.bg }} keyboardShouldPersistTaps="handled">
        <Text className="mb-1.5 text-lg" style={{ color: c.text }}>Add a Recipe</Text>
        <Text className="mb-4 text-sm" style={{ color: c.muted }}>
          {isInstagram
            ? "Instagram doesn't share the caption with the post — open the post, copy the caption, and paste it below."
            : "Paste a recipe, a social caption, or just type what you remember — we'll turn it into a structured recipe with estimated macros."}
        </Text>
        <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Link (optional)</Text>
        <TextInput
          value={sourceUrl}
          onChangeText={setSourceUrl}
          placeholder="Paste a TikTok or Instagram link…"
          placeholderTextColor={c.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className="mb-2 rounded-xl border px-3 py-2.5 text-sm"
          style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
        />
        {sourceUrl ? (
          <Text className="mb-3 text-xs" style={{ color: c.muted }}>
            {isTikTok
              ? prefetching
                ? 'TikTok link — fetching the caption…'
                : 'TikTok link — caption filled in below.'
              : isInstagram
                ? 'Instagram link — paste the caption below, it can’t be fetched automatically.'
                : 'Link saved with this recipe.'}
          </Text>
        ) : (
          <View className="mb-3" />
        )}
        <TextInput
          autoFocus
          multiline
          value={rawText}
          onChangeText={setRawText}
          placeholder={prefetching ? 'Fetching the caption from TikTok…' : isInstagram ? 'Paste the caption here…' : 'Paste text here…'}
          placeholderTextColor={c.muted}
          textAlignVertical="top"
          className="mb-4 min-h-[160px] rounded-xl border px-3 py-2.5 text-sm"
          style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
        />
        {error ? <Text className="mb-3 text-sm" style={{ color: c.red }}>{error}</Text> : null}
        <Pressable
          onPress={handleExtract}
          disabled={extracting || !rawText.trim()}
          className="flex-row items-center justify-center gap-2 rounded-xl bg-lime py-2.5"
          style={{ opacity: extracting || !rawText.trim() ? 0.6 : 1 }}
        >
          {extracting && <ActivityIndicator color="#0e0f11" />}
          <Text className="text-sm font-extrabold text-bg">{extracting ? 'Extracting…' : 'Extract Recipe'}</Text>
        </Pressable>
      </ScrollView>
    )
  }

  if (!draft) return null

  return (
    <ScrollView contentContainerClassName="p-4" style={{ backgroundColor: c.bg }} keyboardShouldPersistTaps="handled">
      <Text className="mb-4 text-lg" style={{ color: c.text }}>Review Recipe</Text>

      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Name</Text>
      <TextInput
        value={draft.name}
        onChangeText={(v) => patchDraft({ name: v })}
        placeholderTextColor={c.muted}
        className="mb-4 rounded-xl border px-3 py-2.5 text-sm"
        style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
      />

      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Servings</Text>
      <TextInput
        value={String(draft.servings ?? '')}
        onChangeText={(v) => {
          const num = parseInt(v, 10)
          patchDraft({ servings: v.trim() === '' ? undefined : Number.isFinite(num) && num > 0 ? num : draft.servings })
        }}
        placeholder="How many portions does this make?"
        placeholderTextColor={c.muted}
        keyboardType="number-pad"
        className="mb-1 rounded-xl border px-3 py-2.5 text-sm"
        style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
      />
      <Text className="mb-4 text-xs" style={{ color: c.muted }}>
        {!draft.servings || draft.servings <= 1
          ? 'Leave blank or 1 if this is a single portion.'
          : `That's about ${Math.round(draft.macros.kcal / draft.servings)} kcal per serving.`}
      </Text>

      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Macros (whole recipe, all servings combined)</Text>
      <View className="mb-4 flex-row gap-2">
        {(['kcal', 'protein', 'carbs', 'fat'] as const).map((key) => (
          <View key={key} className="flex-1">
            <Text className="mb-1 text-[10px] uppercase" style={{ color: c.muted }}>{key}</Text>
            <TextInput
              value={String(draft.macros[key] ?? 0)}
              onChangeText={(v) => patchMacro(key, v)}
              keyboardType="number-pad"
              className="rounded-xl border px-2.5 py-2 text-center text-sm"
              style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
            />
          </View>
        ))}
      </View>

      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Ingredients</Text>
      <View className="mb-3 gap-2">
        {draft.ingredients.map((ing, i) => (
          <View key={i} className="flex-row items-center gap-2">
            <TextInput
              value={ing.name}
              onChangeText={(v) => patchIngredient(i, { name: v })}
              placeholder="Ingredient"
              placeholderTextColor={c.muted}
              className="flex-1 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
            />
            <TextInput
              value={ing.qty}
              onChangeText={(v) => patchIngredient(i, { qty: v })}
              placeholder="Qty"
              placeholderTextColor={c.muted}
              className="w-20 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
            />
            <Pressable onPress={() => removeIngredient(i)} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: c.border }}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round">
                <Line x1={18} y1={6} x2={6} y2={18} />
                <Line x1={6} y1={6} x2={18} y2={18} />
              </Svg>
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable onPress={addIngredient} className="mb-4 self-start">
        <Text className="text-sm font-semibold" style={{ color: c.lime }}>+ Add ingredient</Text>
      </Pressable>

      <Text className="mb-1.5 text-xs font-bold uppercase tracking-wide" style={{ color: c.muted }}>Steps</Text>
      <View className="mb-3 gap-2">
        {draft.steps.map((step, i) => (
          <View key={i} className="flex-row items-start gap-2">
            <Text className="mt-2.5 w-4 text-xs" style={{ color: c.muted }}>{i + 1}.</Text>
            <TextInput
              value={step}
              onChangeText={(v) => patchStep(i, v)}
              placeholder="Step"
              placeholderTextColor={c.muted}
              multiline
              className="flex-1 rounded-xl border px-3 py-2 text-sm"
              style={{ borderColor: c.border, backgroundColor: c.bg2, color: c.text }}
            />
            <Pressable onPress={() => removeStep(i)} hitSlop={8} className="mt-1 h-8 w-8 items-center justify-center rounded-full border" style={{ borderColor: c.border }}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={c.muted} strokeWidth={2} strokeLinecap="round">
                <Line x1={18} y1={6} x2={6} y2={18} />
                <Line x1={6} y1={6} x2={18} y2={18} />
              </Svg>
            </Pressable>
          </View>
        ))}
      </View>
      <Pressable onPress={addStep} className="mb-5 self-start">
        <Text className="text-sm font-semibold" style={{ color: c.lime }}>+ Add step</Text>
      </Pressable>

      {error ? <Text className="mb-3 text-sm" style={{ color: c.red }}>{error}</Text> : null}

      <View className="flex-row gap-3">
        <Pressable onPress={() => setStage('paste')} className="flex-1 items-center rounded-xl border py-2.5" style={{ borderColor: c.border }}>
          <Text className="text-sm font-semibold" style={{ color: c.muted }}>Back</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={saving} className="flex-1 items-center rounded-xl bg-lime py-2.5" style={{ opacity: saving ? 0.6 : 1 }}>
          <Text className="text-sm font-extrabold text-bg">{saving ? 'Saving…' : 'Save Recipe'}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
