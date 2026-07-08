/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

interface NewsTickerProps {
  tickerTexts?: string[];
}

export default function NewsTicker({ tickerTexts = [] }: NewsTickerProps) {
  const items = tickerTexts && tickerTexts.length > 0 ? tickerTexts : [
    'مرحباً بكم في متجر أم روح 🌸 منصتكم الأولى للتسوق للأسر المنتجة باليمن!',
    'توصيل سريع ومضمون لكافة المحافظات اليمنية 🚚',
    'خصومات وعروض مميزة مستمرة على كافة الأقسام 🌟'
  ];

  // Separate each news item with the distinctive store flower 🌸
  const joinedText = items.join(' 🌸 ');
  let displayText = `🌸 ${joinedText} `;

  // We pad the text if it is too short to ensure it spans across the viewport
  while (displayText.length < 150) {
    displayText += `🌸 ${joinedText} `;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="relative w-full overflow-hidden bg-amber-500/10 dark:bg-amber-950/25 text-amber-950 dark:text-amber-200 py-1.5 px-3 rounded-2xl border border-amber-500/15 dark:border-amber-900/40 select-none flex flex-row-reverse items-center shadow-xs mt-3 h-8.5"
      dir="rtl"
    >
      {/* Small beautiful static start indicator icon */}
      <span className="text-xs pl-1.5 animate-pulse shrink-0 z-20">📢</span>

      {/* Scrolling container */}
      <div className="flex-1 overflow-hidden relative flex items-center h-full" dir="ltr">
        {/* Soft edge fade effects */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-amber-500/5 dark:from-gray-950/5 to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-amber-500/5 dark:from-gray-950/5 to-transparent z-10 pointer-events-none" />

        {/* Framer Motion Infinite Marquee */}
        <motion.div
          animate={{ x: ['-50%', '0%'] }}
          transition={{
            ease: 'linear',
            duration: Math.max(15, items.join(' ').length * 0.25),
            repeat: Infinity,
          }}
          className="flex items-center text-[10.5px] font-black text-amber-950 dark:text-amber-200 leading-none h-full py-1 w-max cursor-pointer"
        >
          <span className="whitespace-nowrap px-4 shrink-0" dir="rtl">{displayText}</span>
          <span className="whitespace-nowrap px-4 shrink-0" dir="rtl">{displayText}</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
