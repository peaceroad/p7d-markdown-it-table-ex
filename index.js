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

const createNewlineToken = (Token) => {
  const token = new Token('text', '', 0);
  token.content = '\n';
  return token;
};

const setInlineText = (inline, Token, text) => {
  inline.content = text;
  const textToken = new Token('text', '', 0);
  textToken.content = text;
  textToken.level = 0;
  inline.children = [textToken];
};

const removeHeaderCellAt = (tokens, openIdx) => {
  if (!tokens[openIdx] || tokens[openIdx].type !== 'th_open') return;
  let deleteCount = 3;
  const next = tokens[openIdx + 3];
  if (next && next.type === 'text' && next.content === '\n') {
    deleteCount += 1;
  }
  tokens.splice(openIdx, deleteCount);
};

const findFirstHeaderThPos = (tokens, tableOpenIdx, allowFallback) => {
  let inThead = false;
  for (let i = tableOpenIdx + 1; i < tokens.length; i++) {
    const type = tokens[i].type;
    if (type === 'table_close') break;
    if (type === 'thead_open') {
      inThead = true;
      continue;
    }
    if (!inThead) continue;
    if (type === 'thead_close') break;
    if (type !== 'th_open') continue;
    const inline = tokens[i + 1];
    if (inline && (inline.content === '' || isStrongWrappedInline(inline, allowFallback))) {
      return i;
    }
    return -1;
  }
  return -1;
};

const findFirstHeaderCellPos = (tokens, tableOpenIdx) => {
  let inThead = false;
  for (let i = tableOpenIdx + 1; i < tokens.length; i++) {
    const type = tokens[i].type;
    if (type === 'table_close') break;
    if (type === 'thead_open') {
      inThead = true;
      continue;
    }
    if (!inThead) continue;
    if (type === 'thead_close') break;
    if (type === 'th_open') return i;
  }
  return -1;
};

const createColgroupRegexes = (colgroupWithNoAsterisk) => {
  if (colgroupWithNoAsterisk) {
    return {
      singleHeaderGroup: /^([^:：]+)(?:：\s*|: +)/,
      singleHeaderStrip: /^[^:：]+(?:：\s*|: +)(.*)$/,
      multiHeaderGroup: /^([^:：]+)(?:：\s*|: +)/,
      multiHeaderStrip: /^[^:：]+(?:：\s*|: +)(.*)$/
    };
  }
  return {
    singleHeaderGroup: /^\*\*([^*:：]+)[:：]\*\*\s*/,
    singleHeaderStrip: /^\*\*[^*:：]+[:：]\*\*\s*(.*)$/,
    multiHeaderGroup: /^\*\*([^*:：]+)[:：]\*\*/,
    multiHeaderStrip: /^\*\*[^*:：]+[:：]\*\*\s*(.*)$/
  };
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
  let firstThPos = theadVar.firstThPos;
  let j = theadVar.i + 1;
  let isFirstRow = true;
  let firstRowFirstThSeen = false;
  while (j < tokens.length) {
    const tokenType = tokens[j].type;
    if (tokenType === 'th_open') {
      tokens[j].attrSet('scope', 'col');
      if (isFirstRow && !firstRowFirstThSeen) {
        firstRowFirstThSeen = true;
        const inline = tokens[j + 1];
        const content = inline && typeof inline.content === 'string' ? inline.content : '';
        if (content === '' || isStrongWrappedInline(inline, allowFallback)) {
          firstThPos = j;
        }
      }
    } else if (tokenType === 'tr_close' && isFirstRow) {
      isFirstRow = false;
    } else if (tokenType === 'thead_close') {
      break;
    }
    j++;
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

const setColgroup = (state, tableOpenIdx, opt, allowFallback, regexes) => {
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
    
    const colgroupMatchReg = regexes.singleHeaderGroup;
    const origColgroupMatchReg = regexes.singleHeaderStrip;
    
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
        createNewlineToken(Token)
      ];
      
      for (let i = 0; i < groupData.spans.length; i++) {
        const colOpen = new Token('col_open', 'col', 1);
        if (groupData.spans[i] > 1) {
          colOpen.attrPush(['span', groupData.spans[i]]);
        }
        insertTokens.push(
          colOpen,
          createNewlineToken(Token)
        );
      }
      
      insertTokens.push(
        new Token('colgroup_close', 'colgroup', -1),
        createNewlineToken(Token)
      );
      
      tokens.splice(tableOpenIdx + 1, 0, ...insertTokens);
      
      // Update indices
      const offset = insertTokens.length;
      tr1 += offset;
      trCloseIdx += offset;
    }
    
    // Generate two-row header
    
    // Create new rows more efficiently
    const newTr1 = [
      createNewlineToken(Token),
      new Token('tr_open', 'tr', 1),
      createNewlineToken(Token)
    ];
    
    const newTr2 = [
      new Token('tr_open', 'tr', 1),
      createNewlineToken(Token)
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
          setInlineText(thInline, Token, '');
        }
        
        newTr1.push(
          thOpen,
          thInline,
          new Token('th_close', 'th', -1),
          createNewlineToken(Token)
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
        setInlineText(thInline, Token, groupNames[i]);
        if (cellMap) thInline.map = cellMap;
        
        newTr1.push(
          thOpen,
          thInline,
          new Token('th_close', 'th', -1),
          createNewlineToken(Token)
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
          setInlineText(th2Inline, Token, match ? match[1] : orig);
          if (subMap) th2Inline.map = subMap;
          
          newTr2.push(
            th2Open,
            th2Inline,
            new Token('th_close', 'th', -1),
            createNewlineToken(Token)
          );
          thPtr++;
        }
      }
    }
    
    newTr1.push(
      new Token('tr_close', 'tr', -1),
      createNewlineToken(Token)
    );
    
    newTr2.push(
      new Token('tr_close', 'tr', -1),
      createNewlineToken(Token)
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
    
    return;
  }
  
  if (tr1 < 0 || tr2 < 0) return;
  
  // Calculate group names and colspan for multi-row case
  const groupData = {
    spans: [],
    rawNames: [],
    headerCount: 0
  };
  const groupMatchReg = regexes.multiHeaderGroup;
  const groupStripReg = regexes.multiHeaderStrip;
  
  const firstRowCells = [];
  let firstRowClose = -1;
  let thIdx = tr1 + 1;
  while (thIdx < tokens.length) {
    if (tokens[thIdx].type === 'th_open') {
      firstRowCells.push(thIdx);
    } else if (tokens[thIdx].type === 'tr_close') {
      firstRowClose = thIdx;
      break;
    }
    thIdx++;
  }
  if (firstRowClose < 0 || firstRowCells.length === 0) return;
  
  const secondRowCells = [];
  let secondRowClose = -1;
  thIdx = tr2 + 1;
  while (thIdx < tokens.length) {
    if (tokens[thIdx].type === 'th_open') {
      secondRowCells.push(thIdx);
    } else if (tokens[thIdx].type === 'tr_close') {
      secondRowClose = thIdx;
      break;
    }
    thIdx++;
  }
  if (secondRowClose < 0 || secondRowCells.length === 0) return;
  
  for (let i = 0; i < firstRowCells.length; i++) {
    const inline = tokens[firstRowCells[i] + 1];
    const content = inline && typeof inline.content === 'string' ? inline.content : '';
    let match = null;
    if (opt.colgroupWithNoAsterisk) {
      if (content.indexOf(':') !== -1 || content.indexOf('：') !== -1) {
        match = content.match(groupMatchReg);
      }
    } else if (hasLeadingStrongMarker(inline, allowFallback)) {
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
      groupData.headerCount++;
    } else {
      groupData.rawNames.push(null);
      groupData.spans.push(1);
    }
  }
  
  if (groupData.headerCount < 2) return;
  
  const hasSpan = groupData.spans.some(span => span > 1);
  
  // Add colspan/rowspan to thead and strip group prefixes in the second row.
  const firstRowRemove = [];
  const secondRowRemove = [];
  let firstPtr = 0;
  let secondPtr = 0;
  for (let groupIdx = 0; groupIdx < groupData.spans.length; groupIdx++) {
    const span = groupData.spans[groupIdx];
    const groupName = groupData.rawNames[groupIdx];
    const firstOpen = firstRowCells[firstPtr];
    if (typeof firstOpen !== 'number' || !tokens[firstOpen] || tokens[firstOpen].type !== 'th_open') {
      break;
    }
    const firstInline = tokens[firstOpen + 1];
    
    if (groupName === null) {
      tokens[firstOpen].attrSet('rowspan', '2');
      tokens[firstOpen].attrSet('scope', 'col');
      removeStrongWrappers(firstInline, allowFallback);
      const secondOpen = secondRowCells[secondPtr];
      if (typeof secondOpen === 'number') {
        secondRowRemove.push(secondOpen);
        secondPtr += 1;
      }
      firstPtr += 1;
      continue;
    }
    
    if (span > 1) {
      tokens[firstOpen].attrSet('colspan', span.toString());
    }
    tokens[firstOpen].attrSet('scope', 'col');
    if (firstInline) {
      setInlineText(firstInline, Token, groupName);
    }
    
    for (let i = 1; i < span; i++) {
      const extraFirst = firstRowCells[firstPtr + i];
      if (typeof extraFirst === 'number') {
        firstRowRemove.push(extraFirst);
      }
    }
    
    for (let i = 0; i < span; i++) {
      const secondOpen = secondRowCells[secondPtr + i];
      if (typeof secondOpen !== 'number' || !tokens[secondOpen] || tokens[secondOpen].type !== 'th_open') {
        continue;
      }
      tokens[secondOpen].attrSet('scope', 'col');
      const secondInline = tokens[secondOpen + 1];
      if (!secondInline || typeof secondInline.content !== 'string') continue;
      const secondContent = secondInline.content;
      let secondMatch = null;
      if (opt.colgroupWithNoAsterisk) {
        if (secondContent.indexOf(':') !== -1 || secondContent.indexOf('：') !== -1) {
          secondMatch = secondContent.match(groupStripReg);
        }
      } else if (hasLeadingStrongMarker(secondInline, allowFallback)) {
        secondMatch = secondContent.match(groupStripReg);
      }
      if (secondMatch) {
        setInlineText(secondInline, Token, secondMatch[1]);
      }
    }
    
    secondPtr += span;
    firstPtr += span;
  }
  
  if (firstRowRemove.length || secondRowRemove.length) {
    const removeTargets = firstRowRemove.concat(secondRowRemove).sort((a, b) => b - a);
    for (let i = 0; i < removeTargets.length; i++) {
      removeHeaderCellAt(tokens, removeTargets[i]);
    }
  }
  
  // Insert colgroup after header edits so index calculations above remain stable.
  if (hasSpan) {
    const insertTokens = [
      new Token('colgroup_open', 'colgroup', 1),
      createNewlineToken(Token)
    ];
    for (let i = 0; i < groupData.spans.length; i++) {
      const colOpen = new Token('col_open', 'col', 1);
      if (groupData.spans[i] > 1) {
        colOpen.attrPush(['span', groupData.spans[i]]);
      }
      insertTokens.push(colOpen, createNewlineToken(Token));
    }
    insertTokens.push(
      new Token('colgroup_close', 'colgroup', -1),
      createNewlineToken(Token)
    );
    tokens.splice(tableOpenIdx + 1, 0, ...insertTokens);
  }
};

const tableEx = (state, opt, regexes) => {
  const tokens = state.tokens;
  let tokenLength = tokens.length;
  const allowStrongFallback = !hasInlineRule(state.md, 'strong_ja');
  
  let idx = 0;
  while (idx < tokenLength) {
    if (tokens[idx].type !== 'table_open') { 
      idx++; 
      continue; 
    }
    
    let tableOpenIdx = idx;
    
    if (opt.wrapper) {
      const wrapperStartToken = new state.Token('div_open', 'div', 1);
      wrapperStartToken.attrPush(['class', 'table-wrapper']);
      if (Array.isArray(tokens[idx].map)) {
        wrapperStartToken.map = tokens[idx].map.slice();
      }
      tokens.splice(idx, 0, wrapperStartToken, createNewlineToken(state.Token));
      tokenLength += 2;
      idx += 2;
      tableOpenIdx = idx;
    }
    
    let theadVar = {
      i: idx + 1,
      firstThPos: -1,
    };
    
    const hasThead = tokens[theadVar.i] && tokens[theadVar.i].type === 'thead_open';
    if (hasThead) {
      theadVar = addTheadThScope(state, theadVar, allowStrongFallback);
      idx = theadVar.i + 1;
      const hadMatrixAnchor = Number.isInteger(theadVar.firstThPos) && theadVar.firstThPos >= 0;
      if (opt.colgroup) {
        const beforeLength = tokens.length;
        setColgroup(state, tableOpenIdx, opt, allowStrongFallback, regexes);
        tokenLength += tokens.length - beforeLength;
      }
      if (opt.matrix) {
        let firstThPos = findFirstHeaderThPos(tokens, tableOpenIdx, allowStrongFallback);
        if (firstThPos < 0 && hadMatrixAnchor) {
          firstThPos = findFirstHeaderCellPos(tokens, tableOpenIdx);
        }
        theadVar.firstThPos = firstThPos;
      }
    }
    
    if (opt.matrix) {
      let tbodyOpenPos = -1;
      for (let i = tableOpenIdx + 1; i < tokenLength; i++) {
        const type = tokens[i].type;
        if (type === 'tbody_open') {
          tbodyOpenPos = i;
          break;
        }
        if (type === 'table_close') {
          break;
        }
      }
      
      let tbodyVar = {
        i: tbodyOpenPos,
        isAllFirstTh: false,
        tbodyFirstThPoses: [],
      };
      
      const hasTbody = tbodyVar.i >= 0;
      if (hasTbody) {
        tbodyVar = checkTbody(state, tbodyVar, allowStrongFallback);
        idx = tbodyVar.i + 1;
      }
      
      const hasMatrixAnchor = hasThead
        ? Number.isInteger(theadVar.firstThPos) && theadVar.firstThPos >= 0
        : true;
      if (hasMatrixAnchor && tbodyVar.isAllFirstTh) {
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
          tokens.splice(idx + 1, 0, wrapperEndToken, createNewlineToken(state.Token));
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
  const baseOpt = {
    matrix: true,
    wrapper: false,
    colgroup: false,
    colgroupWithNoAsterisk: false
  };
  const userOpt = (option && typeof option === 'object') ? option : {};
  const opt = Object.assign({}, baseOpt, userOpt);
  const regexes = createColgroupRegexes(opt.colgroupWithNoAsterisk);
  md.core.ruler.after('replacements', 'table-ex', (state) => {
    tableEx(state, opt, regexes);
  });
}
export default mditTableEx
