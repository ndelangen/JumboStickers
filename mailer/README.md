# Ruilmail instellen

Gebruik een apart gratis Gmail-account voor Stickerruil Zwolle.

1. Open Google Apps Script met dat account. Voeg `Code.gs` en `appsscript.json` uit deze map toe aan het project.
2. Maak een willekeurig geheim met `openssl rand -hex 32`. Sla het op als `DIGEST_MAILER_SECRET` bij de scripteigenschappen en in de Convex-omgeving.
3. Implementeer het script als web-app. Laat die uitvoeren als de Gmail-accounteigenaar en kies **Iedereen** als toegangsniveau. Het script controleert het geheim voordat het mail verstuurt. [Web-apps in Apps Script](https://developers.google.com/apps-script/guides/web)
4. Zorg dat de Descope-sessie de claims `email` en `email_verified` meegeeft. Gebruik het geverifieerde adres van de ingelogde gebruiker en een booleaanse waarde voor `email_verified`. [Custom claims in Descope](https://docs.descope.com/flows/actions/custom-claims)
5. Vul de `/exec`-URL in als `DIGEST_MAILER_URL` in Convex. Zet `DIGEST_SITE_URL` op het HTTPS-adres van de webapp zonder slash aan het eind. Zodra deze instellingen en het geheim aanwezig zijn, kunnen gebruikers ruilmail aanzetten.

Controleer eerst op de testdeployment of een proefgebruiker zich kan aanmelden, een mail voor een beschikbare sticker kan krijgen en zich via die mail kan afmelden. Apps Script geeft persoonlijke Gmail-accounts een daglimiet van 100 ontvangers. Bij een onduidelijke verzenduitkomst probeert de app dezelfde mail niet opnieuw te sturen. [Apps Script-quota](https://developers.google.com/apps-script/guides/services/quotas)
