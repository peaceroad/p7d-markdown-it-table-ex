import mditMultimdTable from 'markdown-it-multimd-table'

const addTheadThScope = (state, theadVar) => {
  let theadTr = state.tokens[theadVar.i + 1]
  let isEmpty = false
  let firstThPos = theadVar.pos
  let j = theadVar.i + 2
  if (theadTr.type === 'tr_open') {
    while (j < state.tokens.length) {
      if (state.tokens[j].type === 'th_open') {
        state.tokens[j].attrPush(['scope', 'col']);
        if (j == theadVar.i + 2) {
          isEmpty =  state.tokens[j+1].content === ''
          let isStrong = /^\*\*[\s\S]*?\*\*$/.test(state.tokens[j+1].content)
          //console.log('thead:: isStrong: ' + isStrong + ', isEmpty: ' + isEmpty)
          if (isStrong || isEmpty) firstThPos = j
        }
      }
      if (state.tokens[j].type === 'tr_close') break;
      j++
    }
  }
  return theadVar = {
    i: j,
    pos: firstThPos,
    isEmpty: isEmpty,
  }
}

const changeTdToTh = (region, state, tdPoses, theadThEmpty) => {
  tdPoses.forEach(pos => {
    if (region === 'tbody') {
      state.tokens[pos].type = 'th_open';
      state.tokens[pos].tag = 'th';
      state.tokens[pos].attrPush(['scope', 'row']);
      state.tokens[pos + 2].type = 'th_close';
      state.tokens[pos + 2].tag = 'th';
    }
    if (region === 'thead' &&  theadThEmpty) return
    //if (region === 'thead') console.log(state.tokens[pos + 1])
    // Todo: 
    let ci = 0
    while (ci < state.tokens[pos + 1].children.length) {
      if (state.tokens[pos + 1].children[ci].type === 'strong_open') {
        state.tokens[pos + 1].children.splice(ci, 1)
        break
      }
      ci++
    }
    ci = state.tokens[pos + 1].children.length - 1
    while (0 < ci) {
      if (state.tokens[pos + 1].children[ci].type === 'strong_close') {
        state.tokens[pos + 1].children.splice(ci, 1)
        break
      }
      ci--
    }
  })
}

const checkTbody = (state, tbodyVar) => {
  let isAllFirstTh = true
  let tbodyFirstThPos = []
  let i = tbodyVar.i
  while (i < state.tokens.length) {
    if (state.tokens[i].type === 'tr_open') {
      i++
      if (state.tokens[i].type === 'td_open' && state.tokens[i + 1].content.match(/^\*\*[\s\S]*?\*\*$/)) {
        tbodyFirstThPos.push(i)
      } else {
        isAllFirstTh = false
        break
      }
    }
    if (state.tokens[i].type === 'tbody_close') break
    i++
  }
  if (!isAllFirstTh) return tbodyVar = { i: i, isAllFirstTh: isAllFirstTh }
  //console.log('tbodyFirstThPos: ' + tbodyFirstThPos)
  changeTdToTh('tbody', state, tbodyFirstThPos)
  return tbodyVar = { i: i, isAllFirstTh: isAllFirstTh }
}

const tableThExtend = (state, opt) => {
  let idx = 0
  while (idx < state.tokens.length) {
    if (state.tokens[idx].type !== 'table_open') { idx++; continue; }
    if (opt.wrapper) {
      const wrapperStartToken = new state.Token('div_open', 'div', 1)
      wrapperStartToken.attrPush(['class', 'table-wrapper'])
      const linebreakToken = new state.Token('text', '', 0)
      linebreakToken.content = '\n'
      state.tokens.splice(idx, 0, wrapperStartToken, linebreakToken)
      idx = idx + 2
    }
    let theadVar = {
      i : idx + 1,
      pos: -1,
      isEmpty: false,
    }
    const hasThead = state.tokens[theadVar.i].type === 'thead_open'
    if (hasThead) {
      theadVar = addTheadThScope(state, theadVar)
      idx = theadVar.i + 2
    }
    //console.log ('theadVar: ' + JSON.stringify(theadVar))
    //console.log(idx, state.tokens[idx])
    const hasTbody = state.tokens[idx].type === 'tbody_open'

    let tbodyVar = {
      i: idx + 1,
      isAllFirstTh: false,
    }
    //console.log(tbodyVar)
    if (hasTbody || theadVar.pos !== -1) {
      tbodyVar = checkTbody(state, tbodyVar)
      idx = tbodyVar.i + 1
    }
    //console.log(tbodyVar)
    if (tbodyVar.isAllFirstTh) {
      let theadPoses = []
      theadPoses.push(theadVar.pos)
      changeTdToTh('thead', state, theadPoses, theadVar.isEmpty)
    }
    //console.log(idx, state.tokens.length)
    while ( idx  < state.tokens.length) {
      if (state.tokens[idx].type === 'table_close') {
        if (opt.wrapper) {
          const wrapperEndToken = new state.Token('div_close', 'div', -1)
          const linebreakToken = new state.Token('text', '', 0)
          linebreakToken.content = '\n'
          state.tokens.splice(idx + 1, 0, wrapperEndToken, linebreakToken)
          idx = idx + 2
        }
        break
      }
      idx++
    }
    idx++
  }
}

const mditExtentedTable = (md, option) => {
  let opt = {
    wrapper: false,
    multiline: false,
    rowspan: true,
    headerless: true,
  }
  for (let key in option) {
    opt[key] = option[key]
  }
  md.use(mditMultimdTable, {
    multiline: opt.multiline,
    rowspan: opt.rowspan,
    headerless: opt.headerless,
  })
  md.core.ruler.after('replacements', 'table-th-extend', (state) => {
    tableThExtend(state, opt)
  })
}
export default mditExtentedTable
