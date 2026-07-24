/* Mercatino Nautico Trieste — SPA vanilla JS + Supabase */
(function () {
  "use strict";

  var CFG = window.MERCATINO_CONFIG || {};
  var DEMO = !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY;
  var sb = DEMO ? null : window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

  var CATEGORIE = {
    windsurf: "Windsurf",
    wing: "Wing / Wingfoil",
    foil: "Foil",
    sup: "SUP",
    vele: "Vele e wing",
    accessori: "Accessori",
    altro: "Altro"
  };
  var CAT_ICON = {
    windsurf: "🏄", wing: "🪁", foil: "🛸", sup: "🚣", vele: "⛵", accessori: "🧰", altro: "📦"
  };

  var $app = document.getElementById("app");
  var $banner = document.getElementById("banner");
  var session = null;

  // filtri correnti della lista (persistono navigando)
  var filtro = { cat: "", q: "", venduti: false };

  /* ---------------- utilità ---------------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtPrezzo(p) {
    if (p == null || p === "") return "—";
    var n = Number(p);
    if (isNaN(n)) return esc(p);
    return n.toLocaleString("it-IT", { maximumFractionDigits: 0 }) + " €";
  }

  function fmtData(iso) {
    var d = new Date(iso);
    var diff = (Date.now() - d.getTime()) / 86400000;
    if (diff < 1) return "oggi";
    if (diff < 2) return "ieri";
    if (diff < 30) return Math.floor(diff) + " gg fa";
    return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
  }

  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.remove("hidden");
    clearTimeout(t._h);
    t._h = setTimeout(function () { t.classList.add("hidden"); }, 2600);
  }

  function itemUrl(id) {
    return location.origin + location.pathname + "#/annuncio/" + id;
  }

  function primaFoto(item) {
    return item.foto && item.foto.length ? item.foto[0].url : null;
  }

  /* ---------------- dati ---------------- */

  function demoStore() {
    // in demo gli annunci creati vivono solo in sessionStorage
    try { return JSON.parse(sessionStorage.getItem("demo-items") || "[]"); }
    catch (e) { return []; }
  }

  async function fetchItems() {
    if (DEMO) return demoStore().concat(window.MERCATINO_DEMO || []);
    var r = await sb.from("annunci").select("*").order("created_at", { ascending: false });
    if (r.error) { toast("Errore caricamento: " + r.error.message); return []; }
    return r.data || [];
  }

  async function fetchItem(id) {
    if (DEMO) {
      var all = demoStore().concat(window.MERCATINO_DEMO || []);
      return all.find(function (i) { return i.id === id; }) || null;
    }
    var r = await sb.from("annunci").select("*").eq("id", id).maybeSingle();
    if (r.error) { toast("Errore: " + r.error.message); return null; }
    return r.data;
  }

  /* ---------------- foto: compressione + upload ---------------- */

  function comprimiFoto(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var url = URL.createObjectURL(file);
      img.onload = function () {
        URL.revokeObjectURL(url);
        var MAX = 1280;
        var w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          var k = Math.min(MAX / w, MAX / h);
          w = Math.round(w * k); h = Math.round(h * k);
        }
        var cv = document.createElement("canvas");
        cv.width = w; cv.height = h;
        cv.getContext("2d").drawImage(img, 0, 0, w, h);
        cv.toBlob(function (blob) {
          blob ? resolve(blob) : reject(new Error("compressione fallita"));
        }, "image/jpeg", 0.82);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("file non valido")); };
      img.src = url;
    });
  }

  async function uploadFoto(blob, uid) {
    var path = uid + "/" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".jpg";
    var r = await sb.storage.from("foto").upload(path, blob, { contentType: "image/jpeg" });
    if (r.error) throw r.error;
    var pub = sb.storage.from("foto").getPublicUrl(path);
    return { url: pub.data.publicUrl, path: path };
  }

  /* ---------------- viste ---------------- */

  async function viewLista() {
    $app.innerHTML = '<div class="loading">Carico gli annunci…</div>';
    var items = await fetchItems();

    var visibili = items.filter(function (i) {
      if (!filtro.venduti && i.stato === "venduto") return false;
      if (filtro.cat && i.categoria !== filtro.cat) return false;
      if (filtro.q) {
        var q = filtro.q.toLowerCase();
        var testo = (i.titolo + " " + (i.descrizione || "")).toLowerCase();
        if (testo.indexOf(q) < 0) return false;
      }
      return true;
    });

    var chips = ['<button class="chip' + (filtro.cat === "" ? " active" : "") + '" data-cat="">Tutti</button>'];
    Object.keys(CATEGORIE).forEach(function (k) {
      chips.push('<button class="chip' + (filtro.cat === k ? " active" : "") + '" data-cat="' + k + '">' +
        CAT_ICON[k] + " " + CATEGORIE[k] + "</button>");
    });

    var cards = visibili.map(function (i) {
      var img = primaFoto(i);
      var thumb = img
        ? '<div class="thumb" style="background-image:url(\'' + esc(img) + '\')"></div>'
        : '<div class="thumb">' + (CAT_ICON[i.categoria] || "📦") + "</div>";
      return '<a class="card' + (i.stato === "venduto" ? " venduto" : "") + '" href="#/annuncio/' + esc(i.id) + '">' +
        (i.stato === "venduto" ? '<span class="badge badge-venduto">VENDUTO</span>' : "") +
        thumb +
        '<div class="card-body">' +
        '<div class="card-title">' + esc(i.titolo) + "</div>" +
        '<div class="card-price">' + fmtPrezzo(i.prezzo) + "</div>" +
        '<div class="card-meta"><span>' + esc(i.venditore || "") + "</span><span>" + fmtData(i.created_at) + "</span></div>" +
        "</div></a>";
    }).join("");

    $app.innerHTML =
      '<div class="filters">' +
      '<input type="search" id="f-q" placeholder="Cerca (es. gong, 105 litri…)" value="' + esc(filtro.q) + '">' +
      '<label class="toggle-venduti"><input type="checkbox" id="f-venduti"' + (filtro.venduti ? " checked" : "") + "> anche venduti</label>" +
      '<div class="chip-row">' + chips.join("") + "</div>" +
      "</div>" +
      (visibili.length
        ? '<div class="grid">' + cards + "</div>"
        : '<div class="empty"><div class="big">🌊</div>Nessun annuncio' + (filtro.q || filtro.cat ? " con questi filtri" : "") + ".<br>Metti in vendita qualcosa!</div>");

    document.querySelectorAll(".chip").forEach(function (c) {
      c.onclick = function () { filtro.cat = c.getAttribute("data-cat"); viewLista(); };
    });
    document.getElementById("f-venduti").onchange = function (e) { filtro.venduti = e.target.checked; viewLista(); };
    var qInput = document.getElementById("f-q");
    qInput.oninput = function () {
      clearTimeout(qInput._h);
      qInput._h = setTimeout(function () { filtro.q = qInput.value.trim(); viewLista(); }, 350);
    };
  }

  async function viewDettaglio(id) {
    $app.innerHTML = '<div class="loading">Carico…</div>';
    var i = await fetchItem(id);
    if (!i) {
      $app.innerHTML = '<div class="empty"><div class="big">🤷</div>Annuncio non trovato (forse è stato eliminato).<br><br><a class="btn btn-blu" href="#/">Vai al mercatino</a></div>';
      return;
    }

    var fotoArr = i.foto || [];
    var main = fotoArr.length
      ? '<div class="gallery-main" id="g-main" style="background-image:url(\'' + esc(fotoArr[0].url) + '\')"></div>'
      : '<div class="gallery-main">' + (CAT_ICON[i.categoria] || "📦") + "</div>";
    var thumbs = fotoArr.length > 1
      ? '<div class="gallery-thumbs">' + fotoArr.map(function (f, n) {
          return '<img src="' + esc(f.url) + '" class="' + (n === 0 ? "active" : "") + '" data-url="' + esc(f.url) + '" alt="foto ' + (n + 1) + '">';
        }).join("") + "</div>"
      : "";

    var shareText = "🌊 " + i.titolo + " — " + fmtPrezzo(i.prezzo) + "\n" + itemUrl(i.id);
    var mio = session && session.user.id === i.user_id;

    var contatto = "";
    if (i.stato !== "venduto") {
      var tel = (i.telefono || "").replace(/\s/g, "");
      contatto = '<div class="contact-box"><b>Contatta ' + esc(i.venditore || "il venditore") + "</b>" +
        (tel
          ? '<div class="share-row">' +
            '<a class="btn btn-wa btn-sm" href="https://wa.me/' + esc(tel.replace(/^\+/, "").replace(/^00/, "")) +
            "?text=" + encodeURIComponent("Ciao! Ti scrivo per l'annuncio: " + i.titolo) + '" target="_blank" rel="noopener">💬 WhatsApp</a>' +
            '<a class="btn btn-ghost btn-sm" href="tel:' + esc(tel) + '">📞 ' + esc(i.telefono) + "</a></div>"
          : "<span>Rispondi al suo messaggio nel gruppo WhatsApp del mercatino.</span>") +
        "</div>";
    }

    $app.innerHTML =
      '<div class="detail">' + main + thumbs +
      '<div class="detail-body">' +
      '<div class="detail-head"><div>' +
      (i.stato === "venduto" ? '<span class="pill-venduto">VENDUTO</span> ' : "") +
      '<div class="detail-title">' + esc(i.titolo) + "</div>" +
      '<div class="detail-meta">' + (CAT_ICON[i.categoria] || "") + " " + esc(CATEGORIE[i.categoria] || i.categoria) +
      " · pubblicato " + fmtData(i.created_at) + (i.venditore ? " da <b>" + esc(i.venditore) + "</b>" : "") + "</div>" +
      "</div>" +
      '<div class="detail-price">' + fmtPrezzo(i.prezzo) + "</div></div>" +
      (i.descrizione ? '<div class="detail-desc">' + esc(i.descrizione) + "</div>" : "") +
      contatto +
      '<div class="share-row">' +
      '<button class="btn btn-blu btn-sm" id="btn-copy">🔗 Copia link</button>' +
      '<a class="btn btn-wa btn-sm" href="https://wa.me/?text=' + encodeURIComponent(shareText) + '" target="_blank" rel="noopener">📤 Condividi su WhatsApp</a>' +
      (mio ? '<a class="btn btn-ghost btn-sm" href="#/modifica/' + esc(i.id) + '">✏️ Modifica</a>' : "") +
      "</div>" +
      '<div><a href="#/">‹ Tutti gli annunci</a></div>' +
      "</div></div>";

    document.getElementById("btn-copy").onclick = function () {
      navigator.clipboard.writeText(shareText).then(function () {
        toast("Testo e link copiati! Incollalo nel gruppo 👍");
      }, function () { toast("Copia non riuscita"); });
    };
    document.querySelectorAll(".gallery-thumbs img").forEach(function (t) {
      t.onclick = function () {
        document.getElementById("g-main").style.backgroundImage = "url('" + t.getAttribute("data-url") + "')";
        document.querySelectorAll(".gallery-thumbs img").forEach(function (x) { x.classList.remove("active"); });
        t.classList.add("active");
      };
    });
    var gm = document.getElementById("g-main");
    if (gm && fotoArr.length) gm.onclick = function () {
      var url = gm.style.backgroundImage.slice(5, -2);
      window.open(url, "_blank");
    };
  }

  function requireLogin(msg) {
    if (DEMO) {
      $app.innerHTML = '<div class="panel"><h2>Modalità demo</h2><p style="font-size:.92rem;line-height:1.5">' +
        "Il sito non è ancora collegato a Supabase, quindi login e pubblicazione non sono attivi. " +
        "Vedi il <a href='https://github.com/CryptoPannoz/mercatino-nautico#setup' target='_blank' rel='noopener'>README</a> per attivarli.</p></div>";
      return false;
    }
    if (!session) {
      toast(msg || "Prima accedi");
      location.hash = "#/login";
      return false;
    }
    return true;
  }

  async function viewForm(id) {
    if (!requireLogin("Accedi per pubblicare un annuncio")) return;

    var item = null;
    if (id) {
      item = await fetchItem(id);
      if (!item || item.user_id !== session.user.id) {
        $app.innerHTML = '<div class="empty">Non puoi modificare questo annuncio.</div>';
        return;
      }
    }

    var nomeSalvato = localStorage.getItem("mercatino-nome") || "";
    var telSalvato = localStorage.getItem("mercatino-tel") || "";

    var catOpts = Object.keys(CATEGORIE).map(function (k) {
      var sel = (item ? item.categoria === k : k === "windsurf") ? " selected" : "";
      return '<option value="' + k + '"' + sel + ">" + CAT_ICON[k] + " " + CATEGORIE[k] + "</option>";
    }).join("");

    $app.innerHTML =
      '<div class="panel"><h2>' + (item ? "✏️ Modifica annuncio" : "📦 Nuovo annuncio") + "</h2>" +
      '<form id="form-item">' +
      '<div class="field"><label>Titolo *</label><input id="f-titolo" required maxlength="90" placeholder="Es. Tavola wing 105L Duotone" value="' + esc(item ? item.titolo : "") + '"></div>' +
      '<div class="form-row">' +
      '<div class="field"><label>Prezzo (€) *</label><input id="f-prezzo" type="number" min="0" step="1" required inputmode="numeric" value="' + esc(item && item.prezzo != null ? item.prezzo : "") + '"></div>' +
      '<div class="field"><label>Categoria</label><select id="f-cat">' + catOpts + "</select></div>" +
      "</div>" +
      '<div class="field"><label>Descrizione</label><textarea id="f-desc" maxlength="1200" placeholder="Condizioni, misure, anno, dove si può vedere…">' + esc(item ? item.descrizione || "" : "") + "</textarea></div>" +
      '<div class="form-row">' +
      '<div class="field"><label>Il tuo nome *</label><input id="f-nome" required maxlength="40" value="' + esc(item ? item.venditore || "" : nomeSalvato) + '"></div>' +
      '<div class="field"><label>Telefono (facoltativo)</label><input id="f-tel" maxlength="20" placeholder="+39 …" value="' + esc(item ? item.telefono || "" : telSalvato) + '"><div class="hint">Se lo metti, sarà visibile a chiunque apra il link.</div></div>' +
      "</div>" +
      '<div class="field"><label>Foto (fino a 6)</label>' +
      '<div class="photo-picker" id="picker">📷 Tocca per aggiungere foto<br><span class="hint">vengono compresse automaticamente</span></div>' +
      '<input type="file" id="f-foto" accept="image/*" multiple style="display:none">' +
      '<div class="photo-previews" id="previews"></div></div>' +
      '<div class="share-row">' +
      '<button class="btn btn-primary" type="submit" id="btn-save">' + (item ? "Salva modifiche" : "Pubblica annuncio") + "</button>" +
      '<a class="btn btn-ghost" href="' + (item ? "#/annuncio/" + esc(item.id) : "#/") + '">Annulla</a>' +
      "</div></form></div>";

    // stato foto: esistenti {url,path} + nuove (File)
    var fotoEsistenti = item && item.foto ? item.foto.slice() : [];
    var fotoNuove = [];

    var $prev = document.getElementById("previews");
    function renderPreviews() {
      $prev.innerHTML = "";
      fotoEsistenti.forEach(function (f, n) {
        var d = document.createElement("div");
        d.className = "ph";
        d.innerHTML = '<img src="' + esc(f.url) + '"><button type="button" class="rm">✕</button>';
        d.querySelector(".rm").onclick = function () { fotoEsistenti.splice(n, 1); renderPreviews(); };
        $prev.appendChild(d);
      });
      fotoNuove.forEach(function (f, n) {
        var d = document.createElement("div");
        d.className = "ph";
        var img = document.createElement("img");
        img.src = URL.createObjectURL(f);
        var b = document.createElement("button");
        b.type = "button"; b.className = "rm"; b.textContent = "✕";
        b.onclick = function () { fotoNuove.splice(n, 1); renderPreviews(); };
        d.appendChild(img); d.appendChild(b);
        $prev.appendChild(d);
      });
    }
    renderPreviews();

    var $file = document.getElementById("f-foto");
    document.getElementById("picker").onclick = function () { $file.click(); };
    $file.onchange = function () {
      var spazio = 6 - fotoEsistenti.length - fotoNuove.length;
      Array.prototype.slice.call($file.files, 0, Math.max(0, spazio)).forEach(function (f) { fotoNuove.push(f); });
      if ($file.files.length > spazio) toast("Massimo 6 foto per annuncio");
      $file.value = "";
      renderPreviews();
    };

    document.getElementById("form-item").onsubmit = async function (e) {
      e.preventDefault();
      var btn = document.getElementById("btn-save");
      btn.disabled = true;
      btn.textContent = "Carico…";
      try {
        var nome = document.getElementById("f-nome").value.trim();
        var tel = document.getElementById("f-tel").value.trim();
        localStorage.setItem("mercatino-nome", nome);
        localStorage.setItem("mercatino-tel", tel);

        var fotoFinali = fotoEsistenti.slice();
        for (var n = 0; n < fotoNuove.length; n++) {
          btn.textContent = "Foto " + (n + 1) + "/" + fotoNuove.length + "…";
          var blob = await comprimiFoto(fotoNuove[n]);
          fotoFinali.push(await uploadFoto(blob, session.user.id));
        }

        var record = {
          titolo: document.getElementById("f-titolo").value.trim(),
          prezzo: Number(document.getElementById("f-prezzo").value),
          categoria: document.getElementById("f-cat").value,
          descrizione: document.getElementById("f-desc").value.trim(),
          venditore: nome,
          telefono: tel,
          foto: fotoFinali
        };

        var r;
        if (item) {
          r = await sb.from("annunci").update(record).eq("id", item.id).select().single();
        } else {
          record.user_id = session.user.id;
          r = await sb.from("annunci").insert(record).select().single();
        }
        if (r.error) throw r.error;
        toast(item ? "Annuncio aggiornato ✔" : "Annuncio pubblicato! 🎉");
        location.hash = "#/annuncio/" + r.data.id;
      } catch (err) {
        toast("Errore: " + (err.message || err));
        btn.disabled = false;
        btn.textContent = item ? "Salva modifiche" : "Pubblica annuncio";
      }
    };
  }

  async function viewMiei() {
    if (!requireLogin("Accedi per vedere i tuoi annunci")) return;
    $app.innerHTML = '<div class="loading">Carico…</div>';
    var r = await sb.from("annunci").select("*").eq("user_id", session.user.id).order("created_at", { ascending: false });
    if (r.error) { $app.innerHTML = '<div class="empty">Errore: ' + esc(r.error.message) + "</div>"; return; }
    var items = r.data || [];
    if (!items.length) {
      $app.innerHTML = '<div class="empty"><div class="big">📦</div>Non hai ancora annunci.<br><br><a class="btn btn-primary" href="#/nuovo">Pubblica il primo</a></div>';
      return;
    }
    $app.innerHTML = "<h2 style='margin-bottom:12px;font-size:1.1rem'>I miei annunci</h2><div class='mine-list'>" +
      items.map(function (i) {
        var img = primaFoto(i);
        return '<div class="mine-row" data-id="' + esc(i.id) + '">' +
          '<a class="thumb" href="#/annuncio/' + esc(i.id) + '"' + (img ? ' style="background-image:url(\'' + esc(img) + '\')"' : "") + ">" + (img ? "" : (CAT_ICON[i.categoria] || "📦")) + "</a>" +
          '<div class="mine-info"><div class="t">' + esc(i.titolo) + '</div><div class="p">' + fmtPrezzo(i.prezzo) + '</div><div class="s">' + (i.stato === "venduto" ? "🔴 venduto" : "🟢 in vendita") + " · " + fmtData(i.created_at) + "</div></div>" +
          '<div class="mine-actions">' +
          '<button class="btn btn-ghost btn-sm act-prezzo">€ Prezzo</button>' +
          '<button class="btn ' + (i.stato === "venduto" ? "btn-verde" : "btn-blu") + ' btn-sm act-stato">' + (i.stato === "venduto" ? "Rimetti in vendita" : "Segna venduto") + "</button>" +
          '<a class="btn btn-ghost btn-sm" href="#/modifica/' + esc(i.id) + '">✏️</a>' +
          '<button class="btn btn-danger btn-sm act-del">🗑</button>' +
          "</div></div>";
      }).join("") + "</div>";

    document.querySelectorAll(".mine-row").forEach(function (row) {
      var id = row.getAttribute("data-id");
      var item = items.find(function (i) { return i.id === id; });

      row.querySelector(".act-prezzo").onclick = async function () {
        var nuovo = prompt("Nuovo prezzo (€) per: " + item.titolo, item.prezzo);
        if (nuovo == null) return;
        var n = Number(nuovo);
        if (isNaN(n) || n < 0) { toast("Prezzo non valido"); return; }
        var u = await sb.from("annunci").update({ prezzo: n }).eq("id", id);
        if (u.error) toast("Errore: " + u.error.message);
        else { toast("Prezzo aggiornato ✔"); viewMiei(); }
      };

      row.querySelector(".act-stato").onclick = async function () {
        var nuovo = item.stato === "venduto" ? "disponibile" : "venduto";
        var u = await sb.from("annunci").update({ stato: nuovo }).eq("id", id);
        if (u.error) toast("Errore: " + u.error.message);
        else { toast(nuovo === "venduto" ? "Segnato come venduto 🎉" : "Rimesso in vendita"); viewMiei(); }
      };

      row.querySelector(".act-del").onclick = async function () {
        if (!confirm("Eliminare definitivamente \"" + item.titolo + "\"?\nSe è stato venduto, meglio segnarlo venduto: resta nello storico.")) return;
        if (item.foto && item.foto.length) {
          var paths = item.foto.map(function (f) { return f.path; }).filter(Boolean);
          if (paths.length) await sb.storage.from("foto").remove(paths);
        }
        var u = await sb.from("annunci").delete().eq("id", id);
        if (u.error) toast("Errore: " + u.error.message);
        else { toast("Annuncio eliminato"); viewMiei(); }
      };
    });
  }

  function viewLogin() {
    if (DEMO) { requireLogin(); return; }
    if (session) { location.hash = "#/miei"; return; }
    $app.innerHTML =
      '<div class="panel login-box"><h2>🔑 Accedi</h2>' +
      '<p style="font-size:.9rem;color:var(--grigio);margin-bottom:14px">Niente password: ti mandiamo un <b>link di accesso</b> via email. Aprilo e sei dentro.</p>' +
      '<form id="form-login">' +
      '<div class="field"><label>La tua email</label><input id="f-email" type="email" required placeholder="nome@esempio.it"></div>' +
      '<button class="btn btn-primary" type="submit" id="btn-login" style="width:100%">Mandami il link</button>' +
      "</form></div>";
    document.getElementById("form-login").onsubmit = async function (e) {
      e.preventDefault();
      var btn = document.getElementById("btn-login");
      btn.disabled = true; btn.textContent = "Invio…";
      var email = document.getElementById("f-email").value.trim();
      var r = await sb.auth.signInWithOtp({
        email: email,
        options: { emailRedirectTo: location.origin + location.pathname }
      });
      if (r.error) {
        toast("Errore: " + r.error.message);
        btn.disabled = false; btn.textContent = "Mandami il link";
      } else {
        $app.innerHTML = '<div class="panel login-box login-ok"><div class="big">📬</div><h2>Controlla la posta</h2>' +
          '<p style="font-size:.9rem;color:var(--grigio)">Abbiamo mandato un link di accesso a <b>' + esc(email) + "</b>.<br>Aprilo da questo dispositivo (guarda anche nello spam).</p></div>";
      }
    };
  }

  /* ---------------- routing e auth ---------------- */

  function aggiornaNav() {
    document.getElementById("nav-login").classList.toggle("hidden", !!session || DEMO);
    document.getElementById("nav-logout").classList.toggle("hidden", !session);
    document.getElementById("nav-miei").classList.toggle("hidden", !session);
  }

  function route() {
    var h = location.hash.replace(/^#\/?/, "");
    window.scrollTo(0, 0);
    var m;
    if ((m = h.match(/^annuncio\/(.+)$/))) return viewDettaglio(m[1]);
    if ((m = h.match(/^modifica\/(.+)$/))) return viewForm(m[1]);
    if (h === "nuovo") return viewForm(null);
    if (h === "miei") return viewMiei();
    if (h === "login") return viewLogin();
    return viewLista();
  }

  async function init() {
    if (DEMO) {
      $banner.innerHTML = '<div class="banner-inner">🧪 <b>Modalità demo</b> — dati di esempio. Login e pubblicazione si attivano collegando Supabase (vedi README).</div>';
    } else {
      var s = await sb.auth.getSession();
      session = s.data.session;
      sb.auth.onAuthStateChange(function (_ev, sess) {
        var prima = !!session;
        session = sess;
        aggiornaNav();
        if (!prima && sess) { toast("Accesso effettuato ✔"); if (location.hash === "#/login") location.hash = "#/"; }
      });
    }
    aggiornaNav();
    document.getElementById("nav-logout").onclick = async function () {
      await sb.auth.signOut();
      session = null;
      aggiornaNav();
      toast("Sei uscito");
      location.hash = "#/";
    };
    window.addEventListener("hashchange", route);
    route();
  }

  init();
})();
