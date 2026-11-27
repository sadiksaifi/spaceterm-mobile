@file:OptIn(ExperimentalMaterial3Api::class)

package expo.modules.searchbar

import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.input.clearText
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.ExpandedFullScreenSearchBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SearchBar
import androidx.compose.material3.SearchBarDefaults
import androidx.compose.material3.SearchBarValue
import androidx.compose.material3.rememberSearchBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.GenericEventPayload1
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.UIComposableScope
import expo.modules.ui.findChildSlotView
import expo.modules.ui.isSlotWithName
import expo.modules.ui.renderSlot
import kotlinx.coroutines.launch

@OptimizedComposeProps
data class SearchBarProps(
  val backLabel: String = "",
  val clearLabel: String = "",
  val modifiers: ModifierList = emptyList()
) : ComposeProps

/**
 * Expo UI's SearchBarView with what it leaves out: a trailing slot on the collapsed bar,
 * the query on every change, and the back and clear buttons of the expanded bar.
 */
@Composable
fun FunctionalComposableScope.SearchBarContent(
  props: SearchBarProps,
  onQueryChange: (GenericEventPayload1<String>) -> Unit,
  onExpandedChange: (GenericEventPayload1<Boolean>) -> Unit
) {
  val searchBarState = rememberSearchBarState()
  val textFieldState = rememberTextFieldState()
  val scope = rememberCoroutineScope()
  val expanded = searchBarState.targetValue == SearchBarValue.Expanded
  val currentOnQueryChange by rememberUpdatedState(onQueryChange)
  val currentOnExpandedChange by rememberUpdatedState(onExpandedChange)
  // The focus of the window the collapsed bar is in, not the full-screen search's.
  val barFocus = LocalFocusManager.current

  LaunchedEffect(textFieldState) {
    snapshotFlow { textFieldState.text.toString() }
      .collect { currentOnQueryChange(GenericEventPayload1(it)) }
  }

  // The full-screen search is a window of its own, so anything meant to show over it, such as a
  // snackbar, has to move into it while it is open.
  LaunchedEffect(expanded) {
    currentOnExpandedChange(GenericEventPayload1(expanded))
    // The tap that opens the search focuses the collapsed bar's input. Left focused, it takes the
    // keyboard as the full-screen search closes, and the keyboard flashes.
    barFocus.clearFocus()
  }

  // Leaving search ends it: the collapsed bar shows the placeholder again.
  LaunchedEffect(searchBarState.currentValue) {
    if (searchBarState.currentValue == SearchBarValue.Collapsed) {
      textFieldState.clearText()
    }
  }

  val inputField =
    @Composable { inBar: Boolean ->
      SearchBarDefaults.InputField(
        searchBarState = searchBarState,
        textFieldState = textFieldState,
        onSearch = {},
        // A tap on the collapsed bar only opens the search, whose own input takes the keyboard.
        // Android gives the keyboard back to a window that asked for it, so a collapsed bar that
        // asked would get it again as the search closes, and the keyboard would flash.
        keyboardOptions = KeyboardOptions(showKeyboardOnFocus = !inBar),
        placeholder = {
          Children(UIComposableScope(), filter = { isSlotWithName(it, "placeholder") })
        },
        leadingIcon = {
          if (expanded) {
            val keyboard = LocalSoftwareKeyboardController.current
            val focus = LocalFocusManager.current
            // The keyboard closes as the search collapses, not after.
            IconButton(onClick = {
              focus.clearFocus()
              keyboard?.hide()
              scope.launch { searchBarState.animateToCollapsed() }
            }) {
              Icon(painterResource(R.drawable.search_bar_arrow_back), contentDescription = props.backLabel)
            }
          } else {
            Icon(painterResource(R.drawable.search_bar_search), contentDescription = null)
          }
        },
        trailingIcon = {
          if (!expanded) {
            Children(UIComposableScope(), filter = { isSlotWithName(it, "trailingIcon") })
          } else if (textFieldState.text.isNotEmpty()) {
            IconButton(onClick = { textFieldState.clearText() }) {
              Icon(painterResource(R.drawable.search_bar_close), contentDescription = props.clearLabel)
            }
          }
        }
      )
    }

  SearchBar(
    state = searchBarState,
    inputField = { inputField(true) },
    modifier = ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher)
  )

  findChildSlotView(view, "results")?.let { results ->
    ExpandedFullScreenSearchBar(
      state = searchBarState,
      inputField = { inputField(false) },
      // The full-screen search takes the page color, so results look as they do on the page.
      colors = SearchBarDefaults.colors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
      results.renderSlot()
    }
  }
}
