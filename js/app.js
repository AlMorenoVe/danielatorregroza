/**
 * Adaptaciones para catálogo de vestuario:
 * - Collage como mosaico cuadrado colocado entre categorías y destacados
 * - Selección de talla/color como botones
 * - Precio fijo al final de la tarjeta
 */

const { createClient } = supabase;

let SB_URL = null;
let SB_ANON_KEY = null;
let supabaseClient = null;

let cart = [];
let products = [];
let currentImageIndex = 0;
let currentProduct = null;
let deferredPrompt = null;
let orderDetails = {};

// DOM references
const collageGrid = document.getElementById('collage-grid');
const featuredContainer = document.getElementById('featured-grid');
const offersGrid = document.getElementById('offers-grid');
const allFilteredContainer = document.getElementById('all-filtered-products');
const featuredSection = document.getElementById('featured-section');
const offersSection = document.getElementById('offers-section');
const filteredSection = document.getElementById('filtered-section');
const noProductsMessage = document.getElementById('no-products-message');
const searchInput = document.getElementById('search-input');
const searchResultsTitle = document.getElementById('search-results-title');
const categoryCarousel = document.getElementById('category-carousel');
const productModal = document.getElementById('productModal');
const modalProductName = document.getElementById('modal-product-name');
const modalProductDescription = document.getElementById('modal-product-description');
const modalProductPrice = document.getElementById('modal-product-price');
const modalAddToCartBtn = document.getElementById('modal-add-to-cart-btn');
const qtyInput = document.getElementById('qty-input');
const carouselImagesContainer = document.getElementById('carousel-images-container');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const cartBtn = document.getElementById('cart-btn');
const cartBadge = document.getElementById('cart-badge');
const cartModal = document.getElementById('cartModal');
const cartItemsContainer = document.getElementById('cart-items');
const cartTotalElement = document.getElementById('cart-total');
const checkoutBtn = document.getElementById('checkout-btn');
const checkoutModal = document.getElementById('checkoutModal');
const customerNameInput = document.getElementById('customer-name');
const customerAddressInput = document.getElementById('customer-address');
const finalizeBtn = document.getElementById('finalize-btn');
const installBanner = document.getElementById('install-banner');
const installCloseBtn = document.getElementById('install-close-btn');
const installPromptBtn = document.getElementById('install-prompt-btn');
const orderSuccessModal = document.getElementById('orderSuccessModal');
const orderSuccessTotal = document.getElementById('order-success-total');
const whatsappBtn = document.getElementById('whatsapp-btn');
const closeSuccessBtn = document.getElementById('close-success-btn');
const termsConsentCheckbox = document.getElementById('terms-consent-checkbox');

const sizeOptionsRow = document.getElementById('size-options');
const colorOptionsRow = document.getElementById('color-options');
const modalRequiredHint = document.getElementById('modal-required-hint');

const money = (v) => {
    const value = Math.floor(v);
    return value.toLocaleString('es-CO');
};

const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

// Banner carousel (kept same)
const bannerCarousel = document.getElementById('banner-carousel');
const bannerDots = document.getElementById('banner-dots');
if (bannerCarousel) {
    const slides = document.querySelectorAll('.banner-slide');
    let currentBanner = 0;
    let bannerInterval;
    const firstSlideClone = slides[0].cloneNode(true);
    const lastSlideClone = slides[slides.length - 1].cloneNode(true);
    bannerCarousel.appendChild(firstSlideClone);
    bannerCarousel.insertBefore(lastSlideClone, slides[0]);
    currentBanner = 1;
    bannerCarousel.style.transform = `translateX(-${currentBanner * 100}%)`;
    slides.forEach((_, idx) => {
        const dot = document.createElement('div');
        dot.classList.add('banner-dot');
        if (idx === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(idx + 1));
        bannerDots.appendChild(dot);
    });

    function updateBanner() {
        bannerCarousel.style.transform = `translateX(-${currentBanner * 100}%)`;
        const dotIndex = (currentBanner - 1 + slides.length) % slides.length;
        document.querySelectorAll('.banner-dot').forEach((dot, idx) => {
            dot.classList.toggle('active', idx === dotIndex);
        });
    }

    function goToSlide(idx) {
        currentBanner = idx;
        updateBanner();
        resetInterval();
    }

    function nextBanner() {
        currentBanner++;
        updateBanner();
        if (currentBanner >= slides.length + 1) {
            setTimeout(() => {
                bannerCarousel.style.transition = 'none';
                currentBanner = 1;
                bannerCarousel.style.transform = `translateX(-${currentBanner * 100}%)`;
                setTimeout(() => {
                    bannerCarousel.style.transition = 'transform 0.5s ease';
                }, 50);
            }, 500);
        }
    }

    function resetInterval() {
        clearInterval(bannerInterval);
        bannerInterval = setInterval(nextBanner, 4000);
    }
    let startX = 0;
    bannerCarousel.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
    });
    bannerCarousel.addEventListener('touchend', e => {
        let endX = e.changedTouches[0].clientX;
        if (endX - startX > 50) {
            currentBanner = (currentBanner - 1);
            updateBanner();
            resetInterval();
        } else if (startX - endX > 50) {
            nextBanner();
            resetInterval();
        }
    });
    resetInterval();
}

// Generate product card (price at bottom ensured by CSS)
const generateProductCard = (p) => {
    let bestSellerTag = '';
    if (p.bestSeller) {
        bestSellerTag = `<div class="best-seller-tag">Lo más vendido</div>`;
    }

    let stockOverlay = '';
    let stockClass = '';
    if (!p.stock || p.stock <= 0) {
        stockOverlay = `<div class="out-of-stock-overlay">Agotado</div>`;
        stockClass = ' out-of-stock';
    }

    return `
      <div class="product-card${stockClass}" data-product-id="${p.id}">
        ${bestSellerTag}
        <div class="image-wrap">
          <img src="${p.image && p.image[0] ? p.image[0] : 'img/favicon.png'}" alt="${escapeHtml(p.name)}" class="product-image modal-trigger" data-id="${p.id}" loading="lazy" />
          <div class="image-hint" aria-hidden="true">
            <i class="fas fa-hand-point-up" aria-hidden="true"></i>
            <span>Presiona para ver</span>
          </div>
        </div>
        ${stockOverlay}
        <div class="product-info">
          <div>
            <div class="product-name">${escapeHtml(p.name)}</div>
            <div class="product-description">${escapeHtml(p.description || '')}</div>
          </div>
          <div style="margin-top:8px">
            <div class="product-price">$${money(p.price)}</div>
          </div>
        </div>
      </div>
    `;
};

// Render products (unchanged)
function renderProducts(container, data, page = 1, perPage = 20, withPagination = false) {
    container.innerHTML = '';
    const paginationContainer = document.getElementById('pagination-container');
    if (!data || data.length === 0) {
        noProductsMessage.style.display = 'block';
        if (paginationContainer) paginationContainer.innerHTML = '';
        return;
    }
    noProductsMessage.style.display = 'none';
    const totalPages = Math.ceil(data.length / perPage);
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const currentProducts = data.slice(start, end);
    currentProducts.forEach(p => container.innerHTML += generateProductCard(p));
    if (withPagination && totalPages > 1) {
        renderPagination(page, totalPages, data, perPage);
    } else {
        if (paginationContainer) paginationContainer.innerHTML = '';
    }
}

function showImageHints(container) {
    try {
        const hints = container.querySelectorAll('.image-hint');
        const max = Math.min(6, hints.length);
        for (let i = 0; i < max; i++) {
            const h = hints[i];
            h.classList.add('show-hint');
            h.style.transitionDelay = `${i * 120}ms`;
        }
        setTimeout(() => {
            for (let i = 0; i < max; i++) {
                const h = hints[i];
                if (h) {
                    h.classList.remove('show-hint');
                    h.style.transitionDelay = '';
                }
            }
        }, 2200);
    } catch (err) {
        console.warn('showImageHints err', err);
    }
}

function enableTouchHints() {
  let lastTouchedCard = null;
  let lastTouchMoved = false;

  function onTouchStart(e) {
    lastTouchMoved = false;
    const card = e.target.closest('.product-card');
    if (!card) return;
    if (e.target.closest('button, a, input, textarea, select')) return;
    const hint = card.querySelector('.image-hint');
    if (!hint) return;
    hint.classList.add('show-hint');
    if (card._hintTimeout) {
      clearTimeout(card._hintTimeout);
      card._hintTimeout = null;
    }
    card._hintTimeout = setTimeout(() => {
      hint.classList.remove('show-hint');
      card._hintTimeout = null;
    }, 2200);
    lastTouchedCard = card;
  }

  function onTouchMove() {
    lastTouchMoved = true;
    if (lastTouchedCard) {
      const h = lastTouchedCard.querySelector('.image-hint');
      if (h) h.classList.remove('show-hint');
      if (lastTouchedCard._hintTimeout) {
        clearTimeout(lastTouchedCard._hintTimeout);
        lastTouchedCard._hintTimeout = null;
      }
      lastTouchedCard = null;
    }
  }

  function onTouchEnd() {
    if (!lastTouchedCard) return;
    const h = lastTouchedCard.querySelector('.image-hint');
    if (h && !lastTouchMoved) {
      setTimeout(() => {
        h.classList.remove('show-hint');
      }, 700);
    } else {
      if (h) h.classList.remove('show-hint');
    }
    if (lastTouchedCard && lastTouchedCard._hintTimeout) {
      clearTimeout(lastTouchedCard._hintTimeout);
      lastTouchedCard._hintTimeout = null;
    }
    lastTouchedCard = null;
  }

  document.addEventListener('touchstart', onTouchStart, { passive: true });
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
}

function renderPagination(currentPage, totalPages, data, perPage) {
    const paginationContainer = document.getElementById('pagination-container');
    paginationContainer.innerHTML = '';

    function createBtn(label, page, active = false) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = 'pagination-btn';
        if (active) btn.classList.add('active');
        btn.addEventListener('click', () => {
            renderProducts(allFilteredContainer, data, page, perPage, true);
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        return btn;
    }
    if (currentPage > 1) paginationContainer.appendChild(createBtn('Primera', 1));
    if (currentPage > 3) paginationContainer.appendChild(document.createTextNode('...'));
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, currentPage + 2);
    for (let i = start; i <= end; i++) {
        paginationContainer.appendChild(createBtn(i, i, i === currentPage));
    }
    if (currentPage < totalPages - 2) paginationContainer.appendChild(document.createTextNode('...'));
    if (currentPage < totalPages) paginationContainer.appendChild(createBtn('Última', totalPages));
}

const generateCategoryCarousel = () => {
    if (!categoryCarousel) return;
    categoryCarousel.innerHTML = '';
    const categories = Array.from(new Set(products.map(p => p.category))).map(c => ({ label: c }));
    const allItem = document.createElement('div');
    allItem.className = 'category-item';
    const allIconPath = 'img/icons/all.webp';
    allItem.innerHTML = `<img class="category-image" src="${allIconPath}" alt="Todo" data-category="__all"><span class="category-name">Todo</span>`;
    categoryCarousel.appendChild(allItem);
    categories.forEach(c => {
        const el = document.createElement('div');
        el.className = 'category-item';
        const fileName = `img/icons/${c.label.toLowerCase().replace(/\s+/g, '_')}.webp`;
        el.innerHTML = `<img class="category-image" src="${fileName}" alt="${c.label}" data-category="${c.label}"><span class="category-name">${c.label}</span>`;
        categoryCarousel.appendChild(el);
    });
};

searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
        showDefaultSections();
        return;
    }
    const filtered = products.filter(p => (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
    filteredSection.style.display = 'block';
    featuredSection.style.display = 'none';
    offersSection.style.display = 'none';
    searchResultsTitle.textContent = `Resultados para "${q}"`;
    renderProducts(allFilteredContainer, filtered, 1, 20, true);
});

const showDefaultSections = () => {
    featuredSection.style.display = 'block';
    offersSection.style.display = 'block';
    filteredSection.style.display = 'none';
    const featured = shuffleArray(products.filter(p => p.featured)).slice(0, 25);
    const offers = shuffleArray(products.filter(p => p.isOffer)).slice(0, 25);
    renderProducts(featuredContainer, featured, 1, 25, false);
    renderProducts(offersGrid, offers, 1, 25, false);
    showImageHints(featuredContainer);
    enableTouchHints();
};

categoryCarousel.addEventListener('click', (ev) => {
    const img = ev.target.closest('.category-image');
    if (!img) return;
    const cat = img.dataset.category;
    searchInput.value = '';
    if (cat === '__all') {
        showDefaultSections();
        return;
    }
    const filtered = products.filter(p => (p.category || '').toLowerCase() === cat.toLowerCase());
    filteredSection.style.display = 'block';
    featuredSection.style.display = 'none';
    offersSection.style.display = 'none';
    searchResultsTitle.textContent = cat;
    renderProducts(allFilteredContainer, filtered, 1, 20, true);
});

// draggable category (kept)
(function makeCarouselDraggable() {
    if (!categoryCarousel) return;
    let isDown = false,
        startX, scrollLeft;
    categoryCarousel.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - categoryCarousel.offsetLeft;
        scrollLeft = categoryCarousel.scrollLeft;
    });
    window.addEventListener('mouseup', () => {
        isDown = false;
    });
    categoryCarousel.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - categoryCarousel.offsetLeft;
        const walk = (x - startX) * 1.5;
        categoryCarousel.scrollLeft = scrollLeft - walk;
    });
    categoryCarousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].pageX - categoryCarousel.offsetLeft;
        scrollLeft = categoryCarousel.scrollLeft;
    });
    categoryCarousel.addEventListener('touchmove', (e) => {
        const x = e.touches[0].pageX - categoryCarousel.offsetLeft;
        const walk = (x - startX) * 1.2;
        categoryCarousel.scrollLeft = scrollLeft - walk;
    });
})();

// Delegated click handling for product modal and add-to-cart
document.addEventListener('click', (e) => {
    if (e.target.closest('.modal-trigger')) {
        const id = e.target.dataset.id;
        openProductModal(id);
    }
    if (e.target.id === 'modal-add-to-cart-btn') {
        const qty = Math.max(1, parseInt(qtyInput.value) || 1);
        const selectedSizeBtn = sizeOptionsRow?.querySelector('.option-btn.selected');
        const selectedColorBtn = colorOptionsRow?.querySelector('.option-btn.selected');
        const selectedSize = selectedSizeBtn?.dataset?.value || '';
        const selectedColor = selectedColorBtn?.dataset?.value || '';

        if (!selectedSize || !selectedColor) {
            triggerRequiredAnimation();
            return;
        }

        addToCart(currentProduct.id, qty, selectedSize, selectedColor);
        closeModal(productModal);
    }
});

// option buttons delegation (selecting size/color)
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.option-btn');
    if (!btn) return;
    const parent = btn.parentElement;
    // toggle single-selection within group
    parent.querySelectorAll('.option-btn').forEach(b => {
        b.classList.remove('selected');
        b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('selected');
    btn.setAttribute('aria-pressed', 'true');
});

// Modals open/close helpers
function showModal(modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
}

[productModal, cartModal, checkoutModal, orderSuccessModal].forEach(modal => {
    if (!modal) return;
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
        if (e.target.classList.contains('modal-close')) {
            closeModal(modal);
        }
    });
});

closeSuccessBtn && closeSuccessBtn.addEventListener('click', () => {
    closeModal(orderSuccessModal);
});

// open product modal and populate option buttons for size/color
function openProductModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    currentProduct = product;
    modalProductName.textContent = product.name;
    modalProductDescription.textContent = product.description || '';
    modalProductPrice.textContent = `$${money(product.price)}`;
    qtyInput.value = 1;
    updateCarousel(product.image || []);
    populateOptionButtons(sizeOptionsRow, product.size || product.sizes || []);
    populateOptionButtons(colorOptionsRow, product.color || product.colors || []);
    modalRequiredHint.classList.remove('show');
    sizeOptionsRow?.classList.remove('required-pulse');
    colorOptionsRow?.classList.remove('required-pulse');
    showModal(productModal);
}

function populateOptionButtons(container, rawOptions) {
    if (!container) return;
    container.innerHTML = '';
    let arr = [];
    if (Array.isArray(rawOptions)) arr = rawOptions;
    else if (typeof rawOptions === 'string' && rawOptions.trim().length) {
        arr = rawOptions.split(',').map(s => s.trim()).filter(Boolean);
    } else if (rawOptions) {
        arr = [rawOptions];
    }
    // If empty, show a disabled placeholder button
    if (arr.length === 0) {
        const b = document.createElement('button');
        b.className = 'option-btn';
        b.disabled = true;
        b.textContent = '-';
        container.appendChild(b);
        return;
    }
    arr.forEach(opt => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'option-btn';
        b.textContent = opt;
        b.dataset.value = opt;
        b.setAttribute('aria-pressed', 'false');
        container.appendChild(b);
    });
}

// animation hint when missing selections
function triggerRequiredAnimation() {
    modalRequiredHint.classList.add('show');
    if (!sizeOptionsRow.querySelector('.option-btn.selected')) {
        sizeOptionsRow.classList.remove('required-pulse');
        void sizeOptionsRow.offsetWidth;
        sizeOptionsRow.classList.add('required-pulse');
    }
    if (!colorOptionsRow.querySelector('.option-btn.selected')) {
        colorOptionsRow.classList.remove('required-pulse');
        void colorOptionsRow.offsetWidth;
        colorOptionsRow.classList.add('required-pulse');
    }
    setTimeout(() => {
        sizeOptionsRow.classList.remove('required-pulse');
        colorOptionsRow.classList.remove('required-pulse');
        modalRequiredHint.classList.remove('show');
    }, 900);
}

// Collage: place images in grid using random spans (1..3)
function renderCollage(items = [], maxItems = 12) {
    if (!collageGrid) return;
    collageGrid.innerHTML = '';
    const pool = shuffleArray(items.slice());
    const take = pool.slice(0, Math.min(maxItems, pool.length));
    for (let i = 0; i < take.length; i++) {
        const p = take[i];
        const div = document.createElement('div');
        div.className = 'collage-item';
        const img = document.createElement('img');
        img.src = (p.image && p.image[0]) ? p.image[0] : 'img/favicon.png';
        img.alt = p.name || 'producto';
        img.loading = 'lazy';
        img.dataset.id = p.id;
        div.appendChild(img);

        // random spans 1..3 but prefer smaller spans for more tiles
        const spanX = Math.random() < 0.25 ? 3 : (Math.random() < 0.35 ? 2 : 1);
        const spanY = Math.random() < 0.25 ? 3 : (Math.random() < 0.35 ? 2 : 1);
        div.style.gridColumnEnd = `span ${spanX}`;
        div.style.gridRowEnd = `span ${spanY}`;

        div.addEventListener('click', () => openProductModal(p.id));
        collageGrid.appendChild(div);
    }
}

// Carousel images
function updateCarousel(images) {
    if (!carouselImagesContainer) return;
    carouselImagesContainer.innerHTML = '';
    if (!images || images.length === 0) {
        carouselImagesContainer.innerHTML = `<div class="carousel-image" style="display:flex;align-items:center;justify-content:center;background:#f3f3f3">Sin imagen</div>`;
        return;
    }
    images.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.className = 'carousel-image';
        carouselImagesContainer.appendChild(img);
    });
    currentImageIndex = 0;
    carouselImagesContainer.style.transform = `translateX(0)`;
}

prevBtn && prevBtn.addEventListener('click', () => {
    if (currentImageIndex > 0) currentImageIndex--;
    updateCarouselPosition();
});
nextBtn && nextBtn.addEventListener('click', () => {
    const imgs = carouselImagesContainer.querySelectorAll('.carousel-image');
    if (currentImageIndex < imgs.length - 1) currentImageIndex++;
    updateCarouselPosition();
});
function updateCarouselPosition() {
    const imgs = carouselImagesContainer.querySelectorAll('.carousel-image');
    if (imgs.length === 0) return;
    const imgWidth = imgs[0].clientWidth || carouselImagesContainer.clientWidth;
    carouselImagesContainer.style.transform = `translateX(-${currentImageIndex * imgWidth}px)`;
}
window.addEventListener('resize', updateCarouselPosition);

// CART (includes size & color)
function updateCart() {
    if (!cartItemsContainer) return;
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío.</p>';
        cartBadge.style.display = 'none';
        cartBadge.textContent = '0';
        cartTotalElement.textContent = money(0);
        return;
    }
    let total = 0, totalItems = 0;
    cart.forEach((item, idx) => {
        total += item.price * item.qty;
        totalItems += item.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;">
            <img src="${item.image}" alt="${escapeHtml(item.name)}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;">
            <div style="min-width:160px;">
              <div style="font-weight:700">${escapeHtml(item.name)}</div>
              <div style="font-size:0.86rem;color:#666">Talla: ${escapeHtml(item.size || '')} • Color: ${escapeHtml(item.color || '')}</div>
              <div style="font-size:0.86rem;color:#666">Precio: $${money(item.price)}</div>
            </div>
          </div>
          <div class="controls">
            <button class="qty-btn" data-idx="${idx}" data-op="dec">-</button>
            <div style="min-width:26px;text-align:center">${item.qty}</div>
            <button class="qty-btn" data-idx="${idx}" data-op="inc">+</button>
          </div>
        `;
        cartItemsContainer.appendChild(div);
    });
    cartBadge.style.display = 'flex';
    cartBadge.textContent = String(totalItems);
    cartTotalElement.textContent = money(total);
}

function addToCart(id, qty = 1, size = '', color = '') {
    const p = products.find(x => x.id === id);
    if (!p) return;
    if (!size || !color) {
        alert('Seleccione talla y color antes de añadir al carrito.');
        return;
    }
    const availableStock = p.stock || 0;
    const existingInCart = cart.find(i => i.id === id && i.size === size && i.color === color);
    const currentQtyInCart = existingInCart ? existingInCart.qty : 0;
    if (currentQtyInCart + qty > availableStock) {
        alert(`En el momento solo quedan ${availableStock} unidades.`);
        return;
    }
    if (existingInCart) existingInCart.qty += qty;
    else cart.push({ id: p.id, name: p.name, price: p.price, qty, image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png', size, color });
    updateCart();
    showAddToCartToast({ image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png', name: p.name, qty });
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function showAddToCartToast({ image, name, qty = 1 }) {
    const existing = document.getElementById('add-to-cart-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'add-to-cart-toast';
    toast.className = 'add-to-cart-toast';
    const safeName = escapeHtml(name);
    toast.innerHTML = `<img src="${image}" alt="${safeName}" class="toast-img" loading="lazy" /><div class="toast-text"><div class="toast-title">${safeName}</div><div class="toast-sub">Añadido x${qty}</div></div>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    const VISIBLE_MS = 2000;
    setTimeout(() => {
        toast.classList.remove('show'); toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, VISIBLE_MS);
}

cartItemsContainer && cartItemsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-idx]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const op = btn.dataset.op;
    const productInCart = cart[idx];
    if (!productInCart) return;
    const originalProduct = products.find(p => p.id === productInCart.id);
    if (op === 'inc') {
        if ((productInCart.qty + 1) > (originalProduct.stock || 0)) {
            alert(`En el momento solo quedan ${originalProduct.stock} unidades.`);
            return;
        }
        productInCart.qty++;
    }
    if (op === 'dec') {
        productInCart.qty--;
        if (productInCart.qty <= 0) cart.splice(idx, 1);
    }
    updateCart();
});

cartBtn && cartBtn.addEventListener('click', () => {
    showModal(cartModal);
    updateCart();
});

checkoutBtn && checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) {
        alert('El carrito está vacío');
        return;
    }
    showModal(checkoutModal);
});

finalizeBtn && finalizeBtn.addEventListener('click', () => {
    const name = customerNameInput.value.trim();
    const address = customerAddressInput.value.trim();
    const payment = document.querySelector('input[name="payment"]:checked')?.value || '';
    if (!termsConsentCheckbox.checked) {
        alert('Debes aceptar los Términos y Condiciones y la Política de Datos para continuar.');
        return;
    }
    if (!name || !address) {
        alert('Por favor completa nombre y dirección');
        return;
    }
    orderDetails = { name, address, payment, items: [...cart], total: cart.reduce((acc, item) => acc + item.price * item.qty, 0) };
    closeModal(checkoutModal);
    closeModal(cartModal);
    showOrderSuccessModal();
});

function showOrderSuccessModal() {
    if (orderDetails.total) orderSuccessTotal.textContent = money(orderDetails.total);
    showModal(orderSuccessModal);
}

// WhatsApp flow (kept)
whatsappBtn && whatsappBtn.addEventListener('click', async () => {
    if (Object.keys(orderDetails).length === 0) { alert('No hay detalles del pedido para enviar.'); return; }
    if (!supabaseClient) { alert('El cliente no está inicializado. Inténtalo de nuevo.'); return; }
    try {
        const { data: orderData, error: orderError } = await supabaseClient
            .from('orders')
            .insert([{
                customer_name: orderDetails.name,
                customer_address: orderDetails.address,
                payment_method: orderDetails.payment,
                total_amount: orderDetails.total,
                order_items: orderDetails.items,
                order_status: 'Pendiente',
            }]).select();
        if (orderError) { console.error('Error DB:', orderError); alert('Error al guardar la orden en DB: ' + orderError.message); return; }

        const response = await fetch('api/place-order', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderDetails, products })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Route Falló:', response.status, errorText);
        }

        const whatsappNumber = '573227671829';
        let message = `Hola mi nombre es ${encodeURIComponent(orderDetails.name)}.%0AHe realizado un pedido para la dirección ${encodeURIComponent(orderDetails.address)}.%0A%0A`;
        orderDetails.items.forEach(item => {
            message += `- ${encodeURIComponent(item.name)} (Talla: ${encodeURIComponent(item.size || '-')}, Color: ${encodeURIComponent(item.color || '-')}) x${item.qty} = $${money(item.price * item.qty)}%0A`;
        });
        message += `%0ATotal: $${money(orderDetails.total)}`;
        const link = `https://wa.me/${whatsappNumber}?text=${message}`;
        window.open(link, '_blank');

        cart = []; orderDetails = {};
        products = await fetchProductsFromSupabase();
        renderCollage(products, 12);
        showDefaultSections();
        updateCart();
        closeModal(orderSuccessModal);

    } catch (error) {
        alert('Error al procesar el pedido: ' + error.message);
        console.error('Fallo en el pedido:', error);
    }
});

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBanner.classList.add('visible');
});
installPromptBtn && installPromptBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    installBanner.classList.remove('visible');
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
});
installCloseBtn && installCloseBtn.addEventListener('click', () => installBanner.classList.remove('visible'));

// DB fetch
const fetchProductsFromSupabase = async () => {
    if (!supabaseClient) return [];
    try {
        const { data, error } = await supabaseClient.from('products').select('*');
        if (error) throw error;
        return data;
    } catch (err) {
        console.error('Error al cargar los productos:', err.message);
        alert('Hubo un error al cargar los productos. Revisa la consola.');
        return [];
    }
};

const loadConfigAndInitSupabase = async () => {
    try {
        const response = await fetch('api/get-config');
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error api/get-config:', errorText);
            throw new Error(`Fallo al cargar la configuración: ${response.status}`);
        }
        const config = await response.json();
        if (!config.url || !config.anonKey) throw new Error("El API Route no retornó las claves de DB.");
        SB_URL = config.url; SB_ANON_KEY = config.anonKey;
        supabaseClient = createClient(SB_URL, SB_ANON_KEY);
        products = await fetchProductsFromSupabase();
        if (products.length > 0) {
            renderCollage(products, 12);
            showDefaultSections();
            generateCategoryCarousel();
        } else {
            renderCollage([], 0);
        }
        updateCart();
    } catch (error) {
        console.error('Error FATAL al iniciar la app:', error);
        const loadingMessage = document.createElement('div');
        loadingMessage.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;color:red;font-weight:bold;text-align:center;padding:20px;z-index:9999';
        loadingMessage.textContent = 'ERROR DE INICIALIZACIÓN: No se pudo cargar la configuración de la tienda. Revisa la consola para más detalles.';
        document.body.appendChild(loadingMessage);
    }
};

document.addEventListener('DOMContentLoaded', loadConfigAndInitSupabase);