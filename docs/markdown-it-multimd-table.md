# `@peaceroad/markdown-it-multimd-table`

[`@peaceroad/markdown-it-multimd-table`](https://www.npmjs.com/package/@peaceroad/markdown-it-multimd-table)
is the MultiMarkdown table parser used to develop and test
`@peaceroad/markdown-it-table-ex` with markdown-it 15.

The current release is `4.2.3-p7d.1`. Both the `latest` and `p7d` npm
dist-tags point to this release.

## Why the scoped package exists

Upstream `markdown-it-multimd-table@4.2.3` reads `md.utils.assign`, which was
removed in markdown-it 15. It therefore fails while registering the plugin.
The upstream release also has a multiline-header compaction bug that can omit
`thead_close`; once that section boundary is lost, table-ex cannot reliably
distinguish the header from the body.

The scoped package provides focused fixes for both problems while the upstream
changes are under review. It also publishes complete ESM, CommonJS, and
TypeScript entry points.

## Install and use with table-ex

Applications using table-ex should install both packages:

```sh
npm install @peaceroad/markdown-it-multimd-table @peaceroad/markdown-it-table-ex
```

Register the table parser before table-ex. Table-ex expects the parser options
`headerless`, `multiline`, and `rowspan` to be enabled:

```js
import MarkdownIt from 'markdown-it'
import multimdTable from '@peaceroad/markdown-it-multimd-table'
import tableEx from '@peaceroad/markdown-it-table-ex'

const md = new MarkdownIt({ html: true })
  .use(multimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  })
  .use(tableEx)
```

The parser is a development dependency in the table-ex repository because
table-ex does not import it at runtime. Applications must install and register
the parser explicitly as shown above.

## Changes relative to upstream 4.2.3

The scoped package contains two parser fixes:

1. It uses `Object.assign` instead of the removed `md.utils.assign` helper,
   allowing registration with markdown-it 15 without patching the markdown-it
   instance.
2. It retains the compacted logical row token when processing multiline
   headers, preserving `thead_close` before `tbody_open`.

Its package-specific changes also:

- include `index.d.ts` in the published tarball;
- expose matching ESM, CommonJS, and TypeScript entry points;
- rebuild a clean `dist/` during packing; and
- verify the packed package through ESM, CommonJS, TypeScript, markdown-it 15,
  and table-ex consumer tests.

The package has no runtime dependencies.

## Verification

Release `4.2.3-p7d.1` passed:

- all 56 upstream tests with 100% coverage;
- lint, documentation, and distribution builds;
- packed-package ESM, CommonJS, and TypeScript consumer checks;
- markdown-it 15 and table-ex integration tests;
- exact tarball inventory and production dependency audit checks; and
- GitHub Actions on Node.js 22.

The published npm package was additionally installed in a clean Node.js 24
consumer and passed ESM and CommonJS rendering smoke tests. Table-ex itself
uses the registry package directly in its fixtures, option-flow assertions,
strong-ja integration tests, and deterministic benchmarks.

## Upstream relationship

The two runtime fixes are proposed upstream as separate pull requests:

- [PR #83: support markdown-it 15](https://github.com/redbug312/markdown-it-multimd-table/pull/83)
- [PR #84: preserve section boundaries in multiline headers](https://github.com/redbug312/markdown-it-multimd-table/pull/84)

Fork-only package metadata, release policy, and table-ex-specific consumer
tests are intentionally excluded from those pull requests. Do not merge the
fork package branch wholesale into upstream.

If upstream publishes both fixes in a complete package, reassess whether
table-ex should return to the upstream package or continue using the scoped
fork. Review token output and table-ex compatibility before switching; do not
replace the dependency solely because a newer upstream version exists.

## Maintenance policy

- The scoped package is released from the fork's `package-p7d` branch.
- Every registry change requires a new version because published npm versions
  are immutable.
- Keep package metadata and build-policy changes separate from parser fixes.
- Re-run packed-package consumers against the registry artifact after each
  release.
- Re-run the complete table-ex suite and benchmarks before updating the
  development dependency in this repository.

Known upstream parser and performance issues, such as multi-backtick code-span
pipe handling and repeated scanning of rejected table candidates, should be
addressed as independent changes with dedicated regression or differential
tests. They are not part of `4.2.3-p7d.1`.
