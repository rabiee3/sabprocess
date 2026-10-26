// For lazy chunks only: re-exporting ./db pulls in firebase/firestore. The entry graph imports ./app.
export { app, appCheck, auth, useEmulator } from './app'
export { db } from './db'
