const FEEDBACK_TITLES = {
  muted: "Status",
  info: "Aviso",
  success: "Sucesso",
  warning: "Atencao",
  danger: "Erro",
};

const TOAST_ICONS = {
  info: "ℹ️",
  success: "✅",
  warning: "⚠️",
  danger: "🚨",
};

const elements = {
  alerts: document.querySelector("#register-alerts"),
  form: document.querySelector("#register-form"),
  name: document.querySelector("#register-name"),
  email: document.querySelector("#register-email"),
  cohort: document.querySelector("#register-cohort"),
  password: document.querySelector("#register-password"),
  passwordConfirm: document.querySelector("#register-password-confirm"),
  submit: document.querySelector("#register-submit-button"),
  status: document.querySelector("#register-status"),
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const normalizeErrorMessage = (error, fallback = "Nao foi possivel concluir o cadastro agora.") => {
  const rawMessage =
    typeof error === "string" ? error : error?.message ? String(error.message) : fallback;
  const message = rawMessage.trim();
  return message || fallback;
};

const renderFeedback = (element, message, tone = "muted", title = FEEDBACK_TITLES[tone] || "Status") => {
  element.className = `status-text ${tone}`;
  element.innerHTML = `
    <strong class="status-title">${escapeHtml(title)}</strong>
    <span class="status-copy">${escapeHtml(message)}</span>
  `;
};

const showToast = (message, tone = "info") => {
  const toast = document.createElement("article");
  toast.className = `toast toast-${tone}`;
  toast.setAttribute("role", "status");
  toast.innerHTML = `
    <div class="toast-body">
      <strong>${TOAST_ICONS[tone] || "ℹ️"} ${FEEDBACK_TITLES[tone] || "Aviso"}</strong>
      <span>${escapeHtml(message)}</span>
    </div>
  `;

  elements.alerts.appendChild(toast);

  window.setTimeout(() => {
    toast.classList.add("leaving");
    window.setTimeout(() => toast.remove(), 240);
  }, 4200);
};

const buildRequiredMessage = (pairs) => {
  const missing = pairs
    .filter(([input]) => !input.value.trim())
    .map(([, label]) => label);

  if (missing.length === 0) {
    return "";
  }

  if (missing.length === 1) {
    return `Preencha o campo ${missing[0]}.`;
  }

  return `Preencha os campos ${missing.slice(0, -1).join(", ")} e ${missing.at(-1)}.`;
};

const parseJSONResponse = async (response) => {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Falha ao processar requisicao.");
  }

  return payload;
};

const fetchJSON = async (url, options) => {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options,
  });

  return parseJSONResponse(response);
};

const redirectToLogin = (email, cohortCode) => {
  const params = new URLSearchParams({
    registered: "1",
    email,
    cohortCode,
  });

  window.location.assign(`/?${params.toString()}`);
};

const initialize = () => {
  renderFeedback(
    elements.status,
    "Informe seus dados e o código da turma para criar o acesso acadêmico.",
    "muted",
  );

  elements.form?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const requiredMessage = buildRequiredMessage([
      [elements.name, "nome completo"],
      [elements.email, "e-mail"],
      [elements.cohort, "codigo da turma"],
      [elements.password, "senha"],
      [elements.passwordConfirm, "confirmacao da senha"],
    ]);

    if (requiredMessage) {
      renderFeedback(elements.status, requiredMessage, "warning");
      showToast(requiredMessage, "warning");
      return;
    }

    if (elements.password.value.trim().length < 6) {
      const message = "A senha deve ter pelo menos 6 caracteres.";
      renderFeedback(elements.status, message, "warning");
      showToast(message, "warning");
      return;
    }

    if (elements.password.value !== elements.passwordConfirm.value) {
      const message = "A confirmacao da senha precisa ser igual a senha informada.";
      renderFeedback(elements.status, message, "warning");
      showToast(message, "warning");
      return;
    }

    elements.submit.disabled = true;
    renderFeedback(elements.status, "Criando cadastro e validando a turma informada...", "muted");

    try {
      await fetchJSON("/api/auth/student/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: elements.name.value.trim(),
          email: elements.email.value.trim(),
          cohortCode: elements.cohort.value.trim(),
          password: elements.password.value,
        }),
      });

      const message = "Cadastro concluido. Redirecionando para o login do aluno.";
      renderFeedback(elements.status, message, "success");
      showToast("Cadastro criado com sucesso.", "success");
      window.setTimeout(
        () => redirectToLogin(elements.email.value.trim(), elements.cohort.value.trim()),
        900,
      );
    } catch (error) {
      const message = normalizeErrorMessage(
        error,
        "Nao foi possivel criar o cadastro. Revise os dados e tente novamente.",
      );
      renderFeedback(elements.status, message, "danger");
      showToast(message, "danger");
    } finally {
      elements.submit.disabled = false;
    }
  });
};

initialize();
