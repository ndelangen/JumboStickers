# Stickerruil Zwolle

A trading tool for the sticker album *Zwolle: De Stad Ontrafeld*.

## Run locally

Install the dependencies with `npm ci`. Then run these commands in separate terminals from this directory:

- `npm run dev:convex` starts a local Convex server without an account.
- `npm run dev` starts the web app. Open the URL printed by Vite.

The album contains all 175 stickers from the book. Click **Ik wil ook stickers ruilen**, then **Open Noor** and **Open Sam** to trade between two test accounts. Convex shares their offers, expressions of interest, and reservations across tabs. The standalone demo has sample conversations and stores the messages you type in your browser.

For the test accounts, Convex keeps each message until the recipient sees it in the chat and their browser saves a copy. Each account's chat history stays in the browser. After restoring a production backup, clear the unread-message queue before reopening chat.

In the standalone demo, sign-in links and trade emails are simulated. Use fictional details.

`npm run build` checks the frontend TypeScript and builds the web app.

## Test with real sign-in emails

Set `DESCOPE_PROJECT_ID` and `DESCOPE_API_URL` on the Convex test deployment. For the frontend, set `VITE_CONVEX_URL`, `VITE_DESCOPE_PROJECT_ID`, `VITE_DESCOPE_API_URL`, and `VITE_DESCOPE_FLOW_ID`. The `stickerruil-inloggen` flow sends links through Descope from `noreply@descope.io`. The links expire after five minutes and have protection against email scanners. The return path is `/inloggen`.

Users can delete their profile and trade data in **Instellingen** (Settings). The app also clears their chat history in the current browser and signs them out. Descope retains their sign-in identity so they can sign in again and start with an empty album.

Set `VITE_PRIVACY_CONTROLLER_NAME` and `VITE_PRIVACY_CONTACT_EMAIL` in the production build. The privacy notice displays both values to visitors.

## Publish to Netlify

GitHub Actions checks pull requests. After CI passes on `main`, it builds with the production Vite variables, uploads the static site to Netlify and checks the published deployment and live files. Run **CI** manually on `main` to retry a release. The Netlify site has no Git-triggered builds.

Each release keeps the previous build's assets available for at least seven days so open tabs can still load scripts and fonts.

Configure the six production `VITE_*` variables and `NETLIFY_SITE_ID` in GitHub's `production` environment. Store the dedicated deploy credential there as the `NETLIFY_AUTH_TOKEN` secret. Its Netlify permissions come from the issuing account. Rotate it before it expires.

Deploy compatible Convex changes separately before merging frontend changes that need them. Netlify's production deploy credit limit also applies to GitHub Actions uploads.

The [photo of Zwolle](https://commons.wikimedia.org/wiki/File:Zwolle_Centrum.jpg) is by Deerpeter and is licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The social preview uses a crop of the photo under the same license.
