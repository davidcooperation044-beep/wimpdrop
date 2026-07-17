#!/bin/bash
# Quick setup script to initialize environment

echo "🚀 Wimp-Drop Environment Setup"
echo "================================"
echo ""

# Check if .env.local already exists
if [ -f .env.local ]; then
    echo "✓ .env.local already exists"
    echo ""
    echo "Current environment:"
    grep -E "^VITE_" .env.local | head -5
    echo ""
    read -p "Do you want to reset it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Keeping existing .env.local"
        exit 0
    fi
fi

# Copy template
if [ -f .env.example ]; then
    cp .env.example .env.local
    echo "✓ Created .env.local from .env.example"
else
    echo "✗ .env.example not found!"
    exit 1
fi

echo ""
echo "📝 Environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your actual API keys"
echo "2. Get credentials from:"
echo "   - Supabase: https://supabase.com"
echo "   - Flutterwave: https://flutterwave.com"
echo "   - CJ Dropshipping: https://developers.cjdropshipping.com"
echo "3. Reload your app in browser"
echo ""
echo "Check browser console:"
echo "  env.printStatus()    - Show environment status"
echo "  env.getMissing()     - Show missing variables"
echo ""
