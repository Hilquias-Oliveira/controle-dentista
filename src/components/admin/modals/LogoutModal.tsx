import React from 'react';
import { LogOut } from 'lucide-react';

interface LogoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const LogoutModal: React.FC<LogoutModalProps> = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-scale-in">
                <div className="mb-4 text-gray-900 flex justify-center">
                    <div className="p-3 bg-red-50 rounded-full text-red-500">
                        <LogOut size={32} />
                    </div>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Sair da conta?</h2>
                <p className="text-sm text-gray-500 mb-6">Você precisará fazer login novamente para acessar o painel administrativo.</p>

                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                    >
                        Sair
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LogoutModal;
