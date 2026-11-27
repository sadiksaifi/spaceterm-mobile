package expo.modules.composemodifiers

import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.layout
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.disabled
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.records.recordFromMap
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.columnScope
import expo.modules.ui.rowScope

@OptimizedRecord
data class MaxWidthFractionParams(@Field val fraction: Float = 1f) : Record

@OptimizedRecord
data class RadioSelectedParams(@Field val selected: Boolean = false) : Record

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
      ModifierRegistry.register("flexible") { _, scope, _, _ ->
        // Measured after its siblings, so a long text gives way to the icons beside it.
        scope?.rowScope?.run { Modifier.weight(1f, fill = false) }
          ?: scope?.columnScope?.run { Modifier.weight(1f, fill = false) }
          ?: Modifier
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
    }

    OnDestroy {
      ModifierRegistry.unregister("maxWidthFraction")
      ModifierRegistry.unregister("flexible")
      ModifierRegistry.unregister("heading")
      ModifierRegistry.unregister("radioSelected")
      ModifierRegistry.unregister("hiddenFromAccessibility")
      ModifierRegistry.unregister("disabled")
    }
  }
}
