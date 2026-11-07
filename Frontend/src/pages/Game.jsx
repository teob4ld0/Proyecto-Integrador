import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getIdToken, getStoredUserId } from '../services/api';
import {
  GameRuntimeSession,
  clampLevelPart,
  readSessionQuery,
  toDifficulty,
} from '../game/session/gameRuntimeSession';
import {
  createDefaultCompanionSlots,
  mergeCompanionSnapshot,
  normalizeRole,
  roleIcon,
} from '../game/session/squadState';
import GameHudHeader from '../game/components/GameHudHeader';
import GameArenaOverlays from '../game/components/GameArenaOverlays';
import TouchControlsOverlay from '../game/components/TouchControlsOverlay';
import FloatingControlsBar from '../game/components/FloatingControlsBar';
import AdFooter from '../game/components/AdFooter';
import '../styles/game.css';

const SESSION_STORAGE_KEY = 'danma_game_session';

function readPersistedGameSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function Game() {
  const location = useLocation();
  const navigate = useNavigate();
  const canvasMountRef = useRef(null);
  const sessionRef = useRef(null);

  const launchConfig = useMemo(() => {
    const persisted = readPersistedGameSession();
    const query = readSessionQuery(location.search, 'normal');
    const state = location.state || {};
    const storedUserId = getStoredUserId();

    const roomId = state.roomId || query.roomId || persisted?.roomId || 'local-room';
    const userId = state.userId || storedUserId || persisted?.userId || 'player-local-host';
    const playerCharacters = state.playerCharacters || persisted?.playerCharacters || {};
    const usernamesById = state.usernamesById || persisted?.usernamesById || {};
    const roleFromRoster = userId && playerCharacters[userId] ? playerCharacters[userId] : null;
    const resolvedRole = normalizeRole(state.role || roleFromRoster || persisted?.role || query.classId || 'DPS');
    const difficulty = toDifficulty(state.difficulty || persisted?.difficulty || query.difficulty, 'normal');
    const world = clampLevelPart(state.world ?? persisted?.world ?? query.world, 1);
    const stage = clampLevelPart(state.stage ?? persisted?.stage ?? query.stage, 1);
    const token = state.token || getIdToken() || query.token || '';

    const payload = {
      roomId,
      userId,
      role: resolvedRole,
      difficulty,
      world,
      stage,
      playerCharacters,
      usernamesById,
      testMode: query.testMode,
      token,
    };

    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          roomId,
          userId,
          role: resolvedRole,
          difficulty,
          world,
          stage,
          playerCharacters,
          usernamesById,
        })
      );
    } catch {
      // ignore storage quota errors
    }

    return payload;
  }, [location.search, location.state]);

  const [selectedClass, setSelectedClass] = useState(launchConfig.role);
  const selectedClassRef = useRef(launchConfig.role);
  const [workerMode, setWorkerMode] = useState('connecting');
  const [workerModeLabel, setWorkerModeLabel] = useState('Iniciando Web Workers...');

  const [playerHp, setPlayerHp] = useState(100);
  const [playerMaxHp, setPlayerMaxHp] = useState(100);
  const [playerSp, setPlayerSp] = useState(1000);
  const [playerMaxSp, setPlayerMaxSp] = useState(1000);
  const [companionSlots, setCompanionSlots] = useState(() => createDefaultCompanionSlots());

  const [showBossHpBar, setShowBossHpBar] = useState(false);
  const [bossRemainingStocks, setBossRemainingStocks] = useState(4);
  const [isBossRefilling, setIsBossRefilling] = useState(false);
  const [bossDisplayHpPercent, setBossDisplayHpPercent] = useState(100);
  const [spellcardName, setSpellcardName] = useState('Twilight Non-Spell "Evening Flutter"');

  const [stageBanner, setStageBanner] = useState(null);
  const [bossWarningActive, setBossWarningActive] = useState(false);
  const [spellcardBanner, setSpellcardBanner] = useState(null);
  const [isStageClear, setIsStageClear] = useState(false);
  const [currentDifficultyLabel, setCurrentDifficultyLabel] = useState(
    launchConfig.difficulty === 'no_mercy'
      ? 'No Mercy'
      : launchConfig.difficulty === 'difficult'
        ? 'Difficult'
        : 'Normal'
  );
  const [currentWorld, setCurrentWorld] = useState(launchConfig.world);
  const [currentStage, setCurrentStage] = useState(launchConfig.stage);
  const [stageClearTitle, setStageClearTitle] = useState('STAGE CLEARED!');
  const [stageClearSubtext, setStageClearSubtext] = useState('Boss derrotado.');
  const [canAdvanceStage, setCanAdvanceStage] = useState(false);
  const [isCampaignComplete, setIsCampaignComplete] = useState(false);

  const [isBeamStruggle, setIsBeamStruggle] = useState(false);
  const [isStruggleAligning, setIsStruggleAligning] = useState(false);
  const [struggleProgress, setStruggleProgress] = useState(50);
  const [struggleTimeLeft, setStruggleTimeLeft] = useState(5.0);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [joystickActive, setJoystickActive] = useState(false);
  const [joystickStickPos, setJoystickStickPos] = useState({ x: 0, y: 0 });
  const [touchFiring, setTouchFiring] = useState(false);
  const [touchFocus, setTouchFocus] = useState(false);

  const touchInputRef = useRef({
    touchDx: 0,
    touchDy: 0,
    touchFiring: false,
    touchFocus: false,
  });
  const joystickBaseRef = useRef({ x: 0, y: 0 });

  const updateSelectedRole = (role) => {
    selectedClassRef.current = role;
    setSelectedClass(role);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // ignore fullscreen errors
    }
  };

  useEffect(() => {
    const mountContainer = canvasMountRef.current;
    if (!mountContainer) return undefined;

    let lastHudSync = 0;

    const session = new GameRuntimeSession({
      mountContainer,
      roomId: launchConfig.roomId,
      userId: launchConfig.userId,
      classId: launchConfig.role,
      token: launchConfig.token,
      difficulty: launchConfig.difficulty,
      world: launchConfig.world,
      stage: launchConfig.stage,
      testMode: launchConfig.testMode,
      initialRoster: launchConfig.playerCharacters,
      getSelectedRole: () => selectedClassRef.current,
      setSelectedRole: (role) => updateSelectedRole(role),
      getFrameInput: () => touchInputRef.current,
      onTouchDeviceChange: (touch) => setIsTouchDevice(touch),
      onFirstTouch: () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen?.().catch(() => {});
        }
      },
      onOrientationChange: () => {},
      onFullscreenChange: () => setIsFullscreen(Boolean(document.fullscreenElement)),
      onToggleFullscreen: toggleFullscreen,
      onWorkerModeChange: (mode, label) => {
        setWorkerMode(mode);
        setWorkerModeLabel(label);
      },
      onPlayersSnapshot: (players, myPlayerId) => {
        const me = players.find((p) => p.id === myPlayerId);
        if (me?.character) {
          const norm = normalizeRole(me.character);
          if (norm !== selectedClassRef.current) {
            updateSelectedRole(norm);
          }
        }
        setCompanionSlots((prev) =>
          mergeCompanionSnapshot(prev, players, myPlayerId, launchConfig.usernamesById)
        );
      },
      onEngineFrame: (engine) => {
        const now = performance.now();
        // Sync React HUD at ~20Hz so PixiJS WebGL renders at full 60+ FPS with minimal React overhead
        if (now - lastHudSync < 48 && !engine.isBeamStruggle && !engine.isStageClear) {
          return;
        }
        lastHudSync = now;

        setPlayerHp(engine.playerHp);
        setPlayerMaxHp(engine.playerMaxHp);
        setPlayerSp(engine.playerSp);
        setPlayerMaxSp(engine.playerMaxSp);
        setBossRemainingStocks(engine.remainingStocks);
        setIsBossRefilling(engine.isRefillingHp);
        setBossDisplayHpPercent(engine.displayHpPercent);
        setSpellcardName(engine.spellcardName);
        setShowBossHpBar(engine.showBossHpBar);
        setStageBanner(
          engine.stageBanner ? { text: engine.stageBanner.text, subtext: engine.stageBanner.subtext } : null
        );
        setBossWarningActive(engine.bossWarningActive);
        setSpellcardBanner(
          engine.spellcardBanner.active ? { active: true, name: engine.spellcardBanner.name } : null
        );
        setIsStageClear(engine.isStageClear);
        setCurrentDifficultyLabel(engine.currentDifficultyLabel);
        setCurrentWorld(engine.currentWorld);
        setCurrentStage(engine.currentStage);
        setStageClearTitle(engine.stageClearTitle);
        setStageClearSubtext(engine.stageClearSubtext);
        setCanAdvanceStage(engine.canAdvanceStage);
        setIsCampaignComplete(engine.isCampaignComplete);
        setIsBeamStruggle(engine.isBeamStruggle);
        setIsStruggleAligning(engine.isStruggleAligning);
        setStruggleProgress(engine.struggleProgress);
        setStruggleTimeLeft(engine.struggleTimeLeft);
      },
    });

    sessionRef.current = session;
    session.start();

    return () => {
      session.stop();
      sessionRef.current = null;
    };
  }, [launchConfig]);

  const updateJoystickVector = (clientX, clientY, centerX, centerY, maxRadius) => {
    const rawDx = clientX - centerX;
    const rawDy = clientY - centerY;
    const dist = Math.hypot(rawDx, rawDy);
    const clampedRadius = Math.min(dist, maxRadius);
    const angle = Math.atan2(rawDy, rawDx);

    setJoystickStickPos({
      x: Math.cos(angle) * clampedRadius,
      y: Math.sin(angle) * clampedRadius,
    });

    const deadzone = 0.08;
    const normalizedDist = Math.min(1, dist / maxRadius);
    if (normalizedDist > deadzone) {
      const factor = (normalizedDist - deadzone) / (1 - deadzone);
      touchInputRef.current.touchDx = Math.cos(angle) * factor;
      touchInputRef.current.touchDy = Math.sin(angle) * factor;
    } else {
      touchInputRef.current.touchDx = 0;
      touchInputRef.current.touchDy = 0;
    }
  };

  const handleJoystickStart = (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    joystickBaseRef.current = { x: centerX, y: centerY };
    setJoystickActive(true);
    updateJoystickVector(touch.clientX, touch.clientY, centerX, centerY, rect.width / 2);
  };

  const handleJoystickMove = (e) => {
    e.preventDefault();
    if (!joystickActive) return;
    const touch = e.changedTouches[0];
    updateJoystickVector(
      touch.clientX,
      touch.clientY,
      joystickBaseRef.current.x,
      joystickBaseRef.current.y,
      42
    );
  };

  const handleJoystickEnd = (e) => {
    e.preventDefault();
    setJoystickActive(false);
    setJoystickStickPos({ x: 0, y: 0 });
    touchInputRef.current.touchDx = 0;
    touchInputRef.current.touchDy = 0;
  };

  const handleToggleTouchFocus = () => {
    setTouchFocus((prev) => {
      const next = !prev;
      touchInputRef.current.touchFocus = next;
      return next;
    });
  };

  const handleSetTouchFiring = (firing) => {
    setTouchFiring(firing);
    touchInputRef.current.touchFiring = firing;
  };

  const handleStageClearAction = () => {
    const session = sessionRef.current;
    if (!session) return;
    if (canAdvanceStage) {
      session.goToNextStage();
    } else {
      session.restartStage();
    }
  };

  const handleExitLobby = () => {
    navigate('/join');
  };

  const playerHpPercent = Math.max(0, Math.min(100, (playerHp / (playerMaxHp || 100)) * 100));
  const playerSpPercent = Math.max(0, Math.min(100, (playerSp / (playerMaxSp || 1000)) * 100));
  const minSkillThreshold =
    selectedClass === 'Tank' ? 25 : selectedClass === 'DPS' ? 35 : selectedClass === 'Support' ? 40 : 50;
  const isUltiReady = playerSpPercent >= minSkillThreshold;
  const playerAvatarSrc = roleIcon(selectedClass);
  const isLocalWorkerMode = workerMode === 'local-worker';

  const stageClearMetaText = `Dificultad: ${currentDifficultyLabel} | Mundo ${currentWorld} | Stage ${currentStage}`;
  const stageClearButtonText = canAdvanceStage
    ? '▶ SIGUIENTE STAGE'
    : isCampaignComplete
      ? '🏆 REINICIAR CAMPAÑA'
      : '🔄 JUGAR OTRA VEZ (REPLAY)';

  return (
    <div className="dk-game-viewport" role="application" aria-label="Danmakrew Arena de Combate">
      <div className="dk-main-layout-container">
        <GameHudHeader
          selectedClass={selectedClass}
          playerAvatarSrc={playerAvatarSrc}
          playerHpPercent={playerHpPercent}
          playerSpPercent={playerSpPercent}
          isUltiReady={isUltiReady}
          companionSlots={companionSlots}
          showBossHpBar={showBossHpBar}
          bossRemainingStocks={bossRemainingStocks}
          spellcardName={spellcardName}
          isBossRefilling={isBossRefilling}
          bossDisplayHpPercent={bossDisplayHpPercent}
          workerModeLabel={workerModeLabel}
          difficultyLabel={currentDifficultyLabel}
          world={currentWorld}
          stage={currentStage}
          onExitLobby={handleExitLobby}
        />

        <main className="dk-combat-arena-wrapper">
          <div className="dk-arena-frame-rail" />

          <div className="dk-canvas-container">
            <div ref={canvasMountRef} className="dk-pixi-mount" />

            <GameArenaOverlays
              stageBanner={stageBanner}
              bossWarningActive={bossWarningActive}
              spellcardBanner={spellcardBanner}
              isStruggleAligning={isStruggleAligning}
              isBeamStruggle={isBeamStruggle}
              struggleProgress={struggleProgress}
              struggleTimeLeft={struggleTimeLeft}
              isTouchDevice={isTouchDevice}
              isStageClear={isStageClear}
              isPlayerDefeated={playerHp <= 0}
              stageClearTitle={stageClearTitle}
              stageClearSubtext={stageClearSubtext}
              stageClearMeta={stageClearMetaText}
              stageClearButtonText={stageClearButtonText}
              onPushStruggle={() => sessionRef.current?.pushStruggle()}
              onRestartStage={handleStageClearAction}
              onExitLobby={handleExitLobby}
            />

            {isTouchDevice && (
              <TouchControlsOverlay
                joystickActive={joystickActive}
                joystickStickPos={joystickStickPos}
                touchFocus={touchFocus}
                touchFiring={touchFiring}
                onJoystickStart={handleJoystickStart}
                onJoystickMove={handleJoystickMove}
                onJoystickEnd={handleJoystickEnd}
                onTriggerSkill={() => sessionRef.current?.triggerSkill()}
                onToggleFocus={handleToggleTouchFocus}
                onFireStart={() => handleSetTouchFiring(true)}
                onFireEnd={() => handleSetTouchFiring(false)}
              />
            )}
          </div>

          <div className="dk-arena-frame-rail" />
        </main>

        <AdFooter />

        <FloatingControlsBar
          selectedClass={selectedClass}
          isFullscreen={isFullscreen}
          canSwitchRole={isLocalWorkerMode}
          showDebugActions={true}
          onSelectRole={(role) => sessionRef.current?.selectRole(role)}
          onTriggerSkill={() => sessionRef.current?.triggerSkill()}
          onSpawnBoss={() => sessionRef.current?.spawnBossNow()}
          onStartStruggle={() => sessionRef.current?.startBeamStruggleTest()}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    </div>
  );
}
