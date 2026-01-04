import React from 'react';
import { Clock, Edit2 } from 'lucide-react';
import { Appointment } from '../../../types';

interface ConflictData {
    targetApp: Appointment;
    conflictingApp: Appointment;
    suggestion?: string;
}

interface ConflictModalProps {
    isOpen: boolean;
    onClose: () => void;
    conflictData: ConflictData | null;
    onResolve: (action: 'force' | 'suggest') => void;
    onEditManual: (app: Appointment) => void;
}

const ConflictModal: React.FC<ConflictModalProps> = ({ isOpen, onClose, conflictData, onResolve, onEditManual }) => {
    if (!isOpen || !conflictData) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                <div className="bg-amber-100 p-6 flex flex-col items-center text-center border-b border-amber-200">
                    <div className="p-3 bg-amber-500 text-white rounded-full mb-3 shadow-lg shadow-amber-200/50">
                        <Clock size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-amber-900">Conflito de Horário!</h3>
                    <p className="text-amber-800 mt-2 text-sm leading-relaxed">
                        O horário <span className="font-bold">{conflictData.targetApp?.time}</span> já está ocupado por <br />
                        <strong>{conflictData.conflictingApp?.clientName}</strong> ({conflictData.conflictingApp?.time}).
                    </p>
                </div>

                <div className="p-6 space-y-4">
                    {conflictData.suggestion ? (
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">Sugestão</p>
                                <p className="text-lg font-bold text-green-900 flex items-center gap-2">
                                    <Clock size={18} /> {conflictData.suggestion}
                                </p>
                            </div>
                            <button
                                onClick={() => onResolve('suggest')}
                                className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
                            >
                                Aceitar
                            </button>
                        </div>
                    ) : (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center text-gray-500 text-sm">
                            Não encontramos horários livres próximos.
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => onResolve('force')}
                            className="py-3 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors"
                        >
                            Aprovar Mesmo Assim
                        </button>
                        <button
                            onClick={() => onEditManual(conflictData.targetApp)}
                            className="col-span-2 py-3 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                        >
                            <Edit2 size={16} /> Editar Horário Manualmente
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ConflictModal;
