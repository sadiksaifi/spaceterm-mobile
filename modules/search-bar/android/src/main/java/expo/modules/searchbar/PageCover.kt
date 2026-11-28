package expo.modules.searchbar

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.Canvas
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.PixelCopy
import android.view.View
import android.view.ViewGroup
import android.view.Window
import kotlin.coroutines.resume
import kotlinx.coroutines.android.awaitFrame
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

/** The class of a react-native-screens screen, the page a stack shows and moves in transitions. */
private const val SCREEN_CLASS = "com.swmansion.rnscreens.Screen"

/**
 * A still picture laid over the page a view is on. It sits in the stack's own container for that
 * page, so it moves with the page in the stack's transitions. Until `unshield()`, the whole window
 * takes no touch either, as the next screen takes touches before it shows.
 */
@SuppressLint("ViewConstructor")
internal class PageCover private constructor(
  page: ViewGroup,
  private val picture: Bitmap?,
  private val pictureX: Float,
  private val pictureY: Float,
  color: Int
) : View(page.context) {
  private val shield = View(page.context)

  init {
    setBackgroundColor(color)
    isClickable = true
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    // Above the stack's header container, without a shadow at the edges.
    outlineProvider = null
    elevation = 10_000f
    page.addView(this, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    // React Native lays out its views only when it mounts them, and it ignores layout requests from
    // inside them, so the picture takes the page's size here to show in the next frame.
    measure(
      MeasureSpec.makeMeasureSpec(page.width, MeasureSpec.EXACTLY),
      MeasureSpec.makeMeasureSpec(page.height, MeasureSpec.EXACTLY)
    )
    layout(0, 0, page.width, page.height)

    shield.isClickable = true
    shield.importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    (page.rootView as? ViewGroup)?.let { root ->
      root.addView(shield, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
      shield.measure(
        MeasureSpec.makeMeasureSpec(root.width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(root.height, MeasureSpec.EXACTLY)
      )
      shield.layout(0, 0, root.width, root.height)
    }
  }

  override fun onDraw(canvas: Canvas) {
    picture?.let { canvas.drawBitmap(it, pictureX, pictureY, null) }
  }

  /** Waits until the screen shows the picture, at most `timeoutMs`. */
  suspend fun awaitShown(timeoutMs: Long) {
    withTimeoutOrNull(timeoutMs) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        suspendCancellableCoroutine { continuation ->
          viewTreeObserver.registerFrameCommitCallback { continuation.resume(Unit) }
          invalidate()
        }
      } else {
        // Two frames: one draws the picture, and the next shows it.
        repeat(2) { awaitFrame() }
      }
    }
  }

  /** Lets the window take touches again. */
  fun unshield() {
    (shield.parent as? ViewGroup)?.removeView(shield)
  }

  fun remove() {
    unshield()
    (parent as? ViewGroup)?.removeView(this)
    picture?.recycle()
  }

  companion object {
    /** What `window` shows now, or null when Android cannot copy it. */
    suspend fun capture(window: Window): Bitmap? {
      val decor = window.decorView
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || decor.width == 0 || decor.height == 0) return null
      val bitmap = Bitmap.createBitmap(decor.width, decor.height, Bitmap.Config.ARGB_8888)
      val copied = suspendCancellableCoroutine { continuation ->
        PixelCopy.request(
          window,
          bitmap,
          { result -> continuation.resume(result == PixelCopy.SUCCESS) },
          Handler(Looper.getMainLooper())
        )
      }
      if (copied) return bitmap
      bitmap.recycle()
      return null
    }

    /**
     * Covers the page `view` is on with `picture`, taken of `window`, over `color`. Returns null,
     * and recycles the picture, when `view` is on no page of a stack.
     */
    fun over(view: View, window: Window, picture: Bitmap?, color: Int): PageCover? {
      val screen = generateSequence(view.parent) { it.parent }.firstOrNull { it.javaClass.name == SCREEN_CLASS }
      val page = screen?.parent as? ViewGroup
      if (page == null) {
        picture?.recycle()
        return null
      }
      val pageAt = IntArray(2).also { page.getLocationOnScreen(it) }
      val windowAt = IntArray(2).also { window.decorView.getLocationOnScreen(it) }
      return PageCover(
        page,
        picture,
        (windowAt[0] - pageAt[0]).toFloat(),
        (windowAt[1] - pageAt[1]).toFloat(),
        color
      )
    }
  }
}
