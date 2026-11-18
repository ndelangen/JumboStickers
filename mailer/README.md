# Set up daily emails

Use a separate free Gmail account for Stickerruil Zwolle.

1. Open Google Apps Script with that account. Add `Code.gs` and `appsscript.json` from this directory to the project.
2. Generate a random secret with `openssl rand -hex 32`. Save it as `DIGEST_MAILER_SECRET` in the Apps Script properties and the Convex environment.
3. Deploy the script as a web app. Set it to run as the Gmail account owner and grant access to **Anyone**. The script checks the secret before sending mail. [Apps Script web apps](https://developers.google.com/apps-script/guides/web)
4. Include the `email` and `email_verified` claims in the Descope session. Use the signed-in user's verified address and a boolean for `email_verified`. [Descope custom claims](https://docs.descope.com/flows/actions/custom-claims)
5. Set `DIGEST_MAILER_URL` to the `/exec` URL in Convex. Set `DIGEST_SITE_URL` to the web app's HTTPS URL without a trailing slash. Once both URLs and the secret are set, users can opt into trade alerts and unread-message reminders independently.

Publish `/afmelden` on the same HTTPS origin before enabling trade emails. Users can confirm that they want to unsubscribe without signing in.

Deploy the Apps Script revision that accepts reminders and combined summaries before releasing the new digest code. Both sections share a single recipient and date reservation. A reminder with no trade matches contains only the unread count and the inbox link.

On the test deployment, check that a test user can sign in, receive a trade email for an available sticker, and unsubscribe through the link in that email. Apps Script limits personal Gmail accounts to 100 recipients per day. The app suppresses retries when it cannot confirm the send outcome. [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
