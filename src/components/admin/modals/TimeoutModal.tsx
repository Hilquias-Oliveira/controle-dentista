import React from 'react';
import { Clock } from 'lucide-react';

interface TimeoutModalProps {
    isOpen: boolean;
    onConfirmLogout: () => void;
    onContinue: () => void;
}

const TimeoutModal: React.FC<TimeoutModalProps> = ({ isOpen, onConfirmLogout, onContinue }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-scale-in">
                <div className="mb-4 text-orange-500 flex justify-center">
                    <Clock size={48} />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Sessão Expirada</h2>
                <p className="text-gray-500 mb-6">Sua sessão foi encerrada por inatividade. Deseja continuar logado?</p>

                <div className="flex gap-3">
                    <button
                        onClick={onConfirmLogout}
                        className="flex-1 py-2.5 border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors"
                    >
                        Sair
                    </button>
                    <button
                        onClick={onContinue}
                        className="flex-1 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TimeoutModal;
