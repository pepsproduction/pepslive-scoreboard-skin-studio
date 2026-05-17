import { DEFAULT_DISPLAY_OPTIONS, generatePortableOverlayUrl } from "./utils.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#96;");
}

export class TemplateGallery {
  constructor({ root, templates, onPreview, onUse, onFavorite, onCopyUrl, onAddSource }) {
    this.root = root;
    this.templates = templates || [];
    this.handlers = { onPreview, onUse, onFavorite, onCopyUrl, onAddSource };
    this.favorites = [];
    this.recentlyUsed = [];
    this.selectedTemplateId = "";
    this.previewContext = {
      theme: {},
      displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
      eventLogo: ""
    };
    this.filters = {
      sport: "all",
      type: "all",
      styleTag: "all",
      list: "All",
      search: ""
    };
  }

  setCollections({ favorites, recentlyUsed }) {
    this.favorites = favorites || [];
    this.recentlyUsed = recentlyUsed || [];
    this.render();
  }

  setSelectedTemplateId(templateId) {
    this.selectedTemplateId = templateId || "";
    this.render();
  }

  setPreviewContext(context = {}, { refreshFrames = false } = {}) {
    this.previewContext = {
      ...this.previewContext,
      ...context,
      displayOptions: { ...DEFAULT_DISPLAY_OPTIONS, ...(context.displayOptions || this.previewContext.displayOptions || {}) }
    };
    if (refreshFrames) {
      this.refreshThumbnailFrames();
    }
  }

  setFilter(nextFilter) {
    this.filters = { ...this.filters, ...nextFilter };
    this.render();
  }

  buildThumbnailUrl(template) {
    return generatePortableOverlayUrl({
      skinId: template.id,
      type: template.type,
      sport: template.sport,
      animationStyle: "none",
      theme: this.previewContext.theme || {},
      displayOptions: this.previewContext.displayOptions || DEFAULT_DISPLAY_OPTIONS,
      eventLogo: this.previewContext.eventLogo || "",
      cacheBust: false,
      isolated: true,
      absolute: false
    }).url;
  }

  refreshThumbnailFrames() {
    this.root?.querySelectorAll(".template-card[data-template-id] .thumb-frame").forEach((frame) => {
      const templateId = frame.closest(".template-card")?.dataset.templateId;
      const template = this.templates.find((item) => item.id === templateId);
      if (!template) {
        return;
      }
      const nextUrl = this.buildThumbnailUrl(template);
      if (frame.getAttribute("src") !== nextUrl) {
        frame.setAttribute("src", nextUrl);
      }
    });
  }

  filterTemplates() {
    let list = [...this.templates];
    const search = (this.filters.search || "").trim().toLowerCase();

    if (this.filters.sport !== "all") {
      list = list.filter((item) => item.sport === this.filters.sport);
    }

    if (this.filters.type !== "all") {
      list = list.filter((item) => item.type === this.filters.type);
    }

    if (this.filters.styleTag !== "all") {
      list = list.filter((item) => item.tags.includes(this.filters.styleTag));
    }

    if (this.filters.list === "Favorites") {
      list = list.filter((item) => this.favorites.includes(item.id));
    }

    if (this.filters.list === "Recently Used") {
      list = list.filter((item) => this.recentlyUsed.includes(item.id));
      list.sort((a, b) => this.recentlyUsed.indexOf(a.id) - this.recentlyUsed.indexOf(b.id));
    }

    if (search) {
      list = list.filter((item) => {
        const haystack = [
          item.id,
          item.name,
          item.description,
          item.sport,
          item.type,
          ...(item.tags || []),
          ...(item.compatibleModes || [])
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    return list;
  }

  render() {
    if (!this.root) {
      return;
    }

    const filtered = this.filterTemplates();
    const searchValue = escapeAttribute(this.filters.search || "");

    this.root.innerHTML = `
      <section class="gallery-shell">
        <div class="gallery-head">
          <div>
            <h2>Template Gallery</h2>
            <p>Search by ID, name, description, or tag. Preview the skin before you publish it.</p>
          </div>
          <div class="gallery-meta">
            <div class="gallery-count">${filtered.length} templates</div>
            <div class="gallery-total">of ${this.templates.length}</div>
          </div>
        </div>

        <div class="gallery-search-row">
          <label class="gallery-search">
            <span>Search templates</span>
            <input
              type="search"
              class="ui-select gallery-search-input"
              data-role="gallery-search"
              placeholder="Search ID, name, tag..."
              value="${searchValue}"
            />
          </label>
          <div class="gallery-search-help">
            Try <code>FB-LIVE-01</code>, <code>Neon</code>, <code>Glass</code>, or <code>Broadcast</code>.
          </div>
        </div>

        <div class="template-grid">
          ${
            filtered.length === 0
              ? `<div class="empty-state">
                  <strong>No templates found.</strong>
                  <span>Try clearing a filter or searching with a different keyword.</span>
                </div>`
              : filtered
                  .map((template) => {
                    const isFavorite = this.favorites.includes(template.id);
                    const isSelected = this.selectedTemplateId === template.id;
                    const source = template.recommendedSource || { width: 900, height: 180 };
                    const thumbUrl = this.buildThumbnailUrl(template);
                    const thumbRatio = `${source.width} / ${source.height}`;
                    return `
                      <article
                        class="template-card ${isSelected ? "is-selected" : ""}"
                        data-template-id="${template.id}"
                        tabindex="0"
                        aria-current="${isSelected ? "true" : "false"}"
                      >
                        <div class="template-thumb real-template-thumb skin-thumb-${template.sport} skin-thumb-${template.type} skin-thumb-${template.id}" style="--thumb-aspect-ratio: ${thumbRatio}">
                          <div class="thumb-topline">
                            <span class="badge sport">${escapeHtml(template.sport)}</span>
                            <span class="badge type">${escapeHtml(template.type)}</span>
                          </div>
                          <div class="thumb-source-window" style="--source-aspect-ratio: ${thumbRatio}">
                            <iframe class="thumb-frame" src="${escapeAttribute(thumbUrl)}" title="${escapeAttribute(template.id)} preview" loading="lazy" tabindex="-1" aria-hidden="true"></iframe>
                          </div>
                          <div class="thumb-caption">
                            <span class="thumb-code">${escapeHtml(template.id)}</span>
                            <span class="thumb-name">${escapeHtml(template.name)}</span>
                          </div>
                          ${isSelected ? '<span class="selected-ribbon">Selected</span>' : ""}
                        </div>
                        <div class="template-meta">
                          <div class="template-title-row">
                            <h3>${escapeHtml(template.name)}</h3>
                            <span class="badge size">${source.width} x ${source.height}</span>
                          </div>
                          <p class="template-id">${escapeHtml(template.id)}</p>
                          <p class="template-desc">${escapeHtml(template.description)}</p>
                          <div class="tag-row">
                            ${template.tags.map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join("")}
                          </div>
                          <div class="template-spec">
                            <span>${source.width} x ${source.height} source</span>
                            <span>${template.compatibleModes?.length || 0} compatible modes</span>
                          </div>
                        </div>
                        <div class="card-actions">
                          <button type="button" class="capsule-btn tiny primary" data-action="use">Use</button>
                          <button type="button" class="capsule-btn tiny" data-action="preview">Customize</button>
                          <button type="button" class="capsule-btn tiny ${isFavorite ? "is-fav" : ""}" data-action="favorite">
                            ${isFavorite ? "Saved" : "Fav"}
                          </button>
                          <button type="button" class="capsule-btn tiny" data-action="copy">Copy</button>
                        </div>
                      </article>
                    `;
                  })
                  .join("")
          }
        </div>
      </section>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const searchInput = this.root.querySelector('[data-role="gallery-search"]');
    searchInput?.addEventListener("input", () => {
      const selectionStart = searchInput.selectionStart ?? searchInput.value.length;
      const selectionEnd = searchInput.selectionEnd ?? searchInput.value.length;
      this.filters = { ...this.filters, search: searchInput.value };
      this.render();
      window.requestAnimationFrame(() => {
        const nextSearchInput = this.root.querySelector('[data-role="gallery-search"]');
        if (!nextSearchInput) {
          return;
        }
        nextSearchInput.focus({ preventScroll: true });
        try {
          nextSearchInput.setSelectionRange(selectionStart, selectionEnd);
        } catch (_error) {
          // Some browsers do not allow selection changes on search inputs.
        }
      });
    });

    this.root.querySelectorAll(".template-card").forEach((card) => {
      const templateId = card.dataset.templateId;
      const template = this.templates.find((item) => item.id === templateId);
      if (!template) {
        return;
      }

      const triggerPreview = () => {
        this.selectedTemplateId = template.id;
        this.handlers.onPreview?.(template);
      };

      card.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (button) {
          return;
        }
        triggerPreview();
      });

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          triggerPreview();
        }
      });

      card.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const action = button.dataset.action;
          if (action === "preview") {
            this.selectedTemplateId = template.id;
            this.handlers.onPreview?.(template);
            return;
          }
          if (action === "use") {
            this.selectedTemplateId = template.id;
            this.handlers.onUse?.(template);
            return;
          }
          if (action === "favorite") {
            this.handlers.onFavorite?.(template);
            return;
          }
          if (action === "copy") {
            this.handlers.onCopyUrl?.(template, button);
            return;
          }
          if (action === "add") {
            this.handlers.onAddSource?.(template);
          }
        });
      });

      card.addEventListener("dblclick", () => {
        this.selectedTemplateId = template.id;
        this.handlers.onUse?.(template);
      });
    });
  }
}
