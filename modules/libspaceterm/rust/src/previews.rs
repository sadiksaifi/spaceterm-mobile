//! A Pane's visible terminal text as its card draws it, read from the Machine without a channel.
use crate::record_file::hex;
use spaceterm_protocol::pane::Color;
use spaceterm_protocol::protocol::preview::{PanePreview, Screen, State};
use spaceterm_protocol::protocol::screen::{Row, Run, StyleRef, flags};

/// The last screen of a Pane, top-left first, cropped to the rows and columns the Machine sends.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct PaneScreen {
    /// The Pane, as hexadecimal.
    pub pane: String,
    /// Each row's runs. A row with no runs is blank.
    pub rows: Vec<Vec<ScreenRun>>,
}

/// Consecutive cells drawn alike. Colors are `#rrggbb`; `None` is the terminal's own.
#[derive(Debug, Clone, PartialEq, Eq, uniffi::Record)]
pub struct ScreenRun {
    pub text: String,
    pub foreground: Option<String>,
    pub background: Option<String>,
    /// Foreground and background trade places, as the cell or the whole screen asks.
    pub inverse: bool,
    pub bold: bool,
    pub faint: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikethrough: bool,
}

/// The screens among `previews`. A Pane that has not started, or whose ended screen the Machine
/// discarded, shows a blank screen. A Pane whose screen did not arrive in time, or that is gone,
/// has none, so its card keeps the last one.
pub(crate) fn screens(previews: Vec<PanePreview>) -> Vec<PaneScreen> {
    previews
        .into_iter()
        .filter_map(|preview| {
            let rows = match preview.state {
                State::Live { screen, .. } => rows(&screen?),
                State::Ended { screen, .. } => screen.as_ref().map(rows).unwrap_or_default(),
                State::NotStarted => Vec::new(),
                State::Missing => return None,
            };
            Some(PaneScreen {
                pane: hex(&preview.pane),
                rows,
            })
        })
        .collect()
}

fn rows(screen: &Screen) -> Vec<Vec<ScreenRun>> {
    let mut rows = Vec::new();
    for row in &screen.rows {
        rows.resize_with(usize::from(row.index), Vec::new);
        rows.push(runs(row, screen.reversed));
    }
    while rows.last().is_some_and(Vec::is_empty) {
        rows.pop();
    }
    rows
}

/// The row's runs, alike neighbors merged and the blank end dropped.
fn runs(row: &Row, reversed: bool) -> Vec<ScreenRun> {
    let mut runs: Vec<ScreenRun> = Vec::new();
    for run in &row.runs {
        let next = screen_run(run, reversed);
        match runs.last_mut() {
            Some(last) if alike(last, &next) => last.text.push_str(&next.text),
            _ => runs.push(next),
        }
    }
    while let Some(last) = runs.last_mut().filter(|last| draws_no_cell(last)) {
        last.text.truncate(last.text.trim_end_matches(' ').len());
        if !last.text.is_empty() {
            break;
        }
        runs.pop();
    }
    runs
}

fn screen_run(run: &Run, reversed: bool) -> ScreenRun {
    let style = match run.style {
        StyleRef::Inline(style) => Some(style),
        StyleRef::Default | StyleRef::Id(_) => None,
    };
    let has = |flag: u16| style.is_some_and(|style| style.flags & flag != 0);
    // Invisible cells keep their width.
    let text = if has(flags::INVISIBLE) {
        " ".repeat(run.width())
    } else {
        run.text.chars().map(drawable).collect()
    };
    ScreenRun {
        text,
        foreground: style.and_then(|style| rgb(style.foreground)),
        background: style.and_then(|style| rgb(style.background)),
        inverse: has(flags::INVERSE) != reversed,
        bold: has(flags::BOLD),
        faint: has(flags::FAINT),
        italic: has(flags::ITALIC),
        underline: style.is_some_and(|style| style.underline > 0),
        strikethrough: has(flags::STRIKETHROUGH),
    }
}

/// Private-use characters, such as a Nerd Font's icons, draw as a box in the device's fonts, so a
/// space stands in.
fn drawable(character: char) -> char {
    let private = matches!(
        u32::from(character),
        0xE000..=0xF8FF | 0xF0000..=0xFFFFD | 0x100000..=0x10FFFD
    );
    if private { ' ' } else { character }
}

/// The Machine resolves palette entries, so only RGB arrives.
fn rgb(color: Color) -> Option<String> {
    match color {
        Color::Rgb([red, green, blue]) => Some(format!("#{red:02x}{green:02x}{blue:02x}")),
        Color::Default | Color::Palette(_) => None,
    }
}

fn alike(a: &ScreenRun, b: &ScreenRun) -> bool {
    ScreenRun {
        text: String::new(),
        ..a.clone()
    } == ScreenRun {
        text: String::new(),
        ..b.clone()
    }
}

/// A space in this run draws nothing over the terminal's background.
fn draws_no_cell(run: &ScreenRun) -> bool {
    run.background.is_none() && !run.inverse && !run.underline && !run.strikethrough
}

#[cfg(test)]
mod tests {
    use super::*;
    use spaceterm_protocol::protocol::screen::{Cells, Style};

    fn run(text: &str, style: StyleRef) -> Run {
        Run {
            style,
            link: None,
            text: text.to_owned(),
            cells: Cells::Narrow,
        }
    }

    fn inline(change: impl FnOnce(&mut Style)) -> StyleRef {
        let mut style = Style::DEFAULT;
        change(&mut style);
        StyleRef::Inline(style)
    }

    fn plain(text: &str) -> ScreenRun {
        ScreenRun {
            text: text.to_owned(),
            foreground: None,
            background: None,
            inverse: false,
            bold: false,
            faint: false,
            italic: false,
            underline: false,
            strikethrough: false,
        }
    }

    fn screen(rows: Vec<Row>, reversed: bool) -> Screen {
        Screen {
            columns: 80,
            row_count: 24,
            cropped: false,
            foreground: [255, 255, 255],
            background: [0, 0, 0],
            reversed,
            rows,
        }
    }

    fn row(index: u16, runs: Vec<Run>) -> Row {
        Row {
            index,
            wrapped: false,
            runs,
        }
    }

    #[test]
    fn a_screen_keeps_its_rows_in_place_and_its_runs_as_drawn() {
        let green = inline(|style| style.foreground = Color::Rgb([0x7b, 0xc4, 0x7f]));
        let hidden = inline(|style| style.flags = flags::INVISIBLE);
        let rows = vec![
            row(
                0,
                vec![
                    run("❯ ", green),
                    run("pnpm", StyleRef::Default),
                    run(" test", StyleRef::Default),
                    run("   ", StyleRef::Default),
                ],
            ),
            row(2, vec![run("pw", hidden), run("!", StyleRef::Default)]),
            row(3, vec![run("    ", StyleRef::Default)]),
            row(4, vec![run("\u{e0a0} main", StyleRef::Default)]),
        ];
        let shown = screens(vec![PanePreview {
            pane: [1; 32],
            state: State::Live {
                session: [2; 32],
                screen: Some(screen(rows, false)),
            },
        }]);

        assert_eq!(
            shown,
            vec![PaneScreen {
                pane: hex(&[1; 32]),
                rows: vec![
                    vec![
                        ScreenRun {
                            foreground: Some("#7bc47f".to_owned()),
                            ..plain("❯ ")
                        },
                        plain("pnpm test"),
                    ],
                    vec![],
                    // Hidden text keeps its cells.
                    vec![plain("  !")],
                    vec![],
                    // A Nerd Font icon has no glyph on the device.
                    vec![plain("  main")],
                ],
            }]
        );
    }

    #[test]
    fn a_discarded_screen_shows_blank_and_a_late_one_keeps_the_last() {
        let preview = |pane: u8, state| PanePreview {
            pane: [pane; 32],
            state,
        };
        let shown = screens(vec![
            preview(1, State::NotStarted),
            preview(
                2,
                State::Ended {
                    session: Some([9; 32]),
                    screen: None,
                },
            ),
            preview(
                3,
                State::Live {
                    session: [9; 32],
                    screen: None,
                },
            ),
            preview(4, State::Missing),
        ]);
        let blank = |pane: u8| PaneScreen {
            pane: hex(&[pane; 32]),
            rows: Vec::new(),
        };
        assert_eq!(shown, vec![blank(1), blank(2)]);
    }

    #[test]
    fn a_reversed_screen_inverts_every_cell_but_those_that_invert_themselves() {
        let inverse = inline(|style| style.flags = flags::INVERSE);
        let rows = vec![row(0, vec![run("a", StyleRef::Default), run("b", inverse)])];
        let shown = screens(vec![PanePreview {
            pane: [1; 32],
            state: State::Ended {
                session: None,
                screen: Some(screen(rows, true)),
            },
        }]);
        let inverted = ScreenRun {
            inverse: true,
            ..plain("a")
        };
        assert_eq!(shown[0].rows, vec![vec![inverted, plain("b")]]);
    }
}
