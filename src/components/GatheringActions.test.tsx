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
    
    expect(screen.getByText(/Gather Catnip/i)).toBeInTheDocument();
    expect(screen.getByText(/Chop Wood/i)).toBeInTheDocument();
    expect(screen.getByText(/Mine Minerals/i)).toBeInTheDocument();
  });

  it('should add catnip when gather button is clicked', () => {
    render(<GatheringActions />);
    
    const initialCatnip = gameStore.getState().resources.catnip;
    
    const gatherButton = screen.getByText(/Gather Catnip/i);
    fireEvent.click(gatherButton);
    
    const newCatnip = gameStore.getState().resources.catnip;
    expect(newCatnip).toBe(initialCatnip + 1);
  });

  it('should add wood when chop button is clicked', () => {
    render(<GatheringActions />);
    
    const initialWood = gameStore.getState().resources.wood;
    
    const chopButton = screen.getByText(/Chop Wood/i);
    fireEvent.click(chopButton);
    
    const newWood = gameStore.getState().resources.wood;
    expect(newWood).toBe(initialWood + 1);
  });

  it('should add minerals when mine button is clicked', () => {
    render(<GatheringActions />);
    
    const initialMinerals = gameStore.getState().resources.minerals;
    
    const mineButton = screen.getByText(/Mine Minerals/i);
    fireEvent.click(mineButton);
    
    const newMinerals = gameStore.getState().resources.minerals;
    expect(newMinerals).toBe(initialMinerals + 1);
  });

  it('should accumulate resources with multiple clicks', () => {
    render(<GatheringActions />);
    
    const gatherButton = screen.getByText(/Gather Catnip/i);
    
    fireEvent.click(gatherButton);
    fireEvent.click(gatherButton);
    fireEvent.click(gatherButton);
    
    expect(gameStore.getState().resources.catnip).toBe(3);
  });
});

