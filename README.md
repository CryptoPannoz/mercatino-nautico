# 🌊 Mercatino Nautico Trieste

Mercatino online dell'usato **windsurf / wing foil / SUP / attrezzatura nautica** per il gruppo WhatsApp di Trieste (~190 membri).

**Sito:** https://cryptopannoz.github.io/mercatino-nautico/

## Come funziona

- Chiunque può **sfogliare gli annunci** e aprire i link condivisi, senza login.
- Chi vuole **vendere** accede con la propria email (link magico, niente password) e può:
  - pubblicare un annuncio con titolo, prezzo, descrizione, categoria e fino a 6 foto (compresse in automatico);
  - modificare prezzo e testo, segnare **venduto** (resta nello storico) o eliminare;
  - **copiare il link + testo pronto** da incollare nel gruppo WhatsApp, o condividerlo direttamente.
- Ogni annuncio ha un link permanente `#/annuncio/<id>` → storico organizzato di cosa è in vendita e cosa no.

## Stack

- **Frontend**: HTML/CSS/JS vanilla, nessuna build. Hosting su **GitHub Pages**.
- **Backend**: [Supabase](https://supabase.com) (piano gratuito) — auth con magic link, database Postgres, storage foto.
- Senza configurazione il sito gira in **modalità demo** con dati di esempio.

## Setup

Da fare una sola volta (≈10 minuti):

1. **Crea il progetto Supabase**
   - Vai su [supabase.com](https://supabase.com) → Sign up (va bene "Continue with GitHub").
   - `New project` → nome es. `mercatino-nautico`, regione `Central EU (Frankfurt)`, genera una database password (salvala nel password manager, non serve nell'app).

2. **Crea tabella, bucket e policy**
   - Dashboard → `SQL Editor` → `New query` → incolla tutto il contenuto di [`setup.sql`](setup.sql) → `Run`.

3. **Configura gli URL di redirect** (per i link di accesso via email)
   - Dashboard → `Authentication` → `URL Configuration`:
     - **Site URL**: `https://cryptopannoz.github.io/mercatino-nautico/`
     - **Redirect URLs**: aggiungi anche `http://localhost:*` se vuoi testare in locale.

4. **Copia le chiavi nel sito**
   - Dashboard → `Settings` → `API Keys`: copia `Project URL` e la chiave `anon` / `publishable`.
   - Incollale in [`config.js`](config.js) e fai commit+push. La anon key è pensata per essere pubblica: la sicurezza è nelle policy RLS di `setup.sql`.

5. Fatto — il banner demo sparisce e login/pubblicazione sono attivi.

> **Nota email**: il servizio email integrato di Supabase ha un limite basso (~2 email/ora) pensato per i test. Per un gruppo di 190 persone conviene collegare un SMTP gratuito (es. [Brevo](https://www.brevo.com), 300 email/giorno) in `Authentication` → `Emails` → `SMTP Settings`. Si può fare anche in un secondo momento.

## Sviluppo locale

```bash
python3 -m http.server 8080
# poi apri http://localhost:8080
```

Nessuna dipendenza da installare: Supabase è caricato da CDN.
