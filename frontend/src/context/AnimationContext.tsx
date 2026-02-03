import React, { createContext, useContext, useEffect, useState } from 'react';
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth';

interface AnimationContextType {
    isAnimationEnabled: boolean;
    toggleAnimation: () => void;
}

const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

export function AnimationProvider({ children }: { children: React.ReactNode }) {
    const [isAnimationEnabled, setIsAnimationEnabled] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const auth = getAuth();

    // Monitor Auth State to ensure we have the correct user
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });
        return () => unsubscribe();
    }, [auth]);

    // Load preference when user changes
    useEffect(() => {
        if (user?.uid) {
            const prefKey = `anim_pref_${user.uid}`;
            const stored = localStorage.getItem(prefKey);
            
            if (stored !== null) {
                const shouldBeEnabled = stored === 'true';
                // Only update if different to avoid cascade render lint/issues
                if (isAnimationEnabled !== shouldBeEnabled) {
                    setIsAnimationEnabled(shouldBeEnabled);
                }
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const toggleAnimation = () => {
        if (!user?.uid) return;
        const newState = !isAnimationEnabled;
        setIsAnimationEnabled(newState);
        localStorage.setItem(`anim_pref_${user.uid}`, String(newState));
    };

    return (
        <AnimationContext.Provider value={{ isAnimationEnabled, toggleAnimation }}>
            {children}
        </AnimationContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnimation() {
    const context = useContext(AnimationContext);
    if (context === undefined) {
        throw new Error('useAnimation must be used within an AnimationProvider');
    }
    return context;
}
