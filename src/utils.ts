/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Currency, ExchangeRate, User, Order } from './types';

/**
 * Converts price from YER_NEW to the target currency based on exchange rates and rounding rules.
 * - YER_NEW: Standard price
 * - YER_OLD: Price / yerOldFactor, rounded UP to the nearest 100
 * - SAR: Price / sarFactor, rounded UP to the nearest whole integer
 */
export function convertPrice(priceYERNew: number, targetCurrency: Currency, rates: ExchangeRate): number {
  if (targetCurrency === 'YER_NEW') {
    return priceYERNew;
  }
  
  if (targetCurrency === 'YER_OLD') {
    const raw = priceYERNew / rates.yerOldFactor;
    return Math.ceil(raw / 100) * 100;
  }
  
  if (targetCurrency === 'SAR') {
    const raw = priceYERNew / rates.sarFactor;
    return Math.ceil(raw);
  }
  
  return priceYERNew;
}

export function getCurrencySymbol(currency: Currency): string {
  switch (currency) {
    case 'YER_NEW':
      return 'ريال يمني جديد';
    case 'YER_OLD':
      return 'ريال يمني قديم';
    case 'SAR':
      return 'ريال سعودي';
    default:
      return '';
  }
}

export function getCurrencyCode(currency: Currency): string {
  switch (currency) {
    case 'YER_NEW':
      return 'ر.ي ج';
    case 'YER_OLD':
      return 'ر.ي ق';
    case 'SAR':
      return 'ر.س';
    default:
      return '';
  }
}

/**
 * Formats a ISO date string to a beautiful Arabic date & time.
 */
export function formatArabicDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return dateStr;
  }
}

/**
 * Parses text and converts *text* to bold HTML blocks.
 * Supports emojis.
 */
export function parseDescription(text: string): React.ReactNode[] {
  if (!text) return [];
  
  // Split by asterisks to find *bold text*
  const parts = text.split(/(\*[^*]+\*)/g);
  
  return parts.map((part, index) => {
    if (part.startsWith('*') && part.endsWith('*')) {
      return React.createElement(
        'strong',
        { key: index, className: 'font-extrabold text-gray-900 dark:text-white' },
        part.slice(1, -1)
      );
    }
    return part;
  });
}

/**
 * Generates the WhatsApp share text link for a single product with selected properties.
 */
export function generateWhatsAppLink(
  phone: string,
  productName: string,
  selectedProperties: { [key: string]: string },
  price: number,
  currencyCode: string,
  quantity: number
): string {
  const cleanPhone = phone.replace(/[+\s-]/g, '');
  
  let propertiesText = '';
  Object.entries(selectedProperties).forEach(([key, val]) => {
    if (val) {
      propertiesText += `\n- *${key}:* ${val}`;
    }
  });

  const message = `مرحباً متجر أم روح،
أود طلب المنتج التالي:
🛍️ *اسم المنتج:* ${productName}
🔢 *الكمية:* ${quantity}
💰 *السعر:* ${price} ${currencyCode}
💵 *الإجمالي:* ${price * quantity} ${currencyCode}${propertiesText ? `\n\n⚙️ *الخيارات المختارة:*${propertiesText}` : ''}

شكراً لكم!`;

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Converts viewing URLs (like Google Drive share links) into direct raw image source links.
 */
export function getDirectImageUrl(url: string): string {
  if (!url) return '';
  
  // Clean potential whitespace
  const cleanUrl = url.trim();

  // If it's a Google Drive link
  if (cleanUrl.includes('drive.google.com')) {
    let fileId = '';
    
    // Pattern 1: /file/d/{id}/view
    const matchD = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (matchD && matchD[1]) {
      fileId = matchD[1];
    } else {
      // Pattern 2: ?id={id}
      const matchId = cleanUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (matchId && matchId[1]) {
        fileId = matchId[1];
      }
    }
    
    if (fileId) {
      // Google user content service is highly reliable for embedding Drive images
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }
  
  return cleanUrl;
}

/**
 * Checks if a user matches target criteria based on targetType and targetValue.
 */
export function evaluateUserTarget(
  user: User,
  userOrders: Order[],
  targetType: 'all' | 'address' | 'join_month' | 'join_duration' | 'username' | 'orders_count',
  targetValue: string
): boolean {
  if (targetType === 'all') {
    return true;
  }
  
  if (targetType === 'address') {
    return (user.address || '').toLowerCase().includes((targetValue || '').toLowerCase());
  }
  
  if (targetType === 'join_month') {
    return user.joinDate === targetValue;
  }
  
  if (targetType === 'join_duration') {
    if (!user.joinDate) return false;
    try {
      const [joinYr, joinMo] = user.joinDate.split('-').map(Number);
      const today = new Date();
      const currYr = today.getFullYear();
      const currMo = today.getMonth() + 1; // 1-indexed
      const months = (currYr - joinYr) * 12 + (currMo - joinMo);
      return months >= parseInt(targetValue, 10);
    } catch (e) {
      return false;
    }
  }
  
  if (targetType === 'username') {
    return (
      (user.name || '').toLowerCase().includes((targetValue || '').toLowerCase()) ||
      user.id === targetValue
    );
  }
  
  if (targetType === 'orders_count') {
    const completedCount = userOrders.filter(o => o.status === 'completed').length;
    return completedCount >= parseInt(targetValue, 10);
  }
  
  return false;
}

/**
 * Triggers a real browser system-level notification.
 * Works even when the browser tab is in the background or active.
 */
export function showSystemNotification(
  title: string,
  message: string,
  options?: { tag?: string; image?: string; data?: any }
) {
  if (typeof window === 'undefined') return;
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    try {
      const tag = options?.tag || 'um-rouh-store-notification-' + Date.now();
      const image = options?.image || undefined;
      const data = options?.data || undefined;

      // Try using serviceWorker for background-capable notifications
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body: message,
            icon: '/icon-192.png',
            image: image,
            vibrate: [200, 100, 200],
            tag: tag,
            badge: '/icon-192.png',
            data: data
          } as any);
        }).catch(() => {
          // Fallback if ServiceWorker ready fails
          new Notification(title, {
            body: message,
            icon: '/icon-192.png',
            image: image,
            tag: tag,
            data: data
          } as any);
        });
      } else {
        // Fallback to standard web notification
        new Notification(title, {
          body: message,
          icon: '/icon-192.png',
          image: image,
          tag: tag,
          data: data
        } as any);
      }
    } catch (err) {
      console.warn('Failed to send notification:', err);
    }
  }
}

/**
 * Copies text to clipboard with maximum compatibility, including standard fallback when document isn't focused or inside iframes.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. Try Navigator Clipboard API if available and document is focused
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn('Navigator clipboard copy failed, trying fallback:', err);
    }
  }

  // 2. Fallback: standard textarea selection and execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // Position out of screen
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    let successful = false;
    try {
      successful = document.execCommand('copy');
    } catch (execErr) {
      console.warn('execCommand copy failed:', execErr);
    }
    
    document.body.removeChild(textArea);
    return successful;
  } catch (fallbackErr) {
    console.error('All clipboard copy methods failed:', fallbackErr);
    return false;
  }
}


