# Wimp-Drop - Full Custom Dropshipping eCommerce Platform

A complete, modern, and mobile-first dropshipping eCommerce platform built with **HTML, CSS, Vanilla JavaScript, Supabase, Flutterwave, and CJ Dropshipping API**.

![Status](https://img.shields.io/badge/Status-Active-green)
![Version](https://img.shields.io/badge/Version-1.0.0-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## 🌟 Features

### Customer Features
- **Product Catalog**: Browse thousands of products from CJ Dropshipping
- **Advanced Search & Filters**: Category, price range, sorting, and search
- **Product Details**: Images, variants, ratings, reviews
- **Shopping Cart**: Add/remove items, quantity management
- **Wishlist**: Save favorite products
- **Secure Checkout**: Multi-step checkout process
- **Multiple Payment Methods**: Credit card, bank transfer, USSD via Flutterwave
- **Order Tracking**: Real-time tracking with CJ Dropshipping
- **User Accounts**: Profile management, order history, addresses
- **Responsive Design**: Fully optimized for mobile, tablet, and desktop

### Admin/Vendor Features
- **Product Management**: Import from CJ Dropshipping catalog
- **Order Management**: View and manage orders
- **Dashboard**: Sales analytics and metrics
- **Inventory Sync**: Auto-sync with CJ Dropshipping
- **Order Automation**: Auto-forward orders to suppliers
- **Customer Management**: View customer data and history

### Technical Features
- **Clean Architecture**: Modular, maintainable code
- **Real-time Updates**: Supabase for live data
- **Secure Payments**: Flutterwave integration
- **Supplier Integration**: CJ Dropshipping API
- **Authentication**: Secure user authentication
- **Database**: PostgreSQL via Supabase
- **Edge Functions**: Server-side operations for security
- **API Proxies**: Keep API keys secure

---

## 📁 Project Structure

```
wimp-drop/
├── index.html                 # Homepage
├── css/
│   └── styles.css            # Global styles & design system
├── js/
│   ├── main.js              # Core app logic
│   └── api/
│       ├── supabase.js       # Supabase integration
│       ├── flutterwave.js    # Payment processing
│       └── cj-dropshipping.js # Product sourcing
├── pages/
│   ├── shop.html            # Product listing
│   ├── cart.html            # Shopping cart
│   ├── checkout.html        # Checkout page
│   ├── login.html           # User login
│   ├── register.html        # User registration
│   ├── account.html         # User account
│   ├── about.html           # About page
│   ├── contact.html         # Contact page
│   └── order-success.html   # Order confirmation
├── assets/                  # Images, icons, etc.
├── BACKEND_SETUP.md         # Backend configuration guide
└── README.md               # This file
```

---

## 🎨 Design System

### Color Palette
- **Primary Red**: `#e63a2e` - Accent color for CTAs and highlights
- **White**: `#ffffff` - Background
- **Black**: `#000000` - Text
- **Light Gray**: `#f5f5f5` - Secondary backgrounds
- **Medium Gray**: `#cccccc` - Borders and accents
- **Dark Gray**: `#333333` - Secondary text

### Typography
- **Headings**: Playfair Display (serif)
- **Body**: DM Sans (sans-serif)

### Spacing Scale
- XS: 0.5rem
- SM: 1rem
- MD: 1.5rem
- LG: 2rem
- XL: 3rem
- XXL: 4rem

---

## 🚀 Quick Start

### 1. Setup Project Files
The project files are already organized. Just configure your backend credentials.

### 2. Configure Environment Variables

Create a file in your frontend root called `config.js` and update:

```javascript
const CONFIG = {
  supabaseUrl: 'YOUR_SUPABASE_URL',
  supabaseKey: 'YOUR_SUPABASE_ANON_KEY',
  flutterwaveKey: 'YOUR_FLUTTERWAVE_PUBLIC_KEY',
  cjApiUrl: 'https://developers.cjdropshipping.com/api2.0/v1',
};
```

**⚠️ DO NOT commit sensitive keys!**

### 3. Set Up Backend

See [BACKEND_SETUP.md](BACKEND_SETUP.md) for comprehensive backend configuration:
- Supabase project setup
- Database schema creation
- Edge Functions deployment
- Environment secrets configuration

### 4. Local Development

```bash
# If using a local server
python -m http.server 8000

# Or use VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

Visit `http://localhost:8000` in your browser.

---

## 🔗 API Integration

### Supabase
- **Purpose**: Database, authentication, real-time updates
- **Location**: `js/api/supabase.js`
- **Setup**: See [BACKEND_SETUP.md](BACKEND_SETUP.md#supabase-setup)

### CJ Dropshipping API
- **Purpose**: Product catalog, inventory, orders, tracking
- **Location**: `js/api/cj-dropshipping.js`
- **Endpoint**: `https://developers.cjdropshipping.com/api2.0/v1`
- **Secure Proxy**: Via Supabase Edge Functions
- **Docs**: [CJ Developer Portal](https://developers.cjdropshipping.com)

### Flutterwave
- **Purpose**: Payment processing
- **Location**: `js/api/flutterwave.js`
- **Public Key**: Stored in frontend config
- **Secret Key**: Stored in Supabase secrets (never in frontend)
- **Docs**: [Flutterwave Developer](https://developer.flutterwave.com)

---

## 📱 Key Pages

### `index.html` - Homepage
- Hero section with CTA
- Featured products
- Category showcase
- Newsletter signup
- Footer with links

### `pages/shop.html` - Product Listing
- Product grid with filtering
- Category filter
- Price range filter
- Sort options (newest, popular, price, rating)
- Pagination
- Product cards with quick add-to-cart

### `pages/product.html` - Product Details (To Create)
- Full product images/gallery
- Product description
- Variants (sizes, colors)
- Customer reviews and ratings
- Related products
- Add to cart and wishlist

### `pages/cart.html` - Shopping Cart
- List of cart items
- Quantity adjustment
- Remove items
- Order summary
- Proceed to checkout button

### `pages/checkout.html` - Checkout
- Step 1: Shipping address
- Step 2: Shipping method
- Step 3: Payment method
- Order review
- Payment processing

### `pages/login.html` - Login
- Email/password fields
- Remember me option
- Forgot password link
- Social login options
- Sign up link

### `pages/account.html` - User Account
- Profile information
- Order history
- Saved addresses
- Wishlist
- Account settings
- Password change
- Delete account

---

## 🛒 Shopping Flow

1. **Browse Products**
   - Home page featured products
   - Shop page with filters
   - Product detail page

2. **Add to Cart**
   - Click "Add to Cart" button
   - Select quantity and variants
   - Cart updates in real-time

3. **Review Cart**
   - View all items
   - Adjust quantities
   - Remove items if needed
   - See order summary

4. **Checkout**
   - Enter shipping address
   - Select shipping method
   - Choose payment method
   - Review order

5. **Payment**
   - Flutterwave payment modal opens
   - Customer enters payment info
   - Payment verified
   - Order created

6. **Order Confirmation**
   - Order success page
   - Confirmation email
   - Order tracking available
   - Automatic CJ order creation

---

## 💳 Payment Integration

### Flutterwave Flow
1. Customer enters checkout
2. Initiates payment via `initiateFlutterwavePayment()`
3. Flutterwave modal opens
4. Customer completes payment
5. Callback returns payment status
6. Backend verifies transaction
7. Order recorded in database
8. CJ order automatically created
9. Confirmation email sent

### Supported Methods
- Credit/Debit Cards (Visa, Mastercard, Amex)
- Bank Transfer
- USSD
- Account Transfer
- QR Code
- Barter

---

## 📊 Admin Dashboard (To Create)

The admin dashboard page (`pages/admin-dashboard.html`) will include:
- Sales analytics
- Order management
- Product management
- Customer management
- Inventory tracking
- Refunds/Returns

---

## 🔐 Security

### Frontend Security
- No API keys in frontend (except public Flutterwave key)
- All sensitive operations via backend
- Input validation on all forms
- XSS protection via proper escaping

### Backend Security (Supabase)
- RLS (Row Level Security) policies
- Service role key never exposed
- Environment secrets for CJ API and Flutterwave
- Edge Functions for secure API proxying

### Data Security
- HTTPS/SSL everywhere
- Encrypted payments via Flutterwave
- Password hashing via Supabase Auth
- Session tokens for authentication

---

## 📝 Development Workflow

### Adding New Features
1. Create page HTML in `pages/` directory
2. Add styles to `css/styles.css`
3. Add JavaScript logic to `js/main.js` or dedicated module
4. Test locally with Live Server
5. Verify with backend services

### Creating New API Methods
1. Add method to appropriate class in `js/api/`
2. Create backend proxy function if needed
3. Test with browser console
4. Document in code comments

### Database Queries
Use the `SupabaseClient` class in `js/api/supabase.js`:
```javascript
// Query products
const products = await supabase.query('products', {
  select: '*',
  where: 'category=eq.electronics',
  limit: 20
});
```

---

## 🐛 Troubleshooting

### Products Not Loading
- Check Supabase URL and key in config
- Verify RLS policies allow reading products
- Check network tab for API errors
- Ensure CJ API key is valid

### Payment Failing
- Verify Flutterwave test credentials
- Check if using test public key
- Verify payment verification endpoint
- Check browser console for errors

### Cart Not Persisting
- Check localStorage in browser DevTools
- Verify cart.html is reading from localStorage
- Check if JavaScript errors in console

### Orders Not Creating
- Verify user is authenticated
- Check Supabase orders table RLS
- Verify order data structure
- Check Edge Function logs

---

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [CJ Dropshipping API Docs](https://developers.cjdropshipping.com)
- [Flutterwave Developer Docs](https://developer.flutterwave.com)
- [MDN Web Docs](https://developer.mozilla.org)
- [Web.dev Best Practices](https://web.dev)

---

## 🤝 Contributing

To contribute:
1. Create a new branch for your feature
2. Make changes following the code style
3. Test thoroughly
4. Submit pull request with description

---

## 📄 License

This project is licensed under the MIT License - see LICENSE file for details.

---

## 📧 Support

For issues and questions:
- Create an issue in the repository
- Contact: support@wimpdrop.com
- Documentation: See BACKEND_SETUP.md

---

## 🎯 Roadmap

### Phase 1 (Current)
- ✅ Homepage and product listing
- ✅ Shopping cart and checkout
- ✅ User authentication
- ✅ Payment integration

### Phase 2
- ⏳ Admin dashboard
- ⏳ Product reviews and ratings
- ⏳ Order tracking page
- ⏳ Wishlist sharing
- ⏳ Product recommendations

### Phase 3
- ⏳ Mobile app (React Native)
- ⏳ Seller dashboard
- ⏳ Multi-vendor support
- ⏳ Advanced analytics

---

**Built with ❤️ for modern eCommerce**

Version 1.0.0 | Last Updated: December 2025
#   w i m p d r o p  
 #   w i m p d r o p  
 #   w i m p d r o p  
 #   w i m p d r o p  
 #   w i m p d r o p  
 #   w i m p d r o p  
 #   w i m p y d r o p  
 