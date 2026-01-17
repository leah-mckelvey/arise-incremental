import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { GatheringActions } from './GatheringActions';
import { gameStore } from '../store/gameStore';

describe('GatheringActions', () => {
  beforeEach(() => {
    gameStore.getState().reset();
  });

  it('should render gathering buttons', () => {
    render(<GatheringActions />);

    expect(screen.getByText(/Gather Essence/i)).toBeInTheDocument();
    expect(screen.getByText(/Mine Crystals/i)).toBeInTheDocument();
    expect(screen.getByText(/Collect Gold/i)).toBeInTheDocument();
  });

  it('should add essence when gather button is clicked', () => {
    render(<GatheringActions />);

    const initialEssence = gameStore.getState().resources.essence;

    const gatherButton = screen.getByText(/Gather Essence/i);
    fireEvent.click(gatherButton);

    const newEssence = gameStore.getState().resources.essence;
    // Base amount (1) + INT bonus (5 * 0.1 = 0) = 1
    expect(newEssence).toBe(initialEssence + 1);
  });

  it('should add crystals when mine button is clicked', () => {
    render(<GatheringActions />);

    const initialCrystals = gameStore.getState().resources.crystals;

    const mineButton = screen.getByText(/Mine Crystals/i);
    fireEvent.click(mineButton);

    const newCrystals = gameStore.getState().resources.crystals;
    // Base amount (1) + AGI bonus (5 * 0.1 = 0) = 1
    expect(newCrystals).toBe(initialCrystals + 1);
  });

  it('should add gold when collect button is clicked', () => {
    render(<GatheringActions />);

    const initialGold = gameStore.getState().resources.gold;

    const collectButton = screen.getByText(/Collect Gold/i);
    fireEvent.click(collectButton);

    const newGold = gameStore.getState().resources.gold;
    // Base amount (1) + STR bonus (5 * 0.1 = 0) = 1
    expect(newGold).toBe(initialGold + 1);
  });

  it('should accumulate resources with multiple clicks', () => {
    render(<GatheringActions />);

    const gatherButton = screen.getByText(/Gather Essence/i);

    fireEvent.click(gatherButton);
    fireEvent.click(gatherButton);
    fireEvent.click(gatherButton);

    // 3 clicks * 1 essence per click = 3
    expect(gameStore.getState().resources.essence).toBe(3);
  });
});

