import { useEffect, useState } from "react";
import { auth, db } from "../../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function AmazonDashboard() {
    interface AmazonUserData {
        uid: string;
        email: string | null;
        razaoSocial?: string;
        cnpj?: string;
        operation?: string;
        role?: string;
        photoURL?: string | null;
        displayName?: string | null;
    }

    const [user, setUser] = useState<AmazonUserData | null>(null);

    useEffect(() => {
        // Fetch user data again just for display or context if needed, 
        // or we could use a Context/Zustand store. For now, simple fetch.
        const currentUser = auth.currentUser;
        if (currentUser) {
             const fetchUserData = async () => {
                const docRef = doc(db, "users", currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setUser({ ...currentUser, ...docSnap.data() } as AmazonUserData);
                } else {
                    setUser(currentUser as unknown as AmazonUserData);
                }
             };
             fetchUserData();
        }
    }, []);

    return (
        <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h2 className="text-2xl font-semibold mb-4 text-gray-800">Bem-vindo, {user?.razaoSocial || user?.email}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <p><strong>Email:</strong> {user?.email}</p>
                    <p><strong>CNPJ:</strong> {user?.cnpj || "N/A"}</p>
                    <p><strong>Operação:</strong> {user?.operation || "Amazon"}</p>
                    <p><strong>Função:</strong> {user?.role || "Usuário"}</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="font-semibold text-lg text-gray-800 mb-2">Visão Geral</h3>
                    <p className="text-gray-600">Resumo das atividades recentes.</p>
                </div>
                {/* More widgets can go here */}
            </div>
        </div>
    );
}
