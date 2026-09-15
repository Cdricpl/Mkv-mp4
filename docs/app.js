/* Le Bac à Vinyles — application autonome.
   Aucune donnée n'est livrée avec l'application ni envoyée sur le réseau :
   la collection et les notations vivent dans le stockage local du navigateur,
   ce qui permet le fonctionnement hors ligne. */

const GENRES = {
  rock:{nom:'Rock',v:'var(--g-rock)'}, metal:{nom:'Métal',v:'var(--g-metal)'},
  chanson:{nom:'Chanson',v:'var(--g-chanson)'}, pop:{nom:'Pop',v:'var(--g-pop)'},
  folk:{nom:'Folk',v:'var(--g-folk)'}, noel:{nom:'Noël',v:'var(--g-noel)'},
  bo:{nom:'B.O.',v:'var(--g-bo)'}, autre:{nom:'Non classé',v:'var(--ink-faint)'}
};

const GRADES = {
  'M':  {nom:'M — Mint (neuf)',      mult:1.15},
  'NM': {nom:'NM — Near Mint',       mult:1.00},
  'VG+':{nom:'VG+ — Very Good Plus', mult:0.65},
  'VG': {nom:'VG — Very Good',       mult:0.40},
  'G':  {nom:'G — Good',             mult:0.22},
  'F':  {nom:'F — Fair',             mult:0.10},
  'P':  {nom:'P — Poor',             mult:0.05}
};

const CLE_COLL  = 'bac-a-vinyles:collection';
const CLE_ETATS = 'bac-a-vinyles:etats';
const el = id => document.getElementById(id);

let R = [];
let etats = {};

/* ---------- stockage local ---------- */
function lire(cle, defaut) {
  try { return JSON.parse(localStorage.getItem(cle)) ?? defaut; }
  catch (_) { return defaut; }
}
function ecrire(cle, valeur, msgOk) {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
    if (msgOk) etat('', msgOk);
    return true;
  } catch (_) {
    etat('off', 'Enregistrement impossible — vérifie que le navigateur autorise le stockage.');
    return false;
  }
}
function etat(cls, msg) {
  el('saveDot').className = 'dot ' + cls;
  el('saveMsg').textContent = msg;
}

/* ---------- import ---------- */
/** Découpe un CSV en respectant les champs entre guillemets. */
function decouperCSV(texte) {
  const lignes = [];
  let champ = '', ligne = [], entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (entreGuillemets) {
      if (c !== '"') { champ += c; }
      else if (texte[i + 1] === '"') { champ += '"'; i++; }
      else { entreGuillemets = false; }
    } else if (c === '"') { entreGuillemets = true; }
    else if (c === ',') { ligne.push(champ); champ = ''; }
    else if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
    else if (c !== '\r') { champ += c; }
  }
  if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  return lignes;
}

/** « Near Mint (NM or M-) » -> « NM ». */
function gradeDepuisDiscogs(texte) {
  const m = /\(([^)]+)\)/.exec(texte || '');
  if (!m) return null;
  const code = m[1].split(' ')[0].replace(/,$/, '');
  return GRADES[code] ? code : null;
}

const nbGalettes = f => { const m = /^(\d+)x/.exec(f || ''); return m ? +m[1] : 1; };

function depuisCSV(texte) {
  const lignes = decouperCSV(texte);
  if (lignes.length < 2) throw new Error('csv vide');
  const entetes = lignes[0].map(c => c.trim());
  const col = nom => entetes.indexOf(nom);
  const iId = col('release_id'), iArtiste = col('Artist'), iTitre = col('Title');
  if (iId < 0 || iArtiste < 0 || iTitre < 0) throw new Error('colonnes Discogs absentes');

  const vus = {}, disques = [], etatsCSV = {};
  for (const l of lignes.slice(1)) {
    if (!l[iId] || !l[iTitre]) continue;
    const id = l[iId].trim();
    vus[id] = (vus[id] || 0) + 1;
    const uid = vus[id] === 1 ? id : `${id}-${vus[id]}`;
    const format = (l[col('Format')] || 'LP').split(',')[0].trim();
    const annee = parseInt(l[col('Released')], 10);
    disques.push({
      uid, id, cat: (l[col('Catalog#')] || '—').trim(),
      artist: l[iArtiste].trim(), title: l[iTitre].trim(),
      label: (l[col('Label')] || '').split(',')[0].trim(),
      format, year: annee > 0 ? annee : null,
      discs: nbGalettes(format), genre: 'autre',
      lo: null, hi: null, dup: vus[id] > 1
    });
    // Discogs exporte aussi les états s'ils ont été renseignés.
    const m = gradeDepuisDiscogs(l[col('Collection Media Condition')]);
    const s = gradeDepuisDiscogs(l[col('Collection Sleeve Condition')]);
    if (m || s) etatsCSV[uid] = Object.assign({}, m && { m }, s && { s });
  }
  // Marque aussi la première occurrence d'une référence en double.
  disques.forEach(d => { if (vus[d.id] > 1) d.dup = true; });
  return { disques, etatsCSV };
}

function depuisJSON(texte) {
  const doc = JSON.parse(texte);
  const brut = Array.isArray(doc) ? doc : doc.disques;
  if (!Array.isArray(brut) || !brut.length) throw new Error('format');
  const disques = brut.map(d => ({
    uid: String(d.uid ?? d.id), id: d.id, cat: d.cat || '—',
    artist: d.artist || '?', title: d.title || '?', label: d.label || '',
    format: d.format || 'LP', year: d.year ?? null,
    discs: d.discs || nbGalettes(d.format), genre: GENRES[d.genre] ? d.genre : 'autre',
    lo: typeof d.lo === 'number' ? d.lo : null,
    hi: typeof d.hi === 'number' ? d.hi : null,
    dup: !!d.dup
  }));
  return { disques, etatsCSV: {} };
}

function importer(fichier) {
  const lecteur = new FileReader();
  lecteur.onload = () => {
    const texte = String(lecteur.result);
    const msg = el('importMsg');
    msg.hidden = false;
    try {
      const json = fichier.name.toLowerCase().endsWith('.json') || texte.trimStart()[0] === '{';
      const { disques, etatsCSV } = json ? depuisJSON(texte) : depuisCSV(texte);
      R = disques;
      ecrire(CLE_COLL, R);
      if (Object.keys(etatsCSV).length) {
        etats = Object.assign({}, etats, etatsCSV);
        ecrire(CLE_ETATS, etats);
      }
      const estimes = R.filter(d => d.lo != null).length;
      msg.textContent = `${R.length} disques importés` +
        (estimes ? `, dont ${estimes} avec estimation.` : ', sans estimation de valeur.');
      demarrer();
    } catch (err) {
      msg.textContent = 'Fichier non reconnu : attendu « ma-collection.json » ' +
                        'ou un export CSV de collection Discogs.';
    }
  };
  lecteur.readAsText(fichier);
}

el('importBtn').onclick = () => el('importFile').click();
el('importFile').onchange = ev => {
  if (ev.target.files[0]) importer(ev.target.files[0]);
  ev.target.value = '';
};

/* ---------- estimation ---------- */
/** Cote Near Mint pondérée par l'état saisi : disque 75 %, pochette 25 %. */
function valeur(r) {
  if (r.lo == null) return { lo: null, hi: null, brut: true, absent: true };
  const e = etats[r.uid];
  if (!e || !e.m) return { lo: r.lo, hi: r.hi, brut: true };
  const mm = GRADES[e.m].mult;
  const sm = e.s ? GRADES[e.s].mult : mm;   // pochette non notée : on suit le disque
  const k = 0.75 * mm + 0.25 * sm;
  return { lo: Math.round(r.lo * k), hi: Math.round(r.hi * k), brut: false };
}
const fmtEur = (lo, hi) => lo === hi ? `${lo} €` : `${lo} – ${hi} €`;
const texteVal = v => v.absent ? 'non estimé'
                    : v.brut   ? `${fmtEur(v.lo, v.hi)} en Near Mint`
                               : `≈ ${fmtEur(v.lo, v.hi)}`;
const decOf = r => r.year ? Math.floor(r.year / 10) * 10 : null;

/* ---------- filtres ---------- */
const state = { q:'', genre:null, decade:null, sort:'artist' };

function filtered() {
  const q = state.q.trim().toLowerCase();
  const out = R.filter(r => {
    if (state.genre && r.genre !== state.genre) return false;
    if (state.decade !== null) {
      const d = decOf(r);
      if (state.decade === 'x' ? d !== null : d !== state.decade) return false;
    }
    if (!q) return true;
    return (r.artist+' '+r.title+' '+r.label+' '+r.cat).toLowerCase().includes(q);
  });
  const mid = r => { const v = valeur(r); return v.absent ? -1 : (v.lo + v.hi) / 2; };
  const by = {
    artist:     (a,b) => a.artist.localeCompare(b.artist,'fr') || (a.year||0)-(b.year||0),
    value:      (a,b) => mid(b) - mid(a),
    year:       (a,b) => (a.year||9999)-(b.year||9999),
    'year-desc':(a,b) => (b.year||0)-(a.year||0),
    ungraded:   (a,b) => (!!(etats[a.uid]||{}).m) - (!!(etats[b.uid]||{}).m)
                         || a.artist.localeCompare(b.artist,'fr')
  };
  return out.sort(by[state.sort]);
}

/* ---------- rendu ---------- */
const echap = s => String(s).replace(/[&<>"]/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

function optionsFor(sel) {
  return ['<option value="">— non noté —</option>'].concat(
    Object.entries(GRADES).map(([k,g]) =>
      `<option value="${k}"${sel===k?' selected':''}>${g.nom}</option>`)
  ).join('');
}

function render() {
  const list = filtered();
  const discs = list.reduce((n,r) => n + r.discs, 0);
  el('count').textContent =
    `${list.length} référence${list.length>1?'s':''} · ${discs} galette${discs>1?'s':''}`;

  const crate = el('crate');
  crate.innerHTML = '';
  if (!list.length) { crate.innerHTML = '<li class="empty">Rien dans le bac avec ces critères.</li>'; return; }

  const frag = document.createDocumentFragment();
  for (const r of list) {
    const g = GENRES[r.genre] || GENRES.autre, e = etats[r.uid] || {}, v = valeur(r);
    const li = document.createElement('li');
    li.className = 'rec';
    li.style.setProperty('--gc', g.v);
    li.innerHTML = `
      <div class="disc" aria-hidden="true"><span>${r.year||''}</span></div>
      <div class="rec-body">
        <div class="rec-cat">${echap(r.cat)}</div>
        <div class="rec-artist">${echap(r.artist)}</div>
        <div class="rec-title">${echap(r.title)}</div>
        <div class="rec-label">${echap(r.label)} · ${r.year||'année inconnue'}</div>
        <div class="rec-tags">
          <span class="tag tag-g">${g.nom}</span>
          <span class="tag">${echap(r.format)}</span>
          ${r.dup?'<span class="tag tag-dup">Doublon</span>':''}
        </div>
      </div>
      <div class="grade">
        <div class="grade-row">
          <div class="gfield">
            <label for="m-${r.uid}">Disque</label>
            <select id="m-${r.uid}" data-uid="${r.uid}" data-f="m">${optionsFor(e.m)}</select>
          </div>
          <div class="gfield">
            <label for="s-${r.uid}">Pochette</label>
            <select id="s-${r.uid}" data-uid="${r.uid}" data-f="s">${optionsFor(e.s)}</select>
          </div>
        </div>
        <div class="grade-foot">
          <span class="val${v.brut?' raw':''}" id="v-${r.uid}">${texteVal(v)}</span>
          <a class="rec-link" href="https://www.discogs.com/release/${encodeURIComponent(r.id)}"
             target="_blank" rel="noopener">Discogs ↗</a>
        </div>
      </div>`;
    frag.appendChild(li);
  }
  crate.appendChild(frag);
  crate.querySelectorAll('select').forEach(s => s.onchange = onGrade);
  totals();
}

function onGrade(ev) {
  const { uid, f } = ev.target.dataset;
  const val = ev.target.value;
  const next = { ...(etats[uid] || {}) };
  if (val) next[f] = val; else delete next[f];
  if (!Object.keys(next).length) delete etats[uid]; else etats[uid] = next;

  const r = R.find(x => x.uid === uid), v = valeur(r), node = el('v-' + uid);
  if (node) { node.className = 'val' + (v.brut ? ' raw' : ''); node.textContent = texteVal(v); }
  totals();
  ecrire(CLE_ETATS, etats, 'Notations enregistrées sur cet appareil.');
}

function totals() {
  let lo = 0, hi = 0, notes = 0, galettes = 0;
  for (const r of R) {
    const v = valeur(r);
    if (!v.absent) { lo += v.lo; hi += v.hi; }
    if ((etats[r.uid] || {}).m) notes++;
    galettes += r.discs;
  }
  el('figRefs').textContent = R.length;
  el('figDiscs').textContent = galettes;
  el('figTotal').textContent = lo || hi ? `${lo} – ${hi} €` : '—';
  el('figGraded').textContent = `${notes} / ${R.length}`;

  const doublons = R.filter(r => r.dup);
  const note = el('noteDoublons');
  if (doublons.length) {
    const noms = [...new Set(doublons.map(d => `${d.artist} — ${d.title}`))];
    note.hidden = false;
    note.innerHTML = '⚠️ Référence présente en double dans l’export : <b>' +
      noms.map(echap).join('</b>, <b>') + '</b>. Un doublon à supprimer côté Discogs, ' +
      'ou un deuxième exemplaire à confirmer.';
  } else { note.hidden = true; }
  stats();
}

/* ---------- pastilles de filtre ---------- */
function buildChips() {
  const gc = el('genreChips'), dc = el('decadeChips');
  gc.innerHTML = ''; dc.innerHTML = '';
  const mk = (txt, on, fn) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.textContent = txt;
    b.setAttribute('aria-pressed', String(on)); b.onclick = fn;
    return b;
  };
  const gCount = {}; R.forEach(r => gCount[r.genre] = (gCount[r.genre]||0)+1);
  gc.appendChild(mk('Tous', state.genre===null, () => { state.genre=null; buildChips(); render(); }));
  Object.entries(GENRES).sort((a,b)=>(gCount[b[0]]||0)-(gCount[a[0]]||0)).forEach(([k,g]) => {
    if (!gCount[k]) return;
    gc.appendChild(mk(`${g.nom} ${gCount[k]}`, state.genre===k,
      () => { state.genre = state.genre===k ? null : k; buildChips(); render(); }));
  });
  const dCount = {}; R.forEach(r => { const d = decOf(r); dCount[d] = (dCount[d]||0)+1; });
  dc.appendChild(mk('Toutes décennies', state.decade===null, () => { state.decade=null; buildChips(); render(); }));
  Object.keys(dCount).filter(d=>d!=='null').map(Number).sort((a,b)=>a-b).forEach(d => {
    dc.appendChild(mk(`${d}s ${dCount[d]}`, state.decade===d,
      () => { state.decade = state.decade===d ? null : d; buildChips(); render(); }));
  });
  if (dCount['null']) dc.appendChild(mk(`Sans date ${dCount['null']}`, state.decade==='x',
    () => { state.decade = state.decade==='x' ? null : 'x'; buildChips(); render(); }));
}

/* ---------- statistiques ---------- */
function stats() {
  const decs = {};
  R.forEach(r => { const d = decOf(r); const k = d===null ? 'Sans date' : d+'s'; decs[k] = (decs[k]||0)+1; });
  const order = Object.keys(decs).filter(k => k !== 'Sans date').sort();
  if (decs['Sans date']) order.push('Sans date');
  const max = Math.max(1, ...order.map(k => decs[k]));
  el('decBars').innerHTML = order.map(k => `
    <div class="bar-row">
      <span class="bar-lab">${k}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${decs[k]/max*100}%"></div></div>
      <span class="bar-val">${decs[k]}</span>
    </div>`).join('');

  const cotes = R.map(r => ({ r, v: valeur(r) })).filter(x => !x.v.absent);
  el('topTally').innerHTML = cotes.length
    ? cotes.sort((a,b) => (b.v.lo+b.v.hi) - (a.v.lo+a.v.hi)).slice(0,10)
        .map(({r,v}) => `<li><span>${echap(r.artist)} — <i>${echap(r.title)}</i></span><b>${fmtEur(v.lo,v.hi)}</b></li>`)
        .join('')
    : '<li><span>Aucune estimation dans cette collection.</span></li>';

  const parGenre = {};
  cotes.forEach(({r,v}) => {
    const g = (GENRES[r.genre] || GENRES.autre).nom;
    parGenre[g] = parGenre[g] || [0,0];
    parGenre[g][0] += v.lo; parGenre[g][1] += v.hi;
  });
  el('genreTally').innerHTML = Object.entries(parGenre)
    .sort((a,b) => (b[1][0]+b[1][1]) - (a[1][0]+a[1][1]))
    .map(([g,[lo,hi]]) => `<li><span>${g}</span><b>${fmtEur(lo,hi)}</b></li>`).join('')
    || '<li><span>Aucune estimation dans cette collection.</span></li>';
}

el('scale').innerHTML = Object.entries(GRADES).map(([k,g]) =>
  `<li><b>${k}</b><span>${g.nom.split('—')[1].trim()}</span><span>×${g.mult.toFixed(2)}</span></li>`).join('');

/* ---------- sauvegarde / restauration ---------- */
function telecharger(nomFichier, contenu, type) {
  const url = URL.createObjectURL(new Blob([contenu], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = nomFichier;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

el('sauvBtn').onclick = () => {
  const jour = new Date().toISOString().slice(0, 10);
  telecharger(`bac-a-vinyles-${jour}.json`,
    JSON.stringify({ format:'bac-a-vinyles/collection', version:1, genere:jour,
                     disques:R, etats }, null, 1),
    'application/json');
};

el('restBtn').onclick = () => el('restFile').click();
el('restFile').onchange = ev => {
  const fichier = ev.target.files[0];
  if (!fichier) return;
  const lecteur = new FileReader();
  lecteur.onload = () => {
    try {
      const doc = JSON.parse(lecteur.result);
      const recu = doc && doc.etats ? doc.etats : doc;
      if (!recu || typeof recu !== 'object' || Array.isArray(recu)) throw new Error('format');
      const connus = new Set(R.map(r => r.uid));
      const propre = {};
      let repris = 0;
      for (const [uid, e] of Object.entries(recu)) {
        if (!connus.has(uid) || !e || typeof e !== 'object') continue;
        const n = {};
        if (GRADES[e.m]) n.m = e.m;
        if (GRADES[e.s]) n.s = e.s;
        if (Object.keys(n).length) { propre[uid] = n; repris++; }
      }
      if (Array.isArray(doc.disques) && doc.disques.length) {
        R = depuisJSON(JSON.stringify(doc)).disques;
        ecrire(CLE_COLL, R);
      }
      etats = propre;
      ecrire(CLE_ETATS, etats);
      buildChips(); render();
      etat('', `Sauvegarde restaurée : ${repris} disque${repris>1?'s':''} noté${repris>1?'s':''}.`);
    } catch (_) {
      etat('off', 'Fichier illisible — attendu : une sauvegarde créée par cette application.');
    }
    ev.target.value = '';
  };
  lecteur.readAsText(fichier);
};

el('csvBtn').onclick = () => {
  const lignes = [['Reference','Artiste','Titre','Label','Format','Annee',
                   'Etat disque','Etat pochette','Estimation min EUR','Estimation max EUR','Discogs']];
  for (const r of R) {
    const e = etats[r.uid] || {}, v = valeur(r);
    lignes.push([r.cat, r.artist, r.title, r.label, r.format, r.year || '',
                 e.m || '', e.s || '', v.lo ?? '', v.hi ?? '',
                 'https://www.discogs.com/release/' + r.id]);
  }
  const csv = lignes.map(l => l.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\r\n');
  telecharger('collection-vinyles.csv', '﻿' + csv, 'text/csv;charset=utf-8');
};

el('oublierBtn').onclick = () => {
  if (!confirm('Effacer la collection et toutes les notations de cet appareil ?\n\n' +
               'Pense à faire une sauvegarde avant : cette action est définitive.')) return;
  try { localStorage.removeItem(CLE_COLL); localStorage.removeItem(CLE_ETATS); } catch (_) {}
  R = []; etats = {};
  demarrer();
};

/* ---------- tirage au sort ---------- */
el('pickBtn').onclick = () => {
  const list = filtered(), box = el('pick');
  if (!list.length) { box.innerHTML = '<em>Le bac est vide avec ces filtres.</em>'; return; }
  const r = list[Math.floor(Math.random()*list.length)];
  box.innerHTML = `<span class="pa">${echap(r.artist)}</span> — <span class="pt">${echap(r.title)}</span>
    <span class="mono" style="color:var(--ink-faint);font-size:13px"> (${echap(r.label)}${r.year?', '+r.year:''})</span>`;
};
el('q').oninput = e => { state.q = e.target.value; render(); };
el('sort').onchange = e => { state.sort = e.target.value; render(); };

/* ---------- installation ---------- */
let invite = null;
window.addEventListener('beforeinstallprompt', ev => {
  ev.preventDefault();
  invite = ev;
  el('bandeauInstall').hidden = false;
});
el('installBtn').onclick = async () => {
  if (!invite) return;
  invite.prompt();
  await invite.userChoice;
  invite = null;
  el('bandeauInstall').hidden = true;
};
window.addEventListener('appinstalled', () => { el('bandeauInstall').hidden = true; });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

/* ---------- démarrage ---------- */
function demarrer() {
  R = lire(CLE_COLL, []);
  etats = lire(CLE_ETATS, {});
  const pleine = Array.isArray(R) && R.length > 0;
  el('accueilImport').hidden = pleine;
  el('appli').hidden = !pleine;
  if (!pleine) { R = []; return; }
  etat('', 'Notations enregistrées sur cet appareil.');
  buildChips();
  render();
}

demarrer();
