import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Phone, MessageCircle, Edit2, Trash2, MapPin, Check, Filter, Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { formatPhone, formatCPF } from '../../../utils/formatters';
import { Appointment, Unit, UserProfile } from '../../../types';

interface AppointmentsTabProps {
    allAppointments: Appointment[];
    unitsList: Unit[];
    allUsersForAutocomplete: UserProfile[];
    userProfile: UserProfile;
    onUpdateStatus: (id: string, status: 'approved' | 'rejected' | 'pending_approval' | 'completed' | 'cancelled') => void;
    onEdit: (appointment: Appointment) => void;
    onDelete: (id: string) => void;
    loading?: boolean;
}

const AppointmentsTab: React.FC<AppointmentsTabProps> = ({
    allAppointments = [],
    unitsList = [],
    allUsersForAutocomplete = [],
    userProfile,
    onUpdateStatus,
    onEdit,
    onDelete,
    loading = false
}) => {
    // --- STATE ---
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [pendingAppointmentsList, setPendingAppointmentsList] = useState<Appointment[]>([]);

    // Pagination
    const [apptItemsPerPage, setApptItemsPerPage] = useState(10);
    const [apptCurrentPage, setApptCurrentPage] = useState(1);
    const [apptTotalItems, setApptTotalItems] = useState(0);

    // Filters
    const [apptSearchTerm, setApptSearchTerm] = useState('');
    const [apptFilterDate, setApptFilterDate] = useState('');
    const [apptFilterShift, setApptFilterShift] = useState('all');
    const [apptFilterUnit, setApptFilterUnit] = useState('all');

    // Sorting
    const [sortConfig, setSortConfig] = useState<{ field: keyof Appointment; direction: 'asc' | 'desc' }>({ field: 'date', direction: 'asc' });

    // --- EFFECT: Process Data ---
    useEffect(() => {
        // 1. Separate Pending
        const pending = allAppointments.filter(app => app.status === 'pending_approval');
        setPendingAppointmentsList(pending);

        // 2. Filter Confirmed
        let filtered = allAppointments.filter(app => app.status === 'approved' || app.status === 'completed' || app.status === 'cancelled' || app.status === 'rejected');

        // Default to approved for main view
        filtered = filtered.filter(app => app.status === 'approved');

        // Apply Search
        if (apptSearchTerm) {
            const normalize = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
            const term = normalize(apptSearchTerm);
            filtered = filtered.filter(app =>
                normalize(app.clientName || '').includes(term) ||
                normalize(app.serviceName || '').includes(term) ||
                (app.clientCpf && app.clientCpf.includes(term))
            );
        }

        // Apply Date Filter
        if (apptFilterDate) {
            filtered = filtered.filter(app => app.date === apptFilterDate);
        }

        // Apply Unit Filter
        if (apptFilterUnit !== 'all') {
            filtered = filtered.filter(app => app.clinicId === apptFilterUnit);
        }

        // Apply Shift Filter
        if (apptFilterShift !== 'all') {
            filtered = filtered.filter(app => {
                if (!app.time) return false;
                const hour = parseInt(app.time.split(':')[0]);
                if (apptFilterShift === 'morning') return hour < 12;
                if (apptFilterShift === 'afternoon') return hour >= 12 && hour < 18;
                if (apptFilterShift === 'night') return hour >= 18;
                return true;
            });
        }

        // Apply Sort
        filtered.sort((a, b) => {
            let fieldA = a[sortConfig.field];
            let fieldB = b[sortConfig.field];

            if (!fieldA) fieldA = '';
            if (!fieldB) fieldB = '';

            let comparison = 0;
            if (fieldA > fieldB) comparison = 1;
            else if (fieldA < fieldB) comparison = -1;

            if (sortConfig.direction === 'desc') comparison *= -1;

            if (comparison === 0 || sortConfig.field === 'date') {
                if (comparison === 0) {
                    const timeA = a.time || '';
                    const timeB = b.time || '';
                    if (timeA > timeB) comparison = sortConfig.direction === 'asc' ? 1 : -1;
                    else if (timeA < timeB) comparison = sortConfig.direction === 'asc' ? -1 : 1;
                }
            }
            return comparison;
        });

        // Update Total & Paginate
        setApptTotalItems(filtered.length);
        const startIndex = (apptCurrentPage - 1) * apptItemsPerPage;
        const sliced = filtered.slice(startIndex, startIndex + apptItemsPerPage);
        setAppointments(sliced);

    }, [allAppointments, apptSearchTerm, apptFilterDate, apptFilterUnit, apptFilterShift, sortConfig, apptCurrentPage, apptItemsPerPage]);

    // --- HANDLERS ---
    const handleSort = (field: keyof Appointment) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handleNextPage = () => {
        if (apptCurrentPage * apptItemsPerPage < apptTotalItems) {
            setApptCurrentPage(prev => prev + 1);
        }
    };

    const handlePrevPage = () => {
        if (apptCurrentPage > 1) {
            setApptCurrentPage(prev => prev - 1);
        }
    };

    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setApptItemsPerPage(Number(e.target.value));
        setApptCurrentPage(1);
    };

    // Permissions
    const canApprove = ['gm', 'admin', 'supervisor'].includes(userProfile?.role || '');
    const canReject = ['gm', 'admin', 'supervisor'].includes(userProfile?.role || '');
    const canDelete = ['gm'].includes(userProfile?.role || '');
    const canEditClient = ['gm', 'admin'].includes(userProfile?.role || '');
    const isClient = userProfile?.role === 'client';

    // Client View Override (If specific simple view needed, but logic handles reuse)
    // Assuming this tab is mostly for Admin/Internal use based on "Pendentes de Aprovação" logic.
    // However, if Client sees this, we might want to hide internal controls.

    return (
        <div className="animate-fade-in-up">
            {/* Pagination Controls Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        <Filter size={16} /> Exibir:
                    </span>
                    <select
                        value={apptItemsPerPage}
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
                        Página <strong className="text-gray-800">{apptCurrentPage}</strong> de <strong className="text-gray-800">{Math.ceil(apptTotalItems / apptItemsPerPage) || 1}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrevPage}
                            disabled={apptCurrentPage === 1 || loading}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={handleNextPage}
                            disabled={apptCurrentPage * apptItemsPerPage >= apptTotalItems || loading}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Search and Filter Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 flex flex-wrap lg:flex-nowrap gap-4 items-center">
                <div className="relative flex-grow lg:flex-grow-[2] min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        list="patient-suggestions"
                        placeholder="Buscar por nome do paciente..."
                        value={apptSearchTerm}
                        onChange={(e) => setApptSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    />
                    <datalist id="patient-suggestions">
                        {allUsersForAutocomplete.map(u => (
                            <option key={u.id} value={u.name} />
                        ))}
                    </datalist>
                </div>
                <div className="flex-grow min-w-[150px]">
                    <select
                        value={apptFilterUnit}
                        onChange={(e) => setApptFilterUnit(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-teal-500 focus:border-teal-500 outline-none text-gray-600 transition-all bg-white"
                    >
                        <option value="all">Todas Unidades</option>
                        {unitsList.map(unit => (
                            <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-grow min-w-[130px]">
                    <input
                        type="date"
                        value={apptFilterDate}
                        onChange={(e) => setApptFilterDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-teal-500 focus:border-teal-500 outline-none text-gray-600 transition-all"
                    />
                </div>
                <div className="flex-grow min-w-[150px]">
                    <select
                        value={apptFilterShift}
                        onChange={(e) => setApptFilterShift(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-teal-500 focus:border-teal-500 outline-none text-gray-600 transition-all bg-white"
                    >
                        <option value="all">Todos os Turnos</option>
                        <option value="morning">Manhã (Até 12h)</option>
                        <option value="afternoon">Tarde (12h-18h)</option>
                        <option value="night">Noite (18h+)</option>
                    </select>
                </div>
            </div>

            {/* 1. Pending Section */}
            {!isClient && (
                <section>
                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                        <span className="text-yellow-600 bg-yellow-100 p-2 rounded-lg"><Clock size={20} /></span>
                        Pendentes de Aprovação
                    </h2>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pendingAppointmentsList.map(app => (
                            <div key={app.id} className="bg-white rounded-xl shadow-sm border border-yellow-100 p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                                        {app.serviceName}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {app.createdAt ? new Date((app.createdAt as any).seconds * 1000).toLocaleDateString() : '-'}
                                    </span>
                                </div>

                                <div className="mb-4">
                                    <h3 className="font-bold text-gray-900 text-lg">{app.clientName}</h3>
                                    <p className="text-gray-500 text-sm">{app.clientCpf}</p>
                                    <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
                                        <Phone size={14} />
                                        {app.clientPhone}
                                        <div className="ml-auto flex gap-2">
                                            <a
                                                href={`https://wa.me/55${app.clientPhone?.replace(/\D/g, '')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-green-600 hover:text-green-800"
                                                title="WhatsApp"
                                            >
                                                <MessageCircle size={16} />
                                            </a>
                                            {canEditClient && (
                                                <button
                                                    onClick={() => onEdit(app)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="Editar Agendamento"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded inline-block">
                                        {app.clinicName || 'Unidade não identificada'}
                                    </div>
                                </div>

                                <div className="border-t border-gray-100 pt-4 mb-6 grid grid-cols-2 gap-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        <Calendar size={14} className="text-teal-500" />
                                        {(() => {
                                            if (!app.date) return '-';
                                            const [y, m, d] = app.date.split('-');
                                            return `${d}/${m}/${y}`;
                                        })()}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock size={14} className="text-teal-500" />
                                        {app.time}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {canReject && (
                                        <button
                                            onClick={() => onUpdateStatus(app.id, 'rejected')}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg font-bold transition-colors text-sm"
                                        >
                                            Recusar
                                        </button>
                                    )}
                                    {canApprove && (
                                        <button
                                            onClick={() => onUpdateStatus(app.id, 'approved')}
                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold transition-colors text-sm"
                                        >
                                            Aprovar
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {pendingAppointmentsList.length === 0 && (
                            <div className="col-span-full py-8 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                                Nenhum agendamento pendente.
                            </div>
                        )}
                    </div>
                </section>
            )}

            {/* 2. Confirmed Table */}
            <section className="mt-8">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                    <span className="text-green-600 bg-green-100 p-2 rounded-lg"><Check size={20} /></span>
                    Agenda Confirmada
                </h2>

                {/* MOBILE CARD VIEW */}
                <div className="grid grid-cols-1 gap-4 md:hidden">
                    {appointments.map(app => (
                        <div key={app.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 relative">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <span className="bg-teal-50 text-teal-800 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide">
                                        {app.serviceName}
                                    </span>
                                    <h3 className="font-bold text-gray-900 text-lg mt-2">{app.clientName}</h3>
                                    <p className="text-sm text-gray-400">{app.clientCpf ? formatCPF(app.clientCpf) : 'CPF n/a'}</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-teal-600 font-bold flex items-center justify-end gap-1">
                                        <Calendar size={14} />
                                        {(() => {
                                            if (!app.date) return '-';
                                            const [y, m, d] = app.date.split('-');
                                            return `${d}/${m}`;
                                        })()}
                                    </div>
                                    <div className="text-gray-500 font-mono text-sm">{app.time}</div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-sm text-gray-500 mb-4 bg-gray-50 p-2 rounded-lg">
                                <MapPin size={14} className="text-teal-500" />
                                <span className="truncate">{app.clinicName || 'Sem Unidade'}</span>
                            </div>

                            <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                                <a href={`https://wa.me/55${app.clientPhone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 font-bold text-sm">
                                    <Phone size={14} /> {formatPhone(app.clientPhone || '')}
                                </a>
                                <div className="flex gap-2">
                                    {canEditClient && (
                                        <button onClick={() => onEdit(app)} className="p-2 bg-gray-100 text-gray-600 rounded-full">
                                            <Edit2 size={16} />
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button onClick={() => onDelete(app.id)} className="p-2 bg-red-50 text-red-600 rounded-full">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* DESKTOP TABLE VIEW */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('date')}>
                                        <div className="flex items-center gap-2">Data/Hora {sortConfig.field === 'date' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={14} className="opacity-30" />}</div>
                                    </th>
                                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('clientName')}>
                                        <div className="flex items-center gap-2">Paciente {sortConfig.field === 'clientName' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={14} className="opacity-30" />}</div>
                                    </th>
                                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('clinicName')}>
                                        <div className="flex items-center gap-2">Unidade {sortConfig.field === 'clinicName' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={14} className="opacity-30" />}</div>
                                    </th>
                                    <th className="px-6 py-4 font-bold cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('serviceName')}>
                                        <div className="flex items-center gap-2">Procedimento {sortConfig.field === 'serviceName' ? (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : <ArrowUpDown size={14} className="opacity-30" />}</div>
                                    </th>
                                    <th className="px-6 py-4 font-bold text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {appointments.map(app => (
                                    <tr key={app.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-gray-900">
                                                {(() => {
                                                    if (!app.date) return '-';
                                                    const [y, m, d] = app.date.split('-');
                                                    return `${d}/${m}/${y}`;
                                                })()}
                                            </div>
                                            <div className="text-sm text-gray-500">{app.time}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{app.clientName}</div>
                                            <div className="text-xs text-gray-500">
                                                {app.clientCpf ? formatCPF(app.clientCpf) : 'CPF n/a'}
                                            </div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                <Phone size={10} /> {app.clientPhone}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1 text-sm text-gray-700">
                                                <MapPin size={14} className="text-teal-500" />
                                                {app.clinicName || '-'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-3 py-1 bg-teal-50 text-teal-800 text-xs font-bold rounded-full">
                                                {app.serviceName}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {canEditClient && (
                                                    <>
                                                        <a
                                                            href={`https://wa.me/55${app.clientPhone?.replace(/\D/g, '')}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="WhatsApp"
                                                        >
                                                            <MessageCircle size={16} />
                                                        </a>
                                                        <button
                                                            onClick={() => onEdit(app)}
                                                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                            title="Editar"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                                {canDelete ? (
                                                    <button onClick={() => onDelete(app.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : (
                                                    <div className="w-8"></div> // spacer
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default AppointmentsTab;
