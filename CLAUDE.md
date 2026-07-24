# mercatino-nautico — istruzioni per Claude

Mercatino online dell'usato nautico (windsurf/wing/SUP) per il gruppo WhatsApp di Trieste di Alberto (~190 membri).

- **Repo**: CryptoPannoz/mercatino-nautico (pubblico)
- **Deploy**: GitHub Pages da `main` → https://cryptopannoz.github.io/mercatino-nautico/
- **Stack**: HTML/CSS/JS vanilla senza build; backend Supabase (auth magic link + Postgres + storage). Schema e policy RLS in `setup.sql`.
- **Config**: `config.js` contiene URL e anon key Supabase (pubblici per design, ok nel repo). 🔒 Mai committare la service_role key o la database password.
- La chat è in italiano; anche UI e codice usano nomi italiani (annunci, foto, venditore…).
- Modalità demo: con `config.js` vuoto il sito mostra i dati di `demo-data.js` — utile per testare il layout in locale.
- Test locale: `python3 -m http.server 8080` (nessuna dipendenza).
- ⚠️ **A ogni deploy aumenta il `?v=N`** sui quattro asset in `index.html` (style.css, config.js, demo-data.js, app.js): è il cache-busting — senza, i telefoni tengono il JS vecchio anche per giorni.
