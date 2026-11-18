# Stickerruil Zwolle

Een ruiltool voor het stickeralbum *Zwolle: De Stad Ontrafeld*.

## Lokaal uitproberen

Installeer de pakketten met `npm ci`. Start daarna twee terminals in deze map:

- `npm run dev:convex` start een lokale Convex-server zonder account.
- `npm run dev` start de webapp. Open het adres dat Vite toont.

Het album bevat de 175 stickers uit het boek. Klik op **Ik wil ook stickers ruilen** en kies **Open Noor** en **Open Sam** om met twee proefaccounts te ruilen. Convex deelt hun aanbod, interesses en beloftes tussen de tabbladen. De losse demo werkt met voorbeeldgesprekken en bewaart wat je zelf typt alleen in de browser.

Tussen proefaccounts bewaart Convex de berichttekst tot het bericht zichtbaar is in de chat van de ontvanger en diens browser het heeft opgeslagen. De gespreksgeschiedenis staat per account in de browser. Voor productie moet de inbox na herstel worden opgeschoond voordat de chat weer opengaat.

In de losse demo zijn inloglinks en ruilmails voorbeelden. Gebruik verzonnen gegevens.

`npm run build` controleert TypeScript en bouwt de webapp.

## Testen met echte inlogmail

Stel op de Convex-testdeployment `DESCOPE_PROJECT_ID` en `DESCOPE_API_URL` in. Gebruik in de frontend `VITE_CONVEX_URL`, `VITE_DESCOPE_PROJECT_ID`, `VITE_DESCOPE_API_URL` en `VITE_DESCOPE_FLOW_ID`. De flow `stickerruil-inloggen` heeft scanbescherming, een geldigheid van vijf minuten en stuurt via Descope (`noreply@descope.io`). De terugkeerpagina is `/inloggen`.

Een profiel in Convex bevat de Descope-identiteit en de gekozen schermnaam. Voor een publieke lancering moet accountverwijdering ook de Descope-identiteit wissen.

De [foto van Zwolle](https://commons.wikimedia.org/wiki/File:Zwolle_Centrum.jpg) is van Deerpeter en valt onder [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
