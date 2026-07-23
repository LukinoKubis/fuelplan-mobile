// RN has no font inheritance like the web's `body { font-family }` cascade —
// every <Text> defaults to the platform system font unless told otherwise.
// This wrapper defaults every text node to Figtree (the web app's body
// font) so we don't have to remember `font-body` on every single usage;
// pass `font-display` (Syne) explicitly for headings, same as the web app's
// h1-h4 rule. Import this instead of react-native's Text everywhere.
import { Text as RNText, type TextProps } from 'react-native'

export function Text({ className, ...props }: TextProps) {
  return <RNText className={`font-body ${className || ''}`} {...props} />
}
