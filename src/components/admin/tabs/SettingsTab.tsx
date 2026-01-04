import React, { useState, useEffect } from 'react';
import { Settings, Loader2, Phone, Check } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { UserProfile } from '../../../types';

interface SettingsTabProps {
    userProfile: UserProfile;
}

const SettingsTab: React.FC<SettingsTabProps> = ({ userProfile }) => {
    const [siteConfig, setSiteConfig] = useState<{ whatsapp: string }>({ whatsapp: '' });
    const [settingsLoading, setSettingsLoading] = useState(false);
    const [loadingData, setLoadingData] = useState(true);

    // Fetch Site Config (Floating WhatsApp)
    useEffect(() => {
        if (!['gm', 'admin'].includes(userProfile?.role)) return;
        const fetchConfig = async () => {
            setLoadingData(true);
            try {
                const docRef = doc(db, "settings", "global");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSiteConfig(docSnap.data() as { whatsapp: string });
                } else {
                    // Create default if not exists
                    const defaultConfig = { whatsapp: '5547999999999' };
                    await setDoc(docRef, defaultConfig);
                    setSiteConfig(defaultConfig);
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
                toast.error("Erro ao carregar configurações.");
            } finally {
                setLoadingData(false);
            }
        };
        fetchConfig();
    }, [userProfile]);

    const handleSaveConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setSettingsLoading(true);
        try {
            await setDoc(doc(db, "settings", "global"), siteConfig, { merge: true });
            toast.success("Configurações do site salvas!");
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Erro ao salvar configurações.");
        } finally {
            setSettingsLoading(false);
        }
    };

    if (!['gm', 'admin'].includes(userProfile?.role)) return null;

    if (loadingData) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin text-teal-600" size={32} />
            </div>
        );
    }

    return (
        <div className="animate-fade-in-up max-w-2xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                    <div className="bg-gray-100 p-2 rounded-lg text-gray-600"><Settings size={20} /></div>
                    Configurações do Site
                </h2>

                <form onSubmit={handleSaveConfig} className="space-y-6">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">WhatsApp do Botão Flutuante</label>
                        <p className="text-sm text-gray-500 mb-3">Este é o número que será aberto quando os visitantes clicarem no botão de WhatsApp do site.</p>
                        <div className="relative">
                            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={siteConfig.whatsapp}
                                onChange={(e) => setSiteConfig({ ...siteConfig, whatsapp: e.target.value })}
                                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-medium text-gray-700"
                                placeholder="Ex: 5547999999999"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Dica: Use 55 + DDD + Número (apenas números).</p>
                    </div>

                    <button
                        type="submit"
                        disabled={settingsLoading}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-teal-200 flex items-center justify-center gap-2"
                    >
                        {settingsLoading ? <Loader2 className="animate-spin" size={20} /> : <><Check size={20} /> Salvar Configurações</>}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SettingsTab;
