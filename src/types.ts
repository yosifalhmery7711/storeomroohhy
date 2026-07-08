/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Currency = 'YER_NEW' | 'YER_OLD' | 'SAR';

export interface User {
  id: string;
  name: string;
  phone: string;
  address: string;
  currency: Currency;
  balance: number; // User wallet/recharge balance
  giftBalance?: number; // User gift balance
  favorites?: string[]; // Array of favorited product IDs
  joinDate?: string; // Month/Date of joining (e.g. '2026-06')
  isRegistered?: boolean; // Flag to check if user has gone through registration onboarding
  deviceId?: string; // Unique browser/device footprint to prevent multiple devices per phone number
}

export interface Category {
  id: string; // matches Category Code
  name: string;
  image: string;
  productCount: number;
  sortOrder?: number;
}

export interface PropertyDefinition {
  name: string; // e.g., "المقاس" or "اللون"
  options: string[]; // e.g., ["38", "39", "40"]
}

export interface Product {
  id: string;
  code: string; // رمز الصنف
  name: string;
  categoryId: string;
  categoryName: string;
  subCategoryIds?: string[]; // Multiple sub-categories
  description: string;
  priceYERNew: number;
  images: string[];
  properties: PropertyDefinition[]; // only active properties
  isOnOffer: boolean;
  offerPriceNew?: number;
  offerOldPrice?: number;
  rating?: number;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productCode: string;
  image: string;
  selectedProperties: { [propertyName: string]: string };
  price: number; // calculated according to currency selected at time of purchase
  currency: Currency;
  quantity: number;
  totalPrice: number;
}

export type OrderStatus = 'pending' | 'completed' | 'canceled';

export interface Order {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  address: string;
  deliveryFee: number;
  items: OrderItem[];
  senderName: string;
  senderAccount: string;
  receiptImage?: string; // Base64
  totalAmount: number; // item total + delivery fee
  currency: Currency;
  createdAt: string;
  status: OrderStatus;
  paymentMethod: 'al_kuraimi' | 'gift_wallet' | 'recharge_wallet' | 'najm'; // al_kuraimi, paid using Um Rouh gifts, paid using recharged wallet, or Najm transfer
  checkoutVia?: 'app' | 'whatsapp';
}

export interface ExchangeRate {
  yerOldFactor: number; // divide new Rial by this (default 2.9) then round up to nearest 100
  sarFactor: number; // divide new Rial by this (default 410) then round up to nearest whole integer
}

export interface Gift {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  createdAt: string;
}

export interface RechargeRequest {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  senderName: string;
  senderAccount: string;
  amount: number;
  receiptImage: string; // Base64
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AdvisorSettings {
  image: string;
  name: string;
  title: string;
}

export interface BankAccount {
  currency: 'YER_NEW' | 'YER_OLD' | 'SAR';
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface AdminSettings {
  code: string;
  workerCode?: string; // Secret code for category/product worker
  bankAccounts?: BankAccount[];
  androidDownloadUrl?: string; // Add Android App Download Link
  whatsappNumber?: string; // Add WhatsApp Number field
  currentAppUrl?: string; // Dynamic app updates / OTA URL
  kuraimiAccountName?: string; // اسم صاحب الحساب لكريمي
  kuraimiAccountNumber?: string; // رقم الحساب لكريمي
  najmReceiverName?: string; // اسم مستلم حوالات النجم
}

export interface OfferImage {
  id: string;
  image: string;
  title?: string;
}

export interface PhoneChangeRequest {
  id: string;
  userId: string;
  userName: string;
  oldPhone: string;
  newPhone: string;
  newName?: string; // Optional official name change request
  createdAt: string;
  status: 'pending' | 'approved' | 'rejected';
  type?: 'change_phone' | 'device_unlock';
  newDeviceId?: string;
}

export interface Notification {
  id: string;
  userId?: string; // empty means public
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  image?: string; // Attach item thumbnail or banner image
  productId?: string; // Deep link to product details
}

export interface DeliveryLocation {
  id: string;
  name: string;
  deliveryFee: number;
}

export interface TargetedNotification {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  expiryAt: string; // Expiry ISO string
  targetType: 'all' | 'address' | 'join_month' | 'join_duration' | 'orders_count';
  targetValue: string; // e.g. "LOC_1", "2026-06", "5", etc.
  isPopup: boolean;
}

export interface TargetedGift {
  id: string;
  title: string;
  amount: number;
  createdAt: string;
  expiryAt: string; // Expiry ISO string of the campaign
  targetType: 'all' | 'address' | 'join_month' | 'join_duration' | 'username' | 'orders_count';
  targetValue: string;
  daysToUse: number; // Duration to spend the balance (e.g. 7 days)
  claimedUserIds?: string[]; // Array of user IDs who already claimed
}

export interface UserTargetedGiftLog {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  amount: number;
  giftCampaignId: string;
  giftCampaignTitle: string;
  createdAt: string;
  expiryAt: string; // Expiry of this specific user's gift balance
  status: 'active' | 'used' | 'expired';
}


