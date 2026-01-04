import React, { useState, useEffect } from 'react';
import { Settings, Edit2, Trash2, Filter, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Service, UserProfile } from '../../../types';

interface ServicesTabProps {
    servicesList: Service[];
    loading?: boolean;
    onEdit: (service: Service | null) => void;
    onDelete: (service: Service) => void;
    userProfile: UserProfile;
}

const ServicesTab: React.FC<ServicesTabProps> = ({ servicesList = [], loading, onEdit, onDelete, userProfile }) => {
    // --- STATE ---
    const [filteredServices, setFilteredServices] = useState<Service[]>([]);

    // Pagination
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    // --- EFFECTS ---
    useEffect(() => {
        let result = [...servicesList];

        // Default Sort by Name (or add sorting logic later)
        result.sort((a, b) => a.name.localeCompare(b.name));

        setFilteredServices(result);
    }, [servicesList]);

    // --- PAGINATION HELPERS ---
    const totalItems = filteredServices.length;
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedServices = filteredServices.slice(startIndex, startIndex + itemsPerPage);
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

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    const canManage = ['gm', 'admin'].includes(userProfile?.role || '');

    if (!canManage) return <div className="p-8 text-center text-gray-400">Acesso restrito.</div>;

    return (
        <div className="animate-fade-in-up">
            {/* Controls Bar */}
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
                    <span className="text-purple-600 bg-purple-100 p-2 rounded-lg"><Sparkles size={20} /></span>
                    Gerenciamento de Serviços
                </h2>
                <button
                    onClick={() => onEdit(null)} // New Service
                    className="bg-teal-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-teal-700 transition-colors flex items-center gap-2 text-sm shadow-md hover:shadow-lg"
                >
                    <Edit2 size={16} /> Novo Serviço
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {servicesList.length === 0 && !loading ? (
                    <div className="p-8 text-center text-gray-400">
                        Nenhum serviço cadastrado.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-bold">Serviço</th>
                                    <th className="px-6 py-4 font-bold">Valor</th>
                                    <th className="px-6 py-4 font-bold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedServices.map(service => (
                                    <tr key={service.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{service.name}</div>
                                            {service.duration && (
                                                <div className="text-xs text-gray-400 mt-1">{service.duration} mins</div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {service.displayPrice ? (
                                                <span className="text-teal-700 font-bold">
                                                    {formatCurrency(service.price)}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 italic text-xs uppercase bg-gray-100 px-2 py-1 rounded">Sob Consulta</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => onEdit(service)}
                                                    className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                    title="Editar"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(service)}
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
        </div>
    );
};

export default ServicesTab;
