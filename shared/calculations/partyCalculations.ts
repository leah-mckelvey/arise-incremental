/**
 * Calculate max party slots based on authority stat
 * Authority progression is non-linear to prevent early game resource explosion
 * 
 * Formula: floor(sqrt(authority * 2))
 * 
 * Examples:
 * - Authority 1 = 1 slot (sqrt(2) = 1.41 -> 1)
 * - Authority 2 = 2 slots (sqrt(4) = 2)
 * - Authority 5 = 3 slots (sqrt(10) = 3.16 -> 3)
 * - Authority 8 = 4 slots (sqrt(16) = 4)
 * - Authority 13 = 5 slots (sqrt(26) = 5.09 -> 5)
 * - Authority 18 = 6 slots (sqrt(36) = 6)
 * - Authority 25 = 7 slots (sqrt(50) = 7.07 -> 7)
 * - Authority 32 = 8 slots (sqrt(64) = 8)
 * - Authority 50 = 10 slots (sqrt(100) = 10)
 * - Authority 100 = 14 slots (sqrt(200) = 14.14 -> 14)
 */
export const calculateMaxPartySlots = (authority: number): number => {
  return Math.floor(Math.sqrt(authority * 2));
};

/**
 * Calculate how much authority is needed for the next party slot
 */
export const authorityForNextSlot = (currentAuthority: number): number => {
  const currentSlots = calculateMaxPartySlots(currentAuthority);
  const nextSlots = currentSlots + 1;
  
  // Solve: floor(sqrt(x * 2)) = nextSlots
  // sqrt(x * 2) = nextSlots
  // x * 2 = nextSlots^2
  // x = nextSlots^2 / 2
  const authorityNeeded = Math.ceil((nextSlots * nextSlots) / 2);
  
  return authorityNeeded - currentAuthority;
};

