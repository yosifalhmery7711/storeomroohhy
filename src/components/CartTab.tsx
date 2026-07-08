/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Trash2, 
  Plus, 
  Minus, 
  FileText, 
  Check, 
  ChevronDown, 
  AlertCircle,
  Upload,
  Sparkles,
  Wallet,
  Coins,
  Gift
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, OrderItem, Currency, ExchangeRate, Order, DeliveryLocation } from '../types';
import { convertPrice, getCurrencySymbol, getCurrencyCode, getDirectImageUrl } from '../utils';
import { Database } from '../Database';
import { initAuth, googleSignIn, logout as googleLogout, uploadFileToDrive } from '../googleAuth';
import { User as FirebaseUser } from 'firebase/auth';
import { UnauthorizedDomainModal } from './UnauthorizedDomainModal';

interface CartTabProps {
  user: User;
  cartItems: OrderItem[];
  rates: ExchangeRate;
  onUpdateQuantity: (productId: string, propertiesKey: string, quantity: number) => void;
  onRemoveItem: (productId: string, propertiesKey: string) => void;
  onClearCart: () => void;
  onSubmitOrder: (
    orderData: Omit<Order, 'id' | 'userId' | 'userName' | 'userPhone' | 'createdAt' | 'status'>,
    guestInfo?: { name: string; phone: string }
  ) => void;
  onChangeCurrency: (currency: Currency) => void;
}

export default function CartTab({
  user,
  cartItems,
  rates,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onSubmitOrder,
  onChangeCurrency
}: CartTabProps) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>(user.currency);
  const [isCurrencyDropdownOpen, setIsCurrencyDropdownOpen] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'gift' | 'recharge' | 'transfer'>('transfer');
  const [transferType, setTransferType] = useState<'kuraimi' | 'najm'>('kuraimi');

  const useGiftPayment = paymentMethod === 'gift';
  const useRechargePayment = paymentMethod === 'recharge';

  const adminSettings = Database.getAdminSettings();
  const bankAccounts = adminSettings.bankAccounts || [
    { currency: 'YER_NEW', bankName: 'الكريمي المميز (ريال يمني جديد)', accountNumber: '967739563915', accountName: 'متجر أم روح' },
    { currency: 'YER_OLD', bankName: 'الكريمي المميز (ريال يمني قديم)', accountNumber: '967739563915', accountName: 'متجر أم روح' },
    { currency: 'SAR', bankName: 'الكريمي المميز (ريال سعودي)', accountNumber: '967739563915', accountName: 'متجر أم روح' }
  ];
  const activeBank = bankAccounts.find(b => b.currency === selectedCurrency) || bankAccounts[0];
  
  // Checkout Form fields
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<DeliveryLocation>(() => {
    const locs = Database.getLocations();
    const found = locs.find(l => user.address && user.address.includes(l.name));
    return found || locs[0] || { id: 'default', name: 'عام', deliveryFee: 1000 };
  });
  const [addressDetail, setAddressDetail] = useState(() => {
    const locs = Database.getLocations();
    const found = locs.find(l => user.address && user.address.includes(l.name));
    if (found && user.address.startsWith(found.name)) {
      return user.address.replace(found.name, '').replace(/^[-\s]+/, '');
    }
    return user.address || '';
  });
  const [senderName, setSenderName] = useState(user.name);
  const [senderAccount, setSenderAccount] = useState('');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [formError, setFormError] = useState('');
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [lastOrderId, setLastOrderId] = useState('');
  const [whatsappMessageUrl, setWhatsappMessageUrl] = useState<string>('');
  const [checkoutVia, setCheckoutVia] = useState<'app' | 'whatsapp'>('app');
  const [isDownloadingCartImages, setIsDownloadingCartImages] = useState(false);
  const [cartDownloadProgress, setCartDownloadProgress] = useState('');

  // Google Auth & Drive States
  const [googleUser, setGoogleUser] = useState<FirebaseUser | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);

  useEffect(() => {
    const unsubscribe = initAuth(
      (gUser, token) => {
        setGoogleUser(gUser);
        setGoogleToken(token);
      },
      () => {
        setGoogleUser(null);
        setGoogleToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await googleSignIn();
    } catch (err: any) {
      console.error('Google Sign In failed:', err);
      if (err?.code === 'auth/unauthorized-domain' || (err?.message && err.message.includes('unauthorized-domain'))) {
        setShowDomainModal(true);
      } else {
        alert(`فشل تسجيل الدخول: ${err?.message || err}`);
      }
    }
  };

  // Settle Delivery Fee based on selected location
  const rawDeliveryFee = selectedLocation ? selectedLocation.deliveryFee : 1000;
  const deliveryFee = convertPrice(rawDeliveryFee, selectedCurrency, rates);

  // Totals calculations
  const itemsSubtotal = cartItems.reduce((acc, item) => {
    let basePrice = item.price;
    if (item.currency === 'YER_OLD') {
      basePrice = item.price * rates.yerOldFactor;
    } else if (item.currency === 'SAR') {
      basePrice = item.price * rates.sarFactor;
    }
    
    const converted = convertPrice(basePrice, selectedCurrency, rates);
    return acc + (converted * item.quantity);
  }, 0);

  const totalAmount = itemsSubtotal + deliveryFee;

  // Gift Balance helper (Um Rouh Gifts)
  const giftBalanceInCurrent = convertPrice(user.giftBalance || 0, selectedCurrency, rates);
  const canPayWithGift = (user.giftBalance || 0) >= convertPrice(totalAmount, 'YER_NEW', rates);

  // Recharge Balance helper (User recharged balance)
  const rechargeBalanceInCurrent = convertPrice(user.balance, selectedCurrency, rates);
  const canPayWithRecharge = user.balance >= convertPrice(totalAmount, 'YER_NEW', rates);

  const isWalletPayment = useGiftPayment || useRechargePayment;

  // Safety fallback check to revert to bank transfer/manual payment if cart exceeds chosen balance
  useEffect(() => {
    if (paymentMethod === 'gift' && !canPayWithGift) {
      setPaymentMethod('transfer');
    } else if (paymentMethod === 'recharge' && !canPayWithRecharge) {
      setPaymentMethod('transfer');
    }
  }, [totalAmount, selectedCurrency, canPayWithGift, canPayWithRecharge, paymentMethod]);

  const handleCurrencyChange = (cur: Currency) => {
    setSelectedCurrency(cur);
    onChangeCurrency(cur); // sync with parent
    setIsCurrencyDropdownOpen(false);
  };

  // Convert uploaded file to base64
  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptImage(reader.result as string);
      setIsUploading(false);
    };
    reader.onerror = () => {
      setFormError('تعذر قراءة ملف الصورة. جربي صورة أخرى.');
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const executeCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!user.isRegistered) {
      if (!guestName.trim()) {
        setFormError('يرجى تعبئة الاسم لتفعيل حسابك.');
        return;
      }
      if (!guestPhone.trim()) {
        setFormError('يرجى تعبئة رقم الهاتف للتواصل.');
        return;
      }
      const cleanPhone = guestPhone.trim();
      if (!/^\d+$/.test(cleanPhone) || cleanPhone.length < 9) {
        setFormError('يرجى إدخال رقم هاتف صحيح ومكون من أرقام فقط (9 خانات على الأقل).');
        return;
      }
    }

    const fullAddress = selectedLocation ? `${selectedLocation.name} - ${addressDetail}` : addressDetail;

    if (!fullAddress.trim() || !addressDetail.trim()) {
      setFormError('يرجى كتابة عنوان التوصيل التفصيلي بدقة.');
      return;
    }

    const isWalletPayment = useGiftPayment || useRechargePayment;
    if (!isWalletPayment) {
      if (!senderName.trim()) {
        setFormError('يرجى كتابة اسم المرسل للحوالة.');
        return;
      }
      if (!senderAccount.trim()) {
        setFormError(transferType === 'kuraimi' ? 'يرجى كتابة رقم الحساب الكريمي المرسل منه.' : 'يرجى كتابة رقم الحوالة المرسل.');
        return;
      }
    }

    // Prepare items matching the cart
    const finalItems: OrderItem[] = cartItems.map(item => {
      let basePrice = item.price;
      if (item.currency === 'YER_OLD') {
        basePrice = item.price * rates.yerOldFactor;
      } else if (item.currency === 'SAR') {
        basePrice = item.price * rates.sarFactor;
      }
      const finalPrice = convertPrice(basePrice, selectedCurrency, rates);
      return {
        ...item,
        price: finalPrice,
        currency: selectedCurrency,
        totalPrice: finalPrice * item.quantity
      };
    });

    const generatedOrderId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);

    const guestInfo = !user.isRegistered ? { name: guestName.trim(), phone: guestPhone.trim() } : undefined;
    const customerName = guestInfo ? guestInfo.name : user.name;
    const customerPhone = guestInfo ? guestInfo.phone : user.phone;

    let waUrl = '';
    let itemsText = '';
    finalItems.forEach((item, idx) => {
      let optionsStr = '';
      if (item.selectedProperties) {
        optionsStr = Object.entries(item.selectedProperties)
          .map(([k, v]) => `${k}:${v}`)
          .join(', ');
      }
      const imgLink = item.image && item.image.startsWith('http') ? `\n    🔗 رابط الصورة: ${item.image}` : '';
      itemsText += `\n*${idx + 1}.* ${item.productName} (رمز: ${item.productCode}) ${optionsStr ? `[${optionsStr}]` : ''}\n    الكمية: ${item.quantity} | السعر: ${item.price} ${getCurrencyCode(selectedCurrency)} | الإجمالي: ${item.totalPrice} ${getCurrencyCode(selectedCurrency)}${imgLink}`;
    });

    const driveReceiptLink = receiptImage && receiptImage !== 'sent_via_whatsapp' && receiptImage.startsWith('http')
      ? receiptImage
      : '';

    const paymentDetails = useGiftPayment 
      ? '🎁 خصم من هدايا أم روح (سداد فوري مباشر)'
      : useRechargePayment 
        ? '💳 خصم من رصيد المحفظة المشحون (سداد فوري مباشر)'
        : transferType === 'kuraimi'
          ? `🏦 حوالة الكريمي\n- اسم صاحب الحساب (كريمي): ${adminSettings.kuraimiAccountName || 'أم روح'}\n- رقم الحساب (كريمي): ${adminSettings.kuraimiAccountNumber || '967739563915'}\n- اسم المرسل للحوالة: ${senderName}\n- الحساب المرسل منه/رقم الحوالة: ${senderAccount}${driveReceiptLink ? `\n🔗 رابط السند (جوجل درايف): ${driveReceiptLink}` : ''}`
          : `⭐ حوالة النجم وغيرها\n- اسم المستلم المعتمد: ${adminSettings.najmReceiverName || 'روح أحمد علي'}\n- اسم المرسل للحوالة: ${senderName}\n- رقم الحوالة: ${senderAccount}${driveReceiptLink ? `\n🔗 رابط السند (جوجل درايف): ${driveReceiptLink}` : ''}`;

    const messageText = `🌸 *طلب جديد من متجر أم روح* 🌸

📝 *رقم الطلب المرجعي:* ${generatedOrderId}
👤 *الاسم للعميل:* ${customerName}
📞 *الهاتف:* ${customerPhone}

📍 *العنوان:* ${fullAddress}
🚚 *قيمة التوصيل:* ${deliveryFee} ${getCurrencyCode(selectedCurrency)}

💳 *طريقة الدفع:*
${paymentDetails}

📦 *الأصناف المطلوبة:*
${itemsText}

💰 *إجمالي الفاتورة المطلوبة:* *${totalAmount} ${getCurrencyCode(selectedCurrency)}*

---
🌸 *تم تسجيل طلبكِ بنجاح في متجر أم روح!* ${!isWalletPayment ? (driveReceiptLink ? '\n✅ تم رفع السند بنجاح على جوجل درايف لتسريع الفرز والشحن فوراً!' : '\n📎 الرجاء إرفاق صورة إشعار السداد/سند الحوالة مع هذه الرسالة لتأكيد الطلب وشحنه فوراً!') : ''}`;

    const cleanPhone = adminSettings.whatsappNumber || '967739563915';
    waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
    setWhatsappMessageUrl(waUrl);

    onSubmitOrder({
      address: fullAddress,
      deliveryFee,
      items: finalItems,
      senderName: useGiftPayment 
        ? 'سداد من هدايا أم روح' 
        : useRechargePayment 
          ? 'سداد من الرصيد المشحون' 
          : senderName,
      senderAccount: isWalletPayment ? 'رصيد المحفظة' : senderAccount,
      receiptImage: isWalletPayment ? '' : (receiptImage || 'sent_via_whatsapp'),
      totalAmount,
      currency: selectedCurrency,
      paymentMethod: useGiftPayment 
        ? 'gift_wallet' 
        : useRechargePayment 
          ? 'recharge_wallet' 
          : transferType === 'kuraimi'
            ? 'al_kuraimi'
            : 'najm',
      checkoutVia: checkoutVia
    }, guestInfo);

    setLastOrderId(generatedOrderId);
    setOrderSuccess(true);
    setShowCheckoutModal(false);
    onClearCart();

    if (checkoutVia === 'whatsapp') {
      const runWhatsAppShare = async () => {
        setIsDownloadingCartImages(true);
        setCartDownloadProgress('جاري البدء في تحضير صور فاتورتكِ...');

        const filesArray: File[] = [];
        // Loop and fetch images sequentially with clear progress messages
        for (let i = 0; i < finalItems.length; i++) {
          const item = finalItems[i];
          if (item.image) {
            const directImg = getDirectImageUrl(item.image);
            if (directImg) {
              try {
                setCartDownloadProgress(`جاري تحميل صورة المنتج (${i + 1} من ${finalItems.length}): ${item.productName}...`);
                const response = await fetch(directImg);
                if (response.ok) {
                  const blob = await response.blob();
                  const ext = blob.type.split('/')[1] || 'jpg';
                  const file = new File([blob], `${item.productCode || 'item'}_${i}.${ext}`, { type: blob.type });
                  filesArray.push(file);
                }
              } catch (err) {
                console.warn(`CORS or offline network prevented downloading image for ${item.productName}:`, err);
              }
            }
          }
        }

        setIsDownloadingCartImages(false);

        // Limit files count if needed or share if supported
        if (filesArray.length > 0 && navigator.canShare && navigator.canShare({ files: filesArray })) {
          try {
            await navigator.share({
              files: filesArray,
              title: `فاتورة طلب ${generatedOrderId}`,
              text: messageText
            });
            return;
          } catch (shareErr) {
            console.warn("Cart sharing failed, fallback to standard link:", shareErr);
          }
        }

        // Fallback: direct WhatsApp
        const formattedPhone = cleanPhone.replace(/[+\s-]/g, '');
        const directWaUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(messageText)}`;
        window.open(directWaUrl, '_blank');
      };

      runWhatsAppShare();
    }
  };

  const getPropertiesKey = (selected: { [key: string]: string }) => {
    return Object.entries(selected).map(([k, v]) => `${k}:${v}`).join('|');
  };

  return (
    <div className="bg-amber-50/20 dark:bg-gray-950 min-h-screen pb-32 pt-5 px-4">
      <div className="max-w-md mx-auto space-y-5">
        {/* Header */}
        <div className="flex justify-between items-center bg-white dark:bg-gray-900 p-4 rounded-3xl shadow-sm border border-amber-100/40 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500 text-white p-2 rounded-xl shadow-md">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-amber-950 dark:text-amber-300">حقيبة تسوقي</h2>
              <p className="text-[10px] text-gray-500">فاتورة موحدة بجميع المشتريات</p>
            </div>
          </div>

          {/* Currency selection for the cart invoice */}
          <div className="relative">
            <button
              id="cart-currency-toggle"
              onClick={() => setIsCurrencyDropdownOpen(!isCurrencyDropdownOpen)}
              className="flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-400/10 text-amber-900 dark:text-amber-400 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-sm border border-amber-500/10"
            >
              <span>{getCurrencyCode(selectedCurrency)}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {isCurrencyDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute left-0 -translate-x-2 mt-1.5 w-40 bg-white dark:bg-gray-800 border border-amber-100 dark:border-gray-700 rounded-xl shadow-xl z-20 overflow-hidden"
                >
                  {(['YER_NEW', 'YER_OLD', 'SAR'] as Currency[]).map((cur) => (
                    <button
                      key={cur}
                      onClick={() => handleCurrencyChange(cur)}
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
        </div>

        {orderSuccess ? (
          /* Successful order placement animation card */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-900 p-8 rounded-3xl text-center shadow-lg border border-emerald-100 dark:border-gray-800 space-y-4"
          >
            <div className="mx-auto w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center shadow-inner animate-bounce">
              <Check className="w-8 h-8" />
            </div>
            
            <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
              تم تسجيل طلبك بنجاح! 🎉
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed max-w-xs mx-auto">
              شكراً لتسوقك من متجر أم روح. رقم طلبك المرجعي هو <span className="font-bold text-amber-700">{lastOrderId}</span>.
            </p>

            {whatsappMessageUrl ? (
              <div className="space-y-3 pt-2">
                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3.5 rounded-2xl border border-emerald-100/50 text-[11px] text-emerald-800 dark:text-emerald-400 font-semibold leading-relaxed">
                  📲 يرجى النقر على الزر أدناه لإرسال تفاصيل التوصيل والحوالة مباشرة إلى واتساب متجر أم روح، وإرفاق صورة سند الدفع هناك.
                </div>
                <a
                  href={whatsappMessageUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    setOrderSuccess(false);
                    setWhatsappMessageUrl('');
                  }}
                  className="w-full py-3 px-5 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="text-sm">💬</span>
                  <span>إرسال البيانات ومتابعة السداد عبر واتساب</span>
                </a>
              </div>
            ) : (
              <button
                id="order-success-ok"
                onClick={() => setOrderSuccess(false)}
                className="py-2.5 px-6 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
              >
                موافق
              </button>
            )}
          </motion.div>
        ) : cartItems.length === 0 ? (
          /* Empty Cart message */
          <div className="bg-white dark:bg-gray-900 p-12 rounded-3xl text-center shadow-sm border border-amber-100/40 dark:border-gray-800 space-y-4">
            <div className="mx-auto w-14 h-14 bg-amber-50 dark:bg-gray-800 text-amber-600 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 opacity-60" />
            </div>
            <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-300">العربة فارغة حالياً</h3>
            <p className="text-[11px] text-gray-400 max-w-xs mx-auto">
              تصفحي أقسام المتجر في الصفحة الرئيسية والمنتجات، وقومي بإضافة أصناف للأدوات المنزلية أو الملابس لتظهر فاتورتك هنا.
            </p>
          </div>
        ) : (
          /* Items List */
          <div className="space-y-4">
            <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-amber-100/40 dark:border-gray-800 overflow-hidden">
              <div className="divide-y divide-amber-100/30 dark:divide-gray-800">
                {cartItems.map((item) => {
                  const propKey = getPropertiesKey(item.selectedProperties);
                  
                  // Convert single item price to current selected cart currency
                  let basePrice = item.price;
                  if (item.currency === 'YER_OLD') {
                    basePrice = item.price * rates.yerOldFactor;
                  } else if (item.currency === 'SAR') {
                    basePrice = item.price * rates.sarFactor;
                  }
                  const displayPrice = convertPrice(basePrice, selectedCurrency, rates);

                  return (
                    <div key={`${item.productId}-${propKey}`} className="p-4 flex gap-3">
                      {/* Image */}
                      <img
                        src={item.image}
                        alt={item.productName}
                        className="w-14 h-14 rounded-xl object-cover bg-amber-50/50 p-1 shrink-0 border border-amber-50 dark:border-gray-800"
                      />

                      {/* Info */}
                      <div className="flex-1 min-w-0 text-right space-y-1">
                        <h4 className="text-xs font-extrabold text-gray-900 dark:text-white truncate">
                          {item.productName}
                        </h4>
                        
                        {/* Properties display */}
                        {Object.keys(item.selectedProperties).length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {Object.entries(item.selectedProperties).map(([k, v]) => (
                              <span key={k} className="text-[9px] bg-amber-500/10 text-amber-800 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-bold">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="text-[11px] font-bold text-amber-800 dark:text-amber-400">
                          {displayPrice} {getCurrencyCode(selectedCurrency)}
                        </div>
                      </div>

                      {/* Controls */}
                      <div className="flex flex-col items-end justify-between gap-2 shrink-0">
                        <button
                          id={`remove-item-${item.productId}`}
                          onClick={() => onRemoveItem(item.productId, propKey)}
                          className="text-gray-400 hover:text-red-500 transition p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2 bg-amber-50/60 dark:bg-gray-800 p-1 rounded-xl border border-amber-100/30">
                          <button
                            id={`qty-minus-${item.productId}`}
                            onClick={() => item.quantity > 1 && onUpdateQuantity(item.productId, propKey, item.quantity - 1)}
                            className="bg-white dark:bg-gray-700 hover:bg-amber-100 p-1 rounded-md text-gray-700 dark:text-white transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-black text-amber-950 dark:text-white px-1">
                            {item.quantity}
                          </span>
                          <button
                            id={`qty-plus-${item.productId}`}
                            onClick={() => onUpdateQuantity(item.productId, propKey, item.quantity + 1)}
                            className="bg-white dark:bg-gray-700 hover:bg-amber-100 p-1 rounded-md text-gray-700 dark:text-white transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Invoice Total Card */}
            <div className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm border border-amber-100/40 dark:border-gray-800 space-y-3.5">
              <h3 className="text-xs font-extrabold text-amber-950 dark:text-amber-300 border-b border-amber-100/40 dark:border-gray-800 pb-2">
                ملخص الفاتورة الإجمالية
              </h3>

              <div className="space-y-2.5 text-xs text-gray-600 dark:text-gray-300">
                <div className="flex justify-between font-medium">
                  <span>إجمالي قيمة المنتجات:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {itemsSubtotal} {getCurrencyCode(selectedCurrency)}
                  </span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>أجور توصيل العنوان:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    +{deliveryFee} {getCurrencyCode(selectedCurrency)}
                  </span>
                </div>
                
                <div className="border-t border-amber-100/30 dark:border-gray-800 pt-3 flex justify-between items-baseline font-black">
                  <span className="text-amber-950 dark:text-amber-300">المبلغ الإجمالي المطلوب:</span>
                  <span className="text-base text-amber-800 dark:text-amber-400">
                    {totalAmount} {getCurrencyCode(selectedCurrency)}
                  </span>
                </div>
              </div>

              {/* Complete Order Form trigger button */}
              <button
                id="checkout-trigger-btn"
                onClick={() => setShowCheckoutModal(true)}
                className="w-full py-3 px-4 bg-gradient-to-l from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-2xl font-extrabold text-xs shadow-md transition transform active:scale-95 flex items-center justify-center gap-2"
              >
                <FileText className="w-4.5 h-4.5" />
                <span>إتمام عملية الطلب</span>
              </button>
            </div>
          </div>
        )}

        {/* Complete Order Dialog Drawer Overlay */}
        <AnimatePresence>
          {showCheckoutModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end justify-center p-0"
              onClick={() => setShowCheckoutModal(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-[32px] p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex justify-between items-center border-b border-amber-50 dark:border-gray-800 pb-3">
                  <h3 className="text-sm font-extrabold text-amber-950 dark:text-amber-300">
                    استمارة إنهاء الطلب والتوصيل 🚚
                  </h3>
                  <button
                    onClick={() => setShowCheckoutModal(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Visual Summary of Cart Items */}
                <div className="bg-amber-500/5 dark:bg-gray-800/40 p-3.5 rounded-2xl border border-amber-500/10 dark:border-gray-850 space-y-2 text-right">
                  <div className="flex justify-between items-center pb-2 border-b border-dashed border-amber-200 dark:border-gray-800">
                    <span className="text-[10px] font-black text-amber-900 dark:text-amber-400">مجموع الأصناف: {cartItems.length}</span>
                    <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 flex items-center gap-1.5">
                      <span>الأصناف المحمّلة بالفاتورة</span>
                      <span>📦</span>
                    </h4>
                  </div>
                  <div className="space-y-2.5 max-h-[160px] overflow-y-auto pr-1">
                    {cartItems.map((item, index) => (
                      <div key={index} className="flex gap-2.5 items-center justify-between border-b border-gray-50 dark:border-gray-800 pb-2 last:border-0 last:pb-0">
                        {/* Details */}
                        <div className="flex-1 space-y-0.5">
                          <h5 className="text-[11px] font-extrabold text-gray-900 dark:text-white leading-tight">
                            {item.productName}
                          </h5>
                          <div className="flex items-center gap-2 justify-end text-[9.5px]">
                            <span className="text-gray-400 font-bold">الرمز: <span className="text-amber-700 dark:text-amber-400 font-mono">{item.productCode}</span></span>
                            {Object.entries(item.selectedProperties || {}).map(([k, v]) => (
                              <span key={k} className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-[8.5px] text-gray-500 font-bold">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-gray-400 font-bold">
                            الكمية: {item.quantity} | السعر: {convertPrice(item.price, selectedCurrency, rates)} {getCurrencyCode(selectedCurrency)}
                          </p>
                        </div>

                        {/* Image Thumbnail */}
                        <img
                          src={item.image}
                          alt={item.productName}
                          className="w-11 h-11 object-cover rounded-xl border border-amber-100 dark:border-gray-800 bg-white"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Unified Payment Options Selector */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-amber-950 dark:text-amber-300 block mb-1 text-right">
                    طريقة سداد قيمة الفاتورة المعتمدة:
                  </label>

                  {/* Option 1: Gift Balance */}
                  <div
                    onClick={() => {
                      if (canPayWithGift) {
                        setPaymentMethod('gift');
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right relative flex flex-col gap-1.5 ${
                      paymentMethod === 'gift'
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                        : canPayWithGift
                          ? 'bg-white dark:bg-gray-800 border-amber-100 hover:border-amber-300'
                          : 'bg-gray-50/70 dark:bg-gray-900/40 border-gray-100 dark:border-gray-800 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${paymentMethod === 'gift' ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-gray-700 text-amber-700'}`}>
                          <Gift className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-amber-950 dark:text-amber-200">سداد من هدايا أم روح 🎁</h4>
                          <p className="text-[9.5px] text-gray-500">رصيدكِ التقديري الحالي: {user.giftBalance || 0} ريال جديد</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!canPayWithGift && (
                          <span className="text-[9px] font-bold bg-red-100 dark:bg-red-950/40 text-red-600 px-1.5 py-0.5 rounded-md">
                            غير كافي ⚠️
                          </span>
                        )}
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          paymentMethod === 'gift' ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 dark:border-gray-700'
                        }`}>
                          {paymentMethod === 'gift' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                    {!canPayWithGift && (
                      <p className="text-[9px] text-red-500 font-bold mt-0.5">
                        * رصيد هداياكِ أقل من إجمالي الفاتورة المطلوبة لتفعيل هذا الخيار.
                      </p>
                    )}
                  </div>

                  {/* Option 2: Charged Balance */}
                  <div
                    onClick={() => {
                      if (canPayWithRecharge) {
                        setPaymentMethod('recharge');
                      }
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right relative flex flex-col gap-1.5 ${
                      paymentMethod === 'recharge'
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                        : canPayWithRecharge
                          ? 'bg-white dark:bg-gray-800 border-amber-100 hover:border-amber-300'
                          : 'bg-gray-50/70 dark:bg-gray-900/40 border-gray-100 dark:border-gray-800 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${paymentMethod === 'recharge' ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-gray-700 text-amber-700'}`}>
                          <Coins className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-amber-950 dark:text-amber-200">سداد من الرصيد المشحون 💳</h4>
                          <p className="text-[9.5px] text-gray-500">رصيدكِ المشحون في المحفظة: {user.balance} ريال جديد</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!canPayWithRecharge && (
                          <span className="text-[9px] font-bold bg-red-100 dark:bg-red-950/40 text-red-600 px-1.5 py-0.5 rounded-md">
                            غير كافي ⚠️
                          </span>
                        )}
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                          paymentMethod === 'recharge' ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 dark:border-gray-700'
                        }`}>
                          {paymentMethod === 'recharge' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                    {!canPayWithRecharge && (
                      <p className="text-[9px] text-red-500 font-bold mt-0.5">
                        * رصيدكِ المشحون الحالي لا يكفي لتغطية قيمة الطلب بالكامل.
                      </p>
                    )}
                  </div>

                  {/* Option 3: Bank Transfer */}
                  <div
                    onClick={() => setPaymentMethod('transfer')}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-right relative flex flex-col gap-1.5 ${
                      paymentMethod === 'transfer'
                        ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20'
                        : 'bg-white dark:bg-gray-800 border-amber-100 hover:border-amber-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${paymentMethod === 'transfer' ? 'bg-amber-500 text-white' : 'bg-amber-100 dark:bg-gray-700 text-amber-700'}`}>
                          <Wallet className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-amber-950 dark:text-amber-200">التحويل والسداد إلى رقم حساب المتجر 🏦</h4>
                          <p className="text-[9.5px] text-gray-500">إرسال الحوالة يدوياً لمتجر أم روح مع إرفاق السند</p>
                        </div>
                      </div>
                      
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        paymentMethod === 'transfer' ? 'border-amber-500 bg-amber-500 text-white' : 'border-gray-300 dark:border-gray-700'
                      }`}>
                        {paymentMethod === 'transfer' && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </div>
                    </div>
                  </div>
                </div>

                <form onSubmit={executeCheckout} className="space-y-4 text-right">
                  {formError && (
                    <div className="bg-red-50 dark:bg-red-950/30 text-red-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-red-100 dark:border-red-900">
                      <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  {/* Guest User Onboarding Form Fields */}
                  {!user.isRegistered && (
                    <div className="bg-amber-500/5 dark:bg-gray-800/40 p-4 rounded-2xl border border-amber-500/10 dark:border-gray-800 space-y-3.5">
                      <div className="flex items-center gap-1.5 text-amber-950 dark:text-amber-200 font-extrabold text-xs justify-end">
                        <span>بيانات تفعيل الحساب (لأول طلب فقط) 🌸</span>
                        <span className="text-sm">👤</span>
                      </div>
                      
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                        يرجى ملء الاسم ورقم الهاتف بالأسفل لمرة واحدة لتسجيل حسابكِ في متجر أم روح وتتبع طلباتكِ ومحفظتكِ الإلكترونية مستقبلاً بكل يسر وسهولة!
                      </p>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">الاسم الكريم للعميل:</label>
                        <input
                          id="checkout-guest-name"
                          type="text"
                          value={guestName}
                          onChange={(e) => {
                            setGuestName(e.target.value);
                            setSenderName(e.target.value); // also pre-fill sender name to make it easier!
                          }}
                          placeholder="الاسم الثنائي أو الثلاثي"
                          required
                          className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-850 text-gray-900 dark:text-white border border-amber-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-medium text-right"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">رقم الهاتف للتواصل:</label>
                        <input
                          id="checkout-guest-phone"
                          type="text"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          placeholder="مثال: 777123456"
                          required
                          className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-850 text-gray-900 dark:text-white border border-amber-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-medium text-right"
                        />
                      </div>
                    </div>
                  )}

                  {/* Address Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">منطقة / محافظة التوصيل:</label>
                      <select
                        id="checkout-location-select"
                        value={selectedLocation ? selectedLocation.id : ''}
                        onChange={(e) => {
                          const found = Database.getLocations().find(l => l.id === e.target.value);
                          if (found) setSelectedLocation(found);
                        }}
                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-amber-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-semibold text-right"
                      >
                        {Database.getLocations().map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} (توصيل: +{convertPrice(loc.deliveryFee, selectedCurrency, rates)} {getCurrencyCode(selectedCurrency)})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">العنوان التفصيلي (الشارع / المعلم القريب / الحارة):</label>
                      <input
                        id="checkout-address-detail"
                        type="text"
                        value={addressDetail}
                        onChange={(e) => setAddressDetail(e.target.value)}
                        placeholder="مثال: الأصبحي - جولة بيت بوس - خلف سوبرماركت..."
                        required
                        className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-amber-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-medium text-right"
                      />
                    </div>
                  </div>

                  {/* Standard bank transfer details if not using gift wallet */}
                  {/* Standard bank transfer details if not using gift wallet */}
                  {!isWalletPayment ? (
                    <>
                      {/* Sub-tabs for transfer types */}
                      <div className="flex border border-amber-100/40 dark:border-gray-800 rounded-xl overflow-hidden mb-3">
                        <button
                          type="button"
                          onClick={() => {
                            setTransferType('kuraimi');
                            setSenderAccount('');
                          }}
                          className={`flex-1 py-2 text-center text-[11px] font-black transition-all ${
                            transferType === 'kuraimi'
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-gray-750'
                          }`}
                        >
                          🏦 حساب الكريمي
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTransferType('najm');
                            setSenderAccount('');
                          }}
                          className={`flex-1 py-2 text-center text-[11px] font-black transition-all ${
                            transferType === 'najm'
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-50 dark:bg-gray-800 text-gray-500 hover:text-gray-750'
                          }`}
                        >
                          ⭐ حوالة النجم وغيرها
                        </button>
                      </div>

                      {transferType === 'kuraimi' ? (
                        <div className="bg-blue-50/50 dark:bg-gray-800/60 p-3.5 rounded-2xl border border-blue-100/50 dark:border-gray-800 text-[10.5px] text-blue-800 dark:text-blue-400 leading-relaxed font-semibold space-y-2">
                          <div>
                            ℹ️ يرجى إيداع أو تحويل قيمة الفاتورة وهي <span className="font-extrabold text-amber-700">{totalAmount} {getCurrencyCode(selectedCurrency)}</span> إلى حساب الكريمي الخاص بالمتجر أدناه:
                          </div>
                          <div className="font-black text-amber-800 dark:text-amber-400 bg-amber-500/5 p-2 rounded-lg text-center tracking-wide text-xs space-y-1">
                            <div>🏦 الكريمي المميز</div>
                            <div className="text-[13px] text-amber-600 dark:text-amber-400 font-extrabold">الحساب: {adminSettings.kuraimiAccountNumber || '967739563915'}</div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">باسم: {adminSettings.kuraimiAccountName || 'أم روح'}</div>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-500/5 p-3.5 rounded-2xl border border-amber-200/50 text-[10.5px] text-amber-900 dark:text-amber-300 leading-relaxed font-semibold space-y-2">
                          <div>
                            ℹ️ يرجى إرسال حوالة بكامل مبلغ الفاتورة المعتمدة عبر <span className="font-extrabold text-amber-700">شبكة النجم أو أي شبكة صرافة وحوالات أخرى</span> إلى اسم المستلم الموضح أدناه:
                          </div>
                          <div className="font-black text-amber-800 dark:text-amber-450 bg-amber-500/10 p-2 rounded-lg text-center tracking-wide text-xs space-y-1">
                            <div>⭐ شبكة النجم أو أي شبكة أخرى</div>
                            <div className="text-[13px] text-amber-700 dark:text-amber-400 font-extrabold">الاسم رباعياً: {adminSettings.najmReceiverName || 'روح أحمد علي'}</div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">حالة الخدمة: معتمد ومباشر (يمكنك التحويل من أي صراف) ⚡</div>
                          </div>
                        </div>
                      )}

                      {/* Sender Name */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">اسم المرسل للحوالة:</label>
                        <input
                          id="checkout-sender-name"
                          type="text"
                          value={senderName}
                          onChange={(e) => setSenderName(e.target.value)}
                          placeholder="الاسم الثلاثي أو الثنائي كما هو بالبطاقة"
                          required
                          className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-amber-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-medium text-right"
                        />
                      </div>

                      {/* Sender Account */}
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 block">
                          {transferType === 'kuraimi' ? 'رقم حساب الكريمي المرسل منه (أو رقم الحوالة):' : 'رقم مرجع حوالة النجم (رقم الحوالة المكون من أرقام):'}
                        </label>
                        <input
                          id="checkout-sender-account"
                          type="text"
                          value={senderAccount}
                          onChange={(e) => setSenderAccount(e.target.value)}
                          placeholder={transferType === 'kuraimi' ? 'مثال: 1234567' : 'مثال: 987654321'}
                          required
                          className="w-full px-3.5 py-2.5 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-amber-100 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-xs font-medium text-right"
                        />
                      </div>

                      {/* Direct Device File Upload & Preview - CANCELLED */}
                      <div className="bg-emerald-50 dark:bg-emerald-950/10 p-3.5 rounded-2xl border border-emerald-100/45 dark:border-emerald-900/20 text-right space-y-1.5 my-3">
                        <div className="flex items-center gap-1.5 text-emerald-800 dark:text-emerald-400 font-extrabold text-xs justify-end">
                          <span className="text-sm">🌸</span>
                          <span>إرفاق سند السداد أو الحوالة</span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                          عزيزتي، لم نعد نطلب إرفاق صورة السند هنا لتسهيل تسوقكِ! يمكنكِ المتابعة ونقر زر **"إرسال الطلب وتأكيده للإدارة"** لتسجيل طلبكِ مباشرة في النظام لديهم للتحقق.
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed font-semibold">
                          كما يمكنكِ (اختيارياً) مشاركة تفاصيل الفاتورة عبر واتساب، وإرفاق صورة سند التحويل يدوياً في محادثة الواتساب لمن أرادت تأكيد الطلب بسرعة فائقة 🌸✨.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20 flex flex-col items-center text-center space-y-2">
                      <Coins className="w-8 h-8 text-amber-600 animate-bounce" />
                      <h4 className="text-xs font-extrabold text-amber-900 dark:text-amber-300">
                        {useGiftPayment ? 'سداد فوري من رصيد الهدايا 🎁' : 'سداد فوري من رصيدك المشحون 💳'}
                      </h4>
                      <p className="text-[11px] text-gray-500 leading-relaxed max-w-xs">
                        سيتم خصم قيمة الفاتورة بالكامل وهي <span className="font-extrabold">{totalAmount} {getCurrencyCode(selectedCurrency)}</span> مباشرة من {useGiftPayment ? 'هدايا أم روح' : 'رصيدك المشحون في المحفظة'} بشكل فوري وتوصيل طلبك دون الحاجة لحوالة خارجية!
                      </p>
                    </div>
                  )}

                  {/* Two distinct options for checkout */}
                  <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-right">
                    <label className="text-[11px] font-black text-amber-950 dark:text-amber-300 block mb-1">
                      حددي خيار تأكيد وإرسال طلب التوصيل:
                    </label>

                    <button
                      id="checkout-app-btn"
                      type="submit"
                      onClick={() => setCheckoutVia('app')}
                      className="w-full py-3 bg-gradient-to-l from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl font-black text-xs shadow-md transition transform active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span className="text-sm">📱</span>
                      <span>تأكيد وإرسال الطلب سحابياً عبر التطبيق</span>
                    </button>

                    <button
                      id="checkout-whatsapp-btn"
                      type="submit"
                      onClick={() => setCheckoutVia('whatsapp')}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-md transition transform active:scale-95 flex items-center justify-center gap-2"
                    >
                      <span className="text-sm">💬</span>
                      <span>تأكيد وإرسال الطلب ومتابعته عبر واتساب</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unauthorized Domain Guide Modal */}
        <UnauthorizedDomainModal isOpen={showDomainModal} onClose={() => setShowDomainModal(false)} />

        {/* WhatsApp Cart Images Processing Loader Overlay */}
        <AnimatePresence>
          {isDownloadingCartImages && (
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
                  {/* Folder download icon */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-full text-emerald-600 dark:text-emerald-400">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h16" />
                    </svg>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-black text-emerald-950 dark:text-emerald-300">
                    جاري تحميل صور الفاتورة
                  </h3>
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">
                    {cartDownloadProgress}
                  </p>
                </div>

                {/* Progress bar mock */}
                <div className="w-full bg-gray-100 dark:bg-gray-800 h-2 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: "10%" }}
                    animate={{ width: "95%" }}
                    transition={{ duration: 4, ease: "easeInOut" }}
                    className="bg-emerald-500 h-full rounded-full"
                  ></motion.div>
                </div>

                <div className="text-[10px] text-gray-400 font-semibold leading-relaxed">
                  سنقوم بتحويلكِ إلى الواتساب مباشرة لإرسال تفاصيل الفاتورة وتأكيدها للإدارة مع كامل الصور المرفقة تلقائياً 🌸✨
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Simple Gift Icon if needed
function GiftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5a2 2 0 10-2 2h2zm0 0h4m-4 0H8m12 3a2 2 0 100-4H4a2 2 0 100 4m16 0H4m16 0v1a2 2 0 01-2 2H6a2 2 0 01-2-2V9m16 0H4" />
    </svg>
  );
}
