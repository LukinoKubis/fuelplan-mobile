import { View } from 'react-native'
import { usePlan } from '../../../state/PlanContext'
import { ShoppingList } from '../../../components/fuel/ShoppingList'
import { ErrorBoundary } from '../../../components/shared/ErrorBoundary'

export default function HaulScreen() {
  const { plan } = usePlan()
  return (
    <ErrorBoundary>
      <View className="flex-1 bg-light-bg dark:bg-bg">
        <ShoppingList categories={plan?.shopping_list || []} />
      </View>
    </ErrorBoundary>
  )
}
