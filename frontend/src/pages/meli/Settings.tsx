import { useUserSettings } from "../../hooks/useUserSettings";

export default function Settings() {
    const { settings, updateSetting, loading } = useUserSettings();

    if (loading) return (
        <div className="relative min-h-full w-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
    );

    return (
        <div className="relative min-h-full w-full flex flex-col lg:flex-row items-start font-sans text-gray-900">
            <div className="flex-1 w-full px-4 lg:px-8 py-8 min-w-0 order-2 lg:order-1 flex flex-col">
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-3xl font-bold text-gray-900 mb-8">Configurações</h1>

            <div className="space-y-6">
                <div className="bg-white/40 backdrop-blur-xl rounded-2xl p-6 border border-white/50 shadow-sm">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                        Interface
                    </h2>

                    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0 hover:bg-white/30 rounded-lg px-2 transition-colors">
                        <div>
                            <p className="font-medium text-gray-900">Exibir Botão de Próximos Go-Lives</p>
                            <p className="text-sm text-gray-500">Mostra um widget flutuante no canto da tela com os próximos lançamentos.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={settings.showGoLiveWidget}
                                onChange={(e) => updateSetting('showGoLiveWidget', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                        </label>
                    </div>
                </div>
            </div>
                </div>
            </div>
        </div>
    );
}
