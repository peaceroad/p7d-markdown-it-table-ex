const checkedTdReg = /^\*\*[\s\S]*?\*\*$/;

const createTokenTemplate = (tokenType, tag, nesting, level) => ({
  type: tokenType,
  tag: tag,
  attrs: null,
  map: null,
  nesting: nesting,
  level: level,
  children: null,
  content: '',
  markup: '**',
  info: '',
  meta: null,
  block: false,
  hidden: false
});

// Helper function to remove strong tags that wrap the entire content
const removeStrongWrappers = (inline) => {
  if (!Array.isArray(inline.children) || inline.children.length === 0) {
    return;
  }
  
  const children = inline.children;
  const content = inline.content;
  
  // Quick check to avoid regex if obviously not matching
  if (!content.startsWith('**') || !content.endsWith('**')) {
    return;
  }
  
  // Check if the content matches the pattern **...** where entire content is wrapped
  if (!checkedTdReg.test(content)) {
    return;
  }
  
  // Find all strong open/close positions in one pass
  const strongPositions = [];
  for (let i = 0; i < children.length; i++) {
    const type = children[i].type;
    if (type === 'strong_open') {
      strongPositions.push({ type: 'open', index: i });
    } else if (type === 'strong_close') {
      strongPositions.push({ type: 'close', index: i });
    }
  }
  
  const openCount = strongPositions.filter(p => p.type === 'open').length;
  const closeCount = strongPositions.filter(p => p.type === 'close').length;
  
  if (openCount !== closeCount || openCount === 0) {
    return;
  }
  
  if (openCount >= 2) {
    // Multiple strong pairs case - find pairs by stack matching
    const pairs = [];
    const stack = [];
    
    for (const pos of strongPositions) {
      if (pos.type === 'open') {
        stack.push(pos.index);
      } else if (stack.length > 0) {
        const openIdx = stack.pop();
        pairs.push({ open: openIdx, close: pos.index });
      }
    }
    
    if (pairs.length >= 2) {
      const firstPair = pairs[0];
      const lastPair = pairs[pairs.length - 1];
      
      const newChildren = [];
      const contentParts = [];
      
      // Helper function to add children and build content
      const addChildrenRange = (start, end) => {
        for (let i = start; i < end; i++) {
          newChildren.push(children[i]);
          if (children[i].type === 'text') {
            contentParts.push(children[i].content);
          } else if (children[i].type === 'em_open' || children[i].type === 'em_close') {
            contentParts.push('*');
          }
        }
      };
      
      // Add content before first pair
      addChildrenRange(0, firstPair.open);
      
      // Add content from first pair (without the strong tags)
      addChildrenRange(firstPair.open + 1, firstPair.close);
      
      // Add content between first and last pairs with strong wrapping
      for (let i = firstPair.close + 1; i < lastPair.open; i++) {
        if (children[i].type === 'text' && children[i].content.trim() !== '') {
          // Create strong tokens more efficiently
          const strongOpen = Object.create(children[i].constructor.prototype);
          Object.assign(strongOpen, createTokenTemplate('strong_open', 'strong', 1, children[i].level));
          
          const strongClose = Object.create(children[i].constructor.prototype);
          Object.assign(strongClose, createTokenTemplate('strong_close', 'strong', -1, children[i].level));
          
          newChildren.push(strongOpen, children[i], strongClose);
          contentParts.push('**', children[i].content, '**');
        } else {
          newChildren.push(children[i]);
          if (children[i].type === 'text') {
            contentParts.push(children[i].content);
          } else if (children[i].type === 'em_open' || children[i].type === 'em_close') {
            contentParts.push('*');
          }
        }
      }
      
      // Add content from last pair (without the strong tags)
      addChildrenRange(lastPair.open + 1, lastPair.close);
      
      // Add content after last pair
      addChildrenRange(lastPair.close + 1, children.length);
      
      inline.content = contentParts.join('');
      inline.children = newChildren;
    }
    
  } else if (openCount === 1) {
    // Single strong pair: remove completely
    const strongOpen = strongPositions.find(p => p.type === 'open').index;
    const strongClose = strongPositions.find(p => p.type === 'close').index;
    
    const newChildren = [];
    const contentParts = [];
    
    for (let i = 0; i < children.length; i++) {
      if (i === strongOpen || i === strongClose) {
        continue; // Skip strong tags
      }
      newChildren.push(children[i]);
      if (children[i].type === 'text') {
        contentParts.push(children[i].content);
      } else if (children[i].type === 'em_open' || children[i].type === 'em_close') {
        contentParts.push('*');
      }
    }
    
    inline.content = contentParts.join('');
    inline.children = newChildren;
  }
}

const addTheadThScope = (state, theadVar) => {
  let isEmpty = false;
  let firstThPos = theadVar.pos;
  let j = theadVar.i + 2;
  //if (state.tokens[theadVar.i + 1].type !== 'tr_open') return threadVar
  while (j < state.tokens.length) {
    if (state.tokens[j].type === 'th_open') {
      state.tokens[j].attrPush(['scope', 'col']);
      if (j === theadVar.i + 2) {
        isEmpty =  state.tokens[j+1].content === ''
        let isStrong = checkedTdReg.test(state.tokens[j+1].content)
        if (isStrong) {
          firstThPos = j
          // Only remove strong tags from the first th content for matrix processing
          // The actual removal will be done in changeTdToTh if matrix conditions are met
        } else if (isEmpty) {
          firstThPos = j
        }
      }
    }
    if (state.tokens[j].type === 'tr_close') break
    j++
  }
  return {i: j, firstThPos: firstThPos, isEmpty: isEmpty}
}

const changeTdToTh = (state, tdPoses, hasThead) => {
  //console.log('hasThead: ' + hasThead +  ', tdPoses: ' + tdPoses)
  let j = 0
  while(j < tdPoses.length) {
    //console.log('state.tokens[' +  j + '].type: ' + state.tokens[tdPoses[j]].type)
    const pos = tdPoses[j]
    if (j > 0 || (!hasThead && j === 0)) {
      state.tokens[pos].type = 'th_open';
      state.tokens[pos].tag = 'th';
      state.tokens[pos].attrPush(['scope', 'row']);
      state.tokens[pos + 2].type = 'th_close';
      state.tokens[pos + 2].tag = 'th';
    }

    // Remove strong tags that wrap the entire content
    const inline = state.tokens[pos + 1];
    removeStrongWrappers(inline);
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
  return { i: j, isAllFirstTh: isAllFirstTh, tbodyFirstThPoses: tbodyFirstThPoses}
}

const setColgroup = (state, tableOpenIdx, opt) => {
  const tokens = state.tokens;
  const Token = state.Token;
  
  // Find thead and tr positions in one pass
  let theadOpen = -1, tr1 = -1, tr2 = -1, theadClose = -1;
  for (let i = tableOpenIdx; i < tokens.length; i++) {
    const tokenType = tokens[i].type;
    if (tokenType === 'thead_open' && theadOpen === -1) {
      theadOpen = i;
    } else if (theadOpen >= 0 && tokenType === 'tr_open') {
      if (tr1 === -1) {
        tr1 = i;
      } else if (tr2 === -1) {
        tr2 = i;
        break;
      }
    } else if (theadOpen >= 0 && tokenType === 'thead_close') {
      theadClose = i;
      break;
    }
  }
  
  // If there is only one <tr>, auto-generate a two-row header
  if (tr1 >= 0 && tr2 < 0 && theadClose > tr1) {
    // Calculate group names and colspan for the first row of th
    const groupData = {
      spans: [],
      names: [],
      rawNames: [],
      headerCount: 0
    };
    
    let thIdx = tr1 + 1;
    const thTokens = [];
    
    while (thIdx < tokens.length && tokens[thIdx].type !== 'tr_close') {
      if (tokens[thIdx].type === 'th_open') {
        thTokens.push(thIdx);
        const inline = tokens[thIdx + 1];
        const content = inline.content;
        const colgroupMatchReg = opt.colgroupWithNoAsterisk
          ? /^([^:：]+)(?::|：)\s*/
          : /^\*\*([^*:：]+)[:：]\*\*\s*/;
        const match = content.match(colgroupMatchReg);

        if (match) {
          const group = match[1].trim();
          const lastGroup = groupData.rawNames[groupData.rawNames.length - 1];
          
          if (groupData.rawNames.length > 0 && lastGroup === group) {
            groupData.spans[groupData.spans.length - 1]++;
          } else {
            groupData.rawNames.push(group);
            groupData.spans.push(1);
          }
          groupData.headerCount++;
        } else {
          groupData.rawNames.push(null);
          groupData.spans.push(1);
        }
      }
      thIdx++;
    }
    
    // If there are not two or more grouped header cells, do not auto-generate
    if (groupData.headerCount < 2) return;
    
    // Determine group names
    const nonNullGroups = groupData.rawNames.filter(name => name !== null);
    const allSame = nonNullGroups.length > 0 && nonNullGroups.every(name => name === nonNullGroups[0]);
    
    if (allSame) {
      groupData.names = [...groupData.rawNames];
    } else {
      groupData.names = [...groupData.rawNames];
    }
    
    // Generate colgroup if needed
    const hasSpan = groupData.spans.some(span => span > 1);
    if (hasSpan) {
      const insertTokens = [
        new Token('colgroup_open', 'colgroup', 1),
        Object.assign(new Token('text', '', 0), { content: '\n' })
      ];
      
      for (let i = 0; i < groupData.spans.length; i++) {
        const colOpen = new Token('col_open', 'col', 1);
        if (groupData.spans[i] > 1) {
          colOpen.attrPush(['span', groupData.spans[i]]);
        }
        insertTokens.push(
          colOpen,
          Object.assign(new Token('text', '', 0), { content: '\n' })
        );
      }
      
      insertTokens.push(
        new Token('colgroup_close', 'colgroup', -1),
        Object.assign(new Token('text', '', 0), { content: '\n' })
      );
      
      tokens.splice(tableOpenIdx + 1, 0, ...insertTokens);
      
      // Update indices
      const offset = insertTokens.length;
      theadOpen += offset;
      tr1 += offset;
      theadClose += offset;
    }
    
    // Generate two-row header
    const trCloseIdx = tokens.findIndex((t, idx) => idx > tr1 && t.type === 'tr_close');
    
    // Create new rows more efficiently
    const newTr1 = [
      Object.assign(new Token('text', '', 0), { content: '\n' }),
      new Token('tr_open', 'tr', 1),
      Object.assign(new Token('text', '', 0), { content: '\n' })
    ];
    
    const newTr2 = [
      new Token('tr_open', 'tr', 1),
      Object.assign(new Token('text', '', 0), { content: '\n' })
    ];
    
    // Enumerate th_open/inline between tr1 and trCloseIdx
    const origThs = [];
    for (let i = tr1 + 1; i < trCloseIdx; i++) {
      if (tokens[i].type === 'th_open') {
        origThs.push({
          th_open: tokens[i],
          inline: tokens[i + 1]
        });
      }
    }
    
    let thPtr = 0;
    for (let i = 0; i < groupData.spans.length; i++) {
      if (groupData.names[i] === null) {
        // Leftmost cell: rowspan=2
        const thOpen = new Token('th_open', 'th', 1);
        thOpen.attrSet('rowspan', '2');
        thOpen.attrSet('scope', 'col');
        
        const thInline = new Token('inline', '', 0);
        const origInline = origThs[thPtr]?.inline;
        
        if (origInline) {
          // Create a copy for processing
          const tempInline = {
            content: origInline.content,
            children: origInline.children ? [...origInline.children] : []
          };
          removeStrongWrappers(tempInline);
          thInline.content = tempInline.content;
          thInline.children = tempInline.children;
        } else {
          thInline.content = '';
          thInline.children = [];
        }
        
        newTr1.push(
          thOpen,
          thInline,
          new Token('th_close', 'th', -1),
          Object.assign(new Token('text', '', 0), { content: '\n' })
        );
        thPtr++;
      } else {
        // Group cell
        const thOpen = new Token('th_open', 'th', 1);
        if (groupData.spans[i] > 1) {
          thOpen.attrSet('colspan', groupData.spans[i].toString());
        }
        thOpen.attrSet('scope', 'col');
        
        const thInline = new Token('inline', '', 0);
        thInline.content = groupData.names[i];
        thInline.children = [{ type: 'text', content: groupData.names[i], level: 0 }];
        
        newTr1.push(
          thOpen,
          thInline,
          new Token('th_close', 'th', -1),
          Object.assign(new Token('text', '', 0), { content: '\n' })
        );
        
        // Second row: each item in the group
        for (let j = 0; j < groupData.spans[i]; j++) {
          const th2Open = new Token('th_open', 'th', 1);
          th2Open.attrSet('scope', 'col');
          
          const th2Inline = new Token('inline', '', 0);
          const orig = origThs[thPtr]?.inline?.content || '';
          const origColgroupMatchReg = opt.colgroupWithNoAsterisk
            ? /^[^:：]+(?::|：)\s*(.*)$/
            : /^\*\*[^*:：]+[:：]\*\*\s*(.*)$/;
          const match = orig.match(origColgroupMatchReg);
          th2Inline.content = match ? match[1] : orig;
          th2Inline.children = [{ type: 'text', content: th2Inline.content, level: 0 }];
          
          newTr2.push(
            th2Open,
            th2Inline,
            new Token('th_close', 'th', -1),
            Object.assign(new Token('text', '', 0), { content: '\n' })
          );
          thPtr++;
        }
      }
    }
    
    newTr1.push(
      new Token('tr_close', 'tr', -1),
      Object.assign(new Token('text', '', 0), { content: '\n' })
    );
    
    newTr2.push(
      new Token('tr_close', 'tr', -1),
      Object.assign(new Token('text', '', 0), { content: '\n' })
    );
    
    // Clean up newlines before insertion
    while (tokens[tr1 - 1] && tokens[tr1 - 1].type === 'text' && tokens[tr1 - 1].content === '\n') {
      tokens.splice(tr1 - 1, 1);
      tr1--;
    }
    
    while (newTr1.length && newTr1[0].type === 'text' && newTr1[0].content === '\n') {
      newTr1.shift();
    }
    
    tokens.splice(tr1, trCloseIdx - tr1 + 1, ...newTr1, ...newTr2);
    
    // Handle tbody th conversion
    let tbodyOpen = -1, tbodyClose = -1;
    for (let i = theadClose + 1; i < tokens.length; i++) {
      if (tokens[i].type === 'tbody_open') {
        tbodyOpen = i;
      } else if (tbodyOpen >= 0 && tokens[i].type === 'tbody_close') {
        tbodyClose = i;
        break;
      }
    }
    
    if (tbodyOpen >= 0 && tbodyClose > tbodyOpen) {
      let j = tbodyOpen + 1;
      while (j < tbodyClose) {
        if (tokens[j].type === 'tr_open') {
          const tdIdx = j + 1;
          if (tokens[tdIdx].type === 'td_open') {
            const inline = tokens[tdIdx + 1];
            if (inline && typeof inline.content === 'string' && checkedTdReg.test(inline.content)) {
              tokens[tdIdx].type = 'th_open';
              tokens[tdIdx].tag = 'th';
              tokens[tdIdx].attrSet('scope', 'row');
              removeStrongWrappers(inline);
              if (tokens[tdIdx + 2].type === 'td_close') {
                tokens[tdIdx + 2].type = 'th_close';
                tokens[tdIdx + 2].tag = 'th';
              }
            }
          }
        }
        j++;
      }
    }
    return;
  }
  
  if (tr1 < 0 || tr2 < 0) return;
  
  // Calculate group names and colspan for multi-row case
  const groupData = {
    spans: [],
    names: [],
    rawNames: []
  };
  
  let thIdx = tr1 + 1;
  while (thIdx < tokens.length && tokens[thIdx].type !== 'tr_close') {
    if (tokens[thIdx].type === 'th_open') {
      const inline = tokens[thIdx + 1];
      const content = inline.content;
      const match = content.match(/^\*\*([^*:]+):\*\*/);
      
      if (match) {
        const group = match[1].trim();
        const lastGroup = groupData.rawNames[groupData.rawNames.length - 1];
        
        if (groupData.rawNames.length > 0 && lastGroup === group) {
          groupData.spans[groupData.spans.length - 1]++;
        } else {
          groupData.rawNames.push(group);
          groupData.spans.push(1);
        }
      } else {
        groupData.rawNames.push(null);
        groupData.spans.push(1);
      }
    }
    thIdx++;
  }
  
  groupData.names = [...groupData.rawNames];
  
  // Generate colgroup if needed
  const hasSpan = groupData.spans.some(span => span > 1);
  if (hasSpan) {
    const insertTokens = [new Token('colgroup_open', 'colgroup', 1)];
    
    for (let i = 0; i < groupData.spans.length; i++) {
      const colOpen = new Token('col_open', 'col', 1);
      if (groupData.spans[i] > 1) {
        colOpen.attrPush(['span', groupData.spans[i]]);
      }
      insertTokens.push(colOpen, new Token('col_close', 'col', -1));
    }
    
    insertTokens.push(new Token('colgroup_close', 'colgroup', -1));
    tokens.splice(tableOpenIdx + 1, 0, ...insertTokens);
  }
  
  // Add colspan/rowspan to thead
  let th1 = tr1 + 1, th2 = tr2 + 1, groupIdx = 0;
  while (th1 < tokens.length && tokens[th1].type !== 'tr_close') {
    if (tokens[th1].type === 'th_open') {
      if (groupData.names[groupIdx] === null) {
        // Leftmost cell: rowspan=2
        tokens[th1].attrSet('rowspan', '2');
        tokens[th1].attrSet('scope', 'col');
        removeStrongWrappers(tokens[th1 + 1]);
        
        // Find corresponding th in second row
        let t2 = th2;
        while (t2 < tokens.length && tokens[t2].type !== 'tr_close') {
          if (tokens[t2].type === 'th_open') {
            tokens[t2].attrSet('scope', 'col');
            th2 = t2 + 1;
            break;
          }
          t2++;
        }
        groupIdx++;
      } else {
        // Group cell
        if (groupData.spans[groupIdx] > 1) {
          tokens[th1].attrSet('colspan', groupData.spans[groupIdx].toString());
        }
        tokens[th1].attrSet('scope', 'col');
        tokens[th1 + 1].content = groupData.names[groupIdx];
        
        // Process corresponding ths in second row
        let count = 0, t2 = th2;
        while (t2 < tokens.length && tokens[t2].type !== 'tr_close' && count < groupData.spans[groupIdx]) {
          if (tokens[t2].type === 'th_open') {
            tokens[t2].attrSet('scope', 'col');
            // Remove group name part from content
            const t2content = tokens[t2 + 1].content;
            const t2match = t2content.match(/^\*\*[^*:]+:\*\*\s*(.*)$/);
            if (t2match) {
              tokens[t2 + 1].content = t2match[1];
            }
            count++;
          }
          t2++;
        }
        th2 = t2;
        groupIdx++;
      }
    }
    th1++;
  }
};

const tableEx = (state, opt) => {
  const tokens = state.tokens;
  const tokenLength = tokens.length;
  
  let idx = 0;
  while (idx < tokenLength) {
    if (tokens[idx].type !== 'table_open') { 
      idx++; 
      continue; 
    }
    
    const tableOpenIdx = idx;
    
    if (opt.wrapper) {
      const wrapperStartToken = new state.Token('div_open', 'div', 1);
      wrapperStartToken.attrPush(['class', 'table-wrapper']);
      const linebreakToken = new state.Token('text', '', 0);
      linebreakToken.content = '\n';
      tokens.splice(idx, 0, wrapperStartToken, linebreakToken);
      idx += 2;
    }
    
    let theadVar = {
      i: idx + 1,
      firstThPos: -1,
      isEmpty: false,
    };
    
    const hasThead = tokens[theadVar.i] && tokens[theadVar.i].type === 'thead_open';
    if (hasThead) {
      theadVar = addTheadThScope(state, theadVar);
      idx = theadVar.i + 1;
      if (opt.colgroup) {
        setColgroup(state, tableOpenIdx, opt);
      }
    }
    
    let tbodyVar = {
      i: idx + 1,
      isAllFirstTh: false,
      tbodyFirstThPoses: [],
    };
    
    const hasTbody = tokens[tbodyVar.i] && tokens[tbodyVar.i].type === 'tbody_open';
    if (hasTbody) {
      tbodyVar = checkTbody(state, tbodyVar);
      idx = tbodyVar.i + 1;
    }
    
    if (theadVar.firstThPos && tbodyVar.isAllFirstTh) {
      const firstTdPoses = [...tbodyVar.tbodyFirstThPoses];
      if (hasThead) {
        firstTdPoses.unshift(theadVar.firstThPos);
      }
      if (opt.matrix) {
        changeTdToTh(state, firstTdPoses, hasThead, theadVar);
      }
    }
    
    // Find table_close more efficiently
    while (idx < tokens.length) {
      if (tokens[idx].type === 'table_close') {
        if (opt.wrapper) {
          const wrapperEndToken = new state.Token('div_close', 'div', -1);
          const linebreakToken = new state.Token('text', '', 0);
          linebreakToken.content = '\n';
          tokens.splice(idx + 1, 0, wrapperEndToken, linebreakToken);
          idx += 2;
        }
        break;
      }
      idx++;
    }
    idx++;
  }
};

const mditTableEx = (md, option) => {
  let opt = {
    matrix: true,
    wrapper: false,
    colgroup: false,
    colgroupWithNoAsterisk: false
  };
  for (let key in option) {
    opt[key] = option[key]
  }
  md.core.ruler.after('replacements', 'table-ex', (state) => {
    tableEx(state, opt);
  });
}
export default mditTableEx
