/* account.js - login con Firebase (Google/email), panel de cuenta y planes.
   Firebase emite el ID token; el backend lo canjea por una cookie de sesion
   propia y resuelve plan, beta y cuotas. Si Firebase no esta configurado se
   mantiene el flujo legacy de magic link para no romper las pruebas locales.
   Se apoya en window.AD.api (js/api.js). Si el backend no esta configurado,
   muestra un aviso y no rompe la app.
*/
(function () {
  "use strict";

  var AD = window.AD = window.AD || {};

  var modal = null;
  var root = null;
  var trigger = null;

  var state = {
    account: null,
    plans: null,
    accountLoading: false,
    plansLoading: false,
    busy: false,
    interval: "month",
    provider: "mercadopago",
    message: null,
    messageType: "info",
    devLink: null,
    plansError: null
  };

  function api() {
    return AD.api;
  }

  function isConfigured() {
    return !!(api() && api().isConfigured && api().isConfigured());
  }

  function firebaseEnabled() {
    var auth = AD.firebaseAuth;
    return !!(auth && auth.isConfigured && auth.isConfigured());
  }

  function isGuestAccess() {
    return !!(AD.access && AD.access.isGuest && AD.access.isGuest());
  }

  function betaInfo() {
    return (state.account && state.account.beta) || (state.plans && state.plans.beta) || null;
  }

  function betaEnabled() {
    var beta = betaInfo();
    return !!(beta && beta.enabled);
  }

  function betaInvited() {
    var beta = state.account && state.account.beta;
    return !!(beta && beta.invited);
  }

  function betaCheckoutDisabled() {
    var beta = betaInfo();
    return !!(beta && beta.enabled && beta.checkoutDisabled);
  }

  function betaLabel() {
    var beta = betaInfo();
    return (beta && beta.label) || "Prueba cerrada";
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      if (char === "&") return "&amp;";
      if (char === "<") return "&lt;";
      if (char === ">") return "&gt;";
      if (char === '"') return "&quot;";
      return "&#39;";
    });
  }

  function money(amount, currency) {
    var value = Number(amount) || 0;
    var formatted = new Intl.NumberFormat("es-AR", {
      maximumFractionDigits: currency === "USD" ? 2 : 0
    }).format(value);
    return (currency === "USD" ? "US$ " : "$ ") + formatted;
  }

  function formatDate(value) {
    if (!value) return "";
    var date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });
  }

  function planName(id) {
    if (id === "pro") return "Pro";
    if (id === "elite") return "Elite";
    return "Free";
  }

  function currentPlan() {
    return state.account && state.account.plan ? state.account.plan : "free";
  }

  function findPlan(id) {
    var plans = state.plans && state.plans.plans ? state.plans.plans : [];
    for (var i = 0; i < plans.length; i++) {
      if (plans[i].id === id) return plans[i];
    }
    return null;
  }

  function providerAvailable(provider) {
    return billingAvailable() &&
      !!(state.plans && state.plans.providers && state.plans.providers[provider]);
  }

  function billingAvailable() {
    return !!(state.plans && state.plans.billing === "available");
  }

  function selectedProvider() {
    if (providerAvailable(state.provider)) return state.provider;
    if (providerAvailable("mercadopago")) return "mercadopago";
    if (providerAvailable("paddle")) return "paddle";
    return state.provider;
  }

  function selectedCurrency() {
    return selectedProvider() === "paddle" ? "USD" : "ARS";
  }

  function priceFor(plan) {
    var currency = selectedCurrency() === "USD" ? "usd" : "ars";
    var interval = state.interval === "year" ? "yearly" : "monthly";
    return plan.price && plan.price[currency] ? Number(plan.price[currency][interval]) || 0 : 0;
  }

  function updateTrigger() {
    if (!trigger) return;
    if (isGuestAccess()) trigger.textContent = "Invitado";
    else trigger.textContent = state.account ? "Mi cuenta" : "Ingresar";
  }

  function setMessage(message, type) {
    state.message = message || null;
    state.messageType = type || "info";
  }

  function clearDevLink() {
    state.devLink = null;
  }

  function renderAlert() {
    if (!state.message) return "";
    var modifier = state.messageType === "error"
      ? " is-error"
      : state.messageType === "ok"
        ? " is-ok"
        : "";
    return '<div class="account-alert' + modifier + '">' + esc(state.message) + "</div>";
  }

  function renderHead() {
    return (
      '<div class="account-head">' +
        "<div>" +
          '<p class="account-kicker">Futbolityx</p>' +
          '<h2 class="account-title" id="account-title">' +
            (state.account ? "Tu cuenta" : isGuestAccess() ? "Modo invitado" : "Ingresá a Futbolityx") +
          "</h2>" +
          '<p class="account-sub">' +
            (state.account
              ? betaInvited()
                ? "Prueba cerrada: estás usando un plan de prueba sin cobro."
                : "Gestioná tu plan, tus análisis y tu suscripción."
              : isGuestAccess()
                ? "Acceso solo al panel Hoy. Ingresá con tu cuenta para usar todas las herramientas."
                : betaEnabled()
                  ? "Acceso solo para invitados a la prueba cerrada."
                  : firebaseEnabled()
                    ? "Ingresá con Google o con tu email y contraseña de Firebase."
                    : "Ingresá con tu email para recibir un enlace de acceso.") +
          "</p>" +
        "</div>" +
      "</div>" +
      renderAlert()
    );
  }

  function renderLoading() {
    return renderHead() + '<div class="account-alert">Cargando tu cuenta…</div>';
  }

  function renderNotConfigured() {
    return (
      '<div class="account-head">' +
        "<div>" +
          '<p class="account-kicker">Futbolityx</p>' +
          '<h2 class="account-title" id="account-title">Cuenta no disponible</h2>' +
          '<p class="account-sub">Esta copia de la app no tiene backend de cuentas configurado.</p>' +
        "</div>" +
      "</div>" +
      '<div class="account-alert">En la versión publicada en Vercel vas a poder ingresar, contratar Pro o Elite y gestionar tu suscripción.</div>' +
      '<p class="account-note">Si sos el administrador, configurá <code>window.FUTBOLITYX_API</code> o desplegá el backend. La app sigue funcionando sin cuenta.</p>'
    );
  }

  function renderBetaNote() {
    if (!betaEnabled()) return "";

    return (
      '<p class="account-note">' + esc(betaLabel()) +
        ': el acceso está limitado a los emails invitados. Si no tenés acceso, escribí a ' +
        '<a href="mailto:futbolityx@gmail.com">futbolityx@gmail.com</a>.</p>'
    );
  }

  function renderLegalNote() {
    return (
      '<p class="account-note">Al ingresar aceptás los ' +
        '<a href="legal.html#doc-terminos">Términos</a> y la ' +
        '<a href="legal.html#doc-privacidad">Política de Privacidad</a>.</p>'
    );
  }

  function renderGuestEntry() {
    return (
      '<div class="account-divider"><span>o</span></div>' +
      '<button class="btn btn-secondary" type="button" data-action="guest">Invitado</button>' +
      '<p class="account-note">Entrá sin cuenta: solo vas a ver el panel Hoy, sin Analizar completo.</p>'
    );
  }

  function renderGuestPanel() {
    return (
      '<section class="account-section">' +
        "<h3>Estás en modo invitado</h3>" +
        '<p class="account-note">Tenés acceso solo al panel <strong>Hoy</strong>. ' +
          "Para Analizar completo y el resto de las herramientas, ingresá con tu cuenta.</p>" +
        '<div class="account-form-actions">' +
          '<button class="btn btn-primary" type="button" data-action="exit-guest">Ingresar con mi cuenta</button>' +
          '<button class="btn btn-secondary" type="button" data-action="stay-guest">Seguir como invitado</button>' +
        "</div>" +
      "</section>"
    );
  }

  function renderFirebaseLogin() {
    return (
      '<section class="account-section">' +
        "<h3>Ingresá a tu cuenta</h3>" +
        '<button class="btn btn-google" type="button" data-action="google"' +
          (state.busy ? " disabled" : "") + ">" +
          '<span aria-hidden="true">G</span> Continuar con Google' +
        "</button>" +
        '<div class="account-divider"><span>o con tu email</span></div>' +
        '<form id="account-login-form" class="account-form account-form-stack" autocomplete="on">' +
          '<label class="field">' +
            "<span>Email</span>" +
            '<input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="vos@email.com" value="' +
              esc(state.email || "") + '" />' +
          "</label>" +
          '<label class="field">' +
            "<span>Contraseña</span>" +
            '<input type="password" name="password" required minlength="6" maxlength="128" autocomplete="current-password" placeholder="Mínimo 6 caracteres" />' +
          "</label>" +
          '<div class="account-form-actions">' +
            '<button class="btn btn-primary" type="submit" name="intent" value="login"' +
              (state.busy ? " disabled" : "") + ">" +
              (state.busy ? "Ingresando…" : "Ingresar") +
            "</button>" +
            '<button class="btn btn-secondary" type="submit" name="intent" value="register"' +
              (state.busy ? " disabled" : "") + ">Crear cuenta</button>" +
            '<button class="btn btn-ghost" type="button" data-action="reset-password"' +
              (state.busy ? " disabled" : "") + ">Recuperar contraseña</button>" +
          "</div>" +
        "</form>" +
        renderBetaNote() +
        '<p class="account-note">Si creás una cuenta con email, verificá el correo antes de ingresar. ' +
          'El acceso solo habilita las funciones de cuenta; el análisis público sigue sin login.</p>' +
        renderGuestEntry() +
        renderLegalNote() +
      "</section>"
    );
  }

  function renderLegacyLogin() {
    return (
      '<section class="account-section">' +
        "<h3>Entrá con tu email</h3>" +
        '<form id="account-login-form" class="account-form" autocomplete="on">' +
          '<label class="field">' +
            "<span>Email</span>" +
            '<input type="email" name="email" required maxlength="254" autocomplete="email" placeholder="vos@email.com" value="' +
              esc(state.email || "") + '" />' +
          "</label>" +
          '<button class="btn btn-primary" type="submit"' + (state.busy ? " disabled" : "") + ">" +
            (state.busy ? "Enviando…" : "Enviar enlace") +
          "</button>" +
        "</form>" +
        (state.devLink
          ? '<a class="account-devlink" href="' + esc(state.devLink) + '">Abrir enlace de acceso (desarrollo)</a>'
          : "") +
        renderBetaNote() +
        '<p class="account-note">El enlace vence en 15 minutos y es de un solo uso. ' +
          'Configurá Firebase para habilitar Google y email/contraseña.</p>' +
        renderGuestEntry() +
        renderLegalNote() +
      "</section>"
    );
  }

  function renderLogin() {
    if (isGuestAccess()) return renderGuestPanel();
    return firebaseEnabled() ? renderFirebaseLogin() : renderLegacyLogin();
  }

  function usagePercent(usage) {
    if (!usage || usage.analysesPerDay === null || usage.analysesPerDay === undefined) return 0;
    if (!usage.analysesPerDay) return 0;
    return Math.min(100, Math.round((Number(usage.analysesLast24h || 0) / usage.analysesPerDay) * 100));
  }

  function subscriptionText(account) {
    var text = planName(account.plan);
    var sub = account.subscription;

    if (account.role === "admin") {
      return text + " · acceso de administrador";
    }

    if (account.role === "guest") {
      return text + " · plan invitado";
    }

    if (!sub && account.beta && account.beta.invited) {
      return text + " · plan de prueba";
    }

    if (!sub) return text + " · sin suscripción";

    if (sub.status === "canceled") {
      text += " · cancelada";
      if (sub.currentPeriodEnd) text += ", acceso hasta " + formatDate(sub.currentPeriodEnd);
    } else if (sub.cancelAtPeriodEnd) {
      text += " · cancela al final del período";
      if (sub.currentPeriodEnd) text += " (" + formatDate(sub.currentPeriodEnd) + ")";
    } else if (sub.currentPeriodEnd) {
      text += " · renueva el " + formatDate(sub.currentPeriodEnd);
    } else {
      text += " · activa";
    }

    if (sub.provider === "paddle") text += " · Paddle";
    if (sub.provider === "mercadopago") text += " · Mercado Pago";

    return text;
  }

  function renderAccount() {
    var account = state.account;
    var usage = account.usage || {};
    var badgeClass = account.plan === "pro" ? " is-pro" : account.plan === "elite" ? " is-elite" : "";
    var roleBadge = account.role === "admin" ? " · Administrador"
      : account.beta && account.beta.invited ? " · Beta"
      : account.role === "guest" ? " · Invitado" : "";
    var badgeText = planName(account.plan) + roleBadge;
    var initial = String(account.user && account.user.email ? account.user.email : "?").charAt(0).toUpperCase();
    var usageHtml;

    if (usage.analysesPerDay === null || usage.analysesPerDay === undefined) {
      usageHtml =
        '<div class="account-usage-head"><span>Análisis</span><span>Ilimitados</span></div>' +
        '<div class="account-usage-track"><div class="account-usage-fill" style="width:100%"></div></div>';
    } else {
      var used = Number(usage.analysesLast24h || 0);
      var limit = Number(usage.analysesPerDay || 0);
      usageHtml =
        '<div class="account-usage-head"><span>Análisis en las últimas 24 h</span><span>' +
          used + " / " + limit + "</span></div>" +
        '<div class="account-usage-track"><div class="account-usage-fill" style="width:' +
          usagePercent(usage) + '%"></div></div>';
    }

    var sub = account.subscription;
    var canCancel = !!(sub &&
      sub.status !== "canceled" &&
      sub.status !== "expired" &&
      !sub.cancelAtPeriodEnd);

    return (
      '<section class="account-section">' +
        '<div class="account-user">' +
          '<div class="account-avatar">' + esc(initial) + "</div>" +
          '<div class="account-user-main">' +
            '<p class="account-email">' + esc(account.user.email) + "</p>" +
            '<p class="account-meta">' + esc(subscriptionText(account)) + "</p>" +
          "</div>" +
          '<span class="account-plan-badge' + badgeClass + '">' + esc(badgeText) + "</span>" +
        "</div>" +
        '<div class="account-usage">' + usageHtml + "</div>" +
        '<div class="account-actions">' +
          '<button class="btn btn-secondary" type="button" data-action="refresh"' + (state.busy ? " disabled" : "") + ">Actualizar</button>" +
          (canCancel
            ? '<button class="btn btn-ghost" type="button" data-action="cancel"' + (state.busy ? " disabled" : "") + ">Cancelar renovación</button>"
            : "") +
          '<button class="btn btn-ghost" type="button" data-action="logout"' + (state.busy ? " disabled" : "") + ">Cerrar sesión</button>" +
        "</div>" +
      "</section>"
    );
  }

  function priceLabel(plan) {
    if (plan.id === "free") {
      return "<strong>Gratis</strong><span>para siempre</span>";
    }

    var amount = priceFor(plan);
    var currency = selectedCurrency();
    var suffix = state.interval === "year" ? "/año" : "/mes";
    var html = "<strong>" + money(amount, currency) + "</strong><span>" + suffix + "</span>";

    if (state.interval === "year" && amount > 0) {
      html += "<small>Equivale a " + money(amount / 12, currency) + "/mes</small>";
    }

    return html;
  }

  function planButton(plan) {
    var current = currentPlan();

    if (state.account && current === plan.id) {
      var currentLabel = betaInvited() ? "Plan de prueba" : "Plan actual";
      return '<button class="btn btn-secondary" type="button" disabled>' + currentLabel + "</button>";
    }

    if (plan.id === "free") {
      return state.account
        ? '<button class="btn btn-ghost" type="button" disabled>Incluido</button>'
        : '<button class="btn btn-secondary" type="button" data-action="login">Crear cuenta gratis</button>';
    }

    if (!state.account) {
      return '<button class="btn btn-primary" type="button" data-action="login">Ingresar para contratar</button>';
    }

    if (betaCheckoutDisabled()) {
      return '<button class="btn btn-ghost" type="button" disabled>Prueba cerrada</button>';
    }

    if (current !== "free" && plan.id !== current) {
      return '<button class="btn btn-ghost" type="button" disabled>Plan activo</button>';
    }

    if (!billingAvailable()) {
      return '<button class="btn btn-ghost" type="button" disabled>Próximamente</button>';
    }

    if (!providerAvailable(selectedProvider())) {
      return '<button class="btn btn-ghost" type="button" disabled>Medio no disponible</button>';
    }

    if (current === "elite" && plan.id === "pro") {
      return '<button class="btn btn-ghost" type="button" disabled>Plan inferior</button>';
    }

    var label = plan.id === "pro"
      ? (current === "free" ? "Elegir Pro" : "Cambiar a Pro")
      : (current === "pro" ? "Mejorar a Elite" : "Elegir Elite");

    return '<button class="btn btn-primary" type="button" data-action="upgrade" data-plan="' +
      esc(plan.id) + '"' + (state.busy ? " disabled" : "") + ">" + label + "</button>";
  }

  function renderPlanCard(plan) {
    var current = currentPlan() === plan.id;
    var recommended = plan.recommended;
    var highlights = plan.highlights || [];
    var list = highlights.map(function (item) {
      return "<li>" + esc(item) + "</li>";
    }).join("");

    return (
      '<article class="account-plan' +
        (recommended ? " is-recommended" : "") +
        (current ? " is-current" : "") + '">' +
        (recommended ? '<span class="account-plan-tag">Recomendado</span>' : "") +
        "<h4>" + esc(plan.name) + "</h4>" +
        '<p class="account-plan-desc">' + esc(plan.description) + "</p>" +
        '<div class="account-price">' + priceLabel(plan) + "</div>" +
        '<ul class="account-features">' + list + "</ul>" +
        planButton(plan) +
      "</article>"
    );
  }

  function renderPlans() {
    var plans = state.plans && state.plans.plans ? state.plans.plans : [];
    var provider = selectedProvider();
    var providersHtml =
      '<div class="account-provider">' +
        '<button type="button" data-action="provider" data-provider="mercadopago"' +
          (provider === "mercadopago" ? ' class="is-on"' : "") +
          (!providerAvailable("mercadopago") || betaCheckoutDisabled() ? " disabled" : "") +
          ">Mercado Pago · ARS</button>" +
        '<button type="button" data-action="provider" data-provider="paddle"' +
          (provider === "paddle" ? ' class="is-on"' : "") +
          (!providerAvailable("paddle") || betaCheckoutDisabled() ? " disabled" : "") +
          ">Paddle · USD</button>" +
      "</div>";

    var note;
    if (betaCheckoutDisabled()) {
      note = "Prueba cerrada: no se cobra nada. Los invitados usan un plan de prueba; " +
        "los pagos se habilitarán recién en el lanzamiento.";
    } else if (state.plans && state.plans.billing === "available") {
      note = "Pago seguro con " + (provider === "paddle" ? "Paddle" : "Mercado Pago") +
        ". Podés cancelar cuando quieras; el acceso sigue hasta el final del período pagado.";
    } else {
      note = "Los pagos todavía no están habilitados. Podés crear tu cuenta gratis y te avisamos cuando se abran los planes.";
    }

    if (state.plansLoading && !state.plans) {
      return '<section class="account-section"><h3>Planes</h3><p class="account-note">Cargando planes…</p></section>';
    }

    if (state.plansError) {
      return (
        '<section class="account-section"><h3>Planes</h3>' +
          '<div class="account-alert is-error">' + esc(state.plansError) + "</div>" +
          '<div class="account-actions"><button class="btn btn-secondary" type="button" data-action="retry-plans">Reintentar</button></div>' +
        "</section>"
      );
    }

    if (!plans.length) {
      return '<section class="account-section"><h3>Planes</h3><p class="account-note">No pudimos cargar los planes.</p></section>';
    }

    return (
      '<section class="account-section" id="account-plans">' +
        '<div class="account-billing-row">' +
          "<div>" +
            "<h3>Planes</h3>" +
            '<p class="account-note">Precios en ' + (selectedCurrency() === "USD" ? "USD" : "ARS") + ".</p>" +
          "</div>" +
          '<div class="account-toggle">' +
            '<button type="button" data-action="interval" data-interval="month"' +
              (state.interval === "month" ? ' class="is-on"' : "") + ">Mensual</button>" +
            '<button type="button" data-action="interval" data-interval="year"' +
              (state.interval === "year" ? ' class="is-on"' : "") + ">Anual</button>" +
          "</div>" +
        "</div>" +
        (betaEnabled()
          ? '<p class="account-note"><strong>' + esc(betaLabel()) +
            '.</strong> Acceso limitado a invitados. Los pagos están deshabilitados durante esta etapa.</p>'
          : "") +
        providersHtml +
        '<div class="account-plans">' + plans.map(renderPlanCard).join("") + "</div>" +
        '<p class="account-note">' + esc(note) + "</p>" +
        (state.plans.pricingStatus === "proposed"
          ? '<p class="account-note">Precios de lanzamiento, sujetos a aprobación.</p>'
          : "") +
        (state.account && currentPlan() !== "free"
          ? '<p class="account-note">Ya tenés un plan activo. Para cambiar de plan, cancelá la renovación y esperá el final del período, o escribí a <a href="mailto:futbolityx@gmail.com">futbolityx@gmail.com</a>.</p>'
          : "") +
      "</section>"
    );
  }

  function renderFoot() {
    return (
      '<p class="account-foot">' +
        "Los pagos se procesan con Mercado Pago (ARS) y Paddle (USD). " +
        "Las suscripciones se renuevan automáticamente y podés cancelarlas desde tu cuenta o escribiendo a " +
        '<a href="mailto:futbolityx@gmail.com">futbolityx@gmail.com</a>. ' +
        'Ver <a href="legal.html#doc-terminos">Términos</a>, ' +
        '<a href="legal.html#doc-pagos">Pagos</a>, ' +
        '<a href="legal.html#doc-privacidad">Privacidad</a> y ' +
        '<a href="legal.html#doc-cookies">Cookies</a>.' +
      "</p>"
    );
  }

  function render() {
    if (!root) return;

    updateTrigger();

    if (!isConfigured()) {
      root.innerHTML = renderNotConfigured();
      return;
    }

    if (state.accountLoading && !state.account && !state.plans) {
      root.innerHTML = renderLoading();
      return;
    }

    root.innerHTML =
      renderHead() +
      (state.account ? renderAccount() : renderLogin()) +
      renderPlans() +
      renderFoot();
  }

  async function refreshAccount() {
    if (!isConfigured()) {
      render();
      return;
    }

    state.accountLoading = true;
    state.busy = true;
    render();

    try {
      state.account = await api().account();
    } catch (error) {
      if (error && error.status === 401) {
        state.account = null;
      } else {
        setMessage(error && error.message ? error.message : "No pudimos cargar tu cuenta.", "error");
      }
    } finally {
      state.accountLoading = false;
      state.busy = false;
      render();
    }
  }

  async function loadPlans() {
    if (!isConfigured() || state.plansLoading) return;

    state.plansLoading = true;
    state.plansError = null;
    render();

    try {
      state.plans = await api().plans();
    } catch (error) {
      state.plansError = error && error.message ? error.message : "No pudimos cargar los planes.";
    } finally {
      state.plansLoading = false;
      render();
    }
  }

  async function finishFirebaseSignIn(user) {
    if (!user) {
      throw new Error("No pudimos identificar tu cuenta de Firebase.");
    }

    if (!user.emailVerified) {
      setMessage("Verificá tu email antes de continuar. Te enviamos el mensaje a " + (user.email || "tu correo") + ".", "info");
      try {
        await AD.firebaseAuth.sendVerificationEmail();
      } catch (error) {
        // El mensaje ya se envio al crear la cuenta; no bloqueamos por reenvio.
      }
      render();
      return false;
    }

    var idToken = await AD.firebaseAuth.getIdToken();
    if (!idToken) {
      throw new Error("Tu sesión de Firebase venció. Volvé a ingresar.");
    }

    var account = await api().authenticateFirebase(idToken);
    // Al iniciar sesión se sale del modo invitado y se liberan las herramientas.
    if (AD.access) AD.access.exit();
    state.account = account;
    clearDevLink();
    setMessage("Sesión iniciada como " + (account.user && account.user.email ? account.user.email : user.email) + ".", "ok");
    updateTrigger();
    render();
    return true;
  }

  async function signInWithEmail(email, password) {
    state.busy = true;
    setMessage(null);
    render();

    try {
      var credential = await AD.firebaseAuth.signInWithEmail(email, password);
      await finishFirebaseSignIn(credential.user);
    } catch (error) {
      setMessage(error && error.message ? error.message : "No pudimos iniciar sesión.", "error");
    } finally {
      state.busy = false;
      render();
    }
  }

  async function registerWithEmail(email, password) {
    state.email = email;
    state.busy = true;
    setMessage(null);
    render();

    try {
      await AD.firebaseAuth.createAccount(email, password, email.split("@")[0]);
      setMessage("Cuenta creada. Te enviamos un email de verificación; confirmalo y tocá Ingresar.", "ok");
    } catch (error) {
      setMessage(error && error.message ? error.message : "No pudimos crear la cuenta.", "error");
    } finally {
      state.busy = false;
      render();
    }
  }

  async function signInWithGoogle() {
    state.busy = true;
    setMessage(null);
    render();

    try {
      var credential = await AD.firebaseAuth.signInWithGoogle();
      await finishFirebaseSignIn(credential.user);
    } catch (error) {
      setMessage(error && error.message ? error.message : "No pudimos iniciar sesión con Google.", "error");
    } finally {
      state.busy = false;
      render();
    }
  }

  async function resetPassword() {
    var input = root ? root.querySelector('input[name="email"]') : null;
    var email = input ? String(input.value || "").trim() : "";

    if (!email) {
      setMessage("Ingresá tu email para recuperar la contraseña.", "error");
      render();
      return;
    }

    state.email = email;
    state.busy = true;
    setMessage(null);
    render();

    try {
      await AD.firebaseAuth.sendPasswordReset(email);
      setMessage("Te enviamos un enlace para restablecer la contraseña a " + email + ".", "ok");
    } catch (error) {
      setMessage(error && error.message ? error.message : "No pudimos enviar el enlace.", "error");
    } finally {
      state.busy = false;
      render();
    }
  }

  async function restoreFirebaseSession() {
    if (!firebaseEnabled()) return;

    var user = AD.firebaseAuth.currentUser;
    // Firebase puede exponer un User todavia no inicializado al cargar la page.
    if (!user || !user.email || !user.emailVerified) return;

    try {
      await finishFirebaseSignIn(user);
    } catch (error) {
      // Si la beta revoco el email o el backend no responde, seguimos sin cuenta.
    }
  }

  async function sendMagicLink(email) {
    state.email = email;
    state.busy = true;
    clearDevLink();
    setMessage(null);
    render();

    try {
      var result = await api().requestMagicLink(email);
      setMessage("Te enviamos un enlace a " + email + ". Revisá tu correo (y la carpeta de spam).", "ok");
      state.devLink = result && result.devLink ? result.devLink : null;
    } catch (error) {
      setMessage(error && error.message ? error.message : "No pudimos enviar el enlace.", "error");
    } finally {
      state.busy = false;
      render();
    }
  }

  function enterAsGuest() {
    if (!AD.access) return;
    AD.access.enter();
    setMessage("Ingresaste como invitado. Solo podés ver el panel Hoy.", "ok");
    updateTrigger();
    close();
  }

  function exitGuest() {
    if (!AD.access) return;
    AD.access.exit();
    setMessage("Saliste del modo invitado.", "ok");
    updateTrigger();
    render();
  }

  async function logout() {
    state.busy = true;
    render();

    try {
      await api().logout();
      if (firebaseEnabled()) {
        await AD.firebaseAuth.signOut();
      }
      state.account = null;
      clearDevLink();
      setMessage("Cerraste sesión.", "ok");
    } catch (error) {
      setMessage(error && error.message ? error.message : "No pudimos cerrar la sesión.", "error");
    } finally {
      state.busy = false;
      render();
    }
  }

  async function cancelSubscription() {
    var sub = state.account && state.account.subscription;
    if (!sub) return;

    if (!window.confirm("¿Cancelar la renovación automática? El acceso sigue hasta el final del período pagado.")) {
      return;
    }

    state.busy = true;
    setMessage("Cancelando la renovación…", "info");
    render();

    try {
      var result = await api().cancelSubscription();
      if (state.account && state.account.subscription) {
        state.account.subscription.cancelAtPeriodEnd = !!(result && result.cancelAtPeriodEnd);
        if (result && result.status) state.account.subscription.status = result.status;
        if (result && result.currentPeriodEnd) {
          state.account.subscription.currentPeriodEnd = result.currentPeriodEnd;
        }
      }
      setMessage("Renovación cancelada. El acceso sigue hasta el final del período pagado.", "ok");
    } catch (error) {
      setMessage(error && error.message ? error.message : "No pudimos cancelar la renovación.", "error");
    } finally {
      state.busy = false;
      render();
    }
  }

  async function upgrade(planId) {
    if (!state.account) {
      setMessage("Ingresá con tu email para contratar un plan.", "error");
      render();
      return;
    }

    if (currentPlan() !== "free") {
      setMessage("Ya tenés un plan activo. Para cambiar de plan, cancelá la renovación y esperá el final del período.", "error");
      render();
      return;
    }

    if (!billingAvailable()) {
      setMessage("Los pagos todavía no están habilitados.", "error");
      render();
      return;
    }

    var provider = selectedProvider();
    if (!providerAvailable(provider)) {
      setMessage("Ese medio de pago todavía no está disponible.", "error");
      render();
      return;
    }

    state.busy = true;
    setMessage("Preparando el pago…", "info");
    render();

    try {
      var result = await api().checkout({
        plan: planId,
        interval: state.interval,
        provider: provider
      });

      if (result && result.url) {
        window.location.href = result.url;
        return;
      }

      throw new Error("El proveedor no devolvió una URL de pago.");
    } catch (error) {
      setMessage(error && error.message ? error.message : "No pudimos iniciar el pago.", "error");
      state.busy = false;
      render();
    }
  }

  function open() {
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add("account-open");
    render();
    refreshAccount();
    if (!state.plans) loadPlans();
  }

  function close() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("account-open");
    if (trigger) trigger.focus();
  }

  function handleClick(event) {
    var closeTarget = event.target.closest("[data-account-close]");
    if (closeTarget) {
      close();
      return;
    }

    var target = event.target.closest("[data-action]");
    if (!target) return;

    var action = target.getAttribute("data-action");

    if (action === "google") {
      signInWithGoogle();
      return;
    }

    if (action === "guest") {
      enterAsGuest();
      return;
    }

    if (action === "exit-guest") {
      exitGuest();
      return;
    }

    if (action === "stay-guest") {
      close();
      return;
    }

    if (action === "reset-password") {
      resetPassword();
      return;
    }

    if (action === "interval") {
      state.interval = target.getAttribute("data-interval") === "year" ? "year" : "month";
      render();
      return;
    }

    if (action === "provider") {
      state.provider = target.getAttribute("data-provider") === "paddle" ? "paddle" : "mercadopago";
      render();
      return;
    }

    if (action === "upgrade") {
      upgrade(target.getAttribute("data-plan"));
      return;
    }

    if (action === "logout") {
      logout();
      return;
    }

    if (action === "cancel") {
      cancelSubscription();
      return;
    }

    if (action === "refresh") {
      refreshAccount();
      return;
    }

    if (action === "retry-plans") {
      state.plans = null;
      loadPlans();
      return;
    }

    if (action === "login") {
      var input = root.querySelector('input[name="email"]');
      if (input) input.focus();
    }
  }

  function handleSubmit(event) {
    var form = event.target.closest("#account-login-form");
    if (!form) return;

    event.preventDefault();

    var input = form.querySelector('input[name="email"]');
    var email = input ? String(input.value || "").trim() : "";
    if (!email) {
      setMessage("Ingresá tu email.", "error");
      render();
      return;
    }

    if (!firebaseEnabled()) {
      sendMagicLink(email);
      return;
    }

    var passwordInput = form.querySelector('input[name="password"]');
    var password = passwordInput ? String(passwordInput.value || "") : "";
    if (!password) {
      setMessage("Ingresá tu contraseña.", "error");
      render();
      return;
    }

    var submitter = event.submitter ||
      (document.activeElement && form.contains(document.activeElement) ? document.activeElement : null);
    var intent = submitter && submitter.getAttribute("name") === "intent"
      ? String(submitter.value || "login")
      : "login";

    if (intent === "register") {
      registerWithEmail(email, password);
    } else {
      signInWithEmail(email, password);
    }
  }

  function cleanQuery() {
    var url = new URL(window.location.href);
    url.searchParams.delete("auth");
    url.searchParams.delete("billing");
    var next = url.pathname + (url.search ? url.search : "") + url.hash;
    window.history.replaceState({}, "", next);
  }

  function handleReturnQuery() {
    var params = new URLSearchParams(window.location.search);
    var auth = params.get("auth");
    var billing = params.get("billing");

    if (auth === "ok") {
      cleanQuery();
      setMessage("Sesión iniciada. Ya podés gestionar tu plan.", "ok");
      open();
      return;
    }

    if (auth === "invalid") {
      cleanQuery();
      setMessage("El enlace venció o ya fue usado. Pedí uno nuevo.", "error");
      open();
      return;
    }

    if (billing === "return") {
      cleanQuery();
      setMessage("Pago recibido. Estamos actualizando tu plan; tocá Actualizar en unos segundos.", "ok");
      open();
    }
  }

  function init() {
    modal = document.getElementById("account-modal");
    root = document.getElementById("account-root");
    trigger = document.getElementById("btn-account");

    if (!modal || !root || !trigger) return;

    trigger.addEventListener("click", open);
    modal.addEventListener("click", handleClick);
    root.addEventListener("submit", handleSubmit);

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !modal.hidden) close();
    });

    updateTrigger();
    handleReturnQuery();

    if (isConfigured()) {
      api().account().then(function (account) {
        state.account = account;
        updateTrigger();
        if (!modal.hidden) render();
      }).catch(function () {
        state.account = null;
        updateTrigger();
        restoreFirebaseSession();
      });
    } else {
      restoreFirebaseSession();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
