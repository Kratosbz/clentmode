# Vaultorx NFT Marketplace

## Overview

Vaultorx is an NFT marketplace dashboard built with pure HTML, CSS, and JavaScript on the frontend with a Node.js/Express backend. The platform enables users to manage NFT collections, track sales and auctions, create virtual exhibitions, and monitor transaction activity. Uses MongoDB for all data storage.

## User Preferences

- Preferred communication style: Simple, everyday language
- Strictly NO React/TypeScript/TSX - pure HTML, CSS, JavaScript only
- Design uses green primary (#22c55e) for CTA buttons, blue (#3b82f6) for accents

## Technical Notes

- Minting fee is hard-coded at 0.2 ETH server-side (security critical - never trust client input)
- Authentication uses `req.session.userId`, not `(req as any).user`
- User model has `walletBalance` (ETH) and `wethBalance` (WETH) fields
- Platform wallet address: 0xe22a4544493ea404ba336e9e3
- Email integration: Configured via Resend
- Marketplace is the public index page (/) - Dashboard is at /dashboard
- WETH to ETH conversion: 15% fee is deducted from ETH balance, not WETH amount

## System Architecture

### Frontend Architecture
- **Technology**: Pure HTML5, CSS3, Vanilla JavaScript
- **Styling**: Bootstrap 5 + custom CSS variables
- **Icons**: Bootstrap Icons
- **Alerts**: SweetAlert2
- **Location**: `/client/` directory

Key pages:
- `index.html` - User dashboard (login, signup, collections, NFTs, etc.)
- `marketplace.html` - Public marketplace with search, categories, carousels
- `admin.html` - Admin panel for platform management
- `artwork.html` - Individual artwork detail page
- `artist.html` - Artist profile page
- `category.html` - Category browse page
- `support.html` - Support and FAQ page
- `forgot-password.html` - Password reset flow

### Backend Architecture
- **Framework**: Express.js with TypeScript (server-side only)
- **Database**: MongoDB via Mongoose ODM
- **Session**: express-session with connect-pg-simple
- **File Uploads**: Multer with Cloudinary integration
- **API Design**: RESTful endpoints prefixed with `/api/`

The server uses a modular structure:
- `server/routes.ts` - Main API endpoint definitions
- `server/adminRoutes.ts` - Admin-specific API routes
- `server/models/` - Mongoose models

### Data Models (MongoDB)

- **User** - User accounts with email, password, walletBalance, wethBalance
- **Collection** - NFT collections with metadata
- **NFT** - Detailed NFT documents with attributes, owner, creator
- **Sale** - Fixed-price listings
- **Auction** - Timed auctions with bid history
- **Exhibition** - Virtual/physical exhibition data
- **Transaction** - Complete transaction history
- **FinancialRequest** - Deposit/withdrawal requests pending admin approval
- **Admin** - Admin accounts

### Key Features

1. **User Authentication**: Email/password signup with OTP verification
2. **NFT Management**: Create, list, buy NFTs with ownership transfer
3. **WETH Balance System**: Sales proceeds go to WETH, convert to ETH with 15% fee (deducted from ETH balance)
4. **Deposit/Withdrawal**: Admin-approved deposits and withdrawals with history
5. **Admin Dashboard**: Full CRUD for all entities, financial request approval
6. **Marketplace**: Public browsing with search, categories, auto-scrolling carousels (serves as homepage)
7. **Forgot Password**: Code-based password reset flow

## URL Routes
- `/` - Public marketplace (landing page)
- `/marketplace` - Same as `/`
- `/dashboard` - User dashboard (login/signup/collections/NFTs)
- `/admin` - Admin panel
- `/artwork?id=xxx` - Individual artwork detail page
- `/artist?name=xxx` - Artist profile page
- `/category?category=xxx` - Category browse page
- `/support` - Support and FAQ page

## External Dependencies

### Database
- **MongoDB**: Document database (requires `MONGODB_URI` environment variable)

### Cloud Services
- **Cloudinary**: Image upload and CDN for NFT artwork
  - Requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### Required Environment Variables
- `MONGODB_URI` - MongoDB connection string
- `SESSION_SECRET` - Express session secret
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` - Cloudinary config
- `ADMIN_EMAIL`, `ADMIN_PASSWORD` - Default admin credentials

### Email Integration (Resend)
- **Email Service**: Resend integration configured via Replit connectors
  - Registration verification emails
  - OTP verification codes
  - Purchase confirmations (buyer)
  - Sale notifications (seller)
  - Password reset emails
  - Deposit/withdrawal approval notifications

## Development

Run with: `npm run dev`
This starts Express server serving both API and static files from `/client/`
