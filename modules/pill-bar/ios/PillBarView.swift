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
  var onSelect = EventDispatcher()
  var onAction = EventDispatcher()
  var onLeading = EventDispatcher()
  var onTrailing = EventDispatcher()
}

/**
 * Pills in a glass capsule, one of them highlighted, between optional round buttons. The pills
 * share the width when every name fits its share; otherwise each takes its name's width and the
 * row scrolls. A tap moves the highlight to a pill. Under a finger the highlight lifts into a
 * glass lens in the middle of the capsule, which takes the buttons' room. A drag moves the row
 * under the lens with the finger, the lens takes the width of the name under it, and the pill
 * under it is picked when the finger lifts. Touch and hold any other pill for its menu.
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

  /** Each pill's frame in the row. */
  @State private var frames: [String: CGRect] = [:]
  /** A pill a tap or a drag picked, highlighted until `selected` follows. */
  @State private var picked: String?
  /** A drag of the highlight, which the system clears when the gesture ends or is cancelled. */
  @GestureState(resetTransaction: Transaction(animation: PillBarView.motion))
  private var drag: Drag?
  @State private var width: CGFloat = 0
  @State private var past = Past()
  /** The row's scroll position, which a drag moves to keep the held highlight in the middle. */
  @State private var position = ScrollPosition(idType: String.self)

  private struct Drag: Equatable {
    /** The point of the row under the lens. */
    var middle: CGFloat
    /** The lens's width, between those of the names on either side of `middle`. */
    var width: CGFloat
    /** The pill whose middle is nearest `middle`. */
    var over: String
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
    let held = drag != nil
    HStack(spacing: 0) {
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
        PillsLayout(width: width) {
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
      // Room at both ends while held, so the row can bring any pill under the lens.
      .contentMargins(.horizontal, drag == nil ? 0 : width / 2, for: .scrollContent)
      .scrollPosition($position)
      .onGeometryChange(for: CGFloat.self, of: { $0.size.width }) { width = $0 }
      .onScrollGeometryChange(for: Past.self) { geometry in
        // Half a point of slack, so rounding never fades an edge with nothing past it.
        let offset = geometry.contentOffset.x
        let rest = geometry.contentSize.width - offset - geometry.containerSize.width
        return Past(start: offset > 0.5, end: rest > 0.5)
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
      // The row keeps the point under the lens in the middle, as the capsule widens too.
      .onChange(of: drag?.middle) { old, _ in follow(animated: old == nil) }
      .onChange(of: width) { follow(animated: false) }
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
    .padding(.horizontal, Self.inset)
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
      let middle = drag?.middle ?? frame.midX
      let width = drag?.width ?? frame.width
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
      .updating($drag) { value, drag, transaction in
        // The bar and the highlight trade glass with the same motion they trade back with.
        if drag == nil { transaction.animation = Self.motion }
        drag = lens(from: value.translation.width)
      }
      .onEnded { value in
        if let over = lens(from: value.translation.width)?.over { pick(over) }
      }
  }

  private func pick(_ key: String) {
    guard key != resting else { return }
    withAnimation(Self.motion) { picked = key }
    props.onSelect(["key": key])
  }

  /** The lens after the row moved `moved` with the finger from the resting pill, which stops
   * with the first or last pill under the lens. */
  private func lens(from moved: CGFloat) -> Drag? {
    let placed = props.pills.compactMap { pill in frames[pill.key].map { (pill.key, $0) } }
    guard let start = frames[resting], let first = placed.first, let last = placed.last else {
      return nil
    }
    let middle = min(max(start.midX - moved, first.1.midX), last.1.midX)
    // The pills whose middles are either side of `middle`, and how far it is from one to the other.
    let after = placed.firstIndex { $0.1.midX >= middle } ?? placed.count - 1
    let (key, frame) = placed[max(after - 1, 0)]
    let (nextKey, next) = placed[after]
    let along = next.midX > frame.midX ? (middle - frame.midX) / (next.midX - frame.midX) : 1
    return Drag(
      middle: middle,
      width: frame.width + (next.width - frame.width) * along,
      over: along < 0.5 ? key : nextKey
    )
  }

  /** Scrolls the row so the point under the lens sits in the middle of the capsule. The scroll
   * offset counts the held margin of half the capsule, which puts `middle` in the middle. */
  private func follow(animated: Bool) {
    guard let middle = drag?.middle else { return }
    withAnimation(animated ? Self.motion : nil) {
      position.scrollTo(x: middle)
    }
  }
}

/**
 * Pills side by side. They share `width` when each fits its share; otherwise each takes its own
 * width, and one wider than `width` is cut to it so it never sits out of view.
 */
private struct PillsLayout: Layout {
  var width: CGFloat

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
    let natural = subviews.map { min($0.sizeThatFits(.unspecified).width, width) }
    return natural.allSatisfy { $0 <= share } ? natural.map { _ in share } : natural
  }
}
