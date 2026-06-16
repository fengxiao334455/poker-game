import React from 'react';
import './PotDisplay.css';

export function PotDisplay({ pot, phase, message }: { pot: number; phase: string; message: string }) {
  return (
    <div className="pot-display">
      <div className="pot-amount">Pot: {pot}</div>
      {message && <div className="pot-message">{message}</div>}
      <div className="pot-phase">{phase !== 'idle' ? phase.toUpperCase() : ''}</div>
    </div>
  );
}
