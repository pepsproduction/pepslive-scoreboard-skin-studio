export class TemplateGallery {
  constructor({ root, templates, onPreview, onUse, onFavorite, onCopyUrl, onAddSource }) {
    this.root = root;
    this.templates = templates || [];
    this.handlers = { onPreview, onUse, onFavorite, onCopyUrl, onAddSource };
    this.favorites = [];
    this.recentlyUsed = [];
    this.filters = {
      sport: "all",
      type: "all",
      styleTag: "all",
      list: "All"
    };
  }

  setCollections({ favorites, recentlyUsed }) {
    this.favorites = favorites || [];
    this.recentlyUsed = recentlyUsed || [];
    this.render();
  }

  setFilter(nextFilter) {
    this.filters = { ...this.filters, ...nextFilter };
    this.render();
  }

  filterTemplates() {
    let list = [...this.templates];

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

    return list;
  }

  render() {
    if (!this.root) {
      return;
    }

    const filtered = this.filterTemplates();
    this.root.innerHTML = `
      <div class="gallery-head">
        <h2>Template Gallery</h2>
        <span>${filtered.length} / ${this.templates.length} templates</span>
      </div>
      <div class="template-grid">
        ${
          filtered.length === 0
            ? `<div class="empty-state">ไม่พบ template ที่ตรงกับตัวกรองที่เลือก</div>`
            : filtered
                .map((template) => {
                  const isFavorite = this.favorites.includes(template.id);
                  return `
                  <article class="template-card" data-template-id="${template.id}" tabindex="0">
                    <div class="template-thumb skin-thumb-${template.sport} skin-thumb-${template.type}">
                      <span class="thumb-code">${template.id}</span>
                      <span class="thumb-name">${template.name}</span>
                    </div>
                    <div class="template-meta">
                      <h3>${template.name}</h3>
                      <p class="template-id">${template.id}</p>
                      <p class="template-desc">${template.description}</p>
                      <div class="tag-row">
                        ${template.tags.map((tag) => `<span class="tag-pill">${tag}</span>`).join("")}
                      </div>
                    </div>
                    <div class="card-actions">
                      <button type="button" class="capsule-btn tiny" data-action="preview">Preview</button>
                      <button type="button" class="capsule-btn tiny primary" data-action="use">Use Skin</button>
                      <button type="button" class="capsule-btn tiny ${isFavorite ? "is-fav" : ""}" data-action="favorite">
                        ${isFavorite ? "Favorited" : "Favorite"}
                      </button>
                      <button type="button" class="capsule-btn tiny" data-action="copy">Copy URL</button>
                      <button type="button" class="capsule-btn tiny" data-action="add">Add Source</button>
                    </div>
                  </article>
                `;
                })
                .join("")
        }
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    this.root.querySelectorAll(".template-card").forEach((card) => {
      const templateId = card.dataset.templateId;
      const template = this.templates.find((item) => item.id === templateId);
      if (!template) {
        return;
      }

      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          this.handlers.onPreview?.(template);
        }
      });

      card.querySelectorAll("button[data-action]").forEach((button) => {
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const action = button.dataset.action;
          if (action === "preview") {
            this.handlers.onPreview?.(template);
            return;
          }
          if (action === "use") {
            this.handlers.onUse?.(template);
            return;
          }
          if (action === "favorite") {
            this.handlers.onFavorite?.(template);
            return;
          }
          if (action === "copy") {
            this.handlers.onCopyUrl?.(template);
            return;
          }
          if (action === "add") {
            this.handlers.onAddSource?.(template);
          }
        });
      });

      card.addEventListener("dblclick", () => {
        this.handlers.onUse?.(template);
      });
    });
  }
}
