# Cycle V3

Diario del ciclo local-first, senza account, analytics o servizi esterni.

- Oggi: situazione, check-in e una osservazione verificabile.
- Registra: flusso, energia, sintomi, umore; dettagli intimi facoltativi.
- Calendario: registrazioni e prossimo intervallo, con livelli facoltativi.
- Andamento: evidenze, cicli recenti e numeri di contesto.
- Impostazioni accessibili da ogni scheda; backup anche prima dell’onboarding.

## Dati e compatibilità

La chiave e la versione restano `cycle.v1` / `version: 1`. Le aggiunte sono opzionali:
`flowRecorded`, `symptomsRecorded` e `backupConflicts`. Nessuna riscrittura all’avvio.
Nei dati precedenti `none` e gli array vuoti non vengono convertiti in risposte negative certe.
I marcatori delle vecchie importazioni rimangono leggibili. Non esistono dataset personali nel codice.
Una vecchia versione dell’app non conosce i nuovi campi: non eseguire un downgrade dopo avere registrato dati V3.

La scrittura viene verificata; un documento corrotto resta intatto fino alla scelta esplicita di recupero/reset.
Le bozze rimangono in memoria durante la navigazione; un refresh avvisa della loro presenza.
Le altre schede vengono sincronizzate; una bozza in conflitto richiede una scelta e conserva la versione precedente.
Il JSON esportato contiene dati intimi in chiaro, incluse le versioni alternative dei giorni importati.

## Stime e osservazioni

Gli episodi aperti o incompleti non contribuiscono alla durata media mestruale.
Una fine richiede un giorno successivo esplicitamente senza flusso e una sequenza senza buchi.
Le stime richiedono almeno due intervalli completati, senza intervalli esclusi o variabilità elevata.
Nessuna proiezione mestruale multipla. Ovulazione sempre stimata, mai contraccezione.
Gli insight richiedono osservazioni pertinenti distribuite su almeno tre cicli; nessuna diagnosi o causalità.

## Verifica

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run start
# Browser suite: indicare un modulo Playwright già installato
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/e2e-v3.mjs
```

Le fixture sono sintetiche e vivono solo nei test. Il service worker aggiorna la cache
locale al passaggio a V3. Eventuali distribuzioni storiche del codice precedente devono
essere gestite anche dal provider di hosting: una cancellazione del dato locale non le rimuove.
