# Design

The direction behind every screen. What a screen shows and how it behaves lives in the mockups: https://claude.ai/artifact/DxZcSmC5WMuXB6vzbpCNMm

## Principles

- **System first.** iOS follows [Apple's HIG](https://developer.apple.com/design/human-interface-guidelines/) for iOS 26 and later. Android follows [Material 3 Expressive](https://m3.material.io/). Each platform looks and behaves as if its maker (Apple or Google) built it. A deviation is taste, and [Taste](#taste) lists each one with its reason.
- **The desktop owns the features and the terms.** A feature on the phone is a feature of SpaceTerm Desktop, and its [CONTEXT.md](https://github.com/sadiksaifi/SpaceTerm/blob/main/CONTEXT.md) defines the terms. Its layouts, states and sentences are not a reference: each platform shows a feature its own way.
- **Same features and words on both platforms.** Every feature and state on one exists on the other, in the same words. Our text names no platform or device type: "this device", not "this iPhone". Capitalization and the system's own text follow the platform.
- **Minimal.** The phone keeps what a person does away from the desk. A desktop feature stays off the phone until the owner asks for it.
- **Frequent first.** What a person does most takes the fewest taps and sits under the thumb. Tabs are used more than Panes. Adding a Machine is rare.
- **Real data only.** A screen shows what the Machine or another real source reports. It has no status or count that a source does not supply.
- **Ask before a loss.** An action that ends a running command or a Terminal Session asks first. Closing an idle Tab or Pane does not ask.
- **Every gesture has a visible twin.** Each command on a swipe or a touch and hold is also on a visible control. Reordering is the exception: the drag is its control. A row swipes from its trailing side only.

## Colors and icons

- Colors are system colors: semantic colors on iOS, Material color roles on Android. Light, dark and contrast settings follow the system.
- Icons are system icons: SF Symbols on iOS, Material Symbols on Android.
- A color or icon of our own is an exception, listed here with its reason. So far: the colors inside a terminal, which belong to the Terminal Theme.
- Destructive actions look the way the system marks them. Nothing else takes that look.

## Taste

- **The pill bar.** The floating bar at the bottom of a Workspace is ours. It keeps switching Workspaces under the thumb.
- **The stick.** Neither system has one. It replaces four arrow keys with one control and frees the row for other keys.
- **A lit modifier takes the fill of the selected Workspace in the bar,** so "selected" looks the same everywhere.
- **New Tab and New Pane are part of their grid,** not a button in a bar, so they cannot be mistaken for New Workspace in the pill bar.
