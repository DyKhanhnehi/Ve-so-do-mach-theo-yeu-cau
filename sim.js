/* Xưởng Vẽ Mạch — mô phỏng chạy thử mạch (logic tiếp điểm, cuộn hút, timer, rơ-le nhiệt, rơ-le xung).
   Làm việc trực tiếp trên mô hình sections/net (cây nối tiếp – song song). */
(function (G) {
  'use strict';
  let EID = 1;
  const LOADT = ['coil', 'tcoil', 'lamp', 'horn', 'm1', 'sol', 'heat', 'sock', 'box2', 'psu', 'plcin'];
  const ENDT = ['motor', 'motor6', 'load', 'vfdin', 'meter', 'spd', 'short'];
  const INACT = ['push', 'pushnc', 'estop', 'sel', 'sensor', 'limit', 'float', 'light', 'key'];
  const NAMES = { push: 'Nút nhấn', estop: 'Dừng khẩn', sel: 'Công tắc xoay', sensor: 'Cảm biến', limit: 'Hành trình', float: 'Phao', light: 'Cảm biến ánh sáng', key: 'Khoá', timer: 'Hẹn giờ' };

  function walkAll(model, fn) {
    const rec = (nd, sec, si) => {
      if (Array.isArray(nd)) { nd.forEach(c => rec(c, sec, si)); return; }
      if (nd.par) { if (nd._id == null) nd._id = EID++; fn(nd, sec, si, true); nd.par.forEach(b => rec(b, sec, si)); return; }
      if (nd._id == null) nd._id = EID++; fn(nd, sec, si, false);
    };
    (model.sections || []).forEach((s, si) => rec(Array.isArray(s.net) ? s.net : [s.net], s, si));
  }
  function parseSec(txt) {
    const m = String(txt || '').replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(giây|giay|s|phút|phut|giờ|gio|h)\b/i);
    if (!m) return 5;
    const v = parseFloat(m[1]), u = m[2].toLowerCase();
    return v * (/ph/.test(u) ? 60 : /gi[ờo]|^h$/.test(u) ? 3600 : 1);
  }

  function Sim(model) {
    this.model = model; this.els = []; this.pars = [];
    this.inp = {}; this.off = {}; this.trip = {}; this.coil = {}; this.imp = {}; this.prevCoil = {};
    this.t = {}; this.preset = {}; this.st = {}; this.log = []; this.clock = 0; this.runCmd = false;
    const coilTags = new Set(), tcoilTags = new Set(), olTags = new Set(), impTags = new Set();
    walkAll(model, (e, sec, si, isPar) => {
      if (isPar) { this.pars.push(e); return; }
      e._sec = si; this.els.push(e);
      if (e.t === 'coil' || e.t === 'tcoil' || e.t === 'km') { if (e.t !== 'km') coilTags.add(e.tag); }
      if (e.t === 'coil' && /xung/i.test(e.lbl || '')) impTags.add(e.tag);
      if (e.t === 'tcoil') { tcoilTags.add(e.tag); this.preset[e.tag] = parseSec(e.lbl); }
      if (e.t === 'ol') olTags.add(e.tag);
    });
    this.coilTags = coilTags; this.tcoilTags = tcoilTags; this.olTags = olTags; this.impTags = impTags;
    // các vị trí công tắc xoay theo tag
    this.selPos = {};
    this.els.forEach(e => { if (e.act === 'sel' && (e.t === 'no' || e.t === 'nc')) { const a = (this.selPos[e.tag] = this.selPos[e.tag] || []); const k = (e.tt && e.tt[0]) || '13'; if (!a.includes(k)) a.push(k); } });
    // danh sách điều khiển cho bảng
    this.controls = [];
    const seen = new Set();
    const add = (key, kind, label, ids) => { if (seen.has(key)) { const c = this.controls.find(x => x.key === key); ids.forEach(i => c.ids.push(i)); return; } seen.add(key); this.controls.push({ key, kind, label, ids: [...ids] }); };
    this.els.forEach(e => {
      const k = this.inputKey(e); if (!k) return;
      if (k.startsWith('cb:')) add(k, 'cb', `${e.tag} ${e.lbl || ''}`.trim(), [e._id]);
      else if (k.startsWith('src:')) add(k, 'src', `${e.tag} ${e.lbl || ''}`.trim(), [e._id]);
      else if (k.startsWith('trip:')) add(k, 'trip', `${e.tag} — gây quá tải`, [e._id]);
      else if (e.act === 'sel') add(k, 'sel', `${e.tag} ${NAMES.sel}`, [e._id]);
      else if (e.act === 'push' && e.t === 'no' || e.act === 'push' && e.t === 'nc') add(k, 'push', `${e.tag} ${e.t === 'nc' && !this.els.some(x => x.tag === e.tag && x.t === 'no' && x.act === 'push') ? (e.lbl || 'Dừng') : (e.lbl || 'Nút')}`, [e._id]);
      else if (e.t === 'sw2') { add('sw:' + e.ttag, 'tog', `${e.ttag} công tắc 2 chiều`, [e._id]); add('sw:' + e.btag, 'tog', `${e.btag} công tắc 2 chiều`, [e._id]); }
      else add(k, e.act === 'estop' ? 'estop' : 'tog', `${e.tag || ''} ${e.act && NAMES[e.act] && !/(cảm biến|phao|hành trình|hẹn|dừng khẩn)/i.test(e.lbl || '') ? NAMES[e.act] + ' — ' : ''}${e.lbl || NAMES[e.act] || ''}`.trim(), [e._id]);
    });
    this.controls.sort((a, b) => ({ cb: 3, src: 2, trip: 4 }[a.kind] || 0) - ({ cb: 3, src: 2, trip: 4 }[b.kind] || 0));
    this.evaluate(true);
  }

  // khoá trạng thái ngõ vào của một phần tử (null nếu không phải ngõ vào)
  Sim.prototype.inputKey = function (e) {
    if (['cb', 'rcbo', 'isol', 'fuse'].includes(e.t)) return 'cb:' + e._id;
    if (e.t === 'src') return 'src:' + e._id;
    if (e.t === 'sw') return 'sw:' + e.tag;
    if (e.t === 'sw2') return 'sw2';
    if (e.t === 'plcout') return 'out:' + e.tag + ':' + ((e.bt && e.bt[0]) || e.lbl);
    if (e.t !== 'no' && e.t !== 'nc') return null;
    if (e.act === 'thermal') return 'trip:' + e.tag;
    if (e.act === 'timer' && this.tcoilTags.has(e.tag)) return null;
    if (e.act === 'sel') return 'sel:' + e.tag;
    if (e.act && INACT.concat(['timer']).includes(e.act)) return 'in:' + e.tag;
    if (this.coilTags.has(e.tag)) return null;
    return 'in:' + e.tag + ':' + ((e.tt && e.tt[0]) || '');
  };
  Sim.prototype.closed = function (e) {
    const k = this.inputKey(e);
    switch (e.t) {
      case 'cb': case 'rcbo': case 'isol': case 'fuse': return !this.off[k];
      case 'src': return !this.off[k];
      case 'km': return !!this.coilState(e.tag);
      case 'sw': return !!this.inp[k];
      case 'sw2': return !!this.inp['sw:' + e.ttag] === !!this.inp['sw:' + e.btag];
      case 'plcout': return !!this.inp[k];
      case 'vfd': return this.runCmd;
      case 'no': case 'nc': {
        let act;
        if (e.act === 'thermal') act = !!this.trip['trip:' + e.tag];
        else if (e.act === 'timer' && this.tcoilTags.has(e.tag)) act = this.t[e.tag] != null && this.t[e.tag] >= this.preset[e.tag];
        else if (e.act === 'sel') { const pos = this.inp[k] || 0; const idx = (this.selPos[e.tag] || []).indexOf((e.tt && e.tt[0]) || '13'); act = pos === idx + 1; }
        else if (k == null) act = !!this.coilState(e.tag);
        else act = !!this.inp[k];
        return e.t === 'no' ? act : !act;
      }
      default: return true; // tải, dây, đảo pha, nối tắt…
    }
  };
  Sim.prototype.coilState = function (tag) { return this.impTags.has(tag) ? !!this.imp[tag] : !!this.coil[tag]; };

  // lan truyền: pin = có điện từ phía trên; gnd = thông tới thanh dưới
  Sim.prototype.pass = function () {
    const st = {};
    const down = (nd, p) => {
      if (Array.isArray(nd)) { let cur = p; nd.forEach(c => { cur = down(c, cur); }); return cur; }
      if (nd.par) { const s = (st[nd._id] = st[nd._id] || {}); s.pin = p; let out = false; nd.par.forEach(b => { const o = down(b, nd.open === 'top' || nd.open === 'both' ? false : p); out = out || o; }); s.pout = out; return out; }
      const s = (st[nd._id] = st[nd._id] || {});
      if (nd.t === 'src' || nd.t === 'from') { s.pin = false; s.pout = nd.t === 'src' && this.closed(nd); s.closed = s.pout; return s.pout; }
      s.pin = p; s.closed = this.closed(nd); s.pout = p && s.closed && !ENDT.includes(nd.t);
      if (ENDT.includes(nd.t)) s.pout = false;
      return s.pout;
    };
    const up = (nd, g) => {
      if (Array.isArray(nd)) { let cur = g; for (let i = nd.length - 1; i >= 0; i--) cur = up(nd[i], cur); return cur; }
      if (nd.par) { const s = st[nd._id]; s.gout = g; let any = false; nd.par.forEach(b => { const o = up(b, nd.open === 'bottom' || nd.open === 'both' ? false : g); any = any || o; }); s.gin = any; return any; }
      const s = st[nd._id]; s.gb = g; s.gt = g && s.closed && !ENDT.includes(nd.t) && nd.t !== 'src' && nd.t !== 'from'; return s.gt;
    };
    (this.model.sections || []).forEach(sec => {
      const net = Array.isArray(sec.net) ? sec.net : [sec.net];
      down(net, !!sec.top);
      up(net, !!sec.bottom);
    });
    this.els.forEach(e => { const s = st[e._id]; if (!s) return; s.on = LOADT.includes(e.t) ? !!(s.pin && s.gb) : ENDT.includes(e.t) ? !!s.pin : false; });
    return st;
  };
  Sim.prototype.evaluate = function (silent) {
    let st;
    for (let i = 0; i < 25; i++) {
      st = this.pass();
      const nc = {};
      this.els.forEach(e => { if ((e.t === 'coil' || e.t === 'tcoil') && st[e._id] && st[e._id].on) nc[e.tag] = true; });
      // rơ-le xung: đổi trạng thái ở sườn lên
      this.impTags.forEach(tag => { if (nc[tag] && !this.prevCoil[tag]) this.imp[tag] = !this.imp[tag]; });
      const run = this.els.some(e => e.t === 'vfdin' && /DI1|DI2/.test(e.lbl || '') && st[e._id] && st[e._id].on);
      const changed = Object.keys({ ...nc, ...this.coil }).some(k => !!nc[k] !== !!this.coil[k]) || run !== this.runCmd;
      if (!silent) Object.keys({ ...nc, ...this.coil }).forEach(k => { if (!!nc[k] !== !!this.coil[k] && !this.impTags.has(k)) this.addLog(`${k} ${nc[k] ? 'có điện (hút)' : 'mất điện (nhả)'}`); });
      this.impTags.forEach(tag => { if (nc[tag] && !this.prevCoil[tag] && !silent) this.addLog(`${tag} rơ-le xung → ${this.imp[tag] ? 'ĐÓNG' : 'MỞ'}`); });
      this.prevCoil = { ...nc };
      this.coil = nc; this.runCmd = run;
      // timer: bắt đầu đếm khi cuộn có điện
      this.tcoilTags.forEach(tag => { if (nc[tag]) { if (this.t[tag] == null) this.t[tag] = 0; } else this.t[tag] = null; });
      if (!changed) break;
    }
    // ghi nhận thay đổi tải để log
    const prevOn = this._on || {}; const on = {};
    this.els.forEach(e => { const s = st[e._id]; if (s && s.on && !['coil', 'tcoil'].includes(e.t)) on[e.tag + '|' + e.t] = e; });
    if (!silent) { Object.keys(on).forEach(k => { if (!prevOn[k]) this.addLog(`${on[k].tag} ${this.verb(on[k], true)}`); }); Object.keys(prevOn).forEach(k => { if (!on[k]) this.addLog(`${prevOn[k].tag} ${this.verb(prevOn[k], false)}`); }); }
    this._on = on;
    this.tcoilTags.forEach(tag => { this.els.filter(e => e.t === 'tcoil' && e.tag === tag).forEach(e => { if (st[e._id]) st[e._id].note = this.t[tag] != null ? `${fmt(Math.min(this.t[tag], this.preset[tag]))}/${fmt(this.preset[tag])}` : ''; }); });
    this.st = st;
    return st;
  };
  function fmt(s) { return s >= 120 ? (s / 60).toFixed(s % 60 ? 1 : 0) + ' ph' : (Math.round(s * 10) / 10) + ' s'; }
  Sim.prototype.verb = function (e, on) {
    const m = { lamp: ['sáng', 'tắt'], horn: ['kêu', 'tắt'], motor: ['quay', 'dừng'], motor6: ['quay', 'dừng'], m1: ['chạy', 'dừng'], sol: ['tác động', 'nhả'], heat: ['có điện', 'mất điện'], sock: ['có điện', 'mất điện'], vfdin: ['nhận lệnh ' + (e.lbl || ''), 'mất lệnh ' + (e.lbl || '')], plcin: ['ngõ vào ' + (e.lbl || '') + ' = 1', 'ngõ vào ' + (e.lbl || '') + ' = 0'], load: ['có điện', 'mất điện'] }[e.t] || ['có điện', 'mất điện'];
    return on ? m[0] : m[1];
  };
  Sim.prototype.addLog = function (msg) { this.log.unshift({ t: this.clock, msg }); if (this.log.length > 40) this.log.pop(); };
  Sim.prototype.tick = function (dt) {
    let any = false;
    this.clock += dt;
    this.tcoilTags.forEach(tag => {
      if (this.t[tag] != null) { const before = this.t[tag] >= this.preset[tag]; this.t[tag] += dt; any = true; if (!before && this.t[tag] >= this.preset[tag]) this.addLog(`${tag} hết thời gian ${fmt(this.preset[tag])} → tiếp điểm chuyển`); }
    });
    if (any) this.evaluate(false);
    return any;
  };
  Sim.prototype.timersRunning = function () { return [...this.tcoilTags].some(t => this.t[t] != null && this.t[t] < this.preset[t]); };
  // thao tác
  Sim.prototype.keyOfControl = function (c) { const e = this.els.find(x => x._id === c.ids[0]); if (c.key.startsWith('sw:')) return c.key; return this.inputKey(e); };
  Sim.prototype.act = function (key, kind, down) {
    if (kind === 'cb' || kind === 'src') { this.off[key] = !this.off[key]; this.addLog(`${this.labelOf(key)} ${this.off[key] ? 'CẮT' : 'ĐÓNG'}`); }
    else if (kind === 'trip') { this.trip[key] = !this.trip[key]; this.addLog(`${key.slice(5)} ${this.trip[key] ? 'quá tải — tác động' : 'đã reset'}`); }
    else if (kind === 'push') { this.inp[key] = !!down; if (down) this.addLog(`Nhấn ${key.split(':')[1]}`); }
    else if (kind === 'sel') { const tag = key.slice(4); const n = (this.selPos[tag] || []).length; this.inp[key] = ((this.inp[key] || 0) + 1) % (n + 1); this.addLog(`${tag} chuyển vị trí ${this.inp[key] === 0 ? '0' : this.inp[key]}`); }
    else { this.inp[key] = !this.inp[key]; this.addLog(`${key.split(':')[1]} ${this.inp[key] ? 'tác động' : 'trở về'}`); }
    this.evaluate(false);
  };
  Sim.prototype.labelOf = function (key) { const c = this.controls.find(x => x.key === key); return c ? c.label : key; };
  Sim.prototype.stateText = function (c) {
    const k = c.key;
    if (c.kind === 'cb' || c.kind === 'src') return this.off[k] ? 'CẮT' : 'ĐÓNG';
    if (c.kind === 'trip') return this.trip[k] ? 'QUÁ TẢI' : 'Bình thường';
    if (c.kind === 'sel') { const v = this.inp[k] || 0; if (!v) return 'Vị trí 0'; const tag = k.slice(4); const e = this.els.find(x => x.act === 'sel' && x.tag === tag && ((x.tt && x.tt[0]) || '13') === this.selPos[tag][v - 1]); return e && e.lbl ? e.lbl : 'Vị trí ' + v; }
    if (c.kind === 'push') return this.inp[k] ? 'ĐANG NHẤN' : 'Nhả';
    if (c.kind === 'estop') return this.inp[k] ? 'ĐANG ẤN' : 'Bình thường';
    return this.inp[k] ? 'TÁC ĐỘNG' : 'Không';
  };
  Sim.prototype.isActive = function (c) { const k = c.key; if (c.kind === 'cb' || c.kind === 'src') return !this.off[k]; if (c.kind === 'trip') return !!this.trip[k]; return !!this.inp[k]; };
  Sim.prototype.outputs = function () {
    const out = new Map();
    this.els.forEach(e => {
      if (!(LOADT.includes(e.t) || ['motor', 'motor6', 'vfdin', 'load'].includes(e.t)) || e.t === 'psu') return;
      const key = e.tag + '|' + e.t + '|' + (e.t === 'vfdin' || e.t === 'plcin' ? e.lbl : '');
      const s = this.st[e._id] || {};
      if (e.t === 'load' && this.els.some(x => (x.t === 'motor' || x.t === 'motor6') && x.tag === e.tag)) return;
      const o = out.get(key) || { tag: e.tag || (e.lbl || '—'), t: e.t, lbl: e.t === 'vfdin' || e.t === 'plcin' ? e.lbl : (e.tag ? (e.lbl || '') : ''), on: false, note: '' };
      o.on = o.on || !!s.on; if (s.note) o.note = s.note; out.set(key, o);
    });
    return [...out.values()];
  };
  G.CircuitSim = Sim;
})(typeof window !== 'undefined' ? window : globalThis);
