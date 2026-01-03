import React from 'react';
import { MessageCircle } from 'lucide-react';

const FloatingWhatsApp = () => {
    return (
        <a
            href="https://wa.me/5547999999999?text=Olá,%20gostaria%20de%20agendar%20uma%20consulta."
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
