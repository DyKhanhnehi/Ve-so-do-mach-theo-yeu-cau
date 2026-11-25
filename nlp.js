/* Xưởng Vẽ Mạch — hiểu mô tả tiếng Việt bằng luật kinh nghiệm (không cần AI, chạy offline) */
(function (G) {
  'use strict';
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2').replace(/[–—]/g, '-').replace(/\s+/g, ' ');
  const has = (n, re) => re.test(n);
  const num = (n, re) => { const m = n.match(re); return m ? parseFloat(m[1]) : null; };
  const WORDNUM = { mot: 1, hai: 2, ba: 3, bon: 4, nam: 5, sau: 6, bay: 7, tam: 8 };
  const count = (n, words) => {
    const re = new RegExp('(\\d+|mot|hai|ba|bon|nam|sau|bay|tam)\\s*(?:cai |chiec |con |bo )?(?:' + words + ')');
    const m = n.match(re); if (!m) return null; return WORDNUM[m[1]] || parseInt(m[1]);
  };

  const RE = {
    plc: /\bplc\b/,
    ats: /\bats\b|may phat|chuyen nguon|(2|hai) nguon|nguon du phong/,
    dist: /tu phan phoi|tu dien tong|tu tong|\bmsb\b|\bdb\b|phan phoi|\d+\s*lo\b|lo ra|xuat tuyen|feeder/,
    lightW: /chieu sang|o cam|cau thang|bong den|\bden (led|tuyp|pha|duong|nha|xuong|hanh lang|san|ngoai)|\d+\s*(mach |lo )?den\b|mach den|he thong den|bat den|tat den/,
    motorW: /dong co|motor|\bbom\b|quat|bang tai|may nen|may khuay|may nghien|bien tan|sao.{0,3}tam giac|dao chieu|khoi dong|cau truc|palang|tang ap|bom nuoc|\bkw\b.*(chay|dung)/,
    vfd: /bien tan|inverter|\bvfd\b|\bvsd\b|dieu chinh toc do|thay doi toc do|(\d|hai|ba) (cap )?toc do|nhieu toc do/,
    sd: /sao.{0,3}(tam giac|delta)|\by.{0,2}(delta|tam giac|Δ|d)\b|star.?delta/,
    rev: /dao chieu|thuan.{0,5}nghich|(2|hai) chieu quay|quay (2|hai) chieu|len.{0,5}xuong|tien.{0,5}lui|dong.{0,5}mo (cua|cong)|cuon.{0,5}nha/,
    soft: /khoi dong mem|soft.?start/,
    estop: /dung khan|khan cap|e.?stop|emergency|nam dung/,
    horn: /\bcoi\b|chuong|buzzer|bao truoc|canh bao truoc/,
    manauto: /tay.{0,6}tu dong|tu dong.{0,6}tay|\bman\b.{0,5}\bauto\b|\bauto\b|tu dong/,
    float: /phao|muc nuoc|be nuoc|bon nuoc|bon chua|ho nuoc|float|day be|can be/,
    press: /ap suat|ap luc|pressure|tang ap/,
    temp: /nhiet do|thermostat|lam mat|qua nhiet do|giai nhiet/,
    sched: /hen gio|theo gio|\btimer\b|lich chay|theo lich/,
    sens: /cam bien|sensor|tiem can|cam bien quang/,
    ext: /\bplc\b|\bbms\b|scada|tin hieu ngoai|lenh ngoai/
  };

  function parse(text) {
    const n = norm(text);
    const got = [], dft = [], notes = [];
    if (n.trim().length < 3) return { error: 'Hãy mô tả mạch bạn cần (loại tải, công suất, cách điều khiển).' };

    let kW = num(n, /(\d+(?:\.\d+)?)\s*(?:kw|kilo ?wat)/);
    const hp = num(n, /(\d+(?:\.\d+)?)\s*(?:hp|ma luc|ngua)\b/);
    const kva = num(n, /(\d+(?:\.\d+)?)\s*kva/);
    if (kW == null && hp != null) { kW = Math.round(hp * 0.746 * 100) / 100; got.push(`${hp} HP ≈ ${kW} kW`); }
    const U = num(n, /\b(220|230|380|400|415)\s*v/);
    const L = num(n, /(\d+(?:\.\d+)?)\s*(?:m|met)\b/);
    const sec = num(n, /(\d+(?:\.\d+)?)\s*(?:s|giay|sec)\b/);
    const ik = num(n, /(\d+(?:\.\d+)?)\s*ka\b/);
    const W = num(n, /(\d+(?:\.\d+)?)\s*w\b/);

    const isPLC = has(n, RE.plc) && (has(n, /cam bien|nut|ngo vao|dau vao|ngo ra|dau ra|\bi\/?o\b|\bdi\b|\bdo\b/) || !has(n, RE.motorW));
    const lightOnly = has(n, RE.lightW) && !has(n, RE.motorW);
    let tpl;
    if (isPLC) tpl = 'plc';
    else if (has(n, RE.ats)) tpl = 'ats';
    else if (lightOnly) tpl = has(n, /cau thang|(2|hai) (noi|vi tri|cho|dau)|cong tac (2|hai) chieu/) ? 'stair' : has(n, /tu dong|cam bien anh sang|anh sang|troi toi|hen gio|theo gio|\btimer\b|photocell|quang/) ? 'autolight' : 'light';
    else if (has(n, RE.dist) && !has(n, /bien tan|sao.{0,3}tam giac|dao chieu/)) tpl = 'dist';
    else if (has(n, RE.motorW) || kW != null || hp != null) {
      if (has(n, RE.vfd)) tpl = 'vfd'; else if (has(n, RE.sd)) tpl = 'sd'; else if (has(n, RE.rev)) tpl = 'rev'; else tpl = 'dol';
      if (has(n, RE.soft)) { notes.push('Chưa có mạch mẫu khởi động mềm — đã dùng ' + (tpl === 'dol' ? (kW >= 15 ? 'sao–tam giác' : 'khởi động trực tiếp') : 'mạch gần nhất') + '; khởi động mềm đấu giống biến tần ở mạch động lực.'); if (tpl === 'dol' && kW >= 15) tpl = 'sd'; }
    } else {
      return { error: 'Chưa nhận ra loại mạch. Hãy nêu rõ tải (động cơ/bơm/quạt, đèn, tủ phân phối, ATS, PLC) và công suất, ví dụ: “bơm 5,5 kW chạy theo phao, có dừng khẩn”.' };
    }

    const p = {};
    const NAME = { dol: 'Khởi động trực tiếp', rev: 'Đảo chiều', sd: 'Sao – tam giác', vfd: 'Biến tần', dist: 'Tủ phân phối', ats: 'ATS chuyển nguồn', light: 'Tủ chiếu sáng + ổ cắm', stair: 'Đèn cầu thang 2 nơi', autolight: 'Chiếu sáng tự động', plc: 'PLC ngõ vào/ra' };
    got.unshift('Mạch: ' + NAME[tpl]);
    if (U && tpl !== 'light' && tpl !== 'stair') { if ([380, 400, 415].includes(U)) { p.U = U; got.push(`Điện áp ${U} V`); } }

    if (['dol', 'rev', 'sd', 'vfd'].includes(tpl)) {
      if (kW != null) { p.kW = kW; got.push(`Công suất ${kW} kW`); } else dft.push('công suất (dùng mặc định)');
      if (L != null) { p.L = L; got.push(`Cáp dài ${L} m`); }
      if (ik != null) { p.ik = ik; got.push(`Ngắn mạch ${ik} kA`); }
      if (has(n, RE.estop)) { p.estop = 'Có'; got.push('Nút dừng khẩn'); }
      if (tpl === 'vfd') {
        p.dir = has(n, RE.rev) ? 'Thuận / nghịch' : 'Chỉ chạy thuận'; got.push(p.dir === 'Chỉ chạy thuận' ? 'Chạy 1 chiều' : 'Chạy thuận/nghịch');
        const sp = has(n, /(3|ba) (cap )?toc do/) ? 3 : has(n, /(2|hai) (cap )?toc do/) ? 2 : 0;
        p.spd = sp ? sp + ' cấp (công tắc)' : 'Biến trở'; got.push(sp ? `${sp} cấp tốc độ đặt trước` : 'Chỉnh tốc độ bằng biến trở');
        p.duty = has(n, /\bbom\b|quat|thong gio|hut/) ? 'Nhẹ (bơm, quạt)' : 'Nặng (băng tải, máy)'; got.push('Tải ' + (p.duty.startsWith('Nhẹ') ? 'nhẹ (bơm/quạt)' : 'nặng'));
        if (has(n, RE.horn) || has(n, RE.float) || has(n, RE.press)) notes.push('Mạch biến tần chưa ghép còi báo/phao/áp suất — có thể dùng ngõ vào DI của biến tần cho các tín hiệu này (cài trong thông số).');
      } else {
        if (tpl !== 'rev') {
          let src = null;
          if (has(n, RE.float)) src = 'Phao (mực nước)'; else if (has(n, RE.press)) src = 'Công tắc áp suất'; else if (has(n, RE.temp)) src = 'Rơ-le nhiệt độ';
          else if (has(n, RE.sched)) src = 'Hẹn giờ'; else if (has(n, RE.sens)) src = 'Cảm biến'; else if (has(n, RE.ext)) src = 'Tín hiệu ngoài (PLC/BMS)';
          else if (has(n, RE.manauto)) { src = 'Tín hiệu ngoài (PLC/BMS)'; dft.push('nguồn tín hiệu tự động (dùng tiếp điểm ngoài)'); }
          if (src) { p.auto = src; got.push('TAY/TỰ ĐỘNG theo ' + src.toLowerCase()); }
        } else if (has(n, RE.float) || has(n, RE.press) || has(n, RE.manauto)) notes.push('Mạch đảo chiều chưa ghép chế độ tự động — dùng mạch khởi động trực tiếp nếu chỉ cần 1 chiều.');
        if (tpl === 'dol' && has(n, RE.horn)) { p.horn = sec || 5; got.push(`Còi báo trước ${p.horn} s`); if (!sec) dft.push('thời gian còi (5 s)'); }
        else if (has(n, RE.horn)) notes.push('Còi báo trước khi chạy hiện chỉ ghép sẵn cho mạch khởi động trực tiếp.');
        if (tpl === 'sd' && sec) { p.ts = sec; got.push(`Chuyển Y→Δ sau ${sec} s`); }
      }
      if (tpl === 'dol' && kW > 15) notes.push(`Động cơ ${kW} kW khởi động trực tiếp có dòng khởi động lớn — nếu muốn, ghi thêm “sao tam giác” hoặc “biến tần” vào mô tả.`);
    }
    if (tpl === 'dist') {
      const cnt = count(n, 'lo\\b');
      const toks = [...n.matchAll(/(\d+(?:\.\d+)?)(\s*)([a-z%]*)/g)].filter(m => {
        const u = m[3];
        if (/^(lo|v|ka|kva|m|met|s|giay|a|mm|hz|%)$/.test(u)) return false;
        if (/^(lo|v|ka|m)/.test(u) && u !== 'kw') return false;
        return parseFloat(m[1]) > 0.09;
      }).map(m => parseFloat(m[1]));
      let f = toks.filter(v => v < 2000);
      if (cnt && f.length > cnt) f = f.slice(-cnt);
      if (f.length) { p.feeders = f.join(', '); got.push(`${f.length} lộ: ${f.join(', ')} kW`); }
      else if (cnt) { p.feeders = Array(Math.min(cnt, 8)).fill(10).join(', '); got.push(`${cnt} lộ`); dft.push('công suất từng lộ (10 kW mỗi lộ)'); }
      else dft.push('các lộ ra (dùng mặc định)');
      if (has(n, /khong.{0,10}(chong set|spd)/)) p.spd = 'Không';
      if (has(n, /khong.{0,10}(dong ho|meter)/)) p.meter = 'Không';
      if (ik != null) { p.ik = ik; got.push(`Ngắn mạch ${ik} kA`); }
      const ks = num(n, /ks\s*=?\s*(0?\.\d+)/); if (ks) { p.ks = ks; got.push('ks = ' + ks); }
    }
    if (tpl === 'ats') {
      if (kW != null) { p.kW = kW; got.push(`Tải ${kW} kW`); } else if (kva != null) { p.kW = Math.round(kva * 0.8); got.push(`Máy phát ${kva} kVA → tải ≈ ${p.kW} kW`); } else dft.push('công suất tải');
    }
    if (tpl === 'light') {
      const nL = count(n, 'mach den|lo den|mach chieu sang|day den'); const nS = count(n, '(?:mach )?o cam');
      if (nL) { p.nL = nL; got.push(`${nL} mạch đèn`); } else dft.push('số mạch đèn');
      if (nS != null) { p.nS = nS; got.push(`${nS} mạch ổ cắm`); } else if (!has(n, /o cam/)) p.nS = 0;
      if (W) { p.wL = W; got.push(`${W} W mỗi mạch`); } else if (kW && (p.nL || 3)) { p.wL = Math.round(kW * 1000 / (p.nL || 3)); got.push(`Tổng ${kW} kW`); }
    }
    if (tpl === 'stair') {
      const nb = count(n, 'bong|den'); if (nb) { p.n = Math.min(3, nb); got.push(`${p.n} bóng`); }
      if (W) { p.w = W; got.push(`${W} W/bóng`); }
    }
    if (tpl === 'autolight') {
      const nb = count(n, 'bong|den');
      if (kW != null) { p.kW = kW; got.push(`Tổng ${kW} kW`); } else if (nb && W) { p.kW = Math.round(nb * W / 100) / 10; got.push(`${nb} × ${W} W = ${p.kW} kW`); } else dft.push('tổng công suất đèn');
    }
    if (tpl === 'plc') {
      const nSn = count(n, 'cam bien|sensor|tiem can'); const nB = count(n, 'nut'); const nK = count(n, 'contactor|khoi dong tu|dong co|motor|bom|quat|van');
      const nH = count(n, 'den');
      if (nSn != null) { p.nSn = nSn; got.push(`${nSn} cảm biến`); } if (nB != null) { p.nB = nB; got.push(`${nB} nút nhấn`); }
      if (nK != null) { p.nK = nK; got.push(`${nK} ngõ ra contactor`); } if (nH != null) { p.nH = nH; got.push(`${nH} đèn báo`); }
      if (has(n, /\bnpn\b/)) { p.st = 'NPN'; got.push('Cảm biến NPN'); } else if (has(n, /\bpnp\b/)) { p.st = 'PNP'; got.push('Cảm biến PNP'); } else if (nSn) dft.push('loại cảm biến (PNP)');
      if (has(n, /nguon (plc )?(220|ac)|plc (220|ac)/)) { p.pw = '220 VAC'; got.push('PLC nguồn 220 VAC'); }
    }
    return { tpl, params: p, got, dft, notes };
  }
  G.CircuitNLP = { parse, norm };
})(typeof window !== 'undefined' ? window : globalThis);
