import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { User, X } from 'lucide-react';
import { formatPhone } from '../../../utils/formatters';
import { UserProfile } from '../../../types';

interface UserEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    userToEdit: UserProfile | null;
    currentUserRole: string;
    onSuccess?: (updatedUser: UserProfile) => void;
}

const UserEditModal: React.FC<UserEditModalProps> = ({ isOpen, onClose, userToEdit, currentUserRole, onSuccess }) => {
    const [form, setForm] = useState({
        name: '',
        phone: '',
        role: 'client'
    });

    useEffect(() => {
        if (userToEdit) {
            setForm({
                name: userToEdit.name || '',
                phone: userToEdit.phone || '',
                role: userToEdit.role || 'client'
            });
        }
    }, [userToEdit, isOpen]);

    const canAssignRole = (role: string) => {
        if (currentUserRole === 'gm') return true;
        if (currentUserRole === 'admin') return ['supervisor', 'client'].includes(role);
        return false;
    };
    const accessibleRoles = ['gm', 'admin', 'supervisor', 'client'].filter(canAssignRole);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userToEdit) return;

        const userId = userToEdit.id || userToEdit.uid;
        if (!userId) {
            toast.error("Erro: Usuário sem ID.");
            return;
        }

        try {
            await updateDoc(doc(db, "users", userId), {
                name: form.name,
                role: form.role,
                phone: form.phone
            });

            toast.success("Usuário atualizado com sucesso!");

            if (onSuccess) {
                // Construct the updated user object for optimistic UI
                const updatedUser: UserProfile = {
                    ...userToEdit,
                    name: form.name,
                    role: form.role as UserProfile['role'],
                    phone: form.phone
                };
                onSuccess(updatedUser);
            }
            onClose();
        } catch (error) {
            console.error("Error updating user:", error);
            toast.error("Erro ao atualizar usuário.");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in overflow-hidden">
                <div className="bg-teal-900 p-4 flex justify-between items-center text-white">
                    <h3 className="font-bold flex items-center gap-2">
                        <User size={20} /> Editar Usuário
                    </h3>
                    <button onClick={onClose} className="hover:bg-teal-800 p-1 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome</label>
                        <input
                            type="text"
                            required
                            value={form.name}
                            onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Função</label>
                        <select
                            value={form.role}
                            onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none bg-white transition-colors"
                        >
                            {accessibleRoles.map(role => (
                                <option key={role} value={role}>{role === 'gm' ? 'Gerente Geral' : role === 'admin' ? 'Administrador' : role === 'supervisor' ? 'Supervisor' : 'Paciente'}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Telefone</label>
                        <input
                            type="tel"
                            value={form.phone}
                            onChange={e => setForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                        />
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
                            Salvar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserEditModal;
