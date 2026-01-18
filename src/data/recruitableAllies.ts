export interface RecruitableAlly {
  id: string;
  name: string;
  rank: 'E' | 'D' | 'C' | 'B' | 'A' | 'S';
  attractionCost: number;
  description: string;
  requiredLevel?: number;
}

export const recruitableAllies: RecruitableAlly[] = [
  {
    id: 'e-rank-hunter',
    name: 'E-Rank Hunter',
    rank: 'E',
    attractionCost: 50,
    description: 'A novice hunter. Weak but eager to help.',
  },
  {
    id: 'd-rank-hunter',
    name: 'D-Rank Hunter',
    rank: 'D',
    attractionCost: 100,
    description: 'An experienced hunter with basic combat skills.',
    requiredLevel: 5,
  },
  {
    id: 'c-rank-hunter',
    name: 'C-Rank Hunter',
    rank: 'C',
    attractionCost: 250,
    description: 'A skilled hunter capable of handling most threats.',
    requiredLevel: 10,
  },
  {
    id: 'b-rank-hunter',
    name: 'B-Rank Hunter',
    rank: 'B',
    attractionCost: 500,
    description: 'An elite hunter with exceptional abilities.',
    requiredLevel: 20,
  },
  {
    id: 'a-rank-hunter',
    name: 'A-Rank Hunter',
    rank: 'A',
    attractionCost: 1000,
    description: 'A top-tier hunter, one of the strongest in the world.',
    requiredLevel: 30,
  },
  {
    id: 's-rank-hunter',
    name: 'S-Rank Hunter',
    rank: 'S',
    attractionCost: 2500,
    description: 'A legendary hunter with overwhelming power.',
    requiredLevel: 40,
  },
];

