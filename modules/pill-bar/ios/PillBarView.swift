import ExpoModulesCore
import ExpoUI
import SwiftUI

/** An entry of a pill's menu. */
struct PillAction: Record {
  @Field var id: String = ""
  @Field var label: String = ""
  @Field var systemImage: String = ""
  @Field var destructive: Bool = false
  @Field var disabled: Bool = false
  /** A divider goes above it. */
  @Field var divided: Bool = false
}

struct Pill: Record {
  @Field var key: String = ""
  @Field var name: String = ""
  @Field var actions: [PillAction] = []
}

/** A round glass button beside the pills. */
struct BarButton: Record {
  @Field var systemImage: String = ""
  @Field var label: String = ""
}

final class PillBarProps: UIBaseViewProps {
  @Field var pills: [Pill] = []
  @Field var selected: String = ""
  @Field var leading: BarButton?
  @Field var trailing: BarButton?
  /** The bar's distance from the bottom edge and from the sides. */
  @Field var bottom: CGFloat = 0
  @Field var side: CGFloat = 0
  var onSelect = EventDispatcher()
  var onAction = EventDispatcher()
  var onLeading = EventDispatcher()
  var onTrailing = EventDispatcher()
}

/**
 * Pills in a glass capsule, one of them highlighted, between optional round buttons. The pills
 * share the width when every name fits its share; otherwise each takes its name's width and the
 * row scrolls. A long name is cut short so that, at rest, the pills beside any pill still show. A tap moves the highlight to a pill. Under a finger the highlight lifts into a
 * glass lens and the capsule takes the buttons' room. A drag moves the lens with the finger over
 * the row, and a finger near either side of the capsule scrolls the row toward that side. The lens
 * takes the width of the name under it, and the pill under it is picked and centered when the
 * finger lifts. Touch and hold any other pill for its menu.
 *
 * Children, when given, are the selected pill's content, and the bar sits over them at the
 * bottom. When the selection changes, the content comes in from the side of the newly selected
 * pill, so it follows the highlight.
 */
struct PillBarView: ExpoSwiftUI.View {
  @ObservedObject var props: PillBarProps

  /** The highlight sits this far inside the capsule. */
  private static let inset: CGFloat = 6
  /** An edge with pills past it fades over this width. */
  private static let fade: CGFloat = 14
  /** How much the highlight grows under a finger, which fills the bar's height. */
  private static let lift: CGFloat = 1.25
  /** The buttons' diameter, the capsule's height. */
  private static let height: CGFloat = 48
  /** The space between a button and the capsule. */
  private static let gap: CGFloat = 12
  private static let motion = Animation.spring(response: 0.34, dampingFraction: 0.78)
  private static let row = "pills"
  /** How much of the pills beside the widest pill shows at rest, on each side of it. */
  private static let peek: CGFloat = 44
  /** Near this distance from either side of the capsule, a held finger scrolls the row. */
  private static let edge: CGFloat = 44
  /** How fast the row scrolls with the finger at the capsule's side, in points a second. */
  private static let speed: CGFloat = 520
  /** How far new content comes in from the side. */
  private static let arrival: CGFloat = 56

  /** Each pill's frame in the row. */
  @State private var frames: [String: CGRect] = [:]
  /** A pill a tap or a drag picked, highlighted until `selected` follows. */
  @State private var picked: String?
  /** A drag of the highlight, which the system clears when the gesture ends or is cancelled. */
  @GestureState(resetTransaction: Transaction(animation: PillBarView.motion))
  private var touch: Touch?
  @State private var width: CGFloat = 0
  /** The row's width at rest, before a held capsule takes the buttons' room. */
  @State private var rest: CGFloat = 0
  /** The row's left edge on screen. */
  @State private var left: CGFloat = 0
  /** How far a held finger near a side scrolled the row. */
  @State private var scrolled: CGFloat = 0
  @State private var past = Past()
  /** The row's scroll position, which a drag moves to bring far pills within the finger's reach. */
  @State private var position = ScrollPosition(idType: String.self)
  /** The last change of selection, which brings the content in from its side. */
  @State private var arrived = Arrival()

  private struct Drag: Equatable {
    /** The point of the row under the lens. */
    var middle: CGFloat
    /** The lens's width, between those of the names on either side of `middle`. */
    var width: CGFloat
    /** The pill whose middle is nearest `middle`. */
    var over: String
    /** The row's scroll offset, which puts the lens under the finger. */
    var offset: CGFloat
    /** The point of the row at the capsule's left edge. */
    var left: CGFloat
  }

  /** Where a finger came down and where it is, on screen. */
  private struct Touch: Equatable {
    var start: CGFloat
    var now: CGFloat
  }

  /** The held lens, from the drag and the row as it is laid out now, so it stays under the finger
   * as the capsule widens. */
  private var drag: Drag? {
    touch.flatMap(lens(from:))
  }

  private struct Arrival: Equatable {
    var count = 0
    /** 1 when the newly selected pill is after the one before, -1 when it is before it. */
    var side: CGFloat = 0
  }

  private struct Past: Equatable {
    var start = false
    var end = false
  }

  /** The pill the highlight rests on, which a drag starts from. A pick of a pill that is gone
   * falls back to the selection. */
  private var resting: String {
    guard let picked, props.pills.contains(where: { $0.key == picked }) else {
      return props.selected
    }
    return picked
  }

  var body: some View {
    if let children = props.children, !children.isEmpty {
      ZStack(alignment: .bottom) {
        content(children)
        bar
      }
    } else {
      bar
    }
  }

  private func content(_ children: [any ExpoSwiftUI.AnyChild]) -> some View {
    ZStack {
      ForEach(children, id: \.childIdentity) { child in
        let view: any View = child.childView
        AnyView(view)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .keyframeAnimator(initialValue: CGFloat(0), trigger: arrived) { view, away in
      view
        .offset(x: away * arrived.side * Self.arrival)
        .opacity(1 - away * 0.6)
    } keyframes: { _ in
      MoveKeyframe(1)
      SpringKeyframe(0, duration: 0.4, spring: .init(response: 0.4, dampingRatio: 0.9))
    }
    .onChange(of: props.selected) { old, new in
      let keys = props.pills.map(\.key)
      guard let from = keys.firstIndex(of: old), let to = keys.firstIndex(of: new) else { return }
      arrived = Arrival(count: arrived.count + 1, side: to > from ? 1 : -1)
    }
  }

  private var bar: some View {
    let held = drag != nil
    return HStack(spacing: 0) {
      if let leading = props.leading {
        button(leading) { props.onLeading() }
          .frame(width: held ? 0 : Self.height + Self.gap, alignment: .leading)
          .offset(x: held ? -(Self.height + Self.gap) : 0)
          .opacity(held ? 0 : 1)
      }
      capsule
      if let trailing = props.trailing {
        button(trailing) { props.onTrailing() }
          .frame(width: held ? 0 : Self.height + Self.gap, alignment: .trailing)
          .offset(x: held ? Self.height + Self.gap : 0)
          .opacity(held ? 0 : 1)
      }
    }
    .animation(Self.motion, value: held)
    .frame(maxWidth: .infinity)
    .frame(height: Self.height)
    .padding(.horizontal, props.side)
    .padding(.bottom, props.bottom)
  }

  /** A held capsule takes the buttons' room, so they slide off to the sides. */
  private func button(_ button: BarButton, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: button.systemImage)
        .font(.system(size: 20, weight: .medium))
        .frame(width: Self.height - 16, height: Self.height - 16)
    }
    .buttonStyle(.glass)
    .buttonBorderShape(.circle)
    .accessibilityLabel(button.label)
    .frame(width: Self.height, height: Self.height)
  }

  private var capsule: some View {
    ScrollViewReader { proxy in
      ScrollView(.horizontal) {
        PillsLayout(width: width - 2 * Self.inset, widest: widest) {
          ForEach(props.pills, id: \.key) { pill in
            pillView(pill)
          }
        }
        .background(alignment: .topLeading) {
          // The names stay on top of the lens, since a wide lens over them blurs them.
          ZStack(alignment: .topLeading) {
            fill
            lens
          }
        }
        .coordinateSpace(.named(Self.row))
        // The inset sits inside the scroll view, so the lifted highlight grows into it unclipped.
        .padding(.vertical, Self.inset)
      }
      .scrollIndicators(.hidden)
      // The inset sits inside the scroll view too, so it clips at the capsule's edge and the lens
      // can grow up to it.
      .contentMargins(.horizontal, Self.inset, for: .scrollContent)
      .scrollPosition($position)
      .onGeometryChange(for: CGRect.self, of: { $0.frame(in: .global) }) { frame in
        width = frame.width
        left = frame.minX
        if touch == nil { rest = frame.width - 2 * Self.inset }
      }
      .onScrollGeometryChange(for: Past.self) { geometry in
        // Half a point of slack, so rounding never fades an edge with nothing past it.
        let visible = geometry.visibleRect
        return Past(start: visible.minX > 0.5, end: visible.maxX < geometry.contentSize.width - 0.5)
      } action: { _, now in
        past = now
      }
      .mask { edges }
      .clipShape(.capsule)
      // The selected pill stays in view when it first lays out and when other pills change
      // around it, such as a rename that makes the row scroll.
      .onChange(of: frames[props.selected]) { old, _ in
        if old == nil {
          proxy.scrollTo(props.selected, anchor: .center)
        } else {
          withAnimation(Self.motion) { proxy.scrollTo(props.selected, anchor: .center) }
        }
      }
      // The row scrolls with the lens, also as the capsule widens.
      .onChange(of: drag?.offset) { old, _ in follow(animated: old == nil) }
      .onChange(of: touch == nil) { scrolled = 0 }
      .task(id: pushing) {
        guard pushing != 0 else { return }
        while !Task.isCancelled {
          push()
          try? await Task.sleep(for: .milliseconds(16))
        }
      }
      .onChange(of: props.pills.map(\.key)) { _, keys in
        frames = frames.filter { keys.contains($0.key) }
      }
      .onChange(of: props.selected) { _, selected in
        withAnimation(Self.motion) {
          picked = nil
          proxy.scrollTo(selected, anchor: .center)
        }
      }
    }
    // Glass cannot show through glass, so while the highlight is held as a glass lens, the bar
    // under it turns flat, as Liquid Glass segmented controls do.
    .background {
      Capsule()
        .fill(Color(uiColor: .secondarySystemBackground))
        .opacity(drag == nil ? 0 : 1)
        .animation(Self.motion, value: drag == nil)
    }
    .glassEffect(drag == nil ? .regular : .identity, in: .capsule)
    .sensoryFeedback(.selection, trigger: drag?.over) { old, new in old != nil && new != nil }
  }

  private func pillView(_ pill: Pill) -> some View {
    let lit = (drag?.over ?? resting) == pill.key
    let name = Text(pill.name)
      .font(.body)
      // The bar keeps its height, so names stop growing where they would no longer fit it.
      .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
      .lineLimit(1)
      .foregroundStyle(lit ? .primary : .secondary)
      .padding(.horizontal, 16)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
      .contentShape(.capsule)
    return Group {
      if pill.key == resting {
        // Touch and hold lifts the lens, so the highlighted pill has no menu.
        Button { pick(pill.key) } label: { name }
          .buttonStyle(.plain)
          .highPriorityGesture(slide)
      } else {
        // A menu opens from the pill in place, where a context menu lifts the name off the bar.
        Menu { menu(pill) } label: { name } primaryAction: { pick(pill.key) }
          .menuStyle(.button)
          .buttonStyle(.plain)
          .menuIndicator(.hidden)
      }
    }
    .accessibilityAddTraits(pill.key == props.selected ? .isSelected : [])
    .id(pill.key)
    .onGeometryChange(for: CGRect.self, of: { $0.frame(in: .named(Self.row)) }) { frame in
      frames[pill.key] = frame
    }
  }

  @ViewBuilder
  private func menu(_ pill: Pill) -> some View {
    ForEach(pill.actions, id: \.id) { action in
      if action.divided { Divider() }
      Button(role: action.destructive ? .destructive : nil) {
        props.onAction(["key": pill.key, "action": action.id])
      } label: {
        Label(action.label, systemImage: action.systemImage)
      }
      .disabled(action.disabled)
    }
  }

  /** The highlight at rest, which gives way to the lens while held. */
  @ViewBuilder
  private var fill: some View {
    if let frame = frames[resting] {
      Capsule()
        .fill(Color(uiColor: .tertiarySystemFill))
        .frame(width: frame.width, height: frame.height)
        .offset(x: frame.minX, y: frame.minY)
        .opacity(drag == nil ? 1 : 0)
        .animation(Self.motion, value: resting)
        .animation(Self.motion, value: frame)
        .animation(Self.motion, value: drag == nil)
    }
  }

  /** The held highlight: glass in the middle of the capsule, growing out of the fill. */
  @ViewBuilder
  private var lens: some View {
    if let frame = frames[resting] {
      let width = drag?.width ?? frame.width
      // Its point of the row, kept as far inside the capsule as the grown lens needs.
      let half = width * Self.lift / 2
      let middle = drag.map { min(max($0.middle, $0.left + half), $0.left + self.width - half) }
        ?? frame.midX
      Capsule()
        .fill(.clear)
        .glassEffect(.clear, in: .capsule)
        .frame(width: width, height: frame.height)
        .scaleEffect(drag == nil ? 1 : Self.lift)
        .offset(x: middle - width / 2, y: frame.minY)
        .opacity(drag == nil ? 0 : 1)
        .allowsHitTesting(false)
        .animation(Self.motion, value: drag == nil)
    }
  }

  private var edges: some View {
    HStack(spacing: 0) {
      LinearGradient(colors: [.clear, .black], startPoint: .leading, endPoint: .trailing)
        .frame(width: past.start ? Self.fade : 0)
      Color.black
      LinearGradient(colors: [.black, .clear], startPoint: .leading, endPoint: .trailing)
        .frame(width: past.end ? Self.fade : 0)
    }
  }

  private var slide: some Gesture {
    // Global, so the row scrolling under the finger does not move it in the gesture's space.
    DragGesture(minimumDistance: 0, coordinateSpace: .global)
      .updating($touch) { value, touch, transaction in
        // The bar and the highlight trade glass with the same motion they trade back with.
        if touch == nil { transaction.animation = Self.motion }
        touch = Touch(start: value.startLocation.x, now: value.location.x)
      }
      .onEnded { value in
        let touch = Touch(start: value.startLocation.x, now: value.location.x)
        guard let over = lens(from: touch)?.over else { return }
        pick(over)
        // Centered as far as the ends allow, also when it was already picked.
        withAnimation(Self.motion) { position.scrollTo(id: over, anchor: .center) }
      }
  }

  private func pick(_ key: String) {
    guard key != resting else { return }
    withAnimation(Self.motion) { picked = key }
    props.onSelect(["key": key])
  }

  /**
   * The lens under a finger that came down on the resting pill. The lens follows the finger over
   * the row, stopping at the first and last pills, and the row stays put unless `scrolled` moved it.
   * The capsule widens under the finger, so the row keeps the resting pill where the finger came
   * down, as far as the row's ends allow.
   */
  private func lens(from touch: Touch) -> Drag? {
    let placed = props.pills.compactMap { pill in frames[pill.key].map { (pill.key, $0) } }
    guard let row = row(for: touch), let first = placed.first, let last = placed.last else {
      return nil
    }
    let offset = min(max(row.base + scrolled, 0), row.end)
    let middle = min(max(offset - Self.inset + touch.now - left, first.1.midX), last.1.midX)
    // The pills whose middles are either side of `middle`, and how far it is from one to the other.
    let after = placed.firstIndex { $0.1.midX >= middle } ?? placed.count - 1
    let (key, frame) = placed[max(after - 1, 0)]
    let (nextKey, next) = placed[after]
    let along = next.midX > frame.midX ? (middle - frame.midX) / (next.midX - frame.midX) : 1
    return Drag(
      middle: middle,
      width: frame.width + (next.width - frame.width) * along,
      over: along < 0.5 ? key : nextKey,
      offset: offset,
      left: offset - Self.inset
    )
  }

  /** The row's scroll offset that keeps the resting pill where `touch` came down, and the
   * furthest the row scrolls. The offset counts the inset at the start of the row. */
  private func row(for touch: Touch) -> (base: CGFloat, end: CGFloat)? {
    guard let start = frames[resting] else { return nil }
    let end = max((frames.values.map(\.maxX).max() ?? 0) + 2 * Self.inset - width, 0)
    return (start.midX + Self.inset - (touch.start - left), end)
  }

  /** The widest a pill grows: the row at rest less a peek of a pill on each side, so the pills
   * keep their widths while held. Never under half the row, so a narrow one still shows a name. */
  private var widest: CGFloat {
    props.pills.count > 1 ? max(rest - 2 * Self.peek, rest / 2) : .infinity
  }

  /** The side the row scrolls toward while held, -1 for the left and 1 for the right: that of a
   * finger near a side of the capsule, or of the pill under the lens while that side of it is out
   * of view. */
  private var pushing: Int {
    guard let touch, let drag, let over = frames[drag.over], width > Self.edge * 2 else { return 0 }
    let shown = touch.now - left
    if shown < Self.edge || over.minX < drag.left - 0.5 && shown < width / 2 { return -1 }
    if shown > width - Self.edge || over.maxX > drag.left + width + 0.5 && shown > width / 2 {
      return 1
    }
    return 0
  }

  /** Scrolls the row one frame toward `pushing`: faster the nearer the finger is to the side,
   * and at least at half speed while the pill under the lens is out of view. */
  private func push() {
    guard let touch, let row = row(for: touch), pushing != 0 else { return }
    let shown = touch.now - left
    let into = pushing < 0 ? Self.edge - shown : shown - (width - Self.edge)
    let step = CGFloat(pushing) * min(max(into / Self.edge, 0.5), 1) * Self.speed / 60
    // Within the row's ends, so moving back from an edge moves the row at once.
    scrolled = min(max(scrolled + step, -row.base), row.end - row.base)
  }

  /** Scrolls the row to keep the point under the lens under the finger. */
  private func follow(animated: Bool) {
    guard let offset = drag?.offset else { return }
    withAnimation(animated ? Self.motion : nil) {
      position.scrollTo(x: offset)
    }
  }
}

/**
 * Pills side by side. They share `width` when each fits its share; otherwise each takes its own
 * width, and one wider than `widest` or `width` is cut to it.
 */
private struct PillsLayout: Layout {
  var width: CGFloat
  var widest: CGFloat

  func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
    let height = proposal.height ?? subviews.map { $0.sizeThatFits(.unspecified).height }.max() ?? 0
    return CGSize(width: widths(subviews).reduce(0, +), height: height)
  }

  func placeSubviews(
    in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()
  ) {
    var x = bounds.minX
    for (subview, width) in zip(subviews, widths(subviews)) {
      subview.place(
        at: CGPoint(x: x, y: bounds.minY),
        proposal: ProposedViewSize(width: width, height: bounds.height)
      )
      x += width
    }
  }

  private func widths(_ subviews: Subviews) -> [CGFloat] {
    guard !subviews.isEmpty, width > 0 else { return subviews.map { _ in 0 } }
    let share = width / CGFloat(subviews.count)
    let natural = subviews.map { min($0.sizeThatFits(.unspecified).width, widest, width) }
    return natural.allSatisfy { $0 <= share } ? natural.map { _ in share } : natural
  }
}
