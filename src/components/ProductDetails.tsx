/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Heart, 
  Share2, 
  Star, 
  Plus, 
  Minus, 
  ShoppingBag, 
  ShoppingCart,
  ChevronDown,
  Sparkles,
  Store,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Currency, ExchangeRate, User } from '../types';
import { convertPrice, getCurrencySymbol, getCurrencyCode, parseDescription, generateWhatsAppLink, getDirectImageUrl, copyToClipboard } from '../utils';
import { Database } from '../Database';

interface ProductDetailsProps {
  product: Product;
  onBack: () => void;
  rates: ExchangeRate;
  onAddToCart: (product: Product, quantity: number, properties: { [key: string]: string }, currency: Currency) => void;
  allProducts: Product[];
  onSelectProduct: (product: Product) => void;
  user: User;
  onToggleFavorite: (productId: string) => void;
}

export default function ProductDetails({
  product,
  onBack,
  rates,
  onAddToCart,
  allProducts,
  onSelectProduct,
  user,
  onToggleFavorite
}: ProductDetailsProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(user.currency || 'YER_NEW');

  useEffect(() => {
    if (user.currency) {
      setSelectedCurrency(user.currency);
    }
  }, [user.currency]);

  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'specs' | 'similar' | 'store'>('specs');
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Handle physical device back button / swipe back gesture to close lightbox
  useEffect(() => {
    if (isLightboxOpen) {
      // Push state to browser history when lightbox opens
      window.history.pushState({ lightbox: true }, '');

      const handlePopState = (e: PopStateEvent) => {
        // If back is pressed, close the lightbox
        setIsLightboxOpen(false);
      };

      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isLightboxOpen]);

  const closeLightbox = () => {
    if (isLightboxOpen) {
      setIsLightboxOpen(false);
      // Clean up the history state we pushed if it is still present
      if (window.history.state && window.history.state.lightbox) {
        window.history.back();
      }
    }
  };
  const [cartSuccess, setCartSuccess] = useState(false);

  const handleDragEnd = (event: any, info: any) => {
    if (!product.images || product.images.length <= 1) return;
    const swipeThreshold = 40; // threshold in pixels
    if (info.offset.x > swipeThreshold) {
      // Dragged right (show previous)
      setCurrentImageIndex((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
    } else if (info.offset.x < -swipeThreshold) {
      // Dragged left (show next)
      setCurrentImageIndex((prev) => (prev === product.images.length - 1 ? 0 : prev + 1));
    }
  };

  const isLiked = user.favorites?.includes(product.id) || false;

  // Track user selection for each active property
  const [selectedProperties, setSelectedProperties] = useState<{ [key: string]: string }>(() => {
    const initial: { [key: string]: string } = {};
    product.properties.forEach(p => {
      if (p.options && p.options.length > 0) {
        initial[p.name] = p.options[0]; // default to first option
      }
    });
    return initial;
  });

  const [isDownloadingImage, setIsDownloadingImage] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState('');

  const handleWhatsAppCheckoutWithImage = async (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDownloadingImage(true);
    setDownloadProgress('جاري تجهيز تفاصيل الطلب والصنف...');

    const storePhone = Database.getAdminSettings().whatsappNumber || '967739563915';

    let propertiesText = '';
    Object.entries(selectedProperties).forEach(([key, val]) => {
      if (val) {
        propertiesText += `\n- *${key}:* ${val}`;
      }
    });

    const customerDetailsText = user.isRegistered 
      ? `👤 *الاسم للعميل:* ${user.name}\n📞 *الهاتف:* ${user.phone}\n📍 *العنوان:* ${user.address || 'غير محدد'}` 
      : `👤 *الاسم للعميل:* زائر`;

    const directImageLink = product.images && product.images.length > 0 ? getDirectImageUrl(product.images[0]) : '';

    const messageText = `🌸 *طلب شراء صنف جديد من متجر أم روح* 🌸

🛍️ *اسم المنتج:* ${product.name}
🔢 *رمز المنتج:* ${product.code}
⚙️ *الخيارات المختارة:* ${propertiesText ? propertiesText : '\n- لا توجد خيارات'}
🔢 *الكمية:* ${quantity}
💰 *السعر:* ${displayedPrice} ${getCurrencyCode(selectedCurrency)}
💵 *الإجمالي:* ${displayedPrice * quantity} ${getCurrencyCode(selectedCurrency)}

---
${customerDetailsText}
${directImageLink ? `\n🔗 *رابط صورة الصنف:* ${directImageLink}` : ''}

شكراً لكم! ✨`;

    let imageFile: File | null = null;
    if (directImageLink) {
      try {
        setDownloadProgress('جاري تحميل صورة الصنف من جوجل درايف لإرفاقها بالطلب...');
        const response = await fetch(directImageLink);
        if (response.ok) {
          const blob = await response.blob();
          const ext = blob.type.split('/')[1] || 'jpg';
          imageFile = new File([blob], `${product.code || 'product'}.${ext}`, { type: blob.type });
          setDownloadProgress('تم تحميل الصورة بنجاح! جاري إرسالها إلى الواتساب...');
        } else {
          console.warn("Failed to download image: Non-200 response");
        }
      } catch (err) {
        console.warn("CORS or offline network prevent downloading image blob:", err);
      }
    }

    setIsDownloadingImage(false);

    // If we have an image file and navigator.share is capable, share it
    if (imageFile && navigator.canShare && navigator.canShare({ files: [imageFile] })) {
      try {
        await navigator.share({
          files: [imageFile],
          title: product.name,
          text: messageText
        });
        return;
      } catch (shareErr) {
        console.warn("Web Share API failed, fallback to standard link:", shareErr);
      }
    }

    // Fallback: Direct WhatsApp Link
    const cleanPhone = storePhone.replace(/[+\s-]/g, '');
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank');
  };

  const handlePropertySelect = (propName: string, option: string) => {
    setSelectedProperties(prev => ({
      ...prev,
      [propName]: option
    }));
  };

  // Convert prices dynamically
  const isSale = product.isOnOffer && product.offerPriceNew;
  const basePrice = isSale ? product.offerPriceNew! : product.priceYERNew;
  const displayedPrice = convertPrice(basePrice, selectedCurrency, rates);
  
  // Calculate total price based on quantity
  const totalPrice = displayedPrice * quantity;

  // Related products from same category
  const similarProducts = allProducts
    .filter(p => p.categoryId === product.categoryId && p.id !== product.id)
    .slice(0, 3);

  // Generate dynamic WhatsApp message link
  const formattedPriceAndCode = `${displayedPrice} ${getCurrencyCode(selectedCurrency)}`;
  const storePhone = Database.getAdminSettings().whatsappNumber || '967739563915';
  const whatsappLink = generateWhatsAppLink(
    storePhone, // phone number
    product.name,
    selectedProperties,
    displayedPrice,
    getCurrencyCode(selectedCurrency),
    quantity
  );

  const handleShare = () => {
    let propertiesStr = '';
    Object.entries(selectedProperties).forEach(([k, v]) => {
      propertiesStr += `\n- ${k}: ${v}`;
    });
    
    const shareUrl = `${window.location.origin}?code=${encodeURIComponent(product.code)}`;
    const shareText = `🛍️ تفضلي بمشاهدة هذا المنتج الرائع في متجر أم روح!\n\n*الاسم:* ${product.name}\n*رمز المنتج:* ${product.code}\n*السعر:* ${displayedPrice} ${getCurrencyCode(selectedCurrency)}${propertiesStr ? `\n*الخيارات:* ${propertiesStr}` : ''}\n\nتفضلي بزيارة المتجر الإلكتروني لطلب المزيد من العروض المميزة 🌟\n\nرابط المنتج: ${shareUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: shareText,
        url: shareUrl,
      }).catch(async () => {
        // Fallback copy
        const success = await copyToClipboard(shareText);
        if (success) {
          setShareSuccess(true);
          setTimeout(() => setShareSuccess(false), 2000);
        }
      });
    } else {
      copyToClipboard(shareText).then((success) => {
        if (success) {
          setShareSuccess(true);
          setTimeout(() => setShareSuccess(false), 2000);
        }
      });
    }
  };

  const executeAddToCart = () => {
    onAddToCart(product, quantity, selectedProperties, selectedCurrency);
    setCartSuccess(true);
    setTimeout(() => setCartSuccess(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-amber-50 dark:bg-gray-950 text-right overflow-hidden" dir="rtl">
      {/* Top Floating bar */}
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 py-3.5 flex justify-between items-center border-b border-amber-100 dark:border-gray-800 shadow-sm z-50 shrink-0">
        <button
          id="prod-details-back"
          onClick={onBack}
          className="bg-amber-50 dark:bg-gray-800 p-2 rounded-xl text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-gray-700 transition"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
        
        <span className="font-extrabold text-sm text-amber-900 dark:text-amber-300">
          تفاصيل الصنف
        </span>
        
        <div className="flex gap-1.5">
          {/* Share button */}
          <button
            id="prod-details-share"
            onClick={handleShare}
            className="bg-amber-50 dark:bg-gray-800 p-2 rounded-xl text-amber-900 dark:text-amber-100 hover:bg-amber-100 dark:hover:bg-gray-700 transition relative"
          >
            <Share2 className="w-5 h-5" />
            <AnimatePresence>
              {shareSuccess && (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-amber-800 text-white text-[10px] px-2 py-1 rounded shadow-md whitespace-nowrap"
                >
                  تم نسخ الرابط!
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {/* Like button */}
          <button
            id="prod-details-heart"
            onClick={() => onToggleFavorite(product.id)}
            className={`p-2 rounded-xl border transition ${
              isLiked 
                ? 'bg-rose-50 border-rose-200 text-rose-500' 
                : 'bg-amber-50 dark:bg-gray-800 border-transparent text-amber-900 dark:text-amber-100 hover:bg-amber-100'
            }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pt-4 pb-20 px-4 scrollbar-none scroll-smooth">
        <div className="max-w-md mx-auto space-y-5">
        {/* Images Slider */}
        <div className="relative h-64 w-full bg-white dark:bg-gray-900 rounded-3xl overflow-hidden shadow-md border border-amber-100/50 dark:border-gray-800">
          {product.images && product.images.length > 0 ? (
            <div className="relative w-full h-full cursor-pointer overflow-hidden flex items-center justify-center">
              <motion.img
                key={currentImageIndex}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.4}
                onDragEnd={handleDragEnd}
                onClick={() => setIsLightboxOpen(true)}
                src={product.images[currentImageIndex]}
                alt={product.name}
                className="w-full h-full object-contain p-2 select-none cursor-zoom-in active:cursor-grabbing"
              />
              
              {/* Swipe/Zoom Overlay hint */}
              <div className="absolute top-2.5 left-2.5 bg-black/40 backdrop-blur-sm px-2 py-1 rounded-lg text-[9px] text-white font-black flex items-center gap-1 z-10">
                <span>🔍 انقري للتكبير</span>
                {product.images.length > 1 && <span>• ↔️ اسحبي للتنقل</span>}
              </div>

              {/* Image Navigation dots */}
              {product.images.length > 1 && (
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 bg-black/25 px-2.5 py-1 rounded-full backdrop-blur-sm">
                  {product.images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentImageIndex(idx);
                      }}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        currentImageIndex === idx ? 'bg-amber-500 w-3.5' : 'bg-white/70'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">لا يوجد صورة</div>
          )}

          {/* Off Tag */}
          {product.isOnOffer && (
            <span className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-md tracking-wider flex items-center gap-1 animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              عرض خاص
            </span>
          )}
        </div>

        {/* Currency Switcher & Rating */}
        <div className="flex justify-between items-center">
          {/* Currency Dropdown selector */}
          <div className="relative">
            <button
              id="currency-dropdown-toggle"
              onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
              className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-400/10 text-amber-900 dark:text-amber-400 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-sm border border-amber-500/10"
            >
              <span>تغيير العملة</span>
              <ChevronDown className={`w-3.5 h-3.5 transition ${isCurrencyDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {isCurrencyDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 -translate-x-2 mt-1.5 w-40 bg-white dark:bg-gray-800 border border-amber-100 dark:border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden"
                >
                  {(['YER_NEW', 'YER_OLD', 'SAR'] as Currency[]).map((cur) => (
                    <button
                      key={cur}
                      onClick={() => {
                        setSelectedCurrency(cur);
                        setIsCurrencyDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 text-xs font-semibold hover:bg-amber-50 dark:hover:bg-gray-700 transition flex justify-between items-center ${
                        selectedCurrency === cur ? 'text-amber-800 dark:text-amber-300 bg-amber-50/40 dark:bg-gray-700' : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <span dir="rtl">{getCurrencySymbol(cur)}</span>
                      <span className="text-[10px] opacity-60">({getCurrencyCode(cur)})</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1 bg-amber-100/50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-amber-200/30">
            <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
              {product.rating || '0.0'}
            </span>
          </div>
        </div>

        {/* Title & Price Card */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl shadow-sm border border-amber-100/40 dark:border-gray-800 space-y-3">
          <h2 className="text-base font-extrabold text-gray-900 dark:text-white leading-relaxed">
            {product.name}
          </h2>

          <div className="flex items-baseline gap-2.5">
            <span className="text-xl font-black text-amber-800 dark:text-amber-400">
              {displayedPrice}
            </span>
            <span className="text-xs font-bold text-amber-700/80 dark:text-amber-500">
              {getCurrencySymbol(selectedCurrency)}
            </span>

            {/* If on sale, show original price crossed out */}
            {product.isOnOffer && product.offerOldPrice && (
              <span className="text-xs line-through text-gray-400 mr-2">
                {convertPrice(product.offerOldPrice, selectedCurrency, rates)} {getCurrencyCode(selectedCurrency)}
              </span>
            )}
          </div>
        </div>

        {/* Quantity Selection and Totals */}
        <div className="bg-white dark:bg-gray-900 p-5 rounded-3xl shadow-sm border border-amber-100/40 dark:border-gray-800 flex justify-between items-center gap-4">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 block">الإجمالي المبدئي ({quantity} حبة)</span>
            <span className="text-base font-black text-amber-900 dark:text-amber-300">
              {totalPrice} {getCurrencyCode(selectedCurrency)}
            </span>
          </div>

          <div className="flex items-center gap-3 bg-amber-50/70 dark:bg-gray-800 p-1.5 rounded-2xl border border-amber-100/30">
            <button
              id="qty-minus"
              onClick={() => quantity > 1 && setQuantity(quantity - 1)}
              className="bg-white dark:bg-gray-700 hover:bg-amber-100 dark:hover:bg-gray-600 p-1.5 rounded-xl text-amber-900 dark:text-white transition focus:outline-none"
            >
              <Minus className="w-4 h-4" />
            </button>
            
            <input
              type="number"
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val > 0) setQuantity(val);
              }}
              className="w-10 text-center bg-transparent text-amber-950 dark:text-white font-black text-sm border-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            
            <button
              id="qty-plus"
              onClick={() => setQuantity(quantity + 1)}
              className="bg-white dark:bg-gray-700 hover:bg-amber-100 dark:hover:bg-gray-600 p-1.5 rounded-xl text-amber-900 dark:text-white transition focus:outline-none"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Action Buttons - WhatsApp and Local Cart */}
        <div className="grid grid-cols-2 gap-3.5">
          {/* Add to Cart button */}
          <button
            id="add-to-cart-btn"
            onClick={executeAddToCart}
            className="col-span-1 py-3.5 px-4 bg-gradient-to-l from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-2xl font-extrabold text-xs shadow-md shadow-amber-600/10 flex items-center justify-center gap-2 transition transform active:scale-95"
          >
            <ShoppingCart className="w-4.5 h-4.5 animate-pulse" />
            <span>إضافة إلى العربة</span>
          </button>

          {/* Checkout WhatsApp direct */}
          <button
            id="whatsapp-checkout-btn"
            onClick={handleWhatsAppCheckoutWithImage}
            className="col-span-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-extrabold text-xs shadow-md shadow-emerald-600/10 flex items-center justify-center gap-2 transition transform active:scale-95 text-center cursor-pointer"
          >
            {/* WhatsApp Icon */}
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.457L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.73.001-2.595-1.006-5.035-2.834-6.867-1.829-1.83-4.263-2.836-6.853-2.836-5.44 0-9.866 4.372-9.87 9.732-.001 1.774.475 3.514 1.378 5.035l-.991 3.616 3.73-.974zm11.332-6.55c-.29-.145-1.716-.847-1.982-.944-.265-.097-.458-.145-.65.145-.192.291-.745.944-.913 1.138-.168.194-.337.218-.627.073-.29-.146-1.226-.452-2.336-1.442-.864-.771-1.447-1.723-1.617-2.014-.17-.29-.018-.448.127-.592.13-.13.29-.34.436-.51.145-.17.193-.291.29-.485.097-.194.049-.364-.025-.51-.072-.145-.65-1.564-.89-2.146-.233-.56-.47-.483-.65-.492-.168-.008-.362-.01-.555-.01s-.507.072-.771.359c-.265.288-1.012.988-1.012 2.41 0 1.42 1.036 2.79 1.18 2.985.145.195 2.037 3.11 4.935 4.363.689.298 1.228.476 1.648.61.693.22 1.324.19 1.823.11.556-.09 1.716-.7 1.959-1.375.24-.675.24-1.25.17-1.375-.075-.12-.266-.19-.556-.34z" />
            </svg>
            <span>الطلب متجر الواتس</span>
          </button>
        </div>

        {/* Toast alert on Add-to-cart */}
        <AnimatePresence>
          {cartSuccess && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="fixed bottom-24 left-4 right-4 z-[9999] max-w-sm mx-auto bg-amber-950/95 backdrop-blur-md text-white p-4.5 rounded-2xl shadow-2xl flex items-center justify-between border border-amber-500/30 text-xs font-bold"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-400 animate-bounce" />
                <span>تم إضافة ({quantity}) من {product.name.slice(0, 20)}... للسلة! 🛒</span>
              </div>
              <span className="text-[10px] text-amber-300 font-extrabold">(عربتي)</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabs: Specs, Related, Store */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl p-2 shadow-sm border border-amber-100/40 dark:border-gray-800">
          <div className="grid grid-cols-3 gap-1">
            <button
              id="tab-specs"
              onClick={() => setActiveTab('specs')}
              className={`py-2 px-1 text-center font-bold text-xs rounded-2xl transition ${
                activeTab === 'specs' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              خصائص الصنف
            </button>
            <button
              id="tab-similar"
              onClick={() => setActiveTab('similar')}
              className={`py-2 px-1 text-center font-bold text-xs rounded-2xl transition ${
                activeTab === 'similar' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              أصناف مشابهة
            </button>
            <button
              id="tab-store"
              onClick={() => setActiveTab('store')}
              className={`py-2 px-1 text-center font-bold text-xs rounded-2xl transition ${
                activeTab === 'store' 
                  ? 'bg-amber-500 text-white shadow-sm' 
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              بيانات المتجر
            </button>
          </div>

          <div className="p-4 pt-5">
            <AnimatePresence mode="wait">
              {activeTab === 'specs' && (
                <motion.div
                  key="specs"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  {/* Render Product Description */}
                  <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line border-b border-amber-100/50 dark:border-gray-800 pb-3.5">
                    {parseDescription(product.description)}
                  </div>

                  {/* Active attributes (properties) selection */}
                  {product.properties && product.properties.length > 0 ? (
                    <div className="space-y-4">
                      {product.properties.map((prop) => (
                        <div key={prop.name} className="space-y-2">
                          <span className="text-xs font-black text-amber-950 dark:text-amber-300 block">
                            {prop.name}:
                          </span>
                          
                          <div className="flex flex-wrap gap-2">
                            {prop.options.map((opt) => {
                              const isSelected = selectedProperties[prop.name] === opt;
                              return (
                                <button
                                  key={opt}
                                  onClick={() => handlePropertySelect(prop.name, opt)}
                                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all border ${
                                    isSelected 
                                      ? 'bg-amber-500 border-amber-500 text-white shadow-sm scale-105' 
                                      : 'bg-white dark:bg-gray-800 border-amber-100 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-amber-300'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-400 flex items-center gap-1.5 py-2">
                      <Info className="w-4 h-4 text-amber-500" />
                      <span>لا توجد خصائص قياسية إضافية مفعلة لهذا الصنف من الإدارة.</span>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'similar' && (
                <motion.div
                  key="similar"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-3.5"
                >
                  {similarProducts.length > 0 ? (
                    similarProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          onSelectProduct(p);
                          setCurrentImageIndex(0);
                        }}
                        className="flex items-center gap-3 bg-amber-50/30 dark:bg-gray-800/40 p-2.5 rounded-2xl border border-amber-100/20 dark:border-gray-800 cursor-pointer hover:border-amber-300 transition"
                      >
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-12 h-12 rounded-xl object-cover bg-white p-1"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-extrabold text-gray-900 dark:text-white truncate">
                            {p.name}
                          </h4>
                          <span className="text-[11px] font-bold text-amber-800 dark:text-amber-400">
                            {convertPrice(p.isOnOffer ? p.offerPriceNew! : p.priceYERNew, selectedCurrency, rates)} {getCurrencyCode(selectedCurrency)}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-4">
                      لا يوجد أصناف مشابهة أخرى في هذه الفئة حالياً.
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'store' && (
                <motion.div
                  key="store"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-gray-700 dark:text-gray-300 space-y-3"
                >
                  <div className="flex gap-2.5 items-start">
                    <Store className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <h4 className="font-extrabold text-amber-950 dark:text-amber-300">تعز - المدينة (Taiz - Al Madina)</h4>
                      <p className="mt-1 leading-relaxed text-gray-500 text-[11px]">
                        نهتم بتقديم أرقى المنتجات المنزلية، والملابس الجاهزة والفاخرة للأطفال والكبار، وألعاب الأطفال الإبداعية، مع مستحضرات التجميل والعناية الشخصية بأعلى جودة وأسعار تنافسية ممتازة تناسب ميزانيتك.
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-amber-100/40 dark:border-gray-800 pt-3 flex flex-col gap-2 font-medium">
                    <div className="flex justify-between">
                      <span className="text-gray-400">📍 المقر الرئيسي:</span>
                      <span>اليمن - تعز - مع خدمة توصيل لجميع المحافظات</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">📞 رقم المتجر:</span>
                      <span dir="ltr">
                        {storePhone === '967739563915' ? '+967 739 563 915' : storePhone}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">⏰ ساعات الدوام:</span>
                      <span>على مدار 24 ساعة يومياً</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-center items-center p-4 select-none"
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-6 right-6 bg-white/10 hover:bg-white/20 active:scale-95 text-white p-3 rounded-full backdrop-blur-md transition"
              title="إغلاق المعاينة"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Main large image */}
            <div className="relative w-full max-w-lg aspect-square flex items-center justify-center">
              <motion.img
                key={currentImageIndex}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.5}
                onDragEnd={handleDragEnd}
                src={product.images[currentImageIndex]}
                alt={product.name}
                className="max-w-full max-h-[75vh] object-contain rounded-2xl cursor-grab active:cursor-grabbing"
              />

              {/* Prev / Next buttons inside lightbox */}
              {product.images.length > 1 && (
                <>
                  <button
                    onClick={() => setCurrentImageIndex(prev => prev === 0 ? product.images.length - 1 : prev - 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 active:scale-95 text-white p-3 rounded-full backdrop-blur-md transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  <button
                    onClick={() => setCurrentImageIndex(prev => prev === product.images.length - 1 ? 0 : prev + 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 active:scale-95 text-white p-3 rounded-full backdrop-blur-md transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {/* Navigation Dots and Index */}
            <div className="mt-6 flex flex-col items-center gap-2 text-white">
              <span className="text-xs font-black opacity-85 font-mono">
                {currentImageIndex + 1} / {product.images.length}
              </span>
              {product.images.length > 1 && (
                <div className="flex gap-2 bg-white/10 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  {product.images.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentImageIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        currentImageIndex === idx ? 'bg-amber-400 w-4' : 'bg-white/40'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp Image Processing Loader Overlay */}
      <AnimatePresence>
        {isDownloadingImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-[32px] p-8 max-w-sm w-full border border-emerald-500/10 shadow-2xl space-y-6"
            >
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                {/* Outer spinning ring */}
                <div className="absolute inset-0 rounded-full border-4 border-emerald-100 dark:border-emerald-950/40"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-emerald-600 dark:border-t-emerald-500 animate-spin"></div>
                {/* Cloud icon */}
                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-full text-emerald-600 dark:text-emerald-400">
                  <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-300">
                  جاري تحميل صورة الصنف
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  {downloadProgress}
                </p>
              </div>

              {/* Progress bar mock */}
              <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: "10%" }}
                  animate={{ width: "95%" }}
                  transition={{ duration: 3, ease: "easeInOut" }}
                  className="bg-emerald-500 h-full rounded-full"
                ></motion.div>
              </div>

              <div className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                سنقوم بتحويلكِ إلى الواتساب مباشرة لإرسال الطلب بشكل أنيق ومحمل بصورة وخصائص الصنف فوراً 🌸✨
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
