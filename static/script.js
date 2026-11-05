
const API_BASE = "";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const grid = $("#product-grid");
const status = $("#status-message");
const searchInput = $("#search-input");
const sortSelect = $("#sort-select");

let products = [];
let activeFilter = "all";
let cart = readStorage("lapStoreCart", []);
let wishlist = readStorage("lapStoreWishlist", []);
let toastTimer;
let lastFocusedElement = null;

const photoSets = {
    gaming: [
        "photo-1603302576837-37561b2e2302",
        "photo-1593642632823-8f785ba67e45",
        "photo-1593642702821-c8da6771f0c6",
        "photo-1593642634367-d91a135587b5"
    ],
    business: [
        "photo-1496181133206-80ce9b88a853",
        "photo-1588872657578-7efd1f1555ed",
        "photo-1498050108023-c5249f4df085",
        "photo-1517336714731-489689fd1ca8"
    ],
    student: [
        "photo-1517336714731-489689fd1ca8",
        "photo-1525547719571-a2d4ac8945e2",
        "photo-1588872657578-7efd1f1555ed"
    ],
    creator: [
        "photo-1525547719571-a2d4ac8945e2",
        "photo-1498050108023-c5249f4df085",
        "photo-1496181133206-80ce9b88a853"
    ],
    default: [
        "photo-1496181133206-80ce9b88a853",
        "photo-1588872657578-7efd1f1555ed",
        "photo-1517336714731-489689fd1ca8",
        "photo-1525547719571-a2d4ac8945e2",
        "photo-1498050108023-c5249f4df085",
        "photo-1593642632823-8f785ba67e45"
    ]
};

function readStorage(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value ?? fallback;
    } catch {
        return fallback;
    }
}

function money(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(value) || 0);
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function idOf(product) {
    return product.id ?? product.product_id;
}

function nameOf(product) {
    return product.name ?? product.product_name ?? "Laptop";
}

function stockOf(product) {
    return Math.max(0, Number(product.quantity ?? product.stock ?? 0));
}

function categoryOf(product) {
    const original = String(product.category ?? "").toLowerCase().trim();

    if (["gaming", "business", "student", "creator"].includes(original)) {
        return original;
    }

    const text = [
        product.name,
        product.product_name,
        product.brand,
        product.description,
        original
    ].filter(Boolean).join(" ").toLowerCase();

    if (/gaming|rog|tuf|predator|alienware|legion|nitro|omen|razer|loq/.test(text)) {
        return "gaming";
    }
    if (/creator|studio|design|render|workstation/.test(text)) {
        return "creator";
    }
    if (/business|thinkpad|latitude|elitebook|probook/.test(text)) {
        return "business";
    }
    if (/student|school|study|chromebook/.test(text)) {
        return "student";
    }

    return "general";
}

function imageURL(product) {
    // Use an explicit product image URL if your API supplies one.
    const supplied = product.image_url ?? product.image ?? product.imageUrl;

    if (typeof supplied === "string" &&
        /^https:\/\/[^ ]+/i.test(supplied)) {
        return supplied;
    }

    const category = categoryOf(product);
    const set = photoSets[category] || photoSets.default;
    const id = idOf(product);

    // Different product IDs receive different photos from the selected set.
    let hash = 0;
    for (const char of String(id ?? nameOf(product))) {
        hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    }

    const photoId = set[hash % set.length];
    return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=850&q=85`;
}

function photoHTML(product, index) {
    const url = imageURL(product);

    return `
        <div class="product-photo">
            <span class="product-tag ${categoryOf(product) === "gaming" ? "gaming" : ""}">
                ${escapeHTML(categoryOf(product).toUpperCase())}
            </span>
            <button type="button"
                class="wish-button ${isWished(idOf(product)) ? "selected" : ""}"
                data-wish="${escapeHTML(idOf(product))}"
                aria-label="${isWished(idOf(product)) ? "Remove from" : "Add to"} wishlist">
                ${isWished(idOf(product)) ? "♥" : "♡"}
            </button>
            <img src="${url}" alt="${escapeHTML(nameOf(product))}"
                loading="lazy"
                onerror="this.hidden=true;this.nextElementSibling.hidden=false">
            <div class="photo-placeholder" hidden aria-hidden="true">💻</div>
        </div>
    `;
}

function isWished(id) {
    return wishlist.some(item => String(item.id) === String(id));
}

function persistWishlist() {
    localStorage.setItem("lapStoreWishlist", JSON.stringify(wishlist));
    $("#wishlist-count").textContent = wishlist.length;
}

function persistCart() {
    localStorage.setItem("lapStoreCart", JSON.stringify(cart));
    renderCart();
}

function notify(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function selectFilter(filter) {
    activeFilter = filter;

    $$(".nav-link, .filter-chip").forEach(button => {
        const selected = button.dataset.filter === filter;
        button.classList.toggle("active", selected);
    });

    renderProducts();
}

function matchesFilter(product) {
    if (activeFilter === "all") return true;

    if (activeFilter === "deals") {
        return Boolean(
            product.discount ||
            product.discount_percent ||
            product.is_on_sale
        );
    }

    return categoryOf(product) === activeFilter;
}

function renderProducts() {
    const query = searchInput.value.trim().toLowerCase();

    let list = products.filter(product => {
        const searchText = [
            nameOf(product),
            product.brand,
            product.description,
            product.category,
            product.price
        ].filter(value => value != null).join(" ").toLowerCase();

        return searchText.includes(query) && matchesFilter(product);
    });

    if (sortSelect.value === "price-low") {
        list.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortSelect.value === "price-high") {
        list.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortSelect.value === "name") {
        list.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
    }

    const labels = {
        all: ["Explore our laptops", "The right technology for wherever you're going."],
        gaming: ["Gaming laptops", "Powerful machines for your gaming setup."],
        business: ["Business laptops", "Find a reliable companion for work."],
        student: ["Student laptops", "Explore choices for study and everyday tasks."],
        creator: ["Creator laptops", "Discover laptops for creative work."],
        deals: ["Laptop deals", "Products marked as deals by your backend."]
    };

    const [heading, subtitle] = labels[activeFilter] || labels.all;
    $("#section-title").textContent = heading;
    $("#section-subtitle").textContent = subtitle;

    status.textContent = `${list.length} product${list.length === 1 ? "" : "s"} found`;

    if (!list.length) {
        grid.innerHTML = `
            <div class="empty-state">
                <h3>No matching laptops</h3>
                <p>Try another search or category.</p>
                <button class="btn btn-primary" data-filter="all" type="button">
                    Show all laptops
                </button>
            </div>`;
        return;
    }

    grid.innerHTML = list.map((product, index) => {
        const id = idOf(product);
        const stock = stockOf(product);
        const name = nameOf(product);
        const specs = [
            product.processor,
            product.ram ? `${product.ram} RAM` : null,
            product.storage
        ].filter(Boolean).slice(0, 3);

        return `
            <article class="product-card">
                ${photoHTML(product, index)}
                <div class="product-info">
                    <p class="product-category">${escapeHTML(categoryOf(product))}</p>
                    <h3>${escapeHTML(name)}</h3>
                    <p class="product-description">
                        ${escapeHTML(product.description || "Discover the details of this laptop.")}
                    </p>
                    <div class="product-specs">
                        ${specs.map(spec => `<span>${escapeHTML(spec)}</span>`).join("")}
                    </div>
                    <p class="product-price">${money(product.price)}</p>
                    <p class="product-stock ${stock <= 0 ? "out" : ""}">
                        ${stock > 0 ? `✓ ${stock} available` : "Out of stock"}
                    </p>
                    <div class="product-actions">
                        <button class="add-to-cart" type="button"
                            data-add="${escapeHTML(id)}"
                            ${stock <= 0 || id == null ? "disabled" : ""}>
                            ${stock > 0 ? "＋ Add to cart" : "Unavailable"}
                        </button>
                        <button class="details-button" type="button"
                            data-details="${escapeHTML(id)}">Details</button>
                    </div>
                </div>
            </article>`;
    }).join("");
}

function addToCart(id) {
    const product = products.find(item => String(idOf(item)) === String(id));
    if (!product) return;

    const stock = stockOf(product);
    const item = cart.find(entry => String(entry.id) === String(id));

    if (stock <= 0) {
        notify("This laptop is out of stock.");
        return;
    }

    if (item) {
        if (item.quantity >= stock) {
            notify("You've reached the available stock limit.");
            return;
        }
        item.quantity++;
    } else {
        cart.push({
            id: idOf(product),
            name: nameOf(product),
            price: Number(product.price) || 0,
            quantity: 1
        });
    }

    persistCart();
    notify(`${nameOf(product)} added to cart.`);
}

function changeQuantity(id, delta) {
    const item = cart.find(entry => String(entry.id) === String(id));
    if (!item) return;

    const product = products.find(entry => String(idOf(entry)) === String(id));
    const stock = product ? stockOf(product) : item.quantity;
    const next = item.quantity + delta;

    if (next <= 0) {
        cart = cart.filter(entry => String(entry.id) !== String(id));
    } else if (next > stock) {
        notify("You've reached the available stock limit.");
        return;
    } else {
        item.quantity = next;
    }

    persistCart();
}

function renderCart() {
    $("#cart-count").textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    $("#cart-total").textContent = money(
        cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
    );

    $("#cart-items").innerHTML = cart.length ? cart.map(item => {
        const product = products.find(entry => String(idOf(entry)) === String(item.id));
        const photo = product ? imageURL(product) : "";

        return `
            <div class="cart-row">
                <div class="cart-thumb">
                    ${photo ? `<img src="${photo}" alt="" onerror="this.hidden=true">` : "💻"}
                </div>
                <div class="cart-row-main">
                    <strong>${escapeHTML(item.name)}</strong>
                    <p>${money(item.price)} each</p>
                    <div class="quantity-controls">
                        <button type="button" data-cart-change="-1"
                            data-id="${escapeHTML(item.id)}" aria-label="Decrease">−</button>
                        <span>${item.quantity}</span>
                        <button type="button" data-cart-change="1"
                            data-id="${escapeHTML(item.id)}" aria-label="Increase">+</button>
                        <button type="button" class="remove-button"
                            data-remove-cart="${escapeHTML(item.id)}">Remove</button>
                    </div>
                </div>
            </div>`;
    }).join("") : `
        <div class="empty-state">
            <h3>Your cart is empty</h3>
            <p>Add a laptop to see it here.</p>
        </div>`;
}

function toggleWishlist(id) {
    const product = products.find(item => String(idOf(item)) === String(id));
    if (!product) return;

    if (isWished(id)) {
        wishlist = wishlist.filter(item => String(item.id) !== String(id));
        notify("Removed from wishlist.");
    } else {
        wishlist.push({
            id: idOf(product),
            name: nameOf(product),
            price: Number(product.price) || 0
        });
        notify("Saved to your wishlist.");
    }

    persistWishlist();
    renderProducts();
    renderWishlist();
}

function renderWishlist() {
    $("#wishlist-count").textContent = wishlist.length;

    $("#wishlist-items").innerHTML = wishlist.length ? wishlist.map(item => {
        const product = products.find(entry => String(idOf(entry)) === String(item.id));
        const photo = product ? imageURL(product) : "";

        return `
            <div class="wishlist-row">
                <div class="wishlist-thumb">
                    ${photo ? `<img src="${photo}" alt="" onerror="this.hidden=true">` : "💻"}
                </div>
                <div class="wishlist-main">
                    <strong>${escapeHTML(item.name)}</strong>
                    <p>${money(item.price)}</p>
                    <button class="wishlist-add" type="button"
                        data-wishlist-add="${escapeHTML(item.id)}">Add to cart</button>
                </div>
                <button class="remove-button" type="button"
                    data-wishlist-remove="${escapeHTML(item.id)}">Remove</button>
            </div>`;
    }).join("") : `
        <div class="empty-state">
            <h3>No saved laptops yet</h3>
            <p>Tap ♡ on a product to save it here.</p>
        </div>`;
}

function openPanel(id) {
    closePanels();
    lastFocusedElement = document.activeElement;
    $("#overlay").hidden = false;
    $(id).hidden = false;
    document.body.style.overflow = "hidden";
}

function closePanels() {
    $("#overlay").hidden = true;
    $("#cart-panel").hidden = true;
    $("#wishlist-panel").hidden = true;
    $("#product-modal").hidden = true;
    document.body.style.overflow = "";
}

function openDetails(id) {
    const product = products.find(item => String(idOf(item)) === String(id));
    if (!product) return;

    lastFocusedElement = document.activeElement;
    const stock = stockOf(product);
    const image = imageURL(product);

    $("#product-modal-content").innerHTML = `
        <div class="modal-product">
            <img src="${image}" alt="${escapeHTML(nameOf(product))}"
                onerror="this.hidden=true">
            <div>
                <span class="eyebrow">${escapeHTML(categoryOf(product).toUpperCase())}</span>
                <h2>${escapeHTML(nameOf(product))}</h2>
                <p>${escapeHTML(product.description || "Product details are available from the store API.")}</p>
                <p class="product-price">${money(product.price)}</p>
                <p class="product-stock ${stock <= 0 ? "out" : ""}">
                    ${stock > 0 ? `${stock} in stock` : "Out of stock"}
                </p>
                <button class="btn btn-primary" type="button"
                    data-modal-add="${escapeHTML(id)}"
                    ${stock <= 0 ? "disabled" : ""}>Add to cart</button>
            </div>
        </div>`;

    closePanels();
    $("#overlay").hidden = false;
    $("#product-modal").hidden = false;
    document.body.style.overflow = "hidden";
}

async function fetchProducts() {
    status.textContent = "Loading laptops...";

    let lastError;

    for (const endpoint of ["/products/", "/products"]) {
        try {
            const response = await fetch(API_BASE + endpoint);
            if (!response.ok) throw new Error(`API returned ${response.status}`);

            const data = await response.json();
            const list = Array.isArray(data)
                ? data
                : data.products ?? data.items ?? data.data;

            if (!Array.isArray(list)) {
                throw new Error("Expected a product list.");
            }

            products = list;
            renderProducts();
            renderCart();
            renderWishlist();
            return;
        } catch (error) {
            lastError = error;
        }
    }

    console.error("Product API error:", lastError);
    status.textContent = "Unable to load products from the API.";
    grid.innerHTML = `
        <div class="empty-state">
            <h3>We couldn't load your laptops</h3>
            <p>Check your FastAPI server and product endpoint in /docs.</p>
            <button class="btn btn-primary" id="retry-button" type="button">Try again</button>
        </div>`;
}

// Search and sorting
$("#search-form").addEventListener("submit", event => {
    event.preventDefault();
    renderProducts();
    $("#products").scrollIntoView({ behavior: "smooth" });
});
searchInput.addEventListener("input", renderProducts);
sortSelect.addEventListener("change", renderProducts);

// Category navigation and filter chips
$$("[data-filter]").forEach(button => {
    button.addEventListener("click", event => {
        event.preventDefault();
        selectFilter(button.dataset.filter);

        $("#products").scrollIntoView({ behavior: "smooth" });
    });
});

// Product cards
grid.addEventListener("click", event => {
    const retry = event.target.closest("#retry-button");
    if (retry) return fetchProducts();

    const add = event.target.closest("[data-add]");
    if (add && !add.disabled) return addToCart(add.dataset.add);

    const wish = event.target.closest("[data-wish]");
    if (wish) return toggleWishlist(wish.dataset.wish);

    const details = event.target.closest("[data-details]");
    if (details) return openDetails(details.dataset.details);

    const reset = event.target.closest('[data-filter="all"]');
    if (reset) selectFilter("all");
});

// Header actions
$("#cart-toggle").addEventListener("click", () => {
    renderCart();
    openPanel("#cart-panel");
});
$("#wishlist-toggle").addEventListener("click", () => {
    renderWishlist();
    openPanel("#wishlist-panel");
});
$("#theme-toggle").addEventListener("click", () => {
    document.body.classList.toggle("dark");
    const isDark = document.body.classList.contains("dark");
    localStorage.setItem("lapStoreTheme", isDark ? "dark" : "light");
    $("#theme-toggle").textContent = isDark ? "☀" : "☾";
});

// Cart and wishlist actions
$("#cart-items").addEventListener("click", event => {
    const change = event.target.closest("[data-cart-change]");
    const remove = event.target.closest("[data-remove-cart]");

    if (change) {
        changeQuantity(change.dataset.id, Number(change.dataset.cartChange));
    } else if (remove) {
        cart = cart.filter(item => String(item.id) !== String(remove.dataset.removeCart));
        persistCart();
        notify("Item removed from cart.");
    }
});

$("#wishlist-items").addEventListener("click", event => {
    const add = event.target.closest("[data-wishlist-add]");
    const remove = event.target.closest("[data-wishlist-remove]");

    if (add) {
        addToCart(add.dataset.wishlistAdd);
    } else if (remove) {
        wishlist = wishlist.filter(item => String(item.id) !== String(remove.dataset.wishlistRemove));
        persistWishlist();
        renderWishlist();
        renderProducts();
    }
});

$("#product-modal-content").addEventListener("click", event => {
    const add = event.target.closest("[data-modal-add]");
    if (add && !add.disabled) {
        addToCart(add.dataset.modalAdd);
        closePanels();
    }
});

$("#checkout-button").addEventListener("click", () => {
    if (!cart.length) {
        $("#cart-message").textContent = "Your cart is empty.";
        return;
    }

    $("#cart-message").textContent =
        "Your cart is ready. Connect your authenticated order API to place an order.";
});

$$("[data-close-panel], [data-close-modal]").forEach(button => {
    button.addEventListener("click", closePanels);
});
$("#overlay").addEventListener("click", closePanels);

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closePanels();
        if (lastFocusedElement) lastFocusedElement.focus();
    }
});

// Restore theme and render saved data
if (localStorage.getItem("lapStoreTheme") === "dark") {
    document.body.classList.add("dark");
    $("#theme-toggle").textContent = "☀";
}

persistWishlist();
renderCart();
renderWishlist();
fetchProducts();
