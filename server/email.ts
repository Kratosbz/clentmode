// Email service using Resend integration
import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendVerificationEmail(to: string, code: string, username?: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: 'Verify Your Vaultorx Account',
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; font-size: 28px; margin: 0;">Vault<span style="color: #5d8df4;">orx</span></h1>
          </div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #1e293b; margin-top: 0;">Welcome${username ? ', ' + username : ''}!</h2>
            <p style="color: #64748b; font-size: 16px;">Use the code below to verify your email address:</p>
            <div style="background: #5d8df4; color: white; font-size: 32px; letter-spacing: 8px; padding: 20px 40px; border-radius: 8px; display: inline-block; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This code expires in 10 minutes.</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
            If you didn't create an account, please ignore this email.
          </p>
        </div>
      `
    });
    
    console.log(`Verification email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, code: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: 'Reset Your Vaultorx Password',
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; font-size: 28px; margin: 0;">Vault<span style="color: #5d8df4;">orx</span></h1>
          </div>
          <div style="background: #f8fafc; border-radius: 12px; padding: 30px; text-align: center;">
            <h2 style="color: #1e293b; margin-top: 0;">Password Reset</h2>
            <p style="color: #64748b; font-size: 16px;">Use the code below to reset your password:</p>
            <div style="background: #ef4444; color: white; font-size: 32px; letter-spacing: 8px; padding: 20px 40px; border-radius: 8px; display: inline-block; margin: 20px 0;">
              ${code}
            </div>
            <p style="color: #94a3b8; font-size: 14px;">This code expires in 15 minutes.</p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
            If you didn't request a password reset, please ignore this email.
          </p>
        </div>
      `
    });
    
    console.log(`Password reset email sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

export async function sendPurchaseConfirmation(to: string, nftName: string, price: number, currency: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: `Purchase Confirmed: ${nftName}`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; font-size: 28px; margin: 0;">Vault<span style="color: #5d8df4;">orx</span></h1>
          </div>
          <div style="background: #f0fdf4; border-radius: 12px; padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
            <h2 style="color: #22c55e; margin-top: 0;">Purchase Successful!</h2>
            <p style="color: #64748b; font-size: 16px;">You now own:</p>
            <h3 style="color: #1e293b; font-size: 24px; margin: 10px 0;">${nftName}</h3>
            <p style="color: #64748b; font-size: 18px;">
              <strong>${price} ${currency}</strong>
            </p>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center; margin-top: 30px;">
            View your collection in your Vaultorx dashboard.
          </p>
        </div>
      `
    });
    
    console.log(`Purchase confirmation sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send purchase confirmation:', error);
    return false;
  }
}

export async function sendSaleNotification(to: string, nftName: string, price: number, currency: string, buyerName: string) {
  try {
    const { client, fromEmail } = await getResendClient();
    
    await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: `Your NFT "${nftName}" Has Been Sold!`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; font-size: 28px; margin: 0;">Vault<span style="color: #5d8df4;">orx</span></h1>
          </div>
          <div style="background: #fef3c7; border-radius: 12px; padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">💰</div>
            <h2 style="color: #d97706; margin-top: 0;">You Made a Sale!</h2>
            <h3 style="color: #1e293b; font-size: 24px; margin: 10px 0;">${nftName}</h3>
            <p style="color: #64748b; font-size: 16px;">Sold to: <strong>${buyerName}</strong></p>
            <p style="color: #64748b; font-size: 18px;">
              Amount: <strong>${price} ${currency}</strong>
            </p>
            <p style="color: #94a3b8; font-size: 14px; margin-top: 15px;">
              The funds have been added to your WETH balance.
            </p>
          </div>
        </div>
      `
    });
    
    console.log(`Sale notification sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send sale notification:', error);
    return false;
  }
}

export async function sendDepositApprovalNotification(to: string, amount: number, status: 'approved' | 'rejected') {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const isApproved = status === 'approved';
    
    await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: `Deposit Request ${isApproved ? 'Approved' : 'Rejected'}`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; font-size: 28px; margin: 0;">Vault<span style="color: #5d8df4;">orx</span></h1>
          </div>
          <div style="background: ${isApproved ? '#f0fdf4' : '#fef2f2'}; border-radius: 12px; padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">${isApproved ? '✅' : '❌'}</div>
            <h2 style="color: ${isApproved ? '#22c55e' : '#ef4444'}; margin-top: 0;">
              Deposit ${isApproved ? 'Approved' : 'Rejected'}
            </h2>
            <p style="color: #64748b; font-size: 18px;">
              Amount: <strong>${amount} ETH</strong>
            </p>
            ${isApproved ? '<p style="color: #94a3b8; font-size: 14px;">Your wallet has been credited.</p>' : ''}
          </div>
        </div>
      `
    });
    
    console.log(`Deposit ${status} notification sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send deposit notification:', error);
    return false;
  }
}

export async function sendWithdrawalApprovalNotification(to: string, amount: number, status: 'approved' | 'rejected') {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const isApproved = status === 'approved';
    
    await client.emails.send({
      from: fromEmail,
      to: [to],
      subject: `Withdrawal Request ${isApproved ? 'Approved' : 'Rejected'}`,
      html: `
        <div style="font-family: 'Inter', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #1e293b; font-size: 28px; margin: 0;">Vault<span style="color: #5d8df4;">orx</span></h1>
          </div>
          <div style="background: ${isApproved ? '#f0fdf4' : '#fef2f2'}; border-radius: 12px; padding: 30px; text-align: center;">
            <div style="font-size: 48px; margin-bottom: 10px;">${isApproved ? '✅' : '❌'}</div>
            <h2 style="color: ${isApproved ? '#22c55e' : '#ef4444'}; margin-top: 0;">
              Withdrawal ${isApproved ? 'Approved' : 'Rejected'}
            </h2>
            <p style="color: #64748b; font-size: 18px;">
              Amount: <strong>${amount} ETH</strong>
            </p>
            ${isApproved ? '<p style="color: #94a3b8; font-size: 14px;">Your funds are being processed.</p>' : ''}
          </div>
        </div>
      `
    });
    
    console.log(`Withdrawal ${status} notification sent to ${to}`);
    return true;
  } catch (error) {
    console.error('Failed to send withdrawal notification:', error);
    return false;
  }
}
