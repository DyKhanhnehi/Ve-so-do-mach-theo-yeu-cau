/* Xưởng Vẽ Mạch — tính toán, danh mục hãng, mạch mẫu */
(function (G) {
  'use strict';
  const SQ3 = Math.sqrt(3);
  const STD_MCB = [1, 2, 3, 4, 6, 10, 16, 20, 25, 32, 40, 50, 63];
  const STD_MCCB = [16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160, 200, 250, 320, 400, 500, 630, 800, 1000, 1250, 1600];
  const STD_ACB = [630, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000];
  const STD_KM = [9, 12, 18, 25, 32, 38, 40, 50, 65, 80, 95, 115, 150, 185, 225, 265, 330, 400, 500, 630];
  const STD_KW = [0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250];
  const STD_KVA = [20, 30, 45, 60, 80, 100, 125, 150, 200, 250, 300, 400, 500, 625, 750, 1000, 1250, 1500, 2000, 2500];
  const OL = [[0.1, 0.16], [0.16, 0.25], [0.25, 0.4], [0.4, 0.63], [0.63, 1], [1, 1.6], [1.6, 2.5], [2.5, 4], [4, 6], [5.5, 8], [7, 10], [9, 13], [12, 18], [16, 24], [23, 32], [30, 38], [37, 50], [48, 65], [55, 70], [63, 80], [80, 104], [95, 120], [110, 140]];
  const SIZES = [1.5, 2.5, 4, 6, 10, 16, 25, 35, 50, 70, 95, 120, 150, 185, 240, 300];
  // IEC 60364-5-52, Cu, phương pháp lắp đặt C (đi trên tường/khay không đục lỗ), 30 °C
  const AMP = {
    PVC: { 3: [17.5, 24, 32, 41, 57, 76, 96, 119, 144, 184, 223, 259, 299, 341, 403, 464], 2: [19.5, 27, 36, 46, 63, 85, 112, 138, 168, 213, 258, 299, 344, 392, 461, 530] },
    XLPE: { 3: [22, 30, 40, 51, 70, 94, 119, 148, 180, 232, 282, 328, 379, 434, 514, 593], 2: [24, 33, 45, 58, 80, 107, 138, 171, 209, 269, 328, 382, 441, 506, 599, 693] }
  };
  const r1 = v => Math.round(v * 10) / 10;
  const pick = (arr, v) => arr.find(a => a >= v - 1e-9);

  function motorPf(kW) {
    if (kW <= 1.5) return [0.78, 0.8]; if (kW <= 4) return [0.82, 0.85]; if (kW <= 11) return [0.85, 0.88];
    if (kW <= 37) return [0.87, 0.91]; if (kW <= 110) return [0.88, 0.93]; return [0.89, 0.95];
  }
  function motorIn(kW, U, cos, eta) { return kW * 1000 / (SQ3 * U * cos * eta); }

  function cbFor(I, poles, ik, o) {
    o = o || {};
    const need = I * (o.factor || 1.25);
    let type, In, icu, curve = '';
    if (need <= 63 && ik <= 25 && !o.mccb) { type = 'mcb'; In = Math.max(pick(STD_MCB, need), o.min || 0); icu = pick([6, 10, 15, 25], ik) || 25; curve = o.curve ? ', đường cong ' + o.curve : ''; }
    else if (need <= (o.acbAbove || 1600)) { type = 'mccb'; In = pick(STD_MCCB, Math.max(need, 16)); icu = pick([25, 36, 50, 70, 100], ik) || 100; }
    else { type = 'acb'; In = pick(STD_ACB, need) || 4000; icu = pick([50, 65, 85, 100], ik) || 100; }
    const T = type.toUpperCase();
    return { type, In, icu, short: `${T} ${poles}P ${In}A`, spec: `${T} ${poles}P, In = ${In} A${curve}, Icu ≥ ${icu} kA` };
  }
  function kmFor(I) { return pick(STD_KM, I) || 630; }
  function olFor(I) {
    const c = OL.filter(r => r[0] <= I && I <= r[1]);
    if (!c.length) return null;
    c.sort((a, b) => Math.abs(I - (a[0] + a[1]) / 2) / (a[1] - a[0]) - Math.abs(I - (b[0] + b[1]) / 2) / (b[1] - b[0]));
    return c[0];
  }
  function dropPct(Ib, L, S, par, U, phase, cos) {
    const rho = 0.0225, X = 0.00008, sin = Math.sqrt(1 - cos * cos);
    const z = (rho / (S * par)) * cos + (X / par) * sin;
    return (phase === 3 ? SQ3 : 2) * Ib * L * z / U * 100;
  }
  function cable(o) {
    const tbl = AMP[o.ins || 'PVC'][o.phase === 1 ? 2 : 3];
    const k = o.k || 1, lim = o.dUmax || 5, minS = o.minS || 1.5;
    let last;
    for (let par = 1; par <= 4; par++) for (let i = 0; i < SIZES.length; i++) {
      const S = SIZES[i]; if (S < minS) continue; if (par > 1 && S < 95) continue;
      const Iz = tbl[i] * k * par;
      if (Iz < o.Icb) continue;
      const dU = dropPct(o.Ib, o.L, S, par, o.U, o.phase, o.cos || 0.85);
      last = { S, par, Iz: r1(Iz), dU: Math.round(dU * 100) / 100, ok: dU <= lim };
      if (dU <= lim) return last;
    }
    return last || { S: 300, par: 4, Iz: 0, dU: 0, ok: false };
  }
  const cabTxt = (c, cores) => `${c.par > 1 ? c.par + ' × ' : ''}Cu/${cores} ${c.S} mm²`;

  // ---------- hãng ----------
  const BRANDS = [
    { id: 'sch', name: 'Schneider', note: 'Phổ biến nhất ở VN, dễ mua, đủ hệ (CB → contactor → biến tần → PLC). Có bảng phối hợp Type 2 đầy đủ.' },
    { id: 'ls', name: 'LS Electric', note: 'Hàn Quốc, giá tốt, rất hay gặp trong nhà máy Hàn. Mạnh ở CB, contactor, biến tần, PLC XGT.' },
    { id: 'abb', name: 'ABB', note: 'Cao cấp, bền, mạnh ở ACB/MCCB tủ lớn, biến tần ACS. Giá cao hơn.' },
    { id: 'sie', name: 'Siemens', note: 'Cao cấp, hệ sinh thái TIA Portal (S7-1200/1500 + SINAMICS) rất mạnh cho tự động hoá.' },
    { id: 'mit', name: 'Mitsubishi', note: 'Mạnh về PLC (iQ-F/FX5U), biến tần FR, servo. Thiết bị đóng cắt có nhưng ít đại lý hơn.' },
    { id: 'omr', name: 'Omron', note: 'Mạnh về cảm biến, rơ-le, timer, nút nhấn, PLC nhỏ. Không làm CB/ACB.' }
  ];
  const CAT = {
    mcb: { name: 'MCB', sch: 'Acti9 iC60N / Easy9', ls: 'BKN, BKN-b', abb: 'S200 (S201–S204)', sie: '5SL6 / 5SY', mit: 'BH-D6 / BH-D10' },
    mccb: { name: 'MCCB', sch: 'EasyPact CVS / ComPacT NSX', ls: 'Metasol ABN/ABS, Susol TD/TS', abb: 'Tmax XT (XT1–XT4)', sie: 'SENTRON 3VA', mit: 'WS-V (NF-CV/NF-SV)' },
    acb: { name: 'ACB', sch: 'MasterPacT MTZ / EasyPact MVS', ls: 'Metasol AN/AS, Susol AH', abb: 'Emax 2 (E1.2–E6.2)', sie: 'SENTRON 3WA / 3WL', mit: 'World Super AE-SW' },
    mpcb: { name: 'CB bảo vệ động cơ', sch: 'TeSys GV2 / GV3', ls: 'Metasol MMS', abb: 'MS132 / MS165', sie: 'SIRIUS 3RV2', mit: 'MMP-T' },
    rcbo: { name: 'RCBO', sch: 'Acti9 iDPN N Vigi / Easy9 RCBO', ls: 'RKP (RCBO)', abb: 'DS201 / DS203NC', sie: '5SU1', mit: 'BV-D' },
    contactor: { name: 'Contactor', sch: 'TeSys Deca LC1D / TeSys Giga', ls: 'Metasol MC', abb: 'AF (AF09…)', sie: 'SIRIUS 3RT2', mit: 'MS-T / MS-N', omr: 'J7KNA' },
    overload: { name: 'Rơ-le nhiệt', sch: 'TeSys LRD / LR9 (điện tử)', ls: 'Metasol MT / GMP (điện tử)', abb: 'TF42 / TF65 / EF (điện tử)', sie: 'SIRIUS 3RU2 / 3RB3', mit: 'TH-T / TH-N', omr: 'J7TKN' },
    pb: { name: 'Nút nhấn Ø22', sch: 'Harmony XB5 / XB7', abb: 'Modular MP / Compact CP', sie: 'SIRIUS ACT 3SU1', omr: 'A22N' },
    sel: { name: 'Công tắc xoay Ø22', sch: 'Harmony XB5AD / XB7ND', abb: 'Modular M2SS', sie: 'SIRIUS ACT 3SU1', omr: 'A22NS' },
    pilot: { name: 'Đèn báo Ø22', sch: 'Harmony XB7EV / XB5AV', abb: 'Compact CL2 / Modular', sie: 'SIRIUS ACT 3SU1', omr: 'M22N' },
    vfd: { name: 'Biến tần', sch: 'Altivar ATV320 / ATV630 (bơm-quạt)', ls: 'LSLV G100 / S100 / H100', abb: 'ACS580 / ACS380 / ACS180', sie: 'SINAMICS G120C / V20', mit: 'FR-E800 / FR-A800 / FR-F800', omr: '3G3MX2 / 3G3M1' },
    plc: { name: 'PLC', sch: 'Modicon M221 / M241', ls: 'XGB / XGK / XGI', abb: 'AC500 / AC500-eCo', sie: 'SIMATIC S7-1200 / S7-1500', mit: 'MELSEC iQ-F (FX5U) / iQ-R', omr: 'CP2E / NX1P2 / NJ' },
    psu: { name: 'Nguồn 24 VDC', sch: 'Modicon Power / Phaseo ABL', abb: 'CP-E / CP-T', sie: 'SITOP PSU', omr: 'S8VK' },
    relay: { name: 'Rơ-le trung gian', sch: 'Zelio RXM / RSB', abb: 'CR-M / CR-P', sie: 'SIRIUS 3RQ / LZX', omr: 'MY / G2R / G2RV' },
    timer: { name: 'Rơ-le thời gian', sch: 'Zelio RE17 / RE22', abb: 'CT-E / CT-S', sie: 'SIRIUS 3RP2', omr: 'H3CR / H3Y' },
    sensor_ind: { name: 'Cảm biến tiệm cận', sch: 'Telemecanique OsiSense XS', sie: 'SIMATIC PXI', omr: 'E2E / E2EN', alt: 'Autonics PR, Keyence, Sick' },
    sensor_photo: { name: 'Cảm biến quang', sch: 'Telemecanique OsiSense XU', sie: 'SIMATIC PXO', omr: 'E3Z / E3JK', alt: 'Autonics BJ/BEN, Keyence, Sick' },
    spd: { name: 'Chống sét lan truyền', sch: 'Acti9 iPRD / iPF', abb: 'OVR T2', sie: 'SENTRON 5SD7', alt: 'Phoenix Contact, Dehn, OBO' },
    meter: { name: 'Đồng hồ đa năng', sch: 'PowerLogic PM2000 / PM5000', abb: 'M4M', sie: 'SENTRON PAC2200 / PAC3200', mit: 'ME96', omr: 'KM-N2 / KM50', alt: 'Selec, Mikro' },
    ats: { name: 'ATS', sch: 'TransferPacT', abb: 'TruONE ATS', sie: 'SENTRON 3KC ATC', alt: 'Socomec ATyS, Osung' },
    time_switch: { name: 'Đồng hồ hẹn giờ', sch: 'Acti9 IHP / IH', sie: 'SENTRON 7LF4', omr: 'H5L', alt: 'Theben, Kawasan' },
    photocell: { name: 'Cảm biến ánh sáng', sch: 'Acti9 IC (photocell)', alt: 'Theben, Kawasan' },
    lc: { name: 'Contactor modul', sch: 'Acti9 iCT', abb: 'ESB / EN', sie: '5TT5' },
    switch: { name: 'Công tắc / ổ cắm', sch: 'AvatarOn / Zencelo', abb: 'Zenit', alt: 'Panasonic, Sino' },
    pir: { name: 'Cảm biến chuyển động', sch: 'Argus (cảm biến hiện diện)', alt: 'Kawasan, Panasonic, Sino' },
    smoke: { name: 'Đầu báo khói / gas', alt: 'Hochiki, Formosa, Horing (loại có ngõ ra rơ-le)' },
    valve: { name: 'Van điện từ', alt: 'SMC (SY/VF), Festo, Airtac (4V), CKD; van nước: Unid, ODE' },
    heater: { name: 'Bình nóng lạnh / tải nhiệt', alt: 'Ariston, Ferroli, Rossi, Picenza' },
    fan: { name: 'Quạt / bơm 1 pha', alt: 'Panasonic, KDK, Mitsubishi, Pentax, Wilo' },
    dimmer: { name: 'Dimmer / hộp số quạt', sch: 'AvatarOn (dimmer)', alt: 'Panasonic, Sino' },
    impulse: { name: 'Rơ-le xung (bật/tắt nhiều nơi)', sch: 'Acti9 iTL', abb: 'E290', sie: '5TT4 (rơ-le xung)', alt: 'Finder 26 series' },
    limit: { name: 'Công tắc hành trình', sch: 'Telemecanique OsiSense XC (XCK)', sie: 'SIRIUS 3SE5', omr: 'D4N / WL', alt: 'Autonics, Kacon' },
    estop: { name: 'Nút dừng khẩn', sch: 'Harmony XB5AS / XB4BS', abb: 'Modular MPET (nấm)', sie: 'SIRIUS ACT 3SU1 (nấm)', omr: 'A22NE / A22E' },
    level: { name: 'Phao / rơ-le mực nước', sch: 'Zelio RM35LM (rơ-le mực nước)', omr: '61F (rơ-le mực nước)', alt: 'Phao điện thông dụng, điện cực inox' },
    pressure: { name: 'Công tắc áp suất', sch: 'Telemecanique XMLP / XML', alt: 'Danfoss KP, Kita' },
    temp: { name: 'Bộ điều khiển nhiệt độ', omr: 'E5CC / E5EC', sch: 'Zelio Control (REG)', alt: 'Autonics TC4' },
    horn: { name: 'Còi / đèn chớp', sch: 'Harmony XVS / XVB', sie: 'SIRIUS 8WD4', alt: 'Patlite, Qlight' },
    fuse: { name: 'Cầu chì + đế', sch: 'TeSys DF', abb: 'E90', sie: 'SENTRON 3NW', alt: 'Bussmann, Mersen' },
    terminal: { name: 'Cầu đấu', sch: 'Linergy TR', abb: 'SNK', sie: 'SIRIUS 8WH', alt: 'Phoenix Contact, Weidmüller, Wago' },
    motor: { name: 'Động cơ', abb: 'M3BP / M2BAX', sie: 'SIMOTICS', mit: 'SF-PR', alt: 'Teco, Hyosung, WEG, Toshiba' },
    cable: { name: 'Cáp điện', alt: 'CADIVI, LS-VINA, Trần Phú, Taya' },
    busbar: { name: 'Thanh cái đồng', alt: 'Gia công theo tủ (Cu ETP, mạ thiếc)' },
    lamp: { name: 'Đèn chiếu sáng', alt: 'Rạng Đông, Philips (Signify), Panasonic, Duhal' },
    gen: { name: 'Máy phát', alt: 'Cummins, Denyo, Mitsubishi (động cơ), Doosan' }
  };
  const FALLBACK = ['sch', 'abb', 'sie', 'ls', 'mit', 'omr'];
  function brandPick(type, brand) {
    const c = CAT[type]; if (!c) return { text: 'Thiết bị phổ thông', by: '' };
    if (c[brand]) return { text: c[brand], by: brand };
    const fb = FALLBACK.find(b => c[b]);
    if (fb) return { text: c[fb], by: fb, fallback: true };
    return { text: c.alt || '—', by: 'alt', fallback: true };
  }

  // ---------- tham số dùng chung ----------
  const P = {
    kW: { k: 'kW', label: 'Công suất động cơ', type: 'num', def: 7.5, min: 0.18, max: 250, step: 0.1, unit: 'kW' },
    U: { k: 'U', label: 'Điện áp dây', type: 'sel', def: 380, opts: [380, 400, 415], unit: 'V' },
    cos: { k: 'cos', label: 'cos φ (0 = tự chọn)', type: 'num', def: 0, min: 0, max: 1, step: 0.01 },
    L: { k: 'L', label: 'Chiều dài cáp', type: 'num', def: 30, min: 1, max: 1000, step: 1, unit: 'm' },
    ins: { k: 'ins', label: 'Loại cách điện cáp', type: 'sel', def: 'PVC', opts: ['PVC', 'XLPE'] },
    kd: { k: 'kd', label: 'Hệ số hiệu chỉnh (nhiệt độ, nhóm cáp)', type: 'num', def: 0.8, min: 0.4, max: 1, step: 0.05 },
    ik: { k: 'ik', label: 'Dòng ngắn mạch tại tủ', type: 'num', def: 10, min: 1, max: 100, step: 1, unit: 'kA' }
  };
  const ikD = v => Object.assign({}, P.ik, { def: v });

  function motorBase(p) {
    const [c0, e0] = motorPf(p.kW);
    const cos = p.cos > 0 ? p.cos : c0, eta = e0;
    const In = motorIn(p.kW, p.U, cos, eta);
    return { cos, eta, In };
  }
  const SAFETY = [
    'Cắt điện, khoá và treo biển (LOTO) trước khi đấu nối; kiểm tra không còn điện bằng đồng hồ/bút thử đã thử trước trên nguồn có điện.',
    'Tiếp địa (PE) cho vỏ tủ, vỏ động cơ, thanh DIN và cửa tủ; tiết diện PE theo IEC 60364-5-54.',
    'Kết quả tính chỉ để tham khảo nhanh — kỹ sư có chuyên môn phải kiểm tra lại theo TCVN/IEC và catalogue của hãng trước khi thi công.'
  ];
  const CTRL_STEPS = (extra) => [
    'Đo cách điện bằng megger 500 V/1000 V: pha–pha và pha–PE ≥ 1 MΩ (tháo biến tần/thiết bị điện tử trước khi đo).',
    'Thử mạch điều khiển trước: cắt CB động lực, chỉ đóng CB điều khiển, thao tác nút và quan sát contactor/đèn.',
    ...(extra || [])
  ];

  // ---------- tính năng ghép thêm cho mạch động cơ ----------
  const P_ESTOP = { k: 'estop', label: 'Nút dừng khẩn cấp', type: 'sel', def: 'Không', opts: ['Không', 'Có'] };
  const AUTO = {
    'Phao (mực nước)': { act: 'float', lbl: 'Phao (mực thấp)', type: 'level', spec: 'Phao điện hoặc rơ-le mực nước 2 mức (điện cực Cao–Thấp–Chung), tiếp điểm đóng khi cần bơm', note: 'Dùng rơ-le mực nước 2 mức để bơm chạy khi xuống mức thấp và chỉ dừng khi lên mức cao — tránh bật/tắt liên tục.' },
    'Công tắc áp suất': { act: 'sensor', lbl: 'Áp suất thấp', type: 'pressure', spec: 'Công tắc áp suất có chỉnh chênh áp, tiếp điểm đóng khi áp thấp', note: 'Chỉnh dải áp: chạy khi áp ≤ Pmin, dừng khi ≥ Pmax; thêm bình tích áp để giảm số lần khởi động.' },
    'Cảm biến': { act: 'sensor', lbl: 'Cảm biến', type: 'sensor_ind', spec: 'Cảm biến có ngõ ra rơ-le 220 VAC (hoặc cảm biến 24 VDC qua rơ-le trung gian)', note: 'Cảm biến 24 VDC phải qua rơ-le trung gian trước khi vào mạch 220 VAC.' },
    'Rơ-le nhiệt độ': { act: 'sensor', lbl: 'Nhiệt độ đạt ngưỡng', type: 'temp', spec: 'Bộ điều khiển nhiệt độ ngõ ra rơ-le, đầu dò PT100 hoặc K', note: 'Đặt độ trễ (hysteresis) 2–5 °C để tránh đóng cắt liên tục.' },
    'Hẹn giờ': { act: 'timer', lbl: 'Đồng hồ hẹn giờ', type: 'time_switch', spec: 'Đồng hồ hẹn giờ tuần gắn DIN, tiếp điểm 16 A', note: 'Đồng hồ hẹn giờ cần cấp nguồn L/N riêng; có pin lưu khi mất điện.' },
    'Tín hiệu ngoài (PLC/BMS)': { act: '', lbl: 'Lệnh PLC/BMS', type: 'relay', spec: 'Tiếp điểm khô từ PLC/BMS hoặc rơ-le trung gian', note: 'Tín hiệu ngoài phải là tiếp điểm khô; nếu là 24 VDC thì qua rơ-le trung gian.' }
  };
  const P_AUTO = { k: 'auto', label: 'Chế độ TAY/TỰ ĐỘNG theo', type: 'sel', def: 'Không', opts: ['Không', ...Object.keys(AUTO)] };
  const STOP = {
    'Cảm biến': { act: 'sensor', lbl: 'Có vật → dừng', type: 'sensor_photo', spec: 'Cảm biến quang/tiệm cận ngõ ra rơ-le 24–240 V (hoặc cảm biến 24 VDC + rơ-le trung gian 220 VAC); dùng tiếp điểm NC: phát hiện vật → mở', step: 'Cho vật chạm/che cảm biến B3 khi đang chạy: K1 phải nhả ngay. Khi vật còn trước cảm biến thì nhấn Chạy không chạy được (an toàn) — dời vật rồi chạy lại.' },
    'Công tắc hành trình': { act: 'limit', lbl: 'Chạm cuối → dừng', type: 'limit', spec: 'Công tắc hành trình 1NO+1NC, IP65, dùng tiếp điểm NC (bị tác động → mở)', step: 'Tác động bằng tay vào công tắc hành trình B3 khi đang chạy: K1 phải nhả. Chỉnh vị trí cữ chặn để dừng đúng điểm.' },
    'Phao (mực đầy)': { act: 'float', lbl: 'Đầy → dừng', type: 'level', spec: 'Phao điện / rơ-le mực nước, tiếp điểm NC mở khi đầy', step: 'Nâng phao lên mức đầy khi đang chạy: K1 phải nhả.' },
    'Công tắc áp suất (áp đủ)': { act: 'sensor', lbl: 'Áp đủ → dừng', type: 'pressure', spec: 'Công tắc áp suất, tiếp điểm NC mở khi đạt áp đặt', step: 'Tăng áp tới ngưỡng đặt: K1 phải nhả.' },
    'Rơ-le nhiệt độ': { act: 'sensor', lbl: 'Đạt nhiệt → dừng', type: 'temp', spec: 'Bộ điều khiển nhiệt độ ngõ ra rơ-le, dùng tiếp điểm NC mở khi đạt ngưỡng', step: 'Mô phỏng đạt nhiệt độ đặt: K1 phải nhả.' },
    'Hết thời gian chạy': { act: 'timer', lbl: '', type: 'timer', spec: '', step: '' }
  };
  const P_STOP = { k: 'stopBy', label: 'Tự dừng khi', type: 'sel', def: 'Không', opts: ['Không', ...Object.keys(STOP)] };
  const P_TRUN = { k: 'tRun', label: 'Thời gian chạy (khi tự dừng theo thời gian)', type: 'num', def: 60, min: 1, max: 86400, step: 1, unit: 's' };
  const STARTBY = { 'Cảm biến': { act: 'sensor', lbl: 'Có vật → chạy', type: 'sensor_photo', spec: 'Cảm biến ngõ ra rơ-le, tiếp điểm NO đóng khi phát hiện vật (song song nút Chạy)' },
    'Công tắc hành trình': { act: 'limit', lbl: 'Tác động → chạy', type: 'limit', spec: 'Công tắc hành trình, tiếp điểm NO (song song nút Chạy)' } };
  const P_STARTBY = { k: 'startBy', label: 'Khởi động thêm bằng', type: 'sel', def: 'Chỉ nút nhấn', opts: ['Chỉ nút nhấn', ...Object.keys(STARTBY)] };
  const fmtT = s => s >= 3600 && s % 3600 === 0 ? s / 3600 + ' giờ' : s >= 60 && s % 60 === 0 ? s / 60 + ' phút' : s + ' s';
  function stopItem(p) {
    const st = STOP[p.stopBy]; if (!st) return [];
    if (p.stopBy === 'Hết thời gian chạy') return [{ t: 'nc', act: 'timer', tag: 'KT2', lbl: `Chạy ${fmtT(p.tRun)} → dừng` }];
    return [{ t: 'nc', act: st.act, tag: 'B3', lbl: st.lbl }];
  }
  const P_HORN = { k: 'horn', label: 'Còi báo trước khi chạy (0 = không)', type: 'num', def: 0, min: 0, max: 30, step: 1, unit: 's' };
  function startBlock(p, holdTag) {
    const sb = STARTBY[p.startBy];
    const manual = { par: [[{ t: 'no', act: 'push', tag: 'S1', lbl: 'Chạy' }], ...(sb ? [[{ t: 'no', act: sb.act, tag: 'B2', lbl: sb.lbl }]] : []), [{ t: 'no', tag: holdTag, lbl: 'Tự giữ' }]] };
    const a = AUTO[p.auto];
    if (!a) return [manual];
    const b1 = { t: 'no', tag: 'B1', lbl: a.lbl }; if (a.act) b1.act = a.act;
    return [{ par: [[{ t: 'no', act: 'sel', tag: 'S2', lbl: 'TAY' }, manual], [{ t: 'no', act: 'sel', tag: 'S2', tt: ['23'], bt: ['24'], lbl: 'TỰ ĐỘNG' }, b1]] }];
  }
  const estopItem = p => p.estop === 'Có' ? [{ t: 'nc', act: 'estop', tag: 'S00', lbl: 'Dừng khẩn' }] : [];
  function featDev(p) {
    const d = [];
    if (p.estop === 'Có') d.push({ tag: 'S00', type: 'estop', spec: 'Nút dừng khẩn nấm đỏ Ø40 trên nền vàng, nhấn giữ – xoay nhả, 1NC mở cưỡng bức (IEC 60947-5-5)' });
    const a = AUTO[p.auto];
    if (a) d.push({ tag: 'S2', type: 'sel', spec: 'Công tắc xoay 3 vị trí TAY–0–TỰ ĐỘNG, 2NO (13-14, 23-24)' }, { tag: 'B1', type: a.type, spec: a.spec });
    const sb = STARTBY[p.startBy]; if (sb) d.push({ tag: 'B2', type: sb.type, spec: sb.spec });
    const st = STOP[p.stopBy];
    if (st) d.push(p.stopBy === 'Hết thời gian chạy' ? { tag: 'KT2', type: 'timer', spec: `Rơ-le thời gian on-delay 220 VAC, đặt ${fmtT(p.tRun)}; dùng tiếp điểm NC trễ mở (15-16)` } : { tag: 'B3', type: st.type, spec: st.spec });
    if (p.horn > 0) d.push({ tag: 'KA', type: 'relay', spec: 'Rơ-le trung gian cuộn 220 VAC, 2NO' }, { tag: 'KT', type: 'timer', spec: `Rơ-le thời gian on-delay 220 VAC, đặt ${p.horn} s` }, { tag: 'HA', type: 'horn', spec: 'Còi hoặc còi + đèn chớp 220 VAC, ≥ 85 dB' });
    return d;
  }
  function featSteps(p) {
    const s = [];
    if (p.estop === 'Có') s.push('Nhấn nấm dừng khẩn S00 khi đang chạy: contactor phải nhả ngay; xoay nhả nấm rồi phải nhấn Chạy lại mới chạy (không tự chạy lại).');
    if (AUTO[p.auto]) s.push(`Thử chế độ: S2 ở TAY → điều khiển bằng nút; S2 ở TỰ ĐỘNG → động cơ chạy/dừng theo ${p.auto.toLowerCase()} (B1), nút Dừng S0 vẫn dừng được.`);
    if (STARTBY[p.startBy]) s.push(`Tác động ${p.startBy.toLowerCase()} B2 khi đang dừng: động cơ chạy và tự giữ.`);
    const st = STOP[p.stopBy];
    if (st) s.push(p.stopBy === 'Hết thời gian chạy' ? `Nhấn Chạy: động cơ chạy ${fmtT(p.tRun)} rồi tự dừng (KT2 hút cùng K1, hết giờ tiếp điểm KT2 mở).` : st.step);
    if (p.horn > 0) s.push(`Nhấn Chạy: còi HA kêu ${p.horn} s rồi động cơ mới chạy, còi tắt khi K1 hút (tiếp điểm NC của K1).`);
    return s;
  }
  function featNotes(p) { const a = AUTO[p.auto]; return [...(a ? [a.note] : []), ...(/Cảm biến/.test(p.stopBy + p.startBy) ? ['Cảm biến 3 dây 24 VDC không đấu thẳng vào mạch 220 VAC: chọn loại ngõ ra rơ-le hoặc thêm rơ-le trung gian.'] : []), ...(p.estop === 'Có' ? ['Dừng khẩn cấp loại 0 (cắt ngay nguồn động cơ). Với máy có yêu cầu an toàn cao (PL d/e) dùng rơ-le an toàn và nút 2 kênh.'] : [])]; }

  // ---------- mạch mẫu ----------
  const TPL = [];

  // 1. Khởi động trực tiếp
  TPL.push({
    id: 'dol', cat: 'motor', name: 'Khởi động trực tiếp (DOL)', desc: 'Contactor + rơ-le nhiệt, nút Start/Stop, tự giữ, đèn báo chạy/lỗi',
    params: [P.kW, P.U, P.cos, P.L, P.ins, P.kd, P.ik, P_ESTOP, P_STARTBY, P_STOP, P_TRUN, P_AUTO, P_HORN],
    build(p) {
      const m = motorBase(p), cb = cbFor(m.In, 3, p.ik, { curve: 'D' }), km = kmFor(m.In), ol = olFor(m.In);
      const cab = cable({ Icb: cb.In, Ib: m.In, L: p.L, U: p.U, phase: 3, cos: m.cos, ins: p.ins, k: p.kd, minS: 2.5 });
      const olTxt = ol ? `${ol[0]}–${ol[1]} A` : 'điện tử';
      const horn = p.horn > 0, tstop = p.stopBy === 'Hết thời gian chạy';
      const run = { par: [[{ t: 'coil', tag: 'K1' }], ...(tstop ? [[{ t: 'tcoil', tag: 'KT2', lbl: `Đếm ${fmtT(p.tRun)}` }]] : []), [{ t: 'lamp', tag: 'H1', lbl: 'Đèn chạy (xanh)' }]] };
      const loads = horn ? [{ par: [[{ par: [[{ t: 'coil', tag: 'KA', lbl: 'Lệnh chạy' }], [{ t: 'tcoil', tag: 'KT', lbl: `Báo trước ${p.horn} s` }]] }],
        [{ t: 'no', act: 'timer', tag: 'KT', lbl: 'Hết giờ' }, run],
        [{ t: 'no', tag: 'KA', tt: ['23'], bt: ['24'] }, { t: 'nc', tag: 'K1', lbl: 'Tắt còi khi chạy' }, { t: 'horn', tag: 'HA', lbl: 'Còi báo' }]] }] : [run];
      const feats = [STARTBY[p.startBy] ? 'chạy bằng ' + p.startBy.toLowerCase() : '', STOP[p.stopBy] ? (tstop ? `tự dừng sau ${fmtT(p.tRun)}` : 'dừng theo ' + p.stopBy.toLowerCase()) : '', p.estop === 'Có' ? 'dừng khẩn' : '', AUTO[p.auto] ? 'tự động theo ' + p.auto.toLowerCase() : '', horn ? `còi báo ${p.horn} s` : ''].filter(Boolean);
      return {
        title: `Khởi động trực tiếp động cơ ${p.kW} kW${feats.length ? ' — ' + feats.join(', ') : ''}`,
        sections: [
          { title: 'Mạch động lực', kind: 'power', poles: ['L1', 'L2', 'L3'], top: true, net: [
            { t: 'cb', tag: 'Q1', lbl: cb.short }, { t: 'km', tag: 'K1', lbl: `Contactor ${km} A (AC-3)` },
            { t: 'ol', tag: 'F1', lbl: `Rơ-le nhiệt ${olTxt}` }, { t: 'motor', tag: 'M1', lbl: `${p.kW} kW · ${r1(m.In)} A` }] },
          { title: 'Mạch điều khiển 220 VAC', kind: 'ac', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [
            { t: 'cb', tag: 'F2', lbl: 'MCB 1P 2A' },
            { par: [
              [{ t: 'nc', act: 'thermal', tag: 'F1', lbl: 'Quá tải' }, { t: 'nc', act: 'push', tag: 'S0', lbl: 'Dừng' }, ...estopItem(p), ...stopItem(p),
                ...startBlock(p, horn ? 'KA' : 'K1'), ...loads],
              [{ t: 'no', act: 'thermal', tag: 'F1', lbl: 'Báo lỗi' }, { t: 'lamp', tag: 'H2', lbl: 'Đèn lỗi (đỏ)' }]] }] }
        ],
        devices: [
          { tag: 'Q1', type: cb.type, spec: cb.spec + ' (bảo vệ ngắn mạch, chịu được dòng khởi động 6–8 In)' },
          { tag: 'K1', type: 'contactor', spec: `AC-3 ≥ ${r1(m.In)} A → chọn ${km} A; cuộn hút 220 VAC; phụ 1NO + 1NC` },
          { tag: 'F1', type: 'overload', spec: `Dải chỉnh ${olTxt}, đặt tại ${r1(m.In)} A; tiếp điểm 95-96 (NC), 97-98 (NO)` },
          { tag: 'F2', type: 'mcb', spec: 'MCB 1P 2A đường cong C (bảo vệ mạch điều khiển)' },
          { tag: 'S0', type: 'pb', spec: 'Nút nhấn Ø22 màu đỏ, 1NC (21-22)' },
          { tag: 'S1', type: 'pb', spec: 'Nút nhấn Ø22 màu xanh lá, 1NO (13-14)' },
          { tag: 'H1, H2', type: 'pilot', spec: 'Đèn báo LED Ø22, 220 VAC — xanh lá (chạy), đỏ (lỗi)' },
          { tag: 'W1', type: 'cable', spec: `${cabTxt(cab, 'PVC 4 lõi (3P+PE)'.replace('PVC', p.ins))}, dài ${p.L} m, ΔU ≈ ${cab.dU}%` },
          { tag: 'X1', type: 'terminal', spec: 'Cầu đấu động lực + điều khiển 1.0 mm², đầu cos, ống lồng đánh số dây' }, ...featDev(p)
        ],
        calcs: [
          ['Dòng định mức động cơ', `In = P / (√3·U·cosφ·η) = ${p.kW * 1000} / (1.732·${p.U}·${m.cos}·${m.eta}) = ${r1(m.In)} A`],
          ['CB Q1', `≥ 1.25·In = ${r1(1.25 * m.In)} A → ${cb.In} A`],
          ['Contactor K1', `AC-3 ≥ In → ${km} A`], ['Rơ-le nhiệt F1', `Dải ${olTxt}, chỉnh ${r1(m.In)} A`],
          ['Cáp động lực', `Iz = ${cab.Iz} A ≥ ${cb.In} A (đã nhân hệ số ${p.kd}); ΔU = ${cab.dU}% ${cab.ok ? '≤ 5% ✓' : '> 5% — cần tăng tiết diện'}`]
        ],
        steps: [
          'Lắp lên thanh DIN từ trên xuống: Q1 → K1 → F1 (rơ-le nhiệt cắm thẳng dưới contactor nếu cùng hãng) → F2 → cầu đấu X1. Nút nhấn và đèn lắp trên cửa tủ.',
          'Đấu động lực theo bảng dây: L1/L2/L3 → Q1 (1-3-5) → K1 (1-3-5); K1 (2-4-6) → F1; F1 (2-4-6) → X1 → động cơ U1-V1-W1. Đấu PE vào vỏ động cơ.',
          'Lấy nguồn điều khiển L từ sau Q1 (pha L1) và N từ thanh trung tính, qua F2.',
          'Đấu điều khiển theo số dây trên bản vẽ; mỗi đầu dây có ống lồng ghi đúng số.',
          `Chỉnh rơ-le nhiệt F1 tại ${r1(m.In)} A, chọn chế độ reset tay (H) hoặc tự động (A) theo yêu cầu.`,
          ...CTRL_STEPS(['Nhấn S1: K1 hút và tự giữ, H1 sáng. Nhấn S0: K1 nhả. Nhấn nút Test trên F1: K1 nhả, H2 sáng.',
            ...featSteps(p),
            'Đóng điện có tải; nếu động cơ quay ngược, cắt điện rồi đổi 2 trong 3 dây pha ở đầu ra F1.',
            `Đo dòng chạy bằng ampe kìm, so với In = ${r1(m.In)} A.`])
        ],
        notes: [p.kW > 11 ? `Động cơ ${p.kW} kW khởi động trực tiếp có thể gây sụt áp lớn (dòng khởi động 6–8 In ≈ ${Math.round(7 * m.In)} A). Cân nhắc sao–tam giác, khởi động mềm hoặc biến tần.` : 'Khởi động trực tiếp phù hợp động cơ nhỏ; dòng khởi động 6–8 In.',
          'Muốn gọn hơn có thể thay Q1 + F1 bằng CB bảo vệ động cơ (MPCB) có dải chỉnh nhiệt.',
          'Nên chọn Q1, K1, F1 cùng một hãng để tra bảng phối hợp Type 2.', ...featNotes(p), ...SAFETY]
      };
    }
  });

  // 2. Đảo chiều
  TPL.push({
    id: 'rev', cat: 'motor', name: 'Đảo chiều quay', desc: 'Hai contactor thuận/nghịch, khoá chéo điện + khoá nút nhấn',
    params: [P.kW, P.U, P.cos, P.L, P.ins, P.kd, P.ik, P_ESTOP, { k: 'lim', label: 'Công tắc hành trình 2 đầu', type: 'sel', def: 'Không', opts: ['Không', 'Có'] }],
    build(p) {
      const m = motorBase(p), cb = cbFor(m.In, 3, p.ik, { curve: 'D' }), km = kmFor(m.In), ol = olFor(m.In);
      const cab = cable({ Icb: cb.In, Ib: m.In, L: p.L, U: p.U, phase: 3, cos: m.cos, ins: p.ins, k: p.kd, minS: 2.5 });
      const olTxt = ol ? `${ol[0]}–${ol[1]} A` : 'điện tử';
      return {
        title: `Đảo chiều động cơ ${p.kW} kW${p.lim === 'Có' ? ' — hành trình 2 đầu' : ''}${p.estop === 'Có' ? ', dừng khẩn' : ''}`,
        sections: [
          { title: 'Mạch động lực', kind: 'power', poles: ['L1', 'L2', 'L3'], top: true, net: [
            { t: 'cb', tag: 'Q1', lbl: cb.short },
            { par: [[{ t: 'km', tag: 'K1', lbl: `Thuận ${km} A` }], [{ t: 'km', tag: 'K2', lbl: `Nghịch ${km} A` }, { t: 'swap', swap: [0, 2], lbl: 'Đảo L1↔L3' }]] },
            { t: 'ol', tag: 'F1', lbl: `Rơ-le nhiệt ${olTxt}` }, { t: 'motor', tag: 'M1', lbl: `${p.kW} kW · ${r1(m.In)} A` }] },
          { title: 'Mạch điều khiển 220 VAC', kind: 'ac', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [
            { t: 'cb', tag: 'F2', lbl: 'MCB 1P 2A' }, { t: 'nc', act: 'thermal', tag: 'F1', lbl: 'Quá tải' }, { t: 'nc', act: 'push', tag: 'S0', lbl: 'Dừng' }, ...estopItem(p),
            { par: [
              [{ par: [[{ t: 'no', act: 'push', tag: 'S1', lbl: 'Thuận' }], [{ t: 'no', tag: 'K1', lbl: 'Tự giữ' }]] }, { t: 'nc', act: 'push', tag: 'S2', lbl: 'Khoá nút' }, { t: 'nc', tag: 'K2', lbl: 'Khoá chéo' }, ...(p.lim === 'Có' ? [{ t: 'nc', act: 'limit', tag: 'B1', lbl: 'Hết hành trình thuận' }] : []), { t: 'coil', tag: 'K1' }],
              [{ par: [[{ t: 'no', act: 'push', tag: 'S2', lbl: 'Nghịch' }], [{ t: 'no', tag: 'K2', lbl: 'Tự giữ' }]] }, { t: 'nc', act: 'push', tag: 'S1', lbl: 'Khoá nút' }, { t: 'nc', tag: 'K1', lbl: 'Khoá chéo' }, ...(p.lim === 'Có' ? [{ t: 'nc', act: 'limit', tag: 'B2', lbl: 'Hết hành trình nghịch' }] : []), { t: 'coil', tag: 'K2' }]] }] }
        ],
        devices: [
          { tag: 'Q1', type: cb.type, spec: cb.spec },
          { tag: 'K1, K2', type: 'contactor', spec: `AC-3 ${km} A, cuộn 220 VAC, phụ 1NO+1NC; nên dùng bộ đảo chiều có khoá liên động cơ khí (mechanical interlock)`, qty: 2 },
          { tag: 'F1', type: 'overload', spec: `Dải ${olTxt}, chỉnh ${r1(m.In)} A` },
          { tag: 'F2', type: 'mcb', spec: 'MCB 1P 2A' },
          { tag: 'S0', type: 'pb', spec: 'Nút đỏ 1NC' }, { tag: 'S1, S2', type: 'pb', spec: 'Nút xanh 1NO + 1NC (13-14, 21-22)', qty: 2 },
          { tag: 'W1', type: 'cable', spec: `${cabTxt(cab, p.ins + ' 4 lõi')}, ${p.L} m, ΔU ≈ ${cab.dU}%` }, ...featDev(p), ...(p.lim === 'Có' ? [{ tag: 'B1, B2', type: 'limit', spec: 'Công tắc hành trình 1NC mỗi đầu (lên/xuống hoặc tiến/lùi), IP65', qty: 2 }] : [])
        ],
        calcs: [['In', `${r1(m.In)} A`], ['CB Q1', `${cb.In} A`], ['K1, K2', `${km} A mỗi cái`], ['Cáp', `${cab.S} mm², Iz = ${cab.Iz} A, ΔU = ${cab.dU}%`]],
        steps: [
          'Lắp K1, K2 cạnh nhau, gắn bộ khoá liên động cơ khí giữa hai contactor (phụ kiện cùng hãng).',
          'Đấu động lực: đầu vào K1 và K2 song song (1-3-5); đầu ra K1 đi thẳng, đầu ra K2 đảo L1↔L3 rồi chập với đầu ra K1 tại F1.',
          'Khoá chéo điện: NC của K2 (21-22) nối tiếp cuộn K1, NC của K1 nối tiếp cuộn K2. Khoá nút: NC của S2 trong nhánh K1 và ngược lại.',
          ...CTRL_STEPS(['Nhấn S1 → K1 hút; nhấn S2 lúc đang chạy → K1 nhả, K2 không được hút cùng lúc. Kiểm tra không bao giờ K1 và K2 cùng hút.',
            'Với tải quán tính lớn, chờ động cơ dừng hẳn mới đảo chiều (có thể thêm timer).', ...(p.lim === 'Có' ? ['Chạy thuận tới cuối: B1 bị tác động → K1 nhả, chỉ chạy nghịch được. Tương tự B2 ở đầu kia. Với cầu trục/palang nên thêm hành trình cuối (cắt động lực) dự phòng.'] : [])])
        ],
        notes: ['Không có khoá chéo sẽ ngắn mạch 2 pha khi K1, K2 cùng hút — bắt buộc khoá cả điện và cơ khí.', ...featNotes(p), ...SAFETY]
      };
    }
  });

  // 3. Sao – tam giác
  TPL.push({
    id: 'sd', cat: 'motor', name: 'Khởi động sao – tam giác', desc: 'K1 chính, K2 sao, K3 tam giác, rơ-le thời gian chuyển Y→Δ',
    params: [Object.assign({}, P.kW, { def: 22 }), P.U, P.cos, P.L, P.ins, P.kd, ikD(15), { k: 'ts', label: 'Thời gian chuyển Y→Δ', type: 'num', def: 8, min: 3, max: 30, step: 1, unit: 's' }, P_ESTOP, P_AUTO],
    build(p) {
      const m = motorBase(p), Iph = m.In / SQ3;
      const cb = cbFor(m.In, 3, p.ik, { curve: 'D' }), k1 = kmFor(Iph), k3 = kmFor(Iph), k2 = kmFor(m.In / 3), ol = olFor(Iph);
      const olTxt = ol ? `${ol[0]}–${ol[1]} A` : 'điện tử';
      const cabL = cable({ Icb: cb.In, Ib: m.In, L: 10, U: p.U, phase: 3, cos: m.cos, ins: p.ins, k: p.kd, minS: 2.5 });
      const cabM = cable({ Icb: Iph * 1.25, Ib: Iph, L: p.L, U: p.U, phase: 3, cos: m.cos, ins: p.ins, k: p.kd, minS: 2.5 });
      return {
        title: `Khởi động sao–tam giác ${p.kW} kW`,
        sections: [
          { title: 'Mạch động lực', kind: 'power', poles: ['L1', 'L2', 'L3'], top: true, net: [
            { t: 'cb', tag: 'Q1', lbl: cb.short },
            { par: [[{ t: 'km', tag: 'K1', lbl: `Chính ${k1} A` }, { t: 'ol', tag: 'F1', lbl: `Rơ-le nhiệt ${olTxt}` }, { t: 'motor6', tag: 'M1', lbl: `${p.kW} kW · ${r1(m.In)} A` }],
              [{ t: 'km', tag: 'K3', lbl: `Tam giác Δ ${k3} A` }, { t: 'load', tag: 'M1', tt: ['W2', 'U2', 'V2'], lbl: '→ M1: W2 · U2 · V2' }]], open: 'bottom' }] },
          { title: 'Điểm sao', kind: 'power', poles: ['L1', 'L2', 'L3'], net: [
            { t: 'from', tag: 'M1', bt: ['U2', 'V2', 'W2'], lbl: 'Từ động cơ' }, { t: 'km', tag: 'K2', lbl: `Sao Y ${k2} A` }, { t: 'short', lbl: 'Nối tắt 2-4-6' }] },
          { title: 'Mạch điều khiển 220 VAC', kind: 'ac', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [
            { t: 'cb', tag: 'F2', lbl: 'MCB 1P 2A' }, { t: 'nc', act: 'thermal', tag: 'F1' }, { t: 'nc', act: 'push', tag: 'S0', lbl: 'Dừng' }, ...estopItem(p),
            ...startBlock(p, 'K1'),
            { par: [
              [{ t: 'coil', tag: 'K1', lbl: 'Chính' }],
              [{ t: 'tcoil', tag: 'KT', lbl: `Timer ${p.ts} s` }],
              [{ t: 'nc', act: 'timer', tag: 'KT', lbl: 'Hết giờ mở' }, { t: 'nc', tag: 'K3', lbl: 'Khoá chéo' }, { t: 'coil', tag: 'K2', lbl: 'Sao' }],
              [{ t: 'no', act: 'timer', tag: 'KT', lbl: 'Hết giờ đóng' }, { t: 'nc', tag: 'K2', lbl: 'Khoá chéo' }, { t: 'coil', tag: 'K3', lbl: 'Tam giác' }]] }] }
        ],
        devices: [
          { tag: 'Q1', type: cb.type, spec: cb.spec },
          { tag: 'K1', type: 'contactor', spec: `Chính: AC-3 ≥ 0.58·In = ${r1(Iph)} A → ${k1} A` },
          { tag: 'K3', type: 'contactor', spec: `Tam giác: AC-3 ≥ 0.58·In → ${k3} A` },
          { tag: 'K2', type: 'contactor', spec: `Sao: AC-3 ≥ 0.33·In = ${r1(m.In / 3)} A → ${k2} A` },
          { tag: 'F1', type: 'overload', spec: `Đặt trong mạch cuộn dây (sau K1): dải ${olTxt}, chỉnh ${r1(Iph)} A` },
          { tag: 'KT', type: 'timer', spec: `Rơ-le thời gian on-delay (hoặc chuyên dụng sao–tam giác), đặt ${p.ts} s` },
          { tag: 'F2', type: 'mcb', spec: 'MCB 1P 2A' }, { tag: 'S0, S1', type: 'pb', spec: 'Nút đỏ 1NC, nút xanh 1NO' },
          { tag: 'W1', type: 'cable', spec: `Cáp vào tủ: ${cabTxt(cabL, p.ins + ' 4 lõi')}` },
          { tag: 'W2, W3', type: 'cable', spec: `2 sợi cáp ra động cơ (U1V1W1 và W2U2V2): ${cabTxt(cabM, p.ins + ' 3 lõi')} mỗi sợi, ${p.L} m, ΔU ≈ ${cabM.dU}%`, qty: 2 }, ...featDev(p)
        ],
        calcs: [['In (dây)', `${r1(m.In)} A`], ['Dòng cuộn dây', `In/√3 = ${r1(Iph)} A`], ['Dòng khởi động khi sao', `≈ 1/3 so với khởi động trực tiếp`], ['Timer', `${p.ts} s (thường 5–10 s, chờ động cơ đạt ~80% tốc độ)`]],
        steps: [
          'Kiểm tra nhãn động cơ: phải là loại 380 V nối Δ (ví dụ 380/660 V). Động cơ 220/380 V không chạy sao–tam giác ở lưới 380 V.',
          'Tháo cầu nối (lá đồng) trong hộp đấu dây động cơ, kéo đủ 6 đầu U1 V1 W1 / U2 V2 W2 về tủ bằng 2 sợi cáp.',
          'K1 → F1 → U1 V1 W1. K3 lấy nguồn ngay sau Q1, đầu ra K3 (2-4-6) → W2 U2 V2 (đúng thứ tự này để không đổi chiều khi chuyển Δ).',
          'K2: đầu vào nối U2 V2 W2, đầu ra 2-4-6 nối tắt với nhau tạo điểm sao.',
          'Gắn khoá liên động cơ khí giữa K2 và K3.',
          ...CTRL_STEPS(['Nhấn S1: K1 + K2 + KT hút (chạy sao). Sau ' + p.ts + ' s: K2 nhả rồi K3 hút (chạy tam giác). K2 và K3 không bao giờ hút cùng lúc.',
            ...featSteps(p),
            'Đo dòng: lúc chuyển Δ dòng nhảy ngắn rồi ổn định ≈ In; nếu đỉnh lớn, tăng thời gian timer.'])
        ],
        notes: ['Rơ-le nhiệt đặt sau K1 chỉ thấy dòng cuộn dây → chỉnh 0.58·In, không chỉnh bằng In.', 'Nên dùng timer chuyên dụng sao–tam giác (có khoảng nghỉ 50–100 ms giữa Y và Δ) để tránh hồ quang.', ...featNotes(p), ...SAFETY]
      };
    }
  });

  // 4. Biến tần
  TPL.push({
    id: 'vfd', cat: 'motor', name: 'Điều khiển bằng biến tần', desc: 'CB → biến tần → động cơ; chạy thuận/nghịch, reset lỗi, biến trở tốc độ, báo lỗi',
    params: [P.kW, P.U, P.cos, { k: 'duty', label: 'Kiểu tải', type: 'sel', def: 'Nặng (băng tải, máy)', opts: ['Nặng (băng tải, máy)', 'Nhẹ (bơm, quạt)'] }, P.L, P.ins, P.kd, P.ik,
      { k: 'dir', label: 'Chiều quay', type: 'sel', def: 'Thuận / nghịch', opts: ['Thuận / nghịch', 'Chỉ chạy thuận'] },
      { k: 'spd', label: 'Đặt tốc độ bằng', type: 'sel', def: 'Biến trở', opts: ['Biến trở', '2 cấp (công tắc)', '3 cấp (công tắc)'] }, P_ESTOP],
    build(p) {
      const m = motorBase(p), heavy = /Nặng/.test(p.duty), rev = p.dir !== 'Chỉ chạy thuận', pot = p.spd === 'Biến trở', nsp = pot ? 0 : parseInt(p.spd);
      const br = [[{ t: 'no', act: 'sel', tag: 'S1', lbl: 'Chạy thuận' }, { t: 'vfdin', tag: 'U1', lbl: 'DI1' }]];
      if (rev) br.push([{ t: 'no', act: 'sel', tag: 'S1', tt: ['23'], bt: ['24'], lbl: 'Chạy nghịch' }, { t: 'vfdin', tag: 'U1', lbl: 'DI2' }]);
      br.push([{ t: 'no', act: 'push', tag: 'S3', lbl: 'Reset lỗi' }, { t: 'vfdin', tag: 'U1', lbl: 'DI3' }]);
      if (nsp >= 2) br.push([{ t: 'no', act: 'sel', tag: 'S4', lbl: 'Tốc độ 2' }, { t: 'vfdin', tag: 'U1', lbl: 'DI4' }]);
      if (nsp >= 3) br.push([{ t: 'no', act: 'sel', tag: 'S4', tt: ['23'], bt: ['24'], lbl: 'Tốc độ 3' }, { t: 'vfdin', tag: 'U1', lbl: 'DI5' }]);
      const vfdEl = { t: 'vfd', tag: 'U1', lbl: '' };
      if (pot) vfdEl.links = [['RV1:1', 'U1:COM (0V analog)', 'Biến trở 10 kΩ'], ['RV1:2 (con chạy)', 'U1:AI1', 'Đặt tốc độ 0–10 V'], ['RV1:3', 'U1:+10V', '']];
      const vkw = pick(STD_KW, p.kW) || p.kW;
      const cb = cbFor(m.In, 3, p.ik, { curve: 'C' });
      const cabI = cable({ Icb: cb.In, Ib: m.In, L: 5, U: p.U, phase: 3, cos: 0.95, ins: p.ins, k: p.kd, minS: 2.5 });
      const cabO = cable({ Icb: m.In * 1.25, Ib: m.In, L: p.L, U: p.U, phase: 3, cos: m.cos, ins: p.ins, k: p.kd, minS: 2.5 });
      vfdEl.lbl = `Biến tần ${vkw} kW`;
      return {
        title: `Biến tần ${vkw} kW cho động cơ ${p.kW} kW${nsp ? ' — ' + nsp + ' cấp tốc độ' : ''}${rev ? '' : ', chạy 1 chiều'}`,
        sections: [
          { title: 'Mạch động lực', kind: 'power', poles: ['L1', 'L2', 'L3'], top: true, net: [
            { t: 'cb', tag: 'Q1', lbl: cb.short }, vfdEl,
            { t: 'motor', tag: 'M1', lbl: `${p.kW} kW · ${r1(m.In)} A` }] },
          { title: 'Điều khiển (24 VDC nội của biến tần)', kind: 'dc', poles: ['+24V'], top: true, net: [
            ...estopItem(p), { par: br, open: 'bottom' }] },
          { title: 'Báo lỗi 220 VAC', kind: 'ac', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [
            { t: 'cb', tag: 'F2', lbl: 'MCB 1P 2A' }, { t: 'no', tag: 'U1', tt: ['RO-C'], bt: ['RO-NO'], lbl: 'Rơ-le lỗi' }, { t: 'lamp', tag: 'H1', lbl: 'Đèn lỗi (đỏ)' }] }
        ],
        devices: [
          { tag: 'Q1', type: cb.type, spec: cb.spec + ' (hoặc cầu chì theo manual biến tần)' },
          { tag: 'U1', type: 'vfd', spec: `${vkw} kW, 3 pha ${p.U} V, dòng ra ≥ ${r1(m.In)} A, ${heavy ? 'định mức tải nặng (HD, 150%·60 s)' : 'định mức tải nhẹ (ND, 110%·60 s)'}` },
          { tag: 'S1', type: 'sel', spec: rev ? 'Công tắc xoay 3 vị trí Thuận–0–Nghịch, 2NO' : 'Công tắc xoay 2 vị trí 0–Chạy, 1NO' },
          { tag: 'S3', type: 'pb', spec: 'Nút nhấn 1NO (reset lỗi)' },
          ...(pot ? [{ tag: 'RV1', type: 'pb', spec: 'Biến trở 10 kΩ, 1 vòng hoặc 10 vòng, gắn cửa tủ' }] : [{ tag: 'S4', type: 'sel', spec: nsp === 3 ? 'Công tắc xoay 3 vị trí Tốc độ 1–2–3, 2NO' : 'Công tắc xoay 2 vị trí Tốc độ 1–2, 1NO' }]),
          ...featDev(p),
          { tag: 'H1', type: 'pilot', spec: 'Đèn đỏ 220 VAC' }, { tag: 'F2', type: 'mcb', spec: 'MCB 1P 2A' },
          { tag: 'W1', type: 'cable', spec: `Cáp vào: ${cabTxt(cabI, p.ins + ' 4 lõi')}` },
          { tag: 'W2', type: 'cable', spec: `Cáp ra động cơ: cáp có lưới chống nhiễu (shielded) ${cabO.S} mm², ${p.L} m, ΔU ≈ ${cabO.dU}%` }
        ],
        calcs: [['In động cơ', `${r1(m.In)} A`], ['Công suất biến tần', `≥ ${p.kW} kW → ${vkw} kW ${heavy ? '(chọn theo HD; nếu catalogue chỉ ghi ND hãy lên 1 cấp)' : '(ND)'}`], ['CB Q1', `${cb.In} A`], ['Cáp ra', `${cabO.S} mm², ${p.L} m${p.L > 50 ? ' — cáp dài > 50 m: cân nhắc cuộn kháng đầu ra (output reactor / dV/dt filter)' : ''}`]],
        steps: [
          'Không đặt contactor giữa biến tần và động cơ (nếu bắt buộc, chỉ đóng/cắt khi biến tần đã dừng). Không lắp tụ bù ở đầu ra.',
          'Đấu nguồn vào R/L1 S/L2 T/L3, động cơ vào U/T1 V/T2 W/T3. Lưới chống nhiễu của cáp động cơ bắt 360° vào kẹp tiếp đất cả hai đầu.',
          'Tên chân điều khiển theo hãng (tham khảo, xác nhận trong manual): Schneider ATV320: DI1…DI6, +24, COM, AI1, +10, R1A/R1B/R1C · Siemens G120C: DI0…DI5, +24 V OUT, AI0, +10 V, DO0 · Mitsubishi FR-E800: STF, STR, RES, SD/PC, 10, 2, 5, A-B-C · LS G100: P1…P5, CM, 24, VR, V1, A1/B1/C1 · ABB ACS580: DI1…DI6, +24V, DGND, AI1, +10V, RO1 · Omron MX2: 1…7, L, P24, H, O, AL0/AL1/AL2.',
          pot ? 'Biến trở 10 kΩ: chân giữa → AI1 (ngõ vào tốc độ), hai chân ngoài → +10 V và COM.' : `Tốc độ đặt trước: cài tần số tốc độ 1 làm tần số chính (vd. 30 Hz), gán DI4 = tốc độ 2 (vd. 40 Hz)${nsp === 3 ? ', DI5 = tốc độ 3 (vd. 50 Hz)' : ''} trong nhóm thông số Preset speed / Multi-speed.`,
          ...(p.estop === 'Có' ? ['Nấm dừng khẩn S00 cắt nguồn +24 V của lệnh chạy; với yêu cầu an toàn nên đấu thêm vào chân STO của biến tần.'] : []),
          'Lưu ý rơ-le lỗi: một số hãng (vd. ATV320 R1) hút khi KHÔNG lỗi → dùng cặp tiếp điểm NC (R1B–R1C) cho đèn báo lỗi.',
          'Cài đặt cơ bản: thông số nhãn động cơ (kW, V, A, Hz, vòng/phút), thời gian tăng/giảm tốc, nguồn lệnh = Terminal, nguồn tần số = AI1. Chạy Auto-tune nếu có.',
          ...CTRL_STEPS(['Chạy thử ở tần số thấp (10 Hz), kiểm tra chiều quay; đổi chiều bằng thông số hoặc đổi 2 dây ở đầu ra biến tần.'])
        ],
        notes: ['Biến tần có bảo vệ quá tải điện tử — không cần rơ-le nhiệt riêng cho 1 động cơ.', 'Dùng RCD loại B (hoặc loại F) nếu cần bảo vệ dòng rò cho mạch có biến tần.', 'Cần dừng khẩn cấp an toàn: dùng chức năng STO của biến tần thay vì chỉ ngắt DI.', ...SAFETY]
      };
    }
  });

  // 5. Tủ phân phối
  TPL.push({
    id: 'dist', cat: 'dist', name: 'Tủ phân phối hạ thế', desc: 'CB tổng (MCCB/ACB) → các lộ ra, đồng hồ đa năng, chống sét lan truyền',
    params: [{ k: 'feeders', label: 'Công suất từng lộ (kW, cách nhau dấu phẩy)', type: 'text', def: '15, 22, 7.5, 11' },
      P.U, { k: 'cos', label: 'cos φ trung bình', type: 'num', def: 0.85, min: 0.5, max: 1, step: 0.01 },
      { k: 'ks', label: 'Hệ số đồng thời ks', type: 'num', def: 0.8, min: 0.3, max: 1, step: 0.05 },
      Object.assign({}, P.L, { def: 20, label: 'Chiều dài cáp vào tủ' }), Object.assign({}, P.ins, { def: 'XLPE' }), P.kd, ikD(25),
      { k: 'spd', label: 'Chống sét lan truyền (SPD)', type: 'sel', def: 'Có', opts: ['Có', 'Không'] },
      { k: 'meter', label: 'Đồng hồ đa năng', type: 'sel', def: 'Có', opts: ['Có', 'Không'] }],
    build(p) {
      const kws = String(p.feeders).split(/[,;\s]+/).map(Number).filter(v => v > 0).slice(0, 8);
      if (!kws.length) kws.push(10);
      const cos = p.cos > 0 ? p.cos : 0.85;
      const fI = kws.map(k => k * 1000 / (SQ3 * p.U * cos));
      const fCB = fI.map(I => cbFor(I, 3, p.ik));
      const sumI = fI.reduce((a, b) => a + b, 0), Im = sumI * p.ks;
      const main = cbFor(Im, 3, p.ik, { mccb: true, acbAbove: 630 });
      const cab = cable({ Icb: main.In, Ib: Im, L: p.L, U: p.U, phase: 3, cos, ins: p.ins, k: p.kd, minS: 4 });
      const branches = kws.map((k, i) => [{ t: 'cb', tag: 'Q' + (i + 1), lbl: fCB[i].short }, { t: 'load', lbl: `Lộ ${i + 1} · ${k} kW` }]);
      if (p.meter === 'Có') branches.push([{ t: 'cb', tag: 'F1', lbl: 'MCB 3P 2A (đo)' }, { t: 'meter', tag: 'P1', lbl: 'Đồng hồ đa năng + CT' }]);
      if (p.spd === 'Có') branches.push([{ t: 'cb', tag: 'F2', lbl: 'MCB 3P 32A (SPD)' }, { t: 'spd', tag: 'FV1', lbl: 'SPD Type 2' }]);
      const ctR = pick([50, 75, 100, 150, 200, 250, 300, 400, 500, 600, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000], main.In) || 4000;
      const dev = [
        { tag: 'Q0', type: main.type, spec: main.spec + ' — CB tổng' },
        ...kws.map((k, i) => ({ tag: 'Q' + (i + 1), type: fCB[i].type, spec: `${fCB[i].spec} — lộ ${k} kW (Ib ≈ ${r1(fI[i])} A)` }))
      ];
      if (p.meter === 'Có') dev.push({ tag: 'P1', type: 'meter', spec: `Đồng hồ đa năng 3P4W + 3 CT ${ctR}/5 A (cấp 0.5)` }, { tag: 'F1', type: 'mcb', spec: 'MCB 3P 2A cấp áp cho đồng hồ' });
      if (p.spd === 'Có') dev.push({ tag: 'FV1', type: 'spd', spec: 'SPD Type 2, 3P+N, Imax 40 kA, Up ≤ 1.5 kV' }, { tag: 'F2', type: 'mcb', spec: 'MCB 3P 32A (hoặc theo hướng dẫn hãng SPD)' });
      dev.push({ tag: 'W0', type: 'cable', spec: `Cáp vào tủ: ${cabTxt(cab, p.ins + ' 3 lõi + N + PE')}, ${p.L} m, ΔU ≈ ${cab.dU}%` },
        { tag: '—', type: 'busbar', spec: `Thanh cái đồng cho ≥ ${main.In} A (tra bảng DIN 43671, hiệu chỉnh nhiệt độ trong tủ); thanh N và PE riêng` });
      return {
        title: `Tủ phân phối ${kws.length} lộ — tổng ${r1(Im)} A`,
        sections: [{ title: 'Sơ đồ nguyên lý tủ phân phối', kind: 'power', poles: ['L1', 'L2', 'L3'], top: true, net: [{ t: 'cb', tag: 'Q0', lbl: main.short }, { par: branches, open: 'bottom' }] }],
        devices: dev,
        calcs: [['Dòng từng lộ', kws.map((k, i) => `Lộ ${i + 1}: ${r1(fI[i])} A → ${fCB[i].In} A`).join(' · ')],
          ['Dòng tổng', `ks·ΣI = ${p.ks}·${r1(sumI)} = ${r1(Im)} A → CB tổng ${main.In} A (${main.type.toUpperCase()})`],
          ['Cáp vào', `${cab.par > 1 ? cab.par + '×' : ''}${cab.S} mm², Iz = ${cab.Iz} A, ΔU = ${cab.dU}%`],
          ['Icu', `Tất cả CB có Icu ≥ ${p.ik} kA (dòng ngắn mạch tại tủ)`]],
        steps: [
          'Bố trí: CB tổng phía trên, thanh cái ngang, các CB lộ ra xếp hàng bên dưới; thanh N và PE tách riêng, có nhãn.',
          'Đấu cáp vào CB tổng theo thứ tự pha L1-L2-L3 (nâu-đen-xám), N xanh dương, PE vàng-xanh.',
          'Thanh cái: dùng bulông cấp 8.8, long đen vênh; siết lực theo bảng của hãng; dán tem kiểm tra lực siết.',
          'Đồng hồ đa năng: đấu áp qua F1, đấu CT đúng cực P1→P2 hướng về tải, chung S2 về đất; không bao giờ để hở mạch thứ cấp CT khi có tải.',
          'SPD: dây nối ngắn nhất có thể (tổng < 0.5 m), dây PE của SPD ≥ 6 mm².',
          ...CTRL_STEPS(['Đóng CB tổng không tải, đo điện áp pha–pha, pha–N; kiểm tra thứ tự pha.', 'Đóng lần lượt từng lộ, đo dòng từng pha để cân bằng tải.'])
        ],
        notes: ['Selectivity: kiểm tra phối hợp chọn lọc giữa CB tổng và CB lộ bằng bảng của hãng (nên cùng hãng).', main.type === 'acb' ? 'CB tổng > 630 A: dùng ACB có bộ bảo vệ điện tử LSIG.' : 'CB tổng ≤ 630 A: MCCB có bộ trip chỉnh được.', ...SAFETY]
      };
    }
  });

  // 6. ATS
  TPL.push({
    id: 'ats', cat: 'dist', name: 'Chuyển nguồn tự động (ATS)', desc: 'Lưới ↔ máy phát, khoá liên động điện + cơ khí',
    params: [{ k: 'kW', label: 'Công suất tải ưu tiên', type: 'num', def: 100, min: 5, max: 2000, step: 1, unit: 'kW' }, P.U, { k: 'cos', label: 'cos φ', type: 'num', def: 0.85, min: 0.5, max: 1, step: 0.01 }, ikD(25)],
    build(p) {
      const I = p.kW * 1000 / (SQ3 * p.U * p.cos), cb = cbFor(I, 4, p.ik, { mccb: true, acbAbove: 1600 });
      const ats = pick([40, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 2500, 3200], I * 1.25) || 3200;
      const kva = pick(STD_KVA, p.kW / 0.8 * 1.25) || 2500;
      return {
        title: `ATS ${ats} A — tải ${p.kW} kW`,
        sections: [
          { title: 'Mạch động lực', kind: 'power', poles: ['L1', 'L2', 'L3'], net: [
            { par: [[{ t: 'src', tag: 'T1', lbl: 'Lưới (MBA)' }, { t: 'cb', tag: 'Q1', lbl: cb.short }, { t: 'km', tag: 'KA', lbl: 'ATS – I (lưới)' }],
              [{ t: 'src', tag: 'G1', lbl: `Máy phát ${kva} kVA` }, { t: 'cb', tag: 'Q2', lbl: cb.short }, { t: 'km', tag: 'KB', lbl: 'ATS – II (máy phát)' }]], open: 'top' },
            { t: 'cb', tag: 'Q3', lbl: cb.short }, { t: 'load', lbl: 'Tải ưu tiên' }] },
          { title: 'Liên động điều khiển 220 VAC', kind: 'ac', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [
            { t: 'cb', tag: 'F1', lbl: 'MCB 1P 2A' },
            { par: [[{ t: 'no', tag: 'A1', lbl: 'Lệnh I (bộ ĐK)' }, { t: 'nc', tag: 'KB', lbl: 'Khoá chéo' }, { t: 'coil', tag: 'KA' }],
              [{ t: 'no', tag: 'A1', tt: ['23'], bt: ['24'], lbl: 'Lệnh II (bộ ĐK)' }, { t: 'nc', tag: 'KA', lbl: 'Khoá chéo' }, { t: 'coil', tag: 'KB' }]] }] }
        ],
        devices: [
          { tag: 'KA/KB', type: 'ats', spec: `ATS 4 cực ${ats} A (≥ 1.25·I = ${r1(I * 1.25)} A), loại PC (liền khối, khoá cơ khí sẵn) hoặc 2 MCCB/ACB có motor + khoá cơ khí` },
          { tag: 'A1', type: 'ats', spec: 'Bộ điều khiển ATS: giám sát áp/tần số 2 nguồn, trễ chuyển, lệnh khởi động máy phát' },
          { tag: 'Q1, Q2, Q3', type: cb.type, spec: cb.spec, qty: 3 },
          { tag: 'G1', type: 'gen', spec: `Máy phát ≥ ${kva} kVA (= P/0.8 × 1.25 dự phòng), kiểm tra lại với dòng khởi động động cơ lớn nhất` },
          { tag: 'F1', type: 'mcb', spec: 'MCB 1P 2A; nguồn điều khiển lấy qua rơ-le chọn nguồn hoặc UPS' }
        ],
        calcs: [['Dòng tải', `${r1(I)} A`], ['ATS', `≥ 1.25·I → ${ats} A`], ['Máy phát', `${kva} kVA`]],
        steps: [
          'Dùng ATS 4 cực (đóng cắt cả N) khi máy phát có trung tính nối đất riêng.',
          'Bắt buộc có khoá liên động cơ khí giữa vị trí I và II (ATS loại PC có sẵn).',
          'Đấu tín hiệu khởi động máy phát (tiếp điểm khô từ bộ điều khiển ATS) về bộ điều khiển máy phát.',
          'Cài đặt: ngưỡng thấp áp (vd. 85% Un), trễ chuyển sang máy phát 3–10 s, trễ về lưới 1–5 phút, thời gian chạy nguội máy phát.',
          ...CTRL_STEPS(['Thử chuyển nguồn: cắt Q1 → máy phát chạy → ATS chuyển II; đóng lại Q1 → sau trễ về I. Kiểm tra thứ tự pha của máy phát trùng lưới.'])
        ],
        notes: ['Hai nguồn không bao giờ được nối song song — kiểm tra khoá cả điện và cơ khí.', ...SAFETY]
      };
    }
  });

  // 7. Chiếu sáng + ổ cắm
  TPL.push({
    id: 'light', cat: 'light', name: 'Tủ chiếu sáng + ổ cắm', desc: 'MCB tổng 2P, các mạch đèn có công tắc, ổ cắm bảo vệ RCBO 30 mA',
    params: [{ k: 'nL', label: 'Số mạch đèn', type: 'num', def: 3, min: 1, max: 6, step: 1 }, { k: 'wL', label: 'Công suất mỗi mạch đèn', type: 'num', def: 400, min: 10, max: 2500, step: 10, unit: 'W' },
      { k: 'nS', label: 'Số mạch ổ cắm', type: 'num', def: 2, min: 0, max: 4, step: 1 }, { k: 'wS', label: 'Công suất dự kiến mỗi mạch ổ cắm', type: 'num', def: 2000, min: 100, max: 4000, step: 100, unit: 'W' },
      { k: 'U', label: 'Điện áp', type: 'sel', def: 220, opts: [220, 230], unit: 'V' }, Object.assign({}, P.L, { def: 25, label: 'Chiều dài mạch xa nhất' })],
    build(p) {
      const nL = Math.round(p.nL), nS = Math.round(p.nS);
      const IL = p.wL / (p.U * 0.9), IS = p.wS / (p.U * 0.95);
      const cbL = Math.max(pick(STD_MCB, IL * 1.25), 6), cbS = pick([16, 20, 25, 32], IS * 1.25) || 32;
      const total = nL * IL + nS * IS * 0.7, cbM = pick(STD_MCB, total * 1.25) || 63;
      const cL = cable({ Icb: cbL, Ib: IL, L: p.L, U: p.U, phase: 1, cos: 0.9, ins: 'PVC', k: 1, minS: 1.5, dUmax: 3 });
      const cS = cable({ Icb: cbS, Ib: IS, L: p.L, U: p.U, phase: 1, cos: 0.95, ins: 'PVC', k: 1, minS: 2.5, dUmax: 5 });
      const br = [];
      for (let i = 1; i <= nL; i++) br.push([{ t: 'cb', tag: 'Q' + i, lbl: `MCB 1P ${cbL}A` }, { t: 'sw', tag: 'S' + i, lbl: 'Công tắc' }, { t: 'lamp', tag: 'E' + i, lbl: `Đèn ${p.wL} W` }]);
      for (let j = 1; j <= nS; j++) br.push([{ t: 'rcbo', tag: 'Q' + (nL + j), lbl: `RCBO ${cbS}A 30mA` }, { t: 'sock', tag: 'X' + j, lbl: `Ổ cắm ${cbS >= 20 ? 20 : 16} A` }]);
      return {
        title: `Tủ chiếu sáng ${nL} mạch đèn + ${nS} mạch ổ cắm`,
        sections: [{ title: 'Sơ đồ nguyên lý 1 pha (vẽ trên dây L)', kind: 'final', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [{ t: 'cb', tag: 'Q0', lbl: `MCB 2P ${cbM}A (tổng)` }, { par: br }] }],
        devices: [
          { tag: 'Q0', type: 'mcb', spec: `MCB 2P ${cbM} A, đường cong C, 6 kA (cắt cả L và N)` },
          { tag: `Q1…Q${nL}`, type: 'mcb', spec: `MCB 1P ${cbL} A đường cong C (đèn LED nhiều bóng có dòng khởi động lớn: cân nhắc cong C hoặc D)`, qty: nL },
          ...(nS ? [{ tag: `Q${nL + 1}…Q${nL + nS}`, type: 'rcbo', spec: `RCBO 1P+N ${cbS} A, IΔn 30 mA, loại A`, qty: nS }] : []),
          { tag: 'S', type: 'switch', spec: 'Công tắc 1 chiều 10–16 A, lắp trên dây pha L', qty: nL },
          ...(nS ? [{ tag: 'X', type: 'switch', spec: 'Ổ cắm đôi 3 chấu 16 A có tiếp địa', qty: nS }] : []),
          { tag: 'E', type: 'lamp', spec: `Đèn LED, tổng ${p.wL} W mỗi mạch, PF ≥ 0.9`, qty: nL },
          { tag: 'W', type: 'cable', spec: `Mạch đèn: Cu/PVC 2×${cL.S} + E ${cL.S} mm² (ΔU ${cL.dU}%) · Ổ cắm: Cu/PVC 2×${cS.S} + E ${cS.S} mm² (ΔU ${cS.dU}%)` }
        ],
        calcs: [['Dòng mỗi mạch đèn', `${r1(IL)} A → MCB ${cbL} A`], ['Dòng mỗi mạch ổ cắm', `${r1(IS)} A → RCBO ${cbS} A`], ['Tổng (ks ổ cắm 0.7)', `${r1(total)} A → MCB tổng ${cbM} A`], ['Sụt áp', `đèn ${cL.dU}% (≤ 3%), ổ cắm ${cS.dU}% (≤ 5%)`]],
        steps: ['Công tắc luôn cắt dây pha L, không cắt dây N.', 'Mỗi mạch có dây N riêng đi cùng dây L của mạch đó (không dùng chung N giữa các RCBO — RCBO sẽ nhảy).',
          'Ổ cắm: L bên phải, N bên trái (nhìn chính diện), chấu giữa PE.', 'Màu dây: L nâu/đỏ, N xanh dương, PE vàng-xanh.',
          'Kiểm tra: nhấn nút Test trên từng RCBO — phải nhảy. Đo cách điện L–N, L–PE ≥ 1 MΩ (tháo bóng LED/driver trước khi đo).'],
        notes: ['Ổ cắm, khu ẩm ướt, nhà vệ sinh bắt buộc có bảo vệ dòng rò 30 mA.', ...SAFETY]
      };
    }
  });

  // 8. Cầu thang
  TPL.push({
    id: 'stair', cat: 'light', name: 'Đèn cầu thang 2 vị trí', desc: 'Hai công tắc 2 chiều bật/tắt một đèn từ 2 nơi',
    params: [{ k: 'n', label: 'Số bóng', type: 'num', def: 2, min: 1, max: 3, step: 1 }, { k: 'w', label: 'Công suất mỗi bóng', type: 'num', def: 18, min: 3, max: 200, step: 1, unit: 'W' }],
    build(p) {
      const n = Math.round(p.n), lamps = []; for (let i = 1; i <= n; i++) lamps.push([{ t: 'lamp', tag: 'E' + i, lbl: `${p.w} W` }]);
      return {
        title: 'Đèn cầu thang điều khiển 2 nơi',
        sections: [{ title: 'Sơ đồ 1 pha 220 V', kind: 'final', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [
          { t: 'cb', tag: 'Q1', lbl: 'MCB 1P 6A' },
          { t: 'sw2', ttag: 'S1', btag: 'S2', lbl: 'Công tắc 2 chiều', links: [['S1:T1', 'S2:T1', 'Dây đảo 1'], ['S1:T2', 'S2:T2', 'Dây đảo 2']] },
          n > 1 ? { par: lamps } : lamps[0][0]] }],
        devices: [{ tag: 'Q1', type: 'mcb', spec: 'MCB 1P 6A đường cong C' }, { tag: 'S1, S2', type: 'switch', spec: 'Công tắc 2 chiều (2 way) 10 A, 3 cọc: COM (L), L1, L2', qty: 2 },
          { tag: 'E', type: 'lamp', spec: `${n} bóng LED ${p.w} W`, qty: n }, { tag: 'W', type: 'cable', spec: 'Cu/PVC 1.5 mm²: 1 dây pha vào S1, 2 dây đảo S1↔S2, 1 dây từ S2 ra đèn, N trực tiếp tới đèn' }],
        calcs: [['Dòng', `${r1(n * p.w / 220 / 0.9)} A`]],
        steps: ['Dây pha L (sau MCB) vào cọc COM của S1.', 'Hai dây đảo: L1 của S1 → L1 của S2; L2 của S1 → L2 của S2.', 'COM của S2 → đèn; dây N đi thẳng từ tủ tới đèn, không qua công tắc.', 'Muốn điều khiển 3 nơi: thêm 1 công tắc đảo (intermediate, 4 cọc) chen giữa hai dây đảo.', 'Kiểm tra: thử tất cả 4 tổ hợp vị trí S1/S2 — đèn phải đổi trạng thái mỗi khi gạt 1 công tắc.'],
        notes: SAFETY
      };
    }
  });

  // 9. Chiếu sáng tự động
  TPL.push({
    id: 'autolight', cat: 'light', name: 'Chiếu sáng tự động (timer + cảm biến)', desc: 'Contactor 4P, chế độ Tay/Tự động, đồng hồ hẹn giờ và cảm biến ánh sáng',
    params: [{ k: 'kW', label: 'Tổng công suất đèn', type: 'num', def: 6, min: 0.5, max: 200, step: 0.5, unit: 'kW' }, P.U, P.ik],
    build(p) {
      const I = p.kW * 1000 / (SQ3 * p.U * 0.9), cb = cbFor(I, 4, p.ik, { curve: 'C' }), km = kmFor(I * 1.5);
      return {
        title: `Chiếu sáng tự động ${p.kW} kW`,
        sections: [
          { title: 'Mạch động lực 3P+N', kind: 'power', poles: ['L1', 'L2', 'L3', 'N'], top: true, net: [{ t: 'cb', tag: 'Q1', lbl: cb.short }, { t: 'km', tag: 'KM1', lbl: `Contactor 4P ${km} A` }, { t: 'load', lbl: 'Các mạch đèn (chia đều 3 pha)' }] },
          { title: 'Điều khiển 220 VAC', kind: 'ac', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [
            { t: 'cb', tag: 'F1', lbl: 'MCB 1P 2A' },
            { par: [[{ t: 'no', act: 'sel', tag: 'S1', lbl: 'TAY' }],
              [{ t: 'no', act: 'sel', tag: 'S1', tt: ['23'], bt: ['24'], lbl: 'TỰ ĐỘNG' }, { t: 'no', act: 'timer', tag: 'KT1', tt: ['1'], bt: ['2'], lbl: 'Hẹn giờ', links: [['KT1:L', 'L (sau F1)', 'Nguồn'], ['KT1:N', 'N', '']] },
                { t: 'no', act: 'light', tag: 'B1', tt: ['3'], bt: ['4'], lbl: 'Cảm biến ánh sáng', links: [['B1:L', 'L (sau F1)', 'Nguồn'], ['B1:N', 'N', '']] }]] },
            { par: [[{ t: 'coil', tag: 'KM1' }], [{ t: 'lamp', tag: 'H1', lbl: 'Đang bật' }]] }] }
        ],
        devices: [{ tag: 'Q1', type: cb.type, spec: cb.spec }, { tag: 'KM1', type: 'contactor', spec: `4 cực, ≥ 1.5·I = ${r1(I * 1.5)} A → ${km} A (đèn LED có dòng khởi động lớn — tra bảng tải đèn AC-5a/5b của hãng)` },
          { tag: 'S1', type: 'sel', spec: 'Công tắc xoay 3 vị trí TAY–0–TỰ ĐỘNG (2NO)' }, { tag: 'KT1', type: 'time_switch', spec: 'Đồng hồ hẹn giờ tuần, gắn DIN, có pin lưu' },
          { tag: 'B1', type: 'photocell', spec: 'Cảm biến ánh sáng 2–2000 lux, đầu dò ngoài trời IP65' }, { tag: 'F1', type: 'mcb', spec: 'MCB 1P 2A' }, { tag: 'H1', type: 'pilot', spec: 'Đèn báo xanh 220 VAC' }],
        calcs: [['Dòng mỗi pha', `${r1(I)} A`], ['CB Q1', `${cb.In} A`], ['Contactor', `${km} A`]],
        steps: ['Chia đều các mạch đèn cho 3 pha để cân bằng tải.', 'Ở TỰ ĐỘNG đèn chỉ bật khi đồng hồ trong khung giờ VÀ trời tối (tiếp điểm nối tiếp).',
          'Đầu dò cảm biến ánh sáng đặt hướng Bắc, tránh bị chính đèn chiếu vào.', ...CTRL_STEPS(['Chuyển TAY: KM1 hút. Chuyển TỰ ĐỘNG, che cảm biến và đặt giờ hiện tại trong khung: KM1 hút.'])],
        notes: SAFETY
      };
    }
  });

  // 10. PLC I/O
  TPL.push({
    id: 'plc', cat: 'plc', name: 'Đấu nối PLC ngõ vào/ra', desc: 'Nguồn 24 VDC, nút nhấn + cảm biến 3 dây vào PLC, ngõ ra rơ-le điều khiển contactor/đèn',
    params: [{ k: 'nB', label: 'Số nút nhấn', type: 'num', def: 2, min: 0, max: 4, step: 1 }, { k: 'nSn', label: 'Số cảm biến 3 dây', type: 'num', def: 2, min: 0, max: 8, step: 1 },
      { k: 'st', label: 'Loại cảm biến', type: 'sel', def: 'PNP', opts: ['PNP', 'NPN'] }, { k: 'nK', label: 'Số contactor điều khiển', type: 'num', def: 2, min: 0, max: 6, step: 1 },
      { k: 'nH', label: 'Số đèn báo', type: 'num', def: 1, min: 0, max: 3, step: 1 }, { k: 'pw', label: 'Nguồn nuôi PLC', type: 'sel', def: '24 VDC', opts: ['24 VDC', '220 VAC'] }],
    build(p) {
      const nB = Math.round(p.nB), nSn = Math.round(p.nSn), nK = Math.round(p.nK), nH = Math.round(p.nH), pnp = p.st === 'PNP';
      const ins = []; let ii = 0;
      const btnName = ['Start', 'Stop', 'Nút 3', 'Nút 4'];
      for (let i = 0; i < nB; i++) {
        const addr = `I${Math.floor(ii / 8)}.${ii++ % 8}`, nc = i === 1;
        const btn = { t: nc ? 'nc' : 'no', act: 'push', tag: 'S' + (i + 1), lbl: btnName[i] + (nc ? ' (NC)' : '') };
        const inp = { t: 'plcin', tag: 'PLC', lbl: addr, tt: [pnp ? addr : 'COM'], bt: [pnp ? 'COM' : addr] };
        ins.push(pnp ? [btn, inp] : [inp, btn]);
      }
      for (let i = 0; i < nSn; i++) {
        const addr = `I${Math.floor(ii / 8)}.${ii++ % 8}`, tag = 'B' + (i + 1);
        const sn = pnp ? { t: 'sensor', tag, lbl: 'Cảm biến PNP', tt: ['BN'], bt: ['BK'], links: [[tag + ':BU (xanh dương)', '0V', '']] }
          : { t: 'sensor', tag, lbl: 'Cảm biến NPN', tt: ['BK'], bt: ['BU'], links: [[tag + ':BN (nâu)', '+24V', '']] };
        const inp = { t: 'plcin', tag: 'PLC', lbl: addr, tt: [pnp ? addr : 'COM'], bt: [pnp ? 'COM' : addr] };
        ins.push(pnp ? [sn, inp] : [inp, sn]);
      }
      const outs = []; let oi = 0;
      for (let i = 0; i < nK; i++) { const a = `Q${Math.floor(oi / 8)}.${oi++ % 8}`; outs.push([{ t: 'plcout', tag: 'PLC', lbl: a, tt: ['COM0'], bt: [a] }, { t: 'coil', tag: 'K' + (i + 1), lbl: 'Contactor' }]); }
      for (let i = 0; i < nH; i++) { const a = `Q${Math.floor(oi / 8)}.${oi++ % 8}`; outs.push([{ t: 'plcout', tag: 'PLC', lbl: a, tt: ['COM0'], bt: [a] }, { t: 'lamp', tag: 'H' + (i + 1), lbl: 'Đèn báo' }]); }
      const nIn = ii, nOut = oi;
      const psuA = Math.max(2.5, pick([2.5, 5, 10], 0.5 + nSn * 0.05 + 0.3) || 2.5);
      const psuNet = p.pw === '220 VAC' ? [{ t: 'cb', tag: 'F1', lbl: 'MCB 1P 4A' }, { par: [[{ t: 'psu', tag: 'G1', lbl: `Nguồn 24VDC ${psuA}A`, links: [['G1:+V', '+24V', ''], ['G1:-V', '0V', '']] }], [{ t: 'box2', tag: 'PLC', lbl: 'Nguồn PLC (L/N)', tt: ['L'], bt: ['N'] }]] }]
        : [{ t: 'cb', tag: 'F1', lbl: 'MCB 1P 4A' }, { t: 'psu', tag: 'G1', lbl: `Nguồn 24VDC ${psuA}A`, links: [['G1:+V', '+24V', 'Cấp cho PLC và ngõ vào'], ['G1:-V', '0V', ''], ['PLC:+24V (nguồn)', '+24V', ''], ['PLC:0V (nguồn)', '0V', '']] }];
      const secs = [{ title: 'Nguồn', kind: 'ac', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: psuNet }];
      if (ins.length) secs.push({ title: `Ngõ vào PLC (${pnp ? 'PNP – sink input' : 'NPN – source input'})`, kind: 'dc', poles: ['+24V'], bpoles: ['0V'], top: true, bottom: true, net: [ins.length > 1 ? { par: ins } : ins[0]].flat() });
      if (outs.length) secs.push({ title: 'Ngõ ra rơ-le PLC 220 VAC', kind: 'ac', poles: ['L'], bpoles: ['N'], top: true, bottom: true, net: [{ t: 'cb', tag: 'F2', lbl: 'MCB 1P 4A' }, outs.length > 1 ? { par: outs } : outs[0]].flat() });
      return {
        title: `PLC ${nIn} DI / ${nOut} DO — cảm biến ${p.st}`,
        sections: secs,
        devices: [
          { tag: 'PLC', type: 'plc', spec: `≥ ${Math.ceil(nIn * 1.2)} DI 24 VDC (${pnp ? 'sink' : 'source'}), ≥ ${Math.ceil(nOut * 1.2)} DO rơ-le (dự phòng 20%), nguồn ${p.pw}` },
          { tag: 'G1', type: 'psu', spec: `Nguồn 24 VDC ${psuA} A (PLC ~0.3–0.5 A + cảm biến ~50 mA/cái + dự phòng)` },
          ...(nB ? [{ tag: 'S', type: 'pb', spec: 'Nút nhấn Ø22; nút Stop dùng tiếp điểm NC (an toàn khi đứt dây)', qty: nB }] : []),
          ...(nSn ? [{ tag: 'B', type: 'sensor_ind', spec: `Cảm biến tiệm cận 3 dây ${p.st} NO, 10–30 VDC (nâu +, xanh dương 0 V, đen tín hiệu)`, qty: nSn }] : []),
          ...(nK ? [{ tag: 'K', type: 'contactor', spec: 'Cuộn hút 220 VAC + bộ dập RC lắp trên cuộn (bảo vệ tiếp điểm ngõ ra PLC)', qty: nK }] : []),
          ...(nH ? [{ tag: 'H', type: 'pilot', spec: 'Đèn báo LED 220 VAC', qty: nH }] : []),
          { tag: 'F1, F2', type: 'mcb', spec: 'MCB 1P 4A' }, { tag: 'X', type: 'terminal', spec: 'Cầu đấu 2.5 mm² cho nguồn, 1.0 mm² cho I/O; tách hàng 24 VDC và 220 VAC' }
        ],
        calcs: [['Số ngõ vào', `${nIn} (đề nghị PLC ≥ ${Math.ceil(nIn * 1.2)} DI)`], ['Số ngõ ra', `${nOut} (đề nghị ≥ ${Math.ceil(nOut * 1.2)} DO)`], ['Nguồn 24 V', `${psuA} A`]],
        steps: [
          pnp ? 'Cảm biến PNP: chân COM (S/S, 1M) của nhóm ngõ vào nối 0 V; tín hiệu đen của cảm biến vào I0.x.' : 'Cảm biến NPN: chân COM (S/S, 1M) của nhóm ngõ vào nối +24 V; dây đen của cảm biến kéo I0.x xuống 0 V.',
          'Tên địa chỉ theo hãng: Siemens I0.0/Q0.0 (COM: 1M, 1L) · Schneider %I0.0/%Q0.0 · Mitsubishi X0/Y0 (COM: S/S, COM0) · Omron 0.00/100.00 · LS XGB: P0000/P0020… (xem manual).',
          'Ngõ ra rơ-le: L → COM0 của PLC; Q0.x → A1 cuộn contactor; A2 → N. Mỗi nhóm COM chịu tối đa ~8 A tổng, mỗi ngõ ~2 A.',
          'Tách máng cáp 24 VDC và 220 VAC; dây 24 V màu xanh dương (DC), dây điều khiển AC màu đỏ theo IEC 60204-1.',
          'Kiểm tra: bật nguồn, nhấn từng nút/che từng cảm biến và xem đèn LED ngõ vào trên PLC; ép (force) từng ngõ ra trong phần mềm và xem contactor hút.'
        ],
        notes: ['Không trộn cảm biến PNP và NPN trên cùng một nhóm COM.', 'Dừng khẩn cấp phải đi bằng rơ-le an toàn cứng (safety relay), không chỉ qua PLC thường.', ...SAFETY]
      };
    }
  });

  const CATS = [{ id: 'motor', name: 'Động cơ' }, { id: 'dist', name: 'Phân phối' }, { id: 'light', name: 'Chiếu sáng' }, { id: 'plc', name: 'PLC / I-O' }];
  G.CircuitLib = { TPL, CATS, BRANDS, CAT, brandPick, calc: { cbFor, kmFor, olFor, cable, motorIn, motorPf } };
})(typeof window !== 'undefined' ? window : globalThis);
