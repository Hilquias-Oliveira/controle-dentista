import React, { useEffect, useState, useRef } from 'react';
import { signOut, onAuthStateChanged, sendPasswordResetEmail, User } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, where, setDoc, limit, getDocs } from 'firebase/firestore';
import { LogOut, User as UserIcon, Home as HomeIcon, Shield, Loader2, Users, Settings, MapPin, Sparkles, X, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhone } from '../utils/formatters';

// Type Imports
import { UserProfile, Appointment, Unit, Service } from '../types';

// Components
import ServiceModal from '../components/admin/modals/ServiceModal.tsx';
import LogoutModal from '../components/admin/modals/LogoutModal.tsx';
import TimeoutModal from '../components/admin/modals/TimeoutModal.tsx';
import ConflictModal from '../components/admin/modals/ConflictModal.tsx';
import AppointmentEditModal from '../components/admin/modals/AppointmentEditModal.tsx';
import DeleteConfirmationModal from '../components/admin/modals/DeleteConfirmationModal.tsx';

// Tabs
import AppointmentsTab from '../components/admin/tabs/AppointmentsTab.tsx';
import UsersTab from '../components/admin/tabs/UsersTab.tsx';
import ServicesTab from '../components/admin/tabs/ServicesTab.tsx';
import UnitsTab from '../components/admin/tabs/UnitsTab.tsx';
import SettingsTab from '../components/admin/tabs/SettingsTab.tsx';

const AdminDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<User | null>(null);
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [activeTab, setActiveTab] = useState('appointments');

    // --- SHARED DATA ---
    const [unitsList, setUnitsList] = useState<Unit[]>([]);
    const [unitsLoading, setUnitsLoading] = useState(true);
    const [servicesList, setServicesList] = useState<Service[]>([]);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [allRawAppointments, setAllRawAppointments] = useState<Appointment[]>([]);
    const [apptLoading, setApptLoading] = useState(true);
    const [allUsersForAutocomplete, setAllUsersForAutocomplete] = useState<UserProfile[]>([]);

    // --- MODAL STATES ---
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isTimeoutModalOpen, setIsTimeoutModalOpen] = useState(false);

    // Edit Appointment Modal
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);

    // Edit Service Modal
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);

    // Conflict Modal
    const [conflictModal, setConflictModal] = useState<{
        isOpen: boolean;
        targetApp: Appointment | null;
        conflictingApp: Appointment | null;
        suggestion: string | null;
    }>({
        isOpen: false,
        targetApp: null,
        conflictingApp: null,
        suggestion: null
    });

    // Delete Modal
    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'appointment' | 'unit' | 'service' | null;
        id: string | null;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: null,
        id: null
    });

    // Profile Modal
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileForm, setProfileForm] = useState({ name: '', phone: '' });


    // --- AUTH & PROFILE LOADING ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const docRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setUserProfile(docSnap.data() as UserProfile);
                    } else {
                        console.error("User profile not found. Recovering...");
                        // Auto-recover (e.g. for dev/first setup)
                        const recoveredProfile: UserProfile = {
                            email: currentUser.email || '',
                            name: currentUser.displayName || 'Admin Recovered',
                            role: 'gm',
                            createdAt: new Date() as any, // Firebase timestamp simplified
                            phone: '',
                            cpf: '',
                            uid: currentUser.uid // Ensure UID is there
                        };
                        await setDoc(docRef, recoveredProfile);
                        setUserProfile(recoveredProfile);
                        toast.success("Perfil de administrador restaurado.");
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                }
            } else {
                setUser(null);
                setUserProfile(null);
                navigate("/admin/login");
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [navigate]);

    // --- DATA FETCHING ---

    // 1. Fetch Units
    useEffect(() => {
        if (!['gm', 'admin'].includes(userProfile?.role || '')) return;

        const fetchUnits = async () => {
            setUnitsLoading(true);
            try {
                const q = query(collection(db, "units"), orderBy("name"));
                const snapshot = await getDocs(q);
                const units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Unit[];
                setUnitsList(units);
            } catch (error) {
                console.error("Error fetching units:", error);
                toast.error("Erro ao carregar unidades.");
            } finally {
                setUnitsLoading(false);
            }
        };
        fetchUnits();
    }, [userProfile]);

    // 2. Fetch Services
    useEffect(() => {
        if (!['gm', 'admin'].includes(userProfile?.role || '')) return;

        const fetchServices = async () => {
            setServicesLoading(true);
            try {
                const q = query(collection(db, "services"), orderBy("name"));
                const snapshot = await getDocs(q);
                const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Service[];
                setServicesList(services);
            } catch (error) {
                console.error("Error fetching services:", error);
                toast.error("Erro ao carregar serviços.");
            } finally {
                setServicesLoading(false);
            }
        };
        fetchServices();
    }, [userProfile]);

    // 3. Fetch Appointments
    useEffect(() => {
        if (!user) return;

        setApptLoading(true);
        const dbRef = collection(db, "appointments");
        let q;

        if (userProfile?.role === 'client') {
            q = query(dbRef, where("customerId", "==", user.uid), orderBy("date", "desc"), limit(100));
        } else {
            q = query(dbRef, orderBy("date", "desc"), limit(500));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const raw = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Appointment[];
            setAllRawAppointments(raw);
            setApptLoading(false);
        }, (error: any) => {
            console.error("Error fetching raw appointments:", error);
            // Fallback for missing index
            if (error.code === 'failed-precondition') {
                const fallbackQ = query(dbRef, limit(100));
                getDocs(fallbackQ).then(snap => {
                    const fallbackRaw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Appointment[];
                    setAllRawAppointments(fallbackRaw);
                    setApptLoading(false);
                });
            } else {
                setApptLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user, userProfile]);

    // 4. Fetch Users for Autocomplete
    useEffect(() => {
        if (!user || userProfile?.role === 'client') return;

        const fetchAllUsers = async () => {
            const q = query(collection(db, "users"), orderBy("name"));
            const snapshot = await getDocs(q);
            const users = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })) as UserProfile[];
            setAllUsersForAutocomplete(users);
        };
        fetchAllUsers();
    }, [user, userProfile]);


    // --- LOGIC HELPERS ---

    const handleEditApptClick = (appt: Appointment) => {
        setEditingAppt(appt);
        setIsEditModalOpen(true);
    };

    const openServiceModal = (service: Service | null = null) => {
        setEditingService(service);
        setIsServiceModalOpen(true);
    };

    const handleDeleteRequest = (type: 'appointment' | 'unit' | 'service', id: string, title: string, message: string) => {
        setDeleteModal({
            isOpen: true,
            type,
            id,
            title,
            message
        });
    };

    const confirmDelete = async () => {
        if (!deleteModal.type || !deleteModal.id) return;

        try {
            if (deleteModal.type === 'appointment') {
                await deleteDoc(doc(db, "appointments", deleteModal.id));
                toast.success("Agendamento excluído.");
            } else if (deleteModal.type === 'unit') {
                await deleteDoc(doc(db, "units", deleteModal.id));
                toast.success("Unidade excluída.");
                setUnitsList(prev => prev.filter(u => u.id !== deleteModal.id));
            } else if (deleteModal.type === 'service') {
                await deleteDoc(doc(db, "services", deleteModal.id));
                toast.success("Serviço excluído.");
                setServicesList(prev => prev.filter(s => s.id !== deleteModal.id));
            }
            setDeleteModal({ isOpen: false, type: null, id: null, title: '', message: '' });
        } catch (error) {
            console.error("Error deleting:", error);
            toast.error("Erro ao excluir.");
        }
    };

    // Conflict Resolution Logic
    const findNextAvailableSlot = (targetApp: Appointment, conflictingApp: Appointment): string | null => {
        // Find unit schedule - unused variable unit removed
        // const unit = unitsList.find(u => u.id === targetApp.clinicId);
        // If no unit found, we can't suggest properly based on unit hours, 
        // but we can try generic logic or just fail.
        // Assuming 08:00 - 18:00 if unit missing or checking raw time.

        // Get busy ranges
        const busyRanges = allRawAppointments
            .filter(app =>
                app.status === 'approved' &&
                app.clinicId === targetApp.clinicId &&
                app.date === targetApp.date
            )
            .map(app => {
                const s = app.time.split(':').map(Number);
                const sMins = s[0] * 60 + s[1];
                return { start: sMins, end: sMins + (app.duration || 30) };
            });

        const conflictEndParts = conflictingApp.time.split(':').map(Number);
        const startCheckMins = conflictEndParts[0] * 60 + conflictEndParts[1];
        const dayEndMins = 18 * 60; // Hardcoded 18:00 end for simplicity here

        for (let time = startCheckMins; time < dayEndMins; time += 10) {
            const proposedEnd = time + (targetApp.duration || 30);
            const isBlocked = busyRanges.some(busy => (time < busy.end) && (proposedEnd > busy.start));

            if (!isBlocked) {
                const h = Math.floor(time / 60);
                const m = time % 60;
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
        }
        return null;
    };

    const handleResolveConflict = async (action: 'force' | 'suggest') => {
        if (!conflictModal.targetApp) return;
        const { targetApp, suggestion } = conflictModal;

        try {
            if (action === 'force') {
                await updateDoc(doc(db, "appointments", targetApp.id), { status: 'approved' });
                toast.success("Agendamento aprovado forçadamente.");
            } else if (action === 'suggest' && suggestion) {
                await updateDoc(doc(db, "appointments", targetApp.id), {
                    status: 'approved',
                    time: suggestion
                });
                toast.success(`Agendamento movido para ${suggestion} e aprovado!`);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao resolver conflito.");
        } finally {
            setConflictModal({ isOpen: false, targetApp: null, conflictingApp: null, suggestion: null });
        }
    };

    const updateStatus = async (id: string, newStatus: string) => {
        try {
            // CONFLICT CHECK FOR APPROVAL
            if (newStatus === 'approved') {
                const targetApp = allRawAppointments.find(a => a.id === id);
                if (targetApp) {
                    const appDuration = targetApp.duration || 30;
                    const startParts = targetApp.time.split(':').map(Number);
                    const startMins = startParts[0] * 60 + startParts[1];
                    const endMins = startMins + appDuration;

                    const conflicting = allRawAppointments.find(app => {
                        if (app.id === id) return false;
                        if (app.status !== 'approved') return false;
                        if (app.clinicId !== targetApp.clinicId) return false;
                        if (app.date !== targetApp.date) return false;

                        const aStart = app.time.split(':').map(Number);
                        const aStartMins = aStart[0] * 60 + aStart[1];
                        const aEndMins = aStartMins + (app.duration || 30);

                        return startMins < aEndMins && endMins > aStartMins;
                    });

                    if (conflicting) {
                        const suggestion = findNextAvailableSlot(targetApp, conflicting);
                        setConflictModal({
                            isOpen: true,
                            targetApp,
                            conflictingApp: conflicting,
                            suggestion
                        });
                        return;
                    }
                }
            }

            await updateDoc(doc(db, "appointments", id), { status: newStatus });
            toast.success(`Status atualizado para: ${newStatus}`);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao atualizar status.");
        }
    };


    const handleLogout = () => setIsLogoutModalOpen(true);
    const confirmLogout = async () => {
        await signOut(auth);
        navigate("/");
    };

    // --- PROFILE MANAGEMENT ---
    const handleOpenProfile = () => {
        if (userProfile) {
            setProfileForm({
                name: userProfile.name || '',
                phone: userProfile.phone || ''
            });
        }
        setIsProfileOpen(true);
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setProfileLoading(true);
        try {
            await updateDoc(doc(db, "users", user.uid), {
                name: profileForm.name,
                phone: profileForm.phone
            });
            setUserProfile(prev => prev ? { ...prev, name: profileForm.name, phone: profileForm.phone } : null);
            toast.success("Perfil atualizado!");
            setIsProfileOpen(false);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao atualizar perfil.");
        } finally {
            setProfileLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!userProfile?.email) return;
        try {
            await sendPasswordResetEmail(auth, userProfile.email);
            toast.success(`Email de redefinição enviado para ${userProfile.email}.`);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao enviar email.");
        }
    };

    // --- ACTIVITY MONITORING ---
    const lastActivityRef = useRef(Date.now());
    useEffect(() => {
        if (!user) return;
        const updateOnline = async () => {
            try {
                await updateDoc(doc(db, "users", user.uid), { lastSeen: new Date(), isOnline: true });
                lastActivityRef.current = Date.now();
            } catch (e) {
                // ignore
            }
        };
        updateOnline();

        const handleActivity = () => {
            const now = Date.now();
            if (now - lastActivityRef.current > 60000) updateOnline();
            lastActivityRef.current = now;
        };

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(e => window.addEventListener(e, handleActivity));

        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastActivityRef.current > 1800000 && !isTimeoutModalOpen) {
                setIsTimeoutModalOpen(true);
            }
        }, 60000);

        return () => {
            events.forEach(e => window.removeEventListener(e, handleActivity));
            clearInterval(interval);
        };
    }, [user, isTimeoutModalOpen]);


    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-teal-900">
            <div className="bg-white p-6 rounded-2xl animate-bounce-gentle">
                <span className="text-teal-700 font-bold flex items-center gap-2">
                    <Shield className="animate-pulse" /> Carregando perfil...
                </span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
            <header className="bg-teal-900 text-white shadow-lg sticky top-0 z-50">
                <div className="container mx-auto px-4 py-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                            <div className="bg-teal-800 p-2 rounded-lg">
                                <Shield size={24} className="text-teal-100" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">Painel Administrativo</h1>
                                <p className="text-xs text-teal-300 font-medium tracking-wider">
                                    {userProfile?.role === 'gm' ? 'GERENTE GERAL' : 'ADMINISTRADOR'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <Link to="/" className="flex items-center gap-2 text-teal-100 hover:text-white transition-colors text-sm font-medium">
                                <HomeIcon size={18} /> Ver Site
                            </Link>
                            <button onClick={handleOpenProfile} className="flex items-center gap-2 hover:bg-teal-800 px-3 py-2 rounded-lg transition-colors group">
                                <div className="bg-teal-700 p-1 rounded-full group-hover:bg-teal-600 transition-colors relative">
                                    <UserIcon size={16} />
                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-teal-800 bg-green-400"></span>
                                </div>
                                <span className="text-sm font-medium">Meu Perfil</span>
                            </button>
                            <button
                                onClick={handleLogout}
                                className="bg-teal-800 hover:bg-red-600 text-white p-2 rounded-lg transition-all shadow-sm hover:shadow-md"
                                title="Sair do Sistema"
                            >
                                <LogOut size={20} />
                            </button>
                        </div>
                    </div>

                    {/* Navigation Tabs */}
                    <nav className="flex gap-1 mt-6 overflow-x-auto pb-1 scrollbar-hide">
                        {[
                            { id: 'appointments', label: 'Agendamentos', icon: Calendar },
                            { id: 'users', label: 'Usuários', icon: Users },
                            { id: 'units', label: 'Unidades', icon: MapPin },
                            { id: 'services', label: 'Serviços', icon: Sparkles },
                            { id: 'settings', label: 'Configurações', icon: Settings },
                        ].map(tab => {
                            if (tab.id === 'users' && userProfile?.role === 'client') return null;
                            if (tab.id === 'units' && userProfile?.role === 'client') return null;
                            if (tab.id === 'services' && userProfile?.role === 'client') return null;
                            if (tab.id === 'settings' && userProfile?.role !== 'gm') return null;

                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-3 rounded-t-lg font-bold text-sm transition-all relative
                                        ${isActive
                                            ? 'text-teal-700 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-10'
                                            : 'text-teal-100 hover:bg-teal-800/50 hover:text-white'
                                        }
                                    `}
                                >
                                    <Icon size={18} className={isActive ? 'text-teal-600' : 'opacity-70'} />
                                    {tab.label}
                                    {isActive && (
                                        <span className="absolute bottom-0 left-0 w-full h-1 bg-teal-500 rounded-t-full"></span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </header>
            <main className="flex-1 container mx-auto px-4 py-8">
                {/* APPOINTMENTS TAB */}
                {activeTab === 'appointments' && userProfile && (
                    <AppointmentsTab
                        allAppointments={allRawAppointments}
                        unitsList={unitsList}
                        allUsersForAutocomplete={allUsersForAutocomplete}
                        userProfile={userProfile}
                        onUpdateStatus={updateStatus}
                        onEdit={handleEditApptClick}
                        onDelete={id => handleDeleteRequest('appointment', id, 'Excluir Agendamento', 'Tem certeza que deseja excluir?')}
                        loading={apptLoading}
                    />
                )}

                {/* USERS TAB */}
                {activeTab === 'users' && userProfile && (
                    <UsersTab userProfile={userProfile} />
                )}

                {/* SERVICES TAB */}
                {['gm', 'admin'].includes(userProfile?.role || '') && activeTab === 'services' && userProfile && (
                    <ServicesTab
                        servicesList={servicesList}
                        loading={servicesLoading}
                        userProfile={userProfile}
                        onEdit={openServiceModal}
                        onDelete={service => handleDeleteRequest('service', service.id, 'Excluir Serviço', `Excluir ${service.name}?`)}
                    />
                )}

                {/* UNITS TAB */}
                {['gm', 'admin'].includes(userProfile?.role || '') && activeTab === 'units' && userProfile && (
                    <UnitsTab
                        unitsList={unitsList}
                        loading={unitsLoading}
                        userProfile={userProfile}
                        onDelete={unit => handleDeleteRequest('unit', unit.id, 'Excluir Unidade', `Excluir ${unit.name}?`)}
                    />
                )}

                {/* SETTINGS TAB */}
                {activeTab === 'settings' && userProfile?.role === 'gm' && (
                    <SettingsTab userProfile={userProfile} />
                )}
            </main>

            {/* --- GLOBALLY ACCESSIBLE MODALS --- */}

            <LogoutModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={confirmLogout}
            />

            <TimeoutModal
                isOpen={isTimeoutModalOpen}
                onContinue={() => setIsTimeoutModalOpen(false)}
                onConfirmLogout={confirmLogout}
            />

            <ServiceModal
                isOpen={isServiceModalOpen}
                onClose={() => setIsServiceModalOpen(false)}
                serviceToEdit={editingService}
                unitsList={unitsList}
            />

            <AppointmentEditModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                apptToEdit={editingAppt}
                unitsList={unitsList}
                servicesList={servicesList}
            />

            <DeleteConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, type: null, id: null, title: '', message: '' })}
                onConfirm={confirmDelete}
                title={deleteModal.title}
                message={deleteModal.message}
            />

            <ConflictModal
                isOpen={conflictModal.isOpen}
                onClose={() => setConflictModal({ isOpen: false, targetApp: null, conflictingApp: null, suggestion: null })}
                conflictData={conflictModal.isOpen && conflictModal.targetApp && conflictModal.conflictingApp ? {
                    targetApp: conflictModal.targetApp,
                    conflictingApp: conflictModal.conflictingApp,
                    suggestion: conflictModal.suggestion || undefined
                } : null}
                onResolve={handleResolveConflict}
                onEditManual={(app) => {
                    setConflictModal({ isOpen: false, targetApp: null, conflictingApp: null, suggestion: null });
                    handleEditApptClick(app);
                }}
            />

            {/* Profile Modal Inner (Keeping as inline or check provided code, it was inline) */}
            {isProfileOpen && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">
                        <div className="bg-teal-900 text-white p-6 flex justify-between items-center">
                            <h2 className="text-xl font-bold font-serif flex items-center gap-2">
                                <UserIcon className="text-teal-300" /> Meu Perfil
                            </h2>
                            <button onClick={() => setIsProfileOpen(false)} className="text-teal-300 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={profileForm.name}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Telefone</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    required
                                    maxLength={15}
                                    value={profileForm.phone}
                                    onChange={(e) => setProfileForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                    placeholder="(99) 99999-9999"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-1">CPF</label>
                                    <input
                                        type="text"
                                        value={userProfile?.cpf || ''}
                                        disabled
                                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-1">Função</label>
                                    <input
                                        type="text"
                                        value={userProfile?.role === 'client' ? 'Paciente' : userProfile?.role?.toUpperCase()}
                                        disabled
                                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                                    />
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleResetPassword}
                                className="w-full py-2 bg-yellow-50 text-yellow-700 font-bold rounded-xl hover:bg-yellow-100 transition-colors text-sm"
                            >
                                Redefinir Senha
                            </button>
                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsProfileOpen(false)}
                                    className="flex-1 py-2 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={profileLoading}
                                    className="flex-1 py-2 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {profileLoading ? <Loader2 className="animate-spin" size={16} /> : 'Salvar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
