import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RestaurantMenu, ChatMessage, MenuItem } from '../types';
import { getMenu, getMenuBySlug } from '../services/storageService';
import { chatWithMenu } from '../services/geminiService';
import { Utensils, AlertCircle, MessageCircle, Globe, Bot, X, Send, Store, Search, ChevronRight, Plus, Minus, ShoppingBag, Bell, Star, Sparkles, Moon, Sun } from 'lucide-react';
import { translations } from '../utils/translations';

interface MenuViewerProps {
  menuProp?: RestaurantMenu | null; // For Preview Mode inside Editor
}

interface SelectedItem extends MenuItem {
  count: number;
}

const MenuViewer: React.FC<MenuViewerProps> = ({ menuProp }) => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Chat State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // UI State
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [cart, setCart] = useState<Record<string, number>>({}); // Key: categoryIndex-itemIndex
  const [showCartModal, setShowCartModal] = useState(false);

  // Refs for scrolling
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const isPreview = !!menuProp;

  useEffect(() => {
    if (menuProp) {
        setMenu(menuProp);
        setLoading(false);
        // Only update active category if it's currently empty or invalid, 
        // to prevent resetting user's scroll position during live editing.
        setActiveCategory(prev => {
             const exists = menuProp.categories.some(c => c.title === prev);
             if (exists && prev !== '') return prev;
             return menuProp.categories.length > 0 ? menuProp.categories[0].title : '';
        });
        return;
    }

    const loadMenu = async () => {
        let foundMenu: RestaurantMenu | null = null;
        if (slug) foundMenu = await getMenuBySlug(slug);
        else if (id) foundMenu = await getMenu(id);

        if (foundMenu) {
            if (!foundMenu.language) foundMenu.language = 'pt';
            setMenu(foundMenu);
            if (foundMenu.categories.length > 0) setActiveCategory(foundMenu.categories[0].title);
        }
        setLoading(false);
    };
    loadMenu();
  }, [id, slug, menuProp]);

  // Scroll Spy for Categories
  useEffect(() => {
    const handleScroll = () => {
        if (!menu) return;
        
        // Determine reference boundary for "stickiness"
        // If preview, we look relative to the container.
        let topBoundary = 0;
        if (isPreview && containerRef.current) {
                const containerRect = containerRef.current.getBoundingClientRect();
                topBoundary = containerRect.top;
        }

        for (const cat of menu.categories) {
            const el = categoryRefs.current[cat.title];
            if (el) {
                const rect = el.getBoundingClientRect();
                // Check if element is near the top of the view area
                const relativeTop = rect.top - topBoundary;
                
                // 220px offset to account for header + nav bar
                if (relativeTop >= 0 && relativeTop <= 220) {
                    setActiveCategory(cat.title);
                    break;
                }
            }
        }
    };
    
    const target = isPreview ? containerRef.current : window;
    target?.addEventListener('scroll', handleScroll);
    return () => target?.removeEventListener('scroll', handleScroll);
  }, [menu, isPreview]);

  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, showChat]);

  const scrollToCategory = (title: string) => {
      setActiveCategory(title);
      const el = categoryRefs.current[title];
      if (el) {
          if (isPreview && containerRef.current) {
              // Scroll inside container
              // Calculate target position: element's offsetTop relative to the container's content
              // We use 180 as header offset approximation
              containerRef.current.scrollTo({ top: el.offsetTop - 180, behavior: 'smooth' });
          } else {
              // Window scroll
              const y = el.getBoundingClientRect().top + window.scrollY - 140;
              window.scrollTo({ top: y, behavior: 'smooth' });
          }
      }
  };

  const updateCart = (catIdx: number, itemIdx: number, delta: number) => {
      const key = `${catIdx}-${itemIdx}`;
      setCart(prev => {
          const current = prev[key] || 0;
          const newCount = Math.max(0, current + delta);
          const newCart = { ...prev, [key]: newCount };
          if (newCount === 0) delete newCart[key];
          return newCart;
      });
  };

  const getTotalItems = () => Object.values(cart).reduce((a, b) => a + b, 0);
  
  const getTotalPrice = () => {
      if (!menu) return 0;
      let total = 0;
      Object.entries(cart).forEach(([key, count]) => {
          const [cIdx, iIdx] = key.split('-').map(Number);
          const item = menu.categories[cIdx]?.items[iIdx];
          if (item) {
              // Extract numeric price
              const priceStr = item.price.replace(/[^0-9.,]/g, '').replace(',', '.');
              const price = parseFloat(priceStr) || 0;
              total += price * count;
          }
      });
      return total.toFixed(2);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || !menu) return;
    const userMsg: ChatMessage = { role: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const reply = await chatWithMenu(chatInput, menu, menu.language || 'pt');
      setChatMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsChatLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-600"></div></div>;

  const t = translations[menu?.language || 'pt'];

  if (!menu) return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h1 className="text-2xl font-bold text-slate-800 mb-2">{t?.menuNotFound || "Menu Not Found"}</h1>
        {!isPreview && <Link to="/" className="px-6 py-3 bg-brand-600 text-white rounded-lg font-medium">{t?.createAnother || "Create"}</Link>}
      </div>
  );

  const toggleLanguage = () => {
    const newLang = menu.language === 'en' ? 'pt' : 'en';
    setMenu({ ...menu, language: newLang });
  };

  const themeClasses: Record<string, string> = {
    orange: 'from-orange-500 to-orange-600',
    red: 'from-red-600 to-red-700',
    slate: 'from-slate-800 to-slate-900',
    emerald: 'from-emerald-500 to-emerald-600',
    blue: 'from-blue-600 to-blue-700',
  };
  const gradient = themeClasses[menu.themeColor] || 'from-slate-800 to-slate-900';

  // --- Theme Styles Logic ---
  const getThemeStyles = () => {
    if (!isDarkMode) return {
        container: "bg-slate-50",
        text: "text-slate-900",
        muted: "text-slate-500",
        card: "bg-white border-slate-100 shadow-sm",
        nav: "bg-white border-slate-100",
        navBtnActive: "bg-slate-900 text-white shadow-md",
        navBtnInactive: "bg-slate-100 text-slate-600 hover:bg-slate-200",
        highlightCategory: "bg-amber-50/50 border-amber-100/50",
        highlightText: "text-slate-900",
        modalBg: "bg-white",
        modalText: "text-slate-900",
        cartBg: "bg-white border-t border-slate-200"
    };

    const color = menu.themeColor || 'slate';
    const styles: any = {
        container: "bg-slate-950",
        text: "text-slate-50",
        muted: "text-slate-400",
        card: "bg-slate-900 border-slate-800 shadow-none",
        nav: "bg-slate-950 border-slate-900",
        navBtnActive: "bg-white text-slate-900",
        navBtnInactive: "bg-slate-900 text-slate-400 hover:bg-slate-800",
        highlightCategory: "bg-amber-900/10 border-amber-500/10",
        highlightText: "text-amber-100",
        modalBg: "bg-slate-900",
        modalText: "text-slate-50",
        cartBg: "bg-slate-900 border-t border-slate-800"
    };

    // Override based on color
    if (color === 'orange') {
        styles.container = "bg-orange-950";
        styles.text = "text-orange-50";
        styles.muted = "text-orange-200/60";
        styles.card = "bg-orange-900/20 border-orange-500/10";
        styles.nav = "bg-orange-950 border-orange-900/50";
        styles.navBtnActive = "bg-orange-100 text-orange-900";
        styles.navBtnInactive = "bg-orange-900/40 text-orange-200 hover:bg-orange-900/60";
        styles.modalBg = "bg-orange-950";
        styles.cartBg = "bg-orange-950 border-t border-orange-900";
    } else if (color === 'red') {
        styles.container = "bg-red-950";
        styles.text = "text-red-50";
        styles.muted = "text-red-200/60";
        styles.card = "bg-red-900/20 border-red-500/10";
        styles.nav = "bg-red-950 border-red-900/50";
        styles.navBtnActive = "bg-red-100 text-red-900";
        styles.navBtnInactive = "bg-red-900/40 text-red-200 hover:bg-red-900/60";
        styles.modalBg = "bg-red-950";
        styles.cartBg = "bg-red-950 border-t border-red-900";
    } else if (color === 'emerald') {
        styles.container = "bg-emerald-950";
        styles.text = "text-emerald-50";
        styles.muted = "text-emerald-200/60";
        styles.card = "bg-emerald-900/20 border-emerald-500/10";
        styles.nav = "bg-emerald-950 border-emerald-900/50";
        styles.navBtnActive = "bg-emerald-100 text-emerald-900";
        styles.navBtnInactive = "bg-emerald-900/40 text-emerald-200 hover:bg-emerald-900/60";
        styles.modalBg = "bg-emerald-950";
        styles.cartBg = "bg-emerald-950 border-t border-emerald-900";
    } else if (color === 'blue') {
        styles.container = "bg-blue-950";
        styles.text = "text-blue-50";
        styles.muted = "text-blue-200/60";
        styles.card = "bg-blue-900/20 border-blue-500/10";
        styles.nav = "bg-blue-950 border-blue-900/50";
        styles.navBtnActive = "bg-blue-100 text-blue-900";
        styles.navBtnInactive = "bg-blue-900/40 text-blue-200 hover:bg-blue-900/60";
        styles.modalBg = "bg-blue-950";
        styles.cartBg = "bg-blue-950 border-t border-blue-900";
    }

    return styles;
  };

  const themeStyle = getThemeStyles();

  return (
    <div 
        ref={containerRef} 
        className={isPreview ? `h-full overflow-y-auto relative custom-scrollbar pb-32 ${themeStyle.container} transition-colors duration-300` : `min-h-screen pb-32 print:bg-white print:pb-0 font-sans ${themeStyle.container} transition-colors duration-300`}
    >
      
      {/* 1. Modern Header */}
      <header className={`bg-gradient-to-r ${gradient} text-white pb-8 pt-12 px-6 shadow-xl relative overflow-hidden print:hidden`}>
        <div className="absolute top-0 right-0 opacity-10 transform translate-x-10 -translate-y-10"><Utensils size={200} /></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center md:items-start gap-6 max-w-4xl mx-auto">
             <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl bg-white p-1 shadow-lg overflow-hidden flex-shrink-0">
                  {menu.logo ? <img src={menu.logo} alt="Logo" className="w-full h-full object-cover rounded-xl" /> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300"><Store size={40} /></div>}
             </div>
             <div className="text-center md:text-left flex-1">
                 <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-1">{menu.name}</h1>
                 <p className="text-white/80 text-sm font-medium uppercase tracking-wider mb-3">{menu.businessType || "Digital Menu"}</p>
                 <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    {menu.whatsapp && (
                        <a href={`https://wa.me/${menu.whatsapp}`} target="_blank" rel="noreferrer" className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-colors">
                            <MessageCircle size={14} /> WhatsApp
                        </a>
                    )}
                    
                    <button onClick={toggleLanguage} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-colors">
                        <Globe size={14} /> {menu.language === 'en' ? 'EN' : 'PT'}
                    </button>
                    
                    <button onClick={() => setIsDarkMode(!isDarkMode)} className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-colors">
                        {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                 </div>
             </div>
        </div>
      </header>

      {/* 2. Sticky Category Navigation (Mobile App Style) */}
      <div className={`sticky top-0 z-40 border-b shadow-sm print:hidden transition-colors duration-300 ${themeStyle.nav}`}>
          <div className="max-w-4xl mx-auto flex overflow-x-auto no-scrollbar py-3 px-4 gap-2">
              {menu.categories.map((cat, idx) => (
                  <button 
                    key={idx}
                    onClick={() => scrollToCategory(cat.title)}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1 ${
                        activeCategory === cat.title 
                        ? `${themeStyle.navBtnActive} transform scale-105` 
                        : themeStyle.navBtnInactive
                    }`}
                  >
                      {cat.highlight && <Star size={12} fill="currentColor" className="text-amber-400" />}
                      {cat.title}
                  </button>
              ))}
          </div>
      </div>

      {/* 3. Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-8 print:max-w-none print:px-0">
        {menu.categories.map((category, catIdx) => (
          <div 
            key={catIdx} 
            ref={(el) => { categoryRefs.current[category.title] = el; }}
            className={`scroll-mt-32 transition-colors duration-300 ${category.highlight ? `${themeStyle.highlightCategory} -mx-4 px-4 py-6 rounded-3xl border` : ''}`}
          >
            <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 print:text-2xl print:border-b print:border-black print:pb-1 ${category.highlight ? themeStyle.highlightText : themeStyle.text}`}>
                {category.highlight && <Sparkles className="text-amber-500 fill-amber-500" size={20} />}
                {category.title} 
                <span className={`h-1 flex-1 rounded-full print:hidden ${category.highlight ? 'bg-amber-500/30' : 'bg-slate-200/20'}`}></span>
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:block">
              {category.items.map((item, itemIdx) => {
                const cartKey = `${catIdx}-${itemIdx}`;
                const count = cart[cartKey] || 0;

                return (
                    <div key={itemIdx} className={`p-4 rounded-2xl border flex gap-4 transition-all hover:shadow-md print:shadow-none print:border-none print:border-b print:border-slate-200 print:rounded-none ${themeStyle.card}`}>
                        
                        {/* Text Content */}
                        <div className="flex-1 flex flex-col justify-between">
                            <div>
                                <div className="flex justify-between items-start">
                                    <h3 className={`font-bold text-lg leading-tight mb-1 ${themeStyle.text}`}>{item.name}</h3>
                                </div>
                                <p className={`text-sm leading-relaxed line-clamp-2 print:line-clamp-none ${themeStyle.muted}`}>{item.description}</p>
                            </div>
                            
                            <div className="flex items-center justify-between mt-3">
                                <span className={`font-bold text-lg ${themeStyle.text}`}>{item.price}</span>
                                
                                {/* Add to Cart UI */}
                                {!isPreview && (
                                    <div className={`flex items-center rounded-lg p-1 print:hidden ${isDarkMode ? 'bg-black/20' : 'bg-slate-100'}`}>
                                        {count > 0 ? (
                                            <>
                                                <button onClick={() => updateCart(catIdx, itemIdx, -1)} className={`w-7 h-7 flex items-center justify-center rounded-md shadow-sm active:scale-95 transition-transform ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-slate-700'}`}><Minus size={14}/></button>
                                                <span className={`w-8 text-center font-bold text-sm ${themeStyle.text}`}>{count}</span>
                                                <button onClick={() => updateCart(catIdx, itemIdx, 1)} className={`w-7 h-7 flex items-center justify-center rounded-md shadow-sm active:scale-95 transition-transform ${isDarkMode ? 'bg-white text-slate-900' : 'bg-slate-900 text-white'}`}><Plus size={14}/></button>
                                            </>
                                        ) : (
                                            <button onClick={() => updateCart(catIdx, itemIdx, 1)} className={`px-3 py-1 text-xs font-bold rounded-md shadow-sm flex items-center gap-1 ${isDarkMode ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>
                                                Add <Plus size={12}/>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Image Content (Right Side for Mobile Look) */}
                        {item.image && (
                            <div 
                                onClick={() => !isPreview && setSelectedImage(item.image || null)}
                                className={`w-28 h-28 flex-shrink-0 rounded-xl overflow-hidden cursor-pointer relative group print:hidden ${isDarkMode ? 'bg-black/20' : 'bg-slate-100'}`}
                            >
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                            </div>
                        )}
                    </div>
                );
              })}
            </div>
          </div>
        ))}
      </main>

      {/* 4. Sticky Bottom Bar (Summary) */}
      {!isPreview && getTotalItems() > 0 && (
          <div className={`fixed bottom-0 left-0 right-0 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40 print:hidden animate-in slide-in-from-bottom duration-300 ${themeStyle.cartBg}`}>
              <div className="max-w-4xl mx-auto flex justify-between items-center">
                  <div 
                    onClick={() => setShowCartModal(true)}
                    className="flex flex-col cursor-pointer"
                  >
                      <span className={`text-xs uppercase font-bold ${themeStyle.muted}`}>{t.itemsTotal?.replace('items total', 'Selection')}</span>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-extrabold ${themeStyle.text}`}>{getTotalItems()} items</span>
                        <span className={`text-sm font-medium ${isDarkMode ? 'text-white/60' : 'text-slate-600'}`}>Total: {getTotalPrice()}</span>
                      </div>
                  </div>
                  <button 
                    onClick={() => setShowCartModal(true)}
                    className="bg-brand-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-brand-500/20 active:scale-95 transition-transform"
                  >
                      <ShoppingBag size={18} /> View List
                  </button>
              </div>
          </div>
      )}

      {/* 5. Floating Chat Button (Moved up slightly if cart is visible) */}
      {!isPreview && (
        <div className={`fixed right-6 flex flex-col gap-3 z-30 items-end transition-all duration-300 print:hidden ${getTotalItems() > 0 ? 'bottom-24' : 'bottom-6'}`}>
            <button onClick={() => setShowChat(!showChat)} className="bg-slate-900 text-white p-4 rounded-full shadow-lg hover:bg-slate-800 transition-transform hover:scale-105 flex items-center justify-center">
                {showChat ? <X size={24} /> : <Bot size={24} />}
            </button>
        </div>
      )}

      {/* Chat Bot Interface */}
      {showChat && !isPreview && (
        <div className={`fixed right-4 sm:right-6 w-80 max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl border overflow-hidden flex flex-col z-50 h-96 animate-in slide-in-from-bottom-10 fade-in duration-200 print:hidden ${getTotalItems() > 0 ? 'bottom-40' : 'bottom-24'} ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="bg-slate-900 text-white p-3 flex justify-between items-center">
                <div className="flex items-center gap-2 font-bold text-sm"><Bot size={16} /> {t.askAi}</div>
                <button onClick={() => setShowChat(false)} className="text-white/70 hover:text-white"><X size={18} /></button>
            </div>
            <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                {chatMessages.length === 0 && <div className={`text-center text-xs mt-4 ${themeStyle.muted}`}><p>{t.chatPlaceholder}</p></div>}
                {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-xl p-2 text-sm ${msg.role === 'user' ? 'bg-brand-600 text-white' : isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>{msg.text}</div>
                    </div>
                ))}
                {isChatLoading && <div className={`text-xs ml-2 ${themeStyle.muted}`}>Typing...</div>}
                <div ref={chatEndRef} />
            </div>
            <div className={`p-3 border-t flex gap-2 ${isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                <input className={`flex-1 rounded-lg px-3 py-2 text-sm outline-none ${isDarkMode ? 'bg-slate-800 text-white placeholder-slate-500' : 'bg-slate-100'}`} value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Ask..." />
                <button onClick={handleSendMessage} disabled={!chatInput.trim()} className="bg-brand-600 text-white p-2 rounded-lg"><Send size={16} /></button>
            </div>
        </div>
      )}

      {/* Cart/Selection Modal */}
      {showCartModal && (
          <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in duration-200">
              <div className={`w-full max-w-md sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in slide-in-from-bottom duration-300 ${themeStyle.modalBg}`}>
                  <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                      <h3 className={`font-bold text-lg flex items-center gap-2 ${themeStyle.modalText}`}><ShoppingBag size={20}/> Your Selection</h3>
                      <button onClick={() => setShowCartModal(false)} className={`p-2 rounded-full ${isDarkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-200 hover:bg-slate-300 text-slate-900'}`}><X size={18}/></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {Object.keys(cart).length === 0 ? (
                          <div className={`text-center py-10 ${themeStyle.muted}`}>Empty selection</div>
                      ) : (
                          Object.entries(cart).map(([key, count]) => {
                              const [cIdx, iIdx] = key.split('-').map(Number);
                              const item = menu.categories[cIdx]?.items[iIdx];
                              if(!item) return null;
                              return (
                                  <div key={key} className="flex justify-between items-center">
                                      <div>
                                          <div className={`font-bold ${themeStyle.modalText}`}>{item.name}</div>
                                          <div className={`text-xs ${themeStyle.muted}`}>{item.price}</div>
                                      </div>
                                      <div className={`flex items-center gap-3 rounded-lg p-1 ${isDarkMode ? 'bg-black/30' : 'bg-slate-100'}`}>
                                          <button onClick={() => updateCart(cIdx, iIdx, -1)} className={`w-8 h-8 flex items-center justify-center rounded shadow-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-slate-700'}`}><Minus size={14}/></button>
                                          <span className={`font-bold text-sm w-4 text-center ${themeStyle.modalText}`}>{count}</span>
                                          <button onClick={() => updateCart(cIdx, iIdx, 1)} className={`w-8 h-8 flex items-center justify-center rounded shadow-sm ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-slate-700'}`}><Plus size={14}/></button>
                                      </div>
                                  </div>
                              )
                          })
                      )}
                  </div>
                  <div className={`p-4 border-t ${isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-100 bg-slate-50'}`}>
                      <div className="flex justify-between items-center mb-4">
                          <span className={`font-medium ${themeStyle.muted}`}>Total Estimate</span>
                          <span className={`text-2xl font-extrabold ${themeStyle.modalText}`}>{getTotalPrice()}</span>
                      </div>
                      <button onClick={() => setShowCartModal(false)} className={`w-full py-4 rounded-xl font-bold text-lg flex justify-center items-center gap-2 ${isDarkMode ? 'bg-white text-slate-900 hover:bg-gray-100' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                           Show to Waiter <Bell size={18} />
                      </button>
                      <p className={`text-[10px] text-center mt-2 ${themeStyle.muted}`}>This is not an online order. Show this screen to service staff.</p>
                  </div>
              </div>
          </div>
      )}

      {/* Image Modal */}
      {selectedImage && !isPreview && (
        <div className="fixed inset-0 z-[70] bg-black/95 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
            <button className="absolute top-4 right-4 text-white/70 bg-white/10 p-2 rounded-full"><X size={24} /></button>
            <img src={selectedImage} alt="Full size" className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
      
      <footer className={`mt-12 text-center text-xs px-6 print:hidden ${themeStyle.muted}`}>
        <p>{t.poweredBy}</p>
      </footer>
    </div>
  );
};

export default MenuViewer;