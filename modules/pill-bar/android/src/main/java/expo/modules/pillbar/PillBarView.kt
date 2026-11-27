@file:OptIn(ExperimentalMaterial3ExpressiveApi::class, ExperimentalFoundationApi::class)

package expo.modules.pillbar

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitHorizontalTouchSlopOrCancellation
import androidx.compose.foundation.gestures.horizontalDrag
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.absoluteOffset
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.AbsoluteAlignment
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.changedToUpIgnoreConsumed
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.findChildSlotView
import expo.modules.ui.renderSlot
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/** An entry of a pill's menu. */
@OptimizedRecord
data class PillAction(
  @Field val id: String = "",
  @Field val label: String = "",
  @Field val disabled: Boolean = false,
  /** A divider goes above it. */
  @Field val divided: Boolean = false
) : Record

@OptimizedRecord
data class Pill(
  @Field val key: String = "",
  @Field val name: String = "",
  @Field val actions: List<PillAction> = emptyList()
) : Record

@OptimizedComposeProps
data class PillBarProps(
  val pills: List<Pill> = emptyList(),
  val selected: String = "",
  /** The bar's distance from the bottom edge and from the sides. */
  val bottom: Float = 0f,
  val side: Float = 0f,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

data class PillSelectEvent(@Field val key: String = "") : Record

data class PillActionEvent(@Field val key: String = "", @Field val action: String = "") : Record

/** The bar's height, that of the buttons beside the capsule. */
private val HEIGHT = 56.dp
/** The space between a button and the capsule. */
private val GAP = 8.dp
/** The indicator sits this far inside the capsule at rest. */
private val INSET = 8.dp
/** Under a finger the indicator grows to sit this far inside the capsule. */
private val HELD_INSET = 3.dp
/** Room on each side of a name. */
private val PADDING = 20.dp
/** An edge with pills past it fades over this width. */
private val FADE = 14.dp
/** How much of the pills beside the widest pill shows at rest, on each side of it. */
private val PEEK = 44.dp
/** Near this distance from either side of the capsule, a dragging finger scrolls the row. */
private val EDGE = 44.dp
/** How fast the row scrolls with the finger at the capsule's side, in dp a second. */
private const val SPEED = 520f
/** A drag let go this soon, in milliseconds, after going this far is a flick, which moves on a
 * pill even if the indicator went less far. */
private const val FLICK_TIME = 250L
private val FLICK_DISTANCE = 16.dp
/** How far new content comes in from the side. */
private val ARRIVAL = 56.dp
private val MENU_CORNER = 16.dp
private val MENU_ELEVATION = 3.dp
private val MENU_WIDTH = 196.dp

/**
 * Pills in a capsule with one of them on an indicator, between the views of the `leading` and
 * `trailing` slots. The pills share the capsule when every name fits its share; otherwise each
 * takes its name's width and the row scrolls by itself to center the picked pill. A tap picks a
 * pill. A sideways drag anywhere on the capsule carries the indicator, which grows a little under
 * the finger, takes the width of the name under it, and picks the pill under it when the finger
 * lifts; a finger near either side scrolls the row toward that side, and a quick flick moves on a
 * pill. Touch and hold a pill for its menu. The indicator moves on Material's expressive springs.
 *
 * The `content` slot, when given, is the selected pill's content, and the bar sits over it at
 * the bottom. When the selection changes, the content comes in from the side of the newly
 * selected pill, so it follows the indicator.
 */
@Composable
fun FunctionalComposableScope.PillBarContent(
  props: PillBarProps,
  onSelect: (String) -> Unit,
  onAction: (String, String) -> Unit
) {
  val content = findChildSlotView(view, "content")
  val leading = findChildSlotView(view, "leading")
  val trailing = findChildSlotView(view, "trailing")

  Box(
    ModifierRegistry.applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher)
  ) {
    if (content != null) {
      Arriving(props.pills, props.selected) { content.renderSlot() }
    }
    Row(
      modifier = Modifier
        .align(Alignment.BottomCenter)
        .fillMaxWidth()
        .padding(start = props.side.dp, end = props.side.dp, bottom = props.bottom.dp)
        .height(HEIGHT),
      horizontalArrangement = Arrangement.spacedBy(GAP),
      verticalAlignment = Alignment.CenterVertically
    ) {
      leading?.renderSlot()
      Pills(
        props.pills,
        props.selected,
        onSelect,
        onAction,
        Modifier
          .weight(1f)
          .fillMaxHeight()
      )
      trailing?.renderSlot()
    }
  }
}

/** The selected pill's content, which comes in from the side of a newly selected pill. */
@Composable
private fun Arriving(pills: List<Pill>, selected: String, content: @Composable () -> Unit) {
  val motion = MaterialTheme.motionScheme
  val arrival = with(LocalDensity.current) { ARRIVAL.toPx() }
  // 1 while the content is away at the side, 0 once it is in place.
  val away = remember { Animatable(0f) }
  var side by remember { mutableStateOf(0f) }
  var last by remember { mutableStateOf(selected) }

  LaunchedEffect(selected) {
    val from = pills.indexOfFirst { it.key == last }
    val to = pills.indexOfFirst { it.key == selected }
    last = selected
    if (from == -1 || to == -1 || from == to) return@LaunchedEffect
    side = if (to > from) 1f else -1f
    away.snapTo(1f)
    away.animateTo(0f, motion.defaultSpatialSpec())
  }

  Box(
    Modifier
      .fillMaxSize()
      .graphicsLayer {
        translationX = away.value * side * arrival
        alpha = (1f - away.value * 0.6f).coerceIn(0f, 1f)
      }
  ) {
    content()
  }
}

/** A drag of the indicator, in the row's pixels, measured from its start side. */
private data class Drag(
  /** Where the finger came down and where it is, in the capsule. */
  val start: Float,
  val now: Float,
  /** The indicator's middle and the row's scroll when the drag began. */
  val from: Float,
  val scrolled: Float,
  /** The pill under the indicator. */
  val over: Int,
  /** When the finger came down, in uptime milliseconds. */
  val began: Long
)

@Composable
private fun Pills(
  pills: List<Pill>,
  selected: String,
  onSelect: (String) -> Unit,
  onAction: (String, String) -> Unit,
  modifier: Modifier
) {
  val colors = MaterialTheme.colorScheme
  val motion = MaterialTheme.motionScheme
  val style = MaterialTheme.typography.bodyLarge
  val density = LocalDensity.current
  val haptics = LocalHapticFeedback.current
  val scope = rememberCoroutineScope()
  val measurer = rememberTextMeasurer()
  val currentOnSelect by rememberUpdatedState(onSelect)

  /** A pill a tap or a drag picked, on the indicator until `selected` follows. */
  var picked by remember { mutableStateOf<String?>(null) }
  LaunchedEffect(selected) { picked = null }
  val resting = picked?.takeIf { key -> pills.any { it.key == key } } ?: selected
  var menu by remember { mutableStateOf<String?>(null) }
  var drag by remember { mutableStateOf<Drag?>(null) }

  Surface(modifier = modifier, shape = CircleShape, color = colors.surfaceContainerHigh) {
    BoxWithConstraints(
      Modifier
        .fillMaxSize()
        .padding(horizontal = INSET)
    ) {
      val viewport = constraints.maxWidth.toFloat()
      // The row runs from its start side: the right in a right-to-left layout. Positions are kept
      // from the start, and turned into the screen's left-to-right ones only to draw and to read
      // a finger, so placing, drawing, and dragging agree in both directions.
      val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
      val fromStart = { x: Float -> if (rtl) viewport - x else x }
      val leftOf = { start: Float, width: Float -> if (rtl) viewport - start - width else start }
      val px = remember(density) {
        object {
          val inset = with(density) { INSET.toPx() }
          val grow = with(density) { (INSET - HELD_INSET).toPx() }
          val padding = with(density) { PADDING.toPx() }
          val peek = with(density) { PEEK.toPx() }
          val fade = with(density) { FADE.toPx() }
          val edge = with(density) { EDGE.toPx() }
          val speed = with(density) { SPEED.dp.toPx() }
          val flick = with(density) { FLICK_DISTANCE.toPx() }
        }
      }
      val names = pills.map { it.name }
      val naturals = remember(names, style, density) {
        names.map { name -> measurer.measure(name, style, maxLines = 1).size.width + 2 * px.padding }
      }
      val widths = remember(naturals, viewport) { shareOut(naturals, viewport, px.peek) }
      val starts = remember(widths) { widths.runningFold(0f) { sum, each -> sum + each } }
      val total = starts.last()
      val farthest = (total - viewport).coerceAtLeast(0f)
      val middleOf = { index: Int -> starts[index] + widths[index] / 2 }
      val centered = { index: Int -> (middleOf(index) - viewport / 2).coerceIn(0f, farthest) }
      val restingIndex = pills.indexOfFirst { it.key == resting }.coerceAtLeast(0)

      val scroll = remember { Animatable(0f) }
      val lensMiddle = remember { Animatable(0f) }
      val lensWidth = remember { Animatable(0f) }
      var placed by remember { mutableStateOf(false) }
      val held by animateFloatAsState(if (drag == null) 0f else 1f, motion.fastSpatialSpec())

      // At rest, the indicator springs to the resting pill and the row centers it, as far as its
      // ends allow. A rename that changes the widths moves them the same way.
      LaunchedEffect(resting, widths, viewport, drag == null) {
        if (drag != null || pills.isEmpty() || viewport <= 0f) return@LaunchedEffect
        val index = restingIndex
        if (!placed) {
          scroll.snapTo(centered(index))
          lensMiddle.snapTo(middleOf(index))
          lensWidth.snapTo(widths[index])
          placed = true
          return@LaunchedEffect
        }
        launch { scroll.animateTo(centered(index), motion.defaultSpatialSpec()) }
        launch { lensMiddle.animateTo(middleOf(index), motion.defaultSpatialSpec()) }
        launch { lensWidth.animateTo(widths[index], motion.defaultSpatialSpec()) }
      }

      /** Puts the indicator under the finger, as wide as the names either side of it. */
      fun follow(now: Drag) {
        if (pills.isEmpty()) return
        val middle = (now.from + (now.now - now.start) + (scroll.value - now.scrolled))
          .coerceIn(middleOf(0), middleOf(pills.lastIndex))
        val after = (0..pills.lastIndex).firstOrNull { middleOf(it) >= middle } ?: pills.lastIndex
        val before = (after - 1).coerceAtLeast(0)
        val span = middleOf(after) - middleOf(before)
        val along = if (span > 0f) (middle - middleOf(before)) / span else 1f
        val over = if (along < 0.5f) before else after
        if (over != now.over) haptics.performHapticFeedback(HapticFeedbackType.SegmentFrequentTick)
        drag = now.copy(over = over)
        scope.launch {
          lensMiddle.snapTo(middle)
          lensWidth.snapTo(widths[before] + (widths[after] - widths[before]) * along)
        }
      }

      fun pick(key: String) {
        menu = null
        if (key == resting) return
        picked = key
        currentOnSelect(key)
      }

      // A finger near a side of the capsule scrolls the row toward it, faster the nearer it is.
      LaunchedEffect(drag != null) {
        var last = withFrameNanos { it }
        while (isActive && drag != null) {
          val time = withFrameNanos { it }
          val seconds = (time - last) / 1e9f
          last = time
          val now = drag ?: break
          val toward = when {
            now.now < px.edge && scroll.value > 0f -> -1
            now.now > viewport - px.edge && scroll.value < farthest -> 1
            else -> 0
          }
          if (toward == 0) continue
          val into = if (toward < 0) px.edge - now.now else now.now - (viewport - px.edge)
          val step = toward * (into / px.edge).coerceIn(0.5f, 1f) * px.speed * seconds
          scroll.snapTo((scroll.value + step).coerceIn(0f, farthest))
          follow(now)
        }
      }

      // The drag reads the layout it began on, so a change to the pills ends it. Only a lift
      // picks: a drag the system or a change to the pills cuts short leaves the indicator to
      // spring back to the resting pill.
      val gesture = Modifier.pointerInput(pills, widths, restingIndex, rtl) {
        fun lift(at: Long) {
          val now = drag ?: return
          var index = now.over
          val distance = now.now - now.start
          if (index == restingIndex && at - now.began < FLICK_TIME && abs(distance) >= px.flick) {
            index = (index + if (distance < 0) -1 else 1).coerceIn(0, pills.lastIndex)
          }
          drag = null
          pills.getOrNull(index)?.let { pick(it.key) }
        }
        try {
          awaitEachGesture {
            // Not only an unconsumed down, so a drag can start on a pill.
            val down = awaitFirstDown(requireUnconsumed = false)
            val crossed = awaitHorizontalTouchSlopOrCancellation(down.id) { change, _ ->
              change.consume()
            } ?: return@awaitEachGesture
            if (pills.isEmpty()) return@awaitEachGesture
            menu = null
            // From where the finger came down, so the indicator keeps up with it past the slop.
            val start = fromStart(down.position.x)
            val first = Drag(start, start, lensMiddle.value, scroll.value, restingIndex, down.uptimeMillis)
            drag = first
            scope.launch {
              scroll.stop()
              lensMiddle.stop()
              lensWidth.stop()
            }
            follow(first.copy(now = fromStart(crossed.position.x)))
            var finger = crossed.id
            val lifted = horizontalDrag(crossed.id) { change ->
              change.consume()
              drag?.let { now ->
                val at = fromStart(change.position.x)
                // Another finger can carry on the drag when the first lifts. It moves the
                // indicator from where it was, not by how far it is from the first finger.
                val start = if (change.id == finger) now.start else at - (now.now - now.start)
                finger = change.id
                follow(now.copy(start = start, now = at))
              }
            }
            if (lifted) {
              // Timed to the lift, so a quick move that then holds still is a drag, not a flick.
              val up = currentEvent.changes.firstOrNull { it.changedToUpIgnoreConsumed() }
              lift(up?.uptimeMillis ?: currentEvent.changes.first().uptimeMillis)
            } else {
              drag = null
            }
          }
        } finally {
          // A change to the pills cancels the gesture without an up.
          drag = null
        }
      }

      // Pinned to the left in both directions, since each pill is placed from the screen's left.
      Box(
        contentAlignment = AbsoluteAlignment.TopLeft,
        modifier = gesture
          .fillMaxSize()
          .clipToBounds()
          .selectableGroup()
          // Offscreen, so the fade takes away the row's own pixels, not the window's.
          .graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }
          .drawWithContent {
            drawContent()
            val left = if (rtl) total - scroll.value - size.width > 0.5f else scroll.value > 0.5f
            val right = if (rtl) scroll.value > 0.5f else total - scroll.value - size.width > 0.5f
            if (left) {
              drawRect(
                Brush.horizontalGradient(listOf(Color.Transparent, Color.Black), endX = px.fade),
                size = Size(px.fade, size.height),
                blendMode = BlendMode.DstIn
              )
            }
            if (right) {
              val from = size.width - px.fade
              drawRect(
                Brush.horizontalGradient(listOf(Color.Black, Color.Transparent), startX = from, endX = size.width),
                topLeft = Offset(from, 0f),
                size = Size(px.fade, size.height),
                blendMode = BlendMode.DstIn
              )
            }
          }
          .drawBehind {
            if (!placed) return@drawBehind
            val grow = held * px.grow
            val width = lensWidth.value + 2 * grow
            val height = size.height - 2 * (px.inset - grow)
            drawRoundRect(
              color = colors.primaryContainer,
              // Kept inside the capsule, so a grown indicator at either end shows whole.
              topLeft = Offset(
                leftOf(lensMiddle.value - scroll.value - width / 2, width)
                  .coerceIn(0f, (size.width - width).coerceAtLeast(0f)),
                px.inset - grow
              ),
              size = Size(width, height),
              cornerRadius = CornerRadius(height / 2)
            )
          }
      ) {
        pills.forEachIndexed { index, pill -> key(pill.key) {
          val lit = (drag?.over ?: restingIndex) == index
          val color by animateColorAsState(
            if (lit) colors.onPrimaryContainer else colors.onSurfaceVariant,
            motion.fastEffectsSpec()
          )
          Box(
            Modifier
              .absoluteOffset {
                val start = starts.getOrElse(index) { 0f } - scroll.value
                IntOffset(leftOf(start, widths.getOrElse(index) { 0f }).roundToInt(), 0)
              }
              .width(with(density) { widths.getOrElse(index) { 0f }.toDp() })
              .fillMaxHeight()
              .padding(vertical = INSET)
          ) {
            Box(
              Modifier
                .fillMaxSize()
                .clip(CircleShape)
                .combinedClickable(
                  role = Role.Tab,
                  onClick = { pick(pill.key) },
                  onLongClick = { menu = pill.key }
                )
                .semantics { this.selected = pill.key == selected },
              contentAlignment = Alignment.Center
            ) {
              Text(
                pill.name,
                color = color,
                style = style,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(horizontal = PADDING)
              )
            }
            DropdownMenu(
              expanded = menu == pill.key,
              onDismissRequest = { menu = null },
              containerColor = colors.surfaceContainerHigh,
              shape = RoundedCornerShape(MENU_CORNER),
              shadowElevation = MENU_ELEVATION
            ) {
              pill.actions.forEach { action ->
                if (action.divided) HorizontalDivider(Modifier.padding(horizontal = 8.dp))
                DropdownMenuItem(
                  text = { Text(action.label) },
                  enabled = !action.disabled,
                  modifier = Modifier.defaultMinSize(minWidth = MENU_WIDTH),
                  onClick = {
                    menu = null
                    onAction(pill.key, action.id)
                  }
                )
              }
            }
          }
        } }
      }
    }
  }
}

/**
 * The widths of pills whose whole names take `natural`, in a row `width` wide. They share the row
 * when each fits its share; otherwise each takes its own width, cut so that a peek of the pills
 * beside it still shows, and never under half the row.
 */
private fun shareOut(natural: List<Float>, width: Float, peek: Float): List<Float> {
  if (natural.isEmpty() || width <= 0f) return natural.map { 0f }
  val share = width / natural.size
  val widest = if (natural.size > 1) maxOf(width - 2 * peek, width / 2) else width
  val cut = natural.map { minOf(it, widest, width) }
  return if (cut.all { it <= share }) cut.map { share } else cut
}
