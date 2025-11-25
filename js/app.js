/**
 * @license
 * Copyright © 2025 Tecnología y Soluciones Informáticas. Todos los derechos reservados.
 *
 * DONDE PETER PWA
 *
 * Este software es propiedad confidencial y exclusiva de TECSIN.
 * El permiso de uso de este software es temporal para pruebas en Donde Peter.
 *
 * Queda estrictamente prohibida la copia, modificación, distribución,
 * ingeniería inversa o cualquier otro uso no autorizado de este código
 * sin el consentimiento explícito por escrito del autor.
 *
 * Para más información, contactar a: sidsoporte@proton.me
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

// --- Lógica del carrusel de banner ---
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

// --- Funciones para renderizar productos ---
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
          <img src="${p.image[0]}" alt="${p.name}" class="product-image modal-trigger" data-id="${p.id}" loading="lazy" />
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
}

function showImageHints(container) {
    // Mostrar el hint de forma temporal en las primeras tarjetas (para indicar acción)
    try {
        const hints = container.querySelectorAll('.image-hint');
        // Mostrar en las primeras 6 tarjetas o las que haya
        const max = Math.min(6, hints.length);
        for (let i = 0; i < max; i++) {
            const h = hints[i];
            // añadir clase que dispara la animación/fade
            h.classList.add('show-hint');
            // animar con pequeño delay escalonado para efecto cascada
            h.style.transitionDelay = `${i * 120}ms`;
        }
        // quitar la clase después de X ms (por ejemplo 2200ms)
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
        // no bloquear si falla
        console.warn('showImageHints err', err);
    }
}

function enableTouchHints() {
  let lastTouchedCard = null;
  let lastTouchMoved = false;

  // Mostrar hint al tocar una tarjeta (touchstart)
  function onTouchStart(e) {
    lastTouchMoved = false;
    const card = e.target.closest('.product-card');
    if (!card) return;

    // No mostrar si el target es un control interactivo (botón, input, enlace)
    if (e.target.closest('button, a, input, textarea, select')) return;

    const hint = card.querySelector('.image-hint');
    if (!hint) return;

    // Mostrar hint (usa la misma clase .show-hint que el CSS de hint)
    hint.classList.add('show-hint');

    // Guardar y limpiar timeout anterior si existe
    if (card._hintTimeout) {
      clearTimeout(card._hintTimeout);
      card._hintTimeout = null;
    }

    // Ocultar automát. después de X ms
    card._hintTimeout = setTimeout(() => {
      hint.classList.remove('show-hint');
      card._hintTimeout = null;
    }, 2200);

    lastTouchedCard = card;
  }

  // Si detectamos movimiento, lo interpretamos como scroll y ocultamos el hint
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

  // Al terminar el touch, si fue un tap (no hubo movimiento) mantenemos el hint un poco
  function onTouchEnd() {
    if (!lastTouchedCard) return;
    const h = lastTouchedCard.querySelector('.image-hint');
    if (h && !lastTouchMoved) {
      // mantener un poco visible para que el usuario lo note al tocar
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

  // Delegación global ligera: passive para no bloquear scroll
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
    const filtered = products.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
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
    const filtered = products.filter(p => p.category.toLowerCase() === cat.toLowerCase());
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
        addToCart(currentProduct.id, qty);
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
    modalAddToCartBtn.dataset.id = product.id;
    updateCarousel(product.image || []);
    showModal(productModal);
}

// --- Anuncios ---
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
        div.innerHTML = `<div style="display:flex;align-items:center;gap:8px;"><img src="${item.image}" alt="${item.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"><div><strong>${item.name}</strong><div style="font-size:.9rem;color:#666">${item.qty} x $${money(item.price)}</div></div></div><div class="controls"><button class="qty-btn" data-idx="${idx}" data-op="dec">-</button><button class="qty-btn" data-idx="${idx}" data-op="inc">+</button></div>`;
        cartItemsContainer.appendChild(div);
    });
    cartBadge.style.display = 'flex';
    cartBadge.textContent = String(totalItems);
    cartTotalElement.textContent = money(total);
}

function addToCart(id, qty = 1) {
    const p = products.find(x => x.id === id);
    if (!p) return;

    // Verificar si hay suficiente stock
    const availableStock = p.stock || 0;
    const existingInCart = cart.find(i => i.id === id);
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
            image: p.image[0]
        });
    }

    updateCart();

    // Mostrar el toast de confirmación con imagen y título
    showAddToCartToast({
        image: p.image && p.image[0] ? p.image[0] : 'img/favicon.png',
        name: p.name,
        qty
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
function showAddToCartToast({ image, name, qty = 1 }) {
    // Si ya existe un toast activo, lo removemos para re-crear (evita duplicados)
    const existing = document.getElementById('add-to-cart-toast');
    if (existing) {
        existing.remove();
    }

    const toast = document.createElement('div');
    toast.id = 'add-to-cart-toast';
    toast.className = 'add-to-cart-toast';

    const safeName = escapeHtml(name);

    toast.innerHTML = `
      <img src="${image}" alt="${safeName}" class="toast-img" loading="lazy" />
      <div class="toast-text">
        <div class="toast-title">${safeName}</div>
        <div class="toast-sub">Añadido x${qty}</div>
      </div>
    `;

    // Añadir al DOM
    document.body.appendChild(toast);

    // Forzar reflow y disparar la animación CSS
    // (usa requestAnimationFrame para asegurar aplicación de la clase 'show')
    requestAnimationFrame(() => {
        toast.classList.add('show');
    });

    // Tiempo visible y salida animada
    const VISIBLE_MS = 2000;
    setTimeout(() => {
        toast.classList.remove('show');
        toast.classList.add('hide');
        // eliminar al terminar la transición
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
        items: [...cart],
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
        // 1. Guardar la orden en DB (tabla 'orders')
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
           
            console.error('Error al guardar la orden en DB:', orderError);
            alert('Error al guardar la orden en DB: ' + orderError.message);
            return;
        }
        
        // 2. Intentar llamar al API Route
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
        let message = `Hola mi nombre es ${encodeURIComponent(orderDetails.name)}.%0AHe realizado un pedido para la dirección ${encodeURIComponent(orderDetails.address)} quiero confirmar el pago en ${encodeURIComponent(orderDetails.payment)}.%0A%0A--- Mi pedido es: ---%0A`;
        orderDetails.items.forEach(item => {
            message += `- ${encodeURIComponent(item.name)} x${item.qty} = $${money(item.price * item.qty)}%0A`;
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
        }
        updateCart();
    } catch (error) {
        console.error('Error FATAL al iniciar la aplicación:', error);
        
        const loadingMessage = document.createElement('div');
        loadingMessage.style = 'position:fixed;top:0;left:0;width:100%;height:100%;background:white;display:flex;align-items:center;justify-content:center;color:red;font-weight:bold;text-align:center;padding:20px;z-index:9999;';
        loadingMessage.textContent = 'ERROR DE INICIALIZACIÓN: No se pudo cargar la configuración de la tienda. Revisa la consola para más detalles (Faltan variables de entorno en Vercel).';
        document.body.appendChild(loadingMessage);
    }
};


document.addEventListener('DOMContentLoaded', loadConfigAndInitSupabase);
