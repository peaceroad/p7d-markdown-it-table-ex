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

- `getStrongWrapperMode()` and `isStrongWrappedInline()` confirm that parsed
  inline tokens support the raw `**...**` marker boundary. When no strong
  tokens exist and strongJa is absent, the raw string fallback remains for
  standard markdown-it compatibility.
- `removeStrongWrappers()` removes an exact outer strong token pair by reusing
  the already parsed children and adjusting their levels. It reparses only
  compatibility shapes, such as tokenless standard-markdown-it CJK boundaries
  or raw boundary markers parsed as multiple sibling strong ranges.

## Matrix behavior

- `addTheadThScope()` sets `scope="col"` in the header and tracks the
  first header cell if it is empty or strong-wrapped. Scope is applied to
  all `th` cells in `thead`, including multi-row headers.
- `checkTbody()` checks whether every body row starts with a strong-wrapped
  cell. If so, `changeTdToTh()` converts those to `th` with `scope="row"`,
  and removes strong wrappers from the inline content.
- Matrix conversion runs only when `matrix` is enabled, even if `colgroup`
  rewrites the header structure.

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

## Synthetic token metadata

- Inserted wrapper and colgroup/header tokens receive level/map metadata
  comparable to `markdown-it-multimd-table`'s table tokens:
  - `div.table-wrapper` inherits the table level and opening map.
  - Generated `<colgroup>` tokens use the table-child level and the
    nearest header-row map.
  - Generated two-row header `tr`/`th`/`inline` tokens use the existing
    `thead`/row/cell level pattern and inherit source header maps.
- Existing table subtree levels are not rewritten when adding the wrapper;
  this avoids broad token churn and keeps HTML output compatibility.

## Options and registration

- Public options are `matrix`, `wrapper`, `colgroup`, and
  `colgroupWithNoAsterisk`.
- The plugin is registered at most once per `markdown-it` instance. Reusing
  the same instance with different table-ex options is intentionally rejected;
  create a separate `markdown-it` instance for another option set.

## Tests

- `test/test.js` runs multiple fixtures with different plugin options.
- `test/examples_strongja.txt` is rendered with strongJa enabled to
  validate token-based detection in more complex inline content.
- `test/examples_colgroup.txt` includes multi-row header fixtures
  (half-width/full-width colon) to validate existing-`thead` colgroup
  transformations.
- `test/examples_colgroup_with_no_asterisk.txt` includes
  `colgroupWithNoAsterisk` edge cases, including `foods:hh1` (no space,
  no group) and multi-row full-width-colon grouping.
- `test/examples_wrapper_colgroup.txt` validates `wrapper + colgroup`
  interaction so `<colgroup>` is inserted inside `<table>`.
- `test/examples_matrix_off.txt` and
  `test/examples_matrix_off_colgroup.txt` validate that `matrix: false`
  keeps body first-column `**...**` as `td` (no row-header conversion),
  including when `colgroup` is enabled.
- `test/examples_matrix_off_wrapper_colgroup.txt` extends the same
  guarantee to `matrix: false + wrapper + colgroup`.
- Direct assertions in `test/test.js` cover duplicate registration,
  malformed strong-marker fallback, the no-reparse fast path, wide existing
  two-row headers, preserved inline syntax after group-prefix stripping, and
  representative synthetic token `level`/`map` metadata. They also exercise
  all 16 boolean combinations of the four public options.
- `npm run benchmark` runs deterministic median-based render benchmarks for a
  tall matrix table, many wrapped tables, and mixed wrapper/colgroup/matrix use.
