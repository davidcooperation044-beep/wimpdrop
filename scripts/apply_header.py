from pathlib import Path
import re

root = Path(__file__).resolve().parent.parent
header = '''<header class="site-header">
    <div class="header-container">
        <div class="site-nav-main">
            <div class="brand-group">
                <a href="/index.html" class="logo link-reset">Wimp<span>-Drop</span></a>
                <div class="nav-menu-trigger">
                    <button class="btn btn-outline btn-small nav-menu-btn" type="button" id="nav-menu-button" aria-expanded="false" aria-controls="site-nav-menu">
                        Shop <span class="nav-menu-chevron">▾</span>
                    </button>
                    <div class="nav-menu" id="site-nav-menu">
                        <a href="/pages/shop.html">All products</a>
                        <a href="/pages/shop.html?search=electronics">Electronics</a>
                        <a href="/pages/shop.html?search=fashion">Fashion</a>
                        <a href="/pages/shop.html?search=home">Home</a>
                        <a href="/pages/shop.html?search=accessories">Accessories</a>
                        <a href="/pages/shop.html?search=gadgets">Gadgets</a>
                    </div>
                </div>
            </div>
            <div class="site-search">
                <input id="site-search-input" type="search" placeholder="Search products, brands, categories…" autocomplete="off" data-search>
                <button class="btn btn-primary search-submit" id="site-search-submit" type="button">Search</button>
                <div class="search-suggestions" id="search-suggestions"></div>
            </div>
            <div class="site-actions">
                <button class="icon-btn mobile-search-toggle" id="mobile-search-toggle" type="button" aria-label="Open search">🔎</button>
                <a href="/pages/account.html" class="icon-link" aria-label="Account">👤</a>
                <a href="/pages/watchlist.html" class="icon-link" aria-label="Watchlist">♡<span class="badge" data-wishlist-badge style="display:none">0</span></a>
                <a href="/pages/cart.html" class="icon-link" aria-label="Cart">🛒<span class="badge" data-cart-badge style="display:none">0</span></a>
                <button class="icon-btn mobile-menu-btn" id="mobile-menu-button" type="button" aria-label="Open menu">☰</button>
            </div>
        </div>
    </div>
    <div class="site-subnav">
        <div class="subnav-links">
            <a href="/pages/shop.html" class="active">Shop</a>
            <a href="/pages/shop.html?search=electronics">Electronics</a>
            <a href="/pages/shop.html?search=fashion">Fashion</a>
            <a href="/pages/shop.html?search=home">Home</a>
            <a href="/pages/shop.html?search=accessories">Accessories</a>
            <a href="/pages/shop.html?search=gadgets">Gadgets</a>
        </div>
        <div class="subnav-promo">Search first, shop fast — new arrivals live from the catalog.</div>
    </div>
    <div class="mobile-search-panel" id="mobile-search-panel" aria-hidden="true">
        <div class="mobile-search-shell">
            <div class="site-search">
                <input id="mobile-site-search-input" type="search" placeholder="Search Wimp-Drop catalog…" autocomplete="off">
                <button class="btn btn-primary search-submit" id="mobile-search-submit" type="button">Search</button>
            </div>
            <div class="search-suggestions" id="mobile-search-suggestions"></div>
            <button class="btn btn-secondary btn-small mobile-search-close" type="button">Close</button>
        </div>
    </div>
</header>'''

files = [root / 'index.html'] + sorted(root.glob('pages/*.html'))
pattern = re.compile(r'<header>[\s\S]*?</header>', re.IGNORECASE)
modified = []
for path in files:
    text = path.read_text(encoding='utf-8')
    m = pattern.search(text)
    if not m:
        print('NO HEADER FOUND', path)
        continue
    new_text = text[:m.start()] + header + text[m.end():]
    if new_text != text:
        path.write_text(new_text, encoding='utf-8')
        modified.append(str(path))

print('Modified', len(modified), 'files')
for f in modified:
    print(f)
