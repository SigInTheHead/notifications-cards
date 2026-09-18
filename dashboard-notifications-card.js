/* Dashboard Notifications Lovelace card. No build step is required. */
const DOMAIN = "dashboard_notifications";
const DEFAULT_ICONS = {
  info: "mdi:information-outline",
  success: "mdi:check-circle-outline",
  warning: "mdi:alert-outline",
  error: "mdi:alert-circle-outline",
};
const CARD_STYLES = `<style>
  dashboard-notifications-card .feed { padding: 8px; }
  dashboard-notifications-card .item {
    --notification-accent: var(--primary-color);
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;
    margin: 4px 0;
    padding: 12px 8px 12px 12px;
    border-left: 4px solid var(--notification-accent);
    border-radius: 8px;
    background: var(--secondary-background-color, rgba(127, 127, 127, 0.08));
  }
  dashboard-notifications-card .severity-info { --notification-accent: var(--dashboard-notifications-info-color, var(--primary-color)); }
  dashboard-notifications-card .severity-success { --notification-accent: var(--dashboard-notifications-success-color, var(--success-color, #43a047)); }
  dashboard-notifications-card .severity-warning { --notification-accent: var(--dashboard-notifications-warning-color, var(--warning-color, #f9a825)); }
  dashboard-notifications-card .severity-error { --notification-accent: var(--dashboard-notifications-error-color, var(--error-color, #db4437)); }
  dashboard-notifications-card .notification-icon {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    color: var(--notification-accent);
    background: var(--card-background-color);
  }
  dashboard-notifications-card .notification-icon ha-icon { --mdc-icon-size: 21px; }
  dashboard-notifications-card .body { min-width: 0; padding-top: 1px; }
  dashboard-notifications-card .title { color: var(--primary-text-color); font-weight: 600; line-height: 1.35; }
  dashboard-notifications-card .message { margin-top: 3px; color: var(--primary-text-color); line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere; }
  dashboard-notifications-card time { display: block; margin-top: 7px; color: var(--secondary-text-color); font-size: 0.78rem; line-height: 1; }
  dashboard-notifications-card .item-actions {
    display: flex;
    gap: 4px;
    align-items: center;
    align-self: center;
  }
  dashboard-notifications-card .dismiss,
  dashboard-notifications-card .feed-action {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 0;
    border-radius: 50%;
    color: var(--secondary-text-color);
    background: transparent;
    cursor: pointer;
  }
  dashboard-notifications-card .dismiss:hover,
  dashboard-notifications-card .feed-action:hover { color: var(--primary-text-color); background: var(--divider-color); }
  dashboard-notifications-card .dismiss,
  dashboard-notifications-card .feed-action {
    color: var(--notification-accent);
    background: var(--card-background-color);
  }
  dashboard-notifications-card .dismiss:hover,
  dashboard-notifications-card .feed-action:hover {
    color: var(--notification-accent);
    background: var(--card-background-color);
    filter: brightness(1.1);
  }
  dashboard-notifications-card .dismiss ha-icon,
  dashboard-notifications-card .feed-action ha-icon { --mdc-icon-size: 20px; }
  dashboard-notifications-card .empty { padding: 28px 16px; color: var(--secondary-text-color); text-align: center; }
  dashboard-notifications-card .error { color: var(--error-color); }
  @media (max-width: 420px) {
    dashboard-notifications-card .feed { padding: 6px; }
    dashboard-notifications-card .item { gap: 8px; padding: 10px 4px 10px 10px; }
  }
</style>`;

class DashboardNotificationsCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("dashboard-notifications-card-editor");
  }

  static getStubConfig() {
    return { topics: [], order: "newest" };
  }

  setConfig(config) {
    if (!Array.isArray(config.topics) || config.topics.length === 0) {
      throw new Error("Dashboard Notifications card requires at least one topic");
    }
    this._config = { order: "newest", hide_when_empty: false, show_timestamp: true, ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._subscribe();
    this._render();
  }

  disconnectedCallback() {
    this._unsubscribe?.();
    this._unsubscribe = undefined;
  }

  async _subscribe() {
    if (!this._hass?.connection || this._subscribed) return;
    this._subscribed = true;
    try {
      // A subscription only supplies later changes; fetch the current feed first.
      this._feed = await this._hass.callWS({ type: `${DOMAIN}/list` });
      this._render();
      this._unsubscribe = await this._hass.connection.subscribeMessage(
        (event) => {
          this._feed = event.event || event;
          this._render();
        },
        { type: `${DOMAIN}/subscribe` },
      );
    } catch (error) {
      this._error = error;
      this._render();
    }
  }

  _items() {
    if (!this._feed || !this._config) return [];
    const topicSet = new Set(this._config.topics);
    return this._feed.items
      .filter((item) => topicSet.has(item.topic))
      .sort((a, b) => {
        const comparison = new Date(a.created_at) - new Date(b.created_at);
        return this._config.order === "oldest" ? comparison : -comparison;
      });
  }

  _render() {
    if (!this._config) return;
    this._removeWrapperSurface();
    this._setSeverityColors();
    const items = this._items();
    const shouldHide = this._config.hide_when_empty && this._feed && !this._error && items.length === 0;
    this._setVisibility(shouldHide);
    if (shouldHide) {
      this.replaceChildren();
      return;
    }
    const title = this._config.title ? `<h1 class="card-header">${this._escape(this._config.title)}</h1>` : "";
    const content = this._error
      ? `<div class="empty">Unable to load notification feed.</div>`
      : items.length
        ? items.map((item) => this._item(item)).join("")
        : `<div class="empty">No notifications</div>`;
    this.innerHTML = `${CARD_STYLES}${title}<div class="feed">${content}</div>`;
    this.querySelectorAll("button[data-id]").forEach((button) => {
      button.addEventListener("click", () => this._dismiss(button.dataset.id));
    });
    this.querySelectorAll("button[data-action-index]").forEach((button) => {
      button.addEventListener("click", () => this._runAction(
        button.dataset.notificationId,
        Number(button.dataset.actionIndex),
        button,
      ));
    });
  }

  _item(item) {
    const iconName = item.icon || DEFAULT_ICONS[item.severity] || DEFAULT_ICONS.info;
    const icon = `<ha-icon icon="${this._escape(iconName)}"></ha-icon>`;
    const title = item.title ? `<div class="title">${this._escape(item.title)}</div>` : "";
    const created = this._config.show_timestamp
      ? `<time>${new Intl.DateTimeFormat(undefined, { dateStyle: "short", timeStyle: "short" }).format(new Date(item.created_at))}</time>`
      : "";
    const actions = Array.isArray(item.actions)
      ? item.actions.map((action, index) => `<button class="feed-action" data-notification-id="${this._escape(item.id)}" data-action-index="${index}" title="${this._escape(action.label)}" aria-label="${this._escape(action.label)}"><ha-icon icon="${this._escape(action.icon)}"></ha-icon></button>`).join("")
      : "";
    const dismiss = item.persistent ? "" : `<button class="dismiss" data-id="${this._escape(item.id)}" aria-label="Dismiss notification" title="Dismiss notification"><ha-icon icon="mdi:close"></ha-icon></button>`;
    const itemActions = actions || dismiss ? `<div class="item-actions">${actions}${dismiss}</div>` : "";
    const topicColor = item.topic_color ? ` style="--notification-accent: ${this._escape(item.topic_color)}"` : "";
    return `<article class="item ${item.persistent ? "persistent " : ""}severity-${this._escape(item.severity || "info")}"${topicColor}>
      <div class="notification-icon">${icon}</div><div class="body">${title}<div class="message">${this._escape(item.message)}</div>${created}</div>
      ${itemActions}
    </article>`;
  }

  _dismiss(id) {
    this._callService(DOMAIN, "dismiss", { id })
      .catch((error) => this._showActionError("Dismiss notification", error));
  }

  async _runAction(notificationId, index, button) {
    const item = this._feed?.items?.find((candidate) => candidate.id === notificationId);
    const action = item?.actions?.[index];
    if (!action || typeof action.action !== "string") return;
    const [domain, service] = action.action.split(".", 2);
    if (!domain || !service) return;
    const actionKey = `${notificationId}:${index}`;
    if (this._runningActions?.has(actionKey)) return;
    this._runningActions ??= new Set();
    this._runningActions.add(actionKey);
    button.disabled = true;
    try {
      await this._callService(domain, service, action.data || {}, action.target);
      if (action.dismiss) await this._callService(DOMAIN, "dismiss", { id: notificationId });
    } catch (error) {
      this._showActionError(action.label, error);
    } finally {
      this._runningActions.delete(actionKey);
      button.disabled = false;
    }
  }

  async _callService(domain, service, serviceData = {}, target) {
    // `callWS` provides an explicit result for each service call. Keeping the
    // calls here also lets a post-action dismissal wait for the requested
    // action to finish rather than racing it through the frontend wrapper.
    if (this._hass?.callWS) {
      const command = {
        type: "call_service",
        domain,
        service,
        service_data: serviceData,
      };
      if (target && Object.keys(target).length) command.target = target;
      return this._hass.callWS(command);
    }
    return this._hass.callService(domain, service, serviceData, target);
  }

  _showActionError(label, error) {
    this.dispatchEvent(new CustomEvent("hass-notification", {
      bubbles: true,
      composed: true,
      detail: { message: `Could not run “${label}”: ${error?.message || error}` },
    }));
  }

  _setVisibility(hidden) {
    // In the Sections dashboard layout, this custom element sits inside a
    // hui-card grid item. Hiding only the element leaves that grid item (and
    // its gap) behind, so hide the wrapper when present as well.
    const wrapper = this.closest("hui-card");
    if (wrapper && wrapper !== this) {
      if (hidden && this._visibilityWrapper !== wrapper) {
        this._visibilityWrapper = wrapper;
        this._previousWrapperDisplay = wrapper.style.display;
      }
      if (this._visibilityWrapper === wrapper) {
        wrapper.style.display = hidden ? "none" : this._previousWrapperDisplay;
        if (!hidden) this._visibilityWrapper = undefined;
      }
    }
    this.style.display = hidden && !wrapper ? "none" : "";
  }

  _removeWrapperSurface() {
    // Sections dashboards wrap custom cards in hui-card. Its shadow-root
    // ha-card owns the remaining surface, so override its inherited tokens.
    const wrapper = this.closest("hui-card");
    if (!wrapper) return;
    wrapper.style.setProperty("--ha-card-background", "transparent");
    wrapper.style.setProperty("--ha-card-border-width", "0");
    wrapper.style.setProperty("--ha-card-border-color", "transparent");
    wrapper.style.setProperty("--ha-card-box-shadow", "none");
  }

  _setSeverityColors() {
    const colors = this._feed?.severity_colors || {};
    for (const severity of ["info", "success", "warning", "error"]) {
      const property = `--dashboard-notifications-${severity}-color`;
      if (typeof colors[severity] === "string") this.style.setProperty(property, colors[severity]);
      else this.style.removeProperty(property);
    }
  }

  _escape(value) {
    const node = document.createElement("span");
    node.textContent = String(value);
    return node.innerHTML;
  }

  getCardSize() {
    if (this._config?.hide_when_empty && this._feed && this._items().length === 0) return 0;
    return Math.max(1, this._items().length);
  }

  static get styles() { return ""; }
}

class DashboardNotificationsCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { order: "newest", hide_when_empty: false, show_timestamp: true, topics: [], ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._loadTopics();
  }

  async _loadTopics() {
    if (!this._hass) return;
    try {
      this._feed = await this._hass.callWS({ type: `${DOMAIN}/list` });
    } catch (_) {
      this._feed = { topics: [] };
    }
    this._render();
  }

  _render() {
    if (!this._config || !this._feed) return;

    if (this._feed.topics.length === 0) {
      this.innerHTML = "<ha-alert alert-type=\"warning\">Create a topic in the Dashboard Notifications integration before configuring this card.</ha-alert>";
      return;
    }

    this.replaceChildren();
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._config;
    form.schema = [
      { name: "title", selector: { text: {} } },
      {
        name: "topics",
        required: true,
        selector: {
          select: {
            multiple: true,
            options: this._feed.topics.map((topic) => ({ label: topic.name, value: topic.id })),
          },
        },
      },
      {
        name: "order",
        required: true,
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { label: "Newest first", value: "newest" },
              { label: "Oldest first", value: "oldest" },
            ],
          },
        },
      },
      { name: "hide_when_empty", selector: { boolean: {} } },
      { name: "show_timestamp", selector: { boolean: {} } },
    ];
    form.computeLabel = (schema) => ({
      title: "Title",
      topics: "Topics",
      order: "Order",
      hide_when_empty: "Hide when empty",
      show_timestamp: "Show timestamp",
    })[schema.name];
    form.addEventListener("value-changed", (event) => this._changed(event.detail.value));
    this.appendChild(form);
  }

  _changed(change) {
    this._config = { ...this._config, ...change };
    this.dispatchEvent(new CustomEvent("config-changed", {
      detail: { config: this._config }, bubbles: true, composed: true,
    }));
  }
}

customElements.define("dashboard-notifications-card", DashboardNotificationsCard);
customElements.define("dashboard-notifications-card-editor", DashboardNotificationsCardEditor);
window.customCards = window.customCards || [];
window.customCards.push({ type: "dashboard-notifications-card", name: "Dashboard Notifications", description: "A filtered view of the Dashboard Notifications feed." });
