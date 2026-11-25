/* Configuracion publica del proyecto Firebase de Futbolityx.
   Copiala de Firebase Console > Project settings > Your apps > Web app.
   No es un secreto: el SDK web la necesita en el navegador.

   El backend debe usar el MISMO projectId en FIREBASE_PROJECT_ID.
   Mientras estos valores sigan vacios, la UI muestra el flujo legacy de
   magic link para no cortar las pruebas locales. */
window.FIREBASE_CONFIG = window.FIREBASE_CONFIG || {
  apiKey: "",
  authDomain: "",
  projectId: "",
  appId: ""
};
