/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdvisorSettings } from '../types';
import { getDirectImageUrl } from '../utils';

interface HeaderProps {
  advisor: AdvisorSettings;
  offerImages: string[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onAdvisorClick?: () => void;
  showNotificationBadge?: boolean;
  onNotificationClick?: () => void;
}

export default function Header({
  advisor,
  offerImages,
  searchQuery,
  setSearchQuery,
  onAdvisorClick,
  showNotificationBadge,
  onNotificationClick,
}: HeaderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  // Auto scroll banners every 3 seconds
  useEffect(() => {
    if (!offerImages || offerImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % offerImages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [offerImages]);

  return (
    <header className="bg-gradient-to-b from-amber-50 to-white dark:from-gray-950 dark:to-gray-900 pt-5 pb-3 px-4 shadow-sm border-b border-amber-50 dark:border-gray-800">
      <div className="max-w-md mx-auto space-y-4">
        {/* Top Branding Section */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 text-white p-1.5 rounded-xl shadow-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-amber-900 dark:text-amber-400 tracking-tight font-sans">
                مَتْجَرُ أُمِّ رُوْح
              </h1>
              <p className="text-[10px] text-amber-700 dark:text-amber-500 font-medium">
                للأدوات المنزلية، الملابس، الألعاب، ومستحضرات التجميل
              </p>
            </div>
          </div>

          {/* Top Icons (Notifications / Advisor Advice) */}
          <div className="flex items-center gap-2">
            {onNotificationClick && (
              <button
                id="header-notif-btn"
                onClick={onNotificationClick}
                className="relative bg-white dark:bg-gray-800 p-2 rounded-xl border border-amber-100 dark:border-gray-700 shadow-sm text-gray-600 dark:text-gray-300 hover:bg-amber-50 focus:outline-none"
              >
                <span className="relative block">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {showNotificationBadge && (
                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-800 animate-pulse" />
                  )}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* 1. Rotatable Offer Banner */}
        <div className="relative h-32 w-full rounded-2xl overflow-hidden shadow-md border border-amber-100 dark:border-gray-800 bg-amber-100/30">
          {offerImages.length > 0 ? (
            <div className="relative w-full h-full">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentSlide}
                  src={offerImages[currentSlide]}
                  alt="عرض متجر أم روح"
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ duration: 0.5 }}
                />
              </AnimatePresence>
              
              {/* Overlay with subtle branding text */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex items-end p-3">
                <span className="text-white text-xs font-semibold tracking-wide bg-amber-600/90 px-2.5 py-1 rounded-lg">
                  عروض متجر أم روح الخاصة ✨
                </span>
              </div>

              {/* Indicator dots */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                {offerImages.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentSlide(idx)}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      currentSlide === idx ? 'bg-amber-500 w-3' : 'bg-white/60'
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full bg-amber-50 text-amber-800 font-medium">
              جاري تحميل العروض...
            </div>
          )}
        </div>

        {/* 2. Elegant Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-amber-700 dark:text-amber-500">
            <Search className="h-4.5 w-4.5" />
          </div>
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحثي عن الأدوات المنزلية، الملابس، أو مستحضرات التجميل..."
            dir="rtl"
            className="w-full pl-4 pr-11 py-3 bg-amber-50/50 focus:bg-white dark:bg-gray-800 dark:focus:bg-gray-900 text-gray-900 dark:text-white placeholder-amber-800/40 dark:placeholder-gray-500 border border-amber-100 dark:border-gray-700 rounded-2xl shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all duration-300 text-sm font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 3. Advisor "روح" Badge Section */}
        <motion.div
          id="advisor-badge"
          onClick={onAdvisorClick}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-3.5 bg-amber-50/70 dark:bg-gray-800/60 p-3 rounded-2xl border border-amber-100/60 dark:border-gray-800 cursor-pointer shadow-sm hover:shadow transition-all"
        >
          <div className="relative">
            <img
              src={getDirectImageUrl(advisor.image)}
              alt={advisor.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-amber-500 shadow-md ring-4 ring-amber-50 dark:ring-gray-800"
            />
            <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-green-500 ring-2 ring-white dark:ring-gray-800" />
          </div>
          
          <div className="flex-1 text-right">
            <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-300 flex items-center gap-1">
              <span>{advisor.name}</span>
              <span className="text-[10px] bg-amber-500/10 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-bold">
                مستشارة موثوقة
              </span>
            </h3>
            <p className="text-[11px] text-amber-800/80 dark:text-gray-400 font-medium">
              تسوقي بكل ثقة وطمأنينة! أنا هنا لمساعدتك على اختيار أفضل المنتجات المنزلية وتجهيز طلبك فوراً 💬.
            </p>
          </div>
          
          <div className="bg-amber-100 dark:bg-gray-700 p-2 rounded-xl text-amber-800 dark:text-amber-300">
            <Volume2 className="w-4 h-4 animate-bounce" />
          </div>
        </motion.div>
      </div>
    </header>
  );
}

// Simple close icon if needed
function X({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
