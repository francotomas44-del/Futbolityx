/* firebase-auth.js - wrapper de Firebase Auth (Google + email/password).
   Usa el SDK compat cargado por CDN para que la app siga siendo estatica.
   El ID token se canjea en el backend desde account.js; aca solo hablamos
   con Firebase y nunca guardamos credenciales en localStorage propio. */
(function () {
  "use strict";

  var AD = window.AD = window.AD || {};

  var auth = null;
  var configured = false;
  var initError = null;

  function config() {
    return window.FIREBASE_CONFIG || {};
  }

  function isConfigured() {
    // Inicializamos aca, no solo en requireAuth(): account.js decide qué form
    // mostrar durante el primer render, antes de que haya un click.
    init();
    var cfg = config();
    return !!(configured && cfg.apiKey && cfg.projectId && window.firebase);
  }

  function init() {
    if (auth || initError) return;

    var cfg = config();
    if (!window.firebase || !cfg.apiKey || !cfg.projectId || !cfg.appId) {
      initError = new Error("Firebase no esta configurado.");
      return;
    }

    try {
      var app = window.firebase.apps.length
        ? window.firebase.app()
        : window.firebase.initializeApp(cfg);
      auth = app.auth();

      if (window.firebase.auth.Auth && window.firebase.auth.Auth.Persistence) {
        auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
      }

      configured = true;
    } catch (error) {
      initError = error;
    }
  }

  function requireAuth() {
    init();
    if (!isConfigured()) {
      throw initError || new Error("Firebase no esta configurado.");
    }
    return auth;
  }

  function friendlyError(error) {
    var code = error && error.code ? String(error.code) : "";
    var messages = {
      "auth/invalid-email": "Ese email no es valido.",
      "auth/user-disabled": "Esta cuenta fue deshabilitada. Escribinos a futbolityx@gmail.com.",
      "auth/user-not-found": "No encontramos una cuenta con ese email. Creala con ‘Crear cuenta’.",
      "auth/wrong-password": "La contraseña es incorrecta.",
      "auth/invalid-credential": "Email o contraseña incorrectos.",
      "auth/email-already-in-use": "Ya existe una cuenta con ese email. Ingresá con tu contraseña.",
      "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
      "auth/popup-closed-by-user": "Cerraste la ventana de Google antes de completar el ingreso.",
      "auth/cancelled-popup-request": "Cerraste la ventana de Google antes de completar el ingreso.",
      "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permití ventanas emergentes.",
      "auth/network-request-failed": "No pudimos conectarnos con Firebase. Revisá tu conexión.",
      "auth/too-many-requests": "Demasiados intentos. Esperá un momento y volvé a probar."
    };

    var message = messages[code];
    if (message) {
      var result = new Error(message);
      result.code = code;
      return result;
    }

    return error || new Error("No pudimos completar el ingreso.");
  }

  async function signInWithEmail(email, password) {
    try {
      return await requireAuth().signInWithEmailAndPassword(email, password);
    } catch (error) {
      throw friendlyError(error);
    }
  }

  async function createAccount(email, password, displayName) {
    try {
      var credential = await requireAuth().createUserWithEmailAndPassword(email, password);

      if (displayName && credential.user.updateProfile) {
        try {
          await credential.user.updateProfile({ displayName: displayName });
        } catch (error) {
          // El perfil es opcional; no bloquea la cuenta.
        }
      }

      try {
        await credential.user.sendEmailVerification();
      } catch (error) {
        // Firebase puede limitar el envío; se puede reenviar desde la cuenta.
      }

      return credential;
    } catch (error) {
      throw friendlyError(error);
    }
  }

  async function signInWithGoogle() {
    try {
      var provider = new window.firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return await requireAuth().signInWithPopup(provider);
    } catch (error) {
      throw friendlyError(error);
    }
  }

  async function sendPasswordReset(email) {
    try {
      await requireAuth().sendPasswordResetEmail(email);
      return true;
    } catch (error) {
      throw friendlyError(error);
    }
  }

  async function sendVerificationEmail() {
    var user = requireAuth().currentUser;
    if (!user) return false;
    try {
      await user.sendEmailVerification();
      return true;
    } catch (error) {
      throw friendlyError(error);
    }
  }

  async function getIdToken() {
    var user = requireAuth().currentUser;
    if (!user) return null;
    return user.getIdToken(false);
  }

  function currentUser() {
    return auth ? auth.currentUser : null;
  }

  function onAuthStateChanged(callback) {
    if (!isConfigured()) {
      callback(null);
      return function () {};
    }
    return auth.onAuthStateChanged(callback);
  }

  async function signOut() {
    if (auth) {
      await auth.signOut();
    }
  }

  AD.firebaseAuth = {
    isConfigured: isConfigured,
    init: init,
    signInWithEmail: signInWithEmail,
    createAccount: createAccount,
    signInWithGoogle: signInWithGoogle,
    sendPasswordReset: sendPasswordReset,
    sendVerificationEmail: sendVerificationEmail,
    getIdToken: getIdToken,
    currentUser: currentUser,
    onAuthStateChanged: onAuthStateChanged,
    signOut: signOut
  };
})();
