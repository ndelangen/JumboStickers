# Stickerruil Zwolle

Een ruiltool voor het stickeralbum *Zwolle: De Stad Ontrafeld*.

## Lokaal uitproberen

Installeer de pakketten met `npm ci`. Start daarna twee terminals in deze map:

- `npm run dev:convex` start een lokale Convex-server zonder account.
- `npm run dev` start de webapp. Open het adres dat Vite toont.

De app gebruikt voorbeeldstickers. Open **Inloggen** en kies **Open Noor** en **Open Sam** om met twee proefaccounts te ruilen. Convex deelt hun aanbod, interesses en beloftes tussen de tabbladen. De losse demo werkt met voorbeeldgesprekken en bewaart wat je zelf typt alleen in de browser.

Tussen proefaccounts bewaart Convex de berichttekst tot het bericht zichtbaar is in de chat van de ontvanger en diens browser het heeft opgeslagen. De gespreksgeschiedenis staat per account in de browser. Een oudere back-up kan nog berichttekst bevatten. Voor productie moet de inbox na herstel worden opgeschoond voordat de chat weer opengaat.

Inloglinks en ruilmails zijn voorbeelden. Gebruik verzonnen gegevens.

`npm run build` controleert TypeScript en bouwt de webapp. Het voorbeeld kan alleen met een lokale Convex-URL werken.
