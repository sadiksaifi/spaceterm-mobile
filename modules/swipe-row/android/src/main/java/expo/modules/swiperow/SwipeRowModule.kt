package expo.modules.swiperow

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.ui.ExpoUIView

class SwipeRowModule : Module() {
  override fun definition() = ModuleDefinition {
    // Expo module names share one namespace, so the name carries the app's.
    Name("SpaceTermSwipeRow")

    ExpoUIView<SwipeRowProps>("SwipeRowView") {
      val onSwipe by Event<Unit>()

      Content { props ->
        SwipeRowContent(props) { onSwipe(Unit) }
      }
    }
  }
}
