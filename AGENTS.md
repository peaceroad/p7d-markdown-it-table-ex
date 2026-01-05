# AGENTS.md

This document explains how the table-ex plugin works and where the
strongJa-aware behavior is decided.

## Entry points

- The plugin registers a core rule named `table-ex` after `replacements`.
  See `tableEx()` in `index.js`. It scans the token stream and applies:
  - `wrapper`: wraps each table in a `div.table-wrapper`.
  - `matrix`: converts the leftmost `td` cells into `th` when they are
    strong-wrapped.
  - `colgroup`: generates `<colgroup>` and a two-row header when the
    grouping notation is used in the first header row.

## strongJa detection

- The presence of `@peaceroad/markdown-it-strong-ja` is detected by
  checking `md.inline.ruler.__rules__` for the rule name `strong_ja`.
  This logic is in `hasInlineRule()`.
- `allowStrongFallback` is set to `!hasInlineRule(state.md, 'strong_ja')`.
  When strongJa is present, the plugin relies on token-based detection
  only. When it is not present, the plugin falls back to `**` string
  checks so tables still work without strongJa.
- Token checks are cheap because markdown-it already builds inline
  children; we keep the fallback for compatibility with standard
  markdown-it parsing (for example, `**料理：**hh1` does not emit strong
  tokens without strongJa).

## Strong wrapper handling

- `getLeadingStrongCloseIndex()` and `isStrongWrappedInline()` confirm
  that the inline content is wrapped by a leading `strong_open` and a
  matching `strong_close`. This avoids false positives from `**` text.
- `removeStrongWrappers()` removes a full strong wrapper when converting
  matrix headers or building colgroup headers. It handles:
  - Simple `strong_open` + `text` + `strong_close`.
  - Multiple strong pairs while preserving nested emphasis and text.

## Matrix behavior

- `addTheadThScope()` sets `scope="col"` in the header and tracks the
  first header cell if it is empty or strong-wrapped.
- `checkTbody()` checks whether every body row starts with a strong-wrapped
  cell. If so, `changeTdToTh()` converts those to `th` with `scope="row"`,
  and removes strong wrappers from the inline content.

## Colgroup behavior

- When `colgroup` is enabled:
  - If there is a single header row and at least two grouped header cells,
    the plugin generates a two-row header and a `<colgroup>` with `span`
    attributes when needed.
  - Group notation is `**group:**` (or `**group：**` with full-width colon)
    when strong markers are present. With `colgroupWithNoAsterisk`, the
    `**` is omitted and a half-width `:` must be followed by a space.
- When the header already has two rows, the plugin sets `colspan`/`rowspan`
  and strips the `**group:**` prefix from the second row.

## Tests

- `test/test.js` runs multiple fixtures with different plugin options.
- `test/examples_strongja.txt` is rendered with strongJa enabled to
  validate token-based detection in more complex inline content.
