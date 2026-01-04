import React, { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

const FloatingWhatsApp: React.FC = () => {
    const [whatsappNumber, setWhatsappNumber] = useState('5547999999999'); // Default backup

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, "settings", "global");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists() && docSnap.data().whatsapp) {
                    setWhatsappNumber(docSnap.data().whatsapp);
                }
            } catch (error) {
                console.error("Error fetching WhatsApp number:", error);
            }
        };
        fetchConfig();
    }, []);

    return (
        <a
            href={`https://wa.me/${whatsappNumber}?text=Olá,%20gostaria%20de%20agendar%20uma%20consulta.`}
            target="_blank"
            rel="noopener noreferrer"
            className="fixed bottom-6 right-6 z-50 bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl hover:shadow-green-300 transition-all hover:-translate-y-1 hover:scale-110 flex items-center justify-center animate-bounce-gentle group"
            title="Fale conosco no WhatsApp"
        >
            <MessageCircle size={32} />
            <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 ease-in-out whitespace-nowrap group-hover:pl-2 font-bold">
                Agendar Agora
            </span>
        </a>
    );
};

export default FloatingWhatsApp;
