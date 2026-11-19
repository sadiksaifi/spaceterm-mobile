package expo.modules.swiperow

import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.findChildSlotView
import expo.modules.ui.renderSlot

@OptimizedComposeProps
data class SwipeRowProps(
  val enabled: Boolean = true,
  /** Each new value puts a swiped row back. */
  val resetToken: Int = 0,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

/**
 * Material 3's swipe to dismiss, from the end side only. A swipe past the threshold leaves the
 * row aside and reports it; the caller decides, and puts the row back with a new `resetToken`.
 */
@Composable
fun FunctionalComposableScope.SwipeRowContent(props: SwipeRowProps, onSwipe: () -> Unit) {
  val state = rememberSwipeToDismissBoxState()
  val currentOnSwipe by rememberUpdatedState(onSwipe)

  LaunchedEffect(props.resetToken) {
    if (state.currentValue != SwipeToDismissBoxValue.Settled) state.reset()
  }

  SwipeToDismissBox(
    state = state,
    modifier = ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher),
    enableDismissFromStartToEnd = false,
    enableDismissFromEndToStart = props.enabled,
    gesturesEnabled = props.enabled,
    onDismiss = { currentOnSwipe() },
    backgroundContent = { findChildSlotView(view, "background")?.renderSlot() }
  ) {
    findChildSlotView(view, "content")?.renderSlot()
  }
}
