package expo.modules.searchbar

import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Picture
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.ViewGroup
import android.view.Window
import kotlin.coroutines.resume
import kotlinx.coroutines.android.awaitFrame
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull

/**
 * A still picture of a window, drawn over a page in the page's own overlay, so it moves with the
 * page in the stack's transitions. Until `unshield()`, the whole window takes no touch either, as
 * the next screen takes touches before it shows. The picture goes when the page leaves its window.
 */
internal class PageCover private constructor(
  private val page: View,
  private val picture: Picture,
  private val pictureX: Float,
  private val pictureY: Float,
  color: Int
) : View.OnAttachStateChangeListener {
  private val shield = View(page.context)
  private val background = Paint().apply { this.color = color }
  private val drawable =
    object : Drawable() {
      override fun draw(canvas: Canvas) {
        canvas.drawRect(bounds, background)
        canvas.save()
        canvas.translate(pictureX, pictureY)
        canvas.drawPicture(picture)
        canvas.restore()
      }

      override fun setAlpha(alpha: Int) = Unit

      override fun setColorFilter(colorFilter: ColorFilter?) = Unit

      @Deprecated("Deprecated in Java")
      override fun getOpacity() = PixelFormat.OPAQUE
    }

  init {
    drawable.setBounds(0, 0, page.width, page.height)
    page.overlay.add(drawable)
    page.addOnAttachStateChangeListener(this)

    shield.isClickable = true
    shield.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    (page.rootView as? ViewGroup)?.let { root ->
      root.addView(shield, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
      // React Native ignores layout requests from inside its views, so the shield takes the
      // window's size here to take touches at once.
      shield.measure(
        View.MeasureSpec.makeMeasureSpec(root.width, View.MeasureSpec.EXACTLY),
        View.MeasureSpec.makeMeasureSpec(root.height, View.MeasureSpec.EXACTLY)
      )
      shield.layout(0, 0, root.width, root.height)
    }
  }

  /** Waits until the screen shows the picture, at most `timeoutMs`. */
  suspend fun awaitShown(timeoutMs: Long) {
    withTimeoutOrNull(timeoutMs) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        suspendCancellableCoroutine { continuation ->
          page.viewTreeObserver.registerFrameCommitCallback { continuation.resume(Unit) }
          page.invalidate()
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
    page.removeOnAttachStateChangeListener(this)
    page.overlay.remove(drawable)
  }

  override fun onViewAttachedToWindow(view: View) = Unit

  // The stack takes a page out of the window once the next screen covers it, and nothing on the
  // page shows until the page is back. It can do so while the window draws, when no view may leave
  // the window, so the shield leaves after that.
  override fun onViewDetachedFromWindow(view: View) {
    Handler(Looper.getMainLooper()).post(::remove)
  }

  companion object {
    /**
     * Covers `page` with a picture of what `window` shows now, over `color`. Returns null when
     * either has no size.
     */
    fun over(page: View, window: Window, color: Int): PageCover? {
      val decor = window.decorView
      if (page.width == 0 || page.height == 0 || decor.width == 0 || decor.height == 0) return null
      // A recording of the window's drawing, not a copy of its pixels: Android draws it again
      // with the page, which needs no copy from the screen and holds little memory.
      val picture = Picture()
      decor.draw(picture.beginRecording(decor.width, decor.height))
      picture.endRecording()
      val pageAt = IntArray(2).also { page.getLocationOnScreen(it) }
      val windowAt = IntArray(2).also { decor.getLocationOnScreen(it) }
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
