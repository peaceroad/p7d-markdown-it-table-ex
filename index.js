const tableExPluginKey = Symbol.for('@peaceroad/markdown-it-table-ex');
const strongWrapperNeedsReparse = 1;
const strongWrapperExact = 2;
const headerCellCompactionThreshold = 8;

const getStrongWrapperMode = (inline, allowFallback) => {
  if (!inline || typeof inline.content !== 'string') return 0;
  const content = inline.content;
  if (!content.startsWith('**') || !content.endsWith('**')) return 0;

  const children = Array.isArray(inline.children) ? inline.children : null;
  if (!children) return allowFallback ? strongWrapperNeedsReparse : 0;

  let hasStrongToken = false;
  let firstMeaningfulType = '';
  let lastMeaningfulType = '';
  let strongDepth = 0;
  let isExactWrapper = true;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const type = child.type;
    if (type === 'strong_open' || type === 'strong_close') hasStrongToken = true;
    if (type === 'text' && child.content === '') continue;

    if (firstMeaningfulType === '') {
      firstMeaningfulType = type;
      if (type === 'strong_open') {
        strongDepth = 1;
      } else {
        isExactWrapper = false;
      }
    } else if (isExactWrapper) {
      // A meaningful token after depth returns to zero means the raw boundary
      // markers were parsed as sibling strong ranges and require reparsing.
      if (strongDepth === 0) {
        isExactWrapper = false;
      } else if (type === 'strong_open') {
        strongDepth++;
      } else if (type === 'strong_close') {
        strongDepth--;
      }
    }
    lastMeaningfulType = type;
  }

  if (firstMeaningfulType === 'strong_open' && lastMeaningfulType === 'strong_close') {
    return isExactWrapper && strongDepth === 0
      ? strongWrapperExact
      : strongWrapperNeedsReparse;
  }
  return allowFallback && !hasStrongToken ? strongWrapperNeedsReparse : 0;
};

const isStrongWrappedInline = (inline, allowFallback) => {
  return getStrongWrapperMode(inline, allowFallback) !== 0;
};

const hasLeadingStrongMarker = (inline, allowFallback) => {
  if (!inline || typeof inline.content !== 'string') return false;
  if (!inline.content.startsWith('**')) return false;

  const children = Array.isArray(inline.children) ? inline.children : null;
  if (!children) return allowFallback;

  let hasStrongToken = false;
  let hasMeaningfulToken = false;
  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const type = child.type;
    if (type === 'strong_open' || type === 'strong_close') hasStrongToken = true;
    if (!hasMeaningfulToken && (type !== 'text' || child.content !== '')) {
      hasMeaningfulToken = true;
      if (type === 'strong_open') return true;
    }
  }
  return allowFallback && !hasStrongToken;
};

const hasInlineRule = (md, name) => {
  const rules = md && md.inline && md.inline.ruler && md.inline.ruler.__rules__;
  if (!Array.isArray(rules)) return false;
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].name === name) return true;
  }
  return false;
};

const copyMap = (map) => Array.isArray(map) ? map.slice() : null;

const applyLevelAndMap = (token, level, map) => {
  if (Number.isInteger(level)) token.level = level;
  const copiedMap = copyMap(map);
  if (copiedMap) token.map = copiedMap;
  return token;
};

const createNewlineToken = (Token, level) => {
  const token = new Token('text', '', 0);
  token.content = '\n';
  if (Number.isInteger(level)) token.level = level;
  return token;
};

const createColgroupTokens = (Token, spans, level, map) => {
  const colgroupLevel = Number.isInteger(level) ? level : 0;
  const tokens = [
    applyLevelAndMap(new Token('colgroup_open', 'colgroup', 1), colgroupLevel, map),
    createNewlineToken(Token, colgroupLevel + 1)
  ];
  for (let i = 0; i < spans.length; i++) {
    const colOpen = new Token('col_open', 'col', 1);
    if (spans[i] > 1) {
      colOpen.attrPush(['span', spans[i]]);
    }
    tokens.push(
      applyLevelAndMap(colOpen, colgroupLevel + 1, map),
      createNewlineToken(Token, colgroupLevel + 1)
    );
  }
  tokens.push(
    applyLevelAndMap(new Token('colgroup_close', 'colgroup', -1), colgroupLevel),
    createNewlineToken(Token, colgroupLevel)
  );
  return tokens;
};

const setInlineText = (inline, Token, text, level, map) => {
  inline.content = text;
  applyLevelAndMap(inline, level, map);
  const textToken = new Token('text', '', 0);
  textToken.content = text;
  textToken.level = 0;
  inline.children = [textToken];
};

const setInlineParsedContent = (state, inline, text, level, map) => {
  inline.content = text;
  applyLevelAndMap(inline, level, map);
  const children = [];
  state.md.inline.parse(text, state.md, state.env, children);
  inline.children = children;
};

const removeHeaderCellAt = (tokens, openIdx) => {
  if (!tokens[openIdx] || tokens[openIdx].type !== 'th_open' ||
      !tokens[openIdx + 2] || tokens[openIdx + 2].type !== 'th_close') return;
  let deleteCount = 3;
  const next = tokens[openIdx + 3];
  if (next && next.type === 'text' && next.content === '\n') deleteCount++;
  tokens.splice(openIdx, deleteCount);
};

const removeHeaderCells = (tokens, openIndexes) => {
  if (openIndexes.length === 0) return;

  // V8's native splice is faster for a handful of edits. Switch to one-pass
  // compaction only when repeated suffix shifts begin to dominate.
  if (openIndexes.length < headerCellCompactionThreshold) {
    openIndexes.sort((a, b) => b - a);
    for (let i = 0; i < openIndexes.length; i++) {
      removeHeaderCellAt(tokens, openIndexes[i]);
    }
    return;
  }

  const removeStarts = new Set();
  for (let i = 0; i < openIndexes.length; i++) {
    const openIdx = openIndexes[i];
    if (tokens[openIdx] && tokens[openIdx].type === 'th_open' &&
        tokens[openIdx + 2] && tokens[openIdx + 2].type === 'th_close') {
      removeStarts.add(openIdx);
    }
  }
  if (removeStarts.size === 0) return;

  // Compact once instead of splicing once per cell. Repeated splices make a
  // wide grouped header quadratic because every deletion shifts its suffix.
  let read = 0;
  let write = 0;
  while (read < tokens.length) {
    if (removeStarts.has(read)) {
      read += 3;
      const next = tokens[read];
      if (next && next.type === 'text' && next.content === '\n') read++;
      continue;
    }
    tokens[write++] = tokens[read++];
  }
  tokens.length = write;
};

const findFirstHeaderThPos = (tokens, tableOpenIdx, allowFallback, allowAnyFirstHeaderCell = false) => {
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
    if (allowAnyFirstHeaderCell ||
        (inline && (inline.content === '' || isStrongWrappedInline(inline, allowFallback)))) {
      return i;
    }
    return -1;
  }
  return -1;
};

const createColgroupRegexes = (colgroupWithNoAsterisk) => {
  if (colgroupWithNoAsterisk) {
    return {
      group: /^([^:：]+)(?:：\s*|: +)/,
      strip: /^[^:：]+(?:：\s*|: +)(.*)$/
    };
  }
  return {
    group: /^\*\*([^*:：]+)[:：]\*\*\s*/,
    strip: /^\*\*[^*:：]+[:：]\*\*\s*(.*)$/
  };
};

const matchColgroupPattern = (inline, regex, opt, allowFallback) => {
  const content = inline && typeof inline.content === 'string' ? inline.content : '';
  if (opt.colgroupWithNoAsterisk) {
    return regex.exec(content);
  }
  return hasLeadingStrongMarker(inline, allowFallback) ? regex.exec(content) : null;
};

const addGroupData = (groupData, match) => {
  if (!match) {
    groupData.rawNames.push(null);
    groupData.spans.push(1);
    return;
  }

  const group = match[1].trim();
  const lastGroup = groupData.rawNames[groupData.rawNames.length - 1];
  if (lastGroup === group) {
    const lastSpanIdx = groupData.spans.length - 1;
    groupData.spans[lastSpanIdx]++;
    if (groupData.spans[lastSpanIdx] === 2) groupData.hasSpan = true;
  } else {
    groupData.rawNames.push(group);
    groupData.spans.push(1);
  }
  groupData.headerCount++;
};

const createGroupData = () => ({
  spans: [],
  rawNames: [],
  headerCount: 0,
  hasSpan: false
});

const removeStrongWrappers = (state, inline, allowFallback, knownMode = 0) => {
  if (!inline || typeof inline.content !== 'string') return;
  const content = inline.content;
  const wrapperMode = knownMode || getStrongWrapperMode(inline, allowFallback);
  if (wrapperMode === 0) return;

  const unwrappedContent = content.slice(2, -2);
  if (wrapperMode === strongWrapperExact) {
    const children = inline.children;
    let first = 0;
    let last = children.length - 1;
    while (first <= last && children[first].type === 'text' && children[first].content === '') first++;
    while (last >= first && children[last].type === 'text' && children[last].content === '') last--;

    const innerChildren = children.slice(first + 1, last);
    for (let i = 0; i < innerChildren.length; i++) {
      if (Number.isInteger(innerChildren[i].level) && innerChildren[i].level > 0) {
        innerChildren[i].level--;
      }
    }
    inline.content = unwrappedContent;
    inline.children = innerChildren;
    return;
  }

  // Reparse only for compatibility shapes: tokenless CJK boundaries, or raw
  // outer markers that markdown-it interpreted as multiple sibling ranges.
  const children = [];
  state.md.inline.parse(unwrappedContent, state.md, state.env, children);
  inline.content = unwrappedContent;
  inline.children = children;
}

const addTheadThScope = (state, theadVar, allowFallback, trackMatrixAnchor) => {
  const tokens = state.tokens;
  let firstThPos = theadVar.firstThPos;
  let j = theadVar.i + 1;
  let isFirstRow = true;
  let firstRowFirstThSeen = false;
  while (j < tokens.length) {
    const tokenType = tokens[j].type;
    if (tokenType === 'th_open') {
      tokens[j].attrSet('scope', 'col');
      if (trackMatrixAnchor && isFirstRow && !firstRowFirstThSeen) {
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

const changeTdToTh = (state, headerThPos, bodyTdPoses, bodyWrapperModes, allowFallback) => {
  const tokens = state.tokens;
  if (headerThPos >= 0) {
    removeStrongWrappers(state, tokens[headerThPos + 1], allowFallback);
  }
  for (let j = 0; j < bodyTdPoses.length; j++) {
    const pos = bodyTdPoses[j]
    tokens[pos].type = 'th_open';
    tokens[pos].tag = 'th';
    tokens[pos].attrSet('scope', 'row');
    tokens[pos + 2].type = 'th_close';
    tokens[pos + 2].tag = 'th';
    const inline = tokens[pos + 1];
    removeStrongWrappers(state, inline, allowFallback, bodyWrapperModes[j]);
  }
}

const checkTbody = (state, tbodyVar, allowFallback) => {
  const tokens = state.tokens;
  let isAllFirstTh = true
  const tbodyFirstThPoses = []
  const tbodyWrapperModes = []
  let j = tbodyVar.i + 1
  while (j < tokens.length) {
    if (tokens[j].type === 'tr_open') {
      j++
      const wrapperMode = tokens[j].type === 'td_open'
        ? getStrongWrapperMode(tokens[j + 1], allowFallback)
        : 0;
      if (wrapperMode !== 0) {
        tbodyFirstThPoses.push(j)
        tbodyWrapperModes.push(wrapperMode)
      } else {
        isAllFirstTh = false
        break
      }
    }
    if (tokens[j].type === 'tbody_close') break
    j++
  }
  return {
    i: j,
    isAllFirstTh,
    tbodyFirstThPoses,
    tbodyWrapperModes
  }
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
    const tableLevel = tokens[tableOpenIdx].level;
    const theadLevel = tokens[theadOpen].level;
    const rowLevel = theadLevel + 1;
    const cellLevel = rowLevel + 1;
    const rowMap = Array.isArray(tokens[tr1].map) ? tokens[tr1].map : tokens[theadOpen].map;

    // Calculate group names and colspan for the first row of th
    const groupData = createGroupData();
    
    let thIdx = tr1 + 1;
    const origThInfos = [];
    let trCloseIdx = -1;
    
    while (thIdx < tokens.length) {
      const tokenType = tokens[thIdx].type;
      if (tokenType === 'th_open') {
        const inline = tokens[thIdx + 1];
        let map = null;
        if (Array.isArray(tokens[thIdx].map)) {
          map = tokens[thIdx].map;
        } else if (inline && Array.isArray(inline.map)) {
          map = inline.map;
        }
        origThInfos.push({ inline, map });
        addGroupData(
          groupData,
          matchColgroupPattern(inline, regexes.group, opt, allowFallback)
        );
      } else if (tokenType === 'tr_close') {
        trCloseIdx = thIdx;
        break;
      }
      thIdx++;
    }
    
    // If there are not two or more grouped header cells, do not auto-generate
    if (groupData.headerCount < 2) return;
    
    const groupNames = groupData.rawNames;
    
    if (groupData.hasSpan) {
      const insertTokens = createColgroupTokens(Token, groupData.spans, tableLevel + 1, rowMap);
      tokens.splice(tableOpenIdx + 1, 0, ...insertTokens);
      
      // Update indices
      const offset = insertTokens.length;
      tr1 += offset;
      trCloseIdx += offset;
    }
    
    const newTr1 = [
      applyLevelAndMap(new Token('tr_open', 'tr', 1), rowLevel, rowMap),
      createNewlineToken(Token, rowLevel + 1)
    ];
    
    const newTr2 = [
      applyLevelAndMap(new Token('tr_open', 'tr', 1), rowLevel, rowMap),
      createNewlineToken(Token, rowLevel + 1)
    ];
    
    let thPtr = 0;
    for (let i = 0; i < groupData.spans.length; i++) {
      const origInfo = origThInfos[thPtr];
      const cellMap = origInfo && origInfo.map ? origInfo.map : null;
      if (groupNames[i] === null) {
        // Leftmost cell: rowspan=2
        const thOpen = applyLevelAndMap(new Token('th_open', 'th', 1), cellLevel, cellMap);
        thOpen.attrSet('rowspan', '2');
        thOpen.attrSet('scope', 'col');
        
        const thInline = applyLevelAndMap(new Token('inline', '', 0), cellLevel, cellMap);
        const origInline = origInfo ? origInfo.inline : null;
        
        if (origInline) {
          removeStrongWrappers(state, origInline, allowFallback);
          thInline.content = origInline.content;
          thInline.children = Array.isArray(origInline.children) ? origInline.children : [];
        } else {
          setInlineText(thInline, Token, '', cellLevel, cellMap);
        }
        
        newTr1.push(
          thOpen,
          thInline,
          applyLevelAndMap(new Token('th_close', 'th', -1), cellLevel),
          createNewlineToken(Token, cellLevel)
        );
        thPtr++;
      } else {
        // Group cell
        const thOpen = applyLevelAndMap(new Token('th_open', 'th', 1), cellLevel, cellMap);
        if (groupData.spans[i] > 1) {
          thOpen.attrSet('colspan', groupData.spans[i].toString());
        }
        thOpen.attrSet('scope', 'col');
        
        const thInline = new Token('inline', '', 0);
        setInlineText(thInline, Token, groupNames[i], cellLevel, cellMap);
        
        newTr1.push(
          thOpen,
          thInline,
          applyLevelAndMap(new Token('th_close', 'th', -1), cellLevel),
          createNewlineToken(Token, cellLevel)
        );
        
        // Second row: each item in the group
        for (let j = 0; j < groupData.spans[i]; j++) {
          const subInfo = origThInfos[thPtr];
          const subMap = subInfo && subInfo.map ? subInfo.map : null;
          const th2Open = applyLevelAndMap(new Token('th_open', 'th', 1), cellLevel, subMap);
          th2Open.attrSet('scope', 'col');
          
          const th2Inline = new Token('inline', '', 0);
          const origInline = subInfo ? subInfo.inline : null;
          const orig = origInline?.content || '';
          const match = matchColgroupPattern(origInline, regexes.strip, opt, allowFallback);
          setInlineParsedContent(
            state,
            th2Inline,
            match ? match[1] : orig,
            cellLevel,
            subMap
          );
          
          newTr2.push(
            th2Open,
            th2Inline,
            applyLevelAndMap(new Token('th_close', 'th', -1), cellLevel),
            createNewlineToken(Token, cellLevel)
          );
          thPtr++;
        }
      }
    }
    
    newTr1.push(
      applyLevelAndMap(new Token('tr_close', 'tr', -1), rowLevel),
      createNewlineToken(Token, rowLevel)
    );
    
    newTr2.push(
      applyLevelAndMap(new Token('tr_close', 'tr', -1), rowLevel),
      createNewlineToken(Token, rowLevel)
    );
    
    // Clean up newlines before insertion
    while (tokens[tr1 - 1] && tokens[tr1 - 1].type === 'text' && tokens[tr1 - 1].content === '\n') {
      tokens.splice(tr1 - 1, 1);
      tr1--;
    }
    
    tokens.splice(tr1, trCloseIdx - tr1 + 1, ...newTr1, ...newTr2);
    
    return;
  }
  
  if (tr1 < 0 || tr2 < 0) return;
  
  // Calculate group names and colspan for multi-row case
  const groupData = createGroupData();
  
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
    addGroupData(groupData, matchColgroupPattern(inline, regexes.group, opt, allowFallback));
  }
  
  if (groupData.headerCount < 2) return;
  
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
      removeStrongWrappers(state, firstInline, allowFallback);
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
      const secondMatch = matchColgroupPattern(secondInline, regexes.strip, opt, allowFallback);
      if (secondMatch) {
        setInlineParsedContent(state, secondInline, secondMatch[1]);
      }
    }
    
    secondPtr += span;
    firstPtr += span;
  }
  
  if (firstRowRemove.length || secondRowRemove.length) {
    removeHeaderCells(tokens, firstRowRemove.concat(secondRowRemove));
  }
  
  if (groupData.hasSpan) {
    const tableLevel = tokens[tableOpenIdx].level;
    const colgroupMap = Array.isArray(tokens[tr1].map) ? tokens[tr1].map : tokens[theadOpen].map;
    tokens.splice(
      tableOpenIdx + 1,
      0,
      ...createColgroupTokens(Token, groupData.spans, tableLevel + 1, colgroupMap)
    );
  }
};

const tableEx = (state, opt, regexes) => {
  const tokens = state.tokens;
  let tokenLength = tokens.length;
  const usesStrongMarkers = opt.matrix || opt.colgroup;
  let allowStrongFallback;
  let idx = 0;
  while (idx < tokenLength) {
    if (tokens[idx].type !== 'table_open') { 
      idx++; 
      continue; 
    }

    if (allowStrongFallback === undefined) {
      allowStrongFallback = usesStrongMarkers && !hasInlineRule(state.md, 'strong_ja');
    }
    
    let tableOpenIdx = idx;
    
    if (opt.wrapper) {
      const wrapperStartToken = new state.Token('div_open', 'div', 1);
      wrapperStartToken.level = tokens[idx].level;
      wrapperStartToken.attrPush(['class', 'table-wrapper']);
      if (Array.isArray(tokens[idx].map)) {
        wrapperStartToken.map = tokens[idx].map.slice();
      }
      tokens.splice(idx, 0, wrapperStartToken, createNewlineToken(state.Token, wrapperStartToken.level + 1));
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
      theadVar = addTheadThScope(state, theadVar, allowStrongFallback, opt.matrix);
      idx = theadVar.i + 1;
      const hadMatrixAnchor = Number.isInteger(theadVar.firstThPos) && theadVar.firstThPos >= 0;
      if (opt.colgroup) {
        const beforeLength = tokens.length;
        setColgroup(state, tableOpenIdx, opt, allowStrongFallback, regexes);
        tokenLength += tokens.length - beforeLength;
      }
      if (opt.matrix) {
        theadVar.firstThPos = findFirstHeaderThPos(
          tokens,
          tableOpenIdx,
          allowStrongFallback,
          hadMatrixAnchor
        );
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
        tbodyWrapperModes: [],
      };
      
      const hasTbody = tbodyVar.i >= 0;
      if (hasTbody) {
        tbodyVar = checkTbody(state, tbodyVar, allowStrongFallback);
        idx = tbodyVar.i + 1;
      }
      
      const hasMatrixAnchor = hasThead
        ? Number.isInteger(theadVar.firstThPos) && theadVar.firstThPos >= 0
        : true;
      if (hasMatrixAnchor && tbodyVar.isAllFirstTh && tbodyVar.tbodyFirstThPoses.length > 0) {
        changeTdToTh(
          state,
          hasThead ? theadVar.firstThPos : -1,
          tbodyVar.tbodyFirstThPoses,
          tbodyVar.tbodyWrapperModes,
          allowStrongFallback
        );
      }
    }
    
    while (idx < tokenLength) {
      if (tokens[idx].type === 'table_close') {
        if (opt.wrapper) {
          const wrapperEndToken = new state.Token('div_close', 'div', -1);
          wrapperEndToken.level = tokens[idx].level;
          tokens.splice(idx + 1, 0, wrapperEndToken, createNewlineToken(state.Token, wrapperEndToken.level));
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

const defaultOptions = {
  matrix: true,
  wrapper: false,
  colgroup: false,
  colgroupWithNoAsterisk: false
};

const mditTableEx = (md, option) => {
  const opt = Object.assign(
    {},
    defaultOptions,
    option && typeof option === 'object' ? option : {}
  );
  if (md[tableExPluginKey]) {
    throw new Error('@peaceroad/markdown-it-table-ex is already registered on this markdown-it instance. Create a separate markdown-it instance for different options.');
  }
  Object.defineProperty(md, tableExPluginKey, {
    value: true,
    configurable: false
  });

  const regexes = opt.colgroup
    ? createColgroupRegexes(opt.colgroupWithNoAsterisk)
    : null;
  md.core.ruler.after('replacements', 'table-ex', (state) => {
    tableEx(state, opt, regexes);
  });
}
export default mditTableEx
