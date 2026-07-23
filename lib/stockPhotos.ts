// Free-to-use (Pexels License: free to use, no attribution required, may
// not be resold unaltered or imply endorsement) stock photography of real,
// healthy cannabis plants -- used so strain cards/pages show shoppers what a
// well-grown plant actually looks like, instead of a gradient placeholder.
// These are generic stock photos (not photos of the specific strain) since
// we don't have per-strain photography -- real, dispensary-submitted photos
// of actual inventory are layered on top via FlipProductCard where available.

import { StrainType } from './types';

export const TYPE_STOCK_PHOTOS: Record<StrainType, string> = {
  // Dense indoor grow room, tight colorful buds -- reads "heavy/relaxing."
  Indica: 'https://images.pexels.com/photos/5564076/pexels-photo-5564076.jpeg?auto=compress&cs=tinysrgb&w=800',
  // Tall outdoor plant in natural light -- reads "bright/energizing."
  Sativa: 'https://images.pexels.com/photos/606506/pexels-photo-606506.jpeg?auto=compress&cs=tinysrgb&w=800',
  // Vibrant, balanced close-up -- reads "in-between."
  Hybrid: 'https://images.pexels.com/photos/3536257/pexels-photo-3536257.jpeg?auto=compress&cs=tinysrgb&w=800',
};

// A trichome-rich macro bud shot, used as the larger hero crop on strain
// detail pages so the "what it's truly supposed to look like when grown
// properly" close-up detail shows through.
export const MACRO_BUD_PHOTO =
  'https://images.pexels.com/photos/3047447/pexels-photo-3047447.jpeg?auto=compress&cs=tinysrgb&w=1200';

export function stockPhotoFor(type: StrainType): string {
  return TYPE_STOCK_PHOTOS[type] || TYPE_STOCK_PHOTOS.Hybrid;
}
