/* Forge — muscle visuals for Strava: an emoji bar chart in the activity description (automatic) and a
   shareable muscle-map image (Strava's API doesn't let personal apps attach photos, so the image is saved to the
   phone's Pictures/Forge album and the activity is opened in Strava, where it's one tap to add). */
(function () {
  'use strict';
  const E = window.Engine, F = window.F, A = F.actions, B = window.Bridge, esc = F.esc;
  const S = () => F.S();

  const COL = { bg: '#0a0b0e', surface: '#13151a', line: '#2a2e38', text: '#f2f0ea', muted: '#8b909b', accent: '#ff6a33', accent2: '#ff9a3c', base: '#2a2e38', off: '#1f232b', sil: '#171a20', gold: '#ffc94a' };

  /** Muscle-group shares of the session's work, largest first: [[groupKey, pct], …] */
  function groupShares(s) {
    const list = F.subList(F.itemsSub(s.items, true)); const g = {};
    list.forEach(x => { g[x.group] = (g[x.group] || 0) + x.pct; });
    return Object.keys(g).map(k => [k, g[k]]).sort((a, b) => b[1] - a[1]);
  }
  const gLabel = k => (F.mLabel ? F.mLabel(k) : k) || k;

  /** Text chart for the Strava description. */
  F.musclesText = s => {
    const gs = groupShares(s).filter(x => x[1] >= 4).slice(0, 6); if (!gs.length) return '';
    const top = gs[0][1];
    return '💪 Muscles worked\n' + gs.map(([k, p]) => { const n = Math.max(1, Math.round(8 * p / top)); return '🟧'.repeat(n) + '⬜'.repeat(8 - n) + ' ' + gLabel(k) + ' ' + Math.round(p) + '%'; }).join('\n');
  };

  // ---------- image card ----------
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const x = hex(a), y = hex(b); return 'rgb(' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t))).join(',') + ')'; };
  function svgFor(side, vals, w) {
    let s = window.BodyMap.svg(side, vals, { mode: 'target' });
    s = s.replace(/color-mix\(in oklab, var\(--accent\) (\d+)%, var\(--bm-base\)\)/g, (m, p) => mix(COL.accent, COL.base, +p / 100));
    const h = Math.round(w * 420 / 180);
    s = s.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" ')
      .replace(/(<svg[^>]*>)/, '$1<style>.bm-sil{fill:' + COL.sil + '}.bm-m{fill:' + COL.base + ';stroke:' + COL.bg + ';stroke-width:.8}.bm-m.bm-off{fill:' + COL.off + '}</style>');
    return new Promise((ok, bad) => { const im = new Image(); im.onload = () => ok(im); im.onerror = bad; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); });
  }
  function round(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fit(ctx, txt, max) { if (ctx.measureText(txt).width <= max) return txt; while (txt.length > 3 && ctx.measureText(txt + '…').width > max) txt = txt.slice(0, -1); return txt + '…'; }

  F.muscleCard = async s => {
    const W = 1080, H = 1350; const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    try { await Promise.all(['700 76px "Barlow Condensed"', '500 32px Barlow', '600 30px Barlow'].map(f => document.fonts.load(f))); } catch (e) { }
    const D = "'Barlow Condensed', 'Barlow', sans-serif", T = "'Barlow', sans-serif";
    // background
    g.fillStyle = COL.bg; g.fillRect(0, 0, W, H);
    const rg = g.createRadialGradient(W, 0, 40, W, 0, 900); rg.addColorStop(0, 'rgba(255,106,51,.28)'); rg.addColorStop(1, 'rgba(255,106,51,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
    // header
    const x = E.sessionStats(s); const en = s.energy || window.Energy.strengthEnergy(s, S());
    g.fillStyle = COL.accent; g.font = '700 30px ' + D; g.fillText('FORGE  ·  MUSCLES WORKED', 72, 104);
    g.fillStyle = COL.text; g.font = '700 76px ' + D; g.fillText(fit(g, s.title.toUpperCase(), W - 144), 72, 182);
    g.fillStyle = COL.muted; g.font = '500 32px ' + T;
    g.fillText(new Date(s.date).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + '  ·  ' + x.dur + ' min  ·  ' + x.sets + ' sets  ·  ' + F.fmtVol(x.vol) + ' ' + (s.u || F.u()) + '  ·  ' + en.total + ' kcal', 72, 236);
    // body maps
    const mv = window.Muscles.mapValues(F.itemsSub(s.items, true));
    const mw = 300; const [fr, bk] = await Promise.all([svgFor('front', mv.front, mw), svgFor('back', mv.back, mw)]);
    const my = 290; g.drawImage(fr, 40, my); g.drawImage(bk, 40 + mw + 10, my);
    g.fillStyle = COL.muted; g.font = '600 24px ' + T; g.textAlign = 'center';
    g.fillText('FRONT', 40 + mw / 2, my + 712); g.fillText('BACK', 50 + mw * 1.5, my + 712); g.textAlign = 'left';
    // top muscles panel
    const px = 690, pw = W - px - 56; let py = 318;
    g.fillStyle = COL.text; g.font = '700 34px ' + D; g.fillText('TOP MUSCLES', px, py); py += 34;
    const gs = groupShares(s).filter(q => q[1] >= 3).slice(0, 7); const top = gs.length ? gs[0][1] : 1;
    gs.forEach(([k, p], i) => {
      py += 62; g.fillStyle = COL.text; g.font = '600 30px ' + T; g.fillText(fit(g, gLabel(k), pw - 80), px, py);
      g.fillStyle = COL.muted; g.textAlign = 'right'; g.fillText(Math.round(p) + '%', px + pw, py); g.textAlign = 'left';
      round(g, px, py + 14, pw, 12, 6); g.fillStyle = COL.line; g.fill();
      round(g, px, py + 14, Math.max(14, pw * p / top), 12, 6); const lg = g.createLinearGradient(px, 0, px + pw, 0); lg.addColorStop(0, COL.accent); lg.addColorStop(1, COL.accent2); g.fillStyle = i === 0 ? lg : mix(COL.accent, COL.base, 0.55 + 0.45 * p / top); g.fill();
    });
    // exercises
    let ey = 1052; g.fillStyle = COL.line; g.fillRect(72, ey - 44, W - 144, 2);
    const items = s.items.filter(it => it.sets.some(z => z.done)).slice(0, 6);
    g.font = '500 29px ' + T;
    items.forEach((it, i) => {
      const e = E.ex(it.exId); const d = it.sets.filter(z => z.done); const col = i % 2, row = Math.floor(i / 2);
      const xx = 72 + col * 480, yy = ey + row * 52;
      const top = Math.max(...d.map(z => z.w || 0)); const reps = Math.round(d.reduce((a, z) => a + (z.r || 0), 0) / d.length);
      const unitS = F.repUnit(it.exId, it) === 'sec' ? 's' : '';
      g.fillStyle = COL.text; g.fillText(fit(g, (it.alias || (e ? e.n : it.exId)), 300), xx, yy);
      g.fillStyle = COL.muted; g.fillText(d.length + '×' + reps + unitS + (top ? ' @' + F.fmtW(top) : ''), xx + 312, yy);
    });
    if (s.items.length > 6) { g.fillStyle = COL.muted; g.font = '500 26px ' + T; g.fillText('+ ' + (s.items.length - 6) + ' more', 72, ey + 3 * 52 + 4); }
    if ((s.prs || []).length) { g.fillStyle = COL.gold; g.font = '700 30px ' + D; g.textAlign = 'right'; g.fillText('🏆 ' + s.prs.length + ' PR' + (s.prs.length > 1 ? 'S' : ''), W - 72, 104); g.textAlign = 'left'; }
    return c.toDataURL('image/png');
  };

  // ---------- UI ----------
  A.muscleCard = async d => {
    const s = S().sessions.find(x => x.id === d.id); if (!s) return;
    F.sheet({ t: 'muscleCard', id: s.id, url: null });
    try { const url = await F.muscleCard(s); if (F.UI.sheet && F.UI.sheet.t === 'muscleCard' && F.UI.sheet.id === s.id) { F.UI.sheet.url = url; F.render(); } }
    catch (e) { F.toast('Could not draw the image: ' + e.message); }
  };
  F.sheets = F.sheets || {};
  F.sheets.muscleCard = sh => {
    const s = S().sessions.find(x => x.id === sh.id); if (!s) return '';
    const up = s.synced && s.synced.strava;
    let h = '<h2>Muscle map</h2><div class="small muted" style="margin:4px 0 12px">' + (up ? 'Strava doesn\'t let apps attach photos directly, so Forge saves this to your Photos (Pictures › Forge) and opens the activity — tap <b>Add photos</b> / ✏️ Edit there and pick it.' : 'Save or share this card. Upload the workout to Strava first to open it straight in the Strava app.') + '</div>';
    h += sh.url ? '<img src="' + sh.url + '" alt="Muscle map" style="width:100%;border-radius:14px;display:block;border:1px solid var(--line)">' : '<div class="card flat" style="aspect-ratio:4/5;display:flex;align-items:center;justify-content:center"><span class="muted">Drawing…</span></div>';
    h += '<div class="row wrap" style="margin-top:14px;gap:8px">';
    if (up) h += '<button class="btn primary grow" data-a="mapToStrava" data-id="' + s.id + '"' + (sh.url ? '' : ' disabled') + '>🧡 Save &amp; open in Strava</button>';
    else h += '<button class="btn primary grow" data-a="mapSave" data-id="' + s.id + '"' + (sh.url ? '' : ' disabled') + '>⬇️ Save to Photos</button>';
    h += '<button class="btn grow" data-a="mapShare" data-id="' + s.id + '"' + (sh.url ? '' : ' disabled') + '>Share…</button></div>';
    return h;
  };
  const b64 = () => (F.UI.sheet && F.UI.sheet.url || '').split(',')[1];
  const fname = s => 'forge-' + new Date(s.date).toISOString().slice(0, 10) + '-' + s.id + '.png';
  async function save(s) {
    const r = await B.call('media.saveImage', { b64: b64(), name: fname(s) });
    if (r && r.saved === false) { await B.call('media.shareImage', { b64: b64(), name: fname(s), text: '' }); return false; }
    return true;
  }
  A.mapSave = async d => { const s = S().sessions.find(x => x.id === d.id); try { if (await save(s)) F.toast('Saved to Photos › Forge'); } catch (e) { F.toast('Save failed: ' + e.message); } };
  A.mapShare = async d => { const s = S().sessions.find(x => x.id === d.id); try { await B.call('media.shareImage', { b64: b64(), name: fname(s), text: s.title }); } catch (e) { F.toast('Share failed: ' + e.message); } };
  A.mapToStrava = async d => {
    const s = S().sessions.find(x => x.id === d.id);
    try {
      const ok = await save(s);
      if (!s.stravaId && s.stravaUpload) { try { const r = await B.call('strava.uploadStatus', { uploadId: s.stravaUpload }); if (r && r.activityId) { s.stravaId = r.activityId; F.save(); } } catch (e) { } }
      if (ok) F.toast('Saved to Photos — in Strava tap Add photos and pick the newest image');
      B.call('app.openUrl', { url: s.stravaId ? 'https://www.strava.com/activities/' + s.stravaId : 'https://www.strava.com/athlete/training' }).catch(() => { });
    } catch (e) { F.toast('Save failed: ' + e.message); }
  };
})();
