import { Redirect } from 'expo-router'

/**
 * Root entry route — always points at the Fuel tab. Both the (auth) and
 * (tabs) group layouts re-redirect from there based on actual auth state,
 * so this just needs a single sane default rather than its own auth check.
 */
export default function Index() {
  return <Redirect href="/(tabs)/fuel" />
}
