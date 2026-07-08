/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Send, 
  Sparkles, 
  MessageSquare,
  Bot,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdvisorSettings, Product } from '../types';
import { getDirectImageUrl } from '../utils';

interface AdvisorChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  advisor: AdvisorSettings;
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

export default function AdvisorChatDrawer({
  isOpen,
  onClose,
  advisor,
  products,
  onSelectProduct
}: AdvisorChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `أهلاً بكِ يا عزيزتي في متجر أم روح! 🌸✨ أنا المستشارة روح، رفيقتكِ ومستشارتكِ الخاصة للتسوق بالمتجر. 

يسعدني جداً مساعدتكِ في اختيار أفضل الأدوات المنزلية، الملابس الأنيقة، الألعاب الرائعة للأطفال ومستحضرات التجميل. كيف يمكنني خدمتكِ وإسعادكِ اليوم؟ 🥰🛍️`
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Extract products mentioned in the model's message
  const getRecommendedProducts = (text: string) => {
    if (!text) return [];
    const matched: Product[] = [];
    products.forEach(p => {
      const nameClean = p.name.trim().toLowerCase();
      const codeClean = p.code.trim().toLowerCase();
      const textClean = text.toLowerCase();
      if (
        (nameClean.length > 2 && textClean.includes(nameClean)) || 
        (codeClean.length > 2 && textClean.includes(codeClean))
      ) {
        if (!matched.some(m => m.id === p.id)) {
          matched.push(p);
        }
      }
    });
    return matched;
  };

  // Predefined prompts suggestions
  const suggestions = [
    'اقترحي أدوات منزلية مميزة 🏠',
    'أريد ملابس أطفال تناسب سن سنتين 👶',
    'ما هي أفضل العروض المتاحة اليوم؟ 🏷️',
    'اقترحي هدايا تجميلية فاخرة 💄'
  ];

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    setErrorText('');
    const userMsg: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      text: textToSend.trim()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/advisor/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          products
        }),
      });

      let data: any;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error('Non-JSON response from server:', text);
        if (response.status === 500) {
          throw new Error('عذراً يا عزيزتي، حدث خطأ في خادم المستشارة (500). يرجى التأكد من إضافة مفاتيح بيئة التشغيل GEMINI_API_KEY في منصة النشر Vercel وتجربة الطلب مجدداً! 🌸');
        } else {
          throw new Error(`فشل الاتصال بالخادم برمز حالة: ${response.status}`);
        }
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'فشل الاتصال بخادم المستشارة الذكية.');
      }

      setMessages(prev => [...prev, {
        id: 'reply-' + Date.now(),
        role: 'model',
        text: data.text
      }]);
    } catch (err: any) {
      console.warn('Advisor chat API error, falling back to local client-side assistant helper:', err);
      const fallbackText = getClientFallbackResponse(textToSend.trim(), products);
      setMessages(prev => [...prev, {
        id: 'reply-fallback-' + Date.now(),
        role: 'model',
        text: fallbackText
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-0"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-[32px] p-0 flex flex-col h-[85vh] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-l from-amber-500 to-amber-600 dark:from-amber-600 dark:to-amber-800 p-4 text-white flex justify-between items-center shadow-sm">
              <button
                onClick={onClose}
                className="bg-white/10 hover:bg-white/25 p-2 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 text-right">
                <div>
                  <h3 className="text-sm font-black flex items-center gap-1.5 justify-end">
                    <span>دردشة مع {advisor.name}</span>
                    <Bot className="w-4 h-4 text-amber-200" />
                  </h3>
                  <p className="text-[10px] opacity-90 mt-0.5">{advisor.title}</p>
                </div>
                <img
                  src={getDirectImageUrl(advisor.image)}
                  alt={advisor.name}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm shrink-0"
                />
              </div>
            </div>

            {/* Chat Messages Logs */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-amber-50/20 dark:bg-gray-950">
              {messages.map((msg) => {
                const isModel = msg.role === 'model';
                const recs = isModel ? getRecommendedProducts(msg.text) : [];
                return (
                  <div key={msg.id} className="space-y-3">
                    <div
                      className={`flex gap-2.5 ${isModel ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Message Bubble */}
                      <div
                        className={`max-w-[80%] rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm font-medium whitespace-pre-wrap text-right ${
                          isModel
                            ? 'bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 rounded-tr-none border border-amber-100/50 dark:border-gray-800'
                            : 'bg-amber-500 text-white rounded-tl-none'
                        }`}
                      >
                        {msg.text}
                      </div>

                      {isModel && (
                        <img
                          src={getDirectImageUrl(advisor.image)}
                          alt="روح"
                          className="w-7 h-7 rounded-full object-cover border shadow-sm self-start shrink-0"
                        />
                      )}
                    </div>

                    {/* Render matching product recommendation cards under model bubble if any */}
                    {isModel && recs.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 px-1 scrollbar-thin justify-start flex-row-reverse" style={{ direction: 'rtl' }}>
                        {recs.map((p) => (
                          <div
                            key={p.id}
                            className="bg-white dark:bg-gray-900 border border-amber-100 dark:border-gray-800 p-2 rounded-2xl flex flex-col w-[125px] shrink-0 text-right space-y-1.5 shadow-sm hover:border-amber-400 transition"
                          >
                            <img
                              src={getDirectImageUrl(p.images[0])}
                              alt={p.name}
                              className="w-full h-20 object-cover rounded-xl border border-gray-100 dark:border-gray-850 pointer-events-none"
                            />
                            <div className="flex-1 flex flex-col justify-between">
                              <div>
                                <h4 className="text-[10px] font-black text-gray-900 dark:text-white line-clamp-1">
                                  {p.name}
                                </h4>
                                <p className="text-[9px] text-gray-400 mt-0.5 line-clamp-1">{p.categoryName}</p>
                              </div>
                              <div className="mt-1.5 space-y-1">
                                <p className="text-[9px] font-black text-amber-700 dark:text-amber-400">
                                  {p.priceYERNew} ريال جديد
                                </p>
                                <button
                                  onClick={() => onSelectProduct(p)}
                                  className="w-full py-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[8px] rounded-lg transition-all cursor-pointer shadow-sm text-center"
                                >
                                  عرض التفاصيل 🛍️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex gap-2.5 justify-end items-center">
                  <div className="bg-white dark:bg-gray-900 rounded-2xl p-3.5 border border-amber-50 dark:border-gray-800 shadow-sm flex items-center gap-1.5 shrink-0">
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce delay-100" />
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce delay-200" />
                    <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce delay-300" />
                  </div>
                  <img
                    src={getDirectImageUrl(advisor.image)}
                    alt="روح"
                    className="w-7 h-7 rounded-full object-cover border shadow-sm self-start shrink-0"
                  />
                </div>
              )}

              {errorText && (
                <div className="bg-red-50 dark:bg-red-950/30 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100 text-right">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{errorText}</span>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* suggestions quick tags */}
            {messages.length === 1 && (
              <div className="bg-white dark:bg-gray-900 p-3 border-t border-amber-50 dark:border-gray-800 flex gap-2 overflow-x-auto scrollbar-none" style={{ direction: 'rtl' }}>
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(s)}
                    className="px-3.5 py-1.5 bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-400/10 text-amber-900 dark:text-amber-300 rounded-xl text-[10.5px] font-bold border border-amber-500/10 transition shrink-0 whitespace-nowrap"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input Form footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputValue);
              }}
              className="p-4 bg-white dark:bg-gray-900 border-t border-amber-50 dark:border-gray-850 flex gap-2.5 items-center"
            >
              <button
                id="send-advisor-msg-btn"
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 dark:disabled:bg-gray-800 text-white p-3 rounded-xl shadow transition shrink-0"
              >
                <Send className="w-4 h-4 transform rotate-180" />
              </button>

              <input
                id="advisor-chat-input"
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="اكتبي سؤالكِ للمستشارة روح هنا..."
                dir="rtl"
                className="flex-1 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-amber-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-1 focus:ring-amber-500 text-xs font-semibold text-right"
              />
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function getClientFallbackResponse(userMessage: string, products: Product[]): string {
  const msg = (userMessage || '').toLowerCase();
  let matchedProducts: Product[] = [];
  
  if (products && products.length > 0) {
    if (msg.includes('منزل') || msg.includes('مطبخ') || msg.includes('أدوات') || msg.includes('أواني') || msg.includes('بيت')) {
      matchedProducts = products.filter(p => 
        (p.categoryName || '').includes('منزل') || 
        (p.categoryName || '').includes('مطبخ') || 
        (p.categoryName || '').includes('أدوات') ||
        (p.name || '').includes('أدوات') || 
        (p.name || '').includes('مطبخ') || 
        (p.name || '').includes('بيت')
      );
    } else if (msg.includes('ملابس') || msg.includes('فساتين') || msg.includes('لبس') || msg.includes('أناقة') || msg.includes('بنات') || msg.includes('أولاد')) {
      matchedProducts = products.filter(p => 
        (p.categoryName || '').includes('ملابس') || 
        (p.categoryName || '').includes('أناقة') ||
        (p.name || '').includes('ملابس') || 
        (p.name || '').includes('فستان') || 
        (p.name || '').includes('لبس')
      );
    } else if (msg.includes('ألعاب') || msg.includes('لعبة') || msg.includes('أطفال') || msg.includes('طفل')) {
      matchedProducts = products.filter(p => 
        (p.categoryName || '').includes('ألعاب') || 
        (p.categoryName || '').includes('أطفال') ||
        (p.name || '').includes('لعبة') || 
        (p.name || '').includes('ألعاب') || 
        (p.name || '').includes('طفل')
      );
    } else if (msg.includes('تجميل') || msg.includes('مكياج') || msg.includes('عناية') || msg.includes('بشرة') || msg.includes('عطور')) {
      matchedProducts = products.filter(p => 
        (p.categoryName || '').includes('تجميل') || 
        (p.categoryName || '').includes('مكياج') || 
        (p.categoryName || '').includes('عناية') ||
        (p.name || '').includes('تجميل') || 
        (p.name || '').includes('مكياج') || 
        (p.name || '').includes('عطر')
      );
    } else if (msg.includes('عرض') || msg.includes('عروض') || msg.includes('خصم') || msg.includes('تخفيض')) {
      matchedProducts = products.filter(p => 
        (p.description || '').includes('عرض') || 
        (p.description || '').includes('تخفيض') || 
        (p.description || '').includes('خصم')
      );
    }
    
    if (matchedProducts.length === 0) {
      matchedProducts = products.slice(0, 3);
    }
  }

  const recs = matchedProducts.slice(0, 3);
  let productListMarkdown = '';
  
  if (recs.length > 0) {
    productListMarkdown = `إليكِ بعض المنتجات المميزة المتاحة في الكتالوج حالياً والتي قد تنال إعجابكِ يا جميلة: 🥰👇\n\n` + 
      recs.map(p => `✨ **${p.name}**\n  - السعر: ${p.priceYERNew} ريال يمني جديد\n  - القسم: ${p.categoryName || 'غير محدد'}`).join('\n\n');
  } else {
    productListMarkdown = `أهلاً بكِ يا عزيزتي! يسعدني جداً تصفحكِ لمتجر أم روح. الكتالوج يحتوي على العديد من القطع المميزة والفريدة من نوعها. تفضلي بتصفح الأقسام لتكتشفي كل جديد! 🌸🛒`;
  }

  return `أهلاً بكِ يا جميلة! 🌸 لقد استقبلت رسالتكِ بكل سرور.\n\n${productListMarkdown}\n\nإذا كان لديكِ أي استفسار آخر أو ترغبين في المساعدة بإتمام طلبكِ، فأنا هنا دائماً لخدمتكِ! 💕`;
}
