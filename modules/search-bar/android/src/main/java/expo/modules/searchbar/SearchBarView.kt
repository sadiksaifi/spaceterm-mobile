@file:OptIn(ExperimentalMaterial3Api::class)

package expo.modules.searchbar

import android.view.Window
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
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.input.InputMode
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalInputModeManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.platform.LocalView
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
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/** The longest the search waits for the picture of it on the page, a few frames. */
private const val PICTURE_SHOWN_MS = 100L

/**
 * The longest the window takes no touch after search closes over its picture. The page lifts it
 * sooner, once the next screen covers the page. It outlasts the stack's 450 ms push at twice the
 * animation scale, and keeps the window from staying untouchable when the page never hears back.
 */
private const val SHIELD_MS = 1000L

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
  cover: AsyncFunctionHandle<Unit>,
  uncover: AsyncFunctionHandle<Unit>,
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
  // The full-screen search's window, from inside that window.
  var searchWindow by remember { mutableStateOf<Window?>(null) }
  // Results see no touch once a selection leads away.
  var resultsEnabled by remember { mutableStateOf(true) }
  var pageCover by remember { mutableStateOf<PageCover?>(null) }
  var covering by remember { mutableStateOf<Job?>(null) }
  // The page lost focus, so search stays closed until it has focus again.
  var leaving by remember { mutableStateOf(false) }
  // The page the search bar is on: its host's Compose view, which moves with it.
  val page = LocalView.current
  val pageColor = MaterialTheme.colorScheme.surface.toArgb()
  // Ends the search with no animation, also one that is opening.
  suspend fun closeAtOnce() {
    val open = searchBarState.currentValue == SearchBarValue.Expanded
    if (open || searchBarState.targetValue == SearchBarValue.Expanded) searchBarState.snapTo(0f)
  }

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

  // The page asks for these when it loses focus. The full-screen search is a window above every
  // screen, so the next screen would open under it. Search closes at once instead, and a picture
  // of it stays on the page, so the page never shows before the next screen covers it.
  cover.handle {
    try {
      withContext(scope.coroutineContext) {
        leaving = true
        // Search is closed, or it is opening and its window does not exist yet.
        val window = searchWindow ?: return@withContext closeAtOnce()
        val job = scope.launch {
          resultsEnabled = false
          pageCover?.remove()
          val shown = PageCover.over(page, window, pageColor)
          pageCover = shown
          // The search window leaves the screen as soon as it closes, so it waits for the picture.
          shown?.awaitShown(PICTURE_SHOWN_MS)
          searchBarState.snapTo(0f)
          scope.launch {
            delay(SHIELD_MS)
            shown?.unshield()
          }
        }
        covering = job
        job.join()
      }
    } catch (_: CancellationException) {
      // The view went away first, which closed the search and removed the picture with it.
    }
  }
  // The page can show again before cover() is done, so this finishes the close without the picture.
  uncover.handle {
    try {
      withContext(scope.coroutineContext) {
        leaving = false
        val job = covering
        covering = null
        if (job?.isActive == true) {
          job.cancel()
          job.join()
          closeAtOnce()
        }
        pageCover?.remove()
        pageCover = null
      }
    } catch (_: CancellationException) {
      // The view went away first, which closed the search and removed the picture with it.
    }
  }
  // Search can start to open after the page lost focus, as the window opens a frame later.
  LaunchedEffect(leaving, expanded) {
    if (leaving && expanded && covering?.isActive != true) closeAtOnce()
  }
  DisposableEffect(Unit) { onDispose { pageCover?.remove() } }

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
      DisposableEffect(window) {
        searchWindow = window
        onDispose { searchWindow = null }
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
