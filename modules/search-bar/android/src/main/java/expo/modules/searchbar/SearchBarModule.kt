package expo.modules.searchbar

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.ui.ExpoUIView
import expo.modules.ui.GenericEventPayload1

class SearchBarModule : Module() {
  override fun definition() = ModuleDefinition {
    // Expo module names share one namespace, so the name carries the app's.
    Name("SpaceTermSearchBar")

    ExpoUIView<SearchBarProps>("SearchBarView") {
      val onQueryChange by Event<GenericEventPayload1<String>>()
      val onExpandedChange by Event<GenericEventPayload1<Boolean>>()
      val collapse by AsyncFunction()
      val fadeOut by AsyncFunction<Int>()
      val setResultsEnabled by AsyncFunction<Boolean>()

      Content { props ->
        SearchBarContent(
          props,
          collapse,
          fadeOut,
          setResultsEnabled,
          { onQueryChange(it) },
          { onExpandedChange(it) }
        )
      }
    }
  }
}
