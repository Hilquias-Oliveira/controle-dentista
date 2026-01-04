import React, { useState, useEffect } from 'react';
import { Users, Phone, Search, ChevronLeft, ChevronRight, Filter, Edit2, Trash2, ShieldAlert, UserCog, Loader2, MapPin } from 'lucide-react';
import { collection, query, orderBy, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { toast } from 'sonner';
import { formatPhone, formatCPF } from '../../../utils/formatters';
import UserEditModal from '../modals/UserEditModal';
import DeleteConfirmationModal from '../modals/DeleteConfirmationModal';
import { UserProfile } from '../../../types';

interface UsersTabProps {
    userProfile: UserProfile;
}

const UsersTab: React.FC<UsersTabProps> = ({ userProfile }) => {
    // --- STATE ---
    const [usersList, setUsersList] = useState<UserProfile[]>([]);
    const [usersLoading, setUsersLoading] = useState(true);

    // Pagination
    const [usersItemsPerPage, setUsersItemsPerPage] = useState(10);
    const [usersCurrentPage, setUsersCurrentPage] = useState(1);
    const [usersTotalItems, setUsersTotalItems] = useState(0);

    // Search
    const [usersSearchTerm, setUsersSearchTerm] = useState('');

    // Modals
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string | null; title: string; message: string }>({
        isOpen: false,
        id: null,
        title: '',
        message: ''
    });

    // --- FETCH USERS ---
    useEffect(() => {
        // Security Check (though parent should handle visibility, double check logic doesn't hurt)
        if (userProfile?.role === 'client') return;

        setUsersLoading(true);

        const fetchUsers = async () => {
            try {
                const usersRef = collection(db, "users");
                let q = query(usersRef, orderBy("name"));

                // Note: Supervisors can only see list? Or logic handled in Render?
                // keeping generic query for now consistent with original

                const snapshot = await getDocs(q);
                let users = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as any[]; // Need to cast to match filtering logic before proper typing

                // Client-side Filtering
                if (usersSearchTerm) {
                    const normalize = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
                    const term = normalize(usersSearchTerm);
                    users = users.filter(u => normalize(u.name || '').includes(term));
                }

                setUsersTotalItems(users.length);

                // Pagination
                const startIndex = (usersCurrentPage - 1) * usersItemsPerPage;
                const slicedUsers = users.slice(startIndex, startIndex + usersItemsPerPage);

                setUsersList(slicedUsers as UserProfile[]);
            } catch (error) {
                console.error("Error fetching users:", error);
                toast.error("Erro ao carregar usuários.");
            } finally {
                setUsersLoading(false);
            }
        };

        fetchUsers();
    }, [userProfile, usersItemsPerPage, usersCurrentPage, usersSearchTerm]);

    // --- HANDLERS ---
    const handleNextPage = () => {
        if (usersCurrentPage * usersItemsPerPage < usersTotalItems) {
            setUsersCurrentPage(prev => prev + 1);
        }
    };

    const handlePrevPage = () => {
        if (usersCurrentPage > 1) {
            setUsersCurrentPage(prev => prev - 1);
        }
    };

    const handleLimitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setUsersItemsPerPage(Number(e.target.value));
        setUsersCurrentPage(1);
    };

    const handleEditClick = (user: UserProfile) => {
        setEditingUser(user);
        setIsUserModalOpen(true);
    };

    const handleDeleteClick = (user: UserProfile) => {
        setDeleteModal({
            isOpen: true,
            id: user.id || user.uid,
            title: 'Excluir Usuário',
            message: `Tem certeza que deseja excluir o usuário ${user.name}? Esta ação é irreversível.`
        });
    };

    const confirmDelete = async () => {
        if (!deleteModal.id) return;

        try {
            await deleteDoc(doc(db, "users", deleteModal.id));
            toast.success("Usuário excluído.");

            // Optimistic Update
            setUsersList(prev => prev.filter(u => (u.id || u.uid) !== deleteModal.id));
            setUsersTotalItems(prev => prev - 1);

            setDeleteModal({ isOpen: false, id: null, title: '', message: '' });
        } catch (error) {
            console.error("Error deleting user:", error);
            toast.error("Erro ao excluir usuário.");
        }
    };

    // Permissions
    const canDelete = ['gm'].includes(userProfile?.role || '');
    const canEdit = ['gm', 'admin'].includes(userProfile?.role || '');

    return (
        <div className="animate-fade-in-up">
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                        <Filter size={16} /> Exibir:
                    </span>
                    <select
                        value={usersItemsPerPage}
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
                        Página <strong className="text-gray-800">{usersCurrentPage}</strong> de <strong className="text-gray-800">{Math.ceil(usersTotalItems / usersItemsPerPage) || 1}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handlePrevPage}
                            disabled={usersCurrentPage === 1 || usersLoading}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={handleNextPage}
                            disabled={usersCurrentPage * usersItemsPerPage >= usersTotalItems || usersLoading}
                            className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar usuário por nome..."
                        value={usersSearchTerm}
                        onChange={(e) => setUsersSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-teal-500 focus:border-teal-500 outline-none transition-all"
                    />
                </div>
            </div>

            {/* List */}
            {usersLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="animate-spin text-teal-600 mb-2" size={32} />
                    <p className="text-gray-400">Carregando usuários...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {usersList.map(user => (
                        <div key={user.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex flex-col relative group hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl ${user.role === 'gm' ? 'bg-purple-600' :
                                        user.role === 'admin' ? 'bg-teal-600' :
                                            user.role === 'supervisor' ? 'bg-blue-600' : 'bg-gray-400'
                                        }`}>
                                        {user.name && user.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900">{user.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wide ${user.role === 'gm' ? 'bg-purple-100 text-purple-700' :
                                            user.role === 'admin' ? 'bg-teal-100 text-teal-700' :
                                                user.role === 'supervisor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                            {user.role}
                                        </span>
                                    </div>
                                </div>
                                {canDelete && user.role !== 'gm' && (
                                    <button
                                        onClick={() => handleDeleteClick(user)}
                                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                        title="Excluir Usuário"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>

                            <div className="space-y-3 mb-4 flex-1">
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <div className="bg-gray-50 p-1.5 rounded-md"><Users size={14} className="text-teal-600" /></div>
                                    <span className="truncate">{user.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <div className="bg-gray-50 p-1.5 rounded-md"><Phone size={14} className="text-teal-600" /></div>
                                    <span>{user.phone ? formatPhone(user.phone) : '-'}</span>
                                </div>
                                {/* Assuming cpf might be in UserProfile or we add it. It's not in my interface yet. */}
                                {/* Adding any cast for now if it exists in data */}
                                {(user as any).cpf && (
                                    <div className="flex items-center gap-2 text-sm text-gray-600">
                                        <div className="bg-gray-50 p-1.5 rounded-md"><ShieldAlert size={14} className="text-teal-600" /></div>
                                        <span>{formatCPF((user as any).cpf)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-gray-50 mt-auto">
                                {canEdit ? (
                                    <button
                                        onClick={() => handleEditClick(user)}
                                        className="w-full py-2 flex items-center justify-center gap-2 bg-gray-50 hover:bg-teal-50 text-gray-600 hover:text-teal-700 rounded-lg font-bold transition-colors text-sm"
                                    >
                                        <UserCog size={16} /> Gerenciar Perfil
                                    </button>
                                ) : (
                                    <p className="text-center text-xs text-gray-400 italic">Visualização apenas</p>
                                )}
                            </div>
                        </div>
                    ))}
                    {usersList.length === 0 && !usersLoading && (
                        <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                            Nenhum usuário encontrado.
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <UserEditModal
                isOpen={isUserModalOpen}
                onClose={() => setIsUserModalOpen(false)}
                userToEdit={editingUser}
                currentUserRole={userProfile?.role || ''}
                onSuccess={(updatedUser) => {
                    // Update list locally
                    setUsersList(prev => prev.map(u => (u.id || u.uid) === (updatedUser.id || updatedUser.uid) ? { ...u, ...updatedUser } : u));
                    toast.success("Lista de usuários atualizada.");
                }}
            />

            <DeleteConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null, title: '', message: '' })}
                onConfirm={confirmDelete}
                title={deleteModal.title}
                message={deleteModal.message}
            />
        </div>
    );
};

export default UsersTab;
