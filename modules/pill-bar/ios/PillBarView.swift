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

final class PillBarProps: UIBaseViewProps {
  @Field var pills: [Pill] = []
  @Field var selected: String = ""
  var onSelect = EventDispatcher()
  var onAction = EventDispatcher()
}

/**
 * Pills in a glass capsule, one of them highlighted. The pills share the width when every name
 * fits its share; otherwise each takes its name's width and the row scrolls. A tap moves the
 * highlight to a pill. Under a finger the highlight lifts into glass. A drag moves it along the
 * row, which scrolls to keep it in the middle, and it lands on the pill under it when the finger
 * lifts. Touch and hold opens a pill's menu.
 */
struct PillBarView: ExpoSwiftUI.View {
  @ObservedObject var props: PillBarProps

  /** The highlight sits this far inside the capsule. */
  private static let inset: CGFloat = 6
  /** An edge with pills past it fades over this width. */
  private static let fade: CGFloat = 14
  /** Room the row keeps for scrolling beside a highlight that would otherwise take every swipe. */
  private static let scrollRoom: CGFloat = 44
  /** How much the highlight grows under a finger, which fills the bar's height. */
  private static let lift: CGFloat = 1.25
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
    /** Where the finger holds the highlight's middle, in the row. */
    var middle: CGFloat
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

  /** A drag moves the highlight unless the highlight fills the row, which then could not scroll. */
  private var slides: Bool {
    guard let frame = frames[resting] else { return false }
    return frame.width <= width - Self.scrollRoom
  }

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView(.horizontal) {
        PillsLayout(width: width) {
          ForEach(props.pills, id: \.key) { pill in
            pillView(pill)
          }
        }
        .background(alignment: .topLeading) {
          // The names stay on top of the held glass, since a wide lens over them blurs them.
          ZStack(alignment: .topLeading) {
            highlight(held: false)
            highlight(held: true)
          }
        }
        .coordinateSpace(.named(Self.row))
        // The inset sits inside the scroll view, so the lifted highlight grows into it unclipped.
        .padding(.vertical, Self.inset)
      }
      .scrollIndicators(.hidden)
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
      // The row scrolls under a held highlight, which stays in the middle where the row allows.
      .onChange(of: drag?.middle) { _, middle in
        guard let middle, let frame = frames[drag?.over ?? resting] else { return }
        let end = props.pills.compactMap { frames[$0.key]?.maxX }.max() ?? width
        let x = clamped(middle, width: frame.width) - width / 2
        position.scrollTo(x: min(max(x, 0), max(end - width, 0)))
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
    return Button {
      pick(pill.key)
    } label: {
      Text(pill.name)
        .font(.body)
        // The bar keeps its height, so names stop growing where they would no longer fit it.
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .lineLimit(1)
        .foregroundStyle(lit ? .primary : .secondary)
        .padding(.horizontal, 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(.capsule)
        .contentShape(.contextMenuPreview, .capsule)
    }
    .buttonStyle(.plain)
    .accessibilityAddTraits(pill.key == props.selected ? .isSelected : [])
    .id(pill.key)
    .onGeometryChange(for: CGRect.self, of: { $0.frame(in: .named(Self.row)) }) { frame in
      frames[pill.key] = frame
    }
    // The highlighted pill takes the finger, so a drag from it moves the highlight, not the row.
    .highPriorityGesture(slide, including: pill.key == resting && slides ? .all : .subviews)
    .contextMenu { menu(pill) }
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

  /** The highlight at rest, a fill, or held, a glass lens. Each fades out while the other
   * shows, so the two read as one highlight that lifts and settles. */
  @ViewBuilder
  private func highlight(held: Bool) -> some View {
    if let frame = frames[drag?.over ?? resting] {
      let middle = drag.map { clamped($0.middle, width: frame.width) } ?? frame.midX
      let shown = (drag != nil) == held
      Group {
        if held {
          Capsule().fill(.clear).glassEffect(.clear, in: .capsule)
        } else {
          Capsule().fill(Color(uiColor: .tertiarySystemFill))
        }
      }
      .frame(width: frame.width, height: frame.height)
      .scaleEffect(drag == nil ? 1 : Self.lift)
      .opacity(shown ? 1 : 0)
      .offset(x: middle - frame.width / 2, y: frame.minY)
      .allowsHitTesting(false)
      .animation(Self.motion, value: drag?.over)
      .animation(Self.motion, value: drag == nil)
      .animation(Self.motion, value: resting)
      .animation(Self.motion, value: frame)
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
        guard let start = frames[resting] else { return }
        // The bar and the highlight trade glass with the same motion they trade back with.
        if drag == nil { transaction.animation = Self.motion }
        let middle = start.midX + value.translation.width
        drag = Drag(middle: middle, over: pill(at: middle) ?? resting)
      }
      .onEnded { value in
        guard let start = frames[resting] else { return }
        if let over = pill(at: start.midX + value.translation.width) { pick(over) }
      }
  }

  private func pick(_ key: String) {
    guard key != resting else { return }
    withAnimation(Self.motion) { picked = key }
    props.onSelect(["key": key])
  }

  /** The pill under `x` in the row, or the nearest one past either end. */
  private func pill(at x: CGFloat) -> String? {
    let keys = props.pills.map(\.key).filter { frames[$0] != nil }
    if let hit = keys.first(where: { frames[$0]!.minX <= x && x < frames[$0]!.maxX }) { return hit }
    guard let first = keys.first, let last = keys.last else { return nil }
    return x < frames[first]!.minX ? first : last
  }

  /** `middle`, kept so a highlight `width` wide stays inside the row. */
  private func clamped(_ middle: CGFloat, width: CGFloat) -> CGFloat {
    let end = props.pills.compactMap { frames[$0.key]?.maxX }.max() ?? width
    return min(max(middle, width / 2), max(end - width / 2, width / 2))
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
