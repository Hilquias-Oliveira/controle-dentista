import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { toast } from 'sonner';
import { X, Sparkles } from 'lucide-react';
import { Service, Unit } from '../../../types';

interface ServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    serviceToEdit: Service | null;
    unitsList: Unit[];
    onSave?: () => void;
}

const ServiceModal: React.FC<ServiceModalProps> = ({ isOpen, onClose, serviceToEdit, unitsList = [], onSave }) => {
    const [form, setForm] = useState({
        name: '',
        price: '',
        duration: 30,
        displayPrice: true,
        description: '',
        allowedUnits: [] as string[]
    });

    useEffect(() => {
        if (serviceToEdit) {
            setForm({
                name: serviceToEdit.name,
                price: serviceToEdit.price.toString(),
                duration: serviceToEdit.duration || 30,
                displayPrice: serviceToEdit.displayPrice !== false,
                description: serviceToEdit.description || '',
                allowedUnits: serviceToEdit.allowedUnits || []
            });
        } else {
            setForm({
                name: '',
                price: '',
                duration: 30,
                displayPrice: true,
                description: '',
                allowedUnits: []
            });
        }
    }, [serviceToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const payload = {
                name: form.name,
                price: parseFloat(form.price) || 0,
                duration: Number(form.duration) || 30,
                displayPrice: form.displayPrice,
                description: form.description || '',
                allowedUnits: form.allowedUnits || []
            };

            if (serviceToEdit?.id) {
                await updateDoc(doc(db, "services", serviceToEdit.id), payload);
                toast.success("Serviço atualizado!");
            } else {
                await addDoc(collection(db, "services"), payload);
                toast.success("Serviço criado!");
            }
            if (onSave) onSave(); // Optional callback
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar serviço.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in overflow-hidden">
                <div className="bg-purple-900 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2">
                        <Sparkles size={20} /> {serviceToEdit ? 'Editar Serviço' : 'Novo Serviço'}
                    </h3>
                    <button onClick={onClose} className="hover:bg-purple-800 p-1 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Serviço</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-purple-500 outline-none transition-colors"
                            placeholder="Ex: Limpeza Dental"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Valor (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={form.price}
                            onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-purple-500 outline-none transition-colors"
                            placeholder="0,00"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Duração (minutos)</label>
                        <select
                            value={form.duration || 30}
                            onChange={e => setForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-purple-500 outline-none bg-white transition-colors"
                        >
                            {[10, 20, 30, 40, 50, 60, 90, 120].map(min => (
                                <option key={min} value={min}>{min} min</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Descrição</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-purple-500 outline-none transition-colors resize-none h-24"
                            placeholder="Descreva o serviço..."
                        />
                    </div>
                    <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <input
                            type="checkbox"
                            checked={form.displayPrice}
                            onChange={e => setForm(prev => ({ ...prev, displayPrice: e.target.checked }))}
                            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                            id="displayPrice"
                        />
                        <label htmlFor="displayPrice" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                            Exibir valor no site?
                            <span className="block text-xs text-gray-400 font-normal">Se desmarcado, aparecerá "Sob Consulta"</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">Disponibilidade nas Unidades</label>
                        <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                            {unitsList.length === 0 ? (
                                <p className="text-xs text-gray-400">Nenhuma unidade cadastrada.</p>
                            ) : (
                                unitsList.map(unit => (
                                    <label key={unit.id} className="flex items-center gap-2 cursor-pointer hover:bg-white p-1 rounded-lg transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={form.allowedUnits.includes(unit.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setForm(prev => ({ ...prev, allowedUnits: [...prev.allowedUnits, unit.id] }));
                                                } else {
                                                    setForm(prev => ({ ...prev, allowedUnits: prev.allowedUnits.filter(id => id !== unit.id) }));
                                                }
                                            }}
                                            className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                        />
                                        <span className="text-sm text-gray-700 flex-1">{unit.name}</span>
                                        {unit.color === 'teal' ? (
                                            <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                                        ) : (
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        )}
                                    </label>
                                ))
                            )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Se nenhuma for selecionada, o serviço aparecerá em todas (modo legado).</p>
                    </div>
                    <div className="pt-4 flex gap-3 border-t border-gray-100 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg shadow-purple-200"
                        >
                            Salvar Serviço
                        </button>
                    </div>
                </form>
            </div>
        </div >
    );
};

export default ServiceModal;
