import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Edit2, X } from 'lucide-react';
import { Appointment, Unit, Service } from '../../../types';

interface AppointmentEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    apptToEdit: Appointment | null;
    unitsList: Unit[];
    servicesList: Service[];
}

const AppointmentEditModal: React.FC<AppointmentEditModalProps> = ({ isOpen, onClose, apptToEdit, unitsList = [], servicesList = [] }) => {
    const [form, setForm] = useState({
        clinicId: '',
        serviceId: '',
        date: '',
        time: ''
    });

    useEffect(() => {
        if (apptToEdit) {
            setForm({
                clinicId: apptToEdit.clinicId || '',
                serviceId: '', // Ideally we should have serviceId in Appointment type, but it seems missing or named serviceName.
                // Looking at legacy code: serviceId seems to be stored but not in my interface yet.
                // Actually the legacy code used apptToEdit.serviceId. I should add it to interface or check if it exists.
                // For now, I'll rely on what's in Firestore. I'll update interface to include serviceId.
                date: apptToEdit.date || '',
                time: apptToEdit.time || ''
            });
            // If serviceId is missing in apptToEdit (legacy data), we might not be able to pre-fill it easily without finding by name.
            // But let's assume it's there as 'any' for now or update type.
            if ((apptToEdit as any).serviceId) {
                setForm(prev => ({ ...prev, serviceId: (apptToEdit as any).serviceId }));
            }
        }
    }, [apptToEdit, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apptToEdit) return;

        try {
            // Find names for display update
            const selectedUnit = unitsList.find(u => u.id === form.clinicId);
            const selectedService = servicesList.find(s => s.id === form.serviceId);

            const updateData: any = {
                clinicId: form.clinicId,
                clinicName: selectedUnit ? selectedUnit.name : apptToEdit.clinicName,
                serviceName: selectedService ? selectedService.name : apptToEdit.serviceName,
                date: form.date,
                time: form.time
            };

            if (form.serviceId) {
                updateData.serviceId = form.serviceId;
            }

            await updateDoc(doc(db, "appointments", apptToEdit.id), updateData);
            toast.success("Agendamento atualizado com sucesso!");
            onClose();
        } catch (error) {
            console.error("Error updating appointment:", error);
            toast.error("Erro ao atualizar agendamento.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in overflow-hidden">
                <div className="bg-teal-700 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2">
                        <Edit2 size={20} /> Editar Agendamento
                    </h3>
                    <button onClick={onClose} className="hover:bg-teal-600 p-1 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Unidade</label>
                        <select
                            value={form.clinicId}
                            onChange={(e) => setForm({ ...form, clinicId: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                        >
                            <option value="">Selecione a Unidade</option>
                            {unitsList.map(unit => (
                                <option key={unit.id} value={unit.id}>{unit.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Procedimento</label>
                        <select
                            value={form.serviceId}
                            onChange={(e) => setForm({ ...form, serviceId: e.target.value })}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                        >
                            <option value="">Selecione o Procedimento</option>
                            {servicesList.map(service => (
                                <option key={service.id} value={service.id}>{service.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Data</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={(e) => setForm({ ...form, date: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Hora</label>
                            <input
                                type="time"
                                value={form.time}
                                onChange={(e) => setForm({ ...form, time: e.target.value })}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                            />
                        </div>
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
                            className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200"
                        >
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AppointmentEditModal;
