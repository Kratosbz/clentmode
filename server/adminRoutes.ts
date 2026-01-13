import type { Express, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { Collection, NFT, Sale, Auction, Exhibition, Transaction, Admin, FinancialRequest } from "./models";
import { sendDepositApprovalNotification, sendWithdrawalApprovalNotification } from "./email";
import User from "./models/User";

declare module 'express-session' {
  interface SessionData {
    adminId?: string;
    adminEmail?: string;
    adminRole?: string;
    impersonatedUserId?: string;
  }
}

const requireAdmin = (req: Request, res: Response, next: Function) => {
  if (!req.session.adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }
  next();
};

const requireSuperAdmin = (req: Request, res: Response, next: Function) => {
  if (!req.session.adminId) {
    return res.status(401).json({ message: 'Admin authentication required' });
  }
  if (req.session.adminRole !== 'superadmin') {
    return res.status(403).json({ message: 'Superadmin access required' });
  }
  next();
};

export function registerAdminRoutes(app: Express) {
  
  // Seed admin from environment variables on startup
  const seedAdmin = async () => {
    try {
      const adminEmail = process.env.ADMIN_EMAIL;
      const adminPassword = process.env.ADMIN_PASSWORD;
      
      if (!adminEmail || !adminPassword) {
        console.log('Admin credentials not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables to create admin account.');
        return;
      }

      const existingAdmin = await Admin.findOne({ email: adminEmail.toLowerCase() });
      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(adminPassword, 10);
        await Admin.create({
          email: adminEmail.toLowerCase(),
          password: hashedPassword,
          username: 'SuperAdmin',
          role: 'superadmin'
        });
        console.log('Admin account configured from environment variables.');
      }
    } catch (error) {
      console.error('Error seeding admin:', error);
    }
  };
  seedAdmin();

  // ===== ADMIN AUTHENTICATION =====
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const admin = await Admin.findOne({ email: email.toLowerCase() });
      if (!admin) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      admin.lastLogin = new Date();
      await admin.save();

      req.session.adminId = admin._id.toString();
      req.session.adminEmail = admin.email;
      req.session.adminRole = admin.role;

      res.json({ 
        message: 'Admin login successful',
        admin: {
          email: admin.email,
          username: admin.username,
          role: admin.role
        }
      });
    } catch (error) {
      console.error('Admin login error:', error);
      res.status(500).json({ message: 'Failed to login' });
    }
  });

  app.post('/api/admin/logout', (req: Request, res: Response) => {
    req.session.adminId = undefined;
    req.session.adminEmail = undefined;
    req.session.adminRole = undefined;
    req.session.impersonatedUserId = undefined;
    res.json({ message: 'Admin logged out successfully' });
  });

  app.get('/api/admin/session', (req: Request, res: Response) => {
    if (req.session.adminId) {
      res.json({ 
        authenticated: true,
        email: req.session.adminEmail,
        role: req.session.adminRole,
        impersonating: req.session.impersonatedUserId || null
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  // ===== DASHBOARD STATS =====
  app.get('/api/admin/stats', requireAdmin, async (_req: Request, res: Response) => {
    try {
      const [
        totalUsers,
        verifiedUsers,
        totalNfts,
        listedNfts,
        soldNfts,
        totalCollections,
        activeAuctions,
        totalExhibitions,
        pendingDeposits,
        pendingWithdrawals,
        totalTransactions
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ verified: true }),
        NFT.countDocuments(),
        NFT.countDocuments({ status: 'listed' }),
        NFT.countDocuments({ status: 'sold' }),
        Collection.countDocuments(),
        Auction.countDocuments({ status: 'active' }),
        Exhibition.countDocuments(),
        FinancialRequest.countDocuments({ type: 'deposit', status: 'pending' }),
        FinancialRequest.countDocuments({ type: 'withdrawal', status: 'pending' }),
        Transaction.countDocuments()
      ]);

      const totalVolume = await Sale.aggregate([
        { $match: { status: 'sold' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ]);

      const totalUserBalance = await User.aggregate([
        { $group: { _id: null, total: { $sum: '$walletBalance' } } }
      ]);

      res.json({
        users: { total: totalUsers, verified: verifiedUsers },
        nfts: { total: totalNfts, listed: listedNfts, sold: soldNfts },
        collections: totalCollections,
        auctions: activeAuctions,
        exhibitions: totalExhibitions,
        financials: { pendingDeposits, pendingWithdrawals },
        transactions: totalTransactions,
        volume: totalVolume[0]?.total || 0,
        totalUserBalance: totalUserBalance[0]?.total || 0
      });
    } catch (error) {
      console.error('Admin stats error:', error);
      res.status(500).json({ message: 'Failed to fetch stats' });
    }
  });

  // ===== USER MANAGEMENT =====
  app.get('/api/admin/users', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, search = '', status = '' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let query: any = {};
      if (search) {
        query.$or = [
          { email: { $regex: search, $options: 'i' } },
          { username: { $regex: search, $options: 'i' } }
        ];
      }
      if (status === 'verified') query.verified = true;
      if (status === 'unverified') query.verified = false;

      const [users, total] = await Promise.all([
        User.find(query).select('-password -verificationCode').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
        User.countDocuments(query)
      ]);

      res.json({ users, total, pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
      console.error('Fetch users error:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.get('/api/admin/users/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await User.findById(req.params.id).select('-password -verificationCode');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const [nftCount, transactionCount] = await Promise.all([
        NFT.countDocuments({ owner: user.email }),
        Transaction.countDocuments({ $or: [{ from: user.email }, { to: user.email }] })
      ]);

      res.json({ user, stats: { nftCount, transactionCount } });
    } catch (error) {
      console.error('Fetch user error:', error);
      res.status(500).json({ message: 'Failed to fetch user' });
    }
  });

  app.put('/api/admin/users/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { email, username, verified, walletBalance } = req.body;
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (email) user.email = email;
      if (username !== undefined) user.username = username;
      if (verified !== undefined) user.verified = verified;
      if (walletBalance !== undefined) user.walletBalance = walletBalance;

      await user.save();
      res.json({ message: 'User updated successfully', user });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  app.delete('/api/admin/users/:id', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Delete user's NFTs
      await NFT.deleteMany({ owner: user.email });
      await User.findByIdAndDelete(req.params.id);

      res.json({ message: 'User and associated NFTs deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  app.post('/api/admin/users/:id/impersonate', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      req.session.impersonatedUserId = user._id.toString();
      req.session.userId = user._id.toString();
      req.session.email = user.email;

      res.json({ message: `Now impersonating user: ${user.email}`, user: { email: user.email, username: user.username } });
    } catch (error) {
      console.error('Impersonate user error:', error);
      res.status(500).json({ message: 'Failed to impersonate user' });
    }
  });

  app.post('/api/admin/stop-impersonation', requireAdmin, async (req: Request, res: Response) => {
    req.session.impersonatedUserId = undefined;
    req.session.userId = undefined;
    req.session.email = undefined;
    res.json({ message: 'Stopped impersonation' });
  });

  // ===== NFT MANAGEMENT =====
  app.get('/api/admin/nfts', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, search = '', status = '', category = '' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let query: any = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { owner: { $regex: search, $options: 'i' } },
          { creator: { $regex: search, $options: 'i' } }
        ];
      }
      if (status) query.status = status;
      if (category) query.category = category;

      const [nfts, total] = await Promise.all([
        NFT.find(query).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
        NFT.countDocuments(query)
      ]);

      res.json({ nfts, total, pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
      console.error('Fetch NFTs error:', error);
      res.status(500).json({ message: 'Failed to fetch NFTs' });
    }
  });

  app.get('/api/admin/nfts/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const nft = await NFT.findById(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: 'NFT not found' });
      }
      res.json(nft);
    } catch (error) {
      console.error('Fetch NFT error:', error);
      res.status(500).json({ message: 'Failed to fetch NFT' });
    }
  });

  app.put('/api/admin/nfts/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, description, price, status, owner, category, royalty } = req.body;
      const nft = await NFT.findById(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: 'NFT not found' });
      }

      if (name) nft.name = name;
      if (description !== undefined) nft.description = description;
      if (price !== undefined) nft.price = price;
      if (status) nft.status = status;
      if (owner) nft.owner = owner;
      if (category) nft.category = category;
      if (royalty !== undefined) nft.royalty = royalty;

      await nft.save();
      res.json({ message: 'NFT updated successfully', nft });
    } catch (error) {
      console.error('Update NFT error:', error);
      res.status(500).json({ message: 'Failed to update NFT' });
    }
  });

  app.delete('/api/admin/nfts/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const nft = await NFT.findByIdAndDelete(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: 'NFT not found' });
      }

      // Also delete related sales and auctions
      await Sale.deleteMany({ nftId: nft._id });
      await Auction.deleteMany({ nftId: nft._id });

      res.json({ message: 'NFT deleted successfully' });
    } catch (error) {
      console.error('Delete NFT error:', error);
      res.status(500).json({ message: 'Failed to delete NFT' });
    }
  });

  app.post('/api/admin/nfts/:id/buy', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { buyerEmail, price } = req.body;
      const nft = await NFT.findById(req.params.id);
      if (!nft) {
        return res.status(404).json({ message: 'NFT not found' });
      }

      const salePrice = price || nft.price || 0;
      const previousOwner = nft.owner;
      const creatorEmail = nft.creator;

      // Credit the sale amount to the creator's wallet balance
      if (creatorEmail && salePrice > 0) {
        const creator = await User.findOne({ email: creatorEmail.toLowerCase() });
        if (creator) {
          creator.walletBalance = (creator.walletBalance || 0) + salePrice;
          await creator.save();
        }
      }

      nft.owner = buyerEmail || 'admin@vaultorx.com';
      nft.status = 'owned';
      await nft.save();

      // Create transaction record
      await Transaction.create({
        type: 'purchase',
        nft: nft._id,
        from: previousOwner,
        to: nft.owner,
        amount: salePrice,
        currency: nft.currency,
        status: 'completed',
        description: `Admin purchase: ${nft.name}`
      });

      res.json({ message: 'NFT purchased by admin', nft, amountCredited: salePrice });
    } catch (error) {
      console.error('Admin buy NFT error:', error);
      res.status(500).json({ message: 'Failed to purchase NFT' });
    }
  });

  // ===== COLLECTION MANAGEMENT =====
  app.get('/api/admin/collections', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, search = '' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let query: any = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { creator: { $regex: search, $options: 'i' } }
        ];
      }

      const [collections, total] = await Promise.all([
        Collection.find(query).skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
        Collection.countDocuments(query)
      ]);

      res.json({ collections, total, pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
      console.error('Fetch collections error:', error);
      res.status(500).json({ message: 'Failed to fetch collections' });
    }
  });

  app.put('/api/admin/collections/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { name, description, category, floorPrice } = req.body;
      const collection = await Collection.findById(req.params.id);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      if (name) collection.name = name;
      if (description !== undefined) collection.description = description;
      if (category) collection.category = category;
      if (floorPrice !== undefined) collection.floorPrice = floorPrice;

      await collection.save();
      res.json({ message: 'Collection updated successfully', collection });
    } catch (error) {
      console.error('Update collection error:', error);
      res.status(500).json({ message: 'Failed to update collection' });
    }
  });

  app.delete('/api/admin/collections/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const collection = await Collection.findByIdAndDelete(req.params.id);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      // Update NFTs in this collection
      await NFT.updateMany({ collectionId: collection._id }, { $unset: { collectionId: 1 } });

      res.json({ message: 'Collection deleted successfully' });
    } catch (error) {
      console.error('Delete collection error:', error);
      res.status(500).json({ message: 'Failed to delete collection' });
    }
  });

  // ===== FINANCIAL REQUESTS MANAGEMENT =====
  app.get('/api/admin/financial-requests', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, type = '', status = '' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let query: any = {};
      if (type) query.type = type;
      if (status) query.status = status;

      const [requests, total] = await Promise.all([
        FinancialRequest.find(query).populate('userId', 'email username walletBalance').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
        FinancialRequest.countDocuments(query)
      ]);

      res.json({ requests, total, pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
      console.error('Fetch financial requests error:', error);
      res.status(500).json({ message: 'Failed to fetch requests' });
    }
  });

  app.post('/api/admin/financial-requests/:id/approve', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { adminNote } = req.body;
      const request = await FinancialRequest.findById(req.params.id).populate('userId');
      if (!request) {
        return res.status(404).json({ message: 'Request not found' });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Request already processed' });
      }

      const user = await User.findById(request.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (request.type === 'deposit') {
        user.walletBalance += request.amount;
      } else if (request.type === 'withdrawal') {
        if (user.walletBalance < request.amount) {
          return res.status(400).json({ message: 'Insufficient user balance' });
        }
        user.walletBalance -= request.amount;
      }

      await user.save();

      request.status = 'approved';
      request.adminNote = adminNote;
      request.processedBy = req.session.adminId as any;
      request.processedAt = new Date();
      await request.save();

      // Send email notification
      if (request.type === 'deposit') {
        sendDepositApprovalNotification(user.email, request.amount, 'approved').catch(err => 
          console.error('Failed to send deposit approval email:', err)
        );
      } else {
        sendWithdrawalApprovalNotification(user.email, request.amount, 'approved').catch(err => 
          console.error('Failed to send withdrawal approval email:', err)
        );
      }

      // Create transaction record
      await Transaction.create({
        type: request.type === 'deposit' ? 'transfer' : 'transfer',
        from: request.type === 'deposit' ? 'External Wallet' : user.email,
        to: request.type === 'deposit' ? user.email : request.walletAddress || 'External Wallet',
        amount: request.amount,
        currency: request.currency,
        status: 'completed',
        description: `${request.type.charAt(0).toUpperCase() + request.type.slice(1)} approved: ${request.amount} ${request.currency}`
      });

      res.json({ message: `${request.type} approved successfully`, request });
    } catch (error) {
      console.error('Approve request error:', error);
      res.status(500).json({ message: 'Failed to approve request' });
    }
  });

  app.post('/api/admin/financial-requests/:id/decline', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { adminNote } = req.body;
      const request = await FinancialRequest.findById(req.params.id);
      if (!request) {
        return res.status(404).json({ message: 'Request not found' });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Request already processed' });
      }

      request.status = 'declined';
      request.adminNote = adminNote || 'Request declined by admin';
      request.processedBy = req.session.adminId as any;
      request.processedAt = new Date();
      await request.save();

      // Send rejection email notification
      const user = await User.findById(request.userId);
      if (user) {
        if (request.type === 'deposit') {
          sendDepositApprovalNotification(user.email, request.amount, 'rejected').catch(err => 
            console.error('Failed to send deposit rejection email:', err)
          );
        } else {
          sendWithdrawalApprovalNotification(user.email, request.amount, 'rejected').catch(err => 
            console.error('Failed to send withdrawal rejection email:', err)
          );
        }
      }

      res.json({ message: `${request.type} declined`, request });
    } catch (error) {
      console.error('Decline request error:', error);
      res.status(500).json({ message: 'Failed to decline request' });
    }
  });

  // ===== SALES & AUCTIONS MANAGEMENT =====
  app.get('/api/admin/sales', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, status = '' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let query: any = {};
      if (status) query.status = status;

      const [sales, total] = await Promise.all([
        Sale.find(query).populate('nftId').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
        Sale.countDocuments(query)
      ]);

      res.json({ sales, total, pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
      console.error('Fetch sales error:', error);
      res.status(500).json({ message: 'Failed to fetch sales' });
    }
  });

  app.get('/api/admin/auctions', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, status = '' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let query: any = {};
      if (status) query.status = status;

      const [auctions, total] = await Promise.all([
        Auction.find(query).populate('nftId').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
        Auction.countDocuments(query)
      ]);

      res.json({ auctions, total, pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
      console.error('Fetch auctions error:', error);
      res.status(500).json({ message: 'Failed to fetch auctions' });
    }
  });

  app.put('/api/admin/auctions/:id', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, startingPrice, endTime } = req.body;
      const auction = await Auction.findById(req.params.id);
      if (!auction) {
        return res.status(404).json({ message: 'Auction not found' });
      }

      if (status) auction.status = status;
      if (startingPrice !== undefined) auction.startingPrice = startingPrice;
      if (endTime) auction.endTime = new Date(endTime);

      await auction.save();
      res.json({ message: 'Auction updated successfully', auction });
    } catch (error) {
      console.error('Update auction error:', error);
      res.status(500).json({ message: 'Failed to update auction' });
    }
  });

  // ===== TRANSACTIONS LOG =====
  app.get('/api/admin/transactions', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 50, type = '', status = '' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);

      let query: any = {};
      if (type) query.type = type;
      if (status) query.status = status;

      const [transactions, total] = await Promise.all([
        Transaction.find(query).populate('nft').skip(skip).limit(Number(limit)).sort({ createdAt: -1 }),
        Transaction.countDocuments(query)
      ]);

      res.json({ transactions, total, pages: Math.ceil(total / Number(limit)) });
    } catch (error) {
      console.error('Fetch transactions error:', error);
      res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  });

  // Create transaction record (admin)
  app.post('/api/admin/transactions', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { type, from, to, amount, currency, description, status = 'completed' } = req.body;

      if (!type || !amount) {
        return res.status(400).json({ message: 'Type and amount are required' });
      }

      const transaction = await Transaction.create({
        type,
        from: from || 'System',
        to: to || 'System',
        amount,
        currency: currency || 'ETH',
        description: description || `${type} transaction`,
        status
      });

      res.json({ message: 'Transaction created successfully', transaction });
    } catch (error) {
      console.error('Create transaction error:', error);
      res.status(500).json({ message: 'Failed to create transaction' });
    }
  });

  // Direct deposit to user (admin credits balance immediately)
  app.post('/api/admin/users/:id/deposit', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { amount, description, transactionHash } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Valid amount is required' });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Credit user balance
      user.walletBalance = (user.walletBalance || 0) + amount;
      await user.save();

      // Create transaction record
      await Transaction.create({
        type: 'deposit',
        from: 'Admin',
        to: user.email,
        amount,
        currency: 'ETH',
        description: description || `Admin deposit: ${transactionHash || 'Direct credit'}`,
        status: 'completed'
      });

      res.json({ 
        message: 'Deposit successful', 
        newBalance: user.walletBalance 
      });
    } catch (error) {
      console.error('Admin deposit error:', error);
      res.status(500).json({ message: 'Failed to process deposit' });
    }
  });

  // Direct withdrawal from user (admin debits balance)
  app.post('/api/admin/users/:id/withdraw', requireAdmin, async (req: Request, res: Response) => {
    try {
      const { amount, description } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Valid amount is required' });
      }

      const user = await User.findById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if ((user.walletBalance || 0) < amount) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      // Debit user balance
      user.walletBalance = (user.walletBalance || 0) - amount;
      await user.save();

      // Create transaction record
      await Transaction.create({
        type: 'withdrawal',
        from: user.email,
        to: 'Admin',
        amount,
        currency: 'ETH',
        description: description || 'Admin withdrawal',
        status: 'completed'
      });

      res.json({ 
        message: 'Withdrawal successful', 
        newBalance: user.walletBalance 
      });
    } catch (error) {
      console.error('Admin withdrawal error:', error);
      res.status(500).json({ message: 'Failed to process withdrawal' });
    }
  });

  // ===== ADMIN MANAGEMENT (Superadmin only) =====
  app.get('/api/admin/admins', requireSuperAdmin, async (_req: Request, res: Response) => {
    try {
      const admins = await Admin.find().select('-password');
      res.json(admins);
    } catch (error) {
      console.error('Fetch admins error:', error);
      res.status(500).json({ message: 'Failed to fetch admins' });
    }
  });

  app.post('/api/admin/admins', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { email, password, username, role } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({ message: 'Email, password, and username are required' });
      }

      const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
      if (existingAdmin) {
        return res.status(400).json({ message: 'Admin with this email already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const admin = await Admin.create({
        email: email.toLowerCase(),
        password: hashedPassword,
        username,
        role: role || 'admin'
      });

      res.json({ message: 'Admin created successfully', admin: { email: admin.email, username: admin.username, role: admin.role } });
    } catch (error) {
      console.error('Create admin error:', error);
      res.status(500).json({ message: 'Failed to create admin' });
    }
  });

  app.delete('/api/admin/admins/:id', requireSuperAdmin, async (req: Request, res: Response) => {
    try {
      const admin = await Admin.findById(req.params.id);
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      if (admin.role === 'superadmin') {
        return res.status(403).json({ message: 'Cannot delete superadmin account' });
      }

      await Admin.findByIdAndDelete(req.params.id);
      res.json({ message: 'Admin deleted successfully' });
    } catch (error) {
      console.error('Delete admin error:', error);
      res.status(500).json({ message: 'Failed to delete admin' });
    }
  });

  console.log('Admin routes registered');
}
