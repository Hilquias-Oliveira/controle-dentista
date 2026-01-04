import React, { useState, useEffect } from 'react';
import { X, Calendar as CalendarIcon, Clock, User, CheckCircle, ChevronLeft, ChevronRight, Loader2, MapPin } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, orderBy, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { toast } from 'sonner';
import './Calendar.css';

// --- HELPERS ---
const validateCPF = (cpf) => {
    if (!cpf) return false;
    const strCPF = String(cpf).replace(/[^\d]/g, '');
    if (strCPF.length !== 11) return false;

    // Block strict sequences
    if (/^(\d)\1+$/.test(strCPF)) return false;

    let sum = 0;
    let remainder;
    for (let i = 1; i <= 9; i++) sum = sum + parseInt(strCPF.substring(i - 1, i)) * (11 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(strCPF.substring(9, 10))) return false;

    sum = 0;
    for (let i = 1; i <= 10; i++) sum = sum + parseInt(strCPF.substring(i - 1, i)) * (12 - i);
    remainder = (sum * 10) % 11;
    if ((remainder === 10) || (remainder === 11)) remainder = 0;
    if (remainder !== parseInt(strCPF.substring(10, 11))) return false;

    return true;
};

// Dynamic Slot Generation Helper
const generateTimeSlots = (date, clinic, serviceDuration = 30, existingAppointments = []) => {
    if (!date || !clinic?.schedule?.weekly) return [];

    const dateStr = format(date, 'yyyy-MM-dd');
    let rangesToUse = [];

    // 1. Check Exceptions first
    const exception = clinic.schedule.exceptions?.find(ex => {
        if (typeof ex === 'string') return ex === dateStr;
        return ex.date === dateStr;
    });

    if (exception) {
        if (typeof exception === 'string' || exception.type === 'closed') {
            return []; // Closed
        }
        if (exception.type === 'custom' && exception.ranges) {
            rangesToUse = exception.ranges;
        }
    } else {
        // 2. Check Weekly Schedule
        const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
        const dayKey = dayMap[date.getDay()];
        const dayConfig = clinic.schedule.weekly[dayKey];

        if (!dayConfig || !dayConfig.active) return [];

        // Support Legacy vs New
        if (dayConfig.ranges) {
            rangesToUse = dayConfig.ranges;
        } else if (dayConfig.start && dayConfig.end) {
            rangesToUse = [{ start: dayConfig.start, end: dayConfig.end }];
        }
    }

    // 3. Calculate Occupied Ranges (Only Approved)
    const busyRanges = existingAppointments
        .filter(app => app.status === 'approved' && app.clinicId === clinic.id && app.date === dateStr)
        .map(app => {
            const startParts = app.time.split(':').map(Number);
            const startMins = startParts[0] * 60 + startParts[1];
            // If appointment has no duration saved, assume 30 mins default
            const duration = app.duration || 30;
            return { start: startMins, end: startMins + duration };
        });

    // Generate Slots
    const slots = [];
    const now = new Date();
    // Check if selected date is Same Day as Today
    const isToday = date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    rangesToUse.forEach(range => {
        if (!range.start || !range.end) return;

        let [currHour, currMin] = range.start.split(':').map(Number);
        const [endHour, endMin] = range.end.split(':').map(Number);
        const endTotalMins = endHour * 60 + endMin;

        // Step 10 minutes for finer granularity if duration is small, or keep 10 mins as base unit
        // Using 10 mins step to allow flexible start times (10:00, 10:10, 10:20...)
        const stepMins = 10;

        while (currHour * 60 + currMin < endTotalMins) {
            const currentTotalMins = currHour * 60 + currMin;
            const proposedEndMins = currentTotalMins + serviceDuration;

            // 1. Check Schedule Boundaries (Must finish before closing)
            if (proposedEndMins > endTotalMins) {
                // Advance
                currMin += stepMins;
                if (currMin >= 60) { currMin -= 60; currHour += 1; }
                continue;
            }

            // 2. Check Past Time
            if (isToday) {
                const slotTime = new Date(date);
                slotTime.setHours(currHour, currMin, 0, 0);
                if (slotTime < now) {
                    currMin += stepMins;
                    if (currMin >= 60) { currMin -= 60; currHour += 1; }
                    continue;
                }
            }

            // 3. Check Conflicts with Approved Appointments
            const isBlocked = busyRanges.some(busy => {
                // Formatting overlap: [Start, End)
                // Overlap if (StartA < EndB) and (EndA > StartB)
                return (currentTotalMins < busy.end) && (proposedEndMins > busy.start);
            });

            if (!isBlocked) {
                const timeStr = `${String(currHour).padStart(2, '0')}:${String(currMin).padStart(2, '0')}`;
                slots.push(timeStr);
            }

            // Increment
            currMin += stepMins;
            if (currMin >= 60) {
                currMin -= 60;
                currHour += 1;
            }
        }
    });

    return [...new Set(slots)].sort(); // Dedupe just in case
};

const BookingModal = ({ service, onClose }) => {
    const [selectedService, setSelectedService] = useState(service || null);
    const [step, setStep] = useState(service ? 1 : 0);
    const [units, setUnits] = useState([]);
    const [selectedClinic, setSelectedClinic] = useState(null);
    const [selectedDate, setSelectedDate] = useState(undefined);
    const [selectedTime, setSelectedTime] = useState(null);
    const [availableSlots, setAvailableSlots] = useState([]);
    const [existingAppointments, setExistingAppointments] = useState([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [loading, setLoading] = useState(false);
    const [servicesList, setServicesList] = useState([]); // For Step 0
    const [loadingServices, setLoadingServices] = useState(false);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        cpf: ''
    });
    const [checkingCpf, setCheckingCpf] = useState(false);
    const [customerFound, setCustomerFound] = useState(false);

    // Validation States
    const isNameValid = formData.name.trim().split(' ').length >= 2;
    const isPhoneValid = formData.phone.replace(/\D/g, '').length >= 10;
    const isCpfValid = validateCPF(formData.cpf); // REAL VALIDATION

    const [isLoadingUnits, setIsLoadingUnits] = useState(true);

    // Fetch Services for Step 0
    useEffect(() => {
        if (!selectedService) {
            const fetchServices = async () => {
                setLoadingServices(true);
                try {
                    const q = query(collection(db, "services"), orderBy("name"));
                    const snapshot = await getDocs(q);
                    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setServicesList(list);
                } catch (error) {
                    console.error("Error fetching services:", error);
                } finally {
                    setLoadingServices(false);
                }
            };
            fetchServices();
        }
    }, [selectedService]);

    // Fetch Units
    useEffect(() => {
        const fetchUnits = async () => {
            try {
                const q = query(collection(db, "units"), orderBy("name"));
                const snapshot = await getDocs(q);
                const loadedUnits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setUnits(loadedUnits);
            } catch (error) {
                console.error("Error fetching units:", error);
                toast.error("Erro ao carregar unidades.");
            } finally {
                setIsLoadingUnits(false);
            }
        };
        fetchUnits();
    }, []);

    // Filter Units based on Allowed Units of Selected Service
    const filteredUnits = units.filter(unit => {
        if (!selectedService) return true; // Should not happen in Step 1 anyway
        // If allowedUnits is undefined or empty => ALL units (legacy behavior)
        if (!selectedService.allowedUnits || selectedService.allowedUnits.length === 0) return true;
        // Else check if unit.id is in allowedUnits
        return selectedService.allowedUnits.includes(unit.id);
    });

    // Fetch Appointments for Selected Date to Check Conflicts
    useEffect(() => {
        const fetchAppointments = async () => {
            if (!selectedClinic || !selectedDate) return;

            setLoadingSlots(true);
            try {
                const dateStr = format(selectedDate, 'yyyy-MM-dd');
                // Only fetching APPROVED because pending ones don't block
                const q = query(
                    collection(db, "appointments"),
                    where("clinicId", "==", selectedClinic.id),
                    where("date", "==", dateStr),
                    where("status", "==", "approved")
                );
                const snapshot = await getDocs(q);
                const apps = snapshot.docs.map(doc => doc.data());
                setExistingAppointments(apps);
            } catch (error) {
                console.error("Error fetching slots:", error);
            } finally {
                setLoadingSlots(false);
            }
        };
        fetchAppointments();
    }, [selectedClinic, selectedDate]);

    // Slots Generation
    useEffect(() => {
        if (selectedClinic && selectedDate && !loadingSlots) {
            const serviceDuration = selectedService?.duration || 30;
            const slots = generateTimeSlots(selectedDate, selectedClinic, serviceDuration, existingAppointments);
            setAvailableSlots(slots);
            setSelectedTime(null);
        }
    }, [selectedClinic, selectedDate, existingAppointments, loadingSlots, selectedService]);

    // --- ICONS ---
    const ToothIcon = ({ className }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 5.5c-2.5 0-4 1.5-5.5 2.5C5.5 9 5 11 5 14c0 3.5 2 6 3 8 0 0 1.5-1 2-3 .5-2 2-2 2-2s1.5 0 2 2c.5 2 2 3 2 3 1-2 3-4.5 3-8 0-3-.5-5-1.5-6-1.5-1-3-2.5-5.5-2.5z" />
            <path d="M8 8.5l1.5-1.5 1.5 1.5 1 1-1 1-1.5 1.5-1.5-1.5-1-1z" fill="currentColor" stroke="none" className="text-teal-400" />
            <path d="M9.5 7l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" />
        </svg>
    );

    const isDateDisabled = (date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) return true; // Block past dates

        if (!selectedClinic?.schedule?.weekly) return [0, 6].includes(date.getDay());

        const dateStr = format(date, 'yyyy-MM-dd');
        const exception = selectedClinic.schedule.exceptions?.find(ex => {
            if (typeof ex === 'string') return ex === dateStr;
            return ex.date === dateStr;
        });

        if (exception) {
            if (typeof exception === 'string' || exception.type === 'closed') return true;
            return false;
        }

        const dayMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
        const dayKey = dayMap[date.getDay()];
        const dayConfig = selectedClinic.schedule.weekly[dayKey];

        return !dayConfig || !dayConfig.active;
    };

    const handlePhoneChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        if (value.length > 2) value = `(${value.slice(0, 2)}) ${value.slice(2)}`;
        if (value.length > 9) value = `${value.slice(0, 10)}-${value.slice(10)}`;
        setFormData(prev => ({ ...prev, phone: value }));
    };

    const handleCPFChange = (e) => {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) value = value.slice(0, 11);

        const cleanValue = value;

        if (value.length > 3) value = `${value.slice(0, 3)}.${value.slice(3)}`;
        if (value.length > 7) value = `${value.slice(0, 7)}.${value.slice(7)}`;
        if (value.length > 11) value = `${value.slice(0, 11)}-${value.slice(11)}`;

        setFormData(prev => ({ ...prev, cpf: value }));

        if (cleanValue.length === 11) {
            // Only auto-fill if valid
            if (validateCPF(cleanValue)) {
                checkExistingCustomer(cleanValue);
            }
        }
    };

    const checkExistingCustomer = async (cpfDigits) => {
        setCheckingCpf(true);
        try {
            // Unify with users collection
            const formatted = `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9, 11)}`;

            const q = query(collection(db, "users"), where("cpf", "in", [cpfDigits, formatted]), limit(1));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const customer = snapshot.docs[0].data();
                setFormData(prev => ({
                    ...prev,
                    name: customer.name || '',
                    phone: customer.phone || ''
                }));
                setCustomerFound(true);
                toast.success("Dados preenchidos!");
            } else {
                setCustomerFound(false);
            }
        } catch (error) {
            console.error("Error checking customer:", error);
        } finally {
            setCheckingCpf(false);
        }
    };

    const handleNext = async () => {
        if (step === 3) {
            // Strictly block invalid CPF
            const cpfDigits = formData.cpf.replace(/\D/g, '');
            if (!validateCPF(cpfDigits)) {
                toast.error("CPF inválido. Verifique os números digitados.", { duration: 5000 });
                return;
            }
            if (!formData.name.trim() || formData.phone.length < 10) {
                toast.error("Preencha todos os campos.");
                return;
            }

            setLoading(true);
            try {
                let customerId = 'guest'; // Default fallback
                const usersRef = collection(db, "users");
                const formatted = `${cpfDigits.slice(0, 3)}.${cpfDigits.slice(3, 6)}.${cpfDigits.slice(6, 9)}-${cpfDigits.slice(9, 11)}`;

                // 1. Find User
                const q = query(usersRef, where("cpf", "in", [cpfDigits, formatted]), limit(1));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    const docSnap = snapshot.docs[0];
                    customerId = docSnap.id;

                    // 2. Try Update (Safe - Permission Ignore)
                    try {
                        await updateDoc(doc(db, "users", customerId), {
                            name: formData.name,
                            phone: formData.phone
                        });
                    } catch (updateError) {
                        console.warn("Profile update failed (permissions), ignoring.", updateError);
                    }
                } else {
                    // 3. Try Create (Safe - Permission Ignore)
                    try {
                        const newUser = await addDoc(usersRef, {
                            name: formData.name,
                            phone: formData.phone,
                            cpf: cpfDigits,
                            role: 'client',
                            createdAt: serverTimestamp()
                        });
                        customerId = newUser.id;
                    } catch (createError) {
                        console.warn("User creation failed (permissions), proceeding as guest.", createError);
                        // customerId remains 'guest'
                    }
                }

                // 4. Create Appointment (Critical - Must Succeed)
                await addDoc(collection(db, "appointments"), {
                    clinicId: selectedClinic.id,
                    clinicName: selectedClinic.name,
                    customerId,
                    clientName: formData.name,
                    clientPhone: formData.phone,
                    clientCpf: cpfDigits,
                    serviceName: selectedService.name || selectedService.title,
                    date: format(selectedDate, 'yyyy-MM-dd'),
                    time: selectedTime,
                    time: selectedTime,
                    duration: selectedService.duration || 30, // Save duration!
                    status: 'pending_approval',
                    createdAt: serverTimestamp()
                });

                setStep(4);
            } catch (error) {
                console.error("Booking error:", error);
                toast.error("Erro ao salvar agendamento. Tente novamente.");
            } finally {
                setLoading(false);
            }
        } else {
            setStep(step + 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-teal-900 text-white p-6 shrink-0 relative flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold font-serif mb-1">
                            {step === 4 ? 'Agendamento Confirmado!' : 'Agendar Consulta'}
                        </h2>
                        <p className="text-teal-200 text-sm">
                            {step === 0 && 'Qual procedimento você deseja realizar?'}
                            {step === 1 && 'Em qual unidade você prefere ser atendido?'}
                            {step === 2 && 'Escolha a data e o horário ideal.'}
                            {step === 3 && 'Informe seus dados para contato.'}
                            {step === 4 && 'Aguarde a confirmação pelo WhatsApp.'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-0 overflow-y-auto flex-1 custom-scrollbar">

                    {/* STEP 0: SELECT SERVICE */}
                    {step === 0 && (
                        <div className="p-8">
                            {loadingServices ? (
                                <div className="text-center py-12">
                                    <Loader2 className="animate-spin w-8 h-8 mx-auto text-teal-600 mb-2" />
                                    <p className="text-gray-400">Carregando serviços...</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {servicesList.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => {
                                                setSelectedService(item);
                                                setStep(1);
                                            }}
                                            className="p-4 rounded-2xl border-2 border-gray-100 bg-gray-50 hover:bg-white hover:border-teal-500 hover:shadow-lg transition-all group text-left flex items-center gap-4"
                                        >
                                            <div className="w-12 h-12 bg-white rounded-xl shadow-sm text-teal-600 flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors">
                                                <ToothIcon className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 group-hover:text-teal-700">{item.name}</h3>
                                                {item.displayPrice !== false && (
                                                    <p className="text-sm text-gray-500 font-medium">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                    {servicesList.length === 0 && (
                                        <div className="col-span-full text-center text-gray-400 py-8">
                                            Nenhum serviço disponível no momento.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}


                    {step === 1 && (
                        <div className="p-8 grid gap-4">
                            {isLoadingUnits && (
                                <div className="text-center text-gray-400 py-8">
                                    <Loader2 className="animate-spin mx-auto mb-2" />
                                    Carregando unidades...
                                </div>
                            )}

                            {!isLoadingUnits && filteredUnits.length === 0 && (
                                <div className="text-center text-gray-500 py-8">
                                    <p className="font-bold">Nenhuma unidade disponível para este serviço.</p>
                                    <p className="text-sm">Tente escolher outro serviço ou entre em contato.</p>
                                </div>
                            )}

                            {filteredUnits.map((unit, index) => (
                                <button
                                    key={unit.id || index}
                                    onClick={() => setSelectedClinic(unit)}
                                    className={`flex items-start gap-4 p-6 rounded-2xl border-2 text-left transition-all group ${selectedClinic?.name === unit.name
                                        ? 'border-teal-500 bg-teal-50 shadow-md'
                                        : 'border-gray-100 hover:border-teal-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <div className={`p-3 rounded-xl ${unit.color === 'teal' ? 'bg-teal-100 text-teal-600' : 'bg-blue-100 text-blue-600'}`}>
                                        <MapPin size={24} />
                                        <div className="w-6 h-6 flex items-center justify-center font-bold hidden">
                                            {index + 1}
                                        </div>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-900 group-hover:text-teal-700 transition-colors">
                                            {unit.name}
                                        </h3>
                                        <p className="text-gray-500 text-sm mt-1">
                                            {unit.address}
                                        </p>
                                    </div>
                                    <div className={`ml-auto self-center w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedClinic?.name === unit.name
                                        ? 'border-teal-500 bg-teal-500'
                                        : 'border-gray-300'
                                        }`}>
                                        {selectedClinic?.name === unit.name && <CheckCircle size={14} className="text-white" />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col md:flex-row h-full">
                            {/* Calendar Side */}
                            <div className="p-6 border-b md:border-b-0 md:border-r border-gray-100 flex-1 flex flex-col items-center justify-center bg-gray-50/50">
                                <DayPicker
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    locale={ptBR}
                                    disabled={isDateDisabled}
                                    modifiersClassNames={{
                                        selected: 'rdp-day_selected',
                                        today: 'rdp-day_today'
                                    }}
                                />
                            </div>

                            {/* Time Slots Side */}
                            <div className="p-6 flex-1 bg-white">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Clock size={16} />
                                    Horários Disponíveis
                                </h3>

                                {!selectedDate ? (
                                    <div className="text-center py-10 text-gray-400 text-sm">
                                        Selecione uma data para ver os horários.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        {availableSlots.length > 0 ? availableSlots.map(time => (
                                            <button
                                                key={time}
                                                onClick={() => setSelectedTime(time)}
                                                className={`py-2 px-4 rounded-lg text-sm font-bold border-2 transition-all ${selectedTime === time
                                                    ? 'border-teal-600 bg-teal-50 text-teal-700'
                                                    : 'border-gray-100 hover:border-teal-200 text-gray-600'
                                                    }`}
                                            >
                                                {time}
                                            </button>
                                        )) : (
                                            <div className="col-span-2 text-center text-rose-500 text-sm py-4">
                                                Sem horários para esta data.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="p-8 max-w-md mx-auto space-y-6">
                            <div className="flex items-center gap-4 p-4 bg-teal-50 rounded-xl border border-teal-100 mb-6">
                                <div className={`w-12 h-12 rounded-lg ${selectedService?.color || 'bg-teal-100 text-teal-600'} flex items-center justify-center shrink-0`}>
                                    {selectedService?.icon || <CheckCircle />}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">{selectedService?.title || selectedService?.name || 'Serviço Selecionado'}</h3>
                                    <div className="text-sm text-gray-600 flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-teal-700">{selectedClinic?.name || 'Unidade não selecionada'}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CalendarIcon size={14} />
                                            {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                                            <span className="w-1 h-1 bg-gray-400 rounded-full" />
                                            {selectedTime}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">CPF</label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={formData.cpf}
                                        onChange={handleCPFChange}
                                        className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition-colors ${formData.cpf && !isCpfValid ? 'border-red-200 focus:border-red-500' : 'border-gray-100 focus:border-teal-500'
                                            }`}
                                        placeholder="000.000.000-00"
                                        maxLength={14}
                                    />
                                    {checkingCpf && (
                                        <div className="absolute right-3 top-3">
                                            <Loader2 className="animate-spin text-teal-600" size={20} />
                                        </div>
                                    )}
                                </div>
                                {formData.cpf && !isCpfValid && (
                                    <p className="text-red-500 text-xs mt-1 ml-1">CPF inválido.</p>
                                )}
                            </div>

                            <div className={`space-y-6 transition-all duration-300 ${isCpfValid ? 'opacity-100 max-h-[500px]' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Nome Completo (Nome e Sobrenome)</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition-colors ${formData.name && !isNameValid ? 'border-red-200 focus:border-red-500' : 'border-gray-100 focus:border-teal-500'
                                            }`}
                                        placeholder="Ex: João da Silva"
                                    />
                                    {formData.name && !isNameValid && !customerFound && (
                                        <p className="text-red-500 text-xs mt-1 ml-1">Por favor, digite seu nome e sobrenome.</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">WhatsApp / Telefone</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={handlePhoneChange}
                                        className={`w-full px-4 py-3 rounded-xl border-2 outline-none transition-colors ${formData.phone && !isPhoneValid ? 'border-red-200 focus:border-red-500' : 'border-gray-100 focus:border-teal-500'
                                            }`}
                                        placeholder="(99) 99999-9999"
                                        maxLength={15}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="p-12 text-center flex flex-col items-center justify-center">
                            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-6 animate-bounce-gentle">
                                <CheckCircle size={40} />
                            </div>
                            <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2">Solicitação Enviada!</h3>
                            <p className="text-gray-500 max-w-xs mx-auto mb-8">
                                Recebemos seu pedido de agendamento na unidade <strong>{selectedClinic?.name}</strong>. Em breve entraremos em contato pelo WhatsApp para confirmar.
                            </p>
                            <button onClick={onClose} className="text-teal-600 font-bold hover:underline">
                                Fechar e voltar ao site
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                {step < 4 && (
                    <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-between items-center shrink-0">
                        {step > 0 ? (
                            <button
                                onClick={() => setStep(step - 1)}
                                className="text-gray-500 hover:text-gray-800 font-medium px-4 py-2"
                            >
                                Voltar
                            </button>
                        ) : <div></div>}

                        <button
                            disabled={
                                (step === 0 && !selectedService) ||
                                (step === 1 && !selectedClinic) ||
                                (step === 2 && (!selectedDate || !selectedTime)) ||
                                (step === 3 && (!isNameValid || !isPhoneValid || !isCpfValid)) ||
                                loading
                            }
                            onClick={handleNext}
                            className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-teal-100 hover:shadow-teal-200 transition-all transform active:scale-95 flex items-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : null}
                            {step === 3 ? (loading ? 'Enviando...' : 'Finalizar Agendamento') : 'Continuar'}
                            {!loading && <ChevronRight size={18} />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BookingModal;
