const checkedTdReg = /^\*\*(?!.*\*\*.*\*\*)[\s\S]*?\*\*$/

const addTheadThScope = (state, theadVar) => {
  let isEmpty = false
  let firstThPos = theadVar.pos
  let j = theadVar.i + 2
  //if (state.tokens[theadVar.i + 1].type !== 'tr_open') return threadVar
  while (j < state.tokens.length) {
    if (state.tokens[j].type === 'th_open') {
      state.tokens[j].attrPush(['scope', 'col']);
      if (j === theadVar.i + 2) {
        isEmpty =  state.tokens[j+1].content === ''
        let isStrong = checkedTdReg.test(state.tokens[j+1].content)
        if (isStrong || isEmpty) firstThPos = j
      }
    }
    if (state.tokens[j].type === 'tr_close') break
    j++
  }
  return {i: j, firstThPos: firstThPos, isEmpty: isEmpty}
}


const changeTdToTh = (state, tdPoses, hasThead) => {
  let j = 0
  while(j < tdPoses.length) {
    //console.log('tdPos: ' + tdPoses[j] + ', state.tokens[j].type: ' + state.tokens[tdPoses[j]].type)
    const pos = tdPoses[j]
    if (j > 0 || (!hasThead && j === 0)) {
      state.tokens[pos].type = 'th_open';
      state.tokens[pos].tag = 'th';
      state.tokens[pos].attrPush(['scope', 'row']);
      state.tokens[pos + 2].type = 'th_close';
      state.tokens[pos + 2].tag = 'th';
    }

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
    j++
  }
}

const checkTbody = (state, tbodyVar) => {
  let isAllFirstTh = true
  let tbodyFirstThPoses = []
  let j = tbodyVar.i + 1
  while (j < state.tokens.length) {
    if (state.tokens[j].type === 'tr_open') {
      j++
      if (state.tokens[j].type === 'td_open' && state.tokens[j + 1].content.match(checkedTdReg)) {
        tbodyFirstThPoses.push(j)
      } else {
        isAllFirstTh = false
        break
      }
    }
    if (state.tokens[j].type === 'tbody_close') break
    j++
  }
  return { i: j ,isAllFirstTh: isAllFirstTh, tbodyFirstThPoses: tbodyFirstThPoses}
}

const tableEx = (state, opt) => {
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
      firstThPos: -1,
      isEmpty: false,
    }
    //console.log(theadVar.i, state.tokens[theadVar.i].type)
    const hasThead = state.tokens[theadVar.i].type === 'thead_open'
    if (hasThead) {
      theadVar = addTheadThScope(state, theadVar)
      idx = theadVar.i + 1
    }
    //console.log('theadVar: ' + JSON.stringify(theadVar) + ', hasThead: ' + hasThead)
    let tbodyVar = {
      i: idx + 1,
      isAllFirstTh: false,
      tbodyFirstThPoses: [],
    }
    //console.log(tbodyVar.i, state.tokens[tbodyVar.i].type)
    const hasTbody = state.tokens[tbodyVar.i].type === 'tbody_open'
    if (hasTbody) {
      tbodyVar = checkTbody(state, tbodyVar)
      idx = tbodyVar.i + 1
    }
    //console.log('tbodyVar: ' + JSON.stringify(tbodyVar) + ', hasTbody: ' + hasTbody)
    if (theadVar.firstThPos && tbodyVar.isAllFirstTh) {
      let firstTdPoses = [...tbodyVar.tbodyFirstThPoses]
      if (hasThead) {
        firstTdPoses.splice(0, 0, theadVar.firstThPos)
      }
      if (opt.matrix) changeTdToTh(state, firstTdPoses, hasThead, theadVar)
    }
    while (idx  < state.tokens.length) {
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

const mditTableEx = (md, option) => {
  let opt = {
    matrix: true,
    wrapper: false,
  }
  for (let key in option) {
    opt[key] = option[key]
  }
  md.core.ruler.after('replacements', 'table-ex', (state) => {
    tableEx(state, opt)
  })
}
export default mditTableEx
