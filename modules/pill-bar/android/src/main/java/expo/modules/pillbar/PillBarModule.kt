package expo.modules.pillbar

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.ui.ExpoUIView

class PillBarModule : Module() {
  override fun definition() = ModuleDefinition {
    // Expo module names share one namespace, so the name carries the app's.
    Name("SpaceTermPillBar")

    ExpoUIView<PillBarProps>("PillBarView") {
      // React Native already has a bubbling onSelect, so the events take names of their own.
      val onPillSelect by Event<PillSelectEvent>()
      val onPillAction by Event<PillActionEvent>()

      Content { props ->
        PillBarContent(
          props,
          onSelect = { key -> onPillSelect(PillSelectEvent(key)) },
          onAction = { key, action -> onPillAction(PillActionEvent(key, action)) }
        )
      }
    }
  }
}
