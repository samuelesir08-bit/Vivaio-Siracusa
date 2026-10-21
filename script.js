// Evita che Safari riapra il sito a metà pagina o direttamente nel catalogo.
if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}
if (window.location.hash === "#catalogo") {
  history.replaceState(null, "", window.location.pathname + window.location.search);
}
if (window.location.hash === "" || window.location.hash === "#catalogo") {
  window.scrollTo(0, 0);
}

const PHONE = "393925286921";
const sizes = [
  { label: "Vaso 10", price: 10 },
  { label: "Vaso 20 (basso)", price: 20 },
  { label: "Vaso 24", price: 25 },
  { label: "Vaso 35", price: 65 },
  { label: "Vaso 50", price: 200 },
  { label: "Vaso 100", price: 300 }
];

const products = [
  ["Limone Caviale","Limoni"],["Limone Siracusano","Limoni"],["Limone Femminello","Limoni"],["Limone Lunario","Limoni"],["Limone Bergamotto","Limoni"],["Limone Carrubbo","Limoni"],["Limone Amalfitana","Limoni"],["Limone Zagara Bianca","Limoni"],
  ["Arancio Tarocco","Arance"],["Arancio Washington","Arance"],["Arancio Moro","Arance"],["Arancio Navellino","Arance"],["Arancio Valencia","Arance"],["Arancio Calabrese","Arance"],
  ["Clementino Isa","Clementini"],["Clementino Hermand","Clementini"],
  ["Mandarino Marzaiolo","Mandarini"],["Mandarino Tardivo","Mandarini"],
  ["Kounguat","Kumquat"],["LemonKounguat","Kumquat"],["Kounguat Gigante","Kumquat"],
  ["Lime Taiti","Lime"],["Lime Singapore","Lime"],
  ["Pompelmo Rosa","Pompelmi"],["Pompelmo Bianco","Pompelmi"],["Pompelmo Rosso","Pompelmi"],
  ["Cedro Diamante","Cedri"],["Cedro Virettone","Cedri"],["Cedro Mano di Buddha","Cedri"]
].map(([name, category], id) => ({
  name, category, id, sizes: sizes.map(s => ({ ...s }))
}));

const categoryColors = {
  Limoni:"#e9edda", Arance:"#f6e5c9", Clementini:"#f2e8ce",
  Mandarini:"#f3e5cc", Kumquat:"#e3eadb", Lime:"#e0ebd8",
  Pompelmi:"#f1dfd8", Cedri:"#e9e7cf"
};

const filtersEl = document.getElementById("filters");
const grid = document.getElementById("products");
const search = document.getElementById("search");
const count = document.getElementById("result-count");
const empty = document.getElementById("empty");
const dialog = document.getElementById("product-dialog");
const sizeSelect = document.getElementById("size-select");
const quantityInput = document.getElementById("quantity-input");
const galleryImage = document.getElementById("gallery-image");
const galleryPlaceholder = document.getElementById("gallery-placeholder");
const galleryCount = document.getElementById("gallery-count");
const galleryPrev = document.getElementById("gallery-prev");
const galleryNext = document.getElementById("gallery-next");
let galleryImages = [];
let galleryIndex = 0;
let galleryRequest = 0;

async function loadProductPhotos(product) {
  const request = ++galleryRequest;
  galleryImages = [];
  galleryIndex = 0;
  galleryImage.hidden = true;
  galleryImage.removeAttribute("src");
  galleryPlaceholder.hidden = false;
  galleryPlaceholder.textContent = "Caricamento foto…";
  galleryCount.textContent = "";
  galleryPrev.hidden = true;
  galleryNext.hidden = true;

  try {
    if (!window.productPhotoCatalog) {
      const response = await fetch("images/product-photos.json");
      if (!response.ok) throw new Error("Catalogo foto non disponibile");
      window.productPhotoCatalog = await response.json();
    }
    if (request !== galleryRequest) return;
    galleryImages = window.productPhotoCatalog[product.name] || [];

    if (!galleryImages.length) {
      galleryPlaceholder.textContent = "Foto JPG non ancora disponibili per questa varietà.";
      return;
    }
    showGalleryImage();
  } catch (error) {
    if (request === galleryRequest) {
      galleryPlaceholder.textContent = "Impossibile caricare le foto. Riprova più tardi.";
    }
  }
}

function showGalleryImage() {
  const photo = galleryImages[galleryIndex];
  if (!photo) return;
  galleryImage.onload = () => {
    galleryPlaceholder.hidden = true;
    galleryImage.hidden = false;
  };
  galleryImage.onerror = () => {
    galleryImage.hidden = true;
    galleryPlaceholder.hidden = false;
    galleryPlaceholder.textContent = "Questa foto non è disponibile.";
  };
  galleryImage.alt = "Foto online di " + selectedProduct.name;
  galleryImage.src = photo.url;
  galleryCount.textContent = (galleryIndex + 1) + " / " + galleryImages.length;
  galleryCount.title = [photo.title, photo.author, photo.license]
    .filter(Boolean).join(" — ");
  galleryPrev.hidden = galleryImages.length < 2;
  galleryNext.hidden = galleryImages.length < 2;
}

galleryPrev.addEventListener("click", () => {
  if (!galleryImages.length) return;
  galleryIndex = (galleryIndex - 1 + galleryImages.length) % galleryImages.length;
  showGalleryImage();
});
galleryNext.addEventListener("click", () => {
  if (!galleryImages.length) return;
  galleryIndex = (galleryIndex + 1) % galleryImages.length;
  showGalleryImage();
});


let activeCategory = "Tutte";
let selectedProduct = products[0];
let favoritesOnly = false;
let favorites = new Set();
try {
  favorites = new Set(JSON.parse(localStorage.getItem("vivaio-siracusa-favorites") || "[]"));
} catch {}
const favoritesToggle = document.getElementById("favorites-toggle");

function saveFavorites() {
  try { localStorage.setItem("vivaio-siracusa-favorites", JSON.stringify([...favorites])); } catch {}
  const count = document.getElementById("favorites-count");
  if (count) count.textContent = favorites.size;
  favoritesToggle.classList.toggle("active", favoritesOnly);
  favoritesToggle.setAttribute("aria-pressed", String(favoritesOnly));
  favoritesToggle.innerHTML = `${favoritesOnly ? "♥" : "♡"} Preferiti <span id="favorites-count">${favorites.size}</span>`;
}

function toggleFavorite(id) {
  if (favorites.has(id)) favorites.delete(id);
  else favorites.add(id);
  saveFavorites();
  renderProducts();
}

function euro(value) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency", currency: "EUR", maximumFractionDigits: 2
  }).format(value);
}

function renderFilters() {
  const categories = ["Tutte", ...new Set(products.map(p => p.category))];
  filtersEl.innerHTML = categories.map(c =>
    `<button class="filter-btn ${c === activeCategory ? "active" : ""}" type="button" data-category="${c}">${c}</button>`
  ).join("");

  filtersEl.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      activeCategory = btn.dataset.category;
      renderFilters();
      renderProducts();
    });
  });
}

function plantArt(category) {
  const files = {
    "Limoni": "limoni.jpg",
    "Arance": "arance.jpg",
    "Clementini": "clementini.jpg",
    "Mandarini": "mandarini.jpg",
    "Kumquat": "kumquat.jpg",
    "Lime": "lime.jpg",
    "Pompelmi": "pompelmi.jpg",
    "Cedri": "cedri.jpg"
  };
  const file = files[category];
  if (!file) return '<div class="plant-symbol" aria-hidden="true"></div>';
  return `<img class="catalog-photo" src="images/site/${file}" alt="${category}" loading="lazy" onerror="this.style.display='none'">`;
}

function renderProducts() {
  const q = search.value.trim().toLocaleLowerCase("it");
  const shown = products.filter(p =>
    (activeCategory === "Tutte" || p.category === activeCategory) &&
    (!favoritesOnly || favorites.has(p.id)) &&
    p.name.toLocaleLowerCase("it").includes(q)
  );

  count.textContent = `${shown.length} ${shown.length === 1 ? "pianta" : "piante"}`;
  empty.hidden = shown.length !== 0;

  grid.innerHTML = shown.map(p => `
    <article class="product-card" tabindex="0" role="button"
      aria-label="Dettagli ${p.name}" data-id="${p.id}">
      <div class="product-visual" style="--visual:${categoryColors[p.category] || "#e9edda"}">
        <span class="product-badge">${p.category.toUpperCase()}</span><button class="favorite-btn ${favorites.has(p.id) ? "is-favorite" : ""}" type="button" data-favorite="${p.id}" aria-label="Preferiti" aria-pressed="${favorites.has(p.id)}">${favorites.has(p.id) ? "♥" : "♡"}</button>${plantArt(p.category)}
      </div>
      <div class="card-info">
        <span class="card-category">${p.category.toUpperCase()}</span>
        <h3>${p.name}</h3>
        <div class="card-bottom">
          <span class="availability-note">Disponibilità da confermare</span>
          <strong>Chiedi disponibilità <span class="card-arrow">↗</span></strong>
        </div>
      </div>
    </article>`).join("");

  grid.querySelectorAll(".favorite-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      toggleFavorite(Number(btn.dataset.favorite));
    });
  });

  grid.querySelectorAll(".product-card").forEach(card => {
    const open = () => openProduct(products.find(p => p.id === Number(card.dataset.id)));
    card.addEventListener("click", open);
    card.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

function openProduct(product) {
  selectedProduct = product;
  document.getElementById("dialog-title").textContent = product.name;
  document.getElementById("dialog-category").textContent = product.category.toUpperCase();
  loadProductPhotos(product);
  sizeSelect.innerHTML = product.sizes.map((s, i) =>
    `<option value="${i}">${s.label} — ${euro(s.price)}</option>`
  ).join("");

  quantityInput.value = 1;
  updateDialogPrice();

  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function updateDialogPrice() {
  const size = selectedProduct.sizes[Number(sizeSelect.value) || 0];
  const qty = Math.max(1, Math.min(99, Number(quantityInput.value) || 1));
  quantityInput.value = qty;
  document.getElementById("dialog-price").textContent = euro(size.price * qty);
}

sizeSelect.addEventListener("change", updateDialogPrice);
quantityInput.addEventListener("input", updateDialogPrice);

document.getElementById("order-button").addEventListener("click", () => {
  const size = selectedProduct.sizes[Number(sizeSelect.value) || 0];
  const qty = Math.max(1, Math.min(99, Number(quantityInput.value) || 1));

  const message = `Ciao Vivaio Siracusa, vorrei informazioni e disponibilità per:
• ${selectedProduct.name}
• ${size.label}
• Quantità: ${qty}
• Prezzo unitario: ${euro(size.price)}
• Totale indicativo: ${euro(size.price * qty)}

Potete confermarmi disponibilità e modalità di consegna?`;

  window.open(`https://wa.me/${PHONE}?text=${encodeURIComponent(message)}`, "_blank");
});

favoritesToggle.addEventListener("click", () => {
  favoritesOnly = !favoritesOnly;
  saveFavorites();
  renderProducts();
});
search.addEventListener("input", renderProducts);
renderFilters();
saveFavorites();
renderProducts();

// Permette di chiudere il dialogo toccando lo sfondo esterno.
dialog.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  const outside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;

  if (outside) dialog.close();
});

// Permette di chiudere il dialogo toccando lo sfondo esterno.
dialog.addEventListener("click", (event) => {
  const rect = dialog.getBoundingClientRect();
  const outside =
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom;

  if (outside) dialog.close();
});
