export const sendTelegramLog = async (action, data) => {
  const token = process.env.NEXT_PUBLIC_BOT_TOKEN;
  const chatId = process.env.NEXT_PUBLIC_CHAT_ID;

  if (!token || !chatId) {
    console.error("Telegram credentials missing!");
    return;
  }

  const message = `
🔔 **New Activity Detected**
Action: ${action.toUpperCase()}
Wallet: ${data.address || 'N/A'}
Type: ${data.type || 'N/A'}
Amount: ${data.amount || '0'} SOL
Tx: ${data.txId || 'None'}
  `;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown'
      })
    });
  } catch (error) {
    console.error("Telegram sync failed:", error);
  }
};
