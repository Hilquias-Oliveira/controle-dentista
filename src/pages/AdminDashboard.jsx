import React, { useEffect, useState, useRef } from 'react';
import { signOut, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc, where, setDoc, addDoc, limit, startAfter, getCountFromServer, startAt, endAt, endBefore, limitToLast, getDocs } from 'firebase/firestore';
import { LogOut, Check, X, Calendar, Clock, User, Phone, Trash2, Home as HomeIcon, Shield, Edit2, ShieldAlert, Ban, Loader2, Users, Settings, MapPin, Sparkles, ChevronLeft, ChevronRight, Filter, Search, ChevronUp, ChevronDown, ArrowUpDown, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhone, formatCPF } from '../utils/formatters';



const AdminDashboard = () => {
    const navigate = useNavigate(); // Restore navigation
    const [loading, setLoading] = useState(true); // Restore loading state
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [activeTab, setActiveTab] = useState('appointments'); // Restore activeTab

    // --- AUTH & PROFILE LOADING ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                try {
                    const docRef = doc(db, "users", currentUser.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        setUserProfile(docSnap.data());
                    } else {
                        console.error("User profile not found in Firestore. Creating default profile...");
                        // Auto-recover: Create a GM profile for this user to restore access
                        await setDoc(docRef, {
                            email: currentUser.email,
                            name: currentUser.displayName || 'Admin Recovered',
                            role: 'gm',
                            createdAt: new Date(),
                            phone: '',
                            cpf: ''
                        });
                        setUserProfile({
                            email: currentUser.email,
                            name: currentUser.displayName || 'Admin Recovered',
                            role: 'gm'
                        });
                        toast.success("Perfil de administrador restaurado.");
                    }
                } catch (error) {
                    console.error("Error fetching user profile:", error);
                }
            } else {
                setUser(null);
                setUserProfile(null);
                navigate("/admin/login"); // Redirect to login if not authenticated
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, [navigate]);
    // --- APPOINTMENTS PAGINATION & FILTER STATE ---
    const [appointments, setAppointments] = useState([]);
    const [apptItemsPerPage, setApptItemsPerPage] = useState(10);
    const [apptCurrentPage, setApptCurrentPage] = useState(1);
    const [apptTotalItems, setApptTotalItems] = useState(0);
    const [apptLastDocs, setApptLastDocs] = useState([]); // Array of cursors for navigation history
    // Filters
    const [apptSearchTerm, setApptSearchTerm] = useState('');
    const [apptFilterDate, setApptFilterDate] = useState('');
    const [apptFilterShift, setApptFilterShift] = useState('all'); // all, morning, afternoon, night
    const [apptFilterUnit, setApptFilterUnit] = useState('all');

    // Sorting
    const [sortConfig, setSortConfig] = useState({ field: 'date', direction: 'asc' });

    // --- USERS AUTOCOMPLETE STATE ---
    const [allUsersForAutocomplete, setAllUsersForAutocomplete] = useState([]);

    // Fetch ALL Users for Autocomplete (Lite Version)
    useEffect(() => {
        if (!user || userProfile?.role === 'client') return;

        // Fetch only names and IDs for autocomplete
        const fetchAllUsers = async () => {
            const q = query(collection(db, "users"), orderBy("name"));
            const snapshot = await getDocs(q);
            const users = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));
            setAllUsersForAutocomplete(users);
        };
        fetchAllUsers();
    }, [user, userProfile]);

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingAppt, setEditingAppt] = useState(null);
    const [editForm, setEditForm] = useState({
        clinicId: '',
        serviceId: '',
        date: '',
        time: ''
    });

    const handleEditClick = (appt) => {
        setEditingAppt(appt);
        setEditForm({
            clinicId: appt.clinicId || '',
            serviceId: appt.serviceId || '',
            date: appt.date || '',
            time: appt.time || ''
        });
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingAppt) return;
        try {
            // Find names for display update
            const selectedUnit = unitsList.find(u => u.id === editForm.clinicId);
            const selectedService = servicesList.find(s => s.id === editForm.serviceId);

            await updateDoc(doc(db, "appointments", editingAppt.id), {
                clinicId: editForm.clinicId,
                clinicName: selectedUnit ? selectedUnit.name : editingAppt.clinicName,
                serviceId: editForm.serviceId,
                serviceName: selectedService ? selectedService.name : editingAppt.serviceName,
                date: editForm.date,
                time: editForm.time
            });
            toast.success("Agendamento atualizado com sucesso!");
            setIsEditModalOpen(false);
        } catch (error) {
            console.error("Error updating appointment:", error);
            toast.error("Erro ao atualizar agendamento.");
        }
    };

    const [siteConfig, setSiteConfig] = useState({ whatsapp: '' });

    // Fetch Site Config
    useEffect(() => {
        if (!user) return;
        const fetchConfig = async () => {
            try {
                const docRef = doc(db, "settings", "global");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSiteConfig(docSnap.data());
                } else {
                    // Create default
                    await setDoc(docRef, { whatsapp: '5547999999999' });
                    setSiteConfig({ whatsapp: '5547999999999' });
                }
            } catch (error) {
                console.error("Error fetching config:", error);
            }
        };
        fetchConfig();
    }, [user]);

    const handleSaveConfig = async (e) => {
        e.preventDefault();
        try {
            await setDoc(doc(db, "settings", "global"), siteConfig, { merge: true });
            toast.success("Configurações salvas!");
        } catch (error) {
            console.error("Error saving config:", error);
            toast.error("Erro ao salvar configurações.");
        }
    };

    const handleSort = (field) => {
        setSortConfig(prev => ({
            field,
            direction: prev.field === field && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const [apptLoading, setApptLoading] = useState(true);

    // RAW Data (Central Source of Truth)
    const [allRawAppointments, setAllRawAppointments] = useState([]);

    // Pending List (Derived from Raw)
    const [pendingAppointmentsList, setPendingAppointmentsList] = useState([]);

    // 1. Fetch RAW Data (Recent 500 items - No complex indexes needed)
    useEffect(() => {
        if (!user) return;

        setApptLoading(true);
        const dbRef = collection(db, "appointments");

        // Simple query: Get recent items. No complex filters to avoid index requirements.
        // We filter everything client-side.
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
            }));
            setAllRawAppointments(raw);
            setApptLoading(false);
        }, (error) => {
            console.error("Error fetching raw appointments:", error);
            // Fallback for missing date index if absolutely fresh (rare)
            if (error.code === 'failed-precondition') {
                // Try without ordering if date index fails (very basic fallback)
                const fallbackQ = query(dbRef, limit(100));
                getDocs(fallbackQ).then(snap => {
                    const fallbackRaw = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setAllRawAppointments(fallbackRaw);
                    setApptLoading(false);
                });
            } else {
                setApptLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user, userProfile]);

    // 2. Process Data (Filter, Sort, Paginate)
    useEffect(() => {
        // A. Separate Pending vs Confirmed
        const pending = allRawAppointments.filter(app => app.status === 'pending_approval');
        setPendingAppointmentsList(pending);

        // B. Filter Confirmed List
        let filtered = allRawAppointments.filter(app => app.status === 'approved' || app.status === 'completed' || app.status === 'cancelled' || app.status === 'rejected');

        // Only show APPROVED in the main table usually, or maybe history?
        // User request "Confirmed Agenda" implies active/approved.
        // Let's stick to 'approved' for the main agenda view to be clean, 
        // OR allow all history. Let's assume 'approved' for the main "Agenda Confirmada" table per previous logic.
        // Actually, let's include 'approved' mainly. 
        // If we want history, we might need a toggle. For now, strict on 'approved' helps clarity.
        filtered = filtered.filter(app => app.status === 'approved');

        // Apply Search
        if (apptSearchTerm) {
            const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
            const term = normalize(apptSearchTerm);
            filtered = filtered.filter(app =>
                normalize(app.clientName).includes(term) ||
                normalize(app.serviceName).includes(term) ||
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

        // C. Sort
        filtered.sort((a, b) => {
            let fieldA = a[sortConfig.field];
            let fieldB = b[sortConfig.field];

            if (!fieldA) fieldA = '';
            if (!fieldB) fieldB = '';

            let comparison = 0;
            if (fieldA > fieldB) comparison = 1;
            else if (fieldA < fieldB) comparison = -1;

            if (sortConfig.direction === 'desc') comparison *= -1;

            // Secondary Sort: Time
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

        // D. Update Total & Paginate
        setApptTotalItems(filtered.length);

        const startIndex = (apptCurrentPage - 1) * apptItemsPerPage;
        const sliced = filtered.slice(startIndex, startIndex + apptItemsPerPage);

        setAppointments(sliced);

    }, [allRawAppointments, apptSearchTerm, apptFilterDate, apptFilterUnit, apptFilterShift, sortConfig, apptCurrentPage, apptItemsPerPage]);




    // Old Server-side logic removed in favor of client-side processing above
    // to avoid complex index requirements.

    // Pagination Handlers
    const handleApptNextPage = () => {
        if (apptCurrentPage * apptItemsPerPage < apptTotalItems) {
            setApptCurrentPage(prev => prev + 1);
        }
    };

    const handleApptPrevPage = () => {
        if (apptCurrentPage > 1) {
            setApptCurrentPage(prev => prev - 1);
        }
    };

    const handleApptLimitChange = (e) => {
        setApptItemsPerPage(Number(e.target.value));
        setApptCurrentPage(1);
        setApptLastDocs([]); // Reset cursors
    };



    // --- USERS PAGINATION & SEARCH STATE ---
    const [usersList, setUsersList] = useState([]);
    // allUsersForAutocomplete moved to top
    const [usersItemsPerPage, setUsersItemsPerPage] = useState(10);
    const [usersCurrentPage, setUsersCurrentPage] = useState(1);
    const [usersTotalItems, setUsersTotalItems] = useState(0);
    const [usersLastDocs, setUsersLastDocs] = useState([]);
    const [usersLoading, setUsersLoading] = useState(true);
    const [usersSearchTerm, setUsersSearchTerm] = useState('');

    // Fetch Users (Staff Only) - Pagination & Search
    useEffect(() => {
        if (!user || userProfile?.role === 'client') return;

        setUsersLoading(true);
        const usersRef = collection(db, "users");
        let q;

        const fetchUsers = async () => {
            try {
                if (userProfile.role === 'gm' || userProfile.role === 'admin') {
                    q = query(usersRef, orderBy("name"));
                } else if (userProfile.role === 'supervisor') {
                    q = query(usersRef, orderBy("name"));
                }

                const snapshot = await getDocs(q);
                let users = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Client-side Accent-Insensitive Filtering
                if (usersSearchTerm) {
                    const normalize = (str) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase() : "";
                    const term = normalize(usersSearchTerm);
                    users = users.filter(u => normalize(u.name).includes(term));
                }

                setUsersTotalItems(users.length);

                // Pagination
                const startIndex = (usersCurrentPage - 1) * usersItemsPerPage;
                const slicedUsers = users.slice(startIndex, startIndex + usersItemsPerPage);

                setUsersList(slicedUsers);
                setUsersLoading(false);

                if (!snapshot.empty) {
                    const lastVisible = snapshot.docs[snapshot.docs.length - 1];
                    setUsersLastDocs(prev => {
                        const newDocs = [...prev];
                        newDocs[usersCurrentPage - 1] = lastVisible;
                        return newDocs;
                    });
                }
            } catch (error) {
                console.error("Error fetching users:", error);
                setUsersLoading(false);
            }
        };

        fetchUsers();
    }, [userProfile, usersItemsPerPage, usersCurrentPage, usersSearchTerm]);

    const handleUsersNextPage = () => {
        if (usersCurrentPage * usersItemsPerPage < usersTotalItems) {
            setUsersCurrentPage(prev => prev + 1);
        }
    };

    const handleUsersPrevPage = () => {
        if (usersCurrentPage > 1) {
            setUsersCurrentPage(prev => prev - 1);
        }
    };

    const handleUsersLimitChange = (e) => {
        setUsersItemsPerPage(Number(e.target.value));
        setUsersCurrentPage(1);
        setUsersLastDocs([]);
    };




    // --- USER MANAGEMENT STATE ---
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [userForm, setUserForm] = useState({
        name: '',
        email: '', // Only for display/referenced if needed
        phone: '',
        cpf: '',
        role: 'client'
    });

    const handleOpenUserEdit = (user) => {
        setEditingUser(user);
        setUserForm({
            name: user.name || '',
            email: user.email || '',
            phone: user.phone || '',
            cpf: user.cpf || '',
            role: user.role || 'client'
        });
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await updateDoc(doc(db, "users", editingUser.id), {
                    name: userForm.name,
                    phone: userForm.phone,
                    role: userForm.role
                    // Email/CPF usually not editable here or require auth admin SDK
                });
                toast.success("Usuário atualizado!");
                setIsUserModalOpen(false);
                setEditingUser(null);
            }
        } catch (error) {
            console.error(error);
            toast.error("Erro ao atualizar usuário.");
        }
    };

    const handleDeleteUser = async (user) => {
        handleDeleteRequest('user', user.id, 'Excluir Usuário', `Excluir usuário ${user.name}?`);
    };

    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

    // Triggered by the sidebar button
    const handleLogout = () => {
        setIsLogoutModalOpen(true);
    };

    const confirmLogout = async () => {
        await signOut(auth);
        navigate("/");
    };

    // --- PROFILE MANAGEMENT STATE ---
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileForm, setProfileForm] = useState({ name: '', phone: '' });

    const handleOpenProfile = () => {
        if (userProfile) {
            setProfileForm({
                name: userProfile.name || '',
                phone: userProfile.phone || ''
            });
        }
        setIsProfileOpen(true);
    };

    const handleProfileChange = (e) => {
        const { name, value } = e.target;
        if (name === 'phone') {
            setProfileForm(prev => ({ ...prev, [name]: formatPhone(value) }));
        } else {
            setProfileForm(prev => ({ ...prev, [name]: value }));
        }
    };
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setProfileLoading(true);
        try {
            const docRef = doc(db, "users", user.uid);
            await updateDoc(docRef, {
                name: profileForm.name,
                phone: profileForm.phone
            });
            // Update local state without reload
            setUserProfile(prev => ({ ...prev, name: profileForm.name, phone: profileForm.phone }));
            toast.success("Perfil atualizado com sucesso!");
            setIsProfileOpen(false);
        } catch (error) {
            console.error("Error updating profile:", error);
            toast.error("Erro ao atualizar perfil.");
        } finally {
            setProfileLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!userProfile?.email) return;
        try {
            await sendPasswordResetEmail(auth, userProfile.email);
            toast.success(`Um email de redefinição de senha foi enviado para ${userProfile.email}. Verifique sua caixa de entrada (e spam).`);
        } catch (error) {
            console.error("Error sending reset email:", error);
            toast.error("Erro ao enviar email. Tente novamente mais tarde.");
        }
    };

    // --- ONLINE PRESENCE & SESSION TIMEOUT ---
    const lastActivityRef = useRef(Date.now());
    const [isTimeoutModalOpen, setIsTimeoutModalOpen] = useState(false);

    const updateOnlineStatus = async () => {
        if (!user) return;
        try {
            await updateDoc(doc(db, "users", user.uid), {
                lastSeen: new Date(),
                isOnline: true
            });
            lastActivityRef.current = Date.now();
        } catch (error) {
            console.error("Error updating online status:", error);
        }
    };

    useEffect(() => {
        if (!user) return;

        // Initial set
        updateOnlineStatus();

        const handleActivity = () => {
            const now = Date.now();
            if (now - lastActivityRef.current > 60000) { // Throttle 1 min
                updateOnlineStatus();
            }
            lastActivityRef.current = now;
        };

        // Events to track activity
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
        events.forEach(event => window.addEventListener(event, handleActivity));

        // Check for inactivity every minute
        const interval = setInterval(() => {
            const now = Date.now();
            // If inactive for more than 30 minutes (1800000ms)
            if (now - lastActivityRef.current > 1800000 && !isTimeoutModalOpen) {
                setIsTimeoutModalOpen(true);
            }
        }, 60000);

        return () => {
            events.forEach(event => window.removeEventListener(event, handleActivity));
            clearInterval(interval);
            // Optional: Mark offline on unmount? 
            // await updateDoc(doc(db, "users", user.uid), { isOnline: false }); 
        };
    }, [user, isTimeoutModalOpen]);

    // --- UNITS MANAGEMENT ---
    const [unitsList, setUnitsList] = useState([]);

    // Default Schedule Structure (Enhanced for Split Shifts)
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

    const [unitForm, setUnitForm] = useState({
        name: '',
        address: '',
        phone: '',
        whatsapp: '',
        color: 'teal',
        schedule: defaultSchedule,
        activeModalTab: 'info'
    });
    const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
    const [editingUnitId, setEditingUnitId] = useState(null);
    const [activeModalTab, setActiveModalTab] = useState('info');

    // Helpers for Schedule Management
    const toggleDayActive = (day) => {
        setUnitForm(prev => ({
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

    const updateDayRange = (day, index, field, value) => {
        setUnitForm(prev => {
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

    const addDayRange = (day) => {
        setUnitForm(prev => ({
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

    const removeDayRange = (day, index) => {
        setUnitForm(prev => {
            const newRanges = prev.schedule.weekly[day].ranges.filter((_, i) => i !== index);
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

    // Exceptions Helpers
    const [newException, setNewException] = useState({
        date: '',
        type: 'closed',
        ranges: [{ start: '08:00', end: '12:00' }]
    });

    const addException = () => {
        if (!newException.date) return;
        setUnitForm(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                exceptions: [...(prev.schedule.exceptions || []), newException]
            }
        }));
        setNewException({ date: '', type: 'closed', ranges: [{ start: '08:00', end: '12:00' }] });
    };

    const removeException = (index) => {
        setUnitForm(prev => ({
            ...prev,
            schedule: {
                ...prev.schedule,
                exceptions: prev.schedule.exceptions.filter((_, i) => i !== index)
            }
        }));
    };

    const addExceptionRange = () => {
        setNewException(prev => ({
            ...prev,
            ranges: [...prev.ranges, { start: '13:00', end: '17:00' }]
        }));
    };

    const removeExceptionRange = (idx) => {
        setNewException(prev => ({
            ...prev,
            ranges: prev.ranges.filter((_, i) => i !== idx)
        }));
    };

    const updateExceptionRange = (idx, field, value) => {
        setNewException(prev => {
            const newRanges = [...prev.ranges];
            newRanges[idx] = { ...newRanges[idx], [field]: value };
            return { ...prev, ranges: newRanges };
        });
    };

    // Day Labels for UI (Ordered)
    const weekDaysOrdered = [
        { key: 'seg', label: 'Segunda-feira' },
        { key: 'ter', label: 'Terça-feira' },
        { key: 'qua', label: 'Quarta-feira' },
        { key: 'qui', label: 'Quinta-feira' },
        { key: 'sex', label: 'Sexta-feira' },
        { key: 'sab', label: 'Sábado' },
        { key: 'dom', label: 'Domingo' }
    ];

    // Services State

    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingServiceId, setEditingServiceId] = useState(null);
    const [serviceForm, setServiceForm] = useState({
        name: '',
        price: '',
        displayPrice: true,
        description: '',
        allowedUnits: [] // Array of Unit IDs
    });



    // --- SETTINGS STATE ---
    const [clinicSettings, setClinicSettings] = useState({
        address: '',
        phone: '',
        whatsapp: '',
        openingTime: '08:00',
        closingTime: '18:00',
        workingDays: ['seg', 'ter', 'qua', 'qui', 'sex']
    });
    const [settingsLoading, setSettingsLoading] = useState(false);

    // Fetch Settings
    useEffect(() => {
        if (!['gm', 'admin'].includes(userProfile?.role)) return;
        const fetchSettings = async () => {
            try {
                const docRef = doc(db, "settings", "clinic");
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClinicSettings(prev => ({ ...prev, ...docSnap.data() }));
                }
            } catch (error) {
                console.error("Error fetching settings:", error);
            }
        };
        fetchSettings();
    }, [userProfile]);

    const handleSaveSettings = async (e) => {
        e.preventDefault();
        setSettingsLoading(true);
        try {
            await setDoc(doc(db, "settings", "clinic"), clinicSettings);
            toast.success("Configurações salvas!");
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Erro ao salvar configurações.");
        } finally {
            setSettingsLoading(false);
        }
    };

    // --- UNITS PAGINATION STATE ---
    const [unitsItemsPerPage, setUnitsItemsPerPage] = useState(10);
    const [unitsCurrentPage, setUnitsCurrentPage] = useState(1);
    const [unitsTotalItems, setUnitsTotalItems] = useState(0);
    const [unitsLastDocs, setUnitsLastDocs] = useState([]);
    const [unitsLoading, setUnitsLoading] = useState(true);

    // Fetch Units with Pagination
    useEffect(() => {
        if (!['gm', 'admin'].includes(userProfile?.role)) return;

        setUnitsLoading(true);
        const baseQuery = query(collection(db, "units"), orderBy("name"));

        // Get Total Count
        getCountFromServer(baseQuery).then(snapshot => {
            setUnitsTotalItems(snapshot.data().count);
        }).catch(err => console.error("Error counting units:", err));

        // Build Paginated Query
        let q = query(baseQuery, limit(unitsItemsPerPage));

        if (unitsCurrentPage > 1 && unitsLastDocs[unitsCurrentPage - 2]) {
            q = query(baseQuery, startAfter(unitsLastDocs[unitsCurrentPage - 2]), limit(unitsItemsPerPage));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const units = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUnitsList(units);
            setUnitsLoading(false);

            if (!snapshot.empty) {
                const lastVisible = snapshot.docs[snapshot.docs.length - 1];
                setUnitsLastDocs(prev => {
                    const newDocs = [...prev];
                    newDocs[unitsCurrentPage - 1] = lastVisible;
                    return newDocs;
                });
            }
        }, (error) => {
            console.error("Error fetching units:", error);
            setUnitsLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile, unitsItemsPerPage, unitsCurrentPage]);

    const handleUnitsNextPage = () => {
        if (unitsCurrentPage * unitsItemsPerPage < unitsTotalItems) {
            setUnitsCurrentPage(prev => prev + 1);
        }
    };

    const handleUnitsPrevPage = () => {
        if (unitsCurrentPage > 1) {
            setUnitsCurrentPage(prev => prev - 1);
        }
    };

    const handleUnitsLimitChange = (e) => {
        setUnitsItemsPerPage(Number(e.target.value));
        setUnitsCurrentPage(1);
        setUnitsLastDocs([]);
    };

    // --- SERVICES PAGINATION STATE ---
    const [servicesList, setServicesList] = useState([]);
    const [servicesItemsPerPage, setServicesItemsPerPage] = useState(10);
    const [servicesCurrentPage, setServicesCurrentPage] = useState(1);
    const [servicesTotalItems, setServicesTotalItems] = useState(0);
    const [servicesLastDocs, setServicesLastDocs] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(true);

    // Fetch Services with Pagination
    useEffect(() => {
        if (!['gm', 'admin'].includes(userProfile?.role)) return;

        setServicesLoading(true);
        const baseQuery = query(collection(db, "services"), orderBy("name"));

        // Get Total Count
        getCountFromServer(baseQuery).then(snapshot => {
            setServicesTotalItems(snapshot.data().count);
        }).catch(err => console.error("Error counting services:", err));

        // Build Paginated Query
        let q = query(baseQuery, limit(servicesItemsPerPage));

        if (servicesCurrentPage > 1 && servicesLastDocs[servicesCurrentPage - 2]) {
            q = query(baseQuery, startAfter(servicesLastDocs[servicesCurrentPage - 2]), limit(servicesItemsPerPage));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const services = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setServicesList(services);
            setServicesLoading(false);

            if (!snapshot.empty) {
                const lastVisible = snapshot.docs[snapshot.docs.length - 1];
                setServicesLastDocs(prev => {
                    const newDocs = [...prev];
                    newDocs[servicesCurrentPage - 1] = lastVisible;
                    return newDocs;
                });
            }
        }, (error) => {
            console.error("Error fetching services:", error);
            setServicesLoading(false);
        });

        return () => unsubscribe();
    }, [userProfile, servicesItemsPerPage, servicesCurrentPage]);

    const handleServicesNextPage = () => {
        if (servicesCurrentPage * servicesItemsPerPage < servicesTotalItems) {
            setServicesCurrentPage(prev => prev + 1);
        }
    };

    const handleServicesPrevPage = () => {
        if (servicesCurrentPage > 1) {
            setServicesCurrentPage(prev => prev - 1);
        }
    };

    const handleServicesLimitChange = (e) => {
        setServicesItemsPerPage(Number(e.target.value));
        setServicesCurrentPage(1);
        setServicesLastDocs([]);
    };



    // --- SERVICE HANDLERS ---
    const handleSaveService = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                name: serviceForm.name,
                price: parseFloat(serviceForm.price) || 0,
                duration: parseInt(serviceForm.duration) || 30, // Default 30 min
                displayPrice: serviceForm.displayPrice,
                description: serviceForm.description || '',
                allowedUnits: serviceForm.allowedUnits || []
            };

            if (editingServiceId) {
                await updateDoc(doc(db, "services", editingServiceId), payload);
                toast.success("Serviço atualizado!");
            } else {
                await addDoc(collection(db, "services"), payload);
                toast.success("Serviço criado!");
            }
            setIsServiceModalOpen(false);
            setServiceForm({ name: '', price: '', displayPrice: true, description: '', allowedUnits: [] });
            setEditingServiceId(null);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar serviço.");
        }
    };

    const handleDeleteService = async (id) => {
        handleDeleteRequest('service', id, 'Excluir Serviço', 'Excluir este serviço?');
    };

    const openServiceModal = (service = null) => {
        if (service) {
            setServiceForm({
                name: service.name,
                price: service.price,
                duration: service.duration || 30,
                displayPrice: service.displayPrice !== false, // Default true
                description: service.description || '',
                allowedUnits: service.allowedUnits || [] // Load existing or empty
            });
            setEditingServiceId(service.id);
        } else {
            setServiceForm({ name: '', price: '', duration: 30, displayPrice: true, description: '', allowedUnits: [] });
            setEditingServiceId(null);
        }
        setIsServiceModalOpen(true);
    };



    const handleSaveUnit = async (e) => {
        e.preventDefault();
        if (!['gm', 'admin'].includes(userProfile?.role)) return;

        try {
            if (editingUnitId) {
                await updateDoc(doc(db, "units", editingUnitId), unitForm);
                toast.success("Unidade atualizada!");
            } else {
                await addDoc(collection(db, "units"), unitForm);
                toast.success("Unidade criada!");
            }
            setIsUnitModalOpen(false);
            setUnitForm({
                name: '',
                address: '',
                phone: '',
                whatsapp: '',
                color: 'teal',
                schedule: defaultSchedule
            });
            setEditingUnitId(null);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao salvar unidade.");
        }
    };

    const handleDeleteUnit = async (id) => {
        handleDeleteRequest('unit', id, 'Excluir Unidade', 'Tem certeza que deseja excluir esta unidade?');
    };

    const handleSeedUnits = async () => {
        if (!confirm("Isso adicionará as unidades padrão. Continuar?")) return;
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

    const openUnitModal = (unit = null) => {
        setActiveModalTab('info');
        if (unit) {
            // Deep clone schedule to avoid mutating original or having references issues
            let schedule = unit.schedule ? JSON.parse(JSON.stringify(unit.schedule)) : JSON.parse(JSON.stringify(defaultSchedule));

            // HYDRATION: Convert Legacy Data to New Structure (Ranges)
            if (schedule.weekly) {
                Object.keys(schedule.weekly).forEach(day => {
                    const dayConfig = schedule.weekly[day];
                    // If active but no ranges, create ranges from start/end
                    if (!dayConfig.ranges && dayConfig.start && dayConfig.end) {
                        dayConfig.ranges = [{ start: dayConfig.start, end: dayConfig.end }];
                    }
                    // Ensure ranges is at least an empty array if missing
                    if (!dayConfig.ranges) {
                        dayConfig.ranges = [];
                    }
                });
            }

            setUnitForm({
                ...unit,
                schedule: schedule
            });
            setEditingUnitId(unit.id);
        } else {
            setUnitForm({
                name: '',
                address: '',
                phone: '',
                whatsapp: '',
                color: 'teal',
                schedule: JSON.parse(JSON.stringify(defaultSchedule)) // Ensure fresh copy
            });
            setEditingUnitId(null);
        }
        setIsUnitModalOpen(true);
    };

    // handleLogout is now defined above to toggle the modal

    // --- CONFLICT MODAL STATE ---
    const [conflictModal, setConflictModal] = useState({
        isOpen: false,
        targetApp: null,
        conflictingApp: null,
        suggestion: null
    });

    const findNextAvailableSlot = (targetApp, conflictingApp) => {
        // Find unit schedule
        const unit = unitsList.find(u => u.id === targetApp.clinicId);
        if (!unit) return null;

        // Parse date
        // targetApp.date is YYYY-MM-DD
        // We need a Date object to check day of week
        const dateParts = targetApp.date.split('-').map(Number);
        const dateObj = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);

        // Get busy ranges for that day (approved only)
        const busyRanges = appointments
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

        // Get Schedule Ranges
        // Reuse logic from generateTimeSlots roughly... or just iterate 10 mins from conflict end
        // Simplification: Check every 10 mins starting from Conflicting App End Time

        const conflictEndParts = conflictingApp.time.split(':').map(Number);
        const startCheckMins = conflictEndParts[0] * 60 + conflictEndParts[1];
        const dayEndMins = 18 * 60; // Assume 18:00 limit for safety or check unit closing

        // Simple iteration
        for (let time = startCheckMins; time < dayEndMins; time += 10) {
            const proposedEnd = time + (targetApp.duration || 30);

            // Check if this slot overlaps with ANY busy range
            const isBlocked = busyRanges.some(busy => {
                return (time < busy.end) && (proposedEnd > busy.start);
            });

            if (!isBlocked) {
                // Return formatted time
                const h = Math.floor(time / 60);
                const m = time % 60;
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            }
        }
        return null;
    };

    const handleResolveConflict = async (action) => {
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

    const updateStatus = async (id, newStatus) => {
        try {
            // CONFLICT CHECK FOR APPROVAL
            if (newStatus === 'approved') {
                // 1. Get the appointment to be approved
                const targetApp = appointments.find(a => a.id === id) || pendingAppointmentsList.find(a => a.id === id);
                if (targetApp) {
                    const appDuration = targetApp.duration || 30;
                    const startParts = targetApp.time.split(':').map(Number);
                    const startMins = startParts[0] * 60 + startParts[1];
                    const endMins = startMins + appDuration;

                    // 2. Check against other APPROVED appointments
                    const conflicting = appointments.find(app => {
                        if (app.id === id) return false; // Skip self
                        if (app.status !== 'approved') return false;
                        if (app.clinicId !== targetApp.clinicId) return false;
                        if (app.date !== targetApp.date) return false;

                        const aStart = app.time.split(':').map(Number);
                        const aStartMins = aStart[0] * 60 + aStart[1];
                        const aEndMins = aStartMins + (app.duration || 30);

                        // Overlap Check: StartA < EndB && EndA > StartB
                        return startMins < aEndMins && endMins > aStartMins;
                    });

                    if (conflicting) {
                        // Found Conflict!
                        const suggestion = findNextAvailableSlot(targetApp, conflicting);
                        setConflictModal({
                            isOpen: true,
                            targetApp,
                            conflictingApp: conflicting,
                            suggestion
                        });
                        return; // ABORT STANDARD UPDATE
                    }
                }
            }

            await updateDoc(doc(db, "appointments", id), {
                status: newStatus
            });
            toast.success(`Status atualizado para: ${newStatus === 'approved' ? 'Aprovado' : newStatus === 'rejected' ? 'Rejeitado' : 'Cancelado'}`);
        } catch (error) {
            console.error(error);
            toast.error("Erro ao atualizar status.");
        }
    };

    // --- DELETE MODAL STATE ---
    const [deleteModal, setDeleteModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: null, // 'appointment', 'user', 'unit', 'service'
        id: null
    });

    const handleDeleteRequest = (type, id, title, message) => {
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
            } else if (deleteModal.type === 'user') {
                await deleteDoc(doc(db, "users", deleteModal.id));
                toast.success("Usuário excluído.");
            } else if (deleteModal.type === 'unit') {
                await deleteDoc(doc(db, "units", deleteModal.id));
                toast.success("Unidade excluída.");
            } else if (deleteModal.type === 'service') {
                await deleteDoc(doc(db, "services", deleteModal.id));
                toast.success("Serviço excluído.");
            }
            setDeleteModal({ isOpen: false, type: null, id: null, title: '', message: '' });
        } catch (error) {
            console.error("Error deleting:", error);
            toast.error("Erro ao excluir.");
        }
    };

    const handleDelete = async (id) => {
        handleDeleteRequest('appointment', id, 'Excluir Agendamento', 'Tem certeza que deseja excluir permanentemente?');
    };

    // --- Role Helpers ---
    const canApprove = ['gm', 'admin', 'supervisor'].includes(userProfile?.role);
    const canReject = ['gm', 'admin', 'supervisor'].includes(userProfile?.role);
    const canDelete = ['gm'].includes(userProfile?.role);
    const canEditClient = ['gm', 'admin'].includes(userProfile?.role); // Edit phone/name

    // Client specific
    const isClient = userProfile?.role === 'client';

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-teal-900">
            <div className="bg-white p-6 rounded-2xl animate-bounce-gentle">
                <span className="text-teal-700 font-bold flex items-center gap-2">
                    <Shield className="animate-pulse" /> Carregando perfil...
                </span>
            </div>
        </div>
    );

    const confirmedAppointments = isClient ? appointments.filter(a => a.status === 'approved') : appointments;
    const myAppointments = appointments; // For clients, this is already filtered


    // --- TABS NAVIGATION ---
    const handleTabChange = (tabId) => {
        setActiveTab(tabId);
    };

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
                                    <User size={16} />
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

                            // Only GM sees settings
                            if (tab.id === 'settings' && userProfile?.role !== 'gm') return null;

                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabChange(tab.id)}
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
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <Loader2 className="animate-spin text-teal-600" size={40} />
                        <p className="text-gray-500 font-medium animate-pulse">Carregando painel...</p>
                    </div>
                ) : (
                    <>
                        {/* --- APPOINTMENTS TAB --- */}
                        {activeTab === 'appointments' && (
                            <div className="animate-fade-in-up">
                                {/* Pagination Controls Bar */}
                                <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                                            <Filter size={16} /> Exibir:
                                        </span>
                                        <select
                                            value={apptItemsPerPage}
                                            onChange={handleApptLimitChange}
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
                                                onClick={handleApptPrevPage}
                                                disabled={apptCurrentPage === 1 || apptLoading}
                                                className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                                            >
                                                <ChevronLeft size={20} />
                                            </button>
                                            <button
                                                onClick={handleApptNextPage}
                                                disabled={apptCurrentPage * apptItemsPerPage >= apptTotalItems || apptLoading}
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
                                                        {new Date(app.createdAt?.seconds * 1000).toLocaleDateString()}
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
                                                                    onClick={() => handleEditClick(app)}
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
                                                            // Fix Timezone issue: Parse YYYY-MM-DD manually
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
                                                            onClick={() => updateStatus(app.id, 'rejected')}
                                                            className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-lg font-bold transition-colors text-sm"
                                                        >
                                                            Recusar
                                                        </button>
                                                    )}
                                                    {canApprove && (
                                                        <button
                                                            onClick={() => updateStatus(app.id, 'approved')}
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

                                {/* 2. Confirmed Table */}
                                <section>
                                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                                        <span className="text-green-600 bg-green-100 p-2 rounded-lg"><Check size={20} /></span>
                                        Agenda Confirmada
                                    </h2>

                                    {/* MOBILE CARD VIEW (Visible only on small screens) */}
                                    <div className="grid grid-cols-1 gap-4 md:hidden">
                                        {confirmedAppointments.map(app => (
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
                                                    {app.clinicName || 'Sem Unidade'}
                                                </div>

                                                <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                                                    <a href={`https://wa.me/55${app.clientPhone}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-green-600 font-bold text-sm">
                                                        <Phone size={14} /> {formatPhone(app.clientPhone)}
                                                    </a>
                                                    <div className="flex gap-2">
                                                        {canEditClient && (
                                                            <button onClick={() => handleEditClick(app)} className="p-2 bg-gray-100 text-gray-600 rounded-full">
                                                                <Edit2 size={16} />
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button onClick={() => handleDelete(app.id)} className="p-2 bg-red-50 text-red-600 rounded-full">
                                                                <Trash2 size={16} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* DESKTOP TABLE VIEW (Hidden on mobile) */}
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
                                                    {confirmedAppointments.map(app => (
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
                                                                                onClick={() => handleEditClick(app)}
                                                                                className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                                                title="Editar"
                                                                            >
                                                                                <Edit2 size={16} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    {canDelete ? (
                                                                        <button onClick={() => handleDelete(app.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir">
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
                        )
                        }

                        {/* --- USERS TAB --- */}
                        {
                            !isClient && activeTab === 'users' && (
                                <section>
                                    {/* Pagination Controls Bar */}
                                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                                                <Filter size={16} /> Exibir:
                                            </span>
                                            <select
                                                value={usersItemsPerPage}
                                                onChange={handleUsersLimitChange}
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
                                                    onClick={handleUsersPrevPage}
                                                    disabled={usersCurrentPage === 1 || usersLoading}
                                                    className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                                                >
                                                    <ChevronLeft size={20} />
                                                </button>
                                                <button
                                                    onClick={handleUsersNextPage}
                                                    disabled={usersCurrentPage * usersItemsPerPage >= usersTotalItems || usersLoading}
                                                    className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                                                >
                                                    <ChevronRight size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                                        <span className="text-teal-600 bg-teal-100 p-2 rounded-lg"><Users size={20} /></span>
                                        Gerenciamento de Usuários
                                    </h2>

                                    {/* Users Search Toolbar */}
                                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-6 flex gap-4">
                                        <div className="relative w-full md:w-1/2">
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

                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left">
                                                <thead className="bg-gray-50 border-b border-gray-100 text-sm text-gray-500 uppercase tracking-wider">
                                                    <tr>
                                                        <th className="px-6 py-4 font-bold">Nome</th>
                                                        <th className="px-6 py-4 font-bold">Contato</th>
                                                        <th className="px-6 py-4 font-bold">Função</th>
                                                        <th className="px-6 py-4 font-bold text-right">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {usersList.map(u => (
                                                        <tr key={u.id} className="hover:bg-gray-50/50">
                                                            <td className="px-6 py-4">
                                                                <div className="font-medium text-gray-900">{u.name}</div>
                                                                <div className="text-xs text-gray-400">{u.email}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="text-sm text-gray-800 font-medium">{u.phone || '-'}</div>
                                                                <div className="text-xs text-gray-500 font-mono mt-0.5">{u.cpf || 'CPF não informado'}</div>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase ${u.role === 'gm' ? 'bg-purple-100 text-purple-700' :
                                                                    u.role === 'admin' ? 'bg-teal-100 text-teal-700' :
                                                                        u.role === 'supervisor' ? 'bg-blue-100 text-blue-700' :
                                                                            'bg-gray-100 text-gray-700'
                                                                    }`}>
                                                                    {u.role === 'gm' ? 'Gerente Geral' : u.role === 'client' ? 'Paciente' : u.role}
                                                                </span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <button
                                                                        className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                                        title="Editar"
                                                                        onClick={() => handleOpenUserEdit(u)}
                                                                    >
                                                                        <Edit2 size={16} />
                                                                    </button>
                                                                    {['gm', 'admin'].includes(userProfile?.role) && (
                                                                        <button
                                                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                            title="Excluir"
                                                                            onClick={() => handleDeleteUser(u)}
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
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
                            )
                        }

                        {/* --- UNITS TAB --- */}
                        {
                            ['gm', 'admin'].includes(userProfile?.role) && activeTab === 'units' && (
                                <section>
                                    {/* Pagination Controls Bar */}
                                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                                                <Filter size={16} /> Exibir:
                                            </span>
                                            <select
                                                value={unitsItemsPerPage}
                                                onChange={handleUnitsLimitChange}
                                                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block p-2 font-bold outline-none"
                                            >
                                                <option value={10}>10 itens</option>
                                                <option value={50}>50 itens</option>
                                                <option value={100}>100 itens</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-500 font-medium">
                                                Página <strong className="text-gray-800">{unitsCurrentPage}</strong> de <strong className="text-gray-800">{Math.ceil(unitsTotalItems / unitsItemsPerPage) || 1}</strong>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleUnitsPrevPage}
                                                    disabled={unitsCurrentPage === 1 || unitsLoading}
                                                    className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                                                >
                                                    <ChevronLeft size={20} />
                                                </button>
                                                <button
                                                    onClick={handleUnitsNextPage}
                                                    disabled={unitsCurrentPage * unitsItemsPerPage >= unitsTotalItems || unitsLoading}
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
                                                onClick={() => openUnitModal()}
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
                                                        {unitsList.map(unit => (
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
                                                                            onClick={() => openUnitModal(unit)}
                                                                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                                            title="Editar"
                                                                        >
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteUnit(unit.id)}
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
                                </section>
                            )
                        }

                        {/* --- SERVICES TAB --- */}
                        {
                            ['gm', 'admin'].includes(userProfile?.role) && activeTab === 'services' && (
                                <section>
                                    {/* Pagination Controls Bar */}
                                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-600 flex items-center gap-2">
                                                <Filter size={16} /> Exibir:
                                            </span>
                                            <select
                                                value={servicesItemsPerPage}
                                                onChange={handleServicesLimitChange}
                                                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-teal-500 focus:border-teal-500 block p-2 font-bold outline-none"
                                            >
                                                <option value={10}>10 itens</option>
                                                <option value={50}>50 itens</option>
                                                <option value={100}>100 itens</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-500 font-medium">
                                                Página <strong className="text-gray-800">{servicesCurrentPage}</strong> de <strong className="text-gray-800">{Math.ceil(servicesTotalItems / servicesItemsPerPage) || 1}</strong>
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={handleServicesPrevPage}
                                                    disabled={servicesCurrentPage === 1 || servicesLoading}
                                                    className="p-2 rounded-lg border border-gray-200 hover:bg-teal-50 hover:border-teal-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-gray-600 hover:text-teal-700"
                                                >
                                                    <ChevronLeft size={20} />
                                                </button>
                                                <button
                                                    onClick={handleServicesNextPage}
                                                    disabled={servicesCurrentPage * servicesItemsPerPage >= servicesTotalItems || servicesLoading}
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
                                            onClick={() => openServiceModal()}
                                            className="bg-teal-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-teal-700 transition-colors flex items-center gap-2 text-sm"
                                        >
                                            <Edit2 size={16} /> Novo Serviço
                                        </button>
                                    </div>

                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                        {servicesList.length === 0 ? (
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
                                                        {servicesList.map(service => (
                                                            <tr key={service.id} className="hover:bg-gray-50/50">
                                                                <td className="px-6 py-4">
                                                                    <div className="font-medium text-gray-900">{service.name}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    {service.displayPrice ? (
                                                                        <span className="text-teal-700 font-bold">
                                                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-gray-400 italic text-xs uppercase bg-gray-100 px-2 py-1 rounded">Sob Consulta</span>
                                                                    )}
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <button
                                                                            onClick={() => openServiceModal(service)}
                                                                            className="p-2 text-gray-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                                                                            title="Editar"
                                                                        >
                                                                            <Edit2 size={16} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteService(service.id)}
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
                                </section>
                            )
                        }
                    </>
                )}

                {/* --- SETTINGS TAB --- */}
                {activeTab === 'settings' && userProfile?.role === 'gm' && (
                    <div className="animate-fade-in-up max-w-2xl mx-auto">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
                            <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-3">
                                <div className="bg-gray-100 p-2 rounded-lg text-gray-600"><Settings size={20} /></div>
                                Configurações do Site
                            </h2>

                            <form onSubmit={handleSaveConfig} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">WhatsApp do Botão Flutuante</label>
                                    <p className="text-sm text-gray-500 mb-3">Este é o número que será aberto quando os visitantes clicarem no botão de WhatsApp do site.</p>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            value={siteConfig.whatsapp}
                                            onChange={(e) => setSiteConfig({ ...siteConfig, whatsapp: e.target.value })}
                                            className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all font-medium text-gray-700"
                                            placeholder="Ex: 5547999999999"
                                        />
                                    </div>
                                    <p className="text-xs text-gray-400 mt-2">Dica: Use 55 + DDD + Número (apenas números).</p>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-teal-200 flex items-center justify-center gap-2"
                                >
                                    <Check size={20} /> Salvar Configurações
                                </button>
                            </form>
                        </div>
                    </div>
                )}

            </main >

            {/* Profile Modal */}
            {
                isProfileOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in overflow-hidden">
                            <div className="bg-teal-900 text-white p-6 flex justify-between items-center">
                                <h2 className="text-xl font-bold font-serif flex items-center gap-2">
                                    <User className="text-teal-300" /> Meu Perfil
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
                                        onChange={handleProfileChange}
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
                                        onChange={handleProfileChange}
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
                                            value={userProfile?.role === 'client' ? 'Paciente' : userProfile?.role.toUpperCase()}
                                            disabled
                                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-400 mb-1">Email</label>
                                    <input
                                        type="text"
                                        value={userProfile?.email || ''}
                                        disabled
                                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed"
                                    />
                                </div>

                                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-orange-800">Senha de Acesso</h4>
                                            <p className="text-xs text-orange-600">Deseja alterar sua senha atual?</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleResetPassword}
                                            className="px-4 py-2 bg-white text-orange-600 font-bold text-sm rounded-lg border border-orange-200 hover:bg-orange-600 hover:text-white transition-colors shadow-sm"
                                        >
                                            Redefinir Senha
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-4 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsProfileOpen(false)}
                                        className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={profileLoading}
                                        className="flex-1 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors flex items-center justify-center gap-2"
                                    >
                                        {profileLoading ? <Loader2 className="animate-spin" size={20} /> : 'Salvar Alterações'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }


            {/* Custom Delete Confirmation Modal */}
            {
                deleteModal.isOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-scale-in overflow-hidden">
                            <div className="p-6 text-center">
                                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Trash2 size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{deleteModal.title}</h3>
                                <p className="text-gray-600 mb-6">{deleteModal.message}</p>

                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setDeleteModal({ isOpen: false, type: null, id: null })}
                                        className="flex-1 py-3 border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={confirmDelete}
                                        className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                                    >
                                        Sim, Excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Unit Modal */}
            {
                isUnitModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-scale-in overflow-hidden flex flex-col max-h-[90vh]">
                            <div className="bg-teal-900 text-white p-6 shrink-0 flex justify-between items-center">
                                <h2 className="text-xl font-bold font-serif flex items-center gap-2">
                                    <MapPin className="text-teal-300" /> {editingUnitId ? 'Editar Unidade' : 'Nova Unidade'}
                                </h2>
                                <button onClick={() => setIsUnitModalOpen(false)} className="text-teal-300 hover:text-white transition-colors">
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="flex border-b border-gray-100 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('info')}
                                    className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${activeModalTab === 'info' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400 hover:text-teal-600'}`}
                                >
                                    Informações
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('schedule')}
                                    className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${activeModalTab === 'schedule' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400 hover:text-teal-600'}`}
                                >
                                    Horários
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveModalTab('exceptions')}
                                    className={`flex-1 py-3 font-bold text-sm text-center border-b-2 transition-colors ${activeModalTab === 'exceptions' ? 'border-teal-600 text-teal-700' : 'border-transparent text-gray-400 hover:text-teal-600'}`}
                                >
                                    Pausas & Feriados
                                </button>
                            </div>

                            <form onSubmit={handleSaveUnit} className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                                {/* --- INFO TAB --- */}
                                {activeModalTab === 'info' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Nome da Unidade</label>
                                            <input
                                                type="text"
                                                required
                                                value={unitForm.name}
                                                onChange={e => setUnitForm(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                                placeholder="Ex: Clínica Centro"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-1">Endereço</label>
                                            <input
                                                type="text"
                                                required
                                                value={unitForm.address}
                                                onChange={e => setUnitForm(prev => ({ ...prev, address: e.target.value }))}
                                                className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                                placeholder="Rua..."
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">Telefone</label>
                                                <input
                                                    type="tel"
                                                    value={unitForm.phone}
                                                    onChange={e => setUnitForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                                                    className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-1">WhatsApp</label>
                                                <input
                                                    type="tel"
                                                    value={unitForm.whatsapp}
                                                    onChange={e => setUnitForm(prev => ({ ...prev, whatsapp: e.target.value.replace(/\D/g, '') }))}
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
                                                        checked={unitForm.color === 'teal'}
                                                        onChange={e => setUnitForm(prev => ({ ...prev, color: e.target.value }))}
                                                        className="w-4 h-4 text-teal-600 focus:ring-teal-500"
                                                    />
                                                    <span className="text-teal-700 font-bold bg-teal-100 px-2 py-1 rounded">Verde/Teal</span>
                                                </label>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name="color"
                                                        value="blue"
                                                        checked={unitForm.color === 'blue'}
                                                        onChange={e => setUnitForm(prev => ({ ...prev, color: e.target.value }))}
                                                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                                                    />
                                                    <span className="text-blue-700 font-bold bg-blue-100 px-2 py-1 rounded">Azul</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* --- SCHEDULE TAB (Complex Ranges) --- */}
                                {activeModalTab === 'schedule' && (
                                    <div className="space-y-4 animate-fade-in">
                                        <p className="text-sm text-gray-500">Defina os turnos de atendimento para cada dia.</p>
                                        <div className="space-y-3">
                                            {weekDaysOrdered.map(({ key, label }) => {
                                                const dayConfig = unitForm.schedule.weekly[key];
                                                let ranges = dayConfig.ranges;

                                                // Fallback for Legacy Data (Migration on the fly)
                                                if (!ranges && dayConfig.start && dayConfig.end) {
                                                    ranges = [{ start: dayConfig.start, end: dayConfig.end }];
                                                }
                                                if (!ranges) ranges = [];

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

                                {/* --- EXCEPTIONS TAB (Advanced) --- */}
                                {activeModalTab === 'exceptions' && (
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
                                                {unitForm.schedule.exceptions?.length === 0 && <p className="text-gray-400 text-sm">Nenhuma exceção cadastrada.</p>}
                                                {(unitForm.schedule.exceptions || []).map((ex, idx) => {
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
                                        onClick={() => setIsUnitModalOpen(false)}
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
                )
            }
            {/* --- USER EDIT MODAL --- */}
            {
                (() => {
                    const canAssignRole = (role) => {
                        if (userProfile?.role === 'gm') return true;
                        if (userProfile?.role === 'admin') return ['supervisor', 'client'].includes(role);
                        return false;
                    };
                    const accessibleRoles = ['gm', 'admin', 'supervisor', 'client'].filter(canAssignRole);

                    return isUserModalOpen && (
                        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in overflow-hidden">
                                <div className="bg-teal-900 p-4 flex justify-between items-center text-white">
                                    <h3 className="font-bold flex items-center gap-2">
                                        <User size={20} /> Editar Usuário
                                    </h3>
                                    <button onClick={() => setIsUserModalOpen(false)} className="hover:bg-teal-800 p-1 rounded-lg transition-colors">
                                        <X size={20} />
                                    </button>
                                </div>
                                <form onSubmit={handleSaveUser} className="p-6 space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Nome</label>
                                        <input
                                            type="text"
                                            required
                                            value={userForm.name}
                                            onChange={e => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Função</label>
                                        <select
                                            value={userForm.role}
                                            onChange={e => setUserForm(prev => ({ ...prev, role: e.target.value }))}
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
                                            value={userForm.phone}
                                            onChange={e => setUserForm(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
                                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                        />
                                    </div>
                                    <div className="pt-4 flex gap-3 border-t border-gray-100 mt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsUserModalOpen(false)}
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
                    )
                })()
            }

            {/* --- SERVICE MODAL --- */}
            {
                isServiceModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in overflow-hidden">
                            <div className="bg-purple-900 p-4 flex justify-between items-center text-white">
                                <h3 className="font-bold flex items-center gap-2">
                                    <Sparkles size={20} /> {editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}
                                </h3>
                                <button onClick={() => setIsServiceModalOpen(false)} className="hover:bg-purple-800 p-1 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSaveService} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Nome do Serviço</label>
                                    <input
                                        type="text"
                                        required
                                        value={serviceForm.name}
                                        onChange={e => setServiceForm(prev => ({ ...prev, name: e.target.value }))}
                                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-purple-500 outline-none transition-colors"
                                        placeholder="Ex: Limpeza Dental"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Valor (R$)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={serviceForm.price}
                                        onChange={e => setServiceForm(prev => ({ ...prev, price: e.target.value }))}
                                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-purple-500 outline-none transition-colors"
                                        placeholder="0,00"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Duração (minutos)</label>
                                    <select
                                        value={serviceForm.duration || 30}
                                        onChange={e => setServiceForm(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
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
                                        value={serviceForm.description}
                                        onChange={e => setServiceForm(prev => ({ ...prev, description: e.target.value }))}
                                        className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-purple-500 outline-none transition-colors resize-none h-24"
                                        placeholder="Descreva o serviço..."
                                    />
                                </div>
                                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                    <input
                                        type="checkbox"
                                        checked={serviceForm.displayPrice}
                                        onChange={e => setServiceForm(prev => ({ ...prev, displayPrice: e.target.checked }))}
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
                                                        checked={serviceForm.allowedUnits.includes(unit.id)}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setServiceForm(prev => ({ ...prev, allowedUnits: [...prev.allowedUnits, unit.id] }));
                                                            } else {
                                                                setServiceForm(prev => ({ ...prev, allowedUnits: prev.allowedUnits.filter(id => id !== unit.id) }));
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
                                        onClick={() => setIsServiceModalOpen(false)}
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
                )
            }

            {/* --- SESSION TIMEOUT MODAL --- */}
            {
                isTimeoutModalOpen && (
                    <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-scale-in">
                            <div className="mb-4 text-orange-500 flex justify-center">
                                <Clock size={48} />
                            </div>
                            <h2 className="text-xl font-bold text-gray-800 mb-2">Sessão Expirada</h2>
                            <p className="text-gray-500 mb-6">Sua sessão foi encerrada por inatividade. Deseja continuar logado?</p>

                            <div className="flex gap-3">
                                <button
                                    onClick={confirmLogout}
                                    className="flex-1 py-2.5 border-2 border-red-100 text-red-600 font-bold rounded-xl hover:bg-red-50 transition-colors"
                                >
                                    Sair
                                </button>
                                <button
                                    onClick={() => {
                                        setIsTimeoutModalOpen(false);
                                        lastActivityRef.current = Date.now();
                                    }}
                                    className="flex-1 py-2.5 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors"
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- EDIT APPOINTMENT MODAL --- */}
            {
                isEditModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-scale-in overflow-hidden">
                            <div className="bg-teal-700 p-4 flex justify-between items-center text-white">
                                <h3 className="font-bold flex items-center gap-2">
                                    <Edit2 size={20} /> Editar Agendamento
                                </h3>
                                <button onClick={() => setIsEditModalOpen(false)} className="hover:bg-teal-600 p-1 rounded-lg transition-colors">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Unidade</label>
                                    <select
                                        value={editForm.clinicId}
                                        onChange={(e) => setEditForm({ ...editForm, clinicId: e.target.value })}
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
                                        value={editForm.serviceId}
                                        onChange={(e) => setEditForm({ ...editForm, serviceId: e.target.value })}
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
                                            value={editForm.date}
                                            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-1">Hora</label>
                                        <input
                                            type="time"
                                            value={editForm.time}
                                            onChange={(e) => setEditForm({ ...editForm, time: e.target.value })}
                                            className="w-full px-4 py-2 rounded-xl border-2 border-gray-100 focus:border-teal-500 outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                                <div className="pt-4 flex gap-3 border-t border-gray-100 mt-2">
                                    <button
                                        onClick={() => setIsEditModalOpen(false)}
                                        className="flex-1 py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        className="flex-1 py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition-colors shadow-lg shadow-teal-200"
                                    >
                                        Salvar Alterações
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }




            {/* --- LOGOUT MODAL --- */}
            {
                isLogoutModalOpen && (
                    <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-scale-in">
                            <div className="mb-4 text-gray-900 flex justify-center">
                                <div className="p-3 bg-red-50 rounded-full text-red-500">
                                    <LogOut size={32} />
                                </div>
                            </div>
                            <h2 className="text-xl font-bold text-gray-900 mb-2">Sair da conta?</h2>
                            <p className="text-sm text-gray-500 mb-6">Você precisará fazer login novamente para acessar o painel administrativo.</p>

                            <div className="flex gap-3">
                                <button
                                    onClick={() => setIsLogoutModalOpen(false)}
                                    className="flex-1 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={confirmLogout}
                                    className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                                >
                                    Sair
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* --- CONFLICT RESOLUTION MODAL --- */}
            {
                conflictModal.isOpen && (
                    <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                            <div className="bg-amber-100 p-6 flex flex-col items-center text-center border-b border-amber-200">
                                <div className="p-3 bg-amber-500 text-white rounded-full mb-3 shadow-lg shadow-amber-200/50">
                                    <Clock size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-amber-900">Conflito de Horário!</h3>
                                <p className="text-amber-800 mt-2 text-sm leading-relaxed">
                                    O horário <span className="font-bold">{conflictModal.targetApp?.time}</span> já está ocupado por <br />
                                    <strong>{conflictModal.conflictingApp?.clientName}</strong> ({conflictModal.conflictingApp?.time}).
                                </p>
                            </div>

                            <div className="p-6 space-y-4">
                                {conflictModal.suggestion ? (
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-green-600 uppercase tracking-widest mb-1">Sugestão</p>
                                            <p className="text-lg font-bold text-green-900 flex items-center gap-2">
                                                <Clock size={18} /> {conflictModal.suggestion}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => handleResolveConflict('suggest')}
                                            className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-200"
                                        >
                                            Aceitar
                                        </button>
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center text-gray-500 text-sm">
                                        Não encontramos horários livres próximos.
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3 pt-2">
                                    <button
                                        onClick={() => setConflictModal(prev => ({ ...prev, isOpen: false }))}
                                        className="py-3 border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => handleResolveConflict('force')}
                                        className="py-3 bg-red-100 text-red-600 font-bold rounded-xl hover:bg-red-200 transition-colors"
                                    >
                                        Aprovar Mesmo Assim
                                    </button>
                                    <button
                                        onClick={() => {
                                            setConflictModal(prev => ({ ...prev, isOpen: false }));
                                            handleEditClick(conflictModal.targetApp);
                                        }}
                                        className="col-span-2 py-3 bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Edit2 size={16} /> Editar Horário Manualmente
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }




        </div >
    );
};

export default AdminDashboard;
