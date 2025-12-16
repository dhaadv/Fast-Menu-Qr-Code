import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { RestaurantMenu, MenuCategory, MenuItem, Language } from '../types';
import { getMenu, saveMenu } from '../services/storageService';
import { generateMenuItemImage, generateItemDescription } from '../services/geminiService';
import { ArrowLeft, Plus, Trash2, Save, GripVertical, Image as ImageIcon, X, Check, Sparkles, Globe, Eye, Edit, Upload, Wand2, Star, Settings, List, ChevronDown, ChevronUp, LayoutGrid, Phone, Store, Link as LinkIcon } from 'lucide-react';
import { translations } from '../utils/translations';
import MenuViewer from './MenuViewer'; // Import the viewer for Preview
import {
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const THEME_COLORS = [
  { value: 'orange', label: 'Orange', bg: 'bg-orange-500' },
  { value: 'red', label: 'Red', bg: 'bg-red-600' },
  { value: 'slate', label: 'Slate', bg: 'bg-slate-800' },
  { value: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-600' },
];

// --- Sortable Item Component ---
interface SortableItemProps {
  id: string;
  item: MenuItem;
  catIndex: number;
  itemIndex: number;
  onDelete: () => void;
  onUpdate: (field: keyof MenuItem, value: string) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ id, item, catIndex, itemIndex, onDelete, onUpdate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="p-3 flex gap-3 items-start group relative bg-white hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
      <div 
        {...attributes} 
        {...listeners} 
        className="text-slate-300 cursor-grab hover:text-slate-500 flex items-center pt-2 touch-none"
      >
        <GripVertical size={16} />
      </div>
      
      {/* Thumbnail if exists */}
      {item.image && (
          <div className="w-16 h-16 flex-shrink-0 bg-slate-100 rounded-md overflow-hidden border border-slate-100 relative group/img">
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          </div>
      )}
      
      <div className="flex-1 space-y-1.5">
        <div className="flex gap-2">
            <input 
              type="text"
              value={item.name}
              onChange={(e) => onUpdate('name', e.target.value)}
              className="font-medium text-slate-800 w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none placeholder-slate-300"
              placeholder="Item Name"
            />
            <input 
              type="text"
              value={item.price}
              onChange={(e) => onUpdate('price', e.target.value)}
              className="font-bold text-slate-600 text-sm w-20 text-right bg-transparent border-b border-transparent focus:border-brand-500 outline-none placeholder-slate-300"
              placeholder="Price"
            />
        </div>
        <input 
          type="text"
          value={item.description}
          onChange={(e) => onUpdate('description', e.target.value)}
          className="text-xs text-slate-500 w-full bg-transparent border-b border-transparent focus:border-brand-500 outline-none placeholder-slate-300"
          placeholder="Description (optional)"
        />
      </div>
      
      <button onClick={onDelete} className="ml-2 mt-1 text-slate-300 hover:text-red-400 p-1 rounded hover:bg-red-50">
        <Trash2 size={14} />
      </button>
    </div>
  );
};

// --- Main Editor Component ---
const MenuEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<RestaurantMenu | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // UI View States
  const [mobileView, setMobileView] = useState<'edit' | 'preview'>('edit'); // Mobile: Edit vs Preview
  const [editorSection, setEditorSection] = useState<'content' | 'settings'>('content'); // Desktop/Edit: Content vs Settings
  const [collapsedCategories, setCollapsedCategories] = useState<Record<number, boolean>>({});

  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  // State for new additions
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newItemStates, setNewItemStates] = useState<Record<number, Partial<MenuItem>>>({});
  const [generatingImages, setGeneratingImages] = useState<Record<number, boolean>>({});
  const [generatingDesc, setGeneratingDesc] = useState<Record<number, boolean>>({});

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (id) {
      getMenu(id).then((data) => {
        if (data) setMenu(data);
      });
    }
  }, [id]);

  if (!menu) return <div className="min-h-screen flex items-center justify-center text-slate-500">Loading...</div>;
  const t = translations[menu.language || 'pt'];

  const handleSave = async () => {
    if (menu) {
      setIsSaving(true);
      await saveMenu(menu);
      setIsSaving(false);
      navigate(`/success/${menu.id}`);
    }
  };

  const updateEstablishment = (field: keyof RestaurantMenu, value: string) => {
    if (!menu) return;
    setMenu({ ...menu, [field]: value });
  };
  
  const toggleLanguage = () => {
    if (!menu) return;
    const newLang = menu.language === 'en' ? 'pt' : 'en';
    setMenu({...menu, language: newLang});
  };

  const updateCategoryTitle = (index: number, newTitle: string) => {
    if (!menu) return;
    const newCats = [...menu.categories];
    newCats[index].title = newTitle;
    setMenu({ ...menu, categories: newCats });
  };

  const toggleCategoryHighlight = (index: number) => {
    if (!menu) return;
    const newCats = [...menu.categories];
    newCats[index].highlight = !newCats[index].highlight;
    setMenu({ ...menu, categories: newCats });
  };

  const toggleCategoryCollapse = (index: number) => {
    setCollapsedCategories(prev => ({
        ...prev,
        [index]: !prev[index]
    }));
  };

  const updateItem = (catIndex: number, itemIndex: number, field: keyof MenuItem, value: string) => {
      if (!menu) return;
      const newCats = [...menu.categories];
      newCats[catIndex].items[itemIndex] = { 
          ...newCats[catIndex].items[itemIndex], 
          [field]: value 
      };
      setMenu({ ...menu, categories: newCats });
  };

  // --- Image & Helpers ---
  const resizeImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const MAX_WIDTH = 500;
          const MAX_HEIGHT = 500;

          if (width > height) {
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          } else {
            resolve(e.target?.result as string);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && menu) {
          const resized = await resizeImage(file);
          setMenu({ ...menu, logo: resized });
      }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, catIndex: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const resizedImage = await resizeImage(file);
      handleNewItemChange(catIndex, 'image', resizedImage);
    }
  };

  const handleGenerateAIImage = async (catIndex: number) => {
    const itemData = newItemStates[catIndex];
    if (!itemData?.name) return;
    setGeneratingImages(prev => ({ ...prev, [catIndex]: true }));
    try {
      const imageUrl = await generateMenuItemImage(itemData.name, itemData.description || '');
      if (imageUrl) handleNewItemChange(catIndex, 'image', imageUrl);
      else alert("Could not generate image. Please try again.");
    } catch (e) {
      console.error(e);
      alert("Error generating image.");
    } finally {
      setGeneratingImages(prev => ({ ...prev, [catIndex]: false }));
    }
  };

  const handleGenerateDescription = async (catIndex: number) => {
    const itemData = newItemStates[catIndex];
    if (!itemData?.name || !menu) return;
    setGeneratingDesc(prev => ({ ...prev, [catIndex]: true }));
    try {
        const desc = await generateItemDescription(itemData.name, menu.businessType || 'Restaurant', menu.language || 'pt');
        if (desc) handleNewItemChange(catIndex, 'description', desc);
    } catch (e) {
        console.error(e);
    } finally {
        setGeneratingDesc(prev => ({ ...prev, [catIndex]: false }));
    }
  };

  // --- CRUD Logic ---
  const addCategory = () => {
    if (!menu || !newCategoryName.trim()) return;
    const newCategory: MenuCategory = { title: newCategoryName, items: [] };
    setMenu({ ...menu, categories: [...menu.categories, newCategory] });
    setNewCategoryName('');
  };
  
  const addSpecialsCategory = () => {
      if (!menu) return;
      const newCategory: MenuCategory = { title: "⭐ Specials", items: [], highlight: true };
      setMenu({ ...menu, categories: [newCategory, ...menu.categories] });
  };

  const deleteCategory = (index: number) => {
    if (!menu) return;
    const newCats = [...menu.categories];
    newCats.splice(index, 1);
    setMenu({ ...menu, categories: newCats });
  };

  const handleNewItemChange = (catIndex: number, field: keyof MenuItem, value: string) => {
    setNewItemStates(prev => ({
      ...prev,
      [catIndex]: { ...prev[catIndex], [field]: value }
    }));
  };

  const addItem = (catIndex: number) => {
    if (!menu) return;
    const itemData = newItemStates[catIndex];
    if (!itemData?.name || !itemData?.price) return;
    const newItem: MenuItem = {
      name: itemData.name,
      price: itemData.price,
      description: itemData.description || '',
      image: itemData.image
    };
    const newCats = [...menu.categories];
    newCats[catIndex].items.push(newItem);
    setMenu({ ...menu, categories: newCats });
    setNewItemStates(prev => ({ ...prev, [catIndex]: {} }));
    if (fileInputRefs.current[catIndex]) fileInputRefs.current[catIndex]!.value = "";
  };

  const deleteItem = (catIndex: number, itemIndex: number) => {
    if (!menu) return;
    const newCats = [...menu.categories];
    newCats[catIndex].items.splice(itemIndex, 1);
    setMenu({ ...menu, categories: newCats });
  };

  const handleDragEnd = (event: DragEndEvent, catIndex: number) => {
    const { active, over } = event;
    if (!menu || !over || active.id === over.id) return;
    const category = menu.categories[catIndex];
    const oldIndex = category.items.findIndex((_, idx) => `${catIndex}-${idx}` === active.id);
    const newIndex = category.items.findIndex((_, idx) => `${catIndex}-${idx}` === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
       const newItems = arrayMove(category.items, oldIndex, newIndex);
       const newCategories = [...menu.categories];
       newCategories[catIndex] = { ...category, items: newItems };
       setMenu({ ...menu, categories: newCategories });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-32 lg:pb-0 h-screen overflow-hidden">
      {/* 1. Main Navbar */}
      <nav className="bg-white border-b border-slate-200 z-30 px-4 py-3 flex justify-between items-center shadow-sm flex-shrink-0">
        <div className="flex items-center gap-2">
            <button onClick={() => navigate('/')} className="text-slate-500 hover:text-slate-900 p-2 -ml-2 rounded-full hover:bg-slate-100 transition-colors">
                <ArrowLeft size={20} />
            </button>
            <span className="font-bold text-slate-800 text-lg">{t.editTitle}</span>
        </div>
        
        {/* Mobile View Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-lg lg:hidden">
            <button 
                onClick={() => setMobileView('edit')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mobileView === 'edit' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <div className="flex items-center gap-2">
                    <Edit size={14} /> <span className="hidden sm:inline">Editor</span>
                </div>
            </button>
            <button 
                onClick={() => setMobileView('preview')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mobileView === 'preview' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <div className="flex items-center gap-2">
                    <Eye size={14} /> <span className="hidden sm:inline">Preview</span>
                </div>
            </button>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
                onClick={toggleLanguage}
                className="hidden sm:flex items-center gap-1 bg-slate-50 px-2 py-1 rounded border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-100"
            >
                <Globe size={12} /> {menu.language === 'en' ? 'EN' : 'PT'}
            </button>
            <button 
                onClick={handleSave} 
                disabled={isSaving}
                className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-md shadow-brand-500/20 disabled:opacity-50 flex items-center gap-2"
            >
                {isSaving ? <span className="animate-spin">⏳</span> : <Save size={16} />}
                <span className="hidden sm:inline">{t.save}</span>
            </button>
        </div>
      </nav>

      {/* 2. Workspace */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* --- Editor Column --- */}
        <div className={`flex-1 flex flex-col min-w-0 bg-slate-50 transition-opacity duration-300 ${mobileView === 'preview' ? 'hidden lg:flex opacity-0 lg:opacity-100 absolute lg:static' : 'flex opacity-100'}`}>
            
            {/* Editor Mode Tabs (Settings vs Content) */}
            <div className="px-6 pt-6 pb-2">
                <div className="flex border-b border-slate-200">
                    <button
                        onClick={() => setEditorSection('content')}
                        className={`px-6 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${editorSection === 'content' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <List size={18} /> Menu Content
                    </button>
                    <button
                        onClick={() => setEditorSection('settings')}
                        className={`px-6 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${editorSection === 'settings' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <Settings size={18} /> Settings
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                
                {/* Mode: SETTINGS */}
                {editorSection === 'settings' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
                            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                <Store size={20} className="text-brand-500"/> {t.details}
                            </h2>
                            
                            {/* Logo Upload */}
                            <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 hover:border-brand-300 transition-colors">
                                {menu.logo ? (
                                    <div className="relative group">
                                        <img src={menu.logo} alt="Logo" className="w-32 h-32 rounded-full object-cover shadow-sm bg-white" />
                                        <button 
                                            onClick={() => setMenu({...menu, logo: undefined})}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={() => logoInputRef.current?.click()}
                                        className="flex flex-col items-center gap-2 text-slate-400 hover:text-brand-600 transition-colors"
                                    >
                                        <div className="p-4 bg-white rounded-full shadow-sm text-brand-500">
                                            <Upload size={28} />
                                        </div>
                                        <span className="text-sm font-bold uppercase tracking-wide">Upload Logo</span>
                                    </button>
                                )}
                                <input 
                                    type="file" 
                                    ref={logoInputRef}
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.estName}</label>
                                    <input 
                                    type="text" 
                                    value={menu.name}
                                    onChange={(e) => updateEstablishment('name', e.target.value)}
                                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all font-medium"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.whatsapp}</label>
                                    <div className="relative">
                                        <Phone size={16} className="absolute left-3 top-3.5 text-slate-400"/>
                                        <input 
                                        type="tel" 
                                        placeholder="e.g. 5511999999999"
                                        value={menu.whatsapp || ''}
                                        onChange={(e) => updateEstablishment('whatsapp', e.target.value)}
                                        className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5 ml-1">{t.waHint}</p>
                                </div>

                                {/* Custom QR Code Link Field */}
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">{t.qrUrlLabel}</label>
                                    <div className="relative">
                                        <LinkIcon size={16} className="absolute left-3 top-3.5 text-slate-400"/>
                                        <input 
                                        type="url" 
                                        placeholder="https://mysite.com"
                                        value={menu.customQrUrl || ''}
                                        onChange={(e) => updateEstablishment('customQrUrl', e.target.value)}
                                        className="w-full p-3 pl-10 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all"
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1.5 ml-1">{t.qrUrlHint}</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-3">{t.theme}</label>
                                <div className="flex gap-4 flex-wrap">
                                {THEME_COLORS.map((color) => (
                                    <button
                                    key={color.value}
                                    onClick={() => updateEstablishment('themeColor', color.value)}
                                    className={`w-12 h-12 rounded-full ${color.bg} ${
                                        menu.themeColor === color.value 
                                        ? 'ring-4 ring-offset-2 ring-slate-200 scale-110 shadow-lg' 
                                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                                    } transition-all flex items-center justify-center`}
                                    title={color.label}
                                    >
                                        {menu.themeColor === color.value && <Check size={20} className="text-white drop-shadow-md" />}
                                    </button>
                                ))}
                                </div>
                            </div>
                        </section>
                    </div>
                )}

                {/* Mode: CONTENT */}
                {editorSection === 'content' && (
                    <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-4 duration-300 pb-20">
                        {menu.categories.map((cat, catIndex) => {
                            const isCollapsed = collapsedCategories[catIndex];
                            return (
                                <section key={catIndex} className={`bg-white rounded-xl shadow-sm border transition-all duration-200 ${cat.highlight ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200 hover:border-slate-300'}`}>
                                    
                                    {/* Category Header (Accordion Toggle) */}
                                    <div className={`p-4 flex items-center justify-between gap-3 ${cat.highlight ? 'bg-amber-50/50' : 'bg-white'} ${!isCollapsed ? 'border-b border-slate-100' : 'rounded-xl'}`}>
                                        <button 
                                            onClick={() => toggleCategoryCollapse(catIndex)}
                                            className="flex items-center justify-center p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100 transition-colors"
                                        >
                                            {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                                        </button>

                                        <div className="flex-1 flex items-center gap-2">
                                            {cat.highlight && <Star size={16} className="text-amber-500 fill-amber-500 flex-shrink-0" />}
                                            <input 
                                                value={cat.title}
                                                onChange={(e) => updateCategoryTitle(catIndex, e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="font-bold text-lg text-slate-800 bg-transparent outline-none focus:border-b-2 focus:border-brand-500 w-full placeholder-slate-300"
                                                placeholder="Category Name"
                                            />
                                        </div>

                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => toggleCategoryHighlight(catIndex)}
                                                className={`p-2 rounded-lg transition-colors ${cat.highlight ? 'text-amber-500 bg-amber-100' : 'text-slate-300 hover:text-amber-400 hover:bg-slate-50'}`}
                                                title={cat.highlight ? "Remove Highlight" : "Highlight as Special"}
                                            >
                                                <Star size={18} fill={cat.highlight ? "currentColor" : "none"} />
                                            </button>
                                            <button 
                                                onClick={() => deleteCategory(catIndex)} 
                                                className="text-slate-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Category Body (Items) */}
                                    {!isCollapsed && (
                                        <div className="animate-in slide-in-from-top-2 duration-200">
                                            <DndContext 
                                                sensors={sensors} 
                                                collisionDetection={closestCenter}
                                                onDragEnd={(event) => handleDragEnd(event, catIndex)}
                                            >
                                                <SortableContext 
                                                items={cat.items.map((_, idx) => `${catIndex}-${idx}`)}
                                                strategy={verticalListSortingStrategy}
                                                >
                                                <div className="">
                                                    {cat.items.length === 0 && (
                                                        <div className="p-8 text-center text-slate-400 text-sm border-b border-slate-50">
                                                            No items yet. Add one below!
                                                        </div>
                                                    )}
                                                    {cat.items.map((item, itemIdx) => (
                                                    <SortableItem 
                                                        key={`${catIndex}-${itemIdx}`}
                                                        id={`${catIndex}-${itemIdx}`}
                                                        item={item}
                                                        catIndex={catIndex}
                                                        itemIndex={itemIdx}
                                                        onDelete={() => deleteItem(catIndex, itemIdx)}
                                                        onUpdate={(field, val) => updateItem(catIndex, itemIdx, field, val)}
                                                    />
                                                    ))}
                                                </div>
                                                </SortableContext>
                                            </DndContext>

                                            {/* Add Product Form */}
                                            <div className="p-4 bg-slate-50/80 rounded-b-xl">
                                                <div className="flex flex-col gap-3">
                                                    <div className="flex gap-3">
                                                        <div className="flex-1 space-y-2">
                                                            <div className="flex gap-2">
                                                                <input 
                                                                    placeholder={t.itemPlaceholder} 
                                                                    className="flex-1 p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none shadow-sm"
                                                                    value={newItemStates[catIndex]?.name || ''}
                                                                    onChange={(e) => handleNewItemChange(catIndex, 'name', e.target.value)}
                                                                />
                                                                <input 
                                                                    placeholder={t.pricePlaceholder} 
                                                                    className="w-24 p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none shadow-sm text-right"
                                                                    value={newItemStates[catIndex]?.price || ''}
                                                                    onChange={(e) => handleNewItemChange(catIndex, 'price', e.target.value)}
                                                                />
                                                            </div>
                                                            <input 
                                                                placeholder={t.descPlaceholder}
                                                                className="w-full p-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 outline-none shadow-sm text-slate-600"
                                                                value={newItemStates[catIndex]?.description || ''}
                                                                onChange={(e) => handleNewItemChange(catIndex, 'description', e.target.value)}
                                                            />
                                                        </div>
                                                        
                                                        <div className="flex flex-col gap-2">
                                                            {/* Image Upload Button */}
                                                            <div className="relative">
                                                                <input 
                                                                    type="file" 
                                                                    accept="image/*" 
                                                                    className="hidden" 
                                                                    ref={(el) => { fileInputRefs.current[catIndex] = el; }}
                                                                    onChange={(e) => handleImageUpload(e, catIndex)}
                                                                />
                                                                <button 
                                                                    onClick={() => fileInputRefs.current[catIndex]?.click()}
                                                                    className={`w-10 h-10 border rounded-lg flex items-center justify-center transition-colors ${newItemStates[catIndex]?.image ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
                                                                    title="Upload Image"
                                                                >
                                                                    <ImageIcon size={18} />
                                                                </button>
                                                            </div>
                                                            {/* AI Image */}
                                                            <button 
                                                                onClick={() => handleGenerateAIImage(catIndex)}
                                                                disabled={!newItemStates[catIndex]?.name || generatingImages[catIndex]}
                                                                className={`w-10 h-10 border rounded-lg flex items-center justify-center transition-colors ${generatingImages[catIndex] ? 'bg-purple-100 border-purple-300' : 'bg-white border-purple-200 text-purple-600 hover:bg-purple-50'}`}
                                                                title={t.genImage}
                                                            >
                                                                {generatingImages[catIndex] ? (
                                                                    <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                                                                ) : (
                                                                    <Sparkles size={18} />
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="flex gap-3 items-center">
                                                        <button 
                                                            onClick={() => handleGenerateDescription(catIndex)}
                                                            disabled={!newItemStates[catIndex]?.name || generatingDesc[catIndex]}
                                                            className={`text-xs font-bold flex items-center gap-1 transition-colors px-2 py-1 rounded ${generatingDesc[catIndex] ? 'text-indigo-400' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                                        >
                                                            {generatingDesc[catIndex] ? 'Writing...' : <><Wand2 size={12}/> {t.aiDesc}</>}
                                                        </button>

                                                        {newItemStates[catIndex]?.image && (
                                                            <div className="flex items-center gap-1 bg-white px-2 py-1 border rounded-md border-slate-200">
                                                                <img src={newItemStates[catIndex]?.image} alt="Preview" className="w-4 h-4 object-cover rounded" />
                                                                <button onClick={() => handleNewItemChange(catIndex, 'image', '')} className="text-slate-400 hover:text-red-500"><X size={12}/></button>
                                                            </div>
                                                        )}

                                                        <div className="flex-1"></div>
                                                        
                                                        <button 
                                                            onClick={() => addItem(catIndex)}
                                                            disabled={!newItemStates[catIndex]?.name || !newItemStates[catIndex]?.price}
                                                            className="bg-slate-900 text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-1"
                                                        >
                                                            <Plus size={16} /> {t.addProduct}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </section>
                            );
                        })}

                        {/* Add Category Section */}
                        <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-slate-400 transition-colors">
                            <h3 className="text-slate-600 font-bold mb-3">{t.addSection}</h3>
                            <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                                <input 
                                    type="text" 
                                    placeholder={t.sectionPlaceholder}
                                    className="flex-1 p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none"
                                    value={newCategoryName}
                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addCategory()}
                                />
                                <button 
                                    onClick={addCategory}
                                    className="bg-white text-slate-800 border border-slate-200 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 shadow-sm"
                                    >
                                    <Plus size={18} />
                                </button>
                                <button 
                                    onClick={addSpecialsCategory}
                                    className="bg-amber-100 text-amber-700 border border-amber-200 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-1 hover:bg-amber-200 transition-colors shadow-sm"
                                    title="Add a dedicated Specials section"
                                >
                                    <Star size={18} fill="currentColor" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>

        {/* --- Preview Column --- */}
        <div className={`w-full lg:w-[420px] xl:w-[480px] bg-slate-100 border-l border-slate-200 flex-shrink-0 flex flex-col ${mobileView === 'edit' ? 'hidden lg:flex' : 'flex'}`}>
            <div className="flex-1 p-6 lg:p-8 flex flex-col overflow-hidden relative">
                
                {/* Device Frame */}
                <div className="mx-auto w-full h-full max-w-[380px] flex flex-col">
                    <div className="text-center mb-4 opacity-50 text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                        <LayoutGrid size={12} /> Live Preview
                    </div>
                    
                    <div className="flex-1 bg-white rounded-[3rem] shadow-2xl border-[8px] border-slate-800 relative overflow-hidden ring-1 ring-slate-900/5">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-6 bg-slate-800 rounded-b-xl z-20 pointer-events-none"></div>
                        <MenuViewer menuProp={menu} />
                    </div>
                </div>

            </div>
        </div>
      </div>
    </div>
  );
};

export default MenuEditor;