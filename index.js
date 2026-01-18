const getLeadingStrongCloseIndex = (inline) => {
  if (!inline || !Array.isArray(inline.children) || inline.children.length < 3) {
    return -1;
  }
  const children = inline.children;
  let start = 0;
  while (start < children.length &&
         children[start].type === 'text' &&
         children[start].content === '') {
    start++;
  }
  if (start >= children.length || children[start].type !== 'strong_open') {
    return -1;
  }
  let depth = 0;
  for (let i = start; i < children.length; i++) {
    const type = children[i].type;
    if (type === 'strong_open') {
      depth++;
    } else if (type === 'strong_close') {
      depth--;
      if (depth === 0) {
        return i;
      }
      if (depth < 0) {
        return -1;
      }
    }
  }
  return -1;
};

const isStrongWrappedInline = (inline, allowFallback) => {
  if (!inline || typeof inline.content !== 'string') return false;
  const content = inline.content;
  if (!content.startsWith('**') || !content.endsWith('**')) return false;
  if (allowFallback) return true;
  if (!Array.isArray(inline.children)) return false;
  return getLeadingStrongCloseIndex(inline) !== -1;
};

const hasLeadingStrongMarker = (inline, allowFallback) => {
  if (!inline || typeof inline.content !== 'string') return false;
  if (!inline.content.startsWith('**')) return false;
  if (allowFallback) return true;
  if (!Array.isArray(inline.children)) return false;
  return getLeadingStrongCloseIndex(inline) !== -1;
};

const hasInlineRule = (md, name) => {
  const rules = md && md.inline && md.inline.ruler && md.inline.ruler.__rules__;
  if (!Array.isArray(rules)) return false;
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].name === name) return true;
  }
  return false;
};

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
const removeStrongWrappers = (inline, allowFallback) => {
  if (!Array.isArray(inline.children) || inline.children.length === 0) {
    return;
  }
  
  const children = inline.children;
  if (!isStrongWrappedInline(inline, allowFallback)) {
    return;
  }

  if (children.length === 3 &&
      children[0].type === 'strong_open' &&
      children[2].type === 'strong_close' &&
      children[1].type === 'text') {
    inline.children = [children[1]];
    inline.content = children[1].content;
    return;
  }
  
  // Find strong open/close positions in one pass
  let openCount = 0;
  let closeCount = 0;
  let firstOpen = -1;
  let firstClose = -1;
  let firstPair = null;
  let lastPair = null;
  const stack = [];
  
  for (let i = 0; i < children.length; i++) {
    const type = children[i].type;
    if (type === 'strong_open') {
      if (firstOpen === -1) {
        firstOpen = i;
      }
      openCount++;
      stack.push(i);
    } else if (type === 'strong_close') {
      if (firstClose === -1) {
        firstClose = i;
      }
      closeCount++;
      if (stack.length > 0) {
        const openIdx = stack.pop();
        if (!firstPair) {
          firstPair = { open: openIdx, close: i };
        }
        lastPair = { open: openIdx, close: i };
      }
    }
  }
  
  if (openCount !== closeCount || openCount === 0) {
    return;
  }
  
  if (openCount >= 2 && firstPair && lastPair) {
    // Multiple strong pairs case - find pairs by stack matching
    const newChildren = [];
    const contentParts = [];
    
    // Helper function to add children and build content
    const addChildrenRange = (start, end) => {
      for (let i = start; i < end; i++) {
        const child = children[i];
        newChildren.push(child);
        if (child.type === 'text') {
          contentParts.push(child.content);
        } else if (child.type === 'em_open' || child.type === 'em_close') {
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
      const child = children[i];
      if (child.type === 'text' && child.content.trim() !== '') {
        // Create strong tokens more efficiently
        const strongOpen = Object.create(child.constructor.prototype);
        Object.assign(strongOpen, createTokenTemplate('strong_open', 'strong', 1, child.level));
        
        const strongClose = Object.create(child.constructor.prototype);
        Object.assign(strongClose, createTokenTemplate('strong_close', 'strong', -1, child.level));
        
        newChildren.push(strongOpen, child, strongClose);
        contentParts.push('**', child.content, '**');
      } else {
        newChildren.push(child);
        if (child.type === 'text') {
          contentParts.push(child.content);
        } else if (child.type === 'em_open' || child.type === 'em_close') {
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
  } else if (openCount === 1) {
    // Single strong pair: remove completely
    const strongOpen = firstOpen;
    const strongClose = firstClose;
    if (strongOpen < 0 || strongClose < 0) {
      return;
    }
    
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

const addTheadThScope = (state, theadVar, allowFallback) => {
  const tokens = state.tokens;
  let firstThPos = theadVar.pos;
  let j = theadVar.i + 2;
  //if (state.tokens[theadVar.i + 1].type !== 'tr_open') return threadVar
  while (j < tokens.length) {
    if (tokens[j].type === 'th_open') {
      tokens[j].attrPush(['scope', 'col']);
      if (j === theadVar.i + 2) {
        const inline = tokens[j + 1];
        const content = inline.content;
        if (content === '' || isStrongWrappedInline(inline, allowFallback)) {
          firstThPos = j
          // Only remove strong tags from the first th content for matrix processing
          // The actual removal will be done in changeTdToTh if matrix conditions are met
        }
      }
    }
    if (tokens[j].type === 'tr_close') break
    j++
  }
  return {i: j, firstThPos: firstThPos}
}

const changeTdToTh = (state, tdPoses, hasThead, allowFallback) => {
  //console.log('hasThead: ' + hasThead +  ', tdPoses: ' + tdPoses)
  const tokens = state.tokens;
  let j = 0
  while(j < tdPoses.length) {
    //console.log('state.tokens[' +  j + '].type: ' + state.tokens[tdPoses[j]].type)
    const pos = tdPoses[j]
    if (j > 0 || (!hasThead && j === 0)) {
      tokens[pos].type = 'th_open';
      tokens[pos].tag = 'th';
      tokens[pos].attrPush(['scope', 'row']);
      tokens[pos + 2].type = 'th_close';
      tokens[pos + 2].tag = 'th';
    }

    // Remove strong tags that wrap the entire content
    const inline = tokens[pos + 1];
    removeStrongWrappers(inline, allowFallback);
    j++
  }
}

const checkTbody = (state, tbodyVar, allowFallback) => {
  const tokens = state.tokens;
  let isAllFirstTh = true
  let tbodyFirstThPoses = []
  let j = tbodyVar.i + 1
  while (j < tokens.length) {
    if (tokens[j].type === 'tr_open') {
      j++
      if (tokens[j].type === 'td_open' && isStrongWrappedInline(tokens[j + 1], allowFallback)) {
        tbodyFirstThPoses.push(j)
      } else {
        isAllFirstTh = false
        break
      }
    }
    if (tokens[j].type === 'tbody_close') break
    j++
  }
  return { i: j, isAllFirstTh: isAllFirstTh, tbodyFirstThPoses: tbodyFirstThPoses}
}

const setColgroup = (state, tableOpenIdx, opt, allowFallback) => {
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
      rawNames: [],
      headerCount: 0
    };
    
    const colgroupMatchReg = opt.colgroupWithNoAsterisk
      ? /^([^:：]+)(?::|：)\s*/
      : /^\*\*([^*:：]+)[:：]\*\*\s*/;
    const origColgroupMatchReg = opt.colgroupWithNoAsterisk
      ? /^[^:：]+(?::|：)\s*(.*)$/
      : /^\*\*[^*:：]+[:：]\*\*\s*(.*)$/;
    
    let thIdx = tr1 + 1;
    const origThInfos = [];
    let trCloseIdx = -1;
    
    while (thIdx < tokens.length) {
      const tokenType = tokens[thIdx].type;
      if (tokenType === 'th_open') {
        const inline = tokens[thIdx + 1];
        let map = null;
        if (Array.isArray(tokens[thIdx].map)) {
          map = tokens[thIdx].map.slice();
        } else if (inline && Array.isArray(inline.map)) {
          map = inline.map.slice();
        }
        origThInfos.push({ inline, map });
        const content = inline.content;
        const hasLeadingStrong = hasLeadingStrongMarker(inline, allowFallback);
        let match = null;
        if (opt.colgroupWithNoAsterisk) {
          if (content.indexOf(':') !== -1 || content.indexOf('：') !== -1) {
            match = content.match(colgroupMatchReg);
          }
        } else if (hasLeadingStrong) {
          match = content.match(colgroupMatchReg);
        }

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
      } else if (tokenType === 'tr_close') {
        trCloseIdx = thIdx;
        break;
      }
      thIdx++;
    }
    
    // If there are not two or more grouped header cells, do not auto-generate
    if (groupData.headerCount < 2) return;
    
    const groupNames = groupData.rawNames;
    
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
      tr1 += offset;
      theadClose += offset;
      trCloseIdx += offset;
    }
    
    // Generate two-row header
    
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
    
    let thPtr = 0;
    for (let i = 0; i < groupData.spans.length; i++) {
      const origInfo = origThInfos[thPtr];
      const cellMap = origInfo && origInfo.map ? origInfo.map : null;
      if (groupNames[i] === null) {
        // Leftmost cell: rowspan=2
        const thOpen = new Token('th_open', 'th', 1);
        thOpen.attrSet('rowspan', '2');
        thOpen.attrSet('scope', 'col');
        if (cellMap) thOpen.map = cellMap;
        
        const thInline = new Token('inline', '', 0);
        const origInline = origInfo ? origInfo.inline : null;
        
        if (origInline) {
          removeStrongWrappers(origInline, allowFallback);
          thInline.content = origInline.content;
          thInline.children = Array.isArray(origInline.children) ? origInline.children : [];
          if (cellMap) thInline.map = cellMap;
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
        if (cellMap) thOpen.map = cellMap;
        
        const thInline = new Token('inline', '', 0);
        thInline.content = groupNames[i];
        thInline.children = [{ type: 'text', content: groupNames[i], level: 0 }];
        if (cellMap) thInline.map = cellMap;
        
        newTr1.push(
          thOpen,
          thInline,
          new Token('th_close', 'th', -1),
          Object.assign(new Token('text', '', 0), { content: '\n' })
        );
        
        // Second row: each item in the group
        for (let j = 0; j < groupData.spans[i]; j++) {
          const subInfo = origThInfos[thPtr];
          const subMap = subInfo && subInfo.map ? subInfo.map : null;
          const th2Open = new Token('th_open', 'th', 1);
          th2Open.attrSet('scope', 'col');
          if (subMap) th2Open.map = subMap;
          
          const th2Inline = new Token('inline', '', 0);
          const origInline = subInfo ? subInfo.inline : null;
          const orig = origInline?.content || '';
          let match = null;
          if (opt.colgroupWithNoAsterisk) {
            if (orig.indexOf(':') !== -1 || orig.indexOf('：') !== -1) {
              match = orig.match(origColgroupMatchReg);
            }
          } else if (hasLeadingStrongMarker(origInline, allowFallback)) {
            match = orig.match(origColgroupMatchReg);
          }
          th2Inline.content = match ? match[1] : orig;
          th2Inline.children = [{ type: 'text', content: th2Inline.content, level: 0 }];
          if (subMap) th2Inline.map = subMap;
          
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
            if (inline && typeof inline.content === 'string' &&
                isStrongWrappedInline(inline, allowFallback)) {
              tokens[tdIdx].type = 'th_open';
              tokens[tdIdx].tag = 'th';
              tokens[tdIdx].attrSet('scope', 'row');
              removeStrongWrappers(inline, allowFallback);
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
    rawNames: []
  };
  const groupMatchReg = /^\*\*([^*:]+):\*\*/;
  
  let thIdx = tr1 + 1;
  while (thIdx < tokens.length && tokens[thIdx].type !== 'tr_close') {
    if (tokens[thIdx].type === 'th_open') {
      const inline = tokens[thIdx + 1];
      const content = inline.content;
      const hasLeadingStrong = hasLeadingStrongMarker(inline, allowFallback);
      let match = null;
      if (hasLeadingStrong) {
        match = content.match(groupMatchReg);
      }
      
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
  
  const groupNames = groupData.rawNames;
  const groupStripReg = /^\*\*[^*:]+:\*\*\s*(.*)$/;
  
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
      if (groupNames[groupIdx] === null) {
        // Leftmost cell: rowspan=2
        tokens[th1].attrSet('rowspan', '2');
        tokens[th1].attrSet('scope', 'col');
        removeStrongWrappers(tokens[th1 + 1], allowFallback);
        
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
        tokens[th1 + 1].content = groupNames[groupIdx];
        
        // Process corresponding ths in second row
        let count = 0, t2 = th2;
        while (t2 < tokens.length && tokens[t2].type !== 'tr_close' && count < groupData.spans[groupIdx]) {
          if (tokens[t2].type === 'th_open') {
            tokens[t2].attrSet('scope', 'col');
            // Remove group name part from content
            const t2Inline = tokens[t2 + 1];
            const t2content = t2Inline.content;
            let t2match = null;
            if (hasLeadingStrongMarker(t2Inline, allowFallback)) {
              t2match = t2content.match(groupStripReg);
            }
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
  let tokenLength = tokens.length;
  const allowStrongFallback = !hasInlineRule(state.md, 'strong_ja');
  
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
      if (Array.isArray(tokens[idx].map)) {
        wrapperStartToken.map = tokens[idx].map.slice();
      }
      const linebreakToken = new state.Token('text', '', 0);
      linebreakToken.content = '\n';
      tokens.splice(idx, 0, wrapperStartToken, linebreakToken);
      tokenLength += 2;
      idx += 2;
    }
    
    let theadVar = {
      i: idx + 1,
      firstThPos: -1,
    };
    
    const hasThead = tokens[theadVar.i] && tokens[theadVar.i].type === 'thead_open';
    if (hasThead) {
      theadVar = addTheadThScope(state, theadVar, allowStrongFallback);
      idx = theadVar.i + 1;
      if (opt.colgroup) {
        const beforeLength = tokens.length;
        setColgroup(state, tableOpenIdx, opt, allowStrongFallback);
        tokenLength += tokens.length - beforeLength;
      }
    }
    
    if (opt.matrix) {
      let tbodyVar = {
        i: idx + 1,
        isAllFirstTh: false,
        tbodyFirstThPoses: [],
      };
      
      const hasTbody = tokens[tbodyVar.i] && tokens[tbodyVar.i].type === 'tbody_open';
      if (hasTbody) {
        tbodyVar = checkTbody(state, tbodyVar, allowStrongFallback);
        idx = tbodyVar.i + 1;
      }
      
      if (theadVar.firstThPos && tbodyVar.isAllFirstTh) {
        const firstTdPoses = [...tbodyVar.tbodyFirstThPoses];
        if (hasThead) {
          firstTdPoses.unshift(theadVar.firstThPos);
        }
        changeTdToTh(state, firstTdPoses, hasThead, allowStrongFallback);
      }
    }
    
    // Find table_close more efficiently
    while (idx < tokenLength) {
      if (tokens[idx].type === 'table_close') {
        if (opt.wrapper) {
          const wrapperEndToken = new state.Token('div_close', 'div', -1);
          const linebreakToken = new state.Token('text', '', 0);
          linebreakToken.content = '\n';
          tokens.splice(idx + 1, 0, wrapperEndToken, linebreakToken);
          tokenLength += 2;
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
