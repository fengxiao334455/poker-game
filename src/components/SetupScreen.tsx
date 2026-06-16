import React from 'react';
import { GameConfig } from '../types';
import './SetupScreen.css';

interface SetupScreenProps {
  config: GameConfig;
  onConfigChange: (config: GameConfig) => void;
  onStart: () => void;
}

export function SetupScreen({ config, onConfigChange, onStart }: SetupScreenProps) {
  return (
    <div className="setup-screen">
      <div className="setup-card">
        <div className="setup-logo">♠ ♥ ♣ ♦</div>
        <h1 className="setup-title">Texas Hold'em</h1>
        <p className="setup-subtitle">vs AI Opponents</p>

        <div className="setup-section">
          <label className="setup-label">Number of Players</label>
          <div className="player-options">
            {([2, 4, 6] as const).map(n => (
              <button
                key={n}
                className={`player-option ${config.numPlayers === n ? 'selected' : ''}`}
                onClick={() => onConfigChange({ ...config, numPlayers: n })}
              >
                <span className="option-num">{n}</span>
                <span className="option-label">Players</span>
              </button>
            ))}
          </div>
        </div>

        <div className="setup-section">
          <label className="setup-label">Features</label>
          <div className="feature-toggles">
            <label className="toggle-row">
              <span>Win Rate (Equity)</span>
              <div
                className={`toggle-switch ${config.showEquity ? 'on' : ''}`}
                onClick={() => onConfigChange({ ...config, showEquity: !config.showEquity })}
              >
                <div className="toggle-knob" />
              </div>
            </label>
            <label className="toggle-row">
              <span>AI Advisor</span>
              <div
                className={`toggle-switch ${config.showAdvisor ? 'on' : ''}`}
                onClick={() => onConfigChange({ ...config, showAdvisor: !config.showAdvisor })}
              >
                <div className="toggle-knob" />
              </div>
            </label>
          </div>
        </div>

        <button className="start-btn" onClick={onStart}>
          Start Game
        </button>
      </div>
    </div>
  );
}
