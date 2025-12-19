import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { auth, getAuthToken } from "../firebase";
import { signOut } from "firebase/auth";
import type { UserData } from "../types/Home";

export default function Home() {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const handleLogout = useCallback(async () => {
        await signOut(auth);
        localStorage.removeItem("idToken");
        navigate("/login");
    }, [navigate]);

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = await getAuthToken();
                if (!token) {
                    navigate("/login");
                    return;
                }

                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setUserData(data);
                } else {
                    console.error("Failed to fetch user data");
                    handleLogout();
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
                handleLogout();
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [navigate, handleLogout]);

    if (loading) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }

    if (!userData) {
        return null;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-2xl rounded-lg bg-white p-6 shadow">
                <div className="mb-6 flex items-center justify-between">
                    <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                    <button
                        onClick={handleLogout}
                        className="rounded bg-red-500 px-4 py-2 text-sm font-bold text-white hover:bg-red-600"
                    >
                        Sair
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center space-x-4">
                        {userData.picture && (
                            <img
                                src={userData.picture}
                                alt="Profile"
                                className="h-16 w-16 rounded-full"
                            />
                        )}
                        <div>
                            <h2 className="text-xl font-semibold">{userData.name}</h2>
                            <p className="text-gray-600">{userData.email}</p>
                        </div>
                    </div>

                    <div className="mt-6 border-t pt-4">
                        <h3 className="mb-2 text-lg font-medium">Detalhes da Conta</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="block font-medium text-gray-500">UID</span>
                                <span className="break-all">{userData.uid}</span>
                            </div>
                            <div>
                                <span className="block font-medium text-gray-500">Tenant ID</span>
                                <span>{userData.tenant_id}</span>
                            </div>
                            <div>
                                <span className="block font-medium text-gray-500">Roles</span>
                                <span>{userData.roles.join(", ")}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
