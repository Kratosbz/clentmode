// import type { Express, Request, Response } from "express";
// import type { Server } from "http";
// import path from "path";
// import fs from "fs";
// import { connectMongoDB } from "./mongodb";
// import session from "express-session";
//  import  UsersDatabase  from "./models/User";
// // ✅ FIX: CommonJS-safe directory resolution
// const __dirname = process.cwd();

// import {
//   upload,
//   uploadToCloudinary,
//   deleteFromCloudinary,
// } from "./cloudinary";

// import {
//   Collection,
//   NFT,
//   Sale,
//   Auction,
//   Exhibition,
//   Transaction,
//   FinancialRequest,
// } from "./models";

// import {
//   sendVerificationEmail,
//   sendPasswordResetEmail,
//   sendPurchaseConfirmation,
//   sendSaleNotification,
// } from "./email";

// import User from "./models/User";
// import bcrypt from "bcryptjs";
// import { registerAdminRoutes } from "./adminRoutes";

// declare module 'express-session' {
//   interface SessionData {
//     userId?: string;
//     email?: string;
//   }
// }

import express from "express";
import type { Request, Response, NextFunction } from "express";

import type { Server } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { connectMongoDB } from "./mongodb.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { upload, uploadToCloudinary, deleteFromCloudinary } from "./cloudinary.ts";
import { Collection, NFT, Sale, Auction, Exhibition, Transaction, FinancialRequest } from "./models";
import User from "./models/User.ts";
import bcrypt from "bcryptjs";
import  UsersDatabase  from "./models/User.ts";
import { registerAdminRoutes } from "./adminRoutes.ts";

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    email?: string;
  }
}


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Connect to MongoDB
  try {
    await connectMongoDB();
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  }

  // ===== REDIRECT OLD MARKETPLACE.HTML TO NEW ROUTE =====
  app.get('/marketplace.html', (req: Request, res: Response) => {
    res.redirect(301, '/marketplace');
  });

  // ===== AUTHENTICATION =====
  
  // Generate 6-digit verification code
  function generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Check session
  app.get('/api/auth/session', (req: Request, res: Response) => {
    if (req.session.userId) {
      res.json({ 
        authenticated: true, 
        userId: req.session.userId,
        email: req.session.email 
      });
    } else {
      res.json({ authenticated: false });
    }
  });

  async function getUser(req: Request, ){
    const {userId} = req.session;

    if (!userId){
    throw Error
    }

    const user  = await User.findById(userId);

     if (!user) {
        throw Error
      }

      return user.email

  }

  // Get user balance (both ETH and WETH)
  app.get('/api/user/balance', async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
    
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      const dbUser = await User.findById(userId);
      if (!dbUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ 
        balance: dbUser.walletBalance || 0,
        wethBalance: dbUser.wethBalance || 0
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get balance' });
    }
  });

  // Transfer WETH to ETH (with 15% fee)
  app.post('/api/user/convert-weth', async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      const userEm=await getUser(req)
      if (!userId) {
        return res.status(401).json({ message: 'Please login first' });
      }

      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid conversion amount' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const wethBalance = user.wethBalance || 0;
      if (wethBalance < amount) {
        return res.status(400).json({ message: 'Insufficient WETH balance' });
      }

      // Calculate 15% fee (deducted from ETH balance)
      const FEE_PERCENT = 15;
      const feeAmount = (amount * FEE_PERCENT) / 100;
      const ethBalance = user.walletBalance || 0;
      
      // Check if user has enough ETH to cover the fee
      if (ethBalance < feeAmount) {
        return res.status(400).json({ 
          message: `Insufficient ETH balance for conversion fee. You need ${feeAmount.toFixed(4)} ETH but have ${ethBalance.toFixed(4)} ETH.` 
        });
      }

      // Deduct from WETH and add full amount to ETH, then deduct fee from ETH
      user.wethBalance = wethBalance - amount;
      const netEthGain = amount - feeAmount; // Actual net gain after fee
      user.walletBalance = ethBalance + netEthGain; // Equivalent to: ethBalance - feeAmount + amount
      await user.save();

      // Record transaction
      await Transaction.create({
        type: 'conversion',
        from: user.email,
        to: user.email,
        amount: amount,
        owner:userEm,
        currency: 'WETH',
        status: 'completed',
        description: `Converted ${amount} WETH to ${netEthGain.toFixed(4)} ETH (15% fee: ${feeAmount.toFixed(4)} ETH)`
      });

      res.json({ 
        message: `Successfully converted ${amount} WETH to ${netEthGain.toFixed(4)} ETH`,
        originalAmount: amount,
        fee: feeAmount,
        netAmount: netEthGain, // Actual net ETH gained after fee
        newWethBalance: user.wethBalance,
        newBalance: user.walletBalance
      });
    } catch (error) {
      console.error('Transfer WETH error:', error);
      res.status(500).json({ message: 'Failed to transfer WETH' });
    }
  });

  // Get user deposit history
  app.get('/api/user/deposits', async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Please login first' });
      }

      const deposits = await FinancialRequest.find({ 
        userId, 
        type: 'deposit' 
      }).sort({ createdAt: -1 });

      res.json(deposits);
    } catch (error) {
      console.error('Fetch deposit history error:', error);
      res.status(500).json({ message: 'Failed to fetch deposit history' });
    }
  });

  // Get user withdrawal history
  app.get('/api/user/withdrawals', async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Please login first' });
      }

      const withdrawals = await FinancialRequest.find({ 
        userId, 
        type: 'withdrawal' 
      }).sort({ createdAt: -1 });

      res.json(withdrawals);
    } catch (error) {
      console.error('Fetch withdrawal history error:', error);
      res.status(500).json({ message: 'Failed to fetch withdrawal history' });
    }
  });

  // Support form submission
  app.post('/api/support', async (req: Request, res: Response) => {
    try {
      const { name, email, subject, orderId, message } = req.body;
      
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: 'All required fields must be filled' });
      }

      // Log support request (in production, this would go to a database or email service)
      console.log('Support request received:', { name, email, subject, orderId, message });
      
      // Create a transaction record for support inquiry
      await new Transaction({
        type: 'support',
        from: email,
        to: 'support',
        amount: 0,
        currency: 'ETH',
        owner:email,
        description: `Support inquiry: ${subject} - ${message.substring(0, 100)}...`,
      }).save();

      res.status(201).json({ message: 'Support request received successfully' });
    } catch (error) {
      console.error('Error submitting support request:', error);
      res.status(500).json({ message: 'Failed to submit support request' });
    }
  });

  // Signup
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { email, password, username } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verificationCode = generateVerificationCode();
      const verificationExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const user = new User({
        email: email.toLowerCase(),
        password: hashedPassword,
        username: username || email.split('@')[0],
        verified: false,
        verificationCode,
        verificationExpiry
      });

      await user.save();

      // Send verification email
      // sendVerificationEmail(email, verificationCode, username).catch(err => 
      //   console.error('Failed to send verification email:', err)
      // );
      console.log(`Verification code for ${email}: ${verificationCode}`);

      res.status(201).json({ 
        message: 'Account created. Please check your email for the verification code.',
        email: user.email
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Failed to create account' });
    }
  });

  // Verify Email
  app.post('/api/auth/verify-email', async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.verified) {
        return res.status(400).json({ message: 'Email already verified' });
      }

      if (user.verificationCode !== code) {
        return res.status(400).json({ message: 'Invalid verification code' });
      }

      if (user.verificationExpiry && new Date() > user.verificationExpiry) {
        return res.status(400).json({ message: 'Verification code expired' });
      }

      user.verified = true;
      user.verificationCode = undefined;
      user.verificationExpiry = undefined;
      await user.save();

      // Auto-login after verification
      req.session.userId = user._id.toString();
      req.session.email = user.email;

      res.json({ message: 'Email verified successfully' });
    } catch (error) {
      console.error('Verify error:', error);
      res.status(500).json({ message: 'Failed to verify email' });
    }
  });

  // Resend verification code
  app.post('/api/auth/resend-code', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.verified) {
        return res.status(400).json({ message: 'Email already verified' });
      }

      const verificationCode = generateVerificationCode();
      user.verificationCode = verificationCode;
      user.verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();

      // Send verification email
      sendVerificationEmail(email, verificationCode).catch(err => 
        console.error('Failed to send verification email:', err)
      );
      console.log(`New verification code for ${email}: ${verificationCode}`);

      res.json({ 
        message: 'Verification code sent to your email'
      });
    } catch (error) {
      console.error('Resend error:', error);
      res.status(500).json({ message: 'Failed to resend code' });
    }
  });

  // Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.verified) {
      const verificationCode = generateVerificationCode();
      user.verificationCode = verificationCode;
      user.verificationExpiry = new Date(Date.now() + 10 * 60 * 1000);
      await user.save();
      return res.status(403).json({
        message: 'Please verify your email first',
        needsVerification: true,
        email: user.email,
      });
    }

    // ✅ Set session
    req.session.userId = user._id.toString();
    req.session.email = user.email;

    // ✅ Save session and confirm
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.status(500).json({ message: 'Login succeeded but session failed' });
      }

      // Session successfully saved
      res.json({
        message: 'Login successful, session stored!',
        email: user.email,
        username: user.username,
        sessionStored: true // frontend can use this
      });
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Failed to login' });
  }
});



  // Logout
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: 'Failed to logout' });
      }
      res.clearCookie('connect.sid');
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Change Password
  app.post('/api/auth/change-password', async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Please login first' });
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required' });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters' });
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });

  // Forgot Password - Request reset code
  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        // Don't reveal if email exists or not for security
        return res.json({ message: 'If this email exists, a reset code has been sent' });
      }

      // Generate 6-digit reset code
      const resetCode = generateVerificationCode();
      user.resetPasswordCode = resetCode;
      user.resetPasswordExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await user.save();

      // Send password reset email
      sendPasswordResetEmail(email, resetCode).catch(err => 
        console.error('Failed to send password reset email:', err)
      );
      console.log(`Password reset code for ${email}: ${resetCode}`);

      res.json({ 
        message: 'If this email exists, a reset code has been sent'
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Failed to process request' });
    }
  });

  // Verify reset code
  app.post('/api/auth/verify-reset-code', async (req: Request, res: Response) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ message: 'Email and code are required' });
      }

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(400).json({ message: 'Invalid request' });
      }

      if (!user.resetPasswordCode || user.resetPasswordCode !== code) {
        return res.status(400).json({ message: 'Invalid code' });
      }

      if (!user.resetPasswordExpiry || new Date() > user.resetPasswordExpiry) {
        // Clear expired code
        user.resetPasswordCode = undefined;
        user.resetPasswordExpiry = undefined;
        await user.save();
        return res.status(400).json({ message: 'Code has expired. Please request a new one.' });
      }

      // Generate a temporary token for password reset (different prefix to distinguish)
      const token = 'RST_' + Math.random().toString(36).substring(2) + Date.now().toString(36);
      user.resetPasswordToken = token; // Use separate field for token
      user.resetPasswordCode = undefined; // Clear the code so it can't be reused
      user.resetPasswordExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes to set new password
      await user.save();

      res.json({ 
        message: 'Code verified',
        token: token
      });
    } catch (error) {
      console.error('Verify reset code error:', error);
      res.status(500).json({ message: 'Failed to verify code' });
    }
  });

  // Reset password with token
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { email, token, newPassword } = req.body;
      
      if (!email || !token || !newPassword) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        return res.status(400).json({ message: 'Invalid request' });
      }

      if (!user.resetPasswordToken || user.resetPasswordToken !== token) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }

      if (!user.resetPasswordExpiry || new Date() > user.resetPasswordExpiry) {
        // Clear expired token
        user.resetPasswordToken = undefined;
        user.resetPasswordExpiry = undefined;
        await user.save();
        return res.status(400).json({ message: 'Token has expired. Please start over.' });
      }

      // Update password and clear reset fields
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      user.resetPasswordCode = undefined;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiry = undefined;
      await user.save();

      res.json({ message: 'Password reset successfully' });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Failed to reset password' });
    }
  });

  // ===== DASHBOARD STATS =====
  app.get('/api/stats', async (req: Request, res: Response) => {
    const userId = req.session.userId;

    const user = await UsersDatabase.findOne({ _id:userId });

  if (!user) {
    res.status(404).json({
      success: false,
      status: 404,
      message: "User not found",
    });

    return;
  }

    try {
      const [
        totalNfts,
        listedNfts,
        unlistedNfts,
        totalSales,
        activeAuctions,
        totalExhibitions,
        activeExhibitions,
      ] = await Promise.all([
        NFT.countDocuments({owner: user.email}),
        NFT.countDocuments({owner: user.email, status: 'listed' }),
        NFT.countDocuments({owner: user.email, status: 'owned' }),
        Sale.countDocuments({ seller: user.email,status: 'sold' }),
        Auction.countDocuments({ seller: user.email,status: 'active' }),
        Exhibition.countDocuments({owner: user.email}),
        Exhibition.countDocuments({owner: user.email,status: 'active' }),
      ]);

      const salesVolume = await Sale.aggregate([
        { $match: { seller: user.email,status: 'sold' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ]);
const listedVolume = await NFT.aggregate([
        { $match: { owner: user.email,status: 'listed' } },
        { $group: { _id: null, total: { $sum: '$price' } } }
      ]);
      const avgSalePrice = await Sale.aggregate([
        { $match: { seller: user.email,status: 'sold' } },
        { $group: { _id: null, avg: { $avg: '$price' } } }
      ]);

      res.json({
        totalBalanceUsd: '0.00',
        totalBalanceEth: '0.0000',
        ethBalance: '0.0000',
        wethBalance: '0.0000',
        totalNfts,
        listedNfts,
        unlistedNfts,
        totalSales,
        totalVolume: salesVolume[0]?.total || 0,
         listedVolume: listedVolume[0]?.total || 0,
        avgSalePrice: avgSalePrice[0]?.avg || 0,
        activeListings: listedNfts,
        activeAuctions,
        totalExhibitions,
        activeExhibitions,
      });
    } catch (error) {
      console.error('Error getting stats:', error);
      res.status(500).json({ message: 'Failed to get stats' });
    }
  });

  // ===== COLLECTIONS =====
  app.get('/api/collections', async (req: Request, res: Response) => {
  try {
    // 1️⃣ Get logged-in user email
    const userEmail = await getUser(req);
    if (!userEmail) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // 2️⃣ Find ONLY collections owned by this user
    const collections = await Collection.find({
      owner: { $regex: `^${userEmail.trim()}$`, $options: 'i' } // case-insensitive
    }).sort({ createdAt: -1 });

    res.json(collections);
  } catch (error) {
    console.error('Failed to get collections:', error);
    res.status(500).json({ message: 'Failed to get collections' });
  }
});


  app.get('/api/collections/:id', async (req: Request, res: Response) => {
    try {
      const collection = await Collection.findById(req.params.id);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }
      res.json(collection);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get collection' });
    }
  });

  app.post('/api/collections', upload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
  ]), async (req: Request, res: Response) => {
  
    const userEm = await getUser(req)
    
    try {
      const { name, symbol, description, category, royalty, blockchain } = req.body;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      let imageUrl, imagePublicId, bannerUrl, bannerPublicId;

      if (files?.image?.[0]) {
        const result = await uploadToCloudinary(files.image[0].buffer, 'collections');
        imageUrl = result.url;
        imagePublicId = result.publicId;
      }

      if (files?.banner?.[0]) {
        const result = await uploadToCloudinary(files.banner[0].buffer, 'collections/banners');
        bannerUrl = result.url;
        bannerPublicId = result.publicId;
      }

      const collection = new Collection({
        name,
        symbol,
        description,
        category,
        royalty: Number(royalty) || 0,
        blockchain: blockchain || 'Ethereum',
        imageUrl,
        imagePublicId,
        bannerUrl,
        bannerPublicId,
      });

      await collection.save();

      // Create transaction
      await new Transaction({
        type: 'mint',
        collection: collection._id,
        from: 'system',
        to: 'user',
         owner:userEm,
        description: `Created collection: ${name}`,
      }).save();

      res.status(201).json(collection);
    } catch (error) {
      console.error('Error creating collection:', error);
      res.status(500).json({ message: 'Failed to create collection' });
    }
  });

  app.delete('/api/collections/:id', async (req: Request, res: Response) => {
    try {
      const collection = await Collection.findById(req.params.id);
      if (!collection) {
        return res.status(404).json({ message: 'Collection not found' });
      }

      if (collection.imagePublicId) {
        await deleteFromCloudinary(collection.imagePublicId);
      }
      if (collection.bannerPublicId) {
        await deleteFromCloudinary(collection.bannerPublicId);
      }

      await Collection.findByIdAndDelete(req.params.id);
      res.json({ message: 'Collection deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete collection' });
    }
  });

  // ===== NFTs =====
  app.get('/api/nfts', async (req: Request, res: Response) => {
    
    try {
      const { status, collection: collectionId } = req.query;
      const filter: any = {};
      
      if (status) filter.status = status;
      if (collectionId) filter.collectionId = collectionId;

      const nfts = await NFT.find(filter).populate('collectionId').sort({ createdAt: -1 });
      
      const owned = nfts.filter(n => n.status === 'owned');
      const listed = nfts.filter(n => n.status === 'listed');
      const sold = nfts.filter(n => n.status === 'sold');

      res.json({
        all: nfts,
        owned,
        listed,
        sold,
        counts: {
          total: nfts.length,
          owned: owned.length,
          listed: listed.length,
          sold: sold.length,
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get NFTs' });
    }
  });

app.get('/api/nfts/user', async (req: Request, res: Response) => {
  try {
    const userEmail = await getUser(req);
    if (!userEmail) return res.status(401).json({ message: 'User not authenticated' });

    // Filter NFTs by email (case-insensitive)
    const filter: any = {
      owner: { $regex: `^${userEmail.trim()}$`, $options: 'i' }
    };

    
    const nfts = await NFT.find(filter)
      .populate('collectionId')
      .sort({ createdAt: -1 });

   
    const owned = nfts.filter(n => n.status === 'owned');
    const listed = nfts.filter(n => n.status === 'listed');
    const sold = nfts.filter(n => n.status === 'sold');
 const auction = nfts.filter(n => n.status === 'auction');
    res.json({
      all: nfts,
      owned,
      listed,
      sold,
      auction,
      counts: {
        total: nfts.length,
        owned: owned.length,
        listed: listed.length,
        sold: sold.length,
        auction:auction.length
      },
    });
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    res.status(500).json({ message: 'Failed to get NFTs', error: error.message });
  }
});


  app.get('/api/nfts/:id', async (req: Request, res: Response) => {
    try {
      const nft = await NFT.findById(req.params.id).populate('collectionId');
      if (!nft) {
        return res.status(404).json({ message: 'NFT not found' });
      }
      nft.views += 1;
      await nft.save();
      res.json(nft);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get NFT' });
    }
  });

  app.post('/api/nfts', upload.single('image'), async (req: Request, res: Response) => {

      const userEm = await getUser(req)
    
    try {
      const { name, description, collectionId, collection, price, currency, royalty, attributes, imageUrl: providedImageUrl, mediaType, category, rarity,tags } = req.body;
      const MINTING_FEE = 0.2; // Hard-coded minting fee - never trust client input
      console.log(tags);
      
      // Get authenticated user from session
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check user balance for minting fee
      const dbUser = await User.findById(userId);
      if (!dbUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const currentBalance = dbUser.walletBalance || 0;
      if (currentBalance < MINTING_FEE) {
        return res.status(400).json({ 
          message: `Insufficient balance. A minting fee of ${MINTING_FEE} ETH is required. Your balance: ${currentBalance.toFixed(4)} ETH` 
        });
      }
      
      const collId = collectionId || collection;
      let imageUrl = providedImageUrl;
      let imagePublicId = null;

      // If file was uploaded, use it; otherwise expect imageUrl in body
      if (req.file) {
        const uploadResult = await uploadToCloudinary(req.file.buffer, 'nfts');
        imageUrl = uploadResult.url;
        imagePublicId = uploadResult.publicId;
      }

      if (!imageUrl) {
        return res.status(400).json({ message: 'Image URL or file is required' });
      }

      // Validate collection if provided (before charging fee)
      let collectionRoyalty = 0;
      if (collId) {
        const collectionDoc = await Collection.findById(collId);
        if (!collectionDoc) {
          return res.status(404).json({ message: 'Collection not found' });
        }
        collectionRoyalty = collectionDoc.royalty || 0;
      }

      // Create the NFT first
      const nft = new NFT({
        name,
        description,
        imageUrl,
        imagePublicId,
        collectionId: collId || null,
        price: price ? Number(price) : undefined,
        currency: currency || 'ETH',
        royalty: Number(royalty) || collectionRoyalty || 0,
        attributes: typeof attributes === 'string' ? JSON.parse(attributes) : (attributes || []),
        status: 'owned',
        mediaType: mediaType || 'image',
        category: category || 'Art',
        rarity: rarity || 'Common',
        owner: dbUser.email,
        creator: dbUser.username,
        tags
      });

      await nft.save();

      // NFT saved successfully - now deduct the minting fee
      dbUser.walletBalance = currentBalance - MINTING_FEE;
      await dbUser.save();

      // Update collection count if applicable
      if (collId) {
        await Collection.findByIdAndUpdate(collId, { $inc: { nftCount: 1 } });
      }

      // Create transaction for minting fee
      await new Transaction({
        type: 'fee',
        nft: nft._id,
        from: dbUser.email,
        to: 'platform',
        amount: MINTING_FEE,
        currency: 'ETH',
        owner:userEm,
        description: `Minting fee for NFT: ${name}`,
      }).save();

      // Create transaction for mint
      await new Transaction({
        type: 'mint',
        nft: nft._id,
        collection: collId || null,
        from: 'system',
        to: dbUser.email,
        owner: dbUser.email,
        description: `Minted NFT: ${name}`,
      }).save();

      res.status(201).json(nft);
    } catch (error) {
      console.error('Error creating NFT:', error);
      res.status(500).json({ message: 'Failed to create NFT' });
    }
  });


  app.put('/api/sales/:id/cancel', async (req: Request, res: Response) => {
  try {
    // const userEm = await getUser(req);

    // 1️⃣ Find NFT
    const nft = await NFT.findById(req.params.id);
    if (!nft) {
      return res.status(404).json({ message: 'NFT not found' });
    }

    // 🔐 Ensure ownership
    // if (nft.owner !== userEm) {
    //   return res.status(403).json({ message: 'Unauthorized' });
    // }

    // 2️⃣ Only cancel if currently listed
    if (nft.status !== 'listed') {
      return res.status(400).json({ message: 'NFT is not listed' });
    }

    // 3️⃣ Restore ownership
    nft.status = 'owned';
    await nft.save();

    res.json({
      message: 'NFT listing cancelled successfully',
      nft,
    });
  } catch (error) {
    console.error('Cancel listing error:', error);
    res.status(500).json({ message: 'Failed to cancel listing' });
  }
});

app.get('/api/sales', async (req: Request, res: Response) => {
  try {
    const userEm = await getUser(req);
    if (!userEm) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { status } = req.query;

    // 🔒 Enforce owner filter
    const filter: any = { owner: userEm };

    if (status) filter.status = status;

    const sales = await Sale.find(filter)
      .populate({
        path: 'nft',
        populate: { path: 'collectionId' },
      })
      .sort({ createdAt: -1 });

    const stats = {
      total: sales.length,
      active: sales.filter(s => s.status === 'active').length,
      sold: sales.filter(s => s.status === 'sold').length,
      totalVolume: sales
        .filter(s => s.status === 'sold')
        .reduce((acc, s) => acc + (s.price || 0), 0),
    };

    res.json({ sales, stats });
  } catch (error) {
    console.error('Failed to get sales:', error);
    res.status(500).json({ message: 'Failed to get sales' });
  }
});

app.post('/api/sales', async (req: Request, res: Response) => {
    try {
      const { nftId, price, currency } = req.body;

      // Get authenticated user from session
      const userId = req.session.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const dbUser = await User.findById(userId);
      if (!dbUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const nft = await NFT.findById(nftId);
      if (!nft) {
        return res.status(404).json({ message: 'NFT not found' });
      }

      if (nft.status === 'listed') {
        return res.status(400).json({ message: 'NFT is already listed' });
      }

      const sale = new Sale({
        nft: nftId,
        price: Number(price),
        currency: currency || 'ETH',
        status: 'active',
        seller:dbUser.email
      });

      await sale.save();

      // Update NFT status
      nft.status = 'listed';
      nft.price = Number(price);
      nft.currency = currency || 'ETH';
      await nft.save();

      // Create transaction for sale listing
      await new Transaction({
        type: 'listed',
        nft: nftId,
        from: dbUser.email,
        owner: dbUser.email,
        to: 'marketplace',
        amount: Number(price),
        currency: currency || 'ETH',
        description: `Listed NFT for sale: ${nft.name}`,
      }).save();

      res.status(201).json(sale);
    } catch (error) {
      console.error('Error creating sale:', error);
      res.status(500).json({ message: 'Failed to create sale' });
    }
  });

  app.put('/api/sales/:id/buy', async (req: Request, res: Response) => {

      const userEm = await getUser(req)
    
    try {
      const sale = await NFT.findById(req.params.id).populate('nft');

      if (!sale) {
        return res.status(404).json({ message: 'Sale not found' });
      }

      if (sale.status !== 'listed') {
        return res.status(400).json({ message: 'Sale is not active' });
      }

      sale.status = 'sold';
      sale.buyer = 'buyer';
      sale.soldDate = new Date();
      await sale.save();

      const nft = await NFT.findById(sale.nft);
      if (nft) {
        nft.status = 'sold';
        nft.owner = 'buyer';
        await nft.save();
      }

      // Create transaction
      await new Transaction({
        type: 'purchase',
        nft: sale.nft._id,
        from: 'buyer',
        to: 'user',
        owner:userEm,
        amount: sale.price,
        currency: sale.currency,
        description: `NFT sold: ${(sale.nft as any).name}`,
      }).save();

      res.json(sale);
    } catch (error) {
      res.status(500).json({ message: 'Failed to complete sale' });
    }
  });

  // ===== AUCTIONS =====
  app.get('/api/auctions', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const filter: any = {};
      if (status) filter.status = status;

      const auctions = await Auction.find(filter).populate({
        path: 'nft',
        populate: { path: 'collectionId' }
      }).sort({ createdAt: -1 });

      const stats = {
        total: auctions.length,
        active: auctions.filter(a => a.status === 'active').length,
        ended: auctions.filter(a => a.status === 'ended').length,
        totalBids: auctions.reduce((acc, a) => acc + a.bids.length, 0),
        totalVolume: auctions.filter(a => a.status === 'ended' && a.currentBid).reduce((acc, a) => acc + (a.currentBid || 0), 0),
      };

      res.json({ auctions, stats });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get auctions' });
    }
  });


  app.get('/api/auctions/user', async (req: Request, res: Response) => {
    try {

      const userEm=await getUser(req)

      const { status } = req.query;
      const filter: any = {owner:userEm};
      if (status) filter.status = status;

      const auctions = await Auction.find(filter).populate({
        path: 'nft',
        populate: { path: 'collectionId' }
      }).sort({ createdAt: -1 });

      const stats = {
        total: auctions.length,
        active: auctions.filter(a => a.status === 'active').length,
        ended: auctions.filter(a => a.status === 'ended').length,
        totalBids: auctions.reduce((acc, a) => acc + a.bids.length, 0),
        totalVolume: auctions.filter(a => a.status === 'ended' && a.currentBid).reduce((acc, a) => acc + (a.currentBid || 0), 0),
      };

      res.json({ auctions, stats });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get auctions' });
    }
  });

  app.post('/api/auctions', async (req: Request, res: Response) => {
      const userEm = await getUser(req)
    
    try {
      const { 
        nftId, 
        auctionType, 
        startingPrice, 
        minimumBid, 
        bidIncrement, 
        startTime, 
        endTime,
        currency 
      } = req.body;

      const nft = await NFT.findById(nftId);
      if (!nft) {
        return res.status(404).json({ message: 'NFT not found' });
      }

      if (nft.status !== 'owned') {
        return res.status(400).json({ message: 'NFT is not available for auction' });
      }

      const auction = new Auction({
        nft: nftId,
        auctionType: auctionType || 'english',
        startingPrice: Number(startingPrice),
        minimumBid: Number(minimumBid),
        bidIncrement: Number(bidIncrement),
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        currency: currency || 'WETH',
        status: new Date(startTime) <= new Date() ? 'active' : 'pending',
      });

      await auction.save();

      nft.status = 'auction';
      await nft.save();

      // Create transaction
      await new Transaction({
        type: 'sale',
        nft: nftId,
        from: 'user',
        to: 'auction',
        owner:userEm,
        description: `Started auction for: ${nft.name}`,
      }).save();

      res.status(201).json(auction);
    } catch (error) {
      console.error('Error creating auction:', error);
      res.status(500).json({ message: 'Failed to create auction' });
    }
  });

  app.post('/api/auctions/:id/bid', async (req: Request, res: Response) => {
      const userEm = await getUser(req)
    
    try {
      const { amount, bidder } = req.body;
      const auction = await Auction.findById(req.params.id);
      
      if (!auction) {
        return res.status(404).json({ message: 'Auction not found' });
      }

      if (auction.status !== 'active') {
        return res.status(400).json({ message: 'Auction is not active' });
      }

      const bidAmount = Number(amount);
      const minBid = auction.currentBid 
        ? auction.currentBid + auction.bidIncrement 
        : auction.minimumBid;

      if (bidAmount < minBid) {
        return res.status(400).json({ message: `Minimum bid is ${minBid}` });
      }

      auction.bids.push({
        bidder: bidder || 'anonymous',
        amount: bidAmount,
        timestamp: new Date(),
      });
      auction.currentBid = bidAmount;
      await auction.save();

      // Create transaction
      await new Transaction({
        type: 'bid',
        nft: auction.nft,
        from: bidder || 'anonymous',
        to: 'auction',
        owner:userEm,
        amount: bidAmount,
        currency: auction.currency,
        description: `Placed bid: ${bidAmount} ${auction.currency}`,
      }).save();

      res.json(auction);
    } catch (error) {
      res.status(500).json({ message: 'Failed to place bid' });
    }
  });

  app.put('/api/auctions/:id/end', async (req: Request, res: Response) => {
      const userEm = await getUser(req)
    
    try {
      const auction = await Auction.findById(req.params.id);
      if (!auction) {
        return res.status(404).json({ message: 'Auction not found' });
      }

      auction.status = 'ended';
      if (auction.bids.length > 0) {
        const winningBid = auction.bids[auction.bids.length - 1];
        auction.winner = winningBid.bidder;

        const nft = await NFT.findById(auction.nft);
        if (nft) {
          nft.status = 'sold';
          nft.owner = winningBid.bidder;
          await nft.save();
        }

        // Create transaction
        await new Transaction({
          type: 'auction_win',
          nft: auction.nft,
          from: 'user',
          owner:userEm,
          to: winningBid.bidder,
          amount: winningBid.amount,
          currency: auction.currency,
          description: `Auction won for ${winningBid.amount} ${auction.currency}`,
        }).save();
      }

      await auction.save();
      res.json(auction);
    } catch (error) {
      res.status(500).json({ message: 'Failed to end auction' });
    }
  });

  // ===== EXHIBITIONS =====
  app.get('/api/exhibitions', async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const filter: any = {};
      if (status) filter.status = status;

      const exhibitions = await Exhibition.find(filter).populate('nfts').sort({ createdAt: -1 });

      const stats = {
        total: exhibitions.length,
        active: exhibitions.filter(e => e.status === 'active').length,
        totalViews: exhibitions.reduce((acc, e) => acc + e.views, 0),
        totalLikes: exhibitions.reduce((acc, e) => acc + e.likes, 0),
      };

      res.json({ exhibitions, stats });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get exhibitions' });
    }
  });

  app.get('/api/exhibitions/user', async (req: Request, res: Response) => {
    try {
      const userEm=await getUser(req)
      const { status } = req.query;
      const filter: any = {owner:userEm};
      if (status) filter.status = status;

      const exhibitions = await Exhibition.find(filter).populate('nfts').sort({ createdAt: -1 });

      const stats = {
        total: exhibitions.length,
        active: exhibitions.filter(e => e.status === 'active').length,
        totalViews: exhibitions.reduce((acc, e) => acc + e.views, 0),
        totalLikes: exhibitions.reduce((acc, e) => acc + e.likes, 0),
      };

      res.json({ exhibitions, stats });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get exhibitions' });
    }
  });
  app.post('/api/exhibitions', upload.fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
  ]), async (req: Request, res: Response) => {
    try {

      const userEm=await getUser(req);


      const { 
        title, 
        description, 
        category, 
        status, 
        startDate, 
        endDate, 
        locationType, 
        virtualUrl,
        physicalAddress,
        nfts: nftIds
      } = req.body;

      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      let thumbnailUrl, thumbnailPublicId, bannerUrl, bannerPublicId;

      if (files?.thumbnail?.[0]) {
        const result = await uploadToCloudinary(files.thumbnail[0].buffer, 'exhibitions');
        thumbnailUrl = result.url;
        thumbnailPublicId = result.publicId;
      }

      if (files?.banner?.[0]) {
        const result = await uploadToCloudinary(files.banner[0].buffer, 'exhibitions/banners');
        bannerUrl = result.url;
        bannerPublicId = result.publicId;
      }

      const exhibition = new Exhibition({
        title,
        description,
        category,
        status: status || 'draft',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        locationType: locationType || 'virtual',
        virtualUrl,
        physicalAddress,
        nfts: nftIds ? (Array.isArray(nftIds) ? nftIds : JSON.parse(nftIds)) : [],
        thumbnailUrl,
        thumbnailPublicId,
        bannerUrl,
        bannerPublicId,
        owner:userEm,
      });

      await exhibition.save();

      res.status(201).json(exhibition);
    } catch (error) {
      console.error('Error creating exhibition:', error);
      res.status(500).json({ message: 'Failed to create exhibition' });
    }
  });

  app.put('/api/exhibitions/:id', async (req: Request, res: Response) => {
    try {
      const exhibition = await Exhibition.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true }
      );
      if (!exhibition) {
        return res.status(404).json({ message: 'Exhibition not found' });
      }
      res.json(exhibition);
    } catch (error) {
      res.status(500).json({ message: 'Failed to update exhibition' });
    }
  });

  app.delete('/api/exhibitions/:id', async (req: Request, res: Response) => {
    try {
      const exhibition = await Exhibition.findById(req.params.id);
      if (!exhibition) {
        return res.status(404).json({ message: 'Exhibition not found' });
      }

      if (exhibition.thumbnailPublicId) {
        await deleteFromCloudinary(exhibition.thumbnailPublicId);
      }
      if (exhibition.bannerPublicId) {
        await deleteFromCloudinary(exhibition.bannerPublicId);
      }

      await Exhibition.findByIdAndDelete(req.params.id);
      res.json({ message: 'Exhibition deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete exhibition' });
    }
  });

  // ===== TRANSACTIONS =====
  app.get('/api/transactions', async (req: Request, res: Response) => {
  try {
    const userEm = await getUser(req);
    if (!userEm) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { type, status } = req.query;

    // 🔒 FORCE owner filter
    const filter: any = { owner: userEm };

    if (type) filter.type = type;
    if (status) filter.status = status;

    // ✅ Only user's transactions
    const transactions = await Transaction.find(filter)
      .populate('nft')
      .populate('collection')
      .sort({ createdAt: -1 })
      .limit(100);

    // ✅ Stats (already correct)
    const stats = {
      total: await Transaction.countDocuments({ owner: userEm }),
      sales: await Transaction.countDocuments({ owner: userEm, type: 'sale' }),
      purchases: await Transaction.countDocuments({ owner: userEm, type: 'purchase' }),
      mints: await Transaction.countDocuments({ owner: userEm, type: 'mint' }),
    };

    res.json({ transactions, stats });
  } catch (error) {
    console.error('Failed to get transactions:', error);
    res.status(500).json({ message: 'Failed to get transactions' });
  }
});

  // ===== SETTINGS =====
  let userSettings = {
   
  };


  

 app.get('/api/settings', async (req: Request, res: Response) => {
  try {
    const userEm = await getUser(req);

    if (!userEm) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userProfile = await UsersDatabase.findOne({ email: userEm });

    if (!userProfile) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(userProfile);
  } catch (error) {
    console.error('Settings fetch error:', error);
    res.status(500).json({ message: 'Failed to fetch settings' });
  }
});


  app.put('/api/settings', async (req: Request, res: Response) => {
  try {
    const userEm = await getUser(req);

    if (!userEm) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // ✅ Update user profile by email
    const updatedUser = await UsersDatabase.findOneAndUpdate(
      { email: userEm },
      { $set: req.body },
      { new: true, runValidators: true }
    ).select('-password -verificationCode -resetPasswordToken');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(updatedUser);
  } catch (error) {
    console.error('Failed to update settings:', error);
    res.status(500).json({ message: 'Failed to update settings' });
  }
});

  // ===== IMAGE UPLOAD =====
  app.post('/api/upload', upload.single('file'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const folder = req.body.folder || 'uploads';
      const result = await uploadToCloudinary(req.file.buffer, folder);

      res.json(result);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });

  // ===== MARKETPLACE PUBLIC ENDPOINTS =====
  
  app.get('/api/marketplace/nfts', async (req: Request, res: Response) => {
    try {
      const nfts = await NFT.find({ status: { $in: ['listed', 'auction', 'owned'] } })
        .sort({ createdAt: -1 })
        .lean();
      res.json(nfts);
    } catch (error) {
      console.error('Marketplace NFTs error:', error);
      res.status(500).json({ message: 'Failed to get NFTs' });
    }
  });

  app.get('/api/marketplace/auctions', async (req: Request, res: Response) => {
    try {
      const auctions = await Auction.find()
        .sort({ endTime: 1 })
        .lean();
      res.json(auctions);
    } catch (error) {
      console.error('Marketplace auctions error:', error);
      res.status(500).json({ message: 'Failed to get auctions' });
    }
  });

  app.get('/api/marketplace/exhibitions', async (req: Request, res: Response) => {
    try {
      const exhibitions = await Exhibition.find({ status: 'upcoming' })
        .sort({ startDate: 1 })
        .lean();
      res.json(exhibitions);
    } catch (error) {
      console.error('Marketplace exhibitions error:', error);
      res.status(500).json({ message: 'Failed to get exhibitions' });
    }
  });

  app.get('/api/marketplace/search', async (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query || query.length < 2) {
        return res.json([]);
      }

      const searchRegex = new RegExp(query, 'i');
      const nfts = await NFT.find({
        $or: [
          { name: searchRegex },
          { creator: searchRegex },
          { description: searchRegex },
          { category: searchRegex }
        ]
      })
      .limit(10)
      .lean();

      res.json(nfts);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ message: 'Search failed' });
    }
  });

  app.post('/api/marketplace/nfts/:id/like', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { unlike } = req.body;

      const update = unlike ? { $inc: { likes: -1 } } : { $inc: { likes: 1 } };
      const nft = await NFT.findByIdAndUpdate(id, update, { new: true });

      if (!nft) {
        return res.status(404).json({ message: 'NFT not found' });
      }

      res.json({ likes: nft.likes });
    } catch (error) {
      console.error('Like error:', error);
      res.status(500).json({ message: 'Failed to update like' });
    }
  });

  app.post('/api/marketplace/nfts/:id/view', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await NFT.findByIdAndUpdate(id, { $inc: { views: 1 } });
      res.json({ success: true });
    } catch (error) {
      console.error('View error:', error);
      res.status(500).json({ message: 'Failed to increment views' });
    }
  });

  app.post('/api/marketplace/nfts/:id/buy', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const nft = await NFT.findById(id);

      if (!nft) {
        return res.status(404).json({ message: 'NFT not found' });
      }

      if (nft.status !== 'listed') {
        return res.status(400).json({ message: 'This NFT is not for sale' });
      }

      if (!req.session.userId) {
        return res.status(401).json({ message: 'Please login to purchase' });
      }

      const buyer = await User.findById(req.session.userId);
      if (!buyer) {
        return res.status(401).json({ message: 'User not found' });
      }

      if ((buyer.walletBalance || 0) < (nft.price || 0)) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      const previousOwner = nft.owner;
      const previousCreator = nft.creator;
      const price = nft.price || 0;
      const royaltyPercent = nft.royalty || 0;
      const royaltyAmount = (price * royaltyPercent) / 100;
      const sellerAmount = price - royaltyAmount;

      // Try to find seller by username or email and credit their WETH balance
      const seller = await User.findOne({ 
        $or: [
          { username: previousOwner },
          { email: previousOwner }
        ]
      });
      
      if (seller && seller._id.toString() !== buyer._id.toString()) {
        // Credit seller's WETH balance instead of wallet balance
        seller.wethBalance = (seller.wethBalance || 0) + sellerAmount;
        await seller.save();
      }

      // Credit royalty to creator's WETH balance if different from seller
      if (royaltyAmount > 0 && previousCreator !== previousOwner) {
        const creator = await User.findOne({
          $or: [
            { username: previousCreator },
            { email: previousCreator }
          ]
        });
        if (creator) {
          // Credit creator's WETH balance
          creator.wethBalance = (creator.wethBalance || 0) + royaltyAmount;
          await creator.save();
        }
      }

      // Update NFT ownership
      nft.owner = buyer.username || buyer.email;
      nft.status = 'owned';
      nft.price = undefined;
      await nft.save();

      // Deduct from buyer
      buyer.walletBalance = (buyer.walletBalance || 0) - price;
      await buyer.save();

      // Record transaction
      await Transaction.create({
        type: 'sale',
        description: `Purchased "${nft.name}" from ${previousOwner}`,
        amount: price,
        currency: nft.currency || 'ETH',
        nft: nft._id,
        from: previousOwner,
        to: buyer.username || buyer.email,
        status: 'completed'
      });

      // Remove from sales listing
      await Sale.findOneAndDelete({ nftId: nft._id });

      // Send email notifications
      sendPurchaseConfirmation(buyer.email, nft.name, price, nft.currency || 'ETH').catch(err => 
        console.error('Failed to send purchase confirmation:', err)
      );
      
      if (seller) {
        sendSaleNotification(seller.email, nft.name, sellerAmount, nft.currency || 'ETH', buyer.username || buyer.email).catch(err => 
          console.error('Failed to send sale notification:', err)
        );
      }

      res.json({ 
        success: true, 
        message: 'Purchase successful',
        nft: nft
      });
    } catch (error) {
      console.error('Purchase error:', error);
      res.status(500).json({ message: 'Failed to complete purchase' });
    }
  });

  // ===== DEPOSIT/WITHDRAWAL REQUESTS =====
  
  // Submit deposit request
  app.post('/api/deposit', async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Please login first' });
      }

      const { amount, transactionHash, currency = 'ETH' } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid deposit amount' });
      }

      const request = await FinancialRequest.create({
        userId: req.session.userId,
        type: 'deposit',
        amount,
        currency,
        transactionHash,
        status: 'pending'
      });

      res.json({ message: 'Deposit request submitted', request });
    } catch (error) {
      console.error('Deposit request error:', error);
      res.status(500).json({ message: 'Failed to submit deposit request' });
    }
  });

  // Submit withdrawal request
  app.post('/api/withdrawal', async (req: Request, res: Response) => {
    try {

      const userEm= await getUser(req)
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Please login first' });
      }

      const { amount, toAddress, currency = 'ETH' } = req.body;

      if (!amount || amount <= 0) {
        return res.status(400).json({ message: 'Invalid withdrawal amount' });
      }

      if (!toAddress) {
        return res.status(400).json({ message: 'Wallet address is required' });
      }

      const user = await User.findById(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.walletBalance < amount) {
        return res.status(400).json({ message: 'Insufficient balance' });
      }

      const request = await FinancialRequest.create({
        userId: req.session.userId,
        type: 'withdrawal',
        amount,
        currency,
        owner:userEm,
        walletAddress:toAddress,
        status: 'pending'
      });

      res.json({ message: 'Withdrawal request submitted', request });
    } catch (error) {
      console.error('Withdrawal request error:', error);
      res.status(500).json({ message: 'Failed to submit withdrawal request' });
    }
  });

  // Get user's financial requests
  app.get('/api/my-requests', async (req: Request, res: Response) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Please login first' });
      }

      const requests = await FinancialRequest.find({ userId: req.session.userId }).sort({ createdAt: -1 });
      res.json(requests);
    } catch (error) {
      console.error('Fetch requests error:', error);
      res.status(500).json({ message: 'Failed to fetch requests' });
    }
  });

  // ===== SERVE ADMIN PANEL =====
  app.get('/admin', (req: Request, res: Response) => {
    const adminPath = path.resolve(__dirname, '..', 'client', 'admin.html');
    if (fs.existsSync(adminPath)) {
      res.sendFile(adminPath);
    } else {
      res.status(404).send('Admin panel not found');
    }
  });

  // Register admin routes
  registerAdminRoutes(app);

  return httpServer;
}
