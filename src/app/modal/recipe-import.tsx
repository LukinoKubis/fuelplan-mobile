import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native'
import { Text } from '@/components/Text'
import { useLocalSearchParams, useRouter } from 'expo-router'
import Svg, { Line } from 'react-native-svg'
import { useThemeColors } from '../../lib/themeColors'
import { ApiError, extractInstagramCaption, extractVideoText, postClaude, saveRecipe } from '../../lib/client'
import { buildExtractRecipeRequest, buildRecalculateMacrosRequest } from '../../lib/recipePrompt'
import { friendlyErrorMessage } from '../../lib/errorMessage'
import { useAccount } from '../../state/AccountContext'
import { RecipePhotoPicker } from '../../components/shared/RecipePhotoPicker'
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
  // True once the ingredient list has changed since macros were last
  // computed (initial extraction, or a prior recalculate) — ingredient
  // edits don't recompute macros on their own (see addIngredient/
  // removeIngredient/patchIngredient below), so this flag is what tells
  // the user their macros are now out of date instead of silently
  // leaving stale numbers with no indication.
  const [macrosStale, setMacrosStale] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcError, setRecalcError] = useState('')
  const [prefetching, setPrefetching] = useState(false)
  const [videoReading, setVideoReading] = useState(false)
  const [videoNote, setVideoNote] = useState('')
  // Spoken transcript + on-screen text feed the AI extraction call (see
  // handleExtract below) but are deliberately never shown in the visible
  // text field — a transcript is often just song lyrics or unrelated
  // chatter, which looks broken sitting next to the actual caption. Only
  // the caption/description (rawText) is ever user-visible.
  const [videoContext, setVideoContext] = useState('')
  const [oEmbedDone, setOEmbedDone] = useState(false)
  const [videoReadDone, setVideoReadDone] = useState(false)
  const [videoEmptyWarning, setVideoEmptyWarning] = useState('')
  const warnedEmptyRef = useRef(false)
  const [igReading, setIgReading] = useState(false)
  const [igFailed, setIgFailed] = useState(false)

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
    if (!isTikTok) return
    if (rawText.trim()) {
      setOEmbedDone(true) // already has text (manual paste/share-intent) — nothing to fetch, but still "done" for the empty-video check below
      return
    }
    let cancelled = false
    setPrefetching(true)
    setOEmbedDone(false)
    fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(sourceUrl)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { title?: string } | null) => {
        if (!cancelled && d?.title) setRawText(d.title)
      })
      .catch(() => {
        /* prefill is best-effort — the user can always paste manually */
      })
      .finally(() => {
        if (!cancelled) {
          setPrefetching(false)
          setOEmbedDone(true)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl])

  // Reads spoken audio + on-screen text overlays the caption alone doesn't
  // cover — a real scrape (see client.ts/backend's videoExtract.ts), not
  // an instant call, so it runs in parallel with the oEmbed caption fetch
  // above. Stored separately in videoContext (used only by handleExtract's
  // AI call below), never appended into the visible rawText field — a
  // transcript is often just song lyrics or unrelated chatter, and showing
  // that raw next to the actual caption looks broken. Best-effort: a
  // failure here just means the caption (if any) is still there to work
  // with, never blocks pasting/editing.
  useEffect(() => {
    if (!isTikTok) return
    let cancelled = false
    setVideoReading(true)
    setVideoNote('')
    setVideoReadDone(false)
    setVideoEmptyWarning('')
    warnedEmptyRef.current = false
    extractVideoText(sourceUrl)
      .then((result) => {
        if (cancelled) return
        const parts = [result.transcript, result.onScreenText].map((s) => s.trim()).filter(Boolean)
        setVideoContext(parts.join('\n\n'))
        if (result.warnings.length) setVideoNote(result.warnings.join(' '))
      })
      .catch((err) => {
        if (cancelled) return
        setVideoNote(err instanceof ApiError ? err.message : 'Could not read the video — paste or edit the text manually instead.')
      })
      .finally(() => {
        if (!cancelled) {
          setVideoReading(false)
          setVideoReadDone(true)
        }
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceUrl])

  // Once both the caption fetch and the video read have settled, warn once
  // if there was genuinely nothing to work with anywhere (no caption, no
  // transcript, no on-screen text) — some videos are just B-roll of someone
  // cooking with no readable text at all, and silently leaving an empty
  // field is confusing. Doesn't block manual typing — just an early heads-up.
  // Uses the same inline-message pattern as `error` below rather than RN's
  // Alert — react-native-web's Alert.alert is a total no-op stub (confirmed
  // by reading node_modules/react-native-web's source: `static alert() {}`),
  // so on the real web deploy at app.fuelplan.fit this would otherwise
  // silently do nothing.
  useEffect(() => {
    if (!isTikTok || !oEmbedDone || !videoReadDone || warnedEmptyRef.current) return
    if (!rawText.trim() && !videoContext.trim()) {
      warnedEmptyRef.current = true
      setVideoEmptyWarning(
        "Couldn't find anything to import from this video — no caption and nothing readable in the video itself. Try pasting the recipe manually, or a different TikTok link."
      )
    }
  }, [isTikTok, oEmbedDone, videoReadDone, rawText, videoContext])

  // Instagram's post page carries the caption in its og:description meta
  // tag, injected client-side by Instagram's own app — same
  // real-headless-browser scrape as the TikTok video read, but much
  // faster since there's no video/audio involved (see
  // claude-backend/instagramExtract.ts). Only some posts are actually
  // readable this way (login-walled/private/age-restricted ones aren't) —
  // a failure here just leaves the manual "paste the caption" prompt in
  // place, exactly like before this existed.
  useEffect(() => {
    if (!isInstagram || rawText.trim()) return
    let cancelled = false
    setIgReading(true)
    setIgFailed(false)
    extractInstagramCaption(sourceUrl)
      .then((result) => {
        if (!cancelled && result.caption) setRawText(result.caption)
      })
      .catch(() => {
        if (!cancelled) setIgFailed(true)
      })
      .finally(() => {
        if (!cancelled) setIgReading(false)
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
      // videoContext (transcript + on-screen text) is never shown in the
      // text field, but still helps extraction when it's genuinely
      // recipe-related — appended here, not in rawText itself.
      const combinedText = videoContext.trim() ? rawText.trim() + '\n\n' + videoContext.trim() : rawText
      const { system, messages, model, max_tokens } = buildExtractRecipeRequest({ rawText: combinedText, sourceUrl: sourceUrl || undefined })
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
      setMacrosStale(false)
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
    setMacrosStale(false)
  }

  function patchIngredient(index: number, patch: Partial<RecipeIngredient>) {
    if (!draft) return
    const next = draft.ingredients.map((ing, i) => (i === index ? { ...ing, ...patch } : ing))
    patchDraft({ ingredients: next })
    setMacrosStale(true)
  }

  function addIngredient() {
    if (!draft) return
    patchDraft({ ingredients: [...draft.ingredients, { name: '', qty: '' }] })
    setMacrosStale(true)
  }

  function removeIngredient(index: number) {
    if (!draft) return
    patchDraft({ ingredients: draft.ingredients.filter((_, i) => i !== index) })
    setMacrosStale(true)
  }

  /** Re-calls Claude to recompute macros for the current (possibly hand-edited) ingredient list — see macrosStale above. */
  async function handleRecalculate() {
    if (!draft) return
    setRecalcError('')
    setRecalculating(true)
    try {
      const { system, messages, model, max_tokens } = buildRecalculateMacrosRequest({ recipe: draft })
      const response = await postClaude({ model, max_tokens, system, messages })
      const text = response.content[0]?.text || ''
      const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
      let parsed: Partial<Recipe>
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        const match = cleaned.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('Got invalid JSON back. Please try again.')
        parsed = JSON.parse(match[0])
      }
      // Only macros/servings come from the response — ingredients/steps/name
      // stay exactly what the user has on screen, never silently rewritten.
      patchDraft({ macros: parsed.macros || draft.macros, servings: parsed.servings ?? draft.servings })
      setMacrosStale(false)
      refreshRemaining()
    } catch (err) {
      setRecalcError(err instanceof ApiError ? err.message : friendlyErrorMessage(err))
    } finally {
      setRecalculating(false)
    }
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
          Paste a recipe, a social caption, or just type what you remember — we'll turn it into a structured recipe with estimated macros.
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
          <View className="mb-3 gap-1">
            <Text className="text-xs" style={{ color: c.muted }}>
              {isTikTok
                ? prefetching
                  ? 'TikTok link — fetching the caption…'
                  : rawText.trim()
                    ? 'TikTok link — caption filled in below.'
                    : "TikTok link — couldn't find a caption automatically, paste it below."
                : isInstagram
                  ? igReading
                    ? 'Instagram link — reading the caption…'
                    : igFailed
                      ? "Instagram link — couldn't read the caption automatically, paste it below."
                      : 'Instagram link — caption filled in below.'
                  : 'Link saved with this recipe.'}
            </Text>
            {isTikTok && (
              <View className="flex-row items-center gap-1.5">
                {videoReading && <ActivityIndicator size="small" color={c.muted} />}
                <Text className="text-xs" style={{ color: c.muted }}>
                  {videoReading
                    ? 'Reading the video for spoken/on-screen ingredients too — this can take up to 20s…'
                    : videoNote || 'Also checked the video itself for anything the caption missed.'}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="mb-3" />
        )}
        {videoEmptyWarning ? (
          <View className="mb-3 rounded-xl border px-3 py-2.5" style={{ borderColor: c.orange, backgroundColor: 'rgba(255,154,66,0.1)' }}>
            <Text className="text-xs" style={{ color: c.orange }}>{videoEmptyWarning}</Text>
          </View>
        ) : null}
        <TextInput
          autoFocus
          multiline
          value={rawText}
          onChangeText={setRawText}
          placeholder={
            prefetching
              ? 'Fetching the caption from TikTok…'
              : igReading
                ? 'Reading the caption from Instagram…'
                : isInstagram
                  ? 'Paste the caption here…'
                  : 'Paste text here…'
          }
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

      <RecipePhotoPicker photo={draft.photo} onChange={(photo) => patchDraft({ photo })} />

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

      {macrosStale ? (
        <View className="mb-4 rounded-xl border px-3 py-2.5" style={{ borderColor: c.orange, backgroundColor: 'rgba(255,154,66,0.1)' }}>
          <Text className="mb-2 text-xs" style={{ color: c.orange }}>
            Ingredients changed — the macros above no longer reflect them.
          </Text>
          {recalcError ? <Text className="mb-2 text-xs" style={{ color: c.red }}>{recalcError}</Text> : null}
          <Pressable
            onPress={handleRecalculate}
            disabled={recalculating}
            className="flex-row items-center justify-center gap-2 rounded-xl bg-orange py-2"
            style={{ opacity: recalculating ? 0.6 : 1 }}
          >
            {recalculating && <ActivityIndicator color="#0e0f11" />}
            <Text className="text-xs font-extrabold text-bg">{recalculating ? 'Recalculating…' : 'Recalculate Macros'}</Text>
          </Pressable>
        </View>
      ) : null}

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
