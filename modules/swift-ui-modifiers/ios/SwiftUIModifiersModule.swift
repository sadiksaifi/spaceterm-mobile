import ExpoModulesCore
import ExpoUI
import SwiftUI

/**
 * Fades the view's content to transparent over `start` and `end` points at its leading and
 * trailing sides, which follow the layout direction.
 */
struct FadingEdgesModifier: ViewModifier, Record {
  @Field var start: CGFloat = 0
  @Field var end: CGFloat = 0

  func body(content: Content) -> some View {
    content.mask {
      HStack(spacing: 0) {
        LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing)
          .frame(width: start)
        Color.black
        LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing)
          .frame(width: end)
      }
    }
  }
}

/**
 * Reports a sideways drag of at least `distance` points, once the finger lifts, as "left" or
 * "right". A finger that moves takes the touch from the buttons inside, so a swipe that starts on
 * one does not also press it; a tap or a touch and hold stays theirs.
 */
struct HorizontalSwipeModifier: ViewModifier, Record {
  /** How far a finger moves before the drag counts. */
  private static let slop: CGFloat = 16

  /** Names the modifier in the swipes the module reports. */
  @Field var id: String = ""
  @Field var distance: CGFloat = 32
  var report: ((_ id: String, _ direction: String) -> Void)?

  init() {}

  init(from params: Dict, appContext: AppContext, report: @escaping (String, String) -> Void) throws {
    try self = .init(from: params, appContext: appContext)
    self.report = report
  }

  func body(content: Content) -> some View {
    content.highPriorityGesture(
      DragGesture(minimumDistance: Self.slop).onEnded { drag in
        let (dx, dy) = (drag.translation.width, drag.translation.height)
        guard abs(dx) >= distance, abs(dx) > 2 * abs(dy) else { return }
        report?(id, dx < 0 ? "left" : "right")
      }
    )
  }
}

/** Modifiers Expo UI leaves out. */
public class SwiftUIModifiersModule: Module {
  public func definition() -> ModuleDefinition {
    // Expo module names share one namespace, so the name carries the app's.
    Name("SpaceTermSwiftUIModifiers")

    // Expo UI never delivered this modifier's events through the Workspace bar's view, so swipes
    // come through the module.
    Events("onHorizontalSwipe")

    OnCreate {
      ViewModifierRegistry.register("fadingEdges") { params, appContext, _ in
        try FadingEdgesModifier(from: params, appContext: appContext)
      }
      ViewModifierRegistry.register("horizontalSwipe") { [weak self] params, appContext, _ in
        try HorizontalSwipeModifier(from: params, appContext: appContext) { id, direction in
          self?.sendEvent("onHorizontalSwipe", ["id": id, "direction": direction])
        }
      }
    }

    OnDestroy {
      ViewModifierRegistry.unregister("fadingEdges")
      ViewModifierRegistry.unregister("horizontalSwipe")
    }
  }
}
