/* Demo stand-in for the Google Drive script behind the Cutting Station.
 * Same actions and replies as the real one, but everything is kept in this browser (localStorage) and starts from invented data
 * in data/cutstation-seed.json. Nothing is sent anywhere. */
(function () {
  'use strict';
  var KEY = 'demo.drive.v2', RKEY = 'cutplan.records.v1', SEEDED = 'demo.seeded.v2';
  var seedP = null, st = null;
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };
  var todayIso = function () { var t = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return t.getFullYear() + '-' + p(t.getMonth() + 1) + '-' + p(t.getDate()); };
  var nowIso = function () { return new Date().toISOString().slice(0, 19).replace('T', ' '); };

  function seed() { return seedP || (seedP = fetch('data/cutstation-seed.json').then(function (r) { return r.json(); }).then(function (sd) { window.__demoSeed = sd; return sd; })); }
  function persist() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) { /* private mode: keeps working for this visit */ } }
  function load() {
    return seed().then(function (sd) {
      if (st) return st;
      try { st = JSON.parse(localStorage.getItem(KEY)); } catch (e) { st = null; }
      if (!st) {
        st = { plans: clone(sd.drivePlans), recs: clone(sd.driveRecs), status: clone(sd.status), releases: clone(sd.releases), items: clone(sd.itemRows), history: [] };
        persist();
      }
      try { if (!localStorage.getItem(SEEDED)) { localStorage.setItem(RKEY, JSON.stringify(sd.recs)); localStorage.setItem(SEEDED, '1'); } } catch (e) { /* ignore */ }
      return st;
    });
  }
  load();   // seeds the "Accepted plans" list as soon as the page opens

  var REL_HEAD = ['Project', 'Drawing No.', 'Spool No.', 'Item Code', 'Length', 'Group', 'Bevel', 'Plan No', 'Reason', 'Released At', 'Pipe Barcode', 'Control No', 'Heat No', 'Pipe Planned Remain', 'Returned To Pipe', 'Remark', 'Released By', 'Id'];
  var relRow = function (r) {
    var p = r.piece || {};
    return [p.project, p.drawing, p.spool, p.item, p.length, p.group, p.bevel, r.planNo, r.reason, r.at, p.barcode, p.control, p.heat, r.plannedRemain, r.returned, r.remark || '', r.by, r.id];
  };
  var weekNo = function (x) { var m = /(\d+)/.exec(String(x)); return m ? +m[1] : null; };

  var actions = {
    listPlans: function () { return { plans: st.plans.slice().sort(function (a, b) { return String(b.savedAt).localeCompare(String(a.savedAt)); }) }; },
    openPlan: function (b) {
      var rec = st.recs[b.planNo]; if (!rec) throw new Error('Plan ' + b.planNo + ' was not found.');
      var released = {};
      st.releases.forEach(function (r) { if (r.planNo === b.planNo) released[r.id] = { reason: r.reason, remark: r.remark, at: r.at, by: r.by, returned: r.returned }; });
      return { rec: clone(rec), status: clone(st.status[b.planNo] || {}), released: released };
    },
    savePlan: function (b) {
      var f = (b.files || []).filter(function (x) { return /\.json$/.test(x.name); })[0];
      if (!f) throw new Error('The plan file was missing.');
      var rec = JSON.parse(decodeURIComponent(escape(atob(f.b64))));
      st.recs[b.planNo] = rec;
      st.plans = st.plans.filter(function (p) { return p.planNo !== b.planNo; });
      st.plans.push({ planNo: b.planNo, project: rec.project, date: rec.date, pipes: rec.bars.length, pieces: rec.summary.placed, savedAt: nowIso() });
      persist(); return { saved: (b.files || []).length };
    },
    saveCut: function (b) {
      (b.changes || []).forEach(function (c) {
        var planNo = c.id.split('|')[0], pl = (st.status[planNo] = st.status[planNo] || {});
        var s = pl[c.id] || { cut: false, cutDate: '', bevel: false, bevelDate: '' };
        s[c.kind] = !!c.done; s[c.kind + 'Date'] = c.done ? c.date : '';
        if (!s.cut && !s.bevel) delete pl[c.id]; else pl[c.id] = s;
        st.history.push([nowIso(), 'demo.viewer@example.com', planNo, c.id, c.kind === 'cut' ? 'Cutting' : 'Beveling', c.done ? 'Yes' : 'No', c.date || '']);
      });
      persist(); return { changed: (b.changes || []).length };
    },
    releasePiece: function (b) {
      st.releases = st.releases.filter(function (r) { return r.id !== b.id; });
      st.releases.push({ id: b.id, planNo: b.planNo, reason: b.reason, remark: b.remark, at: todayIso(), by: 'demo.viewer@example.com', returned: b.returned, plannedRemain: b.plannedRemain, piece: b.piece });
      var pl = st.status[b.planNo]; if (pl) delete pl[b.id];
      persist(); return {};
    },
    undoRelease: function (b) { st.releases = st.releases.filter(function (r) { return r.id !== b.id; }); persist(); return {}; },
    getReleases: function () { return { headers: REL_HEAD, rows: st.releases.map(relRow) }; },
    getReport: function (f) {
      var weeks = (window.__demoSeed && window.__demoSeed.weeks) || {}, rows = [];
      var H = ['Project', 'Plan No', 'Week', 'Drawing No.', 'Spool No.', 'Item Code', 'Length', 'Group', 'Bevel', 'Pipe Barcode', 'Cutting Done', 'Cutting Date', 'Beveling Done', 'Beveling Date'];
      Object.keys(st.recs).forEach(function (planNo) {
        var rec = st.recs[planNo];
        if (f.project && rec.project !== f.project) return;
        rec.bars.forEach(function (bar) {
          bar.pieces.forEach(function (p, j) {
            var id = planNo + '|' + bar.barcode + '|' + (j + 1), s = (st.status[planNo] || {})[id] || {}, wk = weeks[rec.project + '|' + p.drawing + '|' + p.spool] || '';
            if (f.week && !(weekNo(f.week) != null && weekNo(wk) === weekNo(f.week))) return;
            var inRange = function (d) { return d && (!f.from || d >= f.from) && (!f.to || d <= f.to); };
            if ((f.from || f.to) && !(inRange(s.cutDate) || inRange(s.bevelDate))) return;
            rows.push([rec.project, planNo, wk, p.drawing, p.spool, bar.item, p.length, p.group, p.bevel, bar.barcode, s.cut ? 'Yes' : 'No', s.cutDate || '', s.bevel ? 'Yes' : 'No', s.bevelDate || '']);
          });
        });
      });
      var out = { headers: H, rows: rows };
      var rel = st.releases.filter(function (r) { return !f.project || (r.piece && r.piece.project === f.project); });
      if (rel.length) { out.released = rel.map(relRow); out.releasedHeaders = REL_HEAD; }
      if (f.history) { out.history = st.history.slice(); out.historyHeaders = ['Time', 'User', 'Plan No', 'Piece', 'Field', 'Done', 'Date']; }
      return out;
    },
    getBomManifest: function () { return { manifest: window.__demoSeed.manifest }; },
    getBomProject: function (b) { var x = window.__demoSeed.bom[b.project]; if (!x) throw new Error('No BOM for ' + b.project); return { bom: x }; },
    getItemStates: function (b) { return { rows: clone(st.items[b.project] || []) }; },
    saveItemStates: function (b) {
      (b.rows || []).forEach(function (r) {
        var list = (st.items[r.project] = st.items[r.project] || []), key = [r.project, r.drawing, r.spool, r.code, r.n].join('|');
        var row = list.filter(function (x) { return x[0] === key; })[0];
        if (!row) { row = [key, r.project, r.drawing, r.spool, r.code, 'No', '', '', 'No', '', '']; list.push(row); }
        row[5] = r.recv ? 'Yes' : 'No'; row[6] = r.recv ? r.recvDate : ''; row[7] = r.recv ? 'demo.viewer@example.com' : '';
        row[8] = r.hand ? 'Yes' : 'No'; row[9] = r.hand ? r.handDate : ''; row[10] = r.hand ? r.handTo : '';
      });
      persist(); return {};
    },
    getPipeStatus: function (b) {
      var pieces = [];
      Object.keys(st.recs).forEach(function (planNo) {
        var rec = st.recs[planNo]; if (rec.project !== b.project) return;
        rec.bars.forEach(function (bar) {
          bar.pieces.forEach(function (p, j) {
            var id = planNo + '|' + bar.barcode + '|' + (j + 1), s = (st.status[planNo] || {})[id], relsd = st.releases.some(function (r) { return r.id === id; });
            if (!relsd) pieces.push([p.drawing, p.spool, bar.item, p.length, !!(s && s.cut && s.bevel)]);
          });
        });
      });
      return { pieces: pieces };
    }
  };

  window.DemoDrive = {
    call: function (action, body) {
      return load().then(function () {
        return new Promise(function (resolve, reject) {
          setTimeout(function () {
            try { if (!actions[action]) throw new Error('Not available in the demo: ' + action); resolve(Object.assign({ ok: true }, actions[action](body || {}))); }
            catch (e) { reject(e); }
          }, 120);
        });
      });
    },
    reset: function () { try { localStorage.removeItem(KEY); localStorage.removeItem(SEEDED); localStorage.removeItem(RKEY); } catch (e) { /* ignore */ } location.reload(); }
  };

  document.addEventListener('DOMContentLoaded', function () {

    var tb = document.getElementById('tplBar');
    if (tb) {
      var sb = document.createElement('button'); sb.type = 'button'; sb.className = 'btn btn--ghost'; sb.textContent = 'Load sample data';
      sb.onclick = function () {
        seed().then(function (sd) {
          var set = function (id, v) { var el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
          set('cutPaste', sd.sample.cut); set('barPaste', sd.sample.bar); set('planNo', sd.sample.planNo);
        });
      };
      tb.parentNode.insertBefore(sb, tb.nextSibling);
    }
    var pill = document.querySelector('.demo-pill'); if (!pill) return;
    var b = document.createElement('a'); b.href = '#'; b.textContent = 'Reset demo data';
    b.onclick = function (e) { e.preventDefault(); if (confirm('Reset the Cutting Station demo to its starting data?')) window.DemoDrive.reset(); };
    pill.insertBefore(b, pill.lastElementChild);
  });
})();
