import mditMultimdTable from 'markdown-it-multimd-table'

const addTheadThScope = (state, i, theadFirstThPos) => {
  let theadTr = state.tokens[i + 1]
  let j = i + 2
  if (theadTr.type === 'tr_open') {
    while (j < state.tokens.length) {
      if (state.tokens[j].type === 'th_open') {
        state.tokens[j].attrPush(['scope', 'col']);
        if (j == i + 2) {
          if (/^\*\*[\s\S]*?\*\*$/.test(state.tokens[j+1].content || state.tokens[j+1].content === '')) {
            theadFirstThPos = j + 1
          }
        }
      }
      if (state.tokens[j].type === 'tr_close') break;
      j++
    }
  }
  return j, theadFirstThPos
}

const checkTbody = (state, i) => {
  let isAllLeftTh = true
  let tbodyFirstThPos = []
  while (i < state.tokens.length) {
    if (state.tokens[i].type === 'tr_open') {
      i++
      if (state.tokens[i].type === 'td_open' && state.tokens[i + 1].content.match(/^\*\*[\s\S]*?\*\*$/)) {
        console.log (state.tokens[i])
        tbodyFirstThPos.push(i)
      } else {
        isAllLeftTh = false
        break
      }
    }
    if (state.tokens[i].type === 'tbody_close') break
    i++
  }
  if (!isAllLeftTh) return i
  console.log('tbodyFirstThPos: ' + tbodyFirstThPos)
  tbodyFirstThPos.forEach(pos => {
    state.tokens[pos].type = 'th_open';
    state.tokens[pos].tag = 'th';
    state.tokens[pos].attrPush(['scope', 'row']);
    
  //  state.tokens[pos + 1].type = 'th_close';
//    state.tokens[pos + 1].tag = 'th';
  })
  return i
}

const tableThExtend = (state) => {
  let idx = 0
  while (idx < state.tokens.length) {
    if (state.tokens[idx].type !== 'table_open') { idx++; continue; }
    let theadFirstThPos = -1
    let i = idx + 1
    const hasThead = state.tokens[i].type === 'thead_open'
    if (hasThead) {
      i, theadFirstThPos = addTheadThScope(state, i, theadFirstThPos)
      //console.log('theadFirstThPos:' + theadFirstThPos)
      i = i + 2
    }
    //console.log(state.tokens[i].type)
    const hasTbody = state.tokens[i].type === 'tbody_open'
    if (hasTbody || theadFirstThPos !== -1) {
      i = checkTbody(state, i + 1)
    }
    while ( i  < state.tokens.length) {
      if (state.tokens[idx].type === 'table_close') break
      i++
    }
    idx = i + 1
  }
}

const mditExtentedTable = (md, option) => {
  let opt = {
    wrapper: false,
  }
  for (let key in option) {
    opt[key] = option[key]
  }
  md.use(mditMultimdTable, {
    multiline: false,
    rowspan: true,
  })
  md.core.ruler.after('linkify', 'table-th-extend', (state) => {
    tableThExtend(state)
  })
}
export default mditExtentedTable


