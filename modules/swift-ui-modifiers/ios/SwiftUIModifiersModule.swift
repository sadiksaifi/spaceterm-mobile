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

/** Modifiers Expo UI leaves out. */
public class SwiftUIModifiersModule: Module {
  public func definition() -> ModuleDefinition {
    // Expo module names share one namespace, so the name carries the app's.
    Name("SpaceTermSwiftUIModifiers")

    OnCreate {
      ViewModifierRegistry.register("fadingEdges") { params, appContext, _ in
        try FadingEdgesModifier(from: params, appContext: appContext)
      }
    }

    OnDestroy {
      ViewModifierRegistry.unregister("fadingEdges")
    }
  }
}
