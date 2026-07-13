import { performance } from 'node:perf_hooks'
import mdit from 'markdown-it'
import mditMultimdTable from 'markdown-it-multimd-table'

import mditTableEx from '../index.js'

const multimdOptions = {
  headerless: true,
  multiline: true,
  rowspan: true,
}

const makeTable = (rows, grouped = false) => {
  let source = grouped
    ? '| h0 | **group:** h1 | **group:** h2 |\n'
    : '| **h0** | h1 | h2 |\n'
  source += '| --- | --- | --- |\n'
  for (let i = 0; i < rows; i++) {
    source += `| **r${i}** | ${i} | ${i + 1} |\n`
  }
  return source
}

const cases = [
  {
    name: 'matrix: one table, 2,000 body rows',
    options: { matrix: true },
    source: makeTable(2000),
  },
  {
    name: 'wrapper: 1,000 small tables',
    options: { matrix: false, wrapper: true },
    source: Array.from({ length: 1000 }, () => makeTable(1)).join('\n'),
  },
  {
    name: 'all features: 40 tables, 100 body rows',
    options: { matrix: true, wrapper: true, colgroup: true },
    source: Array.from({ length: 40 }, () => makeTable(100, true)).join('\n'),
  },
]

const median = (values) => {
  const sorted = values.slice().sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

for (const benchmarkCase of cases) {
  const md = mdit()
    .use(mditMultimdTable, multimdOptions)
    .use(mditTableEx, benchmarkCase.options)

  for (let i = 0; i < 5; i++) md.render(benchmarkCase.source)

  const samples = []
  for (let i = 0; i < 21; i++) {
    const start = performance.now()
    md.render(benchmarkCase.source)
    samples.push(performance.now() - start)
  }

  console.log(
    `${benchmarkCase.name}: ${median(samples).toFixed(2)} ms ` +
    `(min ${Math.min(...samples).toFixed(2)}, max ${Math.max(...samples).toFixed(2)})`
  )
}
