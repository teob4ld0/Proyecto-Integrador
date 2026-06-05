import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BulletBackground from '../components/BulletBackground';

export default function CharacterSelection() {
  const navigate = useNavigate();
  
  // Character state for Slot 1 (YOU)
  const [slot1Char, setSlot1Char] = useState('blue'); 
  // Settings Sidebar State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isOnlyFriends, setIsOnlyFriends] = useState(true);
  const [lobbyCode, setLobbyCode] = useState('');
  const [copied, setCopied] = useState(false);
  const isLeader = true; // Assume current player is leader for now

  // State for other slots (2, 3, 4)
  const [otherSlots, setOtherSlots] = useState([
    { id: 2, state: 'empty', char: 'red' },
    { id: 3, state: 'empty', char: 'blue' },
    { id: 4, state: 'empty', char: 'red' }
  ]);

  // Handle keyboard events to change character in Slot 1
  useEffect(() => {
    // Generate a random 6-character code for the lobby
    setLobbyCode(Math.random().toString(36).substring(2, 8).toUpperCase());

    const handleKeyDown = (e) => {
      // Prevent default scrolling for up/down arrows
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        setSlot1Char(prev => prev === 'blue' ? 'red' : 'blue');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const changeSlot1Char = () => {
    setSlot1Char(prev => prev === 'blue' ? 'red' : 'blue');
  };

  const handleInvite = (index) => {
    setOtherSlots(prev => prev.map((slot, i) => 
      i === index ? { ...slot, state: 'connecting' } : slot
    ));
    
    // Simulate connection delay then join
    setTimeout(() => {
      setOtherSlots(prev => prev.map((slot, i) => 
        i === index ? { ...slot, state: 'occupied' } : slot
      ));
    }, 2000);
  };

  const toggleSettings = () => {
    if (isLeader) {
      setIsSettingsOpen(!isSettingsOpen);
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(lobbyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000); // Reset text after 2s
    } catch (err) {
      console.error('Failed to copy code: ', err);
    }
  };

  return (
    <div className="cs-page-container">
      <BulletBackground />

      {/* TOP HEADER */}
      <header className="cs-header">
        <button className="cs-back-btn" onClick={() => navigate('/join')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
             <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div className="cs-level-box">
          LEVEL NAME
        </div>

        <div className="cs-header-icons">
          {/* Box icon */}
          <button className="cs-icon-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
          </button>
          {/* Settings icon */}
          <button className="cs-icon-btn" onClick={toggleSettings}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </header>

      {/* MAIN GRID */}
      <div className="cs-main-grid">
        
        {/* SLOT 1 (Occupied) */}
        <div className="cs-slot">
          <div className="cs-slot-header">PLY NAME</div>
          <div className="cs-slot-body">
            <div className="cs-select-arrow up" onClick={changeSlot1Char}></div>
            <div className="cs-character-display">
              <div className={`cs-character-box ${slot1Char}`}></div>
            </div>
            <div className="cs-select-arrow down" onClick={changeSlot1Char}></div>
          </div>
          <div className="cs-slot-footer">
            <div className="cs-equip-box"></div>
            <div className="cs-equip-box"></div>
            <div className="cs-equip-box"></div>
          </div>
        </div>

        {/* OTHER SLOTS (2, 3, 4) */}
        {otherSlots.map((slot, index) => (
          <div className="cs-slot" key={slot.id}>
            <div className="cs-slot-header">
              {slot.state === 'empty' && 'FRIENDLESS'}
              {slot.state === 'connecting' && <span style={{lineHeight: 1.2}}>BITCH<br/>CONNECTING...</span>}
              {slot.state === 'occupied' && 'NEW PLY'}
            </div>
            
            {slot.state === 'empty' && (
              <div className="cs-slot-body empty">
                <button className="cs-invite-btn" onClick={() => handleInvite(index)}>INVITE</button>
              </div>
            )}

            {slot.state === 'connecting' && (
              <div className="cs-slot-body connecting">
                <div className="cs-spinner"></div>
              </div>
            )}

            {slot.state === 'occupied' && (
              <div className="cs-slot-body">
                <div className="cs-select-arrow up" style={{ opacity: 0.5, cursor: 'not-allowed' }}></div>
                <div className="cs-character-display">
                  <div className={`cs-character-box ${slot.char}`}></div>
                </div>
                <div className="cs-select-arrow down" style={{ opacity: 0.5, cursor: 'not-allowed' }}></div>
              </div>
            )}

            <div className="cs-slot-footer">
              <div className="cs-equip-box"></div>
              <div className="cs-equip-box"></div>
              <div className="cs-equip-box"></div>
            </div>
          </div>
        ))}

      </div>

      {/* SETTINGS SIDEBAR (Toggled by Gear Icon) */}
      <div className={`cs-settings-sidebar ${isSettingsOpen ? 'open' : ''}`}>
        <button className="cs-settings-close-btn" onClick={toggleSettings}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
             <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>

        <div className="cs-settings-row">
          <button className="cs-settings-btn" style={{ flex: 1 }} onClick={() => setIsOnlyFriends(!isOnlyFriends)}>
            ONLY FRIENDS
          </button>
          <button className="cs-settings-btn small" onClick={() => setIsOnlyFriends(!isOnlyFriends)}>
            {isOnlyFriends && (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px' }}>
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
          </button>
        </div>

        <div className="cs-settings-row">
          <button className="cs-settings-btn">SELECT LEVEL</button>
          <button className="cs-settings-btn">LEVEL NAME</button>
        </div>

        <div className="cs-settings-row">
          <button className="cs-settings-btn" style={{ cursor: 'default' }}>{lobbyCode}</button>
          <button className="cs-settings-btn" onClick={handleCopyCode}>
            {copied ? 'COPIED!' : 'COPY CODE'}
          </button>
        </div>
      </div>
    </div>
  );
}