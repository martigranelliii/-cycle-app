# Cycle

Un tracker del ciclo semplice e intimo. Risponde a tre domande:

1. Dove sono nel mio ciclo?
2. Come mi sono sentita?
3. Quando dovrebbe arrivare il prossimo ciclo?

Tutto resta sul dispositivo: nessun account, nessuna rete, nessuna analytics.
Le previsioni sono sempre presentate come stime, mai come certezze.

## Cosa c'è dentro

- **Oggi** — giorno del ciclo, fase, stima del prossimo ciclo, registrazione di oggi, un insight personale.
- **Calendario** — mese corrente, mesi precedenti e successivi, giorni di mestruazioni registrati distinti da quelli stimati, dettaglio del giorno e modifica.
- **Registra** — flusso, umore, sintomi, energia, note. Circa dieci secondi per giornata.
- **Insights** — durata media del ciclo e delle mestruazioni, ultimi cicli, pattern solo quando i dati li sostengono.
- **Onboarding** — tre passaggi leggeri, nessuna registrazione.
- **Impostazioni minime** — valori di partenza per le stime e "Resetta dati" con conferma.

## Struttura

```
app/            layout, pagina unica, manifest, stili/token di design
components/     schermate e primitive UI (bottom nav, card, chip, stepper…)
lib/dates.ts    date locali (nessuna dipendenza, nessun fuso orario)
lib/cycle.ts    motore deterministico del ciclo (testabile, senza React)
lib/insights.ts lettura dei dati registrati (nessuna diagnosi)
lib/storage.ts  localStorage: lettura, scrittura, sanitizzazione
lib/store.ts    piccolo store esterno + hook `useStore`
types/          tipi condivisi
public/sw.js    service worker minimale: l'app funziona offline
```

## Note su dati e previsioni

- I dati stanno in `localStorage` sotto la chiave `cycle.v1`; un payload corrotto non rompe l'app.
- Il ciclo attuale nasce dal primo giorno di flusso registrato (o dalla data riportata nell'onboarding).
- Senza storico si parte da valori tipici (28/5 giorni) e l'app lo dice chiaramente; con lo storico si usa la media reale.
- Le fasi sono orientative e le date stimate non sono mai presentate come certe.

## Sviluppo

```bash
npm run dev     # http://localhost:3000
npm run build
npm start
```
