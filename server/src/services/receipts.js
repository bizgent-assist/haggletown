import { env } from '../config/env.js';
import { Player } from '../models/Player.js';
import { sendEmail } from './email.js';
import { itemName } from './market.js';
import { toNear } from './pricing.js';

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Emails a trade receipt via Brevo if the player opted in. Never throws. */
export async function sendTradeReceipt(accountId, trade) {
  try {
    const player = await Player.findOne({ nearAccountId: accountId }).lean();
    if (!player?.email || !player.emailNotifications) return { skipped: true };
    const bought = trade.buyer === accountId;
    const item = itemName[trade.itemId] || trade.itemId;
    const link = `${env.near.explorerUrl}/txns/${trade.txHash}`;
    const subject = `Haggletown receipt: you ${bought ? 'bought' : 'sold'} ${trade.quantity} × ${item}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:480px">
        <h2 style="margin:0 0 12px">Deal done in Haggletown</h2>
        <p>You ${bought ? 'bought' : 'sold'} <strong>${trade.quantity} × ${escape(item)}</strong>
           ${bought ? 'from' : 'to'} <strong>${escape(bought ? trade.seller : trade.buyer)}</strong>
           for <strong>${toNear(trade.total)} NEAR</strong>.</p>
        <p>Verified on NEAR testnet: <a href="${link}">view transaction</a></p>
        <p style="color:#888;font-size:12px">Testnet tokens have no real value. Turn these emails off on your Account page.</p>
      </div>`;
    return await sendEmail({ to: player.email, subject, html });
  } catch (err) {
    console.warn('[receipt] email failed:', err.message);
    return { error: err.message };
  }
}
