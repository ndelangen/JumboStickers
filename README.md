# Stickerruil Zwolle

Een ruiltool voor het stickeralbum *Zwolle: De Stad Ontrafeld*.

## Lokaal uitproberen

Installeer de pakketten met `npm ci`. Start daarna twee terminals in deze map:

- `npm run dev:convex` start een lokale Convex-server zonder account.
- `npm run dev` start de webapp. Open het adres dat Vite toont.

De app gebruikt voorbeeldstickers, verzamelaars en gesprekken. Convex bewaart de voorbeeldcollectie en ongelezen voorbeeldberichten op deze computer. Wat je zelf typt, blijft in je browser. Inloggen en ruilmails zijn voorbeelddialogen. Gebruik verzonnen gegevens.

`npm run build` controleert TypeScript en bouwt de webapp. Het voorbeeld kan alleen met een lokale Convex-URL werken.
