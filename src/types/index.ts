export interface Service {
    id: string;
    name: string;
    price: number;
    description?: string;
    displayPrice?: boolean;
    duration?: number;
    allowedUnits?: string[];
    // UI specific props that might be injected
    title?: string;
    icon?: any; // ReactNode causes issues in non-tsx files sometimes, keeping flexible
    color?: string;
}

export type ServiceForModal = Service;

export interface Unit {
    id: string;
    name: string;
    address: string;
    phone?: string;
    whatsapp?: string;
    color?: string;
    schedule?: {
        weekly: Record<string, {
            active: boolean;
            ranges?: { start: string; end: string }[];
            start?: string;
            end?: string
        }>;
        exceptions?: ({ date: string; type: string; ranges?: any[] } | string)[];
    };
}

export interface Appointment {
    id: string;
    date: string;
    time: string;
    duration?: number;
    status: string;
    clinicId: string;
    clinicName?: string;
    customerId?: string;
    clientName?: string;
    clientPhone?: string;
    clientCpf?: string;
    serviceName?: string;
    createdAt?: any; // Firestore Timestamp
}

export interface UserProfile {
    uid: string;
    id?: string; // For Firestore docs where id is commonly used
    email: string | null;
    role: 'client' | 'gm' | 'admin' | 'dentist' | 'receptionist' | 'supervisor';
    name?: string;
    phone?: string;
    cpf?: string;
    createdAt?: any;
}
