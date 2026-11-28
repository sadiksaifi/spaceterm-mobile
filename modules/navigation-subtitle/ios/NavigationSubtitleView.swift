import ExpoModulesCore
import UIKit

/**
 * Sets the navigation bar subtitle of the screen it is in, and draws nothing. React Native Screens
 * has no subtitle, so this sets the one UIKit draws under the title.
 */
final class NavigationSubtitleView: ExpoView {
  var text: String? {
    didSet { apply() }
  }

  /** The screen whose subtitle this sets, found once the view is inside it. */
  private weak var screen: UIViewController?

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil { apply() }
  }

  override func willMove(toSuperview newSuperview: UIView?) {
    super.willMove(toSuperview: newSuperview)
    // A screen pushed over this one leaves it in place; only its removal clears the subtitle.
    if newSuperview == nil {
      screen?.navigationItem.subtitle = nil
      screen = nil
    }
  }

  private func apply() {
    screen = screen ?? findScreen()
    screen?.navigationItem.subtitle = text
  }

  /** The view controller a navigation controller shows, whose navigation item the bar draws. */
  private func findScreen() -> UIViewController? {
    var responder: UIResponder? = self
    while let next = responder?.next {
      if let controller = next as? UIViewController, controller.parent is UINavigationController {
        return controller
      }
      responder = next
    }
    return nil
  }
}
