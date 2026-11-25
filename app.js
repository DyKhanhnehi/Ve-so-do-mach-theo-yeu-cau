{
  const E = window.CircuitEngine, Lb = window.CircuitLib, esc = E.esc;
  const $ = id => document.getElementById(id);
  const store = { get(k, d) { try { const v = localStorage.getItem('xvm:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem('xvm:' + k, JSON.stringify(v)); } catch (e) { } } };
  const S = {
    mode: 'tpl', cat: 'motor', tpl: store.get('tpl', 'dol'), params: store.get('params', {}), brand: store.get('brand', 'sch'), cmp: false,
    tab: 'bom', zoom: 0, wireView: 'wire', result: null, render: null, ai: null, aiHist: null
  };
  const tplById = id => Lb.TPL.find(t => t.id === id) || Lb.TPL[0];
  S.cat = tplById(S.tpl).cat;
  const toast = msg => { const t = $('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 2200); };
  const today = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };

  // ---------- left panel ----------
  function drawCats() {
    $('cats').innerHTML = Lb.CATS.map(c => `<button class="chip" data-c="${c.id}" aria-pressed="${c.id === S.cat}">${esc(c.name)}</button>`).join('');
    $('tpls').innerHTML = Lb.TPL.filter(t => t.cat === S.cat).map(t => `<button class="tpl" data-id="${t.id}" aria-pressed="${t.id === S.tpl && !S.ai}"><b>${esc(t.name)}</b><span>${esc(t.desc)}</span></button>`).join('');
  }
  function curParams(t) { const saved = S.params[t.id] || {}; const p = {}; t.params.forEach(d => { p[d.k] = saved[d.k] !== undefined ? saved[d.k] : d.def; }); return p; }
  function drawParams() {
    const t = tplById(S.tpl), p = curParams(t);
    $('params').innerHTML = t.params.map(d => {
      const id = 'p_' + d.k, v = p[d.k];
      let ctl;
      if (d.type === 'sel') ctl = `<select id="${id}" data-k="${d.k}">${d.opts.map(o => `<option value="${esc(o)}"${String(o) === String(v) ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
      else if (d.type === 'text') ctl = `<input id="${id}" data-k="${d.k}" type="text" value="${esc(v)}">`;
      else ctl = `<input id="${id}" data-k="${d.k}" type="number" inputmode="decimal" min="${d.min}" max="${d.max}" step="${d.step}" value="${esc(v)}">`;
      return `<label for="${id}">${esc(d.label)}<span class="unit">${ctl}${d.unit ? `<span>${esc(d.unit)}</span>` : ''}</span></label>`;
    }).join('') + `<button type="button" class="btn ghost" id="pReset">Về giá trị mặc định</button>`;
  }
  function readParams() {
    const t = tplById(S.tpl), p = {};
    t.params.forEach(d => {
      const el = $('p_' + d.k); if (!el) { p[d.k] = d.def; return; }
      let v = el.value;
      if (d.type === 'num') { v = parseFloat(String(v).replace(',', '.')); if (!isFinite(v)) v = d.def; v = Math.min(d.max, Math.max(d.min, v)); }
      else if (d.type === 'sel' && typeof d.def === 'number') v = Number(v);
      p[d.k] = v;
    });
    S.params[t.id] = p; store.set('params', S.params);
    return p;
  }

  // ---------- build & render ----------
  function buildFromTemplate() {
    const t = tplById(S.tpl), p = readParams();
    try { S.result = t.build(p); S.result.source = 'tpl'; } catch (e) { console.error(e); toast('Không tính được với thông số này'); return; }
    store.set('tpl', S.tpl);
    drawSheet(true);
  }
  function drawSheet(fit, sheetOnly) {
    const r = S.result; if (!r) return;
    let out;
    if (S.simOn && (!S.sim || S.sim.model !== r)) { S.sim = new window.CircuitSim(r); }
    const simOpt = S.simOn && S.sim ? { sim: S.sim.st, clk: new Set(S.sim.controls.flatMap(c => c.ids)) } : {};
    try { out = E.render({ title: r.title, sections: r.sections }, Object.assign({ color: $('oColor').checked, termNums: $('oTerm').checked, wireNums: $('oWire').checked, date: today() }, simOpt)); }
    catch (e) { console.error(e); $('viewer').textContent = 'Không vẽ được sơ đồ này. Hãy thử mô tả lại.'; return; }
    S.render = out;
    $('title').textContent = r.title;
    $('viewer').innerHTML = out.svg;
    if (fit || !S.zoom) fitZoom(); else applyZoom();
    if (S.simOn) drawSimPanel();
    if (!sheetOnly) drawPane();
  }

  // ---------- chạy thử ----------
  function drawSimPanel() {
    const sim = S.sim; if (!sim) return;
    $('simCtrls').innerHTML = sim.controls.map((c, i) => `<button type="button" class="cbtn k-${c.kind}${sim.isActive(c) ? ' act' : ''}" data-c="${i}"><b>${esc(c.label)}</b><span>${esc(sim.stateText(c))}</span></button>`).join('') || '<p class="hint">Mạch này không có ngõ vào để thao tác.</p>';
    $('simOuts').innerHTML = sim.outputs().map(o => `<span class="oc${o.on ? ' on' : ''}"><i></i>${esc(o.tag)}${o.lbl ? ' · ' + esc(o.lbl) : ''}${o.note ? ' · ⏱ ' + esc(o.note) : ''}</span>`).join('');
    $('simLog').innerHTML = sim.log.slice(0, 14).map(l => `<li><span>${esc(fmtClock(l.t))}</span> ${esc(l.msg)}</li>`).join('') || '<li><span>—</span> Chưa có thao tác</li>';
  }
  const fmtClock = t => { t = Math.floor(t); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  function simRedraw() { drawSheet(false, true); }
  function setSim(on) {
    S.simOn = on; $('simBtn').setAttribute('aria-pressed', on); $('simBtn').textContent = on ? '■ Đang chạy thử' : '▶ Chạy thử';
    $('simPanel').hidden = !on;
    if (on) { S.sim = new window.CircuitSim(S.result); S.sim.addLog('Bắt đầu chạy thử — nguồn đã đóng'); }
    else S.sim = null;
    drawSheet(false, true);
    if (on) $('simPanel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  let pressed = null;
  function ctrlDown(c) {
    if (!S.sim) return;
    const key = S.sim.keyOfControl(c);
    if (c.kind === 'push') { pressed = { key, c }; S.sim.act(key, 'push', true); }
    else S.sim.act(key, c.kind);
    simRedraw();
  }
  function ctrlUp() { if (pressed && S.sim) { S.sim.act(pressed.key, 'push', false); pressed = null; simRedraw(); } }
  $('simBtn').onclick = () => setSim(!S.simOn);
  $('simStop').onclick = () => setSim(false);
  $('simReset').onclick = () => { if (S.simOn) { S.sim = new window.CircuitSim(S.result); S.sim.addLog('Đặt lại'); simRedraw(); } };
  $('simCtrls').addEventListener('pointerdown', e => { const b = e.target.closest('[data-c]'); if (!b || !S.sim) return; e.preventDefault(); ctrlDown(S.sim.controls[+b.dataset.c]); });
  $('simCtrls').addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { const b = e.target.closest('[data-c]'); if (b && S.sim) { e.preventDefault(); ctrlDown(S.sim.controls[+b.dataset.c]); } } });
  $('simCtrls').addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') ctrlUp(); });
  $('viewer').addEventListener('pointerdown', e => {
    if (!S.simOn || !S.sim) return;
    const g = e.target.closest('g.clk'); if (!g) return;
    const id = +g.dataset.i; const c = S.sim.controls.find(x => x.ids.includes(id)); if (!c) return;
    e.preventDefault();
    if (c.key.startsWith('sw:') || S.sim.inputKey(S.sim.els.find(x => x._id === id)) === 'sw2') {
      const el = S.sim.els.find(x => x._id === id);
      if (el && el.t === 'sw2') { const r = g.getBoundingClientRect(); const key = (e.clientY - r.top) < r.height / 2 ? 'sw:' + el.ttag : 'sw:' + el.btag; S.sim.act(key, 'tog'); simRedraw(); return; }
    }
    ctrlDown(c);
  });
  ['pointerup', 'pointercancel'].forEach(ev => window.addEventListener(ev, ctrlUp));
  setInterval(() => {
    if (!S.simOn || !S.sim || !S.sim.timersRunning()) return;
    S.sim.tick(0.2 * (+$('simSpeed').value || 1)); simRedraw();
  }, 200);
  function fitZoom() { const vw = $('viewer').clientWidth - 30; S.zoom = Math.max(0.2, Math.min(1.4, vw / S.render.W)); applyZoom(); }
  function applyZoom() { const svg = $('viewer').querySelector('svg'); if (!svg) return; svg.setAttribute('width', Math.round(S.render.W * S.zoom)); svg.setAttribute('height', Math.round(S.render.H * S.zoom)); }

  // ---------- panes ----------
  const brandName = id => (Lb.BRANDS.find(b => b.id === id) || {}).name || (id === 'alt' ? 'Hãng khác' : '');
  function paneBom() {
    const r = S.result, devs = r.devices || [];
    const b = Lb.BRANDS.find(x => x.id === S.brand);
    let h = `<div class="brandnote"><div><b>${esc(b.name)}</b> — ${esc(b.note)}<br><span class="fb">Nên dùng CB, contactor, rơ-le nhiệt cùng một hãng để tra bảng phối hợp bảo vệ (Type 2) và dễ thay thế. Mã dòng sản phẩm là gợi ý — tra catalogue/bảng giá mới nhất của đại lý trước khi đặt hàng.</span></div></div>`;
    if (S.cmp) {
      h += `<div class="scroll"><table><thead><tr><th>Ký hiệu</th><th>Thiết bị</th>${Lb.BRANDS.map(x => `<th>${esc(x.name)}</th>`).join('')}</tr></thead><tbody>` +
        devs.map(d => { const c = Lb.CAT[d.type] || {}; return `<tr><td class="tag">${esc(d.tag)}</td><td>${esc(c.name || d.type)}<span class="fb">${esc(d.spec)}</span></td>${Lb.BRANDS.map(x => `<td>${esc(c[x.id] || '—')}</td>`).join('')}</tr>`; }).join('') + `</tbody></table></div>`;
    } else {
      h += `<table class="stack"><thead><tr><th>Ký hiệu</th><th>Thiết bị</th><th>Thông số chọn</th><th>Gợi ý ${esc(b.name)}</th><th>SL</th></tr></thead><tbody>` +
        devs.map(d => {
          const c = Lb.CAT[d.type] || {}, bp = Lb.brandPick(d.type, S.brand);
          const fb = bp.fallback ? `<span class="fb">${esc(b.name)} không có dòng này → ${esc(brandName(bp.by))}${c.alt && bp.by !== 'alt' ? ' · khác: ' + esc(c.alt) : ''}</span>` : (c.alt ? `<span class="fb">Hãng khác: ${esc(c.alt)}</span>` : '');
          return `<tr><td class="tag">${esc(d.tag)}</td><td>${esc(c.name || d.type || '')}</td><td>${esc(d.spec)}</td><td>${esc(bp.text)}${fb}</td><td>${esc(d.qty || 1)}</td></tr>`;
        }).join('') + `</tbody></table>`;
    }
    return h;
  }
  function wireColorTxt(w) {
    const p = w.pole;
    if (w.kind === 'power' || w.kind === 'final') return ({ L1: ['var(--w-l1)', 'Nâu'], L2: ['var(--w-l2)', 'Đen'], L3: ['var(--w-l3)', 'Xám'], N: ['var(--w-n)', 'Xanh dương'], L: ['var(--w-l1)', 'Nâu (pha)'] })[p] || ['var(--w-l2)', 'Đen'];
    if (w.kind === 'dc') return p === '0V' ? ['var(--w-dc0)', 'Xanh dương/trắng (0 V)'] : ['var(--w-dc)', 'Xanh dương (DC)'];
    return p === 'N' ? ['var(--w-n)', 'Xanh dương (N)'] : ['var(--w-ac)', 'Đỏ (điều khiển AC)'];
  }
  function paneWire() {
    const R = S.render, secs = S.result.sections;
    let h = `<div class="row"><div class="seg" style="width:auto"><button data-wv="wire" aria-pressed="${S.wireView === 'wire'}">Theo số dây</button><button data-wv="dev" aria-pressed="${S.wireView === 'dev'}">Theo thiết bị</button></div><button class="btn ghost" id="cpCsv">Sao chép bảng</button><button class="btn" id="dlCsv" ${dl ? '' : 'hidden'}>Tải CSV</button></div>`;
    h += `<p class="hint" style="margin:0 0 10px">Màu dây: động lực theo IEC 60445 (L1 nâu, L2 đen, L3 xám, N xanh dương, PE vàng-xanh); điều khiển theo IEC 60204-1 (AC đỏ, DC xanh dương). Mỗi đầu dây luồn ống lồng in đúng số dây.</p>`;
    if (S.wireView === 'wire') {
      secs.forEach((sec, si) => {
        const ws = R.wires.filter(w => w.sec === si && w.terms.length);
        if (!ws.length) return;
        h += `<h3 class="secttl">${esc(sec.title)}</h3><table class="stack"><thead><tr><th>Dây</th><th>Đấu lần lượt</th><th>Màu dây gợi ý</th></tr></thead><tbody>` +
          ws.map(w => { const [c, t] = wireColorTxt(w); return `<tr><td><span class="wire" style="color:${c}">${esc(w.name)}</span></td><td class="seq">${w.rail ? `<b>${esc(w.rail)}</b><i>→</i>` : ''}${w.terms.map(x => esc(x.tag + ':' + x.term)).join('<i>→</i>')}</td><td><span class="sw" style="background:${c}"></span>${esc(t)}</td></tr>`; }).join('') + `</tbody></table>`;
      });
    } else {
      const map = {};
      R.wires.forEach(w => w.terms.forEach(x => { (map[x.tag] = map[x.tag] || []).push({ term: x.term, w }); }));
      h += `<table class="stack"><thead><tr><th>Thiết bị</th><th>Cực → dây</th></tr></thead><tbody>` + Object.keys(map).sort((a, b) => a.localeCompare(b, 'vi', { numeric: true })).map(tag =>
        `<tr><td class="tag">${esc(tag)}</td><td class="seq">${map[tag].sort((a, b) => String(a.term).localeCompare(String(b.term), 'vi', { numeric: true })).map(o => `${esc(o.term)} = <span class="wire" style="color:${wireColorTxt(o.w)[0]};height:20px;font-size:12px">${esc(o.w.name)}</span>`).join(' &nbsp; ')}</td></tr>`).join('') + `</tbody></table>`;
    }
    if (R.links.length) h += `<h3 class="secttl">Dây nối thêm (không vẽ trên sơ đồ)</h3><table class="stack"><thead><tr><th>Từ</th><th>Đến</th><th>Ghi chú</th></tr></thead><tbody>` + R.links.map(l => `<tr><td class="seq">${esc(l.a)}</td><td class="seq">${esc(l.b)}</td><td>${esc(l.note)}</td></tr>`).join('') + `</tbody></table>`;
    return h;
  }
  const SAFE0 = 'Cắt điện, khoá và treo biển (LOTO), kiểm tra không còn điện trước khi bắt đầu.';
  function paneSteps() {
    const r = S.result, steps = (r.steps || []).slice();
    if (!steps.some(s => /LOTO/.test(s))) steps.unshift(SAFE0);
    return `<div class="warn">Chỉ người có chuyên môn điện mới được đấu nối và đóng điện. Kiểm tra lại toàn bộ thông số với catalogue và tiêu chuẩn trước khi thi công.</div><ol class="steps">${steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` +
      `<p class="hint">Đấu theo tab “Bảng đấu dây”: mỗi dây số nối đúng các cực liệt kê, theo thứ tự từ trái sang phải.</p>`;
  }
  function paneCalc() {
    const r = S.result;
    return `<table class="stack"><thead><tr><th>Hạng mục</th><th>Kết quả</th></tr></thead><tbody>${(r.calcs || []).map(c => `<tr><td class="tag">${esc(c[0])}</td><td>${esc(c[1])}</td></tr>`).join('')}</tbody></table>` +
      `<p class="hint">Giả thiết: cáp đồng, IEC 60364-5-52 phương pháp lắp C ở 30 °C, nhân hệ số hiệu chỉnh đã nhập; sụt áp với ρ = 0.0225 Ω·mm²/m, x = 0.08 mΩ/m. Giới hạn sụt áp 5% (chiếu sáng 3%).</p>` +
      `<h3 class="secttl">Lưu ý</h3><ul class="notes">${(r.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
  }
  function drawPane() {
    if (!S.result) return;
    document.querySelectorAll('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.t === S.tab));
    $('pane').innerHTML = S.tab === 'bom' ? paneBom() : S.tab === 'wire' ? paneWire() : S.tab === 'steps' ? paneSteps() : paneCalc();
  }

  // ---------- export ----------
  const LIGHT = { '--paper': '#ffffff', '--ink': '#1b1f23', '--ink2': '#4a5258', '--grid': '#c9cdd1', '--line': '#1b1f23', '--accent': '#b97800', '--red': '#d62718', '--w-l1': '#8a4b1f', '--w-l2': '#1b1f23', '--w-l3': '#8c9298', '--w-n': '#1f63c6', '--w-pe': '#3a9b3a', '--w-ac': '#c8251b', '--w-dc': '#1f63c6', '--w-dc0': '#5a6a8a' };
  const svgExport = () => S.render.svg.replace(/var\((--[\w-]+)(?:,[^)]*)?\)/g, (m, k) => LIGHT[k] || '#000');
  function csv() {
    const rows = [['Mạch', 'Dây', 'Đấu lần lượt', 'Màu gợi ý']];
    S.render.wires.forEach(w => { if (!w.terms.length) return; rows.push([S.result.sections[w.sec] ? S.result.sections[w.sec].title : '', w.name, (w.rail ? w.rail + ' → ' : '') + w.terms.map(x => x.tag + ':' + x.term).join(' → '), wireColorTxt(w)[1]]); });
    S.render.links.forEach(l => rows.push(['Nối thêm', '', l.a + ' → ' + l.b, l.note]));
    return '﻿' + rows.map(r => r.map(c => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\r\n');
  }
  async function copy(text, msg) { try { await navigator.clipboard.writeText(text); toast(msg); } catch (e) { toast('Trình duyệt không cho sao chép'); } }
  let dl = null;
  const fname = ext => (S.result.title || 'so-do').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase() + '.' + ext;
  async function save(name, data) { try { await dl.save({ filename: name, data }); } catch (e) { toast('Chưa tải được tệp'); } }

  // ---------- AI ----------
  let sample = null;
  const AI_EX = ['Phòng ngủ có 2 đèn, quạt trần, 3 ổ cắm và bình nóng lạnh', 'Khi có người và trời tối thì đèn hành lang sáng', 'Bấm nút đèn cầu thang sáng 3 phút rồi tự tắt', 'Cảm biến có vật thì van khí nén đẩy xi lanh, sau 2 giây đèn báo sáng', 'Băng tải: nhấn Start chạy, Stop dừng, cuối băng có vật thì dừng, có đèn báo chạy', 'Khi có khói thì còi kêu và đèn cảnh báo sáng', 'Bơm 4 kW khi mực nước thấp thì chạy, đầy thì dừng', 'Động cơ 30 kW khởi động sao tam giác, có dừng khẩn', 'Tủ phân phối 5 lộ: 30, 22, 15, 7.5, 5.5 kW'];
  function aiPrompt(text) {
    const tplList = Lb.TPL.map(t => `- ${t.id}: ${t.name} — tham số: ${t.params.map(d => `${d.k} (${d.label}${d.unit ? ', ' + d.unit : ''}${d.opts ? ', chọn: ' + d.opts.join('/') : ''}; mặc định ${d.def})`).join('; ')}`).join('\n');
    const ex = JSON.stringify({ title: 'Khởi động trực tiếp 7.5 kW', sections: tplById('dol').build(curParams(tplById('dol'))).sections });
    const prev = $('aiCont').checked && S.result ? `\n\nSƠ ĐỒ ĐANG MỞ (người dùng muốn chỉnh tiếp từ đây):\n${JSON.stringify({ title: S.result.title, sections: S.result.sections, devices: S.result.devices }).slice(0, 9000)}` : '';
    return `Bạn là kỹ sư điện công nghiệp Việt Nam, vẽ sơ đồ theo ký hiệu IEC. Người dùng mô tả mạch cần làm. Trả về DUY NHẤT một đối tượng JSON, không có chữ nào khác.

CÁCH 1 — nếu yêu cầu khớp một mạch mẫu dưới đây (kể cả khi chỉ khác thông số), trả:
{"mode":"template","template":"<id>","params":{<k>:<giá trị>},"reply":"<1–2 câu tiếng Việt giải thích lựa chọn>"}
Mạch mẫu:
${tplList}

CÁCH 2 — nếu không khớp, tự thiết kế:
{"mode":"custom","reply":"<1–2 câu>","model":MODEL,"devices":[{"tag":"K1","type":"<loại>","spec":"<thông số định mức đã tính: A, kW, mm², điện áp cuộn…>","qty":1}],"calcs":[["Hạng mục","Kết quả có công thức ngắn"]],"steps":["các bước lắp đặt, đấu nối, cài đặt, chạy thử — cụ thể theo mạch"],"notes":["lưu ý an toàn/kỹ thuật"]}
MODEL = {"title":"…","sections":[SECTION…]} (1–4 section, động lực trước, điều khiển sau)
SECTION = {"title":"…","kind":"power|ac|dc|final","poles":["L1","L2","L3"] hoặc ["L"] hoặc ["+24V"],"bpoles":["N"] hoặc ["0V"],"top":true,"bottom":true/false,"net":SERIES}
SERIES = mảng phần tử nối tiếp, vẽ từ thanh cái trên xuống thanh cái dưới. Nhánh song song: {"par":[SERIES,SERIES,…]} ; thêm "open":"bottom" khi mỗi nhánh kết thúc ở tải riêng (không có thanh cái dưới), "open":"top" khi mỗi nhánh có nguồn riêng.
PHẦN TỬ = {"t":"<type>","tag":"K1","lbl":"mô tả ngắn ≤ 20 ký tự","act":"<actuator>","tt":["cực trên"],"bt":["cực dưới"]}
type 2 đầu: cb (CB/MCB/MCCB), rcbo, isol (cầu dao), km (tiếp điểm chính contactor), fuse, ol (phần tử nhiệt), no (tiếp điểm thường mở), nc (thường đóng), coil (cuộn hút contactor/rơ-le), tcoil (cuộn rơ-le thời gian), lamp (đèn), sock (ổ cắm), sw (công tắc), sw2 (bộ 2 công tắc 2 chiều, dùng "ttag","btag"), sensor (cảm biến 3 dây, tt ["BN"] bt ["BK"]), plcin (ngõ vào PLC, lbl = địa chỉ), plcout (ngõ ra rơ-le PLC, lbl = địa chỉ), psu (nguồn 24VDC), vfd (biến tần, trong section power), box2 (thiết bị 2 đầu khác), swap (đảo 2 pha, "swap":[0,2]).
type cuối nhánh (không có cực dưới): motor, motor6 (6 đầu dây), load (tải/lộ ra), vfdin (chân DI của biến tần, lbl "DI1"), meter, spd, short (nối tắt điểm sao). type đầu nhánh: src (nguồn), from (đi tới từ thiết bị khác, bt = tên cực).
act cho no/nc: push (nút nhấn), estop (dừng khẩn), sel (công tắc xoay), thermal (rơ-le nhiệt 95-96/97-98), timer, light (cảm biến ánh sáng), sensor, float (phao), key.
Quy tắc: cùng một thiết bị dùng cùng tag ở mọi nơi (cuộn K1 và tiếp điểm K1). Mạch điều khiển: poles ["L"], bpoles ["N"], top true, bottom true, bắt đầu bằng cb tag F… Dừng = nc act push; tự giữ = par của nút chạy và no của contactor; contactor đảo chiều phải khoá chéo. Không quá 8 nhánh song song mỗi par.
devices.type ∈ ${Object.keys(Lb.CAT).join(', ')}.
Tính dòng: 3 pha I = P/(√3·U·cosφ·η); CB ≥ 1.25·In; contactor AC-3 ≥ In; cáp đồng theo IEC 60364-5-52.
Ví dụ section hợp lệ (khởi động trực tiếp): ${ex}
Viết mọi chữ bằng tiếng Việt.${prev}

YÊU CẦU CỦA NGƯỜI DÙNG: ${text}`;
  }
  function parseJSON(t) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a < 0 || b < a) throw new Error('no json'); return JSON.parse(t.slice(a, b + 1)); }
  async function runAI() {
    const text = $('aiText').value.trim();
    if (!text) { $('aiStatus').textContent = 'Hãy mô tả mạch bạn cần.'; return; }
    if (!sample) { $('aiStatus').className = 'status err'; $('aiStatus').textContent = 'Chế độ AI chưa sẵn sàng ở chế độ xem này.'; return; }
    $('aiClaude').disabled = true; $('aiStatus').className = 'status'; $('aiStatus').textContent = 'AI đang thiết kế sơ đồ…'; $('aiReply').innerHTML = '';
    try {
      const prompt = aiPrompt(text);
      let v;
      if (typeof sample.json === 'function') v = await sample.json(prompt, { modelTier: 'complex' });
      else { const r = await sample(prompt, { modelTier: 'complex' }); v = parseJSON(r.text); }
      if (typeof v === 'string') v = parseJSON(v);
      applyAI(v);
    } catch (e) {
      $('aiStatus').className = 'status err';
      $('aiStatus').textContent = e && e.code === 'not_granted' ? 'Bạn chưa cho phép app dùng AI.' : e && e.code === 'rate_limited' ? 'Đang quá nhiều yêu cầu, thử lại sau ít phút.' : 'AI chưa trả về sơ đồ hợp lệ — thử mô tả rõ hơn (công suất, điện áp, cách điều khiển).';
    } finally { $('aiClaude').disabled = false; }
  }
  // fresh = bắt đầu từ giá trị mặc định (mô tả mới), không giữ thông số lần trước
  function applyTemplate(id, vals, fresh) {
    const t = tplById(id), p = fresh ? {} : curParams(t);
    if (fresh) t.params.forEach(d => { p[d.k] = d.def; });
    t.params.forEach(d => { if (vals && vals[d.k] !== undefined) { let x = vals[d.k]; if (d.type === 'num') { x = parseFloat(x); if (!isFinite(x)) return; x = Math.min(d.max, Math.max(d.min, x)); } if (d.type === 'sel' && !d.opts.map(String).includes(String(x))) return; if (d.type === 'sel' && typeof d.def === 'number') x = Number(x); p[d.k] = x; } });
    S.params[t.id] = p; S.tpl = t.id; S.cat = t.cat; S.ai = null;
    drawCats(); drawParams(); buildFromTemplate();
    return t;
  }
  function runRules() {
    const text = $('aiText').value.trim();
    $('aiReply').innerHTML = ''; $('aiStatus').className = 'status';
    const r = window.CircuitNLP.parse(text);
    if (r.error) { $('aiStatus').className = 'status err'; $('aiStatus').textContent = r.error; return; }
    if (r.custom) { S.result = Object.assign({ source: 'rules' }, r.custom); S.ai = true; drawCats(); drawSheet(true); }
    else applyTemplate(r.tpl, r.params, true);
    $('aiStatus').textContent = '';
    const box = document.createElement('div'); box.className = 'reply';
    const add = (title, items) => { if (!items.length) return; const b = document.createElement('b'); b.textContent = title; box.appendChild(b); const ul = document.createElement('ul'); items.forEach(x => { const li = document.createElement('li'); li.textContent = x; ul.appendChild(li); }); box.appendChild(ul); };
    add('Đã hiểu', r.got);
    add('Chưa nói rõ — dùng giá trị mặc định', r.dft);
    add('Lưu ý', r.notes);
    const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = r.custom ? 'Hiểu chưa đúng? Tách mỗi ý một vế bằng dấu phẩy, theo mẫu “khi … thì … bật/tắt”, rồi bấm Vẽ sơ đồ lại.' : 'Hiểu chưa đúng? Viết rõ điều kiện theo mẫu “khi … thì chạy”, “khi … thì dừng”, hoặc chỉnh trực tiếp trong Thông số chi tiết.'; box.appendChild(hint);
    if (!r.custom) { const btn = document.createElement('button'); btn.className = 'btn ghost'; btn.textContent = 'Chỉnh thông số chi tiết'; btn.onclick = () => setMode('tpl'); box.appendChild(btn); }
    $('aiReply').replaceChildren(box);
    if (window.matchMedia('(max-width:900px)').matches) $('title').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function applyAI(v) {
    const reply = String(v.reply || '').slice(0, 600);
    if (v.mode === 'template' && Lb.TPL.some(t => t.id === v.template)) {
      const t = applyTemplate(v.template, v.params, false);
      $('aiStatus').textContent = `Đã dùng mạch mẫu “${t.name}” — có thể chỉnh thông số ở tab Mạch mẫu.`;
    } else {
      const model = E.sanitize(v.model || v);
      if (!model.sections.length) throw new Error('empty');
      const okType = t => Lb.CAT[t] ? t : 'terminal';
      const str = (x, n) => String(x == null ? '' : x).slice(0, n);
      S.result = {
        title: model.title, sections: model.sections, source: 'ai',
        devices: (Array.isArray(v.devices) ? v.devices : []).slice(0, 40).map(d => ({ tag: str(d.tag, 20), type: okType(d.type), spec: str(d.spec, 300), qty: Math.max(1, Math.min(999, parseInt(d.qty) || 1)) })),
        calcs: (Array.isArray(v.calcs) ? v.calcs : []).slice(0, 20).map(c => [str(c[0], 80), str(c[1], 300)]),
        steps: (Array.isArray(v.steps) ? v.steps : []).slice(0, 20).map(s => str(s, 400)),
        notes: [...(Array.isArray(v.notes) ? v.notes : []).slice(0, 10).map(s => str(s, 300)), 'Sơ đồ do AI thiết kế: kiểm tra kỹ logic, khoá liên động và định mức thiết bị trước khi thi công.']
      };
      S.ai = true; drawCats(); drawSheet(true);
      $('aiStatus').textContent = 'Đã vẽ sơ đồ theo mô tả.';
    }
    if (reply) { const d = document.createElement('div'); d.className = 'reply'; d.textContent = reply; $('aiReply').replaceChildren(d); }
  }

  // ---------- events ----------
  function setMode(m) {
    S.mode = m; $('mTpl').setAttribute('aria-pressed', m === 'tpl'); $('mAi').setAttribute('aria-pressed', m === 'ai');
    $('tplCard').hidden = m !== 'tpl'; $('paramCard').hidden = m !== 'tpl'; $('aiCard').hidden = m !== 'ai';
  }
  $('mTpl').onclick = () => { setMode('tpl'); if (S.ai) { S.ai = null; drawCats(); buildFromTemplate(); } };
  $('mAi').onclick = () => setMode('ai');
  $('cats').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; S.cat = b.dataset.c; const first = Lb.TPL.find(t => t.cat === S.cat); S.tpl = first.id; S.ai = null; drawCats(); drawParams(); buildFromTemplate(); };
  $('tpls').onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; S.tpl = b.dataset.id; S.ai = null; drawCats(); drawParams(); buildFromTemplate(); };
  let deb; $('params').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(buildFromTemplate, 250); });
  $('params').addEventListener('submit', e => e.preventDefault());
  $('params').addEventListener('click', e => { if (e.target.id === 'pReset') { delete S.params[S.tpl]; store.set('params', S.params); drawParams(); buildFromTemplate(); } });
  $('brands').innerHTML = Lb.BRANDS.map(b => `<button class="chip" data-b="${b.id}" aria-pressed="${b.id === S.brand}">${esc(b.name)}</button>`).join('');
  $('brands').onclick = e => { const b = e.target.closest('[data-b]'); if (!b) return; S.brand = b.dataset.b; store.set('brand', S.brand); $('brands').querySelectorAll('.chip').forEach(c => c.setAttribute('aria-pressed', c.dataset.b === S.brand)); S.tab = 'bom'; drawPane(); };
  $('cmp').onchange = e => { S.cmp = e.target.checked; S.tab = 'bom'; drawPane(); };
  ['oColor', 'oTerm', 'oWire'].forEach(id => $(id).onchange = () => drawSheet(false));
  const HASH = { bom: 'thiet-bi', wire: 'dau-day', steps: 'cac-buoc', calc: 'tinh-toan' };
  const fromHash = () => { const h = location.hash.slice(1); const k = Object.keys(HASH).find(x => HASH[x] === h); if (k) { S.tab = k; drawPane(); } };
  window.addEventListener('hashchange', fromHash);
  document.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-t]'); if (!b) return; S.tab = b.dataset.t; try { history.replaceState(null, '', '#' + HASH[S.tab]); } catch (er) { } drawPane(); };
  $('pane').addEventListener('click', e => {
    const wv = e.target.closest('[data-wv]'); if (wv) { S.wireView = wv.dataset.wv; drawPane(); return; }
    if (e.target.id === 'cpCsv') copy(csv(), 'Đã sao chép bảng đấu dây (CSV)');
    if (e.target.id === 'dlCsv' && dl) save(fname('csv'), csv());
  });
  $('zIn').onclick = () => { S.zoom = Math.min(3, S.zoom * 1.2); applyZoom(); };
  $('zOut').onclick = () => { S.zoom = Math.max(0.25, S.zoom / 1.2); applyZoom(); };
  $('zFit').onclick = fitZoom;
  $('cpSvg').onclick = () => copy(svgExport(), 'Đã sao chép SVG — dán vào Inkscape/Visio/Word');
  $('dlSvg').onclick = () => dl && save(fname('svg'), svgExport());
  $('aiGo').onclick = runRules;
  $('aiClaude').onclick = runAI;
  $('aiText').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) runRules(); });
  $('aiEx').innerHTML = AI_EX.map((x, i) => `<button class="chip" data-x="${i}">${esc(x.length > 38 ? x.slice(0, 36) + '…' : x)}</button>`).join('');
  $('aiEx').onclick = e => { const b = e.target.closest('[data-x]'); if (b) { $('aiText').value = AI_EX[+b.dataset.x]; $('aiText').focus(); } };
  let rz; new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { if (S.render && S.autoFit !== false) fitZoom(); }, 150); }).observe($('viewer'));
  ['zIn', 'zOut'].forEach(id => $(id).addEventListener('click', () => { S.autoFit = false; }));
  $('zFit').addEventListener('click', () => { S.autoFit = true; });

  // ---------- capabilities ----------
  if (window.claude && claude.use) {
    claude.use('sample').then(s => { sample = s; if (s) { $('aiClaude').hidden = false; $('aiOnly').hidden = false; } }).catch(() => { });
    claude.use('downloads').then(d => { dl = d; if (d) { $('dlSvg').hidden = false; if (S.tab === 'wire') drawPane(); } }).catch(() => { });
  }

  drawCats(); drawParams(); buildFromTemplate(); fromHash();
}
