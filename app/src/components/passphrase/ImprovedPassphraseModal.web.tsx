import React, { useEffect, useRef, useState } from 'react';

interface PassphraseModalProps {
  visible: boolean;
  title: string;
  message: string;
  accountName?: string;
  onSubmit: (passphrase: string) => Promise<void>;
  onCancel: () => void;
}

export function ImprovedPassphraseModal({
  visible,
  title,
  message,
  accountName,
  onSubmit,
  onCancel,
}: PassphraseModalProps) {
  const [passphrase, setPassphrase] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (visible) {
      setPassphrase('');
      setError(null);
      setShowSuccess(false);
      setProgress(0);
      setElapsedSeconds(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [visible]);

  // Timer for elapsed seconds
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing && !showSuccess) {
      const startTime = Date.now();
      interval = setInterval(() => {
        setElapsedSeconds((Date.now() - startTime) / 1000);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isProcessing, showSuccess]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!passphrase || passphrase.length < 6) {
      setError('Passphrase must be at least 6 characters');
      inputRef.current?.classList.add('shake');
      setTimeout(() => inputRef.current?.classList.remove('shake'), 500);
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);

    // Simulate progress during key derivation
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return 90;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    try {
      await onSubmit(passphrase);
      clearInterval(progressInterval);
      setProgress(100);
      setShowSuccess(true);

      setTimeout(() => {
        setIsProcessing(false);
        setShowSuccess(false);
      }, 1500);
    } catch (err: any) {
      clearInterval(progressInterval);
      setIsProcessing(false);
      setError(err.message || 'Invalid passphrase');
      inputRef.current?.classList.add('shake');
      setTimeout(() => inputRef.current?.classList.remove('shake'), 500);
    }
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
          20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        
        .shake {
          animation: shake 0.5s ease-in-out;
        }
        
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.2s ease-out;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .modal-content {
          background: linear-gradient(135deg, #1e1e1e 0%, #2a2a2a 100%);
          border-radius: 24px;
          padding: 32px;
          width: 90%;
          max-width: 440px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
          animation: slideUp 0.3s ease-out;
        }
        
        .progress-bar {
          height: 4px;
          background: #333;
          border-radius: 2px;
          overflow: hidden;
          margin: 20px 0;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4a9eff, #0066ff);
          border-radius: 2px;
          transition: width 0.3s ease-out;
        }
        
        .success-icon {
          width: 64px;
          height: 64px;
          margin: 20px auto;
          background: linear-gradient(135deg, #00c851, #00a040);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: pulse 0.5s ease-out;
        }
        
        .input-field {
          background: #1a1a1a;
          border: 2px solid transparent;
          border-radius: 12px;
          padding: 16px;
          font-size: 16px;
          color: #fff;
          width: 100%;
          transition: all 0.3s ease;
        }
        
        .input-field:focus {
          outline: none;
          border-color: #4a9eff;
          background: #222;
        }
        
        .input-field.error {
          border-color: #ff4444;
        }
        
        .btn {
          padding: 14px 24px;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #4a9eff, #0066ff);
          color: white;
        }
        
        .btn-primary:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(74, 158, 255, 0.4);
        }
        
        .btn-secondary {
          background: #333;
          color: white;
        }
        
        .btn-secondary:hover:not(:disabled) {
          background: #444;
        }
      `}</style>

      <div className="modal-backdrop" onClick={onCancel}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div style={{ marginBottom: 24 }}>
            <h2
              style={{
                fontSize: 28,
                fontWeight: 'bold',
                color: '#fff',
                margin: '0 0 12px 0',
              }}
            >
              {title}
            </h2>
            {accountName && (
              <p style={{ color: '#888', fontSize: 14, margin: '0 0 8px 0' }}>
                Account: {accountName}
              </p>
            )}
            <p style={{ color: '#aaa', fontSize: 16, margin: 0 }}>{message}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <input
                ref={inputRef}
                type="password"
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setError(null);
                }}
                placeholder="Enter your passphrase"
                disabled={isProcessing}
                className={`input-field ${error ? 'error' : ''}`}
                autoComplete="off"
              />
              {error && (
                <p
                  style={{
                    color: '#ff4444',
                    fontSize: 14,
                    marginTop: 8,
                    margin: '8px 0 0 0',
                  }}
                >
                  ⚠️ {error}
                </p>
              )}
            </div>

            {isProcessing && !showSuccess && (
              <>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p
                  style={{
                    color: '#888',
                    fontSize: 13,
                    textAlign: 'center',
                    margin: '0 0 8px 0',
                  }}
                >
                  Deriving encryption key ({Math.round(progress)}%) •{' '}
                  {elapsedSeconds.toFixed(1)}s elapsed
                </p>
                <p
                  style={{
                    color: '#666',
                    fontSize: 11,
                    textAlign: 'center',
                    margin: '0 0 20px 0',
                  }}
                >
                  Using 500,000 iterations for maximum security
                </p>
              </>
            )}

            {showSuccess && (
              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <div className="success-icon">
                  <span style={{ fontSize: 32, color: '#fff' }}>✓</span>
                </div>
                <p
                  style={{
                    color: '#00c851',
                    fontSize: 18,
                    fontWeight: 600,
                    margin: 0,
                  }}
                >
                  Decryption successful!
                </p>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                gap: 12,
                marginTop: 24,
              }}
            >
              <button
                type="button"
                onClick={onCancel}
                disabled={isProcessing}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isProcessing || !passphrase}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                {isProcessing ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: 16,
                        height: 16,
                        border: '2px solid #fff',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 0.6s linear infinite',
                        marginRight: 8,
                      }}
                    />
                    Processing...
                  </span>
                ) : (
                  'Decrypt'
                )}
              </button>
            </div>
          </form>

          <p
            style={{
              color: '#666',
              fontSize: 11,
              textAlign: 'center',
              marginTop: 20,
              marginBottom: 0,
            }}
          >
            🔒 Your passphrase is never stored and uses bank-level encryption
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
