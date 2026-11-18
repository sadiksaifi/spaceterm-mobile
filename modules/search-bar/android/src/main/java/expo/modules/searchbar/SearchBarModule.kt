package expo.modules.searchbar

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.ui.ExpoUIView
import expo.modules.ui.GenericEventPayload1

class SearchBarModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SearchBar")

    ExpoUIView<SearchBarProps>("SearchBarView") {
      val onQueryChange by Event<GenericEventPayload1<String>>()

      Content { props ->
        SearchBarContent(props) { onQueryChange(it) }
      }
    }
  }
}
