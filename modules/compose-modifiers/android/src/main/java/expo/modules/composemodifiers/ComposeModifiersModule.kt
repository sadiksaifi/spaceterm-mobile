package expo.modules.composemodifiers

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.records.recordFromMap
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.ui.ModifierEventDispatcher
import expo.modules.ui.ModifierRegistry
import kotlin.math.abs

@OptimizedRecord
data class MaxWidthFractionParams(@Field val fraction: Float = 1f) : Record

@OptimizedRecord
data class HorizontalSwipeParams(@Field val distance: Float = 32f) : Record

@OptimizedRecord
data class FadingEdgesParams(@Field val left: Float = 0f, @Field val right: Float = 0f) : Record

@OptimizedRecord
data class RadioSelectedParams(@Field val selected: Boolean = false) : Record

/** Caps the width at a fraction of the width offered. In a Row, that is the space left for the view. */
fun maxWidthFraction(fraction: Float): Modifier =
  Modifier.layout { measurable, constraints ->
    val maxWidth = (constraints.maxWidth * fraction).toInt().coerceAtLeast(constraints.minWidth)
    val placeable = measurable.measure(constraints.copy(maxWidth = maxWidth))
    layout(placeable.width, placeable.height) { placeable.place(0, 0) }
  }

/** Fades the view's content to transparent over `left` and `right` pixels at its sides. */
fun fadingEdges(left: Float, right: Float): Modifier =
  Modifier
    // Offscreen, so the fade takes away the content's own pixels, not the window's.
    .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
    .drawWithContent {
      drawContent()
      if (left > 0f) {
        drawRect(
          Brush.horizontalGradient(listOf(Color.Transparent, Color.Black), startX = 0f, endX = left),
          size = Size(left, size.height),
          blendMode = BlendMode.DstIn
        )
      }
      if (right > 0f) {
        val start = size.width - right
        drawRect(
          Brush.horizontalGradient(listOf(Color.Black, Color.Transparent), startX = start, endX = size.width),
          topLeft = Offset(start, 0f),
          size = Size(right, size.height),
          blendMode = BlendMode.DstIn
        )
      }
    }

/**
 * Reports a sideways drag of at least `distance` pixels, once the finger lifts, as "left" or
 * "right". The drag takes the gesture from the clickable views inside, so they do not also get a
 * tap; a tap or a touch and hold still reaches them.
 */
fun horizontalSwipe(distance: Float, onSwipe: (String) -> Unit): Modifier =
  Modifier.pointerInput(distance) {
    var total = 0f
    detectHorizontalDragGestures(
      onDragStart = { total = 0f },
      onDragEnd = { if (abs(total) >= distance) onSwipe(if (total < 0) "left" else "right") },
      onDragCancel = { total = 0f },
    ) { change, amount ->
      change.consume()
      total += amount
    }
  }

/** Modifiers Expo UI leaves out. */
class ComposeModifiersModule : Module() {
  override fun definition() = ModuleDefinition {
    // Expo module names share one namespace, so the name carries the app's.
    Name("SpaceTermComposeModifiers")

    OnCreate {
      ModifierRegistry.register("maxWidthFraction") { map, _, converterContext, _ ->
        maxWidthFraction(recordFromMap<MaxWidthFractionParams>(map, converterContext).fraction)
      }
      ModifierRegistry.register("heading") { _, _, _, _ -> Modifier.semantics { heading() } }
      ModifierRegistry.register("radioSelected") { map, _, converterContext, _ ->
        val selected = recordFromMap<RadioSelectedParams>(map, converterContext).selected
        Modifier.semantics {
          role = Role.RadioButton
          this.selected = selected
        }
      }
      ModifierRegistry.register("hiddenFromAccessibility") { _, _, _, _ ->
        Modifier.clearAndSetSemantics {}
      }
      ModifierRegistry.register("disabled") { _, _, _, _ -> Modifier.semantics { disabled() } }
      ModifierRegistry.register("fadingEdges") { map, _, converterContext, _ ->
        val params = recordFromMap<FadingEdgesParams>(map, converterContext)
        val density = LocalDensity.current
        with(density) { fadingEdges(params.left.dp.toPx(), params.right.dp.toPx()) }
      }
      ModifierRegistry.register("horizontalSwipe") { map, _, converterContext, eventDispatcher ->
        val distance = recordFromMap<HorizontalSwipeParams>(map, converterContext).distance
        val pixels = with(LocalDensity.current) { distance.dp.toPx() }
        // The drag outlives recompositions, so it reads the dispatcher of the latest one.
        val dispatch: ModifierEventDispatcher by rememberUpdatedState(eventDispatcher)
        horizontalSwipe(pixels) { direction ->
          dispatch("horizontalSwipe", mapOf("direction" to direction))
        }
      }
    }

    OnDestroy {
      ModifierRegistry.unregister("maxWidthFraction")
      ModifierRegistry.unregister("heading")
      ModifierRegistry.unregister("radioSelected")
      ModifierRegistry.unregister("hiddenFromAccessibility")
      ModifierRegistry.unregister("disabled")
      ModifierRegistry.unregister("fadingEdges")
      ModifierRegistry.unregister("horizontalSwipe")
    }
  }
}
