import { RestaurantMenu } from "../types";
import { db } from "./firebase";
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";

const STORAGE_KEY = 'flashmenu_db_v1';

const saveMenuLocally = (menu: RestaurantMenu) => {
  try {
    const existingData = localStorage.getItem(STORAGE_KEY);
    const menus: Record<string, RestaurantMenu> = existingData ? JSON.parse(existingData) : {};
    menus[menu.id] = menu;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));
  } catch (e) {
    console.warn("LocalStorage save failed", e);
  }
};

export const saveMenu = async (menu: RestaurantMenu): Promise<void> => {
  // Optimistic update: save locally first
  saveMenuLocally(menu);

  // Sync to Firestore if available
  if (db) {
    try {
      await setDoc(doc(db, "menus", menu.id), menu);
    } catch (e) {
      console.error("Firestore save failed", e);
    }
  }
};

export const getMenu = async (id: string): Promise<RestaurantMenu | null> => {
  // 1. Try Firestore first
  if (db) {
    try {
      const docRef = doc(db, "menus", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const menu = docSnap.data() as RestaurantMenu;
        saveMenuLocally(menu); 
        return menu;
      }
    } catch (e) {
      console.warn("Firestore access failed or offline. Using local backup.", e);
    }
  }

  // 2. Fallback to LocalStorage
  const existingData = localStorage.getItem(STORAGE_KEY);
  if (!existingData) return null;
  const menus: Record<string, RestaurantMenu> = JSON.parse(existingData);
  return menus[id] || null;
};

// New function to support public slug URLs
export const getMenuBySlug = async (slug: string): Promise<RestaurantMenu | null> => {
    if (db) {
        try {
            const q = query(collection(db, "menus"), where("slug", "==", slug));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
                return querySnapshot.docs[0].data() as RestaurantMenu;
            }
        } catch (e) {
            console.error("Error fetching by slug", e);
        }
    }
    
    // Fallback to local search
    const existingData = localStorage.getItem(STORAGE_KEY);
    if (existingData) {
        const menus: Record<string, RestaurantMenu> = JSON.parse(existingData);
        return Object.values(menus).find(m => m.slug === slug) || null;
    }
    
    return null;
};

export const isSlugAvailable = async (slug: string): Promise<boolean> => {
    if (!db) return true; // Can't check
    const q = query(collection(db, "menus"), where("slug", "==", slug));
    const snapshot = await getDocs(q);
    return snapshot.empty;
};