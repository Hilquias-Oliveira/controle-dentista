import React, { useState, useEffect } from 'react';
import { MapPin, Edit2, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import UnitModal from '../modals/UnitModal';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { Unit, UserProfile } from '../../../types';

interface UnitsTabProps {
    unitsList: Unit[];
    loading?: boolean;
    userProfile: UserProfile;
    onDelete: (unit: Unit) => void;
}

const UnitsTab: React.FC<UnitsTabProps> = ({ unitsList = [], loading, userProfile, onDelete }) => {
    // --- STATE ---
    const [filteredUnits, setFilteredUnits] = useState<Unit[]>([]);
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [unitToEdit, setUnitToEdit] = useState<Unit | null>(null);

    // Pagination
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // --- EFFECTS ---
    useEffect(() => {
        let result = [...unitsList];
        // Sort by Name
        result.sort((a, b) => a.name.localeCompare(b.name));
        setFilteredUnits(result);
    }, [unitsList]);

    // --- PAGINATION HELPERS ---
    const totalItems = filteredUnits.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedUnits = filteredUnits.slice(startIndex, startIndex + itemsPerPage);
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    const handleNextPage = () => {
        if (currentPage < totalPages) setCurrentPage(prev => prev + 1);
    };

    const handlePrevPage = () => {
        if (currentPage > 1) setCurrentPage(prev => prev - 1);
    };

    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setItemsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    // --- HANDLERS ---
    const openModal = (unit: Unit | null = null) => {
        setUnitToEdit(unit);
        setIsUnitModalOpen(true);
    };

    const handleSeedUnits = async () => {
        if (!confirm("Isso adicionará as unidades padrão. Continuar?")) return;

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

        try {
            await addDoc(collection(db, "units"), {
                name: "Clínica Sorriso do Bem",
                address: "Rua XV de Novembro, 1000 - Centro, Blumenau - SC",
                phone: "(47) 3333-4444",
                whatsapp: "5547999999999",
                color: "teal",
                schedule: defaultSchedule
            });
            await addDoc(collection(db, "units"), {
                name: "OdontoCenter Prime",
                address: "Rua 7 de Setembro, 500 - Centro, Blumenau - SC",
                phone: "(47) 3000-5000",
                whatsapp: "5547988888888",
                color: "blue",
                schedule: defaultSchedule
            });
            toast.success("Unidades padrão adicionadas!");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao adicionar unidades.");
        }
    };

    const canManage = ['gm', 'admin'].includes(userProfile?.role);
    if (!canManage) return null;

    return (
        <section className="animate-fade-in-up">
            {/* Pagination Controls Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        <Filter size={16} /> Exibir:
                    </span>
                    <select
                        value={itemsPerPage}
                        onChange={handleLimitChange}
                        className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block p-2 font-bold outline-none"
                    >
                        <option value={10}>10 itens</option>
                        <option value={50}>50 itens</option>
                        <option value={100}>100 itens</option>
                    </select>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 font-medium">
                        Página <strong className="text-gray-800">{currentPage}</strong> de <strong className="text-gray-800">{totalPages}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage === 1 || loading}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={handleNextPage}
                            disabled={currentPage >= totalPages || loading}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
                    <span className="text-blue-600 bg-blue-100 p-2 rounded-lg"><MapPin size={20} /></span>
                    Gerenciamento de Unidades
                </h2>
                <div className="flex gap-2">
                    {unitsList.length === 0 && (
                        <button
                            onClick={handleSeedUnits}
                            className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 text-sm"
                        >
                            Restaurar Padrões
                        </button>
                    )}
                    <button
                        onClick={() => openModal(null)}
                        className="bg-teal-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-teal-700 transition-colors flex items-center gap-2 text-sm"
                    >
                        <Edit2 size={16} /> Nova Unidade
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {unitsList.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        Nenhuma unidade cadastrada.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Nome</th>
                                    <th className="px-6 py-4 font-bold">Endereço</th>
                                    <th className="px-6 py-4 font-bold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedUnits.map(unit => (
                                    <tr key={unit.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900 flex items-center gap-2">
                                                <div className={`w-3 h-3 rounded-full ${unit.color === 'teal' ? 'bg-teal-500' : 'bg-blue-500'}`}></div>
                                                {unit.name}
                                            </div>
                                            <div className="text-xs text-gray-400">{unit.phone}</div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            {unit.address}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => openModal(unit)}
                                                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(unit)}
                                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Internal Modal */}
            <UnitModal
                isOpen={isUnitModalOpen}
                onClose={() => setIsUnitModalOpen(false)}
                unitToEdit={unitToEdit}
            />
        </section>
    );
};

export default UnitsTab;
