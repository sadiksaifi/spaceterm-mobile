@file:OptIn(ExperimentalMaterial3Api::class)

package expo.modules.searchbar

import android.view.Window
import android.view.WindowManager
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.layout.Box
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.SoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.window.DialogWindowProvider
import expo.modules.kotlin.views.AsyncFunctionHandle
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
import kotlin.coroutines.cancellation.CancellationException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** Material's short duration for an exit. */
private const val FADE_OUT_MS = 150

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
  collapse: AsyncFunctionHandle<Unit>,
  fadeOut: AsyncFunctionHandle<Int>,
  setResultsEnabled: AsyncFunctionHandle<Boolean>,
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
  val inputModeManager = LocalInputModeManager.current
  // The full-screen search's window and keyboard, from inside that window.
  var searchWindow by remember { mutableStateOf<Window?>(null) }
  var searchKeyboard by remember { mutableStateOf<SoftwareKeyboardController?>(null) }
  // Results that take no input see no touch, as a selection already leads away.
  var resultsEnabled by remember { mutableStateOf(true) }

  LaunchedEffect(textFieldState) {
    snapshotFlow { textFieldState.text.toString() }
      .collect { currentOnQueryChange(GenericEventPayload1(it)) }
  }

  // The full-screen search is a window of its own, so anything meant to show over it, such as a
  // snackbar, has to move into it while it is open.
  LaunchedEffect(expanded) {
    currentOnExpandedChange(GenericEventPayload1(expanded))
    // The tap that opens the search focuses the collapsed bar's input. Left focused, it takes the
    // keyboard as the full-screen search closes, and the keyboard flashes. Someone using a
    // keyboard or D-pad keeps their place on the bar, as Material intends.
    if (inputModeManager.inputMode == InputMode.Touch) barFocus.clearFocus()
  }

  // The page asks for these when it leaves, as the bar the search would shrink into leaves with it.
  // Either way the search closes without its own animation.
  suspend fun close(steps: suspend () -> Unit) {
    try {
      withContext(scope.coroutineContext) {
        steps()
        searchBarState.snapTo(0f)
      }
    } catch (_: CancellationException) {
      // The view went away first, which closed the search with it.
    }
  }
  collapse.handle { close {} }
  // The search stays opaque until the screen below it covers the page, then fades out over it.
  fadeOut.handle { delayMs ->
    if (searchBarState.currentValue == SearchBarValue.Collapsed) return@handle null
    close {
      searchKeyboard?.hide()
      delay(delayMs.toLong())
      // The whole window fades, as the search draws in it outside any modifier it takes.
      val window = searchWindow
      window?.clearFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
      Animatable(1f).animateTo(0f, tween(FADE_OUT_MS, easing = LinearEasing)) {
        window?.attributes = window?.attributes?.apply { alpha = value }
      }
    }
  }
  setResultsEnabled.handle { enabled -> resultsEnabled = enabled }

  // Leaving search ends it: the collapsed bar shows the placeholder again.
  LaunchedEffect(searchBarState.currentValue) {
    if (searchBarState.currentValue == SearchBarValue.Collapsed) {
      textFieldState.clearText()
      resultsEnabled = true
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
      val window = (LocalView.current.parent as? DialogWindowProvider)?.window
      val keyboard = LocalSoftwareKeyboardController.current
      DisposableEffect(window, keyboard) {
        searchWindow = window
        searchKeyboard = keyboard
        onDispose {
          searchWindow = null
          searchKeyboard = null
        }
      }
      // The parent takes each touch before the results see it.
      val lock =
        if (resultsEnabled) {
          Modifier
        } else {
          Modifier.pointerInput(Unit) {
            awaitPointerEventScope {
              while (true) {
                awaitPointerEvent(PointerEventPass.Initial).changes.forEach { it.consume() }
              }
            }
          }
        }
      Box(lock) { results.renderSlot() }
    }
  }
}
