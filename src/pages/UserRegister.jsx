import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserPlus, Loader2, ArrowLeft, Shield, User, CheckCircle2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatCPF, formatPhone } from '../utils/formatters';

const UserRegister = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        cpf: '',
        phone: ''
    });
    const [cpfStatus, setCpfStatus] = useState('idle'); // 'idle', 'checking', 'available', 'taken'
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();



    const [guestDocId, setGuestDocId] = useState(null);

    const checkCpfAvailability = async (cpf) => {
        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            setCpfStatus('idle');
            return;
        }

        setCpfStatus('checking');
        try {
            // Check both raw and formatted versions
            const formatted = `${cleanCpf.slice(0, 3)}.${cleanCpf.slice(3, 6)}.${cleanCpf.slice(6, 9)}-${cleanCpf.slice(9, 11)}`;
            const q = query(collection(db, "users"), where("cpf", "in", [cleanCpf, formatted]));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const userData = querySnapshot.docs[0].data();
                if (userData.email) {
                    setCpfStatus('taken');
                    toast.error("Este CPF já possui cadastro completo.");
                } else {
                    // Guest found! Allow merge.
                    setCpfStatus('available'); // Consider available for registration (will merge)
                    setGuestDocId(querySnapshot.docs[0].id);
                    // toast.info("Cadastro anterior encontrado. Seus dados serão unificados!");
                }
            } else {
                setCpfStatus('available');
                setGuestDocId(null);
                toast.success("CPF disponível para cadastro!");
            }
        } catch (error) {
            console.error("Error checking CPF:", error);
            setCpfStatus('idle');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let formattedValue = value;

        if (name === 'phone') formattedValue = formatPhone(value);
        if (name === 'cpf') {
            formattedValue = formatCPF(value);
            // Reset status if CPF changes
            if (formattedValue.length !== 14 && cpfStatus !== 'idle') {
                setCpfStatus('idle');
                setGuestDocId(null);
            }
            // Trigger check if complete
            if (formattedValue.length === 14) {
                checkCpfAvailability(formattedValue);
            }
        }

        setFormData(prev => ({ ...prev, [name]: formattedValue }));
    };

    const handleRegister = async (e) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            toast.error("As senhas não coincidem.");
            return;
        }

        if (formData.cpf.length !== 14) {
            toast.error("CPF inválido.");
            return;
        }

        if (cpfStatus !== 'available') {
            toast.error("Por favor, verifique o CPF informado.");
            return;
        }

        setLoading(true);

        try {
            // 1. Create Auth User
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const user = userCredential.user;

            // 2. Create New Firestore User Document (Correct ID)
            await setDoc(doc(db, "users", user.uid), {
                uid: user.uid,
                name: formData.name,
                email: formData.email,
                cpf: formData.cpf, // Save formatted
                phone: formData.phone,
                role: 'client',
                createdAt: serverTimestamp()
            });

            // 3. MERGE LOGIC: If there was a guest user, migrate data
            // 3. MERGE LOGIC: Unify appointments by Guest ID OR CPF
            const cpfDigits = formData.cpf.replace(/\D/g, '');

            // Find appointments by Guest ID (if existed)
            let appointmentsToUpdate = [];
            if (guestDocId) {
                const qGuest = query(collection(db, "appointments"), where("customerId", "==", guestDocId));
                const snapGuest = await getDocs(qGuest);
                snapGuest.forEach(doc => appointmentsToUpdate.push(doc));
            }

            // Find appointments by CPF (Orphans)
            const qCpf = query(collection(db, "appointments"), where("clientCpf", "==", cpfDigits));
            const snapCpf = await getDocs(qCpf);
            snapCpf.forEach(doc => {
                // Avoid duplicates if found by both queries (though unlikely if ID differs)
                if (!appointmentsToUpdate.some(a => a.id === doc.id)) {
                    appointmentsToUpdate.push(doc);
                }
            });

            if (appointmentsToUpdate.length > 0) {
                const updatePromises = appointmentsToUpdate.map(appDoc =>
                    updateDoc(doc(db, "appointments", appDoc.id), {
                        customerId: user.uid, // Link to new User ID
                        clientName: formData.name, // Update name to match registered user
                        clientPhone: formData.phone
                    })
                );
                await Promise.all(updatePromises);
                toast.success(`Conta criada! ${appointmentsToUpdate.length} agendamento(s) unificado(s).`);
            } else {
                toast.success("Conta criada com sucesso!");
            }

            // Delete old guest doc if it existed
            if (guestDocId) {
                try {
                    await deleteDoc(doc(db, "users", guestDocId));
                } catch (delError) {
                    console.error("Error deleting guest doc:", delError);
                }
            }


            navigate('/admin/dashboard');

        } catch (error) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                toast.error("Este email já está cadastrado.");
            } else {
                toast.error(`Erro: ${error.message}`); // Show actual error for debugging
                console.error("Full Error:", error);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 animate-scale-in">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <UserPlus size={32} />
                    </div>
                    <h1 className="text-2xl font-serif font-bold text-gray-900">Criar Conta</h1>
                    <p className="text-gray-500 text-sm">Acompanhe seus agendamentos</p>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">CPF</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    name="cpf"
                                    required
                                    maxLength={14}
                                    value={formData.cpf}
                                    onChange={handleChange}
                                    className={`w-full px-4 py-2 rounded-xl border-2 outline-none transition-colors ${cpfStatus === 'available' ? 'border-green-500 focus:border-green-600 bg-green-50' :
                                        cpfStatus === 'taken' ? 'border-red-500 focus:border-red-600 bg-red-50' :
                                            'border-gray-100 focus:border-teal-500'
                                        }`}
                                    placeholder="000.000.000-00"
                                />
                                {cpfStatus === 'checking' && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <Loader2 size={16} className="animate-spin text-teal-600" />
                                    </div>
                                )}
                                {cpfStatus === 'available' && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <CheckCircle2 size={16} className="text-green-600" />
                                    </div>
                                )}
                            </div>
                            {cpfStatus === 'taken' && <p className="text-xs text-red-500 mt-1 font-bold">CPF Já cadastrado.</p>}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Telefone</label>
                            <input
                                type="tel"
                                name="phone"
                                required
                                disabled={cpfStatus !== 'available'}
                                maxLength={15}
                                value={formData.phone}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                placeholder="(99) 99999-9999"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                        <input
                            type="text"
                            name="name"
                            required
                            disabled={cpfStatus !== 'available'}
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            placeholder="Seu nome"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">Email</label>
                        <input
                            type="email"
                            name="email"
                            required
                            disabled={cpfStatus !== 'available'}
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                            placeholder="seu@email.com"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Senha</label>
                            <input
                                type="password"
                                name="password"
                                required
                                disabled={cpfStatus !== 'available'}
                                value={formData.password}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                placeholder="••••••••"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Confirmar</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                required
                                disabled={cpfStatus !== 'available'}
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
                                placeholder="••••••••"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white py-3 rounded-xl font-bold shadow-lg shadow-teal-100 transition-all flex items-center justify-center gap-2 mt-6"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Criar Conta'}
                    </button>

                    <div className="text-center mt-6 space-y-3">
                        <Link to="/admin" className="block text-sm text-teal-600 hover:text-teal-800 font-medium">
                            Já tem uma conta? Fazer Login
                        </Link>
                        <Link to="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-teal-600 transition-colors">
                            <ArrowLeft size={16} />
                            Voltar para o site
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserRegister;
