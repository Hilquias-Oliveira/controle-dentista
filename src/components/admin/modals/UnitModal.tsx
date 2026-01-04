import React, { useState, useEffect } from 'react';
import { X, MapPin, Loader2 } from 'lucide-react';
import { doc, addDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { formatPhone } from '../../../utils/formatters';
import { Unit } from '../../../types';

interface UnitModalProps {
    isOpen: boolean;
    onClose: () => void;
    unitToEdit: Unit | null;
}

const UnitModal: React.FC<UnitModalProps> = ({ isOpen, onClose, unitToEdit }) => {
    // Default Schedule Structure
    const defaultSchedule = {
        weekly: {
            seg: { active: true, ranges: [{ start: '08:00', end: '18:00' }] },
            ter: { active: true, ranges: [{ start: '08:00', end: '18:00' }] },
            qua: { active: true, ranges: [{ start: '08:00', end: '18:00' }] },
            qui: { active: true, ranges: [{ start: '08:00', end: '18:00' }] },
            sex: { active: true, ranges: [{ start: '08:00', end: '18:00' }] },
            sab: { active: false, ranges: [{ start: '08:00', end: '12:00' }] },
            dom: { active: false, ranges: [{ start: '08:00', end: '12:00' }] }
        },
        exceptions: []
    };

    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        whatsapp: '',
        color: 'teal',
        schedule: JSON.parse(JSON.stringify(defaultSchedule))
    });

    const [activeTab, setActiveTab] = useState<'info' | 'schedule' | 'exceptions'>('info');
    const [loading, setLoading] = useState(false);
    const [newException, setNewException] = useState({
        date: '',
        type: 'closed',
        ranges: [{ start: '08:00', end: '12:00' }]
    });

    // Hydrate form on open
    useEffect(() => {
        if (isOpen) {
            setActiveTab('info');
            if (unitToEdit) {
                // Deep clone schedule
                let schedule = unitToEdit.schedule ? JSON.parse(JSON.stringify(unitToEdit.schedule)) : JSON.parse(JSON.stringify(defaultSchedule));

                // Legacy Data Migration
                if (schedule.weekly) {
                    Object.keys(schedule.weekly).forEach(day => {
                        const dayConfig = schedule.weekly[day];
                        if (!dayConfig.ranges && dayConfig.start && dayConfig.end) {
                            dayConfig.ranges = [{ start: dayConfig.start, end: dayConfig.end }];
                        }
                        if (!dayConfig.ranges) {
                            dayConfig.ranges = [];
                        }
                    });
                }

                setFormData({
                    name: unitToEdit.name || '',
                    address: unitToEdit.address || '',
                    phone: unitToEdit.phone || '',
                    whatsapp: unitToEdit.whatsapp || '',
                    color: unitToEdit.color || 'teal',
                    schedule
                });
            } else {
                setFormData({
                    name: '',
                    address: '',
                    phone: '',
                    whatsapp: '',
                    color: 'teal',
                    schedule: JSON.parse(JSON.stringify(defaultSchedule))
                });
            }
        }
    }, [isOpen, unitToEdit]);


    // --- HELPERS ---
    const toggleDayActive = (day: string) => {
        setFormData(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                weekly: {
                    ...prev.schedule.weekly,
                    [day]: {
                        ...prev.schedule.weekly[day],
                        active: !prev.schedule.weekly[day].active
                    }
                }
            }
        }));
    };

    const updateDayRange = (day: string, index: number, field: 'start' | 'end', value: string) => {
        setFormData(prev => {
            const newRanges = [...prev.schedule.weekly[day].ranges];
            newRanges[index] = { ...newRanges[index], [field]: value };
            return {
                ...prev,
                schedule: {
                    ...prev.schedule,
                    weekly: {
                        ...prev.schedule.weekly,
                        [day]: { ...prev.schedule.weekly[day], ranges: newRanges }
                    }
                }
            };
        });
    };

    const addDayRange = (day: string) => {
        setFormData(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                weekly: {
                    ...prev.schedule.weekly,
                    [day]: {
                        ...prev.schedule.weekly[day],
                        ranges: [...(prev.schedule.weekly[day].ranges || []), { start: '13:00', end: '17:00' }]
                    }
                }
            }
        }));
    };

    const removeDayRange = (day: string, index: number) => {
        setFormData(prev => {
            const newRanges = prev.schedule.weekly[day].ranges.filter((_: any, i: number) => i !== index);
            return {
                ...prev,
                schedule: {
                    ...prev.schedule,
                    weekly: {
                        ...prev.schedule.weekly,
                        [day]: { ...prev.schedule.weekly[day], ranges: newRanges }
                    }
                }
            };
        });
    };

    // Exceptions
    const addException = () => {
        if (!newException.date) return;
        setFormData(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                exceptions: [...(prev.schedule.exceptions || []), newException]
            }
        }));
        setNewException({ date: '', type: 'closed', ranges: [{ start: '08:00', end: '12:00' }] });
    };

    const removeException = (index: number) => {
        setFormData(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                exceptions: prev.schedule.exceptions.filter((_: any, i: number) => i !== index)
            }
        }));
    };

    const addExceptionRange = () => {
        setNewException(prev => ({
            ...prev,
            ranges: [...prev.ranges, { start: '13:00', end: '17:00' }]
        }));
    };

    const removeExceptionRange = (idx: number) => {
        setNewException(prev => ({
            ...prev,
            ranges: prev.ranges.filter((_, i) => i !== idx)
        }));
    };

    const updateExceptionRange = (idx: number, field: string, value: string) => {
        setNewException(prev => {
            const newRanges = [...prev.ranges];
            newRanges[idx] = { ...newRanges[idx], [field]: value };
            return { ...prev, ranges: newRanges };
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (unitToEdit?.id) {
                await updateDoc(doc(db, "units", unitToEdit.id), formData);
                toast.success("Unidade atualizada!");
            } else {
                await addDoc(collection(db, "units"), formData);
                toast.success("Unidade criada!");
            }
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar unidade.");
        } finally {
            setLoading(false);
        }
    };

    const weekDaysOrdered = [
        { key: 'seg', label: 'Segunda-feira' },
        { key: 'ter', label: 'Terça-feira' },
        { key: 'qua', label: 'Quarta-feira' },
        { key: 'qui', label: 'Quinta-feira' },
        { key: 'sex', label: 'Sexta-feira' },
        { key: 'sab', label: 'Sábado' },
        { key: 'dom', label: 'Domingo' }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-teal-900 text-white p-6 shrink-0 flex justify-between items-center">
                    <h2 className="text-xl font-bold font-serif flex items-center gap-2">
                        <MapPin className="text-teal-300" /> {unitToEdit ? 'Editar Unidade' : 'Nova Unidade'}
                    </h2>
                    <button onClick={onClose} className="text-teal-300 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex border-b border-gray-100 shrink-0">
                    <button
                        type="button"
                        onClick={() => setActiveTab('info')}
                        className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${activeTab === 'info' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400 hover:text-teal-600'}`}
                    >
                        Informações
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('schedule')}
                        className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${activeTab === 'schedule' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400 hover:text-teal-600'}`}
                    >
                        Horários
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('exceptions')}
                        className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${activeTab === 'exceptions' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400 hover:text-teal-600'}`}
                    >
                        Pausas & Feriados
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                    {/* --- INFO TAB --- */}
                    {activeTab === 'info' && (
                        <div className="space-y-4 animate-fade-in">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Unidade</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                    placeholder="Ex: Clínica Centro"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Endereço</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.address}
                                    onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                    placeholder="Rua..."
                                />
                            </div>

                            {/* Contact Fields */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Telefone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={e => setFormData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">WhatsApp</label>
                                    <input
                                        type="tel"
                                        value={formData.whatsapp}
                                        onChange={e => setFormData(prev => ({ ...prev, whatsapp: e.target.value.replace(/\D/g, '') }))}
                                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Cor do Tema</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="color"
                                            value="teal"
                                            checked={formData.color === 'teal'}
                                            onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                            className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                                        />
                                        <span className="text-teal-700 font-bold bg-teal-100 px-2 py-1 rounded">Verde/Teal</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="color"
                                            value="blue"
                                            checked={formData.color === 'blue'}
                                            onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                                            className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-blue-700 font-bold bg-blue-100 px-2 py-1 rounded">Azul</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* --- SCHEDULE TAB --- */}
                    {activeTab === 'schedule' && (
                        <div className="space-y-4 animate-fade-in">
                            <p className="text-sm text-gray-500">Defina os turnos de atendimento para cada dia.</p>
                            <div className="space-y-3">
                                {weekDaysOrdered.map(({ key, label }) => {
                                    const dayConfig = formData.schedule.weekly[key];
                                    const ranges = dayConfig.ranges || [];

                                    return (
                                        <div key={key} className={`p-4 rounded-xl border transition-all ${dayConfig.active ? 'border-teal-200 bg-teal-50/50' : 'border-gray-100 bg-gray-50'}`}>
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={dayConfig.active}
                                                        onChange={() => toggleDayActive(key)}
                                                        className="w-5 h-5 rounded text-teal-600 focus:ring-teal-500"
                                                    />
                                                    <span className="font-bold text-gray-700">{label}</span>
                                                </div>
                                                {dayConfig.active && (
                                                    <button
                                                        type="button"
                                                        onClick={() => addDayRange(key)}
                                                        className="text-teal-600 text-sm font-bold hover:underline"
                                                    >
                                                        + Adicionar Turno
                                                    </button>
                                                )}
                                            </div>

                                            {dayConfig.active && (
                                                <div className="space-y-2 pl-8">
                                                    {ranges.map((range, idx) => (
                                                        <div key={idx} className="flex items-center gap-2">
                                                            <input
                                                                type="time"
                                                                value={range.start}
                                                                onChange={e => updateDayRange(key, idx, 'start', e.target.value)}
                                                                className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-teal-500 outline-none"
                                                            />
                                                            <span className="text-gray-400 font-bold">às</span>
                                                            <input
                                                                type="time"
                                                                value={range.end}
                                                                onChange={e => updateDayRange(key, idx, 'end', e.target.value)}
                                                                className="px-2 py-1.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-teal-500 outline-none"
                                                            />
                                                            {ranges.length > 1 && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeDayRange(key, idx)}
                                                                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                >
                                                                    <X size={16} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* --- EXCEPTIONS TAB --- */}
                    {activeTab === 'exceptions' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Nova Exceção</h3>
                                <div className="grid gap-3">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">DATA</label>
                                            <input
                                                type="date"
                                                value={newException.date}
                                                onChange={e => setNewException(prev => ({ ...prev, date: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-teal-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">TIPO</label>
                                            <select
                                                value={newException.type}
                                                onChange={e => setNewException(prev => ({ ...prev, type: e.target.value }))}
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:border-teal-500 outline-none bg-white"
                                            >
                                                <option value="closed">Fechado (Feriado/Folga)</option>
                                                <option value="custom">Horário Diferenciado</option>
                                            </select>
                                        </div>
                                    </div>

                                    {newException.type === 'custom' && (
                                        <div className="bg-white p-3 rounded-lg border border-gray-200">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-gray-400">TURNOS DO DIA</span>
                                                <button
                                                    type="button"
                                                    onClick={addExceptionRange}
                                                    className="text-xs font-bold text-teal-600 hover:text-teal-700"
                                                >
                                                    + Turno
                                                </button>
                                            </div>
                                            <div className="space-y-2">
                                                {newException.ranges.map((range, idx) => (
                                                    <div key={idx} className="flex items-center gap-2">
                                                        <input
                                                            type="time"
                                                            value={range.start}
                                                            onChange={e => updateExceptionRange(idx, 'start', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border rounded"
                                                        />
                                                        <span className="text-gray-300">-</span>
                                                        <input
                                                            type="time"
                                                            value={range.end}
                                                            onChange={e => updateExceptionRange(idx, 'end', e.target.value)}
                                                            className="w-full px-2 py-1 text-sm border rounded"
                                                        />
                                                        {newException.ranges.length > 1 && (
                                                            <button type="button" onClick={() => removeExceptionRange(idx)} className="text-red-400 hover:text-red-600">
                                                                <X size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={addException}
                                        disabled={!newException.date}
                                        className="w-full py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Adicionar Exceção
                                    </button>
                                </div>
                            </div>

                            <div>
                                <h3 className="font-bold text-gray-800 mb-3 text-sm uppercase tracking-wide">Exceções Cadastradas</h3>
                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                    {(formData.schedule.exceptions || []).length === 0 && <p className="text-gray-400 text-sm">Nenhuma exceção cadastrada.</p>}
                                    {(formData.schedule.exceptions || []).map((ex: any, idx) => {
                                        // Legacy Check
                                        const isLegacy = typeof ex === 'string';
                                        const date = isLegacy ? ex : ex.date;
                                        const type = isLegacy ? 'closed' : ex.type;

                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${type === 'closed' ? 'bg-red-500' : 'bg-amber-500'}`} />
                                                    <div>
                                                        <p className="font-bold text-gray-800">{new Date(date + 'T00:00:00').toLocaleDateString()}</p>
                                                        <p className="text-xs text-gray-500 uppercase">{type === 'closed' ? 'Fechado' : 'Horário Especial'}</p>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => removeException(idx)}
                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                >
                                                    <X size={18} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 flex gap-3 border-t border-gray-100 mt-6 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UnitModal;
