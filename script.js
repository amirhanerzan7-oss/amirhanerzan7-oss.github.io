/**
 * EventFlow — логика приложения
 * Хранение мероприятий и регистраций в localStorage
 */

(function () {
  "use strict";

  /** Ключ в localStorage */
  const STORAGE_KEY = "eventflow_events_v1";

  /** Состояние в памяти */
  let events = [];

  // --- DOM-элементы ---
  const els = {
    eventsList: document.getElementById("events-list"),
    eventsEmpty: document.getElementById("events-empty"),
    formCreate: document.getElementById("form-create"),
    statEvents: document.getElementById("stat-events"),
    statReg: document.getElementById("stat-reg"),
    year: document.getElementById("year"),
    navToggle: document.querySelector(".nav-toggle"),
    navMenu: document.getElementById("nav-menu"),
    modalOverlay: document.getElementById("modal-overlay"),
    modalClose: document.querySelector(".modal-close"),
    modalTitle: document.getElementById("modal-title"),
    modalEventName: document.getElementById("modal-event-name"),
    formRegister: document.getElementById("form-register"),
    registerEventId: document.getElementById("register-event-id"),
    registerSuccess: document.getElementById("register-success"),
    modalDone: document.getElementById("modal-done"),
  };

  // ============================================
  // Хранилище
  // ============================================

  function loadEvents() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveEvents() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  }

  function generateId() {
    return "ev_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
  }

  // ============================================
  // Валидация
  // ============================================

  function setFieldError(inputId, message) {
    const input = document.getElementById(inputId);
    const err = document.querySelector(`.field-error[data-for="${inputId}"]`);
    if (err) err.textContent = message || "";
    if (input) input.classList.toggle("invalid", !!message);
  }

  function clearErrors(prefix) {
    document.querySelectorAll(".field-error").forEach((el) => {
      if (!prefix || el.dataset.for.startsWith(prefix)) el.textContent = "";
    });
    document.querySelectorAll("input.invalid, textarea.invalid").forEach((el) => {
      if (!prefix || el.id.startsWith(prefix)) el.classList.remove("invalid");
    });
  }

  /** Простая проверка email */
  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  /** Телефон: не пусто, минимум 10 цифр */
  function isValidPhone(value) {
    const digits = value.replace(/\D/g, "");
    return digits.length >= 10;
  }

  function validateCreateForm() {
    clearErrors("event-");
    let ok = true;
    const title = document.getElementById("event-title").value.trim();
    const date = document.getElementById("event-date").value;
    const desc = document.getElementById("event-desc").value.trim();

    if (!title) {
      setFieldError("event-title", "Введите название мероприятия");
      ok = false;
    }
    if (!date) {
      setFieldError("event-date", "Укажите дату и время");
      ok = false;
    }
    if (!desc) {
      setFieldError("event-desc", "Добавьте описание");
      ok = false;
    }
    return ok;
  }

  function validateRegisterForm() {
    clearErrors("reg-");
    let ok = true;
    const name = document.getElementById("reg-name").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const email = document.getElementById("reg-email").value.trim();

    if (!name || name.length < 2) {
      setFieldError("reg-name", "Укажите имя (минимум 2 символа)");
      ok = false;
    }
    if (!isValidPhone(phone)) {
      setFieldError("reg-phone", "Введите корректный номер телефона");
      ok = false;
    }
    if (!isValidEmail(email)) {
      setFieldError("reg-email", "Введите корректный email");
      ok = false;
    }
    return ok;
  }

  // ============================================
  // Форматирование даты для отображения
  // ============================================

  function formatEventDate(isoString) {
    if (!isoString) return "";
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return isoString;
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  // ============================================
  // Рендер списка мероприятий
  // ============================================

  function totalRegistrations() {
    return events.reduce((sum, ev) => sum + (ev.registrations ? ev.registrations.length : 0), 0);
  }

  function updateStats() {
    els.statEvents.textContent = String(events.length);
    els.statReg.textContent = String(totalRegistrations());
  }

  function renderEvents() {
    els.eventsList.innerHTML = "";
    if (events.length === 0) {
      els.eventsEmpty.classList.remove("hidden");
      updateStats();
      return;
    }
    els.eventsEmpty.classList.add("hidden");

    // Сортируем по дате (ближайшие сверху)
    const sorted = [...events].sort((a, b) => new Date(a.date) - new Date(b.date));

    sorted.forEach((ev) => {
      const card = document.createElement("article");
      card.className = "event-card";
      card.setAttribute("role", "listitem");

      const regCount = ev.registrations ? ev.registrations.length : 0;
      const countLabel =
        regCount === 0
          ? "пока никто не зарегистрирован"
          : `${regCount} ${pluralRu(regCount, "участник", "участника", "участников")}`;

      card.innerHTML = `
        <h3>${escapeHtml(ev.title)}</h3>
        <div class="event-meta">${escapeHtml(formatEventDate(ev.date))}</div>
        <p class="event-desc">${escapeHtml(ev.description)}</p>
        <div class="event-footer">
          <span class="event-count">${escapeHtml(countLabel)}</span>
          <button type="button" class="btn btn-primary btn-sm" data-register="${escapeAttr(ev.id)}">Зарегистрироваться</button>
        </div>
      `;
      els.eventsList.appendChild(card);
    });

    els.eventsList.querySelectorAll("[data-register]").forEach((btn) => {
      btn.addEventListener("click", () => openRegisterModal(btn.getAttribute("data-register")));
    });

    updateStats();
  }

  function pluralRu(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return many;
    if (mod10 === 1) return one;
    if (mod10 >= 2 && mod10 <= 4) return few;
    return many;
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return String(text).replace(/"/g, "&quot;");
  }

  // ============================================
  // Модальное окно регистрации
  // ============================================

  function openRegisterModal(eventId) {
    const ev = events.find((e) => e.id === eventId);
    if (!ev) return;

    els.registerEventId.value = eventId;
    els.modalEventName.textContent = ev.title;
    els.formRegister.classList.remove("hidden");
    els.registerSuccess.classList.add("hidden");
    els.formRegister.reset();
    els.registerEventId.value = eventId;
    clearErrors("reg-");

    els.modalOverlay.classList.remove("hidden");
    els.modalOverlay.setAttribute("aria-hidden", "false");
    // Следующий кадр — чтобы сработала анимация появления (без display:none)
    requestAnimationFrame(() => {
      els.modalOverlay.classList.add("is-open");
    });
    document.getElementById("reg-name").focus();
  }

  function closeRegisterModal() {
    els.modalOverlay.classList.remove("is-open");
    els.modalOverlay.setAttribute("aria-hidden", "true");
    setTimeout(() => {
      els.modalOverlay.classList.add("hidden");
      els.formRegister.classList.remove("hidden");
      els.registerSuccess.classList.add("hidden");
    }, 280);
  }

  function showRegisterSuccess() {
    els.formRegister.classList.add("hidden");
    els.registerSuccess.classList.remove("hidden");
  }

  // ============================================
  // События форм
  // ============================================

  els.formCreate.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateCreateForm()) return;

    const newEvent = {
      id: generateId(),
      title: document.getElementById("event-title").value.trim(),
      date: document.getElementById("event-date").value,
      description: document.getElementById("event-desc").value.trim(),
      registrations: [],
    };

    events.push(newEvent);
    saveEvents();
    renderEvents();
    els.formCreate.reset();
    clearErrors("event-");

    // Плавный скролл к списку
    document.getElementById("events").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.formRegister.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!validateRegisterForm()) return;

    const eventId = els.registerEventId.value;
    const ev = events.find((item) => item.id === eventId);
    if (!ev) return;

    if (!ev.registrations) ev.registrations = [];

    ev.registrations.push({
      name: document.getElementById("reg-name").value.trim(),
      phone: document.getElementById("reg-phone").value.trim(),
      email: document.getElementById("reg-email").value.trim(),
      at: new Date().toISOString(),
    });

    saveEvents();
    renderEvents();
    showRegisterSuccess();
  });

  // ============================================
  // Навигация (бургер)
  // ============================================

  if (els.navToggle && els.navMenu) {
    els.navToggle.addEventListener("click", () => {
      const open = els.navToggle.getAttribute("aria-expanded") === "true";
      els.navToggle.setAttribute("aria-expanded", String(!open));
      els.navMenu.classList.toggle("is-open", !open);
    });

    els.navMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        els.navToggle.setAttribute("aria-expanded", "false");
        els.navMenu.classList.remove("is-open");
      });
    });
  }

  els.modalClose.addEventListener("click", closeRegisterModal);
  els.modalDone.addEventListener("click", closeRegisterModal);

  els.modalOverlay.addEventListener("click", (e) => {
    if (e.target === els.modalOverlay) closeRegisterModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && els.modalOverlay.classList.contains("is-open")) {
      closeRegisterModal();
    }
  });

  // ============================================
  // Инициализация
  // ============================================

  events = loadEvents();
  if (els.year) els.year.textContent = String(new Date().getFullYear());
  renderEvents();
})();
