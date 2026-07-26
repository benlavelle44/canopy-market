export type StrainType = 'Indica' | 'Sativa' | 'Hybrid';

export interface Terpene {
  name: string;
  percentage: number;
}

export type StrainSource = 'canopy_original' | 'community_find';
export type StrainVerificationStatus = 'verified' | 'pending' | 'rejected';

export interface ResearchSource {
  url: string;
  title: string;
}

export interface Strain {
  id: string;
  slug: string;
  name: string;
  type: StrainType;
  thc: number;
  cbd: number;
  description: string;
  effects: string[];
  symptoms: string[];
  terpenes: Terpene[];
  rating: number;
  review_count: number;
  featured: boolean;
  source?: StrainSource;
  verification_status?: StrainVerificationStatus;
  found_by_user_id?: string | null;
  research_sources?: ResearchSource[] | null;
}

export interface Dispensary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  address: string | null;
  city: string;
  state: string;
  zip: string | null;
  phone: string | null;
  website_url: string | null;
  license_number: string | null;
  hours: Record<string, string>;
  status: 'pending' | 'approved' | 'rejected';
  tier?: 'free' | 'pro' | 'verified';
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  owner_id?: string | null;
  created_at: string;
}

export interface DispensaryProduct {
  id: string;
  dispensary_id: string;
  strain_id: string;
  price: number | null;
  in_stock: boolean;
}

export type ProductCategory =
  | 'flower'
  | 'preroll'
  | 'concentrate'
  | 'vape'
  | 'edible'
  | 'tincture'
  | 'topical'
  | 'accessory'
  | 'other';

export const PRODUCT_CATEGORIES: { id: ProductCategory; label: string }[] = [
  { id: 'flower', label: 'Flower' },
  { id: 'preroll', label: 'Prerolls' },
  { id: 'concentrate', label: 'Concentrates / Dabs' },
  { id: 'vape', label: 'Vapes' },
  { id: 'edible', label: 'Edibles' },
  { id: 'tincture', label: 'Tinctures' },
  { id: 'topical', label: 'Topicals' },
  { id: 'accessory', label: 'Accessories' },
  { id: 'other', label: 'Other' },
];

export interface Product {
  id: string;
  dispensary_id: string;
  strain_id: string | null;
  category: ProductCategory;
  name: string;
  brand: string | null;
  description: string | null;
  price: number | null;
  image_url: string | null;
  thc: number | null;
  cbd: number | null;
  in_stock: boolean;
  sku?: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  name: string | null;
  age_confirmed: boolean;
  points: number;
  referral_code: string | null;
  referred_by: string | null;
  member_tier: 'free' | 'plus';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  city?: string | null;
  state?: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  strain_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  created_at: string;
  profiles?: { name: string | null } | null;
}

export type DealDiscountType = 'percentage' | 'fixed' | 'bogo';

export const DEAL_DISCOUNT_LABELS: Record<DealDiscountType, string> = {
  percentage: '% off',
  fixed: '$ off',
  bogo: 'BOGO',
};

export interface Deal {
  id: string;
  dispensary_id: string;
  title: string;
  description: string | null;
  category: ProductCategory | null;
  discount_type: DealDiscountType;
  discount_value: number | null;
  starts_at: string;
  ends_at: string | null;
  active: boolean;
  created_at: string;
}

export function formatDealDiscount(deal: Pick<Deal, 'discount_type' | 'discount_value'>): string {
  if (deal.discount_type === 'bogo') return 'BOGO';
  if (deal.discount_type === 'percentage') return `${deal.discount_value ?? 0}% off`;
  return `$${deal.discount_value ?? 0} off`;
}

export type GrowStage = 'seedling' | 'vegetative' | 'flowering' | 'pre-harvest' | 'harvested';

export const GROW_STAGES: { id: GrowStage; label: string }[] = [
  { id: 'seedling', label: 'Seedling' },
  { id: 'vegetative', label: 'Vegetative' },
  { id: 'flowering', label: 'Flowering' },
  { id: 'pre-harvest', label: 'Pre-Harvest' },
  { id: 'harvested', label: 'Harvested' },
];

export interface StrainPhoto {
  id: string;
  strain_id: string;
  submitted_by: string;
  image_url: string;
  grow_stage: GrowStage;
  caption: string | null;
  credit_name: string | null;
  verification_status: StrainVerificationStatus;
  created_at: string;
}

export interface StrainPhotoRating {
  id: string;
  photo_id: string;
  user_id: string;
  rating: number;
  created_at: string;
}

export interface DispensaryReview {
  id: string;
  dispensary_id: string;
  user_id: string;
  rating: number;
  body: string | null;
  owner_response: string | null;
  owner_response_at: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  points: number;
  member_tier: 'free' | 'plus';
  created_at: string;
  review_count: number;
  referral_count: number;
}
