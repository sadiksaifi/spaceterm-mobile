package expo.modules.composemodifiers

import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.records.recordFromMap
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.ui.ModifierRegistry

@OptimizedRecord
data class MaxWidthFractionParams(@Field val fraction: Float = 1f) : Record

/** Caps the width at a fraction of the width offered. In a Row, that is the space left for the view. */
fun maxWidthFraction(fraction: Float): Modifier =
  Modifier.layout { measurable, constraints ->
    val maxWidth = (constraints.maxWidth * fraction).toInt().coerceAtLeast(constraints.minWidth)
    val placeable = measurable.measure(constraints.copy(maxWidth = maxWidth))
    layout(placeable.width, placeable.height) { placeable.place(0, 0) }
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
    }

    OnDestroy {
      ModifierRegistry.unregister("maxWidthFraction")
      ModifierRegistry.unregister("heading")
    }
  }
}
