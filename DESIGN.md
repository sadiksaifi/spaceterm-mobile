# Design

The decisions behind every screen. Layouts, spacing and sample content live in the mockups: https://claude.ai/artifact/5uXC4LrFk7PhFsWYQbSbxA

## Principles

- **System first.** Each platform looks as if its maker built it. A deviation is taste, and [Taste](#taste) lists each one with its reason.
- **The desktop owns the features and the terms.** A feature on the phone is a feature of SpaceTerm Desktop, and its [CONTEXT.md](https://github.com/sadiksaifi/SpaceTerm/blob/main/CONTEXT.md) defines the terms. Its layouts, states and sentences are not a reference: each platform shows and words a feature its own way.
- **Same features on both platforms.** Every feature and state on one exists on the other.
- **Real data only.** A Workspace row has name, Machine, directory and branch. Status, counts and data come from the Machine.
- **Minimal.** The phone keeps what a person does away from the desk. [Not on the phone](#not-on-the-phone) lists what stays on the desktop.
- **Every gesture has a visible twin.** Each command on a swipe or a touch and hold is also on a visible control.

## Colors and icons

- Colors are system colors: semantic colors on iOS, Material color roles on Android. Light, dark and contrast settings follow the system.
- Icons are system icons: SF Symbols on iOS, Material Symbols on Android.
- A color or icon of our own is an exception, listed here with its reason. So far: the colors inside a terminal, which belong to the Terminal Theme.
- Destructive actions take the system's destructive color. Nothing else does.

## Structure

Home, then a Workspace, then a Pane.

- **Home** lists every Workspace on every Machine.
- **A Workspace opens on a grid of its Tabs.** Tabs come first because Tabs are used more than Panes. A card is a stale snapshot. A Tab with several Panes is drawn as its split.
- **A Tab with one Pane opens that Pane.** A Tab with several Panes opens the Panes sheet, and the picked Pane fills the screen.
- **Tabs and Panes share one card grid.** The dashed tile at the end creates one. The cross on a card closes it.
- **A Pane** has Back to the grid, Panes, and More. Its title is the Pane name over the Workspace name.
- **Machines live in Settings.** Adding a Machine is rare, so it has no place in a bar.
- **New Workspace has one path:** pick a Machine, then a directory on it. With one Machine, the first step is skipped.

## Bottom bar

Inside a Workspace the bar has three parts: Workspaces, which opens the Workspaces sheet; the Workspaces themselves; New Workspace.

Workspaces share the bar equally while every name fits its share. When a name would be cut, the bar scrolls and each Workspace is as wide as its name.

Inside a Pane, the key row takes the bar's place.

## Key row

- One row at the bottom of a Pane. It rides on top of the system keyboard and hides when a hardware keyboard is connected.
- Left: show or hide the keyboard. Right: the stick. Between them, by scrolling: Escape, Tab, Control, Option or Alt, Shift, `~ | / - _ \` and backtick, Home, End, Page Up, Page Down.
- **The stick sends the four arrows.** A push is one arrow, and holding repeats it. It is a ball in a circle with no arrows drawn.
- **Modifiers behave like Shift on the system keyboard.** One tap is on for the next key, a double tap locks, a tap on a lit modifier turns it off. On and locked look the same. Modifiers stack, and they apply to the row, the stick and the system keyboard.
- Labels are the platform's own: Apple's symbols for Control, Option and Shift on iOS; the key names of Google's Terminal app and Gboard's Shift icon on Android.

## Platform differences

|                                                                  | iOS                                                                                               | Android                                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Flows: Add Machine, New Workspace, New Worktree, Get More Themes | Sheet. Close on the leading edge, Back on later steps, the confirming action on the trailing edge | Full-screen page. Back arrow, the confirming button at the bottom |
| Switchers: Workspaces, Panes                                     | Bottom sheet                                                                                      | Bottom sheet                                                      |
| List rows                                                        | Inset grouped. A short value on the trailing side, a long value on a second line                  | Two lines: the name, then its value                               |
| A choice in a list                                               | Checkmark                                                                                         | Radio button                                                      |
| Alerts                                                           | System alert                                                                                      | Material dialog                                                   |
| Find                                                             | Takes the key row's place                                                                         | Takes the top bar's place                                         |
| Touch and hold                                                   | Dims the screen and shows the menu beside the lit item                                            | Shows the menu at the finger, with no dimming                     |
| Swipe on a row                                                   | Reveals buttons that stay until tapped                                                            | One action, which acts on release                                 |
| Empty and unavailable states                                     | System empty state                                                                                | Centered icon, title and text                                     |

## Alerts and menus

- **Ask when the desktop asks.** Closing an idle Tab or Pane is immediate. The alert shows when a command is running or another client controls the Pane.
- Where one button is destructive, Cancel is the default.
- A menu holds the commands the desktop offers for the same object.

## Taste

- **The pill bar.** The floating bar at the bottom of a Workspace is ours. It keeps switching Workspaces under the thumb.
- **The stick.** Neither system has one. It replaces four arrow keys with one control and frees the row for other keys.
- **A lit modifier takes the fill of the selected Workspace in the bar,** so "selected" looks the same everywhere.

## Not on the phone

- Attach and Detach. Home lists every Workspace on every Machine.
- Split Right and Split Down. The New Pane tile covers them.
- Pin to Directory, Unpin Directory, Remove Worktree.
- Stop Core, End All Sessions, Invite Device, Remove Machine.
- Settings beyond Machines, Themes, Font Size and Privacy.
- Arrow keys and function keys in the key row.

Terminal Themes belong to the device, as on the desktop. The phone does not read the themes installed on a computer.
