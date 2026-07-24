let controlSequence = 0;
const controllers = new Set();

export function enhanceSelect(select, { compact = false } = {}) {
  if (!select || select.dataset.menuEnhanced === "true") return null;
  select.dataset.menuEnhanced = "true";
  const id = select.id || `menu-select-${++controlSequence}`;
  const menuId = `${id}-listbox`;
  const wrapper = document.createElement("div");
  wrapper.className = `select-control${compact ? " compact" : ""}`;
  select.before(wrapper);
  wrapper.append(select);
  select.hidden = true;

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "select-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", select.getAttribute("aria-label") || labelFor(select) || "Select option");
  trigger.disabled = select.disabled;
  wrapper.append(trigger);

  const menu = document.createElement("div");
  menu.id = menuId;
  menu.className = "select-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", trigger.getAttribute("aria-label"));
  menu.hidden = true;
  (select.closest("dialog") || document.body).append(menu);

  let activeIndex = -1;
  const options = () => [...select.options];
  const renderTrigger = () => {
    const selected = select.selectedOptions[0];
    trigger.innerHTML = `<span>${escapeText(selected?.textContent || "Select")}</span>${chevronIcon()}`;
  };
  const renderMenu = () => {
    menu.innerHTML = options().map((option, index) => menuOption({
      id: `${menuId}-option-${index}`,
      label: option.textContent,
      meta: "",
      selected: option.value === select.value,
      active: index === activeIndex,
      disabled: option.disabled,
      index
    })).join("");
    menu.querySelectorAll("[data-menu-index]").forEach((button) => {
      const index = Number(button.dataset.menuIndex);
      button.addEventListener("pointerenter", () => { if (!options()[index]?.disabled) setActive(index); });
      button.addEventListener("click", () => choose(index));
    });
  };
  const setActive = (index) => {
    activeIndex = index;
    menu.querySelectorAll("[data-menu-index]").forEach((button) => button.classList.toggle("active", Number(button.dataset.menuIndex) === activeIndex));
    if (activeIndex >= 0) trigger.setAttribute("aria-activedescendant", `${menuId}-option-${activeIndex}`);
    else trigger.removeAttribute("aria-activedescendant");
  };
  const choose = (index) => {
    const option = options()[index];
    if (!option || option.disabled) return;
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    close();
    trigger.focus();
  };
  const open = () => {
    if (trigger.disabled) return;
    activeIndex = Math.max(0, select.selectedIndex);
    renderMenu();
    setActive(activeIndex);
    positionMenu(menu, trigger, options().length);
    menu.hidden = false;
    trigger.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    trigger.setAttribute("aria-controls", menuId);
    bindOpenListeners();
  };
  const close = () => {
    menu.hidden = true;
    trigger.classList.remove("open");
    trigger.setAttribute("aria-expanded", "false");
    trigger.removeAttribute("aria-controls");
    trigger.removeAttribute("aria-activedescendant");
    unbindOpenListeners();
  };
  const onOutside = (event) => { if (!wrapper.contains(event.target) && !menu.contains(event.target)) close(); };
  const onViewportChange = () => { if (!menu.hidden) positionMenu(menu, trigger, options().length); };
  const bindOpenListeners = () => {
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
  };
  const unbindOpenListeners = () => {
    document.removeEventListener("pointerdown", onOutside, true);
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("scroll", onViewportChange, true);
  };

  trigger.addEventListener("click", () => menu.hidden ? open() : close());
  trigger.addEventListener("keydown", (event) => handleSelectKeydown(event, { menu, options: options(), activeIndex, setActive, open, close, choose }));
  select.addEventListener("change", () => { renderTrigger(); if (!menu.hidden) renderMenu(); });
  renderTrigger();
  const controller = { root: wrapper, close, destroy: () => { close(); menu.remove(); controllers.delete(controller); } };
  controllers.add(controller);
  return { close, trigger };
}

export function enhanceCombobox(input, items) {
  if (!input || input.dataset.menuEnhanced === "true") return null;
  input.dataset.menuEnhanced = "true";
  const id = input.id || `menu-combobox-${++controlSequence}`;
  const menuId = `${id}-listbox`;
  const wrapper = input.parentElement;
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "combobox-clear";
  clear.setAttribute("aria-label", "Clear workspace filter");
  clear.innerHTML = clearIcon();
  clear.hidden = true;
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "combobox-toggle";
  toggle.setAttribute("aria-label", "Show workspace suggestions");
  toggle.setAttribute("aria-expanded", "false");
  toggle.innerHTML = chevronIcon();
  wrapper.append(clear, toggle);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  const menu = document.createElement("div");
  menu.id = menuId;
  menu.className = "select-menu combobox-menu";
  menu.setAttribute("role", "listbox");
  menu.setAttribute("aria-label", "Workspace suggestions");
  menu.hidden = true;
  document.body.append(menu);
  let activeIndex = -1;
  const syncClear = () => {
    const hasValue = Boolean(input.value);
    clear.hidden = !hasValue;
    wrapper.classList.toggle("has-value", hasValue);
  };

  const matches = () => {
    const query = input.value.trim().toLowerCase();
    return items.filter((item) => !query || [item.name, item.id].some((value) => String(value || "").toLowerCase().includes(query))).slice(0, 8);
  };
  const renderMenu = () => {
    const visible = matches();
    menu.innerHTML = visible.length ? visible.map((item, index) => menuOption({
      id: `${menuId}-option-${index}`,
      label: item.name,
      meta: item.id,
      selected: input.value.trim().toLowerCase() === String(item.name).toLowerCase(),
      active: index === activeIndex,
      index
    })).join("") : '<p class="menu-empty">No matching workspaces</p>';
    menu.querySelectorAll("[data-menu-index]").forEach((button) => {
      const index = Number(button.dataset.menuIndex);
      button.addEventListener("pointerenter", () => setActive(index));
      button.addEventListener("click", () => choose(index));
    });
    return visible;
  };
  const setActive = (index) => {
    activeIndex = index;
    menu.querySelectorAll("[data-menu-index]").forEach((button) => button.classList.toggle("active", Number(button.dataset.menuIndex) === activeIndex));
    if (activeIndex >= 0) input.setAttribute("aria-activedescendant", `${menuId}-option-${activeIndex}`);
    else input.removeAttribute("aria-activedescendant");
  };
  const choose = (index) => {
    const item = matches()[index];
    if (!item) return;
    input.value = item.name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    close();
    input.focus();
  };
  const open = () => {
    activeIndex = 0;
    const visible = renderMenu();
    setActive(visible.length ? activeIndex : -1);
    positionMenu(menu, input, Math.max(1, visible.length));
    menu.hidden = false;
    input.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-controls", menuId);
    wrapper.classList.add("menu-open");
    toggle.classList.add("open");
    toggle.setAttribute("aria-expanded", "true");
    bindOpenListeners();
  };
  const close = () => {
    menu.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-controls");
    input.removeAttribute("aria-activedescendant");
    wrapper.classList.remove("menu-open");
    toggle.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    unbindOpenListeners();
  };
  const onOutside = (event) => { if (!wrapper.contains(event.target) && !menu.contains(event.target)) close(); };
  const onViewportChange = () => { if (!menu.hidden) positionMenu(menu, input, Math.max(1, matches().length)); };
  const bindOpenListeners = () => {
    document.addEventListener("pointerdown", onOutside, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", onViewportChange, true);
  };
  const unbindOpenListeners = () => {
    document.removeEventListener("pointerdown", onOutside, true);
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("scroll", onViewportChange, true);
  };

  input.addEventListener("input", () => { syncClear(); open(); });
  input.addEventListener("click", () => { if (menu.hidden) open(); });
  input.addEventListener("keydown", (event) => {
    const visible = matches();
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (menu.hidden) open();
      else setActive(getNextEnabledIndex(visible, activeIndex, event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && !menu.hidden && visible[activeIndex]) { event.preventDefault(); choose(activeIndex); }
    else if (event.key === "Escape") { event.preventDefault(); close(); }
    else if (event.key === "Tab") close();
  });
  clear.addEventListener("click", () => {
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  });
  toggle.addEventListener("click", () => { if (menu.hidden) { open(); input.focus(); } else close(); });
  syncClear();
  const controller = { root: wrapper, close, destroy: () => { close(); menu.remove(); controllers.delete(controller); } };
  controllers.add(controller);
  return { close, toggle };
}

export function cleanupMenuControls(container) {
  [...controllers].forEach((controller) => {
    if (!controller.root.isConnected || container?.contains(controller.root)) controller.destroy();
  });
}

export function getBoundaryEnabledIndex(options, boundary = "first") {
  const indexes = options.map((_, index) => index);
  if (boundary === "last") indexes.reverse();
  return indexes.find((index) => !options[index]?.disabled) ?? -1;
}

export function getNextEnabledIndex(options, currentIndex, direction) {
  if (!options.length || options.every((option) => option.disabled)) return -1;
  let next = currentIndex;
  for (let step = 0; step < options.length; step += 1) {
    next = (next + direction + options.length) % options.length;
    if (!options[next]?.disabled) return next;
  }
  return -1;
}

function handleSelectKeydown(event, controls) {
  const { menu, options, open, close, choose, setActive } = controls;
  let { activeIndex } = controls;
  if (menu.hidden && ["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].includes(event.key)) {
    event.preventDefault();
    open();
    if (event.key === "ArrowUp" || event.key === "End") setActive(getBoundaryEnabledIndex(options, "last"));
    else if (event.key === "Home") setActive(getBoundaryEnabledIndex(options));
    return;
  }
  if (menu.hidden) return;
  if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setActive(getNextEnabledIndex(options, activeIndex, event.key === "ArrowDown" ? 1 : -1)); }
  else if (event.key === "Home" || event.key === "End") { event.preventDefault(); setActive(getBoundaryEnabledIndex(options, event.key === "End" ? "last" : "first")); }
  else if (event.key === "Enter" || event.key === " ") { event.preventDefault(); choose(activeIndex); }
  else if (event.key === "Escape") { event.preventDefault(); close(); }
  else if (event.key === "Tab") close();
}

function positionMenu(menu, trigger, optionCount) {
  const rect = trigger.getBoundingClientRect();
  const width = Math.min(Math.max(rect.width, 160), window.innerWidth - 16);
  const height = Math.min(256, Math.max(44, optionCount * 40 + 8));
  const spaceBelow = window.innerHeight - rect.bottom;
  const openAbove = spaceBelow < height + 6 && rect.top > spaceBelow;
  menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
  menu.style.top = `${openAbove ? Math.max(8, rect.top - height - 6) : rect.bottom + 6}px`;
  menu.style.width = `${width}px`;
}

function menuOption({ id, label, meta, selected, active, disabled = false, index }) {
  return `<button id="${id}" class="menu-option${selected ? " selected" : ""}${active ? " active" : ""}" type="button" role="option" aria-selected="${selected}"${disabled ? ' aria-disabled="true" disabled' : ""} data-menu-index="${index}"><span class="menu-option-copy"><span>${escapeText(label)}</span>${meta ? `<small>${escapeText(meta)}</small>` : ""}</span>${selected ? checkIcon() : ""}</button>`;
}

function labelFor(select) { return select.id ? document.querySelector(`label[for="${CSS.escape(select.id)}"]`)?.textContent.trim() : ""; }
function chevronIcon() { return '<svg class="select-chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>'; }
function clearIcon() { return '<svg class="combobox-clear-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m18 6-12 12M6 6l12 12"/></svg>'; }
function checkIcon() { return '<svg class="menu-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12 3 3 7-7"/></svg>'; }
function escapeText(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
