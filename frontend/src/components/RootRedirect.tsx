import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

export default function RootRedirect() {
    const navigate = useNavigate();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                navigate(`/${user.uid}/dashboard`);
            } else {
                navigate("/login");
            }
            setIsChecking(false);
        });

        return () => unsubscribe();
    }, [navigate]);

    if (isChecking) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-gray-900">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    return null;
}
