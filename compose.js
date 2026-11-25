/* Xưởng Vẽ Mạch — ghép mạch tự do từ mô tả (dân dụng + điều khiển), không ép theo mạch mẫu.
   Mỗi vế câu → một nhánh: [bảo vệ] → [điều kiện nối tiếp/song song] → [tải]. Chạy offline. */
(function (G) {
  'use strict';
  const WN = { mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7, tam: 8, chin: 9, muoi: 10 };
  const LOADS = [
    { k: 'pilot', re: /den bao|den tin hieu|den hien thi/, el: 'lamp', type: 'pilot', name: 'Đèn báo', W: 2, tag: 'H', ind: 1 },
    { k: 'tower', re: /den thap|den canh bao|den xoay|den chop/, el: 'lamp', type: 'horn', name: 'Đèn cảnh báo', W: 5, tag: 'H', ind: 1 },
    { k: 'bell', re: /chuong( cua)?|\bcoi\b|buzzer|loa bao/, el: 'horn', type: 'horn', name: 'Chuông / còi', W: 10, tag: 'HA' },
    { k: 'lock', re: /khoa (cua )?dien|chot dien|khoa tu|khoa cua/, el: 'sol', type: 'valve', name: 'Khoá điện từ', W: 12, tag: 'Y', ind: 1 },
    { k: 'valve', re: /van dien tu|van khi|van nuoc|solenoid|xi ?lanh|piston|\bvan\b(?! hanh| toc)/, el: 'sol', type: 'valve', name: 'Van điện từ', W: 10, tag: 'Y', ind: 1 },
    { k: 'heater', re: /binh nong lanh|may nuoc nong|binh nuoc nong|nong lanh|bep dien|bep tu|lo nuong|dien tro nhiet|thanh nhiet|may say/, el: 'heat', type: 'heater', name: 'Bình nóng lạnh / tải nhiệt', W: 2500, tag: 'E', home: 1 },
    { k: 'ac', re: /dieu hoa|may lanh/, el: 'box2', type: 'switch', name: 'Điều hòa', W: 1200, tag: 'E', home: 1 },
    { k: 'fan', re: /quat( tran| hut| thong gio| dung| treo| tuong)?/, el: 'm1', type: 'fan', name: 'Quạt', W: 75, tag: 'M', home: 1 },
    { k: 'pump', re: /may bom|bom nuoc|\bbom\b/, el: 'm1', type: 'fan', name: 'Bơm 1 pha', W: 750, tag: 'M', home: 1 },
    { k: 'conv', re: /bang tai|bang chuyen|dong co|motor|may khuay/, el: 'coil', type: 'contactor', name: 'Contactor', W: 0, tag: 'K', ind: 1 },
    { k: 'sock', re: /\bo cam\b/, el: 'sock', type: 'switch', name: 'Ổ cắm', W: 2000, tag: 'X', home: 1 },
    { k: 'lamp', re: /bong den|den (led|tuyp|chum|ngu|tran|san|cong|hanh lang|nha|phong|bep|wc|ve sinh|cau thang|op tran|am tran|pha|duong)|\bden\b|\bbong\b/, el: 'lamp', type: 'lamp', name: 'Đèn', W: 40, tag: 'E', home: 1 }
  ];
  const INPUTS = [
    { k: 'sw2', re: /cong tac (2|hai) chieu|(2|hai) (noi|cho|vi tri)/, name: 'Công tắc 2 chiều' },
    { k: 'pbstop', re: /nut (dung|tat|stop|off)|nut nhan (dung|tat)/, el: 'nc', act: 'push', type: 'pb', name: 'Nút Dừng', tag: 'S' },
    { k: 'limit', re: /hanh trinh|limit|gioi han|cu chan/, el: 'no', act: 'limit', type: 'limit', name: 'Công tắc hành trình', tag: 'B' },
    { k: 'pir', re: /hong ngoai|chuyen dong|\bpir\b|co nguoi|nguoi (di qua|den|vao|di)|cam ung/, el: 'no', act: 'sensor', type: 'pir', name: 'Cảm biến chuyển động', tag: 'B' },
    { k: 'photo', re: /anh sang|troi toi|quang tro|photocell|hoang hon|ban dem/, el: 'no', act: 'light', type: 'photocell', name: 'Cảm biến ánh sáng', tag: 'B' },
    { k: 'door', re: /mo cua|cua mo|dong cua|cua dong|cong tac cua|cam bien cua|tu cua|cua tu/, el: 'no', act: 'limit', type: 'limit', name: 'Công tắc cửa', tag: 'B' },
    { k: 'smoke', re: /\bkhoi\b|dau bao chay|chuong bao chay|bao chay tu dong|ro ri gas|khi ga|\bgas\b/, el: 'no', act: 'sensor', type: 'smoke', name: 'Đầu báo khói/gas', tag: 'B' },
    { k: 'float', re: /phao|muc nuoc|nuoc day|day nuoc|het nuoc|can nuoc/, el: 'no', act: 'float', type: 'level', name: 'Phao / mực nước', tag: 'B' },
    { k: 'temp', re: /nhiet do|qua nhiet|nong qua|thermostat/, el: 'no', act: 'sensor', type: 'temp', name: 'Rơ-le nhiệt độ', tag: 'B' },
    { k: 'press', re: /ap suat|\bdu ap\b|\bap luc\b/, el: 'no', act: 'sensor', type: 'pressure', name: 'Công tắc áp suất', tag: 'B' },
    { k: 'clock', re: /hen gio|dong ho|theo gio|\btimer\b|theo lich/, el: 'no', act: 'timer', type: 'time_switch', name: 'Đồng hồ hẹn giờ', tag: 'B' },
    { k: 'sensor', re: /cam bien|sensor|tiem can|quang dien|phat hien|co vat|vat den|vat toi|cham/, el: 'no', act: 'sensor', type: 'sensor_photo', name: 'Cảm biến', tag: 'B' },
    { k: 'sel', re: /cong tac xoay|cong tac chon/, el: 'no', act: 'sel', type: 'sel', name: 'Công tắc xoay', tag: 'S' },
    { k: 'dimmer', re: /dimmer|chiet ap|dieu chinh do sang|hop so|dieu toc/, el: 'box2', type: 'dimmer', name: 'Dimmer / hộp số', tag: 'R' },
    { k: 'pb', re: /nut nhan|nut bam|\bnut\b|bam nut|an nut|\bnhan\b/, el: 'no', act: 'push', type: 'pb', name: 'Nút nhấn', tag: 'S' },
    { k: 'sw', re: /cong tac|cong tat|\bswitch\b/, el: 'sw', type: 'switch', name: 'Công tắc', tag: 'S' }
  ];
  const HOMEW = /\bnha\b|phong|can ho|gia dinh|dan dung|biet thu|nha bep|\bwc\b|ve sinh|hanh lang|san nha|cong nha|phong khach|phong ngu/;

  function mentions(c, dict) {
    const taken = [], out = [];
    dict.forEach(d => {
      const re = new RegExp(d.re.source, 'g'); let m;
      while ((m = re.exec(c))) {
        const a = m.index, b = a + m[0].length; if (!m[0].length) { re.lastIndex++; continue; }
        if (taken.some(([x, y]) => a < y && b > x)) continue;
        taken.push([a, b]); out.push({ d, a, b, qty: qtyBefore(c, a), W: wattAfter(c, b) });
      }
    });
    return out.sort((x, y) => x.a - y.a);
  }
  function qtyBefore(c, a) { const m = c.slice(Math.max(0, a - 16), a).match(/(\d+|mot|hai|ba|bon|nam|sau|bay|tam|chin|muoi)\s*(?:cai|chiec|bo|bong|o|cuc|con|day|mach|nhanh)?\s*$/); return m ? (WN[m[1]] || parseInt(m[1])) : 0; }
  function wattAfter(c, b) { const m = c.slice(b, b + 22).match(/^[^,;]*?(\d+(?:\.\d+)?)\s*(w|kw)\b/); return m ? parseFloat(m[1]) * (m[2] === 'kw' ? 1000 : 1) : 0; }
  const secOf = (v, u) => Math.round(parseFloat(v) * (/phut/.test(u) ? 60 : /gio/.test(u) ? 3600 : 1));
  const fmtT = s => s >= 3600 && s % 3600 === 0 ? s / 3600 + ' giờ' : s >= 60 && s % 60 === 0 ? s / 60 + ' phút' : s + ' giây';

  // có nên ghép tự do thay vì dùng mạch mẫu?
  function wants(n, tplGuess) {
    if (['plc', 'ats', 'dist'].includes(tplGuess)) return false;
    const kw = /\d+(?:\.\d+)?\s*(?:kw|hp|ma luc)\b/.test(n);
    const motorTpl = /bien tan|sao.{0,3}tam giac|dao chieu|thuan.{0,5}nghich|len.{0,5}xuong|cua cuon|cau truc|3 pha|ba pha/.test(n);
    const ld = mentions(n, LOADS).map(m => m.d.k);
    const ins = mentions(n, INPUTS).map(m => m.d.k);
    const extra = ld.filter(k => ['pilot', 'tower', 'bell', 'lock', 'valve', 'heater', 'ac'].includes(k) || ((k === 'fan' || k === 'pump') && !kw && !motorTpl));
    if (extra.length) return true;
    if (HOMEW.test(n) && !kw) return true;
    if (ld.includes('lamp') && ins.some(k => ['pir', 'door', 'pb', 'smoke', 'sensor', 'limit', 'float'].includes(k))) return true;
    if (ld.includes('lamp') && ins.some(k => ['photo', 'clock'].includes(k)) && !kw && !/chieu sang (xuong|nha xuong|nha may|kho|bai)/.test(n)) return true;
    if (ld.includes('lamp') && ld.includes('sock') && ld.length > 2) return true;
    if (ld.includes('conv') && !kw && !motorTpl && !/dong co|motor/.test(n)) return true;
    return false;
  }

  function build(n, Lb) {
    const U = /\b230\s*v/.test(n) ? 230 : 220;
    const dc = /24\s*v|24vdc|\bvdc\b|mot chieu|\bdc\b/.test(n);
    const kWm = n.match(/(\d+(?:\.\d+)?)\s*kw\b/);
    const base = n.split(/[,.;:!\n]|\broi\b(?! tat| tu tat| dung| tu dung)|\bsau do\b|\bcon\b/).map(c => c.trim()).filter(Boolean);
    // tách tiếp theo "và/với" khi mỗi phần đều có tải riêng
    const clauses = [];
    base.forEach(c => {
      const pcs = /\b(khi|neu|thi)\b/.test(c) ? [c] : c.split(/\s+(?:va|voi|cung)\s+/); let carry = '';
      const out = [];
      pcs.forEach(pc => { const t = (carry ? carry + ' va ' : '') + pc; if (mentions(pc, LOADS).length) { out.push(t); carry = ''; } else if (out.length && !/\b(khi|neu|thi)\b/.test(pc)) out[out.length - 1] += ' va ' + pc; else carry = t; });
      if (carry) { if (out.length) out[out.length - 1] += ' va ' + carry; else out.push(carry); }
      clauses.push(...out);
    });
    const rungs = []; const got = [], notes = [], dft = [];
    const findRung = k => rungs.slice().reverse().find(r => r.loads.some(l => l.d.k === k));
    clauses.forEach(c => {
      const dedupe = arr => { const seen = {}; return arr.filter(m => { const k = m.d.k; if (seen[k]) { seen[k].qty = Math.max(seen[k].qty, m.qty); return false; } seen[k] = m; return true; }); };
      let ins = dedupe(mentions(c, INPUTS)); const lds = dedupe(mentions(c, LOADS));
      if (ins.some(i => i.d.k === 'pbstop')) ins = ins.filter(i => i.d.k !== 'pb');
      lds.forEach(m => { if (m.d.k === 'heater') { const w = c.slice(m.a, m.b); m.nm = /bep/.test(w) ? 'Bếp điện' : /lo/.test(w) ? 'Lò nướng' : /say/.test(w) ? 'Máy sấy' : /thanh|dien tro/.test(w) ? 'Điện trở nhiệt' : 'Bình nóng lạnh'; m.cook = /bep|lo|say/.test(w); } });
      const condWord = /\b(khi|neu|thi|bang (?=cong tac|nut|cam bien|sensor|phao|dong ho|hen gio|tay|dimmer|hop so|ro le)|theo|dieu khien|bat|tat|kich|nhan|an|bam|luc|moi|cham|co nguoi|sau)\b/.test(c);
      const SENS = ['pir', 'photo', 'sensor', 'limit', 'door', 'smoke', 'float', 'temp', 'press', 'clock'];
      const has = ins.filter(i => !SENS.includes(i.d.k) || condWord || !/\bco\s*(\d+\s*)?$/.test(c.slice(Math.max(0, i.a - 6), i.a)));
      const durHint = /\d+(?:\.\d+)?\s*(giay|phut|gio|s)\b\s*(roi|thi|la)?\s*(tu\s*)?(tat|dung|ngat)/.test(c);
      const neg = !durHint && (/(thi|se|la|tu|lien|lap tuc)\s+(tat|dung|ngung|ngat|dong lai|nha)\b/.test(c) || /^(tat|dung|ngat)\b/.test(c));
      const dl = c.match(/sau\s+(\d+(?:\.\d+)?)\s*(giay|phut|gio|s)\b/);
      const du = c.match(/(\d+(?:\.\d+)?)\s*(giay|phut|gio|s)\b\s*(?:roi|thi|la)?\s*(?:tu\s*)?(?:tat|dung|ngat)/) || c.match(/(?:sang|chay|keu|bat|mo|hoat dong)\s+(?:trong\s+)?(\d+(?:\.\d+)?)\s*(giay|phut|gio|s)\b/);
      const or = /\bhoac\b/.test(c);
      const toggle = /(nhan|bam|an)[^,;]{0,25}(lan nua|lan nua|lai)[^,;]{0,10}tat|nhieu (noi|cho|vi tri)|rơ.?le xung|ro le xung/.test(c);
      if (!lds.length) {
        const last = rungs[rungs.length - 1];
        if (!last || !has.length) return;
        const ONE = ['door', 'float', 'temp', 'press', 'pir', 'photo', 'clock', 'sw', 'sw2'];
        if (neg) { has.forEach(i => { if (i.d.k === 'pbstop') { (last.stops = last.stops || []).push(i); return; } if (ONE.includes(i.d.k) && last.conds.some(x => x.d.k === i.d.k)) return; last.ncs.push(i); }); }
        else has.forEach(i => { if (!last.conds.some(x => x.d.k === i.d.k)) last.conds.push(i); });
        if (dl) last.delay = secOf(dl[1], dl[2]); if (du) last.dur = secOf(du[1], du[2]);
        return;
      }
      if (lds.length === 1 && lds[0].d.k === 'pilot' && !has.length && /bao (chay|hoat dong|dang chay|van hanh)/.test(c)) { const pr = rungs.slice().reverse().find(r => r.loads.some(l => l.d.k === 'conv')); if (pr) { pr.loads.push(lds[0]); return; } }
      if (neg && has.length) {
        lds.forEach(l => { let r = findRung(l.d.k); if (!r) { r = { loads: [l], conds: [], ncs: [] }; rungs.push(r); } has.forEach(i => r.ncs.push(i)); });
        return;
      }
      let starts = has.filter(i => i.d.k !== 'pbstop'); const stops = has.filter(i => i.d.k === 'pbstop');
      const delay = dl ? secOf(dl[1], dl[2]) : 0, dur = du ? secOf(du[1], du[2]) : 0;
      // "sau N giây thì …" không nêu điều kiện → ghép vào nhánh trước, chạy trễ bằng rơ-le thời gian
      if (!starts.length && !stops.length && delay && rungs.length) { const pr = rungs[rungs.length - 1]; (pr.delayed = pr.delayed || []).push({ loads: lds, delay }); return; }
      if (!starts.length && !stops.length && !toggle && lds.length > 1) { lds.forEach(l => rungs.push({ loads: [l], conds: [], ncs: [], stops: [], delay, dur })); return; }
      rungs.push({ loads: lds, conds: starts, ncs: [], stops, or, toggle, delay, dur });
    });
    if (!rungs.length) return null;

    // ---------- dựng phần tử ----------
    const cnt = {}; const tagOf = p => p + (cnt[p] = (cnt[p] || 0) + 1);
    const devs = []; const addDev = (tag, type, spec) => devs.push({ tag, type, spec });
    const steps = [], calcs = [];
    const home = [], ctrl = [];
    let needPower = false, powerKW = kWm ? parseFloat(kWm[1]) : 0;
    let curHeavy = false;
    const inEl = (i, ncForm) => {
      const d = i.d, tag = tagOf(d.tag || 'S');
      const el = { t: ncForm ? 'nc' : (d.el || 'no'), tag, lbl: d.name };
      if (d.act) el.act = d.act; if (d.k === 'pbstop') { el.t = 'nc'; el.lbl = 'Dừng'; } else if (ncForm) el.lbl = d.name + ' → tắt';
      if (d.k === 'dimmer') el.t = 'box2';
      const spec = { pb: d.k === 'pbstop' ? 'Nút nhấn Ø22 đỏ 1NC' : 'Nút nhấn 1NO', switch: curHeavy ? 'Công tắc 2 cực 20 A (cắt cả L và N)' : 'Công tắc 1 chiều 10 A', pir: 'Cảm biến chuyển động hồng ngoại 220 VAC, có chỉnh thời gian giữ và độ nhạy (Lux)', photocell: 'Cảm biến ánh sáng 220 VAC, chỉnh ngưỡng Lux', limit: 'Công tắc hành trình / công tắc cửa 1NO+1NC', smoke: 'Đầu báo khói/gas có ngõ ra rơ-le', level: 'Phao điện / rơ-le mực nước', temp: 'Bộ điều khiển nhiệt độ ngõ ra rơ-le', pressure: 'Công tắc áp suất', time_switch: 'Đồng hồ hẹn giờ gắn DIN, có pin lưu', sensor_photo: 'Cảm biến ngõ ra rơ-le (hoặc 24 VDC qua rơ-le trung gian)', sel: 'Công tắc xoay 2 vị trí', dimmer: 'Dimmer (đèn) / hộp số (quạt) đúng công suất tải' }[d.type] || d.name;
      addDev(tag, d.type, (ncForm && d.k !== 'pbstop' ? 'Dùng tiếp điểm NC — ' : '') + spec);
      return el;
    };
    const loadEls = (r) => {
      const out = [];
      r.loads.forEach(l => {
        const q = Math.max(1, l.qty || 1); const d = l.d;
        for (let i = 0; i < q && out.length < 8; i++) {
          if (d.k === 'conv') { const tag = tagOf('K'); out.push({ t: 'coil', tag, lbl: 'Contactor băng tải' }); addDev(tag, 'contactor', powerKW ? `Contactor AC-3 theo công suất ${powerKW} kW, cuộn 220 VAC` : 'Contactor cuộn hút ' + (dc ? '24 VDC' : '220 VAC') + ' — chọn dòng AC-3 theo công suất động cơ băng tải'); needPower = needPower || !!powerKW; r.motorTag = tag; continue; }
          const tag = tagOf(d.tag); const W = l.W || d.W;
          const nm = l.nm || d.name;
          const el = { t: d.el, tag, lbl: d.k === 'ac' ? 'Điều hòa' : d.k === 'sock' ? 'Ổ cắm' : `${nm}${W && d.k !== 'pilot' ? ' ' + (W >= 1000 ? W / 1000 + ' kW' : W + ' W') : ''}` };
          if (d.k === 'ac') { el.t = 'box2'; el.tag = tag; }
          out.push(el); if (d.k === 'sock') { if (!r._sock) { r._sock = 1; r.W = (r.W || 0) + (l.W || d.W); } } else r.W = (r.W || 0) + W;
          const spec = { lamp: `Đèn LED ${W} W`, pilot: 'Đèn báo LED Ø22 ' + (dc ? '24 VDC' : '220 VAC'), horn: d.k === 'tower' ? 'Đèn cảnh báo/đèn xoay ' + (dc ? '24 VDC' : '220 VAC') : 'Chuông/còi ' + (dc ? '24 VDC' : '220 VAC'), valve: `${d.name} cuộn ${dc ? '24 VDC' : '220 VAC'}`, heater: `${nm} ${W} W`, fan: `${d.name} ${W} W`, switch: d.k === 'sock' ? 'Ổ cắm đôi 3 chấu 16 A có tiếp địa' : `${d.name} ${W} W` }[d.type] || d.name;
          addDev(tag, d.type, spec);
        }
      });
      return out;
    };
    const wrapLoads = els => els.length > 1 ? { par: els.map(e => [e]) } : els[0];
    let pend = [];
    const flush = () => { got.push(...pend); pend = []; };
    const delayedBranches = rr => (rr.delayed || []).flatMap(dd => {
      const kt = tagOf('KT'); addDev(kt, 'timer', `Rơ-le thời gian on-delay, đặt ${fmtT(dd.delay)}`);
      const fake = { loads: dd.loads }; const els = loadEls(fake);
      pend.push(`   ↳ sau ${fmtT(dd.delay)}: ${descL(fake)}`);
      steps.push(`Sau ${fmtT(dd.delay)} kể từ khi ${descL(rr)} bật: ${descL(fake)} bật (rơ-le thời gian ${kt}).`);
      return [[{ t: 'tcoil', tag: kt, lbl: `Trễ ${fmtT(dd.delay)}` }], [{ t: 'no', act: 'timer', tag: kt, lbl: 'Hết giờ' }, wrapLoads(els)]];
    });
    const condBlock = (list, or) => !list.length ? [] : (or && list.length > 1 ? [{ par: list.map(i => [inEl(i)]) }] : list.map(i => inEl(i)));
    const descI = list => list.map(i => i.d.name.toLowerCase()).join(' + ');
    const descL = r => r.loads.map(l => (l.qty > 1 ? l.qty + ' ' : '') + (l.nm || l.d.name).toLowerCase()).join(', ');

    rungs.forEach((r, ri) => {
      const isHome = r.loads.every(l => l.d.home) && !r.conds.some(i => ['sensor', 'limit', 'float', 'press', 'temp', 'pbstop', 'sel'].includes(i.d.k) && i.d.k !== 'door') && !r.dur && !r.delay;
      const kinds = r.loads.map(l => l.d.k);
      // điều kiện mặc định khi câu không nói
      if (!r.conds.length && !r.toggle) {
        if (kinds.includes('conv')) { r.conds = [{ d: INPUTS.find(x => x.k === 'pb') }]; r.stops = r.stops && r.stops.length ? r.stops : [{ d: INPUTS.find(x => x.k === 'pbstop') }]; if (!dft.includes('băng tải/động cơ: nút Chạy/Dừng có tự giữ')) dft.push('băng tải/động cơ: nút Chạy/Dừng có tự giữ'); }
        else if (kinds.some(k => ['lamp', 'fan', 'pump', 'valve', 'pilot', 'tower', 'lock'].includes(k)) || r.loads.some(l => l.d.k === 'heater' && !l.cook)) { r.conds = [{ d: INPUTS.find(x => x.k === 'sw') }]; const m = 'tải chưa nêu cách điều khiển (' + r.loads.map(l => (l.nm || l.d.name).toLowerCase()).join(', ') + '): dùng công tắc'; if (!kinds.includes('lamp') || kinds.length > 1) dft.push(m); }
        else if (kinds.includes('bell')) r.conds = [{ d: INPUTS.find(x => x.k === 'pb') }];
      }
      if (kinds.includes('conv') && !(r.stops && r.stops.length)) { r.stops = [{ d: INPUTS.find(x => x.k === 'pbstop') }]; }
      // tách đèn nhiều bóng không có điều kiện riêng → mỗi bóng một công tắc (tối đa 4)
      const lampOnly = r.loads.length === 1 && kinds[0] === 'lamp' && r.conds.length === 1 && r.conds[0].d.k === 'sw' && !r.conds[0].a && (r.loads[0].qty || 1) > 1 && (r.loads[0].qty || 1) <= 4;
      const parts = lampOnly ? Array.from({ length: r.loads[0].qty }, () => ({ ...r, loads: [{ ...r.loads[0], qty: 1 }] })) : [r];
      parts.forEach(rr => {
        curHeavy = rr.loads.some(l => l.d.k === 'heater' || l.d.k === 'pump');
        const series = [];
        const sw2 = rr.conds.find(i => i.d.k === 'sw2');
        const latch = (rr.stops && rr.stops.length) || kinds.includes('conv') || rr.dur;
        const loads = loadEls(rr);
        // bảo vệ cho mạch dân dụng
        if (isHome) {
          const I = (rr.W || 40) / (U * 0.9);
          const isS = kinds.includes('sock'), isH = kinds.includes('heater') || kinds.includes('pump');
          const minIn = isH || kinds.includes('ac') ? 20 : isS ? 16 : 10;
          const In = [10, 16, 20, 25, 32, 40, 50, 63].find(v => v >= Math.max(minIn, I * 1.25)) || 63;
          const rcd = isS || isH;
          const tag = tagOf('Q');
          series.push({ t: rcd ? 'rcbo' : 'cb', tag, lbl: rcd ? `RCBO ${In}A 30mA` : `MCB 1P ${In}A` });
          addDev(tag, rcd ? 'rcbo' : 'mcb', rcd ? `RCBO 1P+N ${In} A, IΔn 30 mA` : `MCB 1P ${In} A đường cong C`);
          const S = In <= 10 ? 1.5 : In <= 20 ? 2.5 : In <= 25 ? 4 : In <= 32 ? 6 : 10;
          calcs.push([`Mạch ${tag}: ${descL(rr)}`, `P ≈ ${Math.round(rr.W || 40)} W → I ≈ ${(Math.round(I * 10) / 10)} A → ${rcd ? 'RCBO' : 'MCB'} ${In} A, dây Cu ${S} mm²`]);
          rr._I = I; rr._isHome = true;
        }
        if (sw2) {
          series.push({ t: 'sw2', ttag: tagOf('S'), btag: tagOf('S'), lbl: 'Công tắc 2 chiều', links: [] });
          const el = series[series.length - 1]; el.links = [[el.ttag + ':T1', el.btag + ':T1', 'Dây đảo 1'], [el.ttag + ':T2', el.btag + ':T2', 'Dây đảo 2']];
          addDev(el.ttag + ', ' + el.btag, 'switch', 'Công tắc 2 chiều 10 A (COM, L1, L2)');
        }
        const conds = rr.conds.filter(i => i.d.k !== 'sw2');
        const ncs = (rr.ncs || []).map(i => inEl(i, true));
        if (rr.toggle) {
          // rơ-le xung: các nút song song → cuộn rơ-le xung; tiếp điểm rơ-le xung cấp cho tải
          const kl = tagOf('KL'); const nb = Math.max(2, conds.filter(i => i.d.k === 'pb').reduce((a, i) => a + (i.qty || 1), 0) || 2);
          const btns = []; for (let i = 0; i < Math.min(nb, 6); i++) { const t = tagOf('S'); btns.push([{ t: 'no', act: 'push', tag: t, lbl: 'Nút nhấn' }]); addDev(t, 'pb', 'Nút nhấn nhả (công tắc chuông) 1NO'); }
          addDev(kl, 'impulse', `Rơ-le xung 16 A, cuộn ${dc ? '24 VDC' : '220 VAC'}`);
          ctrlOrHome(isHome).push([...series.filter(e => e.t === 'cb' || e.t === 'rcbo'), { par: [[{ par: btns }, { t: 'coil', tag: kl, lbl: 'Rơ-le xung' }], [{ t: 'no', tag: kl, tt: ['1'], bt: ['2'], lbl: 'Tiếp điểm' }, wrapLoads(loads)]] }]);
          steps.push(`Nhấn bất kỳ nút nào: ${descL(rr)} bật; nhấn lần nữa: tắt (rơ-le xung ${kl} đổi trạng thái mỗi lần nhấn).`);
          got.push(`Nhánh: ${nb} nút nhấn + rơ-le xung → ${descL(rr)} (bật/tắt từ nhiều nơi)`);
          return;
        }
        if (latch) {
          const ka = rr.motorTag && !rr.dur ? rr.motorTag : tagOf('KA');
          const stopEls = (rr.stops || []).map(i => inEl(i));
          const kt = rr.dur ? tagOf('KT') : null;
          const startEls = condBlock(conds, true);
          const pre = [...stopEls, ...ncs, ...(kt ? [{ t: 'nc', act: 'timer', tag: kt, lbl: `Hết ${fmtT(rr.dur)}` }] : [])];
          startEls.forEach(e => { if (e.act === 'push') e.lbl = 'Chạy'; });
          let first = startEls;
          if (!first.length) { const t = tagOf('S'); first = [{ t: 'no', act: 'push', tag: t, lbl: 'Chạy' }]; addDev(t, 'pb', 'Nút nhấn 1NO'); }
          const hold = { par: [first, [{ t: 'no', tag: ka, lbl: 'Tự giữ' }]] };
          const outs = [];
          if (ka !== rr.motorTag) { outs.push([{ t: 'coil', tag: ka, lbl: 'Rơ-le giữ' }]); addDev(ka, 'relay', `Rơ-le trung gian cuộn ${dc ? '24 VDC' : '220 VAC'}, 2NO`); }
          if (kt) { outs.push([{ t: 'tcoil', tag: kt, lbl: `Đếm ${fmtT(rr.dur)}` }]); addDev(kt, 'timer', `Rơ-le thời gian on-delay, đặt ${fmtT(rr.dur)}`); }
          loads.forEach(e => outs.push([e])); outs.push(...delayedBranches(rr));
          if (rr.motorTag && powerKW) pre.unshift({ t: 'nc', act: 'thermal', tag: 'F1', lbl: 'Quá tải' });
          ctrlOrHome(isHome).push([...series, ...pre, hold, { par: outs }]);
          got.push(`Nhánh: ${conds.length ? descI(conds) : 'nút Chạy'} → ${rr.motorTag ? 'contactor băng tải' : descL(rr)}${rr.dur ? `, giữ ${fmtT(rr.dur)} rồi tự tắt` : ' (có tự giữ)'}${(rr.stops || []).length ? ', nút Dừng' : ''}${ncs.length ? ', dừng khi ' + descI(rr.ncs).toLowerCase() : ''}`); flush();
          steps.push(`Tác động ${conds.length ? descI(conds) : 'nút Chạy'}: ${descL(rr)} bật và tự giữ${rr.dur ? `, sau ${fmtT(rr.dur)} tự tắt` : ''}${ncs.length ? `; khi ${descI(rr.ncs)} tác động thì tắt` : ''}${(rr.stops || []).length ? '; nhấn Dừng thì tắt' : ''}.`);
          return;
        }
        if (rr.delay) {
          const kt = tagOf('KT'); addDev(kt, 'timer', `Rơ-le thời gian on-delay, đặt ${fmtT(rr.delay)}`);
          ctrlOrHome(isHome).push([...series, ...condBlock(conds, rr.or), ...ncs, { par: [[{ t: 'tcoil', tag: kt, lbl: `Trễ ${fmtT(rr.delay)}` }], [{ t: 'no', act: 'timer', tag: kt, lbl: 'Hết giờ' }, wrapLoads(loads)]] }]);
          got.push(`Nhánh: ${descI(conds)} → sau ${fmtT(rr.delay)} → ${descL(rr)}`);
          steps.push(`Tác động ${descI(conds)}: sau ${fmtT(rr.delay)} ${descL(rr)} mới bật; nhả ra thì tắt ngay.`);
          return;
        }
        const db = delayedBranches(rr);
        ctrlOrHome(isHome && !db.length).push([...series, ...condBlock(conds, rr.or), ...ncs, db.length ? { par: [...loads.map(e => [e]), ...db] } : wrapLoads(loads)].filter(Boolean));
        const cd = [sw2 ? 'công tắc 2 chiều (2 nơi)' : '', conds.length ? descI(conds) + (rr.or && conds.length > 1 ? ' (hoặc)' : conds.length > 1 ? ' (đồng thời)' : '') : ''].filter(Boolean).join(' + ');
        got.push(`Nhánh: ${cd || 'cấp nguồn trực tiếp'} → ${descL(rr)}${ncs.length ? ', tắt khi ' + descI(rr.ncs) : ''}`); flush();
        if (cd) steps.push(`Tác động ${cd}: ${descL(rr)} phải bật${ncs.length ? `; khi ${descI(rr.ncs)} tác động thì tắt` : ''}.`);
      });
    });
    function ctrlOrHome(h) { return h ? home : ctrl; }

    // ---------- section ----------
    const sections = [], allStepsPre = [];
    if (needPower && Lb) {
      const dol = Lb.TPL.find(t => t.id === 'dol'); const p = {}; dol.params.forEach(d => { p[d.k] = d.def; }); p.kW = powerKW;
      const b = dol.build(p); sections.push(b.sections[0]);
      b.devices.filter(d => ['Q1', 'F1', 'W1'].includes(d.tag)).forEach(d => devs.push(d));
      calcs.push(...b.calcs.filter(c => /Dòng định mức|CB Q1|Rơ-le nhiệt|Cáp/.test(c[0])));
    }
    if (home.length) {
      const Itot = rungs.filter(r => r._isHome).reduce((a, r) => a + (r._I || 0), 0);
      const main = [10, 16, 20, 25, 32, 40, 50, 63].find(v => v >= Itot * 0.8 * 1.25) || 63;
      const anyRcd = devs.some(d => d.type === 'rcbo');
      addDev('Q0', 'mcb', `MCB 2P ${main} A (tổng)${anyRcd ? '' : ' — nên thêm RCCB 30 mA cho mạch ẩm ướt'}`);
      calcs.unshift(['Tổng', `ΣI ≈ ${Math.round(Itot * 10) / 10} A × hệ số đồng thời 0.8 → MCB tổng 2P ${main} A`]);
      sections.push({ title: 'Sơ đồ nguyên lý 1 pha ' + U + ' V', kind: 'final', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [{ t: 'cb', tag: 'Q0', lbl: `MCB 2P ${main}A (tổng)` }, home.length > 1 ? { par: home } : home[0]].flat() });
    }
    if (ctrl.length) {
      if (dc) {
        sections.push({ title: 'Nguồn 24 VDC', kind: 'ac', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [{ t: 'cb', tag: 'F0', lbl: 'MCB 1P 4A' }, { t: 'psu', tag: 'G1', lbl: 'Nguồn 24VDC', links: [['G1:+V', '+24V', ''], ['G1:-V', '0V', '']] }] });
        addDev('G1', 'psu', 'Nguồn 24 VDC, công suất ≥ 1,5 × tổng tải 24 V'); addDev('F0', 'mcb', 'MCB 1P 4A');
      }
      const es = /dung khan|khan cap|e.?stop|nam dung/.test(n);
      if (es) { addDev('S00', 'estop', 'Nút dừng khẩn nấm đỏ, nhấn giữ – xoay nhả, 1NC'); allStepsPre.push('Nhấn nấm dừng khẩn S00: toàn bộ mạch điều khiển mất điện, mọi tải tắt; xoay nhả rồi mới hoạt động lại.'); got.push('Nút dừng khẩn S00 cắt toàn bộ mạch điều khiển'); }
      sections.push({ title: dc ? 'Mạch điều khiển 24 VDC' : 'Mạch điều khiển ' + U + ' VAC', kind: dc ? 'dc' : 'ac', poles: [dc ? '+24V' : 'L'], bpoles: [dc ? '0V' : 'N'], top: true, bottom: true, net: [{ t: 'cb', tag: 'F2', lbl: dc ? 'Cầu chì 2A' : 'MCB 1P 2A' }, ...(es ? [{ t: 'nc', act: 'estop', tag: 'S00', lbl: 'Dừng khẩn' }] : []), ctrl.length > 1 ? { par: ctrl } : ctrl[0]].flat() });
      addDev('F2', dc ? 'fuse' : 'mcb', dc ? 'Cầu chì / CB DC 2 A' : 'MCB 1P 2 A bảo vệ mạch điều khiển');
    }
    // gộp thiết bị giống nhau
    const map = new Map();
    devs.forEach(d => { const k = d.type + '|' + d.spec; if (!map.has(k)) map.set(k, { tag: d.tag, type: d.type, spec: d.spec, qty: 0, tags: [] }); const m = map.get(k); m.qty++; m.tags.push(d.tag); });
    const devices = [...map.values()].map(m => ({ tag: m.tags.length > 3 ? m.tags[0] + '…' + m.tags[m.tags.length - 1] : m.tags.join(', '), type: m.type, spec: m.spec, qty: m.qty }));
    const allSteps = [];
    if (home.length) allSteps.push('Công tắc, nút nhấn luôn cắt dây pha L; dây N đi thẳng tới thiết bị. Màu dây: L nâu/đỏ, N xanh dương, PE vàng-xanh.', 'Mỗi mạch có dây N riêng đi cùng dây L của mạch đó — không dùng chung N giữa các RCBO.', 'Ổ cắm, bình nóng lạnh, bơm: bắt buộc nối PE và qua RCBO 30 mA.');
    if (ctrl.length) allSteps.push('Thử mạch điều khiển trước khi cấp nguồn cho tải lớn; thao tác từng ngõ vào và quan sát đúng tải bật/tắt.');
    allSteps.push(...allStepsPre, ...steps);
    if (needPower) allSteps.push('Phần động lực: đấu như mạch khởi động trực tiếp (Q1 → K1 → F1 → động cơ), chỉnh rơ-le nhiệt theo In.');
    const nn = [];
    if (devs.some(d => ['sensor_photo', 'pir', 'smoke'].includes(d.type))) nn.push('Cảm biến 24 VDC không đấu thẳng vào mạch 220 VAC — chọn loại ngõ ra rơ-le 220 V hoặc thêm rơ-le trung gian.');
    if (rungs.some(r => r.loads.some(l => l.d.k === 'conv')) && !needPower) nn.push('Băng tải/động cơ được vẽ ở dạng cuộn contactor. Muốn vẽ cả phần động lực, ghi thêm công suất (vd. “băng tải 2,2 kW”).');
    if (devs.some(d => d.type === 'pir')) nn.push('Cảm biến chuyển động tự giữ đèn sáng theo thời gian chỉnh trên cảm biến (TIME) sau khi hết người.');
    nn.push('Kết quả chỉ để tham khảo — kiểm tra lại theo TCVN/IEC và catalogue trước khi thi công.');
    const title = 'Sơ đồ theo mô tả — ' + [...new Set(rungs.flatMap(r => [...r.loads, ...(r.delayed || []).flatMap(d => d.loads)].map(l => (l.d.k === 'conv' ? 'băng tải' : (l.nm || l.d.name).toLowerCase()))))].slice(0, 4).join(', ');
    return { result: { title, sections, devices, calcs, steps: allSteps, notes: [...notes, ...nn] }, got, dft, notes };
  }
  G.CircuitCompose = { wants, build };
})(typeof window !== 'undefined' ? window : globalThis);
