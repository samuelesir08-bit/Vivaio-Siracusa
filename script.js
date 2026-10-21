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
].map(([name, category], i) => ({name, category, id:i, sizes: sizes.map(s=>({...s}))}));

const categoryColors = {
  "Limoni":"#e9edda","Arance":"#f6e5c9","Clementini":"#f2e8ce","Mandarini":"#f3e5cc",
  "Kumquat":"#e3eadb","Lime":"#e0ebd8","Pompelmi":"#f1dfd8","Cedri":"#e9e7cf"
};
const filtersEl = document.getElementById("filters");
const grid = document.getElementById("products");
const search = document.getElementById("search");
const count = document.getElementById("result-count");
const empty = document.getElementById("empty");
const dialog = document.getElementById("product-dialog");
const sizeSelect = document.getElementById("size-select");
let activeCategory = "Tutte";
let selectedProduct = products[0];

function euro(value){ return new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(value); }
function renderFilters(){
  const categories = ["Tutte",...new Set(products.map(p=>p.category))];
  filtersEl.innerHTML = categories.map(c=>`<button class="filter-btn ${c===activeCategory?"active":""}" type="button" data-category="${c}">${c}</button>`).join("");
  filtersEl.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{activeCategory=btn.dataset.category;renderFilters();renderProducts();}));
}
function plantArt(category){
  const fruit = ["Limoni","Arance","Clementini","Mandarini","Kumquat","Pompelmi","Cedri"].includes(category);
  return `<div class="plant-symbol" aria-hidden="true"><span class="stem"></span><span class="leaf l1"></span><span class="leaf l2"></span><span class="leaf l3"></span><span class="leaf l4"></span>${fruit?'<span class="fruit f1"></span><span class="fruit f2"></span>':""}<span class="pot"></span></div>`;
}
function renderProducts(){
  const q = search.value.trim().toLocaleLowerCase("it");
  const shown = products.filter(p=>(activeCategory==="Tutte"||p.category===activeCategory)&&p.name.toLocaleLowerCase("it").includes(q));
  count.textContent = `${shown.length} ${shown.length===1?"pianta":"piante"}`;
  empty.hidden = shown.length!==0;
  grid.innerHTML = shown.map(p=>`<article class="product-card" tabindex="0" role="button" aria-label="Dettagli ${p.name}" data-id="${p.id}">
    <div class="product-visual" style="--visual:${categoryColors[p.category]||"#e9edda"}"><span class="product-badge">${p.category.toUpperCase()}</span>${plantArt(p.category)}</div>
    <div class="card-info"><span class="card-category">${p.category.toUpperCase()}</span><h3>${p.name}</h3><div class="card-bottom"><span>Da ${euro(10)}</span><strong>Scopri i formati <span class="card-arrow">↗</span></strong></div></div>
  </article>`).join("");
  grid.querySelectorAll(".product-card").forEach(card=>{
    const open=()=>openProduct(products.find(p=>p.id===Number(card.dataset.id)));
    card.addEventListener("click",open);
    card.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();open();}});
  });
}
function openProduct(product){
  selectedProduct=product;
  document.getElementById("dialog-title").textContent=product.name;
  document.getElementById("dialog-category").textContent=product.category.toUpperCase();
  sizeSelect.innerHTML=product.sizes.map((s,i)=>`<option value="${i}">${s.label} — ${euro(s.price)}</option>`).join("");
  updateDialogPrice();
  if(typeof dialog.showModal==="function") dialog.showModal(); else dialog.setAttribute("open","");
}
function updateDialogPrice(){
  const size=selectedProduct.sizes[Number(sizeSelect.value)||0];
  document.getElementById("dialog-price").textContent=euro(size.price);
}
sizeSelect.addEventListener("change",updateDialogPrice);
document.getElementById("order-button").addEventListener("click",()=>{
  const size=selectedProduct.sizes[Number(sizeSelect.value)||0];
  const qty = Math.max(
  1,
  Math.min(99, Number(document.getElementById("quantity-input")?.value) || 1)
);

const message = `Ciao Vivaio Siracusa, vorrei informazioni e disponibilità per:
• ${selectedProduct.name}
• ${size.label}
• Quantità: ${qty}
• Prezzo unitario: ${euro(size.price)}
• Totale indicativo: ${euro(size.price * qty)}

Potete confermarmi disponibilità e modalità di consegna?`;
search.addEventListener("input",renderProducts);
renderFilters();
renderProducts();
