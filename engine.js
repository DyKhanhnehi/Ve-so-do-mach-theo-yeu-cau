/* Xưởng Vẽ Mạch — engine: IEC symbols, series/parallel layout, wire numbering.
   Model: section = {title, kind:'power'|'ac'|'dc'|'final', poles:[names], top:bool, bottom:bool, net:series}
   series = [item...]; item = element {t,tag,lbl,tt,bt,act,links} | {par:[series...], open:'top'|'bottom'|'both'} */
(function (G) {
  'use strict';
  const PS = 16, ELH = 64, STUB = 14, GAP = 22, LM = 34, RM = 116, SEC_PAD_L = 46, SEC_PAD_R = 14;
  const BS = 11, busH = n => 14 + (n - 1) * BS;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // element metadata: h = total height, end = no bottom terminals, start = no top terminals
  const DEF = {
    cb: { h: ELH, multi: 1 }, rcbo: { h: ELH, multi: 1 }, isol: { h: ELH, multi: 1 }, km: { h: ELH, multi: 1 },
    fuse: { h: ELH, multi: 1 }, ol: { h: ELH, multi: 1 },
    no: { h: ELH }, nc: { h: ELH }, coil: { h: ELH }, tcoil: { h: ELH }, lamp: { h: ELH }, sock: { h: ELH },
    sw: { h: ELH }, plcin: { h: ELH }, plcout: { h: ELH }, psu: { h: ELH }, box2: { h: ELH }, sensor: { h: ELH },
    vfd: { h: 72, multi: 1 }, swap: { h: 44, multi: 1 }, sw2: { h: 116 },
    motor: { h: 92, end: 1, multi: 1 }, motor6: { h: 104, end: 1, multi: 1 }, load: { h: 70, end: 1, multi: 1 },
    vfdin: { h: 56, end: 1 }, spd: { h: 80, end: 1, multi: 1 }, meter: { h: 64, end: 1, multi: 1 },
    short: { h: 46, end: 1, multi: 1 }, src: { h: 62, start: 1, multi: 1 }, from: { h: 50, start: 1, multi: 1 }
  };
  const TYPES = Object.keys(DEF);

  function defTerms(e, n, poleNames) {
    const r = { tt: [], bt: [] };
    for (let p = 0; p < n; p++) {
      const pn = poleNames[p] || '';
      let a = String(2 * p + 1), b = String(2 * p + 2);
      if (pn === 'N') { a = 'N'; b = 'N'; }
      switch (e.t) {
        case 'no': a = e.act === 'thermal' ? '97' : e.act === 'timer' ? '15' : '13'; b = e.act === 'thermal' ? '98' : e.act === 'timer' ? '18' : '14'; break;
        case 'nc': a = e.act === 'thermal' ? '95' : e.act === 'timer' ? '15' : '21'; b = e.act === 'thermal' ? '96' : e.act === 'timer' ? '16' : '22'; break;
        case 'coil': case 'tcoil': a = 'A1'; b = 'A2'; break;
        case 'lamp': a = 'X1'; b = 'X2'; break;
        case 'sock': case 'psu': a = 'L'; b = 'N'; break;
        case 'sw': a = 'L'; b = 'L1'; break;
        case 'sw2': a = 'COM'; b = 'COM'; break;
        case 'sensor': a = 'BN'; b = 'BK'; break;
        case 'plcin': a = e.lbl || 'I0.0'; b = 'COM'; break;
        case 'plcout': a = 'COM'; b = e.lbl || 'Q0.0'; break;
        case 'vfd': a = ['R/L1', 'S/L2', 'T/L3'][p] || a; b = ['U/T1', 'V/T2', 'W/T3'][p] || b; break;
        case 'motor': a = ['U1', 'V1', 'W1'][p] || 'U' + p; break;
        case 'motor6': a = ['U1', 'V1', 'W1'][p] || 'U' + p; break;
        case 'vfdin': a = e.lbl || 'DI'; break;
        case 'load': case 'meter': case 'spd': a = pn; break;
        case 'src': b = pn; break;
      }
      r.tt.push(a); r.bt.push(b);
    }
    return r;
  }

  // ---------- measure ----------
  function meas(nd, n) {
    if (Array.isArray(nd)) {
      if (!nd.length) return (nd._m = { w: LM + (n - 1) * PS + 24, sx: LM, h: 30 });
      let L = 0, R = 0, h = 0;
      nd.forEach(c => { const m = meas(c, n); L = Math.max(L, m.sx); R = Math.max(R, m.w - m.sx); h += m.h; });
      return (nd._m = { w: L + R, sx: L, h });
    }
    if (nd.par) {
      const ms = nd.par.map(b => meas(b, n));
      const w = ms.reduce((a, m) => a + m.w, 0) + GAP * (ms.length - 1);
      const ot = nd.open === 'top' || nd.open === 'both', ob = nd.open === 'bottom' || nd.open === 'both';
      const h = Math.max(...ms.map(m => m.h)) + (ot ? 0 : busH(n)) + (ob ? 0 : busH(n));
      return (nd._m = { w, sx: ms[0].sx, h, ms, ot, ob });
    }
    const d = DEF[nd.t] || DEF.box2;
    const span = (n - 1) * PS;
    let extra = 0;
    if (nd.t === 'sw2') extra = 14;
    if (nd.t === 'motor' || nd.t === 'motor6') extra = Math.max(0, 26 - span / 2);
    return (nd._m = { w: LM + span + extra + RM, sx: LM, h: d.h });
  }

  // ---------- netlist (union-find) ----------
  function Net() {
    const parent = {}, terms = {}, pos = {}, railName = {}, order = [];
    const find = k => { while (parent[k] && parent[k] !== k) { parent[k] = parent[parent[k]] || parent[k]; k = parent[k]; } return k; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
    const touch = k => { if (!(k in parent)) { parent[k] = k; order.push(k); } };
    return {
      id: 0, links: [],
      node() { return ++this.id; },
      key(id, p) { const k = id + '.' + p; touch(k); return k; },
      term(id, p, tag, term, x, y, sec) { const k = this.key(id, p); (terms[k] = terms[k] || []).push({ tag, term, sec }); if (!pos[k]) pos[k] = { x, y, sec }; },
      wire(a, b) { touch(a); touch(b); uni(a, b); },
      rail(id, p, name) { railName[this.key(id, p)] = name; },
      // collect wires: [{root, name, terms, pos, rail}]
      build(sections) {
        const groups = {};
        order.forEach(k => { const r = find(k); (groups[r] = groups[r] || { keys: [], terms: [], pos: null, rail: null }); const g = groups[r]; g.keys.push(k); if (terms[k]) g.terms.push(...terms[k]); if (!g.pos && pos[k]) g.pos = pos[k]; if (railName[k] && !g.rail) g.rail = railName[k]; });
        Object.values(groups).forEach(g => { const seen = new Set(); g.terms = g.terms.filter(t => { const k = t.tag + ':' + t.term; if (seen.has(k)) return false; seen.add(k); return true; }); });
        const list = Object.values(groups).filter(g => g.terms.length + (g.rail ? 1 : 0) >= 2 || (g.rail && g.terms.length));
        let cn = 0, pn = 0;
        list.forEach(g => {
          const sec = g.pos ? g.pos.sec : (g.terms[0] && g.terms[0].sec);
          const kind = sections[sec] ? sections[sec].kind : 'ac';
          if (g.rail) g.name = g.rail;
          else if (kind === 'power') g.name = 'P' + (++pn);
          else g.name = String(++cn);
          g.sec = sec; g.kind = kind; const pk = g.keys[0] ? +g.keys[0].split('.')[1] : 0; g.pole = sections[sec] ? ((g.rail && g.name) || sections[sec].poles[pk]) : '';
        });
        return list;
      }
    };
  }

  // ---------- colour by wire ----------
  function wireColor(kind, pole, colorOn) {
    if (!colorOn) return 'var(--line)';
    if (kind === 'power' || kind === 'final') return ({ L1: 'var(--w-l1)', L2: 'var(--w-l2)', L3: 'var(--w-l3)', N: 'var(--w-n)', L: 'var(--w-l1)', PE: 'var(--w-pe)' })[pole] || 'var(--w-l2)';
    if (kind === 'dc') return pole === '0V' || pole === '-' ? 'var(--w-dc0)' : 'var(--w-dc)';
    return pole === 'N' ? 'var(--w-n)' : 'var(--w-ac)';
  }

  // ---------- drawing primitives ----------
  const L = (x1, y1, x2, y2, c, cls) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"${c ? ` stroke="${c}"` : ''}${cls ? ` class="${cls}"` : ''}/>`;
  const T = (x, y, s, cls, anchor) => `<text x="${x}" y="${y}" class="${cls || ''}"${anchor ? ` text-anchor="${anchor}"` : ''}>${esc(s)}</text>`;
  function wrap(s, max) { const out = []; let cur = ''; String(s || '').split(/\s+/).forEach(w => { if ((cur + ' ' + w).trim().length > max && cur) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) out.push(cur); return out.slice(0, 4); }
  function TW(x, y, s, cls, max, lh) { return wrap(s, max).map((ln, i) => T(x, y + i * (lh || 11), ln, cls)).join(''); }

  function actuator(act, ax, ay) {
    switch (act) {
      case 'push': return `<polyline points="${ax - 5},${ay - 6} ${ax},${ay - 6} ${ax},${ay + 6} ${ax - 5},${ay + 6}" class="sym"/>`;
      case 'pushnc': return `<polyline points="${ax - 5},${ay - 6} ${ax},${ay - 6} ${ax},${ay + 6} ${ax - 5},${ay + 6}" class="sym"/>`;
      case 'estop': return `<path d="M${ax},${ay - 8} A8,8 0 0 0 ${ax},${ay + 8} Z" class="sym fillr"/>`;
      case 'sel': return `<polyline points="${ax - 7},${ay + 5} ${ax - 7},${ay - 5} ${ax},${ay - 5} ${ax},${ay + 5}" class="sym"/><line x1="${ax}" y1="${ay + 5}" x2="${ax + 4}" y2="${ay + 5}" class="sym"/>`;
      case 'thermal': return `<polyline points="${ax - 10},${ay + 4} ${ax - 10},${ay - 4} ${ax - 5},${ay - 4} ${ax - 5},${ay + 4} ${ax},${ay + 4}" class="sym"/>`;
      case 'timer': return `<path d="M${ax},${ay - 7} A7,7 0 0 0 ${ax},${ay + 7}" class="sym"/><line x1="${ax - 7}" y1="${ay - 3}" x2="${ax - 7}" y2="${ay + 3}" class="sym"/>`;
      case 'light': return `<path d="M${ax - 14},${ay - 9} l8,6 m-3,-0.5 l3,0.5 l-1,-3 M${ax - 14},${ay - 1} l8,6 m-3,-0.5 l3,0.5 l-1,-3" class="sym"/>`;
      case 'sensor': return `<path d="M${ax - 6},${ay} L${ax},${ay - 6} L${ax + 6},${ay} L${ax},${ay + 6} Z" class="sym" transform="translate(-6,0)"/>`;
      case 'float': return `<circle cx="${ax - 5}" cy="${ay}" r="5" class="sym"/>`;
      case 'key': return `<circle cx="${ax - 7}" cy="${ay}" r="3.5" class="sym"/><line x1="${ax - 3.5}" y1="${ay}" x2="${ax}" y2="${ay}" class="sym"/>`;
      default: return '';
    }
  }

  // draws one pole of a switching symbol at x between ys..ye (36)
  function poleSym(t, x, ys, ye, col, e) {
    let s = '';
    const top = ys + 9, piv = ye - 9;
    const wireTop = L(x, ys, x, top, col), wireBot = L(x, piv, x, ye, col);
    switch (t) {
      case 'cb': case 'rcbo': case 'isol': case 'km': case 'no': case 'sw': case 'plcout':
        s += wireTop + wireBot + L(x, piv, x - 11, top + 1, '', 'sym');
        if (t === 'cb' || t === 'rcbo') s += L(x - 3.5, top - 3.5, x + 3.5, top + 3.5, '', 'sym') + L(x + 3.5, top - 3.5, x - 3.5, top + 3.5, '', 'sym');
        if (t === 'isol') s += L(x - 4, top, x + 4, top, '', 'sym');
        if (t === 'km') s += `<path d="M${x},${top} a3.5,3.5 0 0 0 0,7" class="sym"/>`;
        if (t === 'sw') s += `<circle cx="${x}" cy="${piv}" r="2.2" class="sym fillw"/>`;
        return s;
      case 'nc':
        return wireTop + wireBot + L(x, top, x + 9, top, '', 'sym') + L(x, piv, x + 11, top - 4, '', 'sym');
      case 'fuse':
        return L(x, ys, x, ye, col) + `<rect x="${x - 5}" y="${ys + 5}" width="10" height="${ye - ys - 10}" class="sym fillw"/>` + L(x, ys + 5, x, ye - 5, '', 'sym');
      case 'ol':
        return L(x, ys, x, ys + 6, col) + L(x, ye - 6, x, ye, col) + `<rect x="${x - 6}" y="${ys + 6}" width="12" height="${ye - ys - 12}" class="sym fillw"/>` +
          `<polyline points="${x},${ys + 6} ${x},${ys + 13} ${x + 4},${ys + 13} ${x + 4},${ye - 13} ${x},${ye - 13} ${x},${ye - 6}" class="sym"/>`;
    }
    return s;
  }

  // ---------- draw element ----------
  function drawEl(e, X, y, n, Tn, Bn, C) {
    const d = DEF[e.t] || DEF.box2, m = e._m, span = (n - 1) * PS, h = m.h;
    const sec = C.sec, kind = sec.kind, pn = sec.poles;
    const dt = defTerms(e, n, pn);
    const tt = e.tt && e.tt.length ? e.tt : dt.tt, bt = e.bt && e.bt.length ? e.bt : dt.bt;
    const ttag = e.ttag || e.tag, btag = e.btag || e.tag;
    const ys = y + STUB, ye = y + h - STUB;
    const col = p => wireColor(kind, pn[p], C.color);
    let s = '';
    const tagX = X + span + 20 + (e.t === 'sw2' ? 14 : 0) + (/^(plcin|psu|box2)$/.test(e.t) ? 6 : 0) + ((e.t === 'motor' || e.t === 'motor6') ? Math.max(0, 26 - span / 2) : 0);
    const label = (yy) => (e.tag ? T(tagX, yy, e.tag, 'tag') : '') + (e.lbl && !/^(plcin|vfdin)$/.test(e.t) ? TW(tagX, yy + 12, e.lbl, 'lbl', 21, 10.5) : '');
    const addTop = p => { if (!d.start) { C.net.term(Tn, p, ttag, tt[p], X + p * PS, y, C.si); } };
    const addBot = p => { if (!d.end) { C.net.term(Bn, p, btag, bt[p], X + p * PS, y + h, C.si); } };
    const tn = (p, top) => { if (!C.termNums) return ''; const xx = X + p * PS - 3; return top ? T(xx, ys - 1, tt[p], 'tn', 'end') : T(xx, ye + 9, bt[p], 'tn', 'end'); };

    switch (e.t) {
      case 'cb': case 'rcbo': case 'isol': case 'km': case 'fuse': case 'ol': case 'no': case 'nc': case 'sw': case 'plcout': {
        for (let p = 0; p < n; p++) {
          const x = X + p * PS;
          s += L(x, y, x, ys, col(p)) + L(x, ye, x, y + h, col(p));
          s += poleSym(e.t, x, ys, ye, col(p), e);
          s += tn(p, 1) + tn(p, 0); addTop(p); addBot(p);
        }
        const my = ys + 18;
        if (n > 1 && /cb|rcbo|isol|km/.test(e.t)) s += L(X - 6, my, X + span - 6, my, '', 'mech');
        if (e.t === 'rcbo') s += `<ellipse cx="${X - 16}" cy="${my}" rx="6" ry="4" class="sym"/>` + L(X - 10, my, X - 6, my, '', 'mech') + T(X - 16, my + 15, 'IΔn', 'tn', 'middle');
        if (e.t === 'cb') s += `<rect x="${X - 22}" y="${my - 5}" width="8" height="10" class="sym fillw"/>` + L(X - 14, my, X - 6, my, '', 'mech');
        if (e.act && (e.t === 'no' || e.t === 'nc')) { const bx = e.t === 'no' ? X - 5.5 : X + 5.5, by = e.t === 'no' ? my - 1 : my - 3; s += L(bx, by, X - 20, by, '', 'mech') + actuator(e.act, X - 20, by); }
        if (e.t === 'plcout') s += `<rect x="${X - 17}" y="${ys + 2}" width="${30}" height="${ye - ys - 4}" class="mech" fill="none"/>`;
        s += label(ys + 14);
        break;
      }
      case 'coil': case 'tcoil': case 'psu': case 'plcin': case 'box2': case 'lamp': case 'sock': case 'sensor': {
        const x = X;
        s += L(x, y, x, ys + 9, col(0)) + L(x, ye - 9, x, y + h, col(0));
        if (e.t === 'lamp') { s += L(x, ys + 9, x, ys + 8, col(0)) + `<circle cx="${x}" cy="${ys + 18}" r="10" class="sym fillw"/>` + L(x - 7, ys + 11, x + 7, ys + 25, '', 'sym') + L(x + 7, ys + 11, x - 7, ys + 25, '', 'sym'); }
        else if (e.t === 'sock') { s += `<path d="M${x - 11},${ys + 13} A11,11 0 0 0 ${x + 11},${ys + 13}" class="sym"/>` + L(x - 11, ys + 13, x + 11, ys + 13, '', 'sym') + L(x, ys + 9, x, ys + 13, col(0)) + L(x, ys + 24, x, ye - 9, col(0)); }
        else if (e.t === 'sensor') { s += `<rect x="${x - 13}" y="${ys + 7}" width="26" height="22" class="sym fillw"/><path d="M${x - 7},${ys + 18} L${x},${ys + 11} L${x + 7},${ys + 18} L${x},${ys + 25} Z" class="sym"/>`; }
        else {
          const wdt = e.t === 'coil' || e.t === 'tcoil' ? 28 : 36;
          s += `<rect x="${x - wdt / 2}" y="${ys + 8}" width="${wdt}" height="${ye - ys - 16}" class="sym fillw"/>`;
          if (e.t === 'tcoil') s += `<rect x="${x - 14}" y="${ys + 8}" width="9" height="${ye - ys - 16}" class="sym"/>` + L(x - 14, ys + 8, x - 5, ye - 8, '', 'sym') + L(x - 5, ys + 8, x - 14, ye - 8, '', 'sym');
          const inner = e.t === 'psu' ? 'AC/DC' : e.t === 'plcin' ? (e.lbl || 'I') : e.t === 'box2' ? (e.tag || '') : '';
          if (inner) s += T(x, ys + 21.5, inner.slice(0, 7), 'inbox', 'middle');
        }
        s += tn(0, 1) + tn(0, 0); addTop(0); addBot(0);
        s += label(ys + 14);
        break;
      }
      case 'vfd': {
        for (let p = 0; p < n; p++) { const x = X + p * PS; s += L(x, y, x, ys + 4, col(p)) + L(x, ye - 4, x, y + h, col(p)) + tn(p, 1) + tn(p, 0); addTop(p); addBot(p); }
        s += `<rect x="${X - 14}" y="${ys + 4}" width="${span + 28}" height="${ye - ys - 8}" class="sym fillw"/>` + L(X - 14, ye - 4, X + span + 14, ys + 4, '', 'thin') +
          T(X - 8, ys + 18, '~', 'inbox') + T(X + span + 8, ye - 8, '~', 'inbox', 'end');
        s += label(ys + 16);
        break;
      }
      case 'swap': {
        const pm = e.swap || [0, 2]; const perm = [...Array(n).keys()]; perm[pm[0]] = pm[1]; perm[pm[1]] = pm[0];
        for (let p = 0; p < n; p++) { s += `<polyline points="${X + p * PS},${y} ${X + p * PS},${y + 10} ${X + perm[p] * PS},${y + h - 10} ${X + perm[p] * PS},${y + h}" fill="none" stroke="${col(p)}"/>`; C.net.wire(C.net.key(Tn, p), C.net.key(Bn, perm[p])); }
        s += T(tagX, y + h / 2 + 3, e.lbl || 'Đảo 2 pha', 'lbl');
        break;
      }
      case 'sw2': {
        const x = X, a = ys + 6, b = ye - 6, l = x - 13, r = x + 13;
        s += L(x, y, x, a, col(0)) + L(x, b, x, y + h, col(0));
        s += `<circle cx="${x}" cy="${a}" r="2" class="sym fillw"/>` + L(x, a, l + 1, a + 18, '', 'sym') + L(l, a + 18, l, b - 18, col(0)) + L(r, a + 18, r, b - 18, col(0)) +
          L(l - 3, a + 18, l + 3, a + 18, '', 'sym') + L(r - 3, a + 18, r + 3, a + 18, '', 'sym') + L(l - 3, b - 18, l + 3, b - 18, '', 'sym') + L(r - 3, b - 18, r + 3, b - 18, '', 'sym') +
          `<circle cx="${x}" cy="${b}" r="2" class="sym fillw"/>` + L(x, b, r - 1, b - 18, '', 'sym') +
          T(l - 4, (a + b) / 2, 'T1', 'tn', 'end') + T(r + 4, (a + b) / 2, 'T2', 'tn');
        if (C.termNums) s += T(x - 4, a - 3, 'COM', 'tn', 'end') + T(x - 4, b + 10, 'COM', 'tn', 'end');
        s += T(tagX, a + 10, e.ttag || 'S1', 'tag') + T(tagX, b, e.btag || 'S2', 'tag') + TW(tagX, (a + b) / 2 + 2, e.lbl || 'Công tắc 2 chiều', 'lbl', 17, 10.5);
        addTop(0); addBot(0);
        break;
      }
      case 'motor': case 'motor6': {
        const cx = X + span / 2, cy = y + STUB + 36, r = 22;
        for (let p = 0; p < n; p++) { const x = X + p * PS; s += `<polyline points="${x},${y} ${x},${y + STUB + 4} ${cx + (x - cx) * 0.45},${cy - r + 2}" fill="none" stroke="${col(p)}"/>` + (C.termNums ? T(x - 3, y + STUB + 2, tt[p], 'tn', 'end') : ''); addTop(p); }
        s += `<circle cx="${cx}" cy="${cy}" r="${r}" class="sym fillw"/>` + T(cx, cy + 1, 'M', 'motorM', 'middle') + T(cx, cy + 13, e.t === 'motor6' ? '3~ Y/Δ' : (n === 1 ? '1~' : '3~'), 'tn', 'middle');
        if (e.t === 'motor6') s += T(cx, cy + r + 13, 'W2 · U2 · V2', 'tn', 'middle');
        s += L(cx - r * 0.7, cy + r * 0.7, cx - r * 0.7 - 8, cy + r * 0.7 + 8, 'var(--w-pe)') + T(cx - r * 0.7 - 10, cy + r * 0.7 + 16, 'PE', 'tn', 'end');
        s += label(cy - 6);
        break;
      }
      case 'load': case 'vfdin': case 'meter': case 'spd': case 'short': {
        const bottom = y + (e.t === 'short' ? 22 : 30);
        for (let p = 0; p < n; p++) { const x = X + p * PS; s += L(x, y, x, bottom, col(p)) + (C.termNums && e.t !== 'short' && e.t !== 'load' ? T(x - 3, y + 12, tt[p], 'tn', 'end') : ''); if (e.t !== 'short') addTop(p); else C.net.key(Tn, p); }
        if (e.t === 'load') { for (let p = 0; p < n; p++) { const x = X + p * PS; s += `<path d="M${x - 4},${bottom - 6} L${x},${bottom} L${x + 4},${bottom - 6}" class="sym"/>`; } s += (e.tag ? T(X - 4, bottom + 13, e.tag, 'tag') : '') + TW(X - 4, bottom + 25, e.lbl || '', 'lbl', 12 + n * 3, 10.5); }
        if (e.t === 'short') { s += L(X, bottom, X + span, bottom, col(0)) + `<circle cx="${X + span / 2}" cy="${bottom}" r="2.6" class="dot"/>` + T(X + span / 2, bottom + 14, e.lbl || 'Điểm sao', 'lbl', 'middle'); for (let p = 1; p < n; p++) C.net.wire(C.net.key(Tn, 0), C.net.key(Tn, p)); }
        if (e.t === 'vfdin') s += `<rect x="${X - 18}" y="${bottom}" width="36" height="18" class="sym fillw"/>` + T(X, bottom + 12.5, (e.lbl || 'DI').slice(0, 6), 'inbox', 'middle') + (e.tag ? T(X + 22, bottom + 13, e.tag, 'tag') : '');
        if (e.t === 'meter' || e.t === 'spd') {
          s += `<rect x="${X - 12}" y="${bottom}" width="${span + 24}" height="22" class="sym fillw"/>` + T(X + span / 2, bottom + 15, e.t === 'meter' ? 'kWh' : '', 'inbox', 'middle');
          if (e.t === 'spd') s += `<path d="M${X + span / 2 - 7},${bottom + 17} L${X + span / 2 + 5},${bottom + 5} m-4,0 h4 v4" class="sym"/>` + L(X + span / 2, bottom + 22, X + span / 2, bottom + 30, 'var(--w-pe)') + L(X + span / 2 - 8, bottom + 30, X + span / 2 + 8, bottom + 30, '', 'sym') + L(X + span / 2 - 5, bottom + 33, X + span / 2 + 5, bottom + 33, '', 'sym') + L(X + span / 2 - 2, bottom + 36, X + span / 2 + 2, bottom + 36, '', 'sym');
          s += label(bottom - 8);
        }
        break;
      }
      case 'from': {
        s += T(X - 6, y + 8, (e.tag ? e.tag + ' · ' : '') + (e.lbl || ''), 'lbl');
        for (let p = 0; p < n; p++) { const x = X + p * PS; s += `<circle cx="${x}" cy="${y + 22}" r="2.6" class="sym fillw"/>` + L(x, y + 24.6, x, y + h, col(p)) + T(x - 4, y + 34, bt[p], 'tn', 'end'); addBot(p); }
        break;
      }
      case 'src': {
        const cx = X + span / 2;
        s += `<circle cx="${cx}" cy="${y + 15}" r="11" class="sym fillw"/>` + `<path d="M${cx - 6},${y + 15} q3,-6 6,0 t6,0" class="sym"/>`;
        for (let p = 0; p < n; p++) { const x = X + p * PS; s += `<polyline points="${cx},${y + 26} ${x},${y + 40} ${x},${y + h}" fill="none" stroke="${col(p)}"/>` + (C.termNums ? T(x - 3, y + h - 4, bt[p], 'tn', 'end') : ''); addBot(p); }
        s += label(y + 14);
        break;
      }
    }
    if (e.links) e.links.forEach(l => C.net.links.push({ a: l[0], b: l[1], note: l[2] || '', sec: C.si }));
    return s;
  }

  // ---------- draw tree ----------
  function draw(nd, X, y, n, Tn, Bn, C) {
    if (Array.isArray(nd)) {
      if (!nd.length) { let s = ''; for (let p = 0; p < n; p++) { s += L(X + p * PS, y, X + p * PS, y + nd._m.h, wireColor(C.sec.kind, C.sec.poles[p], C.color)); C.net.wire(C.net.key(Tn, p), C.net.key(Bn, p)); } return s; }
      let s = '', cur = Tn;
      nd.forEach((c, i) => { const nb = i === nd.length - 1 ? Bn : C.net.node(); s += draw(c, X, y, n, cur, nb, C); y += c._m.h; cur = nb; });
      return s;
    }
    if (nd.par) return drawPar(nd, X, y, n, Tn, Bn, C);
    return drawEl(nd, X, y, n, Tn, Bn, C);
  }

  function drawPar(nd, X, y, n, Tn, Bn, C) {
    const m = nd._m, bh = busH(n), left = X - m.sx;
    let s = '', bx = left;
    const spines = m.ms.map(bm => { const sp = bx + bm.sx; bx += bm.w + GAP; return sp; });
    const col = p => wireColor(C.sec.kind, C.sec.poles[p], C.color);
    const yTopBus = p => y + 7 + p * BS, by0 = y + (m.ot ? 0 : bh);
    const innerH = m.h - (m.ot ? 0 : bh) - (m.ob ? 0 : bh), yBotBus = p => by0 + innerH + 7 + p * BS;
    const rail = nd._rail;
    if (!m.ot) for (let p = 0; p < n; p++) {
      const x1 = rail ? rail.x1 : spines[0] + p * PS, x2 = rail ? rail.x2 : spines[spines.length - 1] + p * PS;
      s += L(x1, yTopBus(p), x2, yTopBus(p), col(p), rail ? 'rail' : '');
      if (!rail) s += L(spines[0] + p * PS, y, spines[0] + p * PS, yTopBus(p), col(p));
      if (rail) s += T(x1 - 4, yTopBus(p) + 3.5, C.sec.poles[p], 'railt', 'end');
      spines.forEach((sp, b) => { s += L(sp + p * PS, yTopBus(p), sp + p * PS, by0, col(p)); if (spines.length > 1 || rail) s += `<circle cx="${sp + p * PS}" cy="${yTopBus(p)}" r="2.4" class="dot"/>`; });
    }
    if (!m.ob) for (let p = 0; p < n; p++) {
      const r2 = nd._railB;
      const x1 = r2 ? r2.x1 : spines[0] + p * PS, x2 = r2 ? r2.x2 : spines[spines.length - 1] + p * PS;
      s += L(x1, yBotBus(p), x2, yBotBus(p), col(p), r2 ? 'rail' : '');
      if (!r2) s += L(spines[0] + p * PS, yBotBus(p), spines[0] + p * PS, y + m.h, col(p));
      if (r2) s += T(x1 - 4, yBotBus(p) + 3.5, C.sec.bpoles ? C.sec.bpoles[p] : C.sec.poles[p], 'railt', 'end');
      spines.forEach(sp => { if (spines.length > 1 || r2) s += `<circle cx="${sp + p * PS}" cy="${yBotBus(p)}" r="2.4" class="dot"/>`; });
    }
    nd.par.forEach((br, b) => {
      const bm = m.ms[b];
      const bt = m.ot ? C.net.node() : Tn;
      const bb = m.ob ? C.net.node() : Bn;
      s += draw(br, spines[b], by0, n, bt, bb, C);
      if (!m.ob) for (let p = 0; p < n; p++) s += L(spines[b] + p * PS, by0 + bm.h, spines[b] + p * PS, yBotBus(p), col(p));
    });
    return s;
  }

  // ---------- section & sheet ----------
  function render(model, opt) {
    opt = Object.assign({ color: true, termNums: true, wireNums: true }, opt || {});
    const net = Net();
    const secs = model.sections || [];
    let x = 24, body = '', maxH = 0;
    const placed = [];
    secs.forEach((sec, si) => {
      const n = sec.poles.length;
      const series = Array.isArray(sec.net) ? sec.net : [sec.net];
      const m = meas(series, n);
      const first = series[0], last = series[series.length - 1];
      const mergeT = sec.top && first && first.par && !(first.open === 'top' || first.open === 'both');
      const mergeB = sec.bottom && last && last.par && !(last.open === 'bottom' || last.open === 'both');
      const railT = sec.top && !mergeT ? busH(n) : 0, railB = sec.bottom && !mergeB ? busH(n) : 0;
      const w = SEC_PAD_L + m.w + SEC_PAD_R, h = 40 + railT + m.h + railB + 20;
      placed.push({ sec, si, n, series, m, mergeT, mergeB, railT, railB, x, w, h });
      x += w; maxH = Math.max(maxH, h);
    });
    const C0 = { net, color: opt.color, termNums: opt.termNums };
    placed.forEach(P => {
      const { sec, si, n, series, m } = P;
      const C = Object.assign({}, C0, { sec, si });
      const X = P.x + SEC_PAD_L + m.sx, x1 = P.x + 30, x2 = P.x + P.w - 8;
      let y = 54;
      const TOP = net.node(), BOT = net.node();
      for (let p = 0; p < n; p++) { if (sec.top) net.rail(TOP, p, sec.poles[p]); if (sec.bottom) net.rail(BOT, p, (sec.bpoles || sec.poles)[p]); }
      body += `<g class="sec">` + T(P.x + 12, 34, sec.title || '', 'sect') + (si > 0 ? L(P.x, 18, P.x, maxH + 28, '', 'divider') : '');
      if (P.mergeT) series[0]._rail = { x1, x2 }; else if (sec.top) {
        for (let p = 0; p < n; p++) { const c = wireColor(sec.kind, sec.poles[p], opt.color); body += L(x1, y + 7 + p * BS, x2, y + 7 + p * BS, c, 'rail') + T(x1 - 4, y + 10.5 + p * BS, sec.poles[p], 'railt', 'end') + L(X + p * PS, y + 7 + p * BS, X + p * PS, y + P.railT, c) + `<circle cx="${X + p * PS}" cy="${y + 7 + p * BS}" r="2.4" class="dot"/>`; }
        y += P.railT;
      }
      if (P.mergeB) series[series.length - 1]._railB = { x1, x2 };
      const yEnd = y + m.h;
      body += draw(series, X, y, n, TOP, BOT, C);
      if (sec.bottom && !P.mergeB) {
        for (let p = 0; p < n; p++) { const c = wireColor(sec.kind, sec.poles[p], opt.color), yy = yEnd + 7 + p * BS; body += L(x1, yy, x2, yy, c, 'rail') + T(x1 - 4, yy + 3.5, (sec.bpoles || sec.poles)[p], 'railt', 'end') + L(X + p * PS, yEnd, X + p * PS, yy, c) + `<circle cx="${X + p * PS}" cy="${yy}" r="2.4" class="dot"/>`; }
      }
      body += `</g>`;
    });
    const wires = net.build(secs);
    let wn = '';
    if (opt.wireNums) wires.forEach(w => { if (w.rail || !w.pos) return; if (w.kind === 'power') return; wn += `<g class="wn"><rect x="${w.pos.x + 4}" y="${w.pos.y - 6}" width="${8 + String(w.name).length * 6}" height="12" rx="6"/>${T(w.pos.x + 8, w.pos.y + 3.5, w.name, '')}</g>`; });
    // frame
    const W = Math.max(x + 24, 560), H = maxH + 40 + 96;
    const tbW = 330, tbX = W - tbW - 16, tbY = H - 88;
    let cols = ''; const step = 120; for (let i = 0; i * step < W - 30; i++) cols += T(16 + i * step + step / 2, 12, String(i + 1), 'grid', 'middle') + (i ? L(16 + i * step, 4, 16 + i * step, 16, '', 'thin') : '');
    const tb = `<g class="tb"><rect x="${tbX}" y="${tbY}" width="${tbW}" height="72" class="frame"/>` + L(tbX, tbY + 26, tbX + tbW, tbY + 26, '', 'thin') + L(tbX, tbY + 49, tbX + tbW, tbY + 49, '', 'thin') + L(tbX + 220, tbY + 26, tbX + 220, tbY + 72, '', 'thin') +
      T(tbX + 8, tbY + 18, model.title || 'Sơ đồ mạch', 'tbt') + T(tbX + 8, tbY + 41, 'Tiêu chuẩn ký hiệu: IEC 60617', 'tbs') + T(tbX + 8, tbY + 64, 'Ngày: ' + (opt.date || ''), 'tbs') +
      T(tbX + 228, tbY + 41, 'Bản vẽ: 01/01', 'tbs') + T(tbX + 228, tbY + 64, 'Xưởng Vẽ Mạch', 'tbs') + `</g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="sheet" font-family="Barlow, Arial, sans-serif">` +
      `<style>${SCOPED_CSS}</style><rect x="0" y="0" width="${W}" height="${H}" class="paper"/><rect x="8" y="16" width="${W - 16}" height="${H - 24}" class="frame"/>${cols}` +
      `<g transform="translate(0,6)">${body}${wn}</g>${tb}</svg>`;
    return { svg, wires, links: net.links, W, H };
  }

  const SVG_CSS = `.paper{fill:var(--paper,#fff)}.frame{fill:none;stroke:var(--ink,#1b1f23);stroke-width:1.2}line,polyline{stroke-width:1.6;stroke-linecap:round;fill:none}
.sym{stroke:var(--ink,#1b1f23);stroke-width:1.6;fill:none;stroke-linecap:round;stroke-linejoin:round}.fillw{fill:var(--paper,#fff)}.fillr{fill:var(--red,#d62718)}
line.sym{stroke:var(--ink,#1b1f23)}.mech{stroke:var(--ink,#1b1f23);stroke-width:1;stroke-dasharray:3 3}.thin{stroke:var(--ink,#1b1f23);stroke-width:.8}
.rail{stroke-width:2.2}.dot{fill:var(--ink,#1b1f23)}.divider{stroke:var(--grid,#c9cdd1);stroke-width:1;stroke-dasharray:2 4}
text{fill:var(--ink,#1b1f23);font-size:10px}.tag{font-weight:700;font-size:12px}.lbl{font-size:9.5px;fill:var(--ink2,#4a5258)}.tn{font-size:8.5px;fill:var(--ink2,#4a5258)}
.inbox{font-size:9px;font-weight:600}.motorM{font-size:15px;font-weight:700;text-anchor:middle}.railt{font-weight:700;font-size:10.5px}.sect{font-weight:700;font-size:13px;letter-spacing:.02em}
.grid{font-size:8px;fill:var(--ink2,#4a5258)}.tbt{font-weight:700;font-size:12px}.tbs{font-size:9.5px}
.wn rect{fill:var(--paper,#fff);stroke:var(--accent,#c47f00);stroke-width:1}.wn text{font-size:8.5px;font-weight:700;fill:var(--accent,#c47f00)}`;

  const SCOPED_CSS = SVG_CSS.replace(/\n/g, '').split('}').filter(r => r.trim()).map(r => { const i = r.indexOf('{'); return r.slice(0, i).split(',').map(s => '.sheet ' + s.trim()).join(',') + r.slice(i) + '}'; }).join('');

  // ---------- validate AI/custom model ----------
  function sanitize(model) {
    const out = { title: String(model.title || 'Sơ đồ theo mô tả').slice(0, 80), sections: [] };
    const fixEl = e => {
      if (Array.isArray(e)) return e.map(fixEl).filter(Boolean);
      if (!e || typeof e !== 'object') return null;
      if (e.par) { const br = (Array.isArray(e.par) ? e.par : []).map(b => fixEl(Array.isArray(b) ? b : [b])).filter(b => b); if (!br.length) return null; return { par: br.slice(0, 12), open: ['top', 'bottom', 'both'].includes(e.open) ? e.open : undefined }; }
      const t = TYPES.includes(e.t) ? e.t : 'box2';
      const o = { t, tag: String(e.tag || '').slice(0, 10), lbl: String(e.lbl || '').slice(0, 60) };
      if (e.act) o.act = String(e.act);
      ['tt', 'bt'].forEach(k => { if (Array.isArray(e[k])) o[k] = e[k].map(v => String(v).slice(0, 8)).slice(0, 4); });
      if (e.ttag) o.ttag = String(e.ttag).slice(0, 10); if (e.btag) o.btag = String(e.btag).slice(0, 10);
      if (Array.isArray(e.swap)) o.swap = e.swap.map(Number).slice(0, 2);
      if (Array.isArray(e.links)) o.links = e.links.filter(Array.isArray).map(l => l.map(v => String(v).slice(0, 40))).slice(0, 20);
      return o;
    };
    (model.sections || []).slice(0, 6).forEach(s => {
      const poles = (Array.isArray(s.poles) && s.poles.length ? s.poles : ['L']).map(p => String(p).slice(0, 6)).slice(0, 4);
      const net = fixEl(Array.isArray(s.net) ? s.net : [s.net]);
      if (!net || !net.length) return;
      out.sections.push({ title: String(s.title || '').slice(0, 50), kind: ['power', 'ac', 'dc', 'final'].includes(s.kind) ? s.kind : (poles.length > 1 ? 'power' : 'ac'), poles, bpoles: Array.isArray(s.bpoles) ? s.bpoles.map(p => String(p).slice(0, 6)) : undefined, top: !!s.top, bottom: !!s.bottom, net });
    });
    return out;
  }

  G.CircuitEngine = { render, sanitize, TYPES, esc };
})(typeof window !== 'undefined' ? window : globalThis);
