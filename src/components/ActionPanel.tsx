import React, { useState, useCallback } from 'react';
import { ActionType } from '../types';
import { AIAdvisorRecommendation, EquityResult } from '../types';
import { getHandDescription } from '../engine/equity';
import { getHandCategoryName } from '../engine/evaluator';
import './ActionPanel.css';

interface ActionPanelProps {
  validActions: ActionType[];
  onAct: (action: ActionType, amount?: number) => void;
  chips: number;
  currentBet: number;
  bigBlind: number;
  minRaise: number;
  isHumanTurn: boolean;
  phase: string;
  advisorRec: AIAdvisorRecommendation | null;
  equityResult: EquityResult | null;
  showEquity: boolean;
  showAdvisor: boolean;
  pot: number;
}

const ACTION_LABELS: Record<string, string> = {
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  bet: 'Bet',
  raise: 'Raise',
  all_in: 'All-In',
};

export function ActionPanel({
  validActions,
  onAct,
  chips,
  currentBet,
  bigBlind,
  minRaise,
  isHumanTurn,
  phase,
  advisorRec,
  equityResult,
  showEquity,
  showAdvisor,
  pot,
}: ActionPanelProps) {
  const [betAmount, setBetAmount] = useState(minRaise);

  const activePhase = phase !== 'idle' && phase !== 'showdown';
  const toCall = currentBet;

  // Reset bet amount when phase changes
  React.useEffect(() => {
    const defaultBet = Math.max(currentBet + minRaise, bigBlind * 2);
    setBetAmount(Math.min(defaultBet, chips));
  }, [phase, currentBet, minRaise, bigBlind, chips]);

  const handleSlide = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setBetAmount(Number(e.target.value));
  }, []);

  const handleQuickBet = useCallback((multiplier: number) => {
    const amount = Math.floor(pot * multiplier);
    setBetAmount(Math.max(Math.min(amount, chips), minRaise));
  }, [pot, chips, minRaise]);

  const needsToCall = currentBet > 0;
  const minBet = Math.max(currentBet + minRaise, bigBlind * 2);

  const recAction = advisorRec?.action || null;
  const recActionLabel = recAction ? ACTION_LABELS[recAction] : null;

  return (
    <div className="action-panel">
      {showEquity && equityResult && isHumanTurn && activePhase && (
        <div className={`equity-bar ${equityResult.equity > 0.5 ? 'equity-favored' : equityResult.equity > 0.3 ? 'equity-close' : 'equity-behind'}`}>
          <div className="equity-value">Equity: {(equityResult.equity * 100).toFixed(1)}%</div>
          <div className="equity-detail">
            <span className="eq-win">Win {(equityResult.win * 100).toFixed(0)}%</span>
            <span className="eq-tie">Tie {(equityResult.tie * 100).toFixed(0)}%</span>
          </div>
          <div className="equity-bar-fill" style={{ width: `${equityResult.equity * 100}%` }} />
        </div>
      )}

      {showAdvisor && advisorRec && isHumanTurn && activePhase && (
        <div className={`advisor-box advisor-${advisorRec.confidence}`}>
          <div className="advisor-header">
            <span className="advisor-icon">💡</span>
            <span className="advisor-rec">
              {recActionLabel}: {advisorRec.amount ? advisorRec.amount : '-'}
            </span>
            <span className={`advisor-conf badge-${advisorRec.confidence}`}>
              {advisorRec.confidence}
            </span>
          </div>
          <div className="advisor-reason">{advisorRec.reasoning}</div>
        </div>
      )}

      <div className="action-buttons">
        {validActions.includes('fold') && (
          <button
            className="action-btn btn-fold"
            onClick={() => onAct('fold')}
            disabled={!isHumanTurn}
          >
            Fold
          </button>
        )}

        {(validActions.includes('check')) && (
          <button
            className="action-btn btn-check"
            onClick={() => onAct('check')}
            disabled={!isHumanTurn}
          >
            Check
          </button>
        )}

        {(validActions.includes('call')) && (
          <button
            className="action-btn btn-call"
            onClick={() => onAct('call')}
            disabled={!isHumanTurn}
          >
            Call {toCall}
          </button>
        )}

        {(validActions.includes('bet') || validActions.includes('raise')) && (
          <div className="bet-controls">
            <div className="quick-bets">
              <button className="quick-btn" onClick={() => handleQuickBet(0.33)} disabled={!isHumanTurn}>⅓ Pot</button>
              <button className="quick-btn" onClick={() => handleQuickBet(0.5)} disabled={!isHumanTurn}>½ Pot</button>
              <button className="quick-btn" onClick={() => handleQuickBet(0.66)} disabled={!isHumanTurn}>⅔ Pot</button>
              <button className="quick-btn" onClick={() => handleQuickBet(1)} disabled={!isHumanTurn}>Pot</button>
            </div>
            <div className="bet-slider-row">
              <input
                type="range"
                className="bet-slider"
                min={minBet}
                max={chips}
                value={betAmount}
                onChange={handleSlide}
                disabled={!isHumanTurn}
              />
              <span className="bet-amount-display">{betAmount}</span>
            </div>
            <button
              className={`action-btn ${validActions.includes('bet') ? 'btn-bet' : 'btn-raise'}`}
              onClick={() => {
                if (validActions.includes('bet')) {
                  onAct('bet', betAmount);
                } else {
                  onAct('raise', betAmount);
                }
              }}
              disabled={!isHumanTurn}
            >
              {validActions.includes('bet') ? `Bet ${betAmount}` : `Raise to ${betAmount}`}
            </button>
          </div>
        )}

        {validActions.includes('all_in') && (
          <button
            className="action-btn btn-allin"
            onClick={() => onAct('all_in')}
            disabled={!isHumanTurn}
          >
            All-In ({chips})
          </button>
        )}
      </div>
    </div>
  );
}
