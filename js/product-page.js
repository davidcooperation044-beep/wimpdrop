(function () {
  'use strict';

  function qs(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function formatMoney(value) {
    try {
      if (typeof formatCurrency === 'function') return formatCurrency(Number(value || 0));
    } catch (e) {}
    return '₦' + Number(value || 0).toLocaleString();
  }

  function safeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function getProductIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function buildVariantLabel(variant) {
    const parts = [
      variant.color,
      variant.size,
      variant.attribute_value,
      variant.variant_name,
      variant.variantLabel,
      variant.supplier_sku,
      variant.title
    ].filter(Boolean);
    return parts[0] || 'Standard';
  }

  function normalizeVariant(row) {
    const price = Number(row.price || row.current_price || row.sale_price || 0);
    const original = Number(row.original_price || row.compare_at_price || row.list_price || row.price || 0);
    const stock = Number(row.stock_quantity || 0);
    return {
      id: row.id || row.product_id || row.supplier_variant_id || row.supplier_product_id || '',
      product_id: row.product_id || row.productId || row.id || '',
      name: row.name || row.title || 'Product',
      title: row.title || row.name || 'Product',
      category: row.category || 'Essentials',
      subcategory: row.subcategory || 'Other',
      price,
      originalPrice: original,
      image: row.image_url || row.image || (Array.isArray(row.images) ? row.images[0] : '') || '',
      supplier: row.supplier || 'Wimp-Drop Catalog',
      shippingFrom: row.shipping_from || row.origin || row.supplier || 'Global',
      stock_quantity: stock,
      inStock: stock > 0,
      size: row.size || row.variant_size || '',
      color: row.color || row.variant_color || '',
      attribute_value: row.attribute_value || row.variant || '',
      variant_name: row.variant_name || row.variantLabel || '',
      supplier_sku: row.supplier_sku || row.sku || '',
      variantLabel: buildVariantLabel(row)
    };
  }

  async function loadProduct() {
    const productId = getProductIdFromUrl();
    if (!productId) {
      window.location.href = '/pages/shop.html';
      return;
    }

    let rows = [];
    try {
      if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized) {
        const productResult = await supabaseService.getProduct(productId);
        if (productResult && productResult.success && productResult.product) {
          rows = [productResult.product];
        }
      }
      if (!rows.length && Array.isArray(AppState.products)) {
        rows = AppState.products.filter(function (p) {
          return String(p.id) === String(productId) || String(p.product_id || p.id) === String(productId);
        });
      }
      if (!rows.length) {
        return;
      }

      const primary = rows[0];
      const variants = [];
      const supplierKey = primary.supplier_product_id || primary.supplierProductId || primary.product_id || primary.productId || productId;

      try {
        if (typeof supabaseService !== 'undefined' && supabaseService.isInitialized && supplierKey) {
          const variantRes = await supabaseService.getProductVariants(supplierKey);
          if (variantRes && variantRes.success && Array.isArray(variantRes.products)) {
            variantRes.products.forEach(function (row) { variants.push(normalizeVariant(row)); });
          }
        }
      } catch (e) {}

      if (!variants.length && Array.isArray(AppState.products)) {
        AppState.products.filter(function (p) {
          const matchA = String(p.supplier_product_id || p.supplierProductId || p.product_id || p.id) === String(supplierKey);
          const matchB = String(p.id) === String(productId) || String(p.product_id || p.id) === String(productId);
          return matchA || matchB;
        }).forEach(function (row) { variants.push(normalizeVariant(row)); });
      }

      if (!variants.length) {
        variants.push(normalizeVariant(primary));
      }

      renderProduct(variants, primary);
    } catch (e) {
      console.warn('product page load failed', e);
    }
  }

  function renderProduct(variants, primary) {
    const variantData = variants.slice();
    let selectedIndex = 0;
    const selectedId = new URLSearchParams(window.location.search).get('variant');
    if (selectedId) {
      const idx = variantData.findIndex(function (variant) { return String(variant.id) === String(selectedId); });
      if (idx >= 0) selectedIndex = idx;
    }

    const current = variantData[selectedIndex] || variantData[0];
    const breadcrumb = qs('product-breadcrumb');
    if (breadcrumb) {
      breadcrumb.innerHTML = '';
      const base = document.createElement('a');
      base.href = '/pages/shop.html';
      base.textContent = 'Shop';
      breadcrumb.appendChild(base);
      const sep = document.createElement('span');
      sep.textContent = ' / ';
      breadcrumb.appendChild(sep);
      const categoryLink = document.createElement('a');
      categoryLink.href = '/pages/shop.html?category=' + encodeURIComponent(current.category || 'Essentials');
      categoryLink.textContent = current.category || 'Essentials';
      breadcrumb.appendChild(categoryLink);
      const sep2 = document.createElement('span');
      sep2.textContent = ' / ';
      breadcrumb.appendChild(sep2);
      const currentText = document.createElement('span');
      currentText.textContent = current.title || current.name || 'Product';
      breadcrumb.appendChild(currentText);
    }

    const titleNode = qs('product-name');
    if (titleNode) titleNode.textContent = current.title || current.name || 'Product';

    const categoryNode = qs('product-category');
    if (categoryNode) categoryNode.textContent = current.category || 'Essentials';

    const priceNode = qs('product-price');
    if (priceNode) priceNode.textContent = formatMoney(current.price || 0);

    const originalNode = qs('product-original-price');
    if (originalNode) {
      originalNode.textContent = formatMoney(current.originalPrice || current.price || 0);
      originalNode.style.display = Number(current.originalPrice || 0) > Number(current.price || 0) ? 'inline' : 'none';
    }

    const discountNode = qs('product-discount');
    if (discountNode) {
      const diff = Number(current.originalPrice || 0) > Number(current.price || 0) ? Number(current.originalPrice || 0) - Number(current.price || 0) : 0;
      discountNode.textContent = diff > 0 ? 'Save ' + formatMoney(diff) : 'Best value';
    }

    const supplierNode = qs('product-supplier');
    if (supplierNode) supplierNode.textContent = current.supplier || 'Wimp-Drop Catalog';

    const stockPill = qs('stock-pill');
    if (stockPill) {
      stockPill.textContent = current.inStock ? 'In stock' : 'Out of stock';
    }

    const stockLine = qs('stock-line');
    if (stockLine) {
      stockLine.textContent = current.inStock ? (Number(current.stock_quantity || 0) <= 5 ? 'Only ' + current.stock_quantity + ' left in stock' : 'Ready for dispatch') : 'Currently unavailable';
    }

    const shippingLine = qs('shipping-line');
    if (shippingLine) {
      shippingLine.textContent = 'Ships from ' + (current.shippingFrom || 'Global') + ' • Order updates available after checkout';
    }

    const trustOrigin = qs('trust-origin-pill');
    if (trustOrigin) trustOrigin.textContent = 'Ships from ' + (current.shippingFrom || 'Global');

    const selectedSummary = qs('selected-variant-summary');
    if (selectedSummary) {
      selectedSummary.textContent = current.variantLabel || 'Standard option';
    }

    const mainImage = qs('product-main-image');
    if (mainImage) {
      mainImage.src = current.image || '/images/wimp.png';
      mainImage.alt = current.title || current.name || 'Product image';
    }

    const galleryImages = variantData.map(function (v) { return v.image || current.image || '/images/wimp.png'; }).filter(function (image, index, arr) { return image && arr.indexOf(image) === index; });
    const gallery = qs('thumbnail-gallery');
    const dots = qs('gallery-dots');
    if (gallery) {
      gallery.innerHTML = galleryImages.map(function (image, idx) {
        return '<button class="pd-thumb ' + (idx === 0 ? 'is-active' : '') + '" type="button" data-thumb="' + idx + '" aria-label="View image ' + (idx + 1) + '"><img src="' + esc(image) + '" alt="Product image ' + (idx + 1) + '" loading="lazy"></button>';
      }).join('');
    }
    if (dots) {
      dots.innerHTML = galleryImages.map(function (_, idx) {
        return '<button class="pd-dot ' + (idx === 0 ? 'is-active' : '') + '" type="button" data-dot="' + idx + '" aria-label="Select image ' + (idx + 1) + '"></button>';
      }).join('');
    }

    const container = qs('variants-container');
    if (container) {
      container.innerHTML = variantData.map(function (variant, idx) {
        const label = variant.variantLabel || variant.title || 'Standard';
        const selected = idx === selectedIndex ? ' is-selected' : '';
        return '<button type="button" class="pd-swatch' + selected + '" data-variant-index="' + idx + '">' + esc(label) + '</button>';
      }).join('');
    }

    const specs = qs('specs-table');
    if (specs) {
      specs.innerHTML = [
        ['Material / finish', current.category || 'Live catalog'],
        ['Supplier', current.supplier || 'Wimp-Drop Catalog'],
        ['SKU', current.supplier_sku || 'N/A'],
        ['Origin', current.shippingFrom || 'Global'],
        ['Availability', current.inStock ? 'In stock' : 'Out of stock']
      ].map(function (row) {
        return '<tr><td>' + esc(row[0]) + '</td><td>' + esc(row[1]) + '</td></tr>';
      }).join('');
    }

    const addButton = qs('add-to-cart-btn');
    if (addButton) {
      addButton.disabled = !current.inStock;
      addButton.textContent = current.inStock ? 'Add to cart' : 'Out of stock';
    }

    const bar = qs('mobile-buy-bar');
    if (bar) {
      bar.innerHTML = '<div class="pd-mobile-bar-inner"><div class="pd-mobile-price"><strong>' + esc(current.title || 'Product') + '</strong><span>' + formatMoney(current.price || 0) + '</span></div><button class="btn btn-primary btn-small" type="button" ' + (current.inStock ? '' : 'disabled') + ' onclick="addProductToCart()">' + (current.inStock ? 'Add to cart' : 'Sold out') + '</button></div>';
    }

    const wishlistBtn = qs('wishlist-btn');
    if (wishlistBtn && current && current.id) {
      const active = typeof isInWishlist === 'function' && isInWishlist(current.id);
      wishlistBtn.classList.toggle('active', active);
      wishlistBtn.textContent = active ? '♥ Saved' : '♡ Save';
    }

    document.addEventListener('click', function (event) {
      const variantButton = event.target.closest('[data-variant-index]');
      if (variantButton) {
        const idx = Number(variantButton.getAttribute('data-variant-index'));
        if (!Number.isNaN(idx)) {
          const next = variantData[idx];
          if (next) {
            const params = new URLSearchParams(window.location.search);
            params.set('variant', String(next.id));
            window.history.replaceState({}, '', window.location.pathname + '?' + params.toString());
            renderProduct(variantData, primary);
          }
        }
      }

      const thumbButton = event.target.closest('[data-thumb]');
      if (thumbButton) {
        const idx = Number(thumbButton.getAttribute('data-thumb'));
        const main = qs('product-main-image');
        const images = Array.from(document.querySelectorAll('.pd-thumb img')).map(function (img) { return img.src; });
        if (main && images[idx]) main.src = images[idx];
        document.querySelectorAll('.pd-thumb').forEach(function (el) { el.classList.toggle('is-active', Number(el.getAttribute('data-thumb')) === idx); });
        document.querySelectorAll('.pd-dot').forEach(function (dot) { dot.classList.toggle('is-active', Number(dot.getAttribute('data-dot')) === idx); });
      }

      const dotButton = event.target.closest('[data-dot]');
      if (dotButton) {
        const idx = Number(dotButton.getAttribute('data-dot'));
        const main = qs('product-main-image');
        const images = Array.from(document.querySelectorAll('.pd-thumb img')).map(function (img) { return img.src; });
        if (main && images[idx]) main.src = images[idx];
        document.querySelectorAll('.pd-dot').forEach(function (el) { el.classList.toggle('is-active', Number(el.getAttribute('data-dot')) === idx); });
        document.querySelectorAll('.pd-thumb').forEach(function (el) { el.classList.toggle('is-active', Number(el.getAttribute('data-thumb')) === idx); });
      }
    });

    const stage = qs('product-image-stage');
    if (stage) {
      stage.setAttribute('data-swipe-ready', 'true');
      let startX = 0;
      stage.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
      stage.addEventListener('touchend', function (e) {
        const delta = e.changedTouches[0].clientX - startX;
        if (Math.abs(delta) < 50) return;
        const images = Array.from(document.querySelectorAll('.pd-thumb img')).map(function (img) { return img.src; });
        const currentImage = qs('product-main-image').src;
        const currentIndex = images.indexOf(currentImage);
        const nextIndex = delta < 0 ? (currentIndex + 1) % images.length : (currentIndex - 1 + images.length) % images.length;
        const next = images[nextIndex];
        if (next) {
          qs('product-main-image').src = next;
          document.querySelectorAll('.pd-thumb').forEach(function (el) { el.classList.toggle('is-active', Number(el.getAttribute('data-thumb')) === nextIndex); });
          document.querySelectorAll('.pd-dot').forEach(function (dot) { dot.classList.toggle('is-active', Number(dot.getAttribute('data-dot')) === nextIndex); });
        }
      }, { passive: true });
    }
  }

  window.addEventListener('DOMContentLoaded', function () {
    loadProduct();
  });
})();
