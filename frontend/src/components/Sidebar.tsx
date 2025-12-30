import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, getAuthToken } from "../firebase";

interface UserData {
    uid: string;
    email: string;
    name: string;
    picture: string;
    tenant_id: string;
    roles: string[];
}

const menuItems = [
    {
        name: "Início", path: "/", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
        )
    },
    {
        name: "Assistente", path: "/assistant", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.159 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
        )
    },
    {
        name: "Cadastro", path: "/registration", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
            </svg>
        )
    },
    {
        name: "Engenharia", path: "/engineering", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
        )
    },
    {
        name: "Obras PP", path: "/obras-pp", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
            </svg>
        )
    },
    {
        name: "Project Avoidance", path: "/project-avoidance", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
            </svg>
        )
    },
    {
        name: "Control Tower", path: "/control-tower", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
            </svg>
        )
    },
    {
        name: "Planejamento", path: "/planning", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
            </svg>
        )
    },
    {
        name: "BackLog", path: "/backlog", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        )
    },
    {
        name: "Residentes", path: "/residentes", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
        )
    },
    {
        name: "LPU", path: "/lpu", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
        )
    },
    {
        name: "Diário de Obra", path: "/diario", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
            </svg>
        )
    },
    {
        name: "Report", path: "/report", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
        )
    },

    {
        name: "Configurações", path: "/settings", icon: (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.581-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
        )
    },
];

export default function Sidebar() {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [isAnimationEnabled, setIsAnimationEnabled] = useState(true);
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserData = async () => {
            const token = await getAuthToken();
            if (!token) return;

            try {
                const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/me`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                });

                if (response.ok) {
                    const data = await response.json();
                    setUserData(data);
                }
            } catch (error) {
                console.error("Error fetching user data:", error);
            }
        };

        fetchUserData();
    }, []);

    // Load Animation Preference
    useEffect(() => {
        if (userData?.uid) {
            const prefKey = `anim_pref_${userData.uid}`;
            const stored = localStorage.getItem(prefKey);
            // Default to true if not set
            if (stored !== null) {
                // eslint-disable-next-line react-hooks/set-state-in-effect
                setIsAnimationEnabled(stored === 'true');
            }
        }
    }, [userData]);

    // Apply Animation Class
    useEffect(() => {
        if (isAnimationEnabled) {
            document.body.classList.remove('static-background');
        } else {
            document.body.classList.add('static-background');
        }
    }, [isAnimationEnabled]);

    const toggleAnimation = () => {
        if (!userData?.uid) return;
        const newState = !isAnimationEnabled;
        setIsAnimationEnabled(newState);
        localStorage.setItem(`anim_pref_${userData.uid}`, String(newState));
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            localStorage.removeItem("idToken");
            navigate("/login");
        } catch (error) {
            console.error("Logout failed:", error);
        }
    };

    return (
        <nav
            className={`relative flex flex-col h-full transition-all duration-300 ease-in-out ${isCollapsed ? "w-20" : "w-64"
                } bg-white/20 backdrop-blur-xl border-r border-white/30 shadow-2xl`}
        >
            {/* Header / Collapse Button */}
            <div className="flex items-center justify-between p-4 h-20 border-b border-white/10">
                {!isCollapsed && (
                    <div className="flex items-center justify-center w-full">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            xmlSpace="preserve"
                            viewBox="0 0 1677.34 5439.76"
                            className="h-12 w-auto"
                            shapeRendering="geometricPrecision"
                            textRendering="geometricPrecision"
                            imageRendering="optimizeQuality"
                            fillRule="evenodd"
                            clipRule="evenodd"
                        >
                            <defs>
                                <style>{`
                  .str0 {stroke:#727271;stroke-width:7.74;stroke-miterlimit:22.9256}
                  .fil4 {fill:none}
                  .fil3 {fill:#727271}
                  .fil0 {fill:#C5C6C6}
                  .fil2 {fill:#E95229}
                  .fil1 {fill:#FEFEFE}
                  .fil5 {fill:#8E9091;fill-rule:nonzero}
                `}</style>
                            </defs>
                            <g id="Camada_x0020_1">
                                <polygon className="fil0" points="1053.67,197.45 1053.67,4606.23 896.44,4606.23 896.44,197.45 " />
                                <polygon className="fil1 str0" points="190.44,3192.84 190.44,2748.5 638.42,2475.36 190.44,2202.19 190.44,1757.85 1465.2,1757.85 1465.2,2182.15 833.29,2182.15 1286.73,2475.36 1286.73,2482.64 833.29,2775.8 1465.2,2775.8 1465.2,3192.84 " />
                                <polygon className="fil2" points="1179.97,197.45 1179.97,4606.23 1122.43,4606.23 1122.43,197.45 " />
                                <path className="fil3" d="M831.47 4538.63l-3.65 0c-380.6,0 -664.7,-296.85 -664.7,-677.42 0,-280.46 136.6,-469.84 331.43,-577.3l205.81 351.48c-91.08,47.32 -154.82,114.72 -154.82,231.28 0,143.85 125.67,238.55 278.64,238.55l3.65 0c165.71,0 282.25,-98.3 282.25,-238.52 0,-120.22 -65.56,-187.59 -160.22,-240.4l198.46 -351.46c189.38,107.43 344.2,285.9 344.2,602.77 0,353.3 -265.89,661.04 -661.05,661.04l0.01 -0.02z" />
                                <path className="fil1" d="M1273.99 1717.78l-271.36 -227.64c105.66,-138.39 149.31,-296.83 149.31,-446.16 0,-76.48 -19.99,-109.27 -54.62,-109.27l-3.61 0c-36.44,0 -56.48,40.07 -83.8,176.64 -58.24,285.91 -140.23,537.24 -409.72,537.24l-3.65 0c-242.21,0 -429.79,-189.4 -429.79,-540.87 0,-245.83 58.29,-427.93 174.83,-575.45l287.74 207.6c-87.41,120.17 -125.66,264.06 -125.66,382.41 0,63.75 21.85,92.88 52.82,92.88l3.63 0c34.58,0 56.44,-34.6 81.95,-169.35 60.09,-325.97 154.79,-544.52 411.55,-544.52l3.66 0c267.69,0 431.61,220.38 431.61,562.73 0,258.6 -72.85,491.69 -214.9,653.77l0.01 -0z" />
                                <path className="fil4 str0" d="M1273.99 1717.78l-271.36 -227.64c105.66,-138.39 149.31,-296.83 149.31,-446.16 0,-76.48 -19.99,-109.27 -54.62,-109.27l-3.61 0c-36.44,0 -56.48,40.07 -83.8,176.64 -58.24,285.91 -140.23,537.24 -409.72,537.24l-3.65 0c-242.21,0 -429.79,-189.4 -429.79,-540.87 0,-245.83 58.29,-427.93 174.83,-575.45l287.74 207.6c-87.41,120.17 -125.66,264.06 -125.66,382.41 0,63.75 21.85,92.88 52.82,92.88l3.63 0c34.58,0 56.44,-34.6 81.95,-169.35 60.09,-325.97 154.79,-544.52 411.55,-544.52l3.66 0c267.69,0 431.61,220.38 431.61,562.73 0,258.6 -72.85,491.69 -214.9,653.77l0.01 -0z" />
                                <polygon className="fil2" points="359.45,197.45 166.76,197.45 166.76,390.15 359.45,390.15 " />
                                <rect className="fil4" width="1677.34" height="5439.76" />
                                <path className="fil5" d="M237.07 5244.45c0,21.07 -4.41,39.62 -13.24,55.67 -8.83,16.05 -21.62,28.54 -38.37,37.47 -16.75,8.93 -36.66,13.39 -59.74,13.39l-75.54 0 0 -212.47 75.54 0c23.07,0 42.98,4.36 59.74,13.09 16.75,8.73 29.54,21.07 38.37,37.02 8.83,15.95 13.24,34.56 13.24,55.82zm-114.96 68.62c22.87,0 40.58,-6.02 53.12,-18.06 12.54,-12.04 18.81,-28.89 18.81,-50.56 0,-21.87 -6.27,-38.82 -18.81,-50.86 -12.54,-12.04 -30.24,-18.06 -53.12,-18.06l-29.49 0 0 137.53 29.49 0zm189.29 -140.84l0 55.07 75.24 0 0 32.5 -75.24 0 0 57.18 84.26 0 0 34.01 -126.7 0 0 -212.47 126.7 0 0 33.71 -84.26 0zm261.52 120.68c0,10.83 -2.71,20.81 -8.13,29.94 -5.42,9.13 -13.44,16.45 -24.07,21.97 -10.63,5.52 -23.57,8.28 -38.82,8.28 -15.05,0 -28.49,-2.56 -40.33,-7.67 -11.84,-5.12 -21.32,-12.49 -28.44,-22.12 -7.12,-9.63 -11.19,-20.87 -12.19,-33.71l45.14 0c1,8.63 4.46,15.8 10.38,21.52 5.92,5.72 13.79,8.58 23.62,8.58 8.83,0 15.6,-2.36 20.31,-7.07 4.71,-4.71 7.07,-10.78 7.07,-18.21 0,-6.62 -1.91,-12.09 -5.72,-16.4 -3.81,-4.31 -8.63,-7.78 -14.44,-10.38 -5.82,-2.61 -13.84,-5.62 -24.07,-9.03 -13.24,-4.41 -24.08,-8.78 -32.5,-13.09 -8.43,-4.31 -15.6,-10.58 -21.52,-18.81 -5.92,-8.22 -8.88,-18.96 -8.88,-32.2 0,-18.26 6.57,-32.65 19.71,-43.18 13.14,-10.53 30.55,-15.8 52.21,-15.8 22.47,0 40.38,5.42 53.72,16.25 13.34,10.84 20.91,25.28 22.72,43.34l-45.74 0c-1.2,-7.62 -4.41,-13.89 -9.63,-18.81 -5.22,-4.92 -12.34,-7.37 -21.37,-7.37 -7.83,0 -14.15,2.06 -18.96,6.17 -4.82,4.11 -7.22,10.08 -7.22,17.91 0,6.22 1.86,11.38 5.57,15.5 3.71,4.11 8.43,7.47 14.14,10.08 5.72,2.61 13.49,5.52 23.32,8.73 13.64,4.82 24.73,9.33 33.25,13.54 8.53,4.21 15.8,10.53 21.82,18.96 6.02,8.43 9.03,19.46 9.03,33.1zm218.18 -48.45c0,21.07 -4.41,39.62 -13.24,55.67 -8.83,16.05 -21.62,28.54 -38.37,37.47 -16.75,8.93 -36.66,13.39 -59.74,13.39l-75.54 0 0 -212.47 75.54 0c23.07,0 42.98,4.36 59.74,13.09 16.75,8.73 29.54,21.07 38.37,37.02 8.83,15.95 13.24,34.56 13.24,55.82zm-114.96 68.62c22.87,0 40.58,-6.02 53.12,-18.06 12.54,-12.04 18.81,-28.89 18.81,-50.56 0,-21.87 -6.27,-38.82 -18.81,-50.86 -12.54,-12.04 -30.24,-18.06 -53.12,-18.06l-29.49 0 0 137.53 29.49 0zm189.29 -140.84l0 55.07 75.24 0 0 32.5 -75.24 0 0 57.18 84.26 0 0 34.01 -126.7 0 0 -212.47 126.7 0 0 33.71 -84.26 0zm165.52 6.02l0 -39.73 76.44 0 0 212.47 -44.54 0 0 -172.74 -31.9 0zm154.69 109.54c3.21,20.86 14.04,31.3 32.5,31.3 14.04,0 24.18,-6.17 30.4,-18.51 6.22,-12.34 8.93,-31.65 8.13,-57.93 -3.21,9.63 -9.48,17.3 -18.81,23.02 -9.33,5.72 -20.21,8.58 -32.65,8.58 -20.46,0 -36.56,-6.17 -48.3,-18.51 -11.74,-12.34 -17.61,-29.84 -17.61,-52.51 0,-13.84 2.81,-26.23 8.43,-37.17 5.62,-10.94 14,-19.51 25.13,-25.73 11.14,-6.22 24.63,-9.33 40.48,-9.33 30.9,0 52.16,9.38 63.8,28.14 11.64,18.76 17.45,44.79 17.45,78.09 0,37.92 -5.87,66.71 -17.6,86.37 -11.74,19.66 -31.35,29.49 -58.83,29.49 -14.65,0 -27.24,-2.91 -37.77,-8.73 -10.53,-5.82 -18.66,-13.69 -24.38,-23.62 -5.72,-9.93 -9.08,-20.91 -10.08,-32.95l39.73 0zm67.41 -81.56c0,-11.23 -3.26,-20.51 -9.78,-27.84 -6.52,-7.32 -16.1,-10.99 -28.74,-10.99 -10.83,0 -19.46,3.21 -25.88,9.63 -6.42,6.42 -9.63,15.35 -9.63,26.78 0,12.04 3.26,21.32 9.78,27.84 6.52,6.52 15.3,9.78 26.33,9.78 10.23,0 19.11,-3.06 26.63,-9.18 7.52,-6.12 11.29,-14.8 11.29,-26.03zm114.36 81.56c3.21,20.86 14.04,31.3 32.5,31.3 14.04,0 24.18,-6.17 30.4,-18.51 6.22,-12.34 8.93,-31.65 8.13,-57.93 -3.21,9.63 -9.48,17.3 -18.81,23.02 -9.33,5.72 -20.21,8.58 -32.65,8.58 -20.46,0 -36.56,-6.17 -48.3,-18.51 -11.74,-12.34 -17.61,-29.84 -17.61,-52.51 0,-13.84 2.81,-26.23 8.43,-37.17 5.62,-10.94 14,-19.51 25.13,-25.73 11.14,-6.22 24.63,-9.33 40.48,-9.33 30.9,0 52.16,9.38 63.8,28.14 11.64,18.76 17.45,44.79 17.45,78.09 0,37.92 -5.87,66.71 -17.6,86.37 -11.74,19.66 -31.35,29.49 -58.83,29.49 -14.65,0 -27.24,-2.91 -37.77,-8.73 -10.53,-5.82 -18.66,-13.69 -24.38,-23.62 -5.72,-9.93 -9.08,-20.91 -10.08,-32.95l39.73 0zm67.41 -81.56c0,-11.23 -3.26,-20.51 -9.78,-27.84 -6.52,-7.32 -16.1,-10.99 -28.74,-10.99 -10.83,0 -19.46,3.21 -25.88,9.63 -6.42,6.42 -9.63,15.35 -9.63,26.78 0,12.04 3.26,21.32 9.78,27.84 6.52,6.52 15.3,9.78 26.33,9.78 10.23,0 19.11,-3.06 26.63,-9.18 7.52,-6.12 11.29,-14.8 11.29,-26.03zm66.51 111.35c68.01,-47.15 102.02,-86.27 102.02,-117.37 0,-9.43 -2.26,-16.85 -6.77,-22.27 -4.51,-5.42 -11.59,-8.13 -21.22,-8.13 -19.86,0 -30.4,13.54 -31.6,40.63l-41.23 0c1.2,-25.08 8.83,-44.09 22.87,-57.03 14.04,-12.94 31.8,-19.41 53.27,-19.41 21.87,0 38.67,5.67 50.41,17 11.74,11.33 17.61,26.43 17.61,45.29 0,14.85 -4.36,29.74 -13.09,44.69 -8.73,14.95 -19.81,28.69 -33.25,41.23 -13.44,12.54 -27.59,23.32 -42.43,32.35l92.99 0 0 34.61 -149.57 0 0 -31.6z" />
                            </g>
                        </svg>
                    </div>
                )}
                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="p-2 rounded-lg hover:bg-white/30 text-gray-700 transition-colors"
                >
                    {isCollapsed ? (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center px-4 py-3 mx-2 rounded-xl transition-all duration-200 group ${isActive
                                ? "bg-white/40 text-gray-900 shadow-sm"
                                : "text-gray-600 hover:bg-white/20 hover:text-gray-900"
                                }`}
                        >
                            <span className={`${isActive ? "text-blue-600" : "text-gray-500 group-hover:text-gray-700"}`}>
                                {item.icon}
                            </span>
                            {!isCollapsed && (
                                <span className="ml-3 font-medium">{item.name}</span>
                            )}
                        </Link>
                    );
                })}
            </div>

            {/* Footer / User / Logout */}
            <div className="p-4 border-t border-white/10">
                <div className={`flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}>
                    {!isCollapsed && (
                        <div className="flex items-center space-x-3 overflow-hidden">
                            {userData?.picture ? (
                                <img
                                    src={userData.picture}
                                    alt="Profile"
                                    className="h-10 w-10 rounded-full shadow-md"
                                />
                            ) : (
                                <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold shadow-md">
                                    {userData?.name?.charAt(0) || "U"}
                                </div>
                            )}
                            <div className="flex flex-col truncate">
                                <span className="text-sm font-semibold text-gray-900 truncate">{userData?.name || "Usuário"}</span>
                                <span className="text-xs text-gray-500 truncate">{userData?.email || "Carregando..."}</span>
                            </div>
                        </div>
                    )}

                    {!isCollapsed && (
                        <button
                            onClick={toggleAnimation}
                            className="p-2 rounded-lg hover:bg-white/30 text-gray-600 hover:text-blue-600 transition-colors mr-2"
                            title={isAnimationEnabled ? "Desativar Animação" : "Ativar Animação"}
                        >
                            {isAnimationEnabled ? (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M9 4.5a.75.75 0 01.721.544l.813 2.846a3.75 3.75 0 002.576 2.576l2.846.813a.75.75 0 010 1.442l-2.846.813a3.75 3.75 0 00-2.576 2.576l-.813 2.846a.75.75 0 01-1.442 0l-.813-2.846a3.75 3.75 0 00-2.576-2.576l-2.846-.813a.75.75 0 010-1.442l2.846-.813a3.75 3.75 0 002.576-2.576L8.279 5.044A.75.75 0 019 4.5zM18 1.5a.75.75 0 01.728.568l.258 1.036c.236.94.97 1.674 1.91 1.91l1.036.258a.75.75 0 010 1.456l-1.036.258c-.94.236-1.674.97-1.91 1.91l-.258 1.036a.75.75 0 01-1.456 0l-.258-1.036a2.625 2.625 0 00-1.91-1.91l-1.036-.258a.75.75 0 010-1.456l1.036-.258a2.625 2.625 0 001.91-1.91l.258-1.036A.75.75 0 0118 1.5zM16.5 15a.75.75 0 01.712.513l.394 1.183c.15.447.5.799.948.948l1.183.395a.75.75 0 010 1.422l-1.183.395c-.447.15-.799.5-.948.948l-.395 1.183a.75.75 0 01-1.422 0l-.395-1.183a1.5 1.5 0 00-.948-.948l-1.183-.395a.75.75 0 010-1.422l1.183-.395c.447-.15.799-.5.948-.948l.395-1.183A.75.75 0 0116.5 15z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                                </svg>
                            )}
                        </button>
                    )}

                    <button
                        onClick={handleLogout}
                        className={`p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors ${isCollapsed ? "" : "ml-2"}`}
                        title="Sair"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                    </button>
                </div>
            </div>
        </nav>
    );
}
