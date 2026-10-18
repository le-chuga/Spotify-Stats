/**
 * account.js
 * "Mis datos y cuenta": descarga de datos (enlace directo a /api/auth/export)
 * y borrado de la cuenta con confirmación de contraseña.
 */
import { api } from "./api.js";

const $ = (id) => document.getElementById(id);
const el = {
  overlay: $("account-modal-overlay"),
  form: $("account-delete-form"),
  password: $("account-delete-password"),
  error: $("account-delete-error"),
  submit: $("btn-account-delete"),
  close: $("btn-account-close"),
};

function setError(message) {
  el.error.textContent = message || "";
  el.error.classList.toggle("visible", Boolean(message));
}

export function openAccountModal() {
  el.password.value = "";
  setError("");
  el.overlay.hidden = false;
}

function closeModal() {
  el.overlay.hidden = true;
}

el.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!el.password.value) {
    setError("Escribe tu contraseña para confirmar.");
    el.password.focus();
    return;
  }
  setError("");
  el.submit.disabled = true;
  el.submit.textContent = "Borrando…";
  try {
    const { ok, data } = await api.deleteAccount(el.password.value);
    if (!ok) {
      setError(data.error || "No se pudo borrar la cuenta.");
      return;
    }
    window.location.assign("/");
  } catch (err) {
    setError("Error de red: " + err.message);
  } finally {
    el.submit.disabled = false;
    el.submit.textContent = "Borrar mi cuenta definitivamente";
  }
});

el.close.addEventListener("click", closeModal);
el.overlay.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});
