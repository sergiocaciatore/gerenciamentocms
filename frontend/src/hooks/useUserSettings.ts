import { useState, useEffect } from 'react';
import { auth } from '../firebase';

export interface UserSettings {
    showGoLiveWidget: boolean;
    widgetName?: string; // Future proofing as user asked to "set the name" too? 
    // "colocar o nome desse botão e o toggle" -> "put the *name of this button* (label) and the toggle" 
    // OR "put the name of the button configuration"?
    // "nome desse botão" usually means the label on the button. 
    // "colocar o nome desse botão" could mean "Label: [ Show Go Live Widget ] (Toggle)"
    // I will assume they want a toggle with a label like "Exibir Botão de Próximos Go-Lives".
}

const DEFAULT_SETTINGS: UserSettings = {
    showGoLiveWidget: true
};

export const useUserSettings = () => {
    const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadSettings = () => {
            if (auth.currentUser) {
                const key = `cms_settings_${auth.currentUser.uid}`;
                const saved = localStorage.getItem(key);
                if (saved) {
                    try {
                        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
                    } catch (e) {
                        console.error("Failed to parse settings", e);
                    }
                }
            } else {
                setSettings(DEFAULT_SETTINGS);
            }
            setLoading(false);
        };

        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) {
                loadSettings();
            } else {
                setSettings(DEFAULT_SETTINGS);
                setLoading(false);
            }
        });

        const handleStorageUpdate = (e: StorageEvent) => {
            if (e.key && e.key.startsWith('cms_settings_')) {
                loadSettings();
            }
        };

        const handleCustomUpdate = () => {
            loadSettings();
        };

        window.addEventListener('storage', handleStorageUpdate);
        window.addEventListener('settings_updated', handleCustomUpdate);

        return () => {
            unsubscribe();
            window.removeEventListener('storage', handleStorageUpdate);
            window.removeEventListener('settings_updated', handleCustomUpdate);
        };
    }, []);


    const updateSetting = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
        if (!auth.currentUser) return;

        setSettings(prev => {
            const newSettings = { ...prev, [key]: value };
            localStorage.setItem(`cms_settings_${auth.currentUser?.uid}`, JSON.stringify(newSettings));
            // Dispatch a custom event so other components update immediately if they listen
            window.dispatchEvent(new Event('settings_updated'));
            return newSettings;
        });
    };

    return { settings, updateSetting, loading };
};
