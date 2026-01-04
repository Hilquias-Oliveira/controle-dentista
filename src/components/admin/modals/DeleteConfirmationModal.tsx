import React from 'react';
import { Trash2, X, AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: React.ReactNode;
}

const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up border border-red-100">
                <div className="bg-red-50 p-6 flex justify-between items-center border-b border-red-100">
                    <h3 className="text-xl font-bold text-red-700 flex items-center gap-2">
                        <div className="bg-red-100 p-2 rounded-full">
                            <Trash2 size={24} className="text-red-600" />
                        </div>
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 hover:bg-white/50 p-2 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6">
                    <div className="flex gap-4 items-start">
                        <div className="bg-yellow-50 p-3 rounded-xl border border-yellow-100 hidden sm:block">
                            <AlertTriangle className="text-yellow-600" size={24} />
                        </div>
                        <div>
                            <p className="text-gray-600 leading-relaxed text-lg">
                                {message}
                            </p>
                            <p className="text-sm text-gray-400 mt-2 font-medium">
                                Esta ação não pode ser desfeita.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-50 bg-gray-50/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-bold hover:bg-white hover:border-gray-300 transition-all shadow-sm"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                    >
                        <Trash2 size={18} />
                        Confirmar Exclusão
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmationModal;
