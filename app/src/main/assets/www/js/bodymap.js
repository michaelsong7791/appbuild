/* Forge — anatomical body map (front & back) rendered as SVG with smooth muscle shapes. */
(function () {
  'use strict';
  // Closed Catmull-Rom spline -> cubic Bezier path.
  function smooth(pts) {
    const n = pts.length; let d = 'M' + pts[0][0] + ',' + pts[0][1];
    for (let i = 0; i < n; i++) {
      const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += 'C' + c1.map(r).join(',') + ' ' + c2.map(r).join(',') + ' ' + p2.join(',');
    }
    return d + 'Z';
  }
  const r = v => Math.round(v * 10) / 10;
  const mir = pts => pts.map(p => [200 - p[0], p[1]]).reverse();

  // Body silhouette (left half, center line x=100), traced top -> bottom.
  const OUT = [[92, 58], [90, 70], [72, 79], [56, 86], [46, 100], [43, 124], [39, 150], [34, 176], [27, 204], [22, 234], [18, 250], [24, 262], [32, 256], [38, 238], [46, 210], [53, 186], [58, 166], [62, 144], [64, 158], [67, 186], [69, 212], [66, 236], [62, 268], [60, 304], [63, 340], [60, 364], [60, 394], [64, 420], [58, 432], [80, 436], [84, 422], [85, 392], [88, 352], [94, 304], [98, 256], [100, 250]];

  const FRONT = {
    traps: [[[89, 66], [80, 76], [68, 84], [82, 88], [95, 80]]],
    shoulders: [[[64, 86], [53, 93], [47, 108], [49, 124], [57, 122], [65, 108], [74, 94]]],
    chest: [[[77, 92], [67, 107], [68, 127], [83, 136], [98, 132], [98, 98], [89, 91]]],
    biceps: [[[49, 129], [44, 146], [44, 166], [50, 173], [57, 163], [60, 141], [58, 127]]],
    forearms: [[[44, 179], [36, 200], [30, 228], [35, 238], [44, 228], [51, 205], [54, 184]]],
    abdominals: [{ sym: [[100, 138], [111, 139], [115, 170], [113, 205], [106, 226], [100, 230]] }, [[71, 134], [67, 160], [70, 192], [82, 210], [84, 172], [84, 142]]],
    quadriceps: [[[74, 234], [66, 262], [64, 300], [69, 333], [80, 344], [90, 331], [93, 291], [92, 252], [85, 237]]],
    adductors: [[[96, 240], [93, 258], [94, 292], [99, 297], [100, 246]]],
    calves: [[[70, 357], [64, 381], [66, 409], [74, 419], [80, 404], [82, 375], [78, 357]]],
  };
  const BACK = {
    traps: [{ sym: [[100, 58], [110, 70], [130, 84], [116, 98], [106, 122], [100, 142]] }],
    shoulders: [[[64, 86], [52, 94], [47, 112], [55, 119], [68, 105], [75, 92]]],
    'middle back': [[[86, 100], [80, 114], [88, 140], [98, 152], [98, 112]]],
    lats: [[[69, 108], [64, 133], [70, 170], [84, 197], [92, 177], [88, 143], [79, 114]]],
    triceps: [[[48, 120], [42, 142], [44, 166], [52, 171], [58, 151], [58, 125]]],
    forearms: [[[44, 179], [36, 200], [30, 228], [35, 238], [44, 228], [51, 205], [54, 184]]],
    'lower back': [{ sym: [[100, 168], [108, 176], [113, 202], [108, 222], [100, 228]] }],
    glutes: [[[73, 224], [67, 245], [72, 266], [88, 273], [98, 262], [98, 233], [87, 223]]],
    abductors: [[[68, 226], [62, 246], [64, 264], [70, 250]]],
    hamstrings: [[[71, 277], [66, 305], [70, 336], [80, 345], [90, 334], [94, 300], [92, 279], [82, 275]]],
    calves: [[[68, 354], [62, 375], [64, 399], [72, 407], [80, 397], [84, 373], [80, 354]]],
  };

  // Fix symmetric shapes: build full outline from half including both center points.
  function symShape(half) { const top = half[0], bot = half[half.length - 1]; const mid = half.slice(1, -1); return [top].concat(mid, [bot], mir(mid)); }
  function shapesFixed(def) {
    const out = [];
    for (const m in def) def[m].forEach(s => {
      if (s.sym) out.push({ m, d: smooth(symShape(s.sym)) });
      else { out.push({ m, d: smooth(s) }); out.push({ m, d: smooth(mir(s)) }); }
    });
    return out;
  }
  const F = shapesFixed(FRONT), B = shapesFixed(BACK);
  const SIL = smooth(symShape(OUT));

  /**
   * values: { muscle: 0..1 } ; opts.mode: 'fatigue' | 'target' | 'mastery'
   */
  function svg(side, values, opts) {
    opts = opts || {}; values = values || {};
    const list = side === 'back' ? B : F;
    const color = opts.color || defaultColor(opts.mode);
    let s = '<svg viewBox="10 22 180 420" class="bodymap" role="img" aria-label="' + side + ' body map">';
    s += '<ellipse cx="100" cy="38" rx="17" ry="21" class="bm-sil"/>';
    s += '<path d="' + SIL + '" class="bm-sil"/>';
    list.forEach(p => {
      const v = values[p.m];
      const fill = v == null ? null : color(v);
      s += '<path d="' + p.d + '" class="bm-m' + (fill ? '' : ' bm-off') + '" data-m="' + p.m + '"' + (fill ? ' style="fill:' + fill + '"' : '') + '/>';
    });
    return s + '</svg>';
  }
  function defaultColor(mode) {
    if (mode === 'target') return v => v <= 0 ? null : 'color-mix(in oklab, var(--accent) ' + Math.round(35 + 65 * v) + '%, var(--bm-base))';
    if (mode === 'mastery') return v => 'color-mix(in oklab, var(--gold) ' + Math.round(15 + 85 * v) + '%, var(--bm-base))';
    // fatigue: 0 = fresh (cool) -> 1 = fried (hot)
    return v => {
      if (v < 0.12) return 'var(--fresh)';
      if (v < 0.4) return 'color-mix(in oklab, var(--warm) ' + Math.round((v - 0.12) / 0.28 * 100) + '%, var(--fresh))';
      return 'color-mix(in oklab, var(--hot) ' + Math.round(Math.min(1, (v - 0.4) / 0.45) * 100) + '%, var(--warm))';
    };
  }
  window.BodyMap = { svg };
})();
