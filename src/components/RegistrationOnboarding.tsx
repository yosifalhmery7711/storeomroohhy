import React, { useState } from 'react';
import { User, Currency } from '../types';
import { motion } from 'motion/react';
import { User as UserIcon, Phone, MapPin, Sparkles, HelpCircle, ArrowRightLeft } from 'lucide-react';

interface RegistrationOnboardingProps {
  onComplete: (registeredUser: User) => void;
}

export default function RegistrationOnboarding({ onComplete }: RegistrationOnboardingProps) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState<Currency>('YER_NEW');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('يرجى إدخال اسمكِ الكريم أولاً.');
      return;
    }

    if (!phone.trim()) {
      setError('يرجى إدخال رقم هاتفكِ المحمول للتواصل وتوصيل الطلبات.');
      return;
    }

    // Phone validation (simple format check or just check length/digits)
    const cleanPhone = phone.trim();
    if (!/^\d+$/.test(cleanPhone) || cleanPhone.length < 9) {
      setError('يرجى إدخال رقم هاتف صحيح ومكتمل (أرقام فقط، 9 خانات على الأقل).');
      return;
    }

    // Generate a unique user ID if we want, or use a clean random one
    const generatedId = 'USR-' + Math.floor(10000 + Math.random() * 90000);

    const newUser: User = {
      id: generatedId,
      name: name.trim(),
      phone: cleanPhone,
      address: address.trim(),
      currency: currency,
      balance: 0, // Set to 0 default
      giftBalance: 0, // Set to 0 default
      favorites: [],
      joinDate: new Date().toISOString().substring(0, 7), // e.g. '2026-06'
      isRegistered: true
    };

    onComplete(newUser);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-amber-100/40 dark:from-gray-950 dark:to-gray-900 flex flex-col items-center justify-center p-4 text-right" dir="rtl">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-amber-100/60 dark:border-gray-800 p-8 space-y-6 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-36 h-36 bg-amber-200/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-36 h-36 bg-rose-200/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top welcome logo */}
        <div className="flex flex-col items-center text-center space-y-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, type: 'spring' }}
            className="w-20 h-20 bg-gradient-to-br from-amber-400 to-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 text-3xl"
          >
            🌸
          </motion.div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-amber-950 dark:text-amber-100 tracking-tight">
              أهلاً بكِ في متجر أم روح 🌸✨
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-medium">
              المنصة الأروع لتسوق المجوهرات، العطور، والمنتجات الفاخرة. يرجى إتمام التسجيل السريع لتخصيص حسابكِ والبدء فوراً!
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-amber-100 dark:via-gray-800 to-transparent" />

        {/* Registration form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/50 rounded-2xl p-4 text-xs font-bold text-rose-600 dark:text-rose-400"
            >
              ⚠️ {error}
            </motion.div>
          )}

          {/* Input: Name (Mandatory) */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5 text-amber-500" />
              <span>الاسم الكريم <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="text"
              placeholder="مثال: منى الأهدل"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/80 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-right dark:text-white"
              required
            />
          </div>

          {/* Input: Phone (Mandatory) */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-amber-500" />
              <span>رقم الهاتف <span className="text-rose-500">*</span></span>
            </label>
            <input
              type="tel"
              placeholder="مثال: 777123456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/80 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-left placeholder:text-right dark:text-white"
              dir="ltr"
              required
            />
          </div>

          {/* Dropdown: Currency (Mandatory) */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-500" />
              <span>عملة حساب المتجر الافتراضية <span className="text-rose-500">*</span></span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCurrency('YER_NEW')}
                className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                  currency === 'YER_NEW'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-400 ring-2 ring-amber-500/20'
                    : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>الريال اليمني</span>
                <span className="text-[10px] font-medium opacity-80">(جديد)</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrency('YER_OLD')}
                className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                  currency === 'YER_OLD'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-400 ring-2 ring-amber-500/20'
                    : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>الريال اليمني</span>
                <span className="text-[10px] font-medium opacity-80">(قديم)</span>
              </button>
              <button
                type="button"
                onClick={() => setCurrency('SAR')}
                className={`py-3 px-2 rounded-2xl border text-xs font-black transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                  currency === 'SAR'
                    ? 'border-amber-500 bg-amber-500/10 text-amber-900 dark:text-amber-400 ring-2 ring-amber-500/20'
                    : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <span>الريال السعودي</span>
                <span className="text-[10px] font-medium opacity-80">(سعودي)</span>
              </button>
            </div>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              * يمكنكِ تبديل عملة التصفح بحرية في أي وقت لاحقاً من شاشة المتجر.
            </p>
          </div>

          {/* Input: Address (Optional) */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-xs font-extrabold text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-500" />
                <span>عنوان التوصيل</span>
              </label>
              <span className="text-[10px] text-amber-600 dark:text-amber-500 font-extrabold bg-amber-500/10 px-2 py-0.5 rounded-lg">
                اختياري (يمكن تخطيه)
              </span>
            </div>
            <input
              type="text"
              placeholder="مثال: صنعاء - الأصبحي - جولة صخر"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/80 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30 text-right dark:text-white"
            />
            {address.trim() === '' && (
              <p className="text-[10px] text-rose-500/80 font-bold leading-relaxed">
                ⚠️ إذا تخطيتِ إدخال العنوان الآن، سيُطلب منكِ إدخاله بشكل إجباري عند طلب أول فاتورة لشحن الطلب.
              </p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-black py-4 px-4 rounded-2xl shadow-xl shadow-amber-500/25 active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 text-sm"
            >
              <Sparkles className="w-4 h-4" />
              ابدئي التسوق وتفعيل الحساب 💖
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
