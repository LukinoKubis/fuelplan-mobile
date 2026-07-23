import { Component, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/Text'
import Svg, { Line, Path } from 'react-native-svg'

interface Props {
  children: ReactNode
  onReset?: () => void
}

interface State {
  error: Error | null
}

// Defense-in-depth: if a render crashes (e.g. an AI-generated response that
// doesn't quite match the expected shape slips past validation), show a
// recovery screen instead of an uncaught exception unmounting the whole app.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <View className="flex-1 items-center justify-center gap-4 px-8">
          <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#ff5757" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <Line x1={12} y1={9} x2={12} y2={13} />
            <Line x1={12} y1={17} x2={12.01} y2={17} />
          </Svg>
          <Text className="text-center font-display text-lg text-light-text dark:text-text">Something went wrong displaying this</Text>
          <Text className="max-w-xs text-center text-sm text-light-muted dark:text-muted">This screen hit an unexpected error. Try again — your data hasn't been lost.</Text>
          <Pressable
            onPress={() => {
              this.setState({ error: null })
              this.props.onReset?.()
            }}
            className="rounded-xl bg-lime px-5 py-2.5"
          >
            <Text className="text-sm font-extrabold text-bg">Try again</Text>
          </Pressable>
        </View>
      )
    }
    return this.props.children
  }
}
