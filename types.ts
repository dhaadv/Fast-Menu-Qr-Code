export type Language = 'en' | 'pt';

export interface MenuItem {
  name: string;
  description: string;
  price: string;
  image?: string; // Base64 data URL
}

export interface MenuCategory {
  title: string;
  items: MenuItem[];
  highlight?: boolean; // Used for Specials/Highlights
}

export interface RestaurantMenu {
  id: string;
  slug: string; // Public URL identifier (permanent)
  ownerId?: string; // For auth
  name: string;
  businessType?: string; // e.g., 'Hamburgueria', 'Sushi Bar'
  whatsapp?: string;
  customQrUrl?: string; // Overrides the default menu link in the QR code
  themeColor: string; // e.g., 'blue', 'orange', 'green'
  logo?: string; // Base64 data URL for the establishment logo
  categories: MenuCategory[];
  createdAt: number;
  language?: Language;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}