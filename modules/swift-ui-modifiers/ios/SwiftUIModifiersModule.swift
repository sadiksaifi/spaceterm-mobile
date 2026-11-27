import ExpoModulesCore
import ExpoUI
import SwiftUI

/** Fades the view's content to transparent over `left` and `right` points at its sides. */
struct FadingEdgesModifier: ViewModifier, Record {
  @Field var left: CGFloat = 0
  @Field var right: CGFloat = 0

  func body(content: Content) -> some View {
    content.mask {
      HStack(spacing: 0) {
        LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing)
          .frame(width: left)
        Color.black
        LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing)
          .frame(width: right)
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
