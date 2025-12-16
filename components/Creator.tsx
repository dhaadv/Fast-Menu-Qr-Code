import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { generateMenuFromAI, generateSlug } from '../services/geminiService';
import { saveMenu, isSlugAvailable } from '../services/storageService';
import { RestaurantMenu, Language } from '../types';
import { Sparkles, ListPlus, Globe, Camera, X, Store, ArrowRight, ChefHat } from 'lucide-react';
import { translations } from '../utils/translations';

const Creator: React.FC = () => {
  const navigate = useNavigate();
  const [establishmentName, setEstablishmentName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [extraInfo, setExtraInfo] = useState('');
  const [menuImage, setMenuImage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [language, setLanguage] = useState<Language>('pt');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[language];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          setMenuImage(ev.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async () => {
    if (!establishmentName.trim() || !businessType.trim()) return;

    setIsGenerating(true);
    try {
      // 1. Generate Slug (Unique ID for public URL)
      let slug = await generateSlug(establishmentName);
      const available = await isSlugAvailable(slug);
      if (!available) {
          slug = `${slug}-${Math.floor(Math.random() * 1000)}`;
      }

      // 2. Generate Content via AI
      const aiData = await generateMenuFromAI(establishmentName, businessType, extraInfo, language, menuImage || undefined);

      // 3. Create Object
      const newMenu: RestaurantMenu = {
        id: crypto.randomUUID(), 
        slug: slug,
        createdAt: Date.now(),
        whatsapp: '',
        language: language,
        ...aiData
      };

      // 4. Save to DB
      await saveMenu(newMenu);
      
      // 5. Redirect
      navigate(`/editor/${newMenu.id}`);
    } catch (e) {
      console.error(e);
      alert("Something went wrong creating your menu. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'en' ? 'pt' : 'en');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navbar */}
      <nav className="flex justify-between items-center py-6 px-6 max-w-5xl mx-auto w-full">
        <div className="flex items-center gap-2 text-slate-900 font-black text-xl tracking-tight">
           <div className="bg-brand-600 text-white p-1.5 rounded-lg"><ChefHat size={20} /></div> FlashMenu
        </div>
        <button 
          onClick={toggleLanguage}
          className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm font-bold text-slate-600 border border-slate-200 hover:bg-slate-100 transition-colors"
        >
          <Globe size={14} /> {language === 'en' ? 'EN' : 'PT'}
        </button>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 pb-20">
        
        <div className="max-w-2xl w-full text-center space-y-6 mb-10">
          <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-700 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border border-brand-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
             <Sparkles size={14} /> AI Powered Menu Creator
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100">
            {t.createTitle}
          </h1>
          <p className="text-lg md:text-xl text-slate-500 leading-relaxed max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
            {t.createSubtitle}
          </p>
        </div>

        {/* Card Form */}
        <div className="w-full max-w-lg bg-white p-2 rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 animate-in fade-in zoom-in-95 duration-500 delay-300">
          
          <div className="p-6 space-y-6">
            {/* Step 1: Name */}
            <div className="relative group">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">{t.estName}</label>
                <div className="flex items-center bg-slate-50 rounded-xl border-2 border-transparent focus-within:border-brand-500 focus-within:bg-white transition-all">
                    <input
                        type="text"
                        value={establishmentName}
                        onChange={(e) => setEstablishmentName(e.target.value)}
                        placeholder={t.estPlaceholder}
                        className="w-full p-4 bg-transparent outline-none text-slate-900 font-semibold placeholder:font-normal placeholder:text-slate-400"
                        disabled={isGenerating}
                    />
                </div>
            </div>

            {/* Step 2: Type */}
            <div className="relative group">
                <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block flex items-center gap-1"><Store size={12}/> {language === 'pt' ? 'Tipo' : 'Type'}</label>
                <div className="flex items-center bg-slate-50 rounded-xl border-2 border-transparent focus-within:border-brand-500 focus-within:bg-white transition-all">
                    <input
                        type="text"
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        placeholder={language === 'pt' ? 'ex: Hamburgueria, Sushi Bar' : 'e.g. Burger Joint'}
                        className="w-full p-4 bg-transparent outline-none text-slate-900 font-semibold placeholder:font-normal placeholder:text-slate-400"
                        disabled={isGenerating}
                    />
                </div>
            </div>

            {/* Extra Info (Collapse if empty initially to save space? keeping open for now) */}
            <div>
                 <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block flex items-center gap-1"><ListPlus size={12}/> {t.extraInfo}</label>
                 <input
                    type="text"
                    value={extraInfo}
                    onChange={(e) => setExtraInfo(e.target.value)}
                    placeholder={t.extraPlaceholder}
                    className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl outline-none text-slate-700 text-sm focus:border-brand-300 focus:bg-white transition-all"
                    disabled={isGenerating}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
            </div>
            
            {/* Camera / Upload */}
            <div>
                 <label className="text-xs font-bold text-slate-400 uppercase ml-1 mb-1 block">{t.scanMenu} <span className="text-[10px] bg-brand-100 text-brand-700 px-1 rounded ml-1">BETA</span></label>
                {!menuImage ? (
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:bg-slate-50 hover:border-brand-400 hover:text-brand-600 transition-all group"
                    >
                        <Camera size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-medium">{t.scanHint}</span>
                    </button>
                ) : (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 flex items-center gap-3 p-2 pr-4">
                        <img src={menuImage} alt="Preview" className="w-14 h-14 object-cover rounded-lg shadow-sm" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-700 truncate">Menu Photo Uploaded</p>
                            <p className="text-xs text-slate-400">AI will analyze this</p>
                        </div>
                        <button 
                            onClick={() => {
                                setMenuImage(null);
                                if (fileInputRef.current) fileInputRef.current.value = "";
                            }}
                            className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                        >
                            <X size={18} />
                        </button>
                    </div>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} />
            </div>
          </div>

          <div className="p-2 bg-slate-50 rounded-b-3xl border-t border-slate-100">
            <button
                onClick={handleCreate}
                disabled={!establishmentName.trim() || !businessType.trim() || isGenerating}
                className={`
                    w-full py-4 rounded-2xl font-bold text-lg text-white shadow-xl 
                    flex items-center justify-center gap-3 transition-all duration-300
                    ${!establishmentName.trim() || !businessType.trim() || isGenerating 
                    ? 'bg-slate-300 cursor-not-allowed shadow-none grayscale' 
                    : 'bg-slate-900 hover:bg-slate-800 hover:shadow-2xl hover:-translate-y-1'}
                `}
            >
                {isGenerating ? (
                    <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="animate-pulse">{t.building}</span>
                    </>
                ) : (
                    <>
                    {t.createBtn} <ArrowRight size={20} />
                    </>
                )}
            </button>
          </div>
        </div>
      </main>
      
      <footer className="py-6 text-center text-slate-400 text-xs">
        &copy; {new Date().getFullYear()} {t.footer}
      </footer>
    </div>
  );
};

export default Creator;