/**
 * @license
 * Copyright © 2025 Tecnología y Soluciones Informáticas. Todos los derechos reservados.
 *
 * Adaptado: Catalogo de Vestuario - selección obligatoria de talla y color en modal.
 * Cambios: Collage: cada imagen enlaza al producto respectivo y tiene efecto de ampliación al seleccionar.
 *         Modal: opciones de talla/color centradas y lectura de tallas/colores desde la BD (soporta arrays o CSV).
 */

const { createClient } = supabase;

let SB_URL = null;
let SB_ANON_KEY = null;
let supabaseClient = null;

// --- Variables de estado ---
let cart = [];
let products = [];
let currentImageIndex = 0;
let currentProduct = null;
let deferredPrompt = null;
const PRODUCTS_PER_PAGE = 25;
let orderDetails = {};
let selectedSize = null;
let selectedColor = null;

// --- Referencias del DOM ---
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
const collageGrid = document.getElementById('collage-grid');

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

const sizeOptionsContainer = document.getElementById('size-options');
const colorOptionsContainer = document.getElementById('color-options');


// --- Funciones de Ayuda ---
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

// --- Lógica del carrusel de banner (sin cambios) ---
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
    let isDown = false,
        startXMouse;
    bannerCarousel.addEventListener('mousedown', e => {
        isDown = true;
        startXMouse = e.pageX;
    });
    bannerCarousel.addEventListener('mouseup', e => {
        if (!isDown) return;
        let diff = e.pageX - startXMouse;
        if (diff > 50) {
            currentBanner = (currentBanner - 1);
            updateBanner();
        } else if (diff < -50) {
            nextBanner();
        }
        isDown = false;
        resetInterval();
    });
    resetInterval();
}

// --- Funciones para renderizar productos (sin cambios importantes) ---
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
          <img src="${p.image && p.image[0] ? p.image[0] : 'img/favicon.png'}" alt="${p.name}" class="product-image modal-trigger" data-id="${p.id}" loading="lazy" />
          <div class="image-hint" aria-hidden="true">
            <i class="fas fa-hand-point-up" aria-hidden="true"></i>
            <span>Presiona para ver</span>
          </div>
        </div>
        ${stockOverlay}
        <div class="product-info">
          <div>
            <div class="product-name">${p.name}</div>
            <div class="product-description">${p.description}</div>
          </div>
          <div style="margin-top:8px">
            <div class="product-price">$${money(p.price)}</div>
          </div>
        </div>
      </div>
    `;
};


// --- Renderizado con paginación ---
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

    // Tras renderizar, mostramos hints pequeños
    try {
        showImageHints(container);
    } catch (e) {}
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
enableTouchHints();

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

/* Collage render:
   - ahora mapea imagen -> producto (usa product.image[0] y product.id)
   - cada imagen enlaza al producto correspondiente (abre modal)
   - efecto de ampliación al hover y al seleccionar (breve)
*/
function renderCollage() {
    if (!collageGrid) return;
    collageGrid.innerHTML = '';

    // crear pool de objetos { id, img }
    const pool = products
        .filter(p => p.image && p.image.length > 0)
        .map(p => ({ id: p.id, img: p.image[0] }));

    if (pool.length === 0) return;

    const shuffled = shuffleArray(pool.slice());

    // numero de celdas (4x4)
    const totalCells = 16;
    let idx = 0;

    while (idx < Math.min(shuffled.length, totalCells)) {
        const p = shuffled[idx];
        const item = document.createElement('div');
        item.className = 'collage-item';
        item.setAttribute('data-product-id', p.id);
        // spans aleatorios 1 o 2 pero evitando expandirse demasiadas veces
        const colSpan = Math.random() > 0.75 ? 2 : 1;
        const rowSpan = Math.random() > 0.75 ? 2 : 1;
        item.style.gridColumn = `span ${colSpan}`;
        item.style.gridRow = `span ${rowSpan}`;
        item.innerHTML = `<img src="${p.img}" loading="lazy" alt="collage">`;
        // click abre modal del producto
        item.addEventListener('click', (ev) => {
            // animación breve de selección
            item.classList.add('collage-item-selected');
            setTimeout(() => item.classList.remove('collage-item-selected'), 260);
            const id = item.getAttribute('data-product-id');
            if (id) openProductModal(id);
        });
        collageGrid.appendChild(item);
        idx++;
    }

    // rellenar si hay menos items que celdas
    while (collageGrid.children.length < totalCells) {
        const random = shuffled[Math.floor(Math.random() * shuffled.length)];
        const item = document.createElement('div');
        item.className = 'collage-item';
        item.setAttribute('data-product-id', random.id);
        item.style.gridColumn = `span 1`;
        item.style.gridRow = `span 1`;
        item.innerHTML = `<img src="${random.img}" loading="lazy" alt="collage">`;
        item.addEventListener('click', () => {
            item.classList.add('collage-item-selected');
            setTimeout(() => item.classList.remove('collage-item-selected'), 260);
            openProductModal(random.id);
        });
        collageGrid.appendChild(item);
    }
}

/* Helper para leer tallas/colores de acuerdo a la estructura de la BD:
   - soporta product.sizes (array), product.size (string con CSV o single)
   - soporta product.colors (array), product.color (string con CSV o single)
*/
function parseOptionsField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
        // dividir por comas si contiene coma, o por | o ;
        if (field.includes(',')) return field.split(',').map(s => s.trim()).filter(Boolean);
        if (field.includes('|')) return field.split('|').map(s => s.trim()).filter(Boolean);
        if (field.includes(';')) return field.split(';').map(s => s.trim()).filter(Boolean);
        // single value
        return [field.trim()];
    }
    // fallback
    return [];
}

/* Búsqueda y UI (sin cambios funcionales) */
searchInput.addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    if (!q) {
        showDefaultSections();
        return;
    }
    const filtered = products.filter(p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)) || (p.category && p.category.toLowerCase().includes(q)));
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
    renderCollage();
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
    const filtered = products.filter(p => p.category && p.category.toLowerCase() === cat.toLowerCase());
    filteredSection.style.display = 'block';
    featuredSection.style.display = 'none';
    offersSection.style.display = 'none';
    searchResultsTitle.textContent = cat;
    renderProducts(allFilteredContainer, filtered, 1, 20, true);
});

(function makeCarouselDraggable() {
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

document.addEventListener('click', (e) => {
    if (e.target.closest('.modal-trigger')) {
        const id = e.target.dataset.id;
        openProductModal(id);
    }
    if (e.target.id === 'modal-add-to-cart-btn') {
        const qty = Math.max(1, parseInt(qtyInput.value) || 1);
        if (!selectedSize || !selectedColor) {
            if (!selectedSize) document.getElementById('size-group').classList.add('required-pulse');
            if (!selectedColor) document.getElementById('color-group').classList.add('required-pulse');
            setTimeout(() => {
                document.getElementById('size-group').classList.remove('required-pulse');
                document.getElementById('color-group').classList.remove('required-pulse');
            }, 1500);
            alert('Debes seleccionar talla y color antes de añadir al carrito.');
            return;
        }
        addToCart(currentProduct.id, qty, selectedSize, selectedColor);
        closeModal(productModal);
    }
});

// --- Lógica de Modales ---
function showModal(modal) {
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    // limpiar selección temporal
    selectedSize = null;
    selectedColor = null;
    if (sizeOptionsContainer) sizeOptionsContainer.innerHTML = '';
    if (colorOptionsContainer) colorOptionsContainer.innerHTML = '';
    modalAddToCartBtn.disabled = true;
    modalAddToCartBtn.setAttribute('aria-disabled', 'true');
}

[productModal, cartModal, checkoutModal, orderSuccessModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
        if (e.target.classList.contains('modal-close')) {
            closeModal(modal);
        }
    });
});

closeSuccessBtn.addEventListener('click', () => {
    closeModal(orderSuccessModal);
});

function openProductModal(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    currentProduct = product;
    modalProductName.textContent = product.name;
    modalProductDescription.textContent = product.description;
    modalProductPrice.textContent = `$${money(product.price)}`;
    qtyInput.value = 1;
    selectedSize = null;
    selectedColor = null;
    renderSizeOptions(product);
    renderColorOptions(product);
    modalAddToCartBtn.dataset.id = product.id;
    // animación sutil en grupos para indicar obligatorio
    document.getElementById('size-group').classList.add('required-pulse');
    document.getElementById('color-group').classList.add('required-pulse');
    setTimeout(() => {
      document.getElementById('size-group').classList.remove('required-pulse');
      document.getElementById('color-group').classList.remove('required-pulse');
    }, 1400);
    updateCarousel(product.image || []);
    showModal(productModal);
}

/* Render options: ahora leen correctamente desde la estructura de la BD
   y centran las opciones visualmente (CSS también se actualiza) */
function renderSizeOptions(product) {
    if (!sizeOptionsContainer) return;
    sizeOptionsContainer.innerHTML = '';
    // buscar posibles campos: sizes (array), size (csv/string), size_options
    const raw = product.sizes || product.size || product.size_options || [];
    const sizes = parseOptionsField(raw);
    const finalSizes = sizes.length ? sizes : ['S','M','L','XL'];
    finalSizes.forEach(sz => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'selection-option';
        btn.textContent = sz;
        btn.addEventListener('click', () => {
            selectedSize = sz;
            sizeOptionsContainer.querySelectorAll('.selection-option').forEach(x => x.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('size-group').classList.remove('required-pulse');
            updateAddToCartEnabled();
        });
        sizeOptionsContainer.appendChild(btn);
    });
}

function renderColorOptions(product) {
    if (!colorOptionsContainer) return;
    colorOptionsContainer.innerHTML = '';
    const raw = product.colors || product.color || product.color_options || [];
    const colors = parseOptionsField(raw);
    const finalColors = colors.length ? colors : ['Negro','Blanco','Azul'];
    finalColors.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'selection-option';
        const isHex = /^#([0-9A-F]{3}){1,2}$/i.test(c);
        if (isHex) {
            btn.innerHTML = `<span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${c};vertical-align:middle;"></span>`;
            btn.title = c;
        } else {
            btn.textContent = c;
        }
        btn.addEventListener('click', () => {
            selectedColor = c;
            colorOptionsContainer.querySelectorAll('.selection-option').forEach(x => x.classList.remove('selected'));
            btn.classList.add('selected');
            document.getElementById('color-group').classList.remove('required-pulse');
            updateAddToCartEnabled();
        });
        colorOptionsContainer.appendChild(btn);
    });
}

function updateAddToCartEnabled() {
    if (selectedSize && selectedColor) {
        modalAddToCartBtn.disabled = false;
        modalAddToCartBtn.setAttribute('aria-disabled', 'false');
    } else {
        modalAddToCartBtn.disabled = true;
        modalAddToCartBtn.setAttribute('aria-disabled', 'true');
    }
}

// --- Anuncios (sin cambios) ---
document.querySelectorAll('.ad-image').forEach(img => {
    img.addEventListener('click', () => {
        const id = img.dataset.productId;
        openProductModal(id);
    });
});

function updateCarousel(images) {
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

prevBtn.addEventListener('click', () => {
    if (currentImageIndex > 0) currentImageIndex--;
    updateCarouselPosition();
});

nextBtn.addEventListener('click', () => {
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

function updateCart() {
    cartItemsContainer.innerHTML = '';
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart-msg">Tu carrito está vacío.</p>';
        cartBadge.style.display = 'none';
        cartBadge.textContent = '0';
        cartTotalElement.textContent = money(0);
        return;
    }
    let total = 0,
        totalItems = 0;
    cart.forEach((item, idx) => {
        total += item.price * item.qty;
        totalItems += item.qty;
        const div = document.createElement('div');
        div.className = 'cart-item';
        const itemInfo = `<div style="display:flex;align-items:center;gap:8px;">
            <img src="${item.image}" alt="${item.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;">
            <div>
              <div style="font-weight:700">${item.name}</div>
              <div style="font-size:0.85rem;color:#666">Talla: ${item.size} • Color: ${item.color}</div>
              <div style="font-size:0.9rem;color:#333">$${money(item.price)} x ${item.qty}</div>
            </div>
          </div>`;
        const controls = `<div class="controls">
            <button class="qty-btn" data-idx="${idx}" data-op="dec">-</button>
            <span>${item.qty}</span>
            <button class="qty-btn" data-idx="${idx}" data-op="inc">+</button>
          </div>`;
        div.innerHTML = itemInfo + controls;
        cartItemsContainer.appendChild(div);
    });
    cartBadge.style.display = 'flex';
    cartBadge.textContent = String(totalItems);
    cartTotalElement.textContent = money(total);
}

function addToCart(id, qty = 1, size = null, color = null) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    const availableStock = p.stock || 0;
    const existingInCart = cart.find(i => i.id === id && i.size === size && i.color === color);
    const currentQtyInCart = existingInCart ? existingInCart.qty : 0;

    if (currentQtyInCart + qty > availableStock) {
        alert(`En el momento solo quedan ${availableStock} unidades.`);
        return;
    }

    if (existingInCart) {
        existingInCart.qty += qty;
    } else {
        cart.push({
            id: p.id,
            name: p.name,
            price: p.price,
            qty,
            image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png',
            size,
            color
        });
    }

    updateCart();

    showAddToCartToast({
        image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png',
        name: p.name,
        qty,
        size,
        color
    });
}

/* Helper: escapar texto para evitar inyección en el toast */
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/* Helper: crea y anima el toast (se añade al body y se elimina tras el tiempo especificado) */
function showAddToCartToast({ image, name, qty = 1, size = '', color = '' }) {
    const existing = document.getElementById('add-to-cart-toast');
    if (existing) {
        existing.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'add-to-cart-toast';
    toast.className = 'add-to-cart-toast';

    const safeName = escapeHtml(name);
    const safeSize = escapeHtml(size);
    const safeColor = escapeHtml(color);

    toast.innerHTML = `
      <img src="${image}" alt="${safeName}" class="toast-img" loading="lazy" />
      <div class="toast-text">
        <div class="toast-title">${safeName}</div>
        <div class="toast-sub">Añadido x${qty} • ${safeSize} • ${safeColor}</div>
      </div>
    `;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    const VISIBLE_MS = 2000;
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        }, { once: true });
    }, VISIBLE_MS);
}

cartItemsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-idx]');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    const op = btn.dataset.op;

    const productInCart = cart[idx];
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

cartBtn.addEventListener('click', () => {
    showModal(cartModal);
    updateCart();
});

checkoutBtn.addEventListener('click', () => {
    if (cart.length === 0) {
        alert('El carrito está vacío');
        return;
    }
    showModal(checkoutModal);
});

finalizeBtn.addEventListener('click', () => {
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

    orderDetails = {
        name,
        address,
        payment,
        items: cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            qty: item.qty,
            size: item.size,
            color: item.color
        })),
        total: cart.reduce((acc, item) => acc + item.price * item.qty, 0)
    };

    closeModal(checkoutModal);
    closeModal(cartModal);
    showOrderSuccessModal();
});

function showOrderSuccessModal() {
    if (orderDetails.total) {
        orderSuccessTotal.textContent = money(orderDetails.total);
    }
    showModal(orderSuccessModal);
}

whatsappBtn.addEventListener('click', async () => {
    if (Object.keys(orderDetails).length === 0) {
        alert('No hay detalles del pedido para enviar.');
        return;
    }

    if (!supabaseClient) {
        alert('El cliente no está inicializado. Inténtalo de nuevo.');
        return;
    }

    try {
        // 1. Guardar la orden en DB (tabla 'orders') desde cliente (también lo hace API route)
        const { data: orderData, error: orderError } = await supabaseClient
            .from('orders')
            .insert([{
                customer_name: orderDetails.name,
                customer_address: orderDetails.address, 
                payment_method: orderDetails.payment,
                total_amount: orderDetails.total,
                order_items: orderDetails.items,
                order_status: 'Pendiente',
            }])
            .select();

        if (orderError) {
            console.error('Error al guardar la orden en DB (cliente):', orderError);
            alert('Error al guardar la orden en DB: ' + orderError.message);
            return;
        }
        
        // 2. Intentar llamar al API Route (para que el servidor haga updates sensibles)
        const response = await fetch('api/place-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                orderDetails,
                products 
            })
        });

        let result = {};
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Route Falló con status:', response.status, 'Respuesta:', errorText);
        } else {
             try {
                result = await response.json();
             } catch (e) {
                 console.warn('Advertencia: El API Route devolvió una respuesta OK, pero no era JSON válido:', e.message);
             }
        }

        // 3. Enviar mensaje de WhatsApp
        const whatsappNumber = '573227671829';
        let message = `Hola mi nombre es ${encodeURIComponent(orderDetails.name)}.%0AHe realizado un pedido para la dirección ${encodeURIComponent(orderDetails.address)}.%0A%0A`;
        orderDetails.items.forEach(item => {
            message += `- ${encodeURIComponent(item.name)} (Talla: ${encodeURIComponent(item.size)}, Color: ${encodeURIComponent(item.color)}) x${item.qty} = $${money(item.price * item.qty)}%0A`;
        });
        message += `%0ATotal: $${money(orderDetails.total)}`;
        const link = `https://wa.me/${whatsappNumber}?text=${message}`;
        window.open(link, '_blank');
        
        // 4. Limpiar y actualizar UI
        cart = []; 
        orderDetails = {}; 
        
        products = await fetchProductsFromSupabase(); 
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

// --- Funciones de DB ---
const fetchProductsFromSupabase = async () => {
    if (!supabaseClient) {
        return []; 
    }
    try {
        const { data, error } = await supabaseClient
            .from('products')
            .select('*');
        if (error) {
            throw error;
        }
        return data;
    } catch (err) {
        console.error('Error al cargar los productos:', err.message);
        alert('Hubo un error al cargar los productos. Por favor, revisa la consola para más detalles.');
        return [];
    }
};

const loadConfigAndInitSupabase = async () => {
    try {
        const response = await fetch('api/get-config');
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error del API Route api/get-config:', errorText);
            throw new Error(`Fallo al cargar la configuración desde V: ${response.status} ${response.statusText}`);
        }
        
        const config = await response.json();
        
        if (!config.url || !config.anonKey) {
             throw new Error("El API Route no retornó las claves de DB. Revisa las Variables de Entorno en Vercel.");
        }

        SB_URL = config.url;
        SB_ANON_KEY = config.anonKey;

        supabaseClient = createClient(SB_URL, SB_ANON_KEY);

        products = await fetchProductsFromSupabase();
        if (products.length > 0) {
            showDefaultSections();
            generateCategoryCarousel();
        } else {
            renderCollage();
        }
        updateCart();
    } catch (error) {
        console.error('Error FATAL al iniciar la aplicación:', error);
        
        const loadingMessage = document.createElement('div');
        loadingMessage.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;color:red;font-weight:bold;text-align:center;padding:1rem';
        loadingMessage.textContent = 'ERROR DE INICIALIZACIÓN: No se pudo cargar la configuración de la tienda. Revisa la consola para más detalles (Faltan variables de entorno en Vercel).';
        document.body.appendChild(loadingMessage);
    }
};


document.addEventListener('DOMContentLoaded', loadConfigAndInitSupabase);