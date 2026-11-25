/* Configuracion publica del proyecto Firebase de Futbolityx.
   Copiala de Firebase Console > Project settings > Your apps > Web app.
   No es un secreto: el SDK web la necesita en el navegador.

   El backend debe usar el MISMO projectId en FIREBASE_PROJECT_ID.
   Si se deja vacio, account.js muestra el flujo legacy de magic link. */
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: "AIzaSyALmdI3Ob4IyoZqFbdcFQPe3Psc3FthkaU",
  authDomain: "futbolityx-e7a20.firebaseapp.com",
  projectId: "futbolityx-e7a20",
  storageBucket: "futbolityx-e7a20.firebasestorage.app",
  messagingSenderId: "152319802533",
  appId: "1:152319802533:web:cef39854fbc03fb29fe14c"
};
