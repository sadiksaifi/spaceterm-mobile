import ExpoModulesCore

public class NavigationSubtitleModule: Module {
  public func definition() -> ModuleDefinition {
    // Expo module names share one namespace, so the name carries the app's.
    Name("SpaceTermNavigationSubtitle")

    View(NavigationSubtitleView.self) {
      Prop("text") { (view: NavigationSubtitleView, text: String?) in
        view.text = text
      }
    }
  }
}
