const FIREBASE_AUTH_DOMAIN = 'hscode-egypt.firebaseapp.com'
const OWN_HOSTS = ['sabprocess.com', 'www.sabprocess.com', 'sabprocess.vercel.app']

/** On our own hosts the auth handler is proxied same-origin (vercel.json), so redirect sign-in survives iOS storage partitioning. */
export function authDomainFor(host: string): string {
  return OWN_HOSTS.includes(host) ? host : FIREBASE_AUTH_DOMAIN
}

export const firebaseConfig = {
  apiKey: 'AIzaSyATF__L9igB1mo58WvQQvgYc8faw4Zgoj8',
  authDomain: typeof location === 'undefined' ? FIREBASE_AUTH_DOMAIN : authDomainFor(location.host),
  projectId: 'hscode-egypt',
  storageBucket: 'hscode-egypt.firebasestorage.app',
  messagingSenderId: '877272421301',
  appId: '1:877272421301:web:0b7f3c316a12389316bffc',
  measurementId: 'G-SF70L271BF',
}

export const ADMIN_UID = 'CYQ2CC3DXMTne79XA79vqsYxB8R2'
export const EMULATOR_PROJECT_ID = 'demo-hscode'
