export type GradingCompany = 'PSA' | 'CGC' | 'BGS' | 'TAG' | 'RAW';

export type PriceSource = 'TCGPLAYER' | 'EBAY' | 'PRICECHARTING' | 'GOLDIN';

export type CardVariant = 'Holo' | 'Non-Holo' | 'Reverse Holo' | 'Full Art' | 'Alt Art' | 'Secret Rare' | 'Other';

export const CARD_VARIANTS: { value: CardVariant; label: string }[] = [
  { value: 'Holo', label: 'Holo' },
  { value: 'Non-Holo', label: 'Non-Holo' },
  { value: 'Reverse Holo', label: 'Reverse Holo' },
  { value: 'Full Art', label: 'Full Art' },
  { value: 'Alt Art', label: 'Alt Art' },
  { value: 'Secret Rare', label: 'Secret Rare' },
  { value: 'Other', label: 'Other' },
];

export interface Card {
  id: string;
  user_id: string;
  card_name: string;
  card_number: string;
  set_name: string;
  card_variant: CardVariant | null;
  grading_company: GradingCompany;
  grade: string | null;
  cert_number: string | null;
  cert_image_url: string | null;
  card_image_url: string | null;
  purchase_price: number | null;
  purchase_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PriceRecord {
  id: string;
  card_id: string;
  source: PriceSource;
  price: number;
  sale_date: string | null;
  listing_title: string | null;
  listing_url: string | null;
  fetched_at: string;
}

export interface PopulationData {
  id: string;
  card_id: string;
  grading_company: GradingCompany;
  grade: string;
  population: number;
  population_higher: number;
  fetched_at: string;
}

export interface CardWithPricing extends Card {
  prices: {
    tcgplayer: PriceRecord[];
    ebay: PriceRecord[];
    pricecharting: PriceRecord[];
    goldin: PriceRecord[];
  };
  market_value: number | null;
  population: PopulationData | null;
}

export interface CollectionMetrics {
  total_cards: number;
  total_value: number;
  total_cost: number;
  total_gain_loss: number;
  gain_loss_percent: number;
  average_grade: number | null;
  highest_value_card: Card | null;
  by_company: Record<GradingCompany, number>;
  by_grade: Record<string, number>;
}

export interface SoldListing {
  title: string;
  price: number;
  date: string;
  url: string;
  source: PriceSource;
}

export const GRADING_COMPANIES: { value: GradingCompany; label: string; color: string }[] = [
  { value: 'PSA', label: 'PSA', color: '#E31837' },
  { value: 'CGC', label: 'CGC', color: '#00A651' },
  { value: 'BGS', label: 'Beckett (BGS)', color: '#1A1A1A' },
  { value: 'TAG', label: 'TAG', color: '#6B46C1' },
  { value: 'RAW', label: 'Raw (Ungraded)', color: '#6B7280' },
];

export const GRADES: Record<GradingCompany, { value: string; label: string }[]> = {
  PSA: [
    { value: '10', label: 'PSA 10 - Gem Mint' },
    { value: '9', label: 'PSA 9 - Mint' },
    { value: '8', label: 'PSA 8 - NM-MT' },
    { value: '7', label: 'PSA 7 - NM' },
    { value: '6', label: 'PSA 6 - EX-MT' },
    { value: '5', label: 'PSA 5 - EX' },
    { value: '4', label: 'PSA 4 - VG-EX' },
    { value: '3', label: 'PSA 3 - VG' },
    { value: '2', label: 'PSA 2 - Good' },
    { value: '1.5', label: 'PSA 1.5 - Fair' },
    { value: '1', label: 'PSA 1 - Poor' },
    { value: 'A', label: 'PSA Authentic (Altered)' },
  ],
  CGC: [
    { value: '10', label: 'CGC 10 - Pristine' },
    { value: '9.5', label: 'CGC 9.5 - Gem Mint' },
    { value: '9', label: 'CGC 9 - Mint' },
    { value: '8.5', label: 'CGC 8.5 - NM-MT+' },
    { value: '8', label: 'CGC 8 - NM-MT' },
    { value: '7.5', label: 'CGC 7.5 - NM+' },
    { value: '7', label: 'CGC 7 - NM' },
    { value: '6.5', label: 'CGC 6.5 - EX-NM+' },
    { value: '6', label: 'CGC 6 - EX-NM' },
    { value: '5.5', label: 'CGC 5.5 - EX+' },
    { value: '5', label: 'CGC 5 - EX' },
    { value: '4.5', label: 'CGC 4.5 - VG-EX+' },
    { value: '4', label: 'CGC 4 - VG-EX' },
    { value: '3.5', label: 'CGC 3.5 - VG+' },
    { value: '3', label: 'CGC 3 - VG' },
    { value: '2.5', label: 'CGC 2.5 - G+' },
    { value: '2', label: 'CGC 2 - Good' },
    { value: '1.5', label: 'CGC 1.5 - Fair' },
    { value: '1', label: 'CGC 1 - Poor' },
  ],
  BGS: [
    { value: '10', label: 'BGS 10 - Black Label (Pristine)' },
    { value: '10P', label: 'BGS 10 - Pristine' },
    { value: '9.5', label: 'BGS 9.5 - Gem Mint' },
    { value: '9', label: 'BGS 9 - Mint' },
    { value: '8.5', label: 'BGS 8.5 - NM-MT+' },
    { value: '8', label: 'BGS 8 - NM-MT' },
    { value: '7.5', label: 'BGS 7.5 - NM+' },
    { value: '7', label: 'BGS 7 - NM' },
    { value: '6.5', label: 'BGS 6.5 - EX-NM+' },
    { value: '6', label: 'BGS 6 - EX-NM' },
    { value: '5.5', label: 'BGS 5.5 - EX+' },
    { value: '5', label: 'BGS 5 - EX' },
    { value: '4.5', label: 'BGS 4.5 - VG-EX+' },
    { value: '4', label: 'BGS 4 - VG-EX' },
    { value: '3.5', label: 'BGS 3.5 - VG+' },
    { value: '3', label: 'BGS 3 - VG' },
    { value: '2.5', label: 'BGS 2.5 - G+' },
    { value: '2', label: 'BGS 2 - Good' },
    { value: '1.5', label: 'BGS 1.5 - Fair' },
    { value: '1', label: 'BGS 1 - Poor' },
  ],
  TAG: [
    { value: '10', label: 'TAG 10 - Gem Mint' },
    { value: '9.5', label: 'TAG 9.5' },
    { value: '9', label: 'TAG 9 - Mint' },
    { value: '8.5', label: 'TAG 8.5' },
    { value: '8', label: 'TAG 8 - NM-MT' },
    { value: '7.5', label: 'TAG 7.5' },
    { value: '7', label: 'TAG 7 - NM' },
    { value: '6', label: 'TAG 6 - EX-MT' },
    { value: '5', label: 'TAG 5 - EX' },
    { value: '4', label: 'TAG 4 - VG-EX' },
    { value: '3', label: 'TAG 3 - VG' },
    { value: '2', label: 'TAG 2 - Good' },
    { value: '1', label: 'TAG 1 - Poor' },
  ],
  RAW: [],
};
