import ExpoModulesCore
import ExpoUI

public class PillBarModule: Module {
  public func definition() -> ModuleDefinition {
    // Expo module names share one namespace, so the name carries the app's.
    Name("SpaceTermPillBar")

    ExpoUIView(PillBarView.self)
  }
}
