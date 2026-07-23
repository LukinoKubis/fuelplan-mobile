import { SafeAreaView } from 'react-native-safe-area-context'
import { usePlan } from '../../../state/PlanContext'
import { ShoppingList } from '../../../components/fuel/ShoppingList'

export default function HaulScreen() {
  const { plan } = usePlan()
  return (
    <SafeAreaView className="flex-1 bg-light-bg dark:bg-bg" edges={['top']}>
      <ShoppingList categories={plan?.shopping_list || []} />
    </SafeAreaView>
  )
}
