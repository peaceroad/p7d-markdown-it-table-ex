import assert from 'assert'
import fs from 'fs'
import path from 'path'
import mdit from 'markdown-it'
import mditFigureWithPCaption from '@peaceroad/markdown-it-figure-with-p-caption'
import mditMultimdTable from '@peaceroad/markdown-it-multimd-table'
import mditStrongJa from '@peaceroad/markdown-it-strong-ja'

import mditTableEx from '../index.js'

const md = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx)
const mdStrongJa = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, { colgroup: true }).use(mditStrongJa)
const mdWrapper = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, { wrapper: true })
const mdMatrixOff = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, { matrix: false })
const mdMatrixOffColgroup = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, {
    matrix: false,
    colgroup: true,
  })
const mdMatrixOffWrapperColgroup = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, {
    matrix: false,
    wrapper: true,
    colgroup: true,
  })
const mdWrapperWithCaption = mdit({ html: true }).use(mditFigureWithPCaption).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, { wrapper: true })
const mdWrapperColgroup = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, {
    wrapper: true,
    colgroup: true,
  })
const mdColgroup = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, { colgroup: true })

const mdColgroupWithNoAsterisk = mdit({ html: true }).use(mditMultimdTable, {
  headerless: true,
  multiline: true,
  rowspan: true,
}).use(mditTableEx, {
  colgroup: true,
  colgroupWithNoAsterisk: true,
})

let __dirname = path.dirname(new URL(import.meta.url).pathname)
const isWindows = (process.platform === 'win32')
if (isWindows) {
  __dirname = __dirname.replace(/^\/+/, '').replace(/\//g, '\\')
}

const testData = {
  noOption: __dirname + path.sep +  'examples.txt',
  matrixOff: __dirname + path.sep + 'examples_matrix_off.txt',
  matrixOffColgroup: __dirname + path.sep + 'examples_matrix_off_colgroup.txt',
  matrixOffWrapperColgroup: __dirname + path.sep + 'examples_matrix_off_wrapper_colgroup.txt',
  wrapper: __dirname + path.sep + 'examples_wrapper.txt',
  wrapperWithCaption: __dirname + path.sep + 'examples_wrapper_with_caption.txt',
  wrapperColgroup: __dirname + path.sep + 'examples_wrapper_colgroup.txt',
  colgroup: __dirname + path.sep + 'examples_colgroup.txt',
  colgroupWithNoAsterisk: __dirname + path.sep + 'examples_colgroup_with_no_asterisk.txt',
  strongJa: __dirname + path.sep + 'examples_strongja.txt',
}

const getTestData = (pat) => {
  let ms = [];
  if(!fs.existsSync(pat)) {
    console.log('No exist: ' + pat)
    return ms
  }
  const exampleCont = fs.readFileSync(pat, 'utf-8').trim();

  let ms0 = exampleCont.split(/\n*\[Markdown\]\n/);
  let n = 1;
  while(n < ms0.length) {
    let mhs = ms0[n].split(/\n+\[HTML[^\]]*?\]\n/);
    let i = 1;
    while (i < 2) {
      if (mhs[i] === undefined) {
        mhs[i] = '';
      } else {
        mhs[i] = mhs[i].replace(/$/,'\n');
      }
      i++;
    }
    ms[n] = {
      "markdown": mhs[0],
      "html": mhs[1],
    };
    n++;
  }
  return ms
}

const runTest = (process, pat, pass, testId) => {
  console.log('===========================================================')
  console.log(pat)
  let ms = getTestData(pat)
  if (ms.length === 0) return
  let n = 1;
  let end = ms.length - 1
  if(testId) {
    if (testId[0]) n = testId[0]
    if (testId[1]) {
      if (ms.length >= testId[1]) {
        end = testId[1]
      }
    }
  }
  while(n <= end) {

    if (!ms[n]
     // || n != 3
    ) {
      n++
      continue
    }

    const m = ms[n].markdown;
    const h = process.render(m)
    console.log('Test: ' + n + ' >>>');
    try {
      assert.strictEqual(h, ms[n].html);
    } catch(e) {
      pass = false
      console.log(ms[n].markdown);
      console.log('incorrect:');
      console.log('H: ' + h +'C: ' + ms[n].html);
    }
    n++;
  }
  return pass
}

const runDirectAssertions = () => {
  const mdMultimd = mdit({ html: true })
  assert.strictEqual(mdMultimd.utils.assign, undefined)
  mdMultimd.use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  })
  assert.strictEqual(
    mdMultimd.utils.assign,
    undefined,
    'the multimd-table plugin must not mutate md.utils'
  )

  assert.throws(
    () => mdit({ html: true }).use(mditTableEx).use(mditTableEx),
    /already registered/
  )

  const mdDefault = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx)

  assert.strictEqual(
    mdDefault.render(`| **h**h**0** | hh1 |
| --- | --- |
| **v**h**1** | 11 |
`),
    `<table>
<thead>
<tr>
<th scope="col">h<strong>h</strong>0</th>
<th scope="col">hh1</th>
</tr>
</thead>
<tbody>
<tr>
<th scope="row">v<strong>h</strong>1</th>
<td>11</td>
</tr>
</tbody>
</table>
`
  )

  assert.strictEqual(
    mdDefault.render(`| **a** c ** | hh1 |
| --- | --- |
| **x** c ** | 11 |
`),
    `<table>
<thead>
<tr>
<th scope="col"><strong>a</strong> c **</th>
<th scope="col">hh1</th>
</tr>
</thead>
<tbody>
<tr>
<td><strong>x</strong> c **</td>
<td>11</td>
</tr>
</tbody>
</table>
`
  )

  const mdWrapperForTokens = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, { wrapper: true })
  const wrapperTokens = mdWrapperForTokens.parse(`| h1 | h2 |
| --- | --- |
| a | b |
`, {})
  assert.strictEqual(wrapperTokens[0].type, 'div_open')
  assert.strictEqual(wrapperTokens[0].level, 0)
  assert.deepStrictEqual(wrapperTokens[0].map, [0, 3])

  const mdColgroupForTokens = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx, { colgroup: true })
  const colgroupTokens = mdColgroupForTokens.parse(`| h0 | **g:** h1 | **g:** h2 |
| --- | --- | --- |
| a | b | c |
`, {})
  const colgroupOpen = colgroupTokens.find(token => token.type === 'colgroup_open')
  const generatedTr = colgroupTokens.find(token => token.type === 'tr_open')
  const generatedTh = colgroupTokens.find(token => token.type === 'th_open')
  assert.strictEqual(colgroupOpen.level, 1)
  assert.deepStrictEqual(colgroupOpen.map, [0, 1])
  assert.strictEqual(generatedTr.level, 2)
  assert.deepStrictEqual(generatedTr.map, [0, 1])
  assert.strictEqual(generatedTh.level, 3)
  assert.deepStrictEqual(generatedTh.map, [0, 1])

  const mdFastUnwrap = mdit({ html: true }).use(mditMultimdTable, {
    headerless: true,
    multiline: true,
    rowspan: true,
  }).use(mditTableEx)
  const originalInlineParse = mdFastUnwrap.inline.parse
  let inlineParseCalls = 0
  mdFastUnwrap.inline.parse = function (...args) {
    inlineParseCalls++
    return originalInlineParse.apply(this, args)
  }
  assert.match(
    mdFastUnwrap.render(`| **h0** | h1 |
| --- | --- |
| **r0** | x |
`),
    /<th scope="row">r0<\/th>/
  )
  assert.strictEqual(
    inlineParseCalls,
    4,
    'exact strong wrappers should reuse parsed children instead of reparsing them'
  )

  assert.strictEqual(
    mdColgroupForTokens.render(`| h0 | **g:** *h1* | **g:** \`h2\` |
| --- | --- | --- |
| a | b | c |
`),
    `<table>
<colgroup>
<col>
<col span="2">
</colgroup>
<thead>
<tr>
<th rowspan="2" scope="col">h0</th>
<th colspan="2" scope="col">g</th>
</tr>
<tr>
<th scope="col"><em>h1</em></th>
<th scope="col"><code>h2</code></th>
</tr>
</thead>
<tbody>
<tr>
<td>a</td>
<td>b</td>
<td>c</td>
</tr>
</tbody>
</table>
`
  )

  const multirowInlineHtml = mdColgroupForTokens.render(`| h0 | **g:** | **g:** |
| h0 | **g:** *h1* | **g:** \`h2\` |
| --- | --- | --- |
| a | b | c |
`)
  assert.match(multirowInlineHtml, /<th scope="col"><em>h1<\/em><\/th>/)
  assert.match(multirowInlineHtml, /<th scope="col"><code>h2<\/code><\/th>/)
  assert.doesNotMatch(multirowInlineHtml, /<strong>g:<\/strong>/)

  const groupWidth = 64
  const wideFirstHeader = ['h0', ...Array(groupWidth).fill('**g:**')]
  const wideSecondHeader = ['h0', ...Array.from({ length: groupWidth }, (_, i) => `**g:** h${i}`)]
  const wideSeparator = Array(groupWidth + 1).fill('---')
  const wideBody = Array(groupWidth + 1).fill('v')
  const wideMarkdown = [
    `| ${wideFirstHeader.join(' | ')} |`,
    `| ${wideSecondHeader.join(' | ')} |`,
    `| ${wideSeparator.join(' | ')} |`,
    `| ${wideBody.join(' | ')} |`,
  ].join('\n')
  const wideTokens = mdColgroupForTokens.parse(wideMarkdown, {})
  const wideTheadOpen = wideTokens.findIndex(token => token.type === 'thead_open')
  const wideTheadClose = wideTokens.findIndex(token => token.type === 'thead_close')
  const wideTheadTokens = wideTokens.slice(wideTheadOpen, wideTheadClose + 1)
  const wideGroupCell = wideTheadTokens.find(token =>
    token.type === 'th_open' && token.attrGet('colspan') === groupWidth.toString()
  )
  assert.ok(wideGroupCell)
  assert.strictEqual(
    wideTheadTokens.filter(token => token.type === 'th_open').length,
    groupWidth + 2
  )

  for (const preset of ['default', 'commonmark', 'zero']) {
    assert.doesNotThrow(() => mdit(preset).use(mditTableEx).render('text'))
  }

  const strongJaOrderSource = `| h0 | **料理：**hh1 | **料理：**hh2 |
| --- | --- | --- |
| a | b | c |
`
  const createStrongJaOrderMd = (strongFirst) => {
    const instance = mdit({ html: true }).use(mditMultimdTable, {
      headerless: true,
      multiline: true,
      rowspan: true,
    })
    return strongFirst
      ? instance.use(mditStrongJa).use(mditTableEx, { colgroup: true })
      : instance.use(mditTableEx, { colgroup: true }).use(mditStrongJa)
  }
  assert.strictEqual(
    createStrongJaOrderMd(true).render(strongJaOrderSource),
    createStrongJaOrderMd(false).render(strongJaOrderSource)
  )

  for (const matrix of [false, true]) {
    for (const wrapper of [false, true]) {
      for (const colgroup of [false, true]) {
        for (const colgroupWithNoAsterisk of [false, true]) {
          const groupPrefix = colgroupWithNoAsterisk ? 'g:' : '**g:**'
          const optionSource = `| **h0** | ${groupPrefix} h1 | ${groupPrefix} h2 |
| --- | --- | --- |
| **r0** | a | b |
`
          const optionMd = mdit({ html: true }).use(mditMultimdTable, {
            headerless: true,
            multiline: true,
            rowspan: true,
          }).use(mditTableEx, {
            matrix,
            wrapper,
            colgroup,
            colgroupWithNoAsterisk,
          })
          const optionHtml = optionMd.render(optionSource)
          const optionLabel = JSON.stringify({
            matrix,
            wrapper,
            colgroup,
            colgroupWithNoAsterisk,
          })
          assert.strictEqual(
            optionHtml.includes('<div class="table-wrapper">'),
            wrapper,
            `wrapper flow failed: ${optionLabel}`
          )
          assert.strictEqual(
            optionHtml.includes('<colgroup>'),
            colgroup,
            `colgroup flow failed: ${optionLabel}`
          )
          assert.strictEqual(
            optionHtml.includes('<th scope="row">r0</th>'),
            matrix,
            `matrix flow failed: ${optionLabel}`
          )
          assert.strictEqual(
            optionHtml.includes('<td><strong>r0</strong></td>'),
            !matrix,
            `matrix-off flow failed: ${optionLabel}`
          )
        }
      }
    }
  }
}

let pass = true
pass = runTest(md, testData.noOption, pass)
pass = runTest(mdMatrixOff, testData.matrixOff, pass)
pass = runTest(mdMatrixOffColgroup, testData.matrixOffColgroup, pass)
pass = runTest(mdMatrixOffWrapperColgroup, testData.matrixOffWrapperColgroup, pass)
pass = runTest(mdWrapper, testData.wrapper, pass)
pass = runTest(mdWrapperWithCaption, testData.wrapperWithCaption, pass)
pass = runTest(mdWrapperColgroup, testData.wrapperColgroup, pass)
pass = runTest(mdColgroup, testData.colgroup, pass)
pass = runTest(mdColgroupWithNoAsterisk, testData.colgroupWithNoAsterisk, pass)
pass = runTest(mdStrongJa, testData.strongJa, pass)
runDirectAssertions()

if (pass) {
  console.log('Passed all test.')
} else {
  console.error('One or more fixture tests failed.')
  process.exitCode = 1
}
