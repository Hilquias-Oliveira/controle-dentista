import React, { useState, useEffect } from 'react';
import { MapPin, Phone, MessageCircle } from 'lucide-react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const ContactSection = () => {
    const [clinics, setClinics] = useState([]);

    useEffect(() => {
        const q = query(collection(db, "units"), orderBy("name"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const units = snapshot.docs.map(doc => doc.data());
            // Fallback if empty (optional, but good for initial load if no data seeded yet)
            if (units.length === 0) {
                // You can leave empty or show default. For now, let's leave empty and let the Admin seed it.
                setClinics([]);
            } else {
                setClinics(units);
            }
        });
        return () => unsubscribe();
    }, []);

    const openMaps = (address) => {
        const encoded = encodeURIComponent(address);
        window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
    };

    return (
        <section id="contact" className="py-24 bg-white border-t border-gray-100">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">
                        Nossas Unidades
                    </h2>
                    <p className="text-lg text-gray-500">
                        Escolha a unidade mais próxima de você e agende sua avaliação com o Dr. Wellington em Blumenau.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {clinics.map((clinic, index) => (
                        <div key={index} className="bg-gray-50 rounded-2xl p-8 border border-gray-100 hover:shadow-xl transition-all group relative overflow-hidden">
                            <div className="relative z-10">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className={`p-3 rounded-lg ${clinic.color === 'teal' ? 'bg-teal-100 text-teal-700' : 'bg-blue-100 text-blue-700'}`}>
                                        <MapPin size={24} />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-bold text-gray-900">{clinic.name}</h3>
                                        <p className="text-sm text-gray-500">Blumenau - Centro</p>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-8">
                                    <div className="flex items-start gap-3 text-gray-600">
                                        <MapPin className="shrink-0 mt-1" size={18} />
                                        <p>{clinic.address}</p>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-600">
                                        <Phone className="shrink-0" size={18} />
                                        <p>{clinic.phone}</p>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-3">
                                    <a
                                        href={`https://wa.me/${clinic.whatsapp}?text=Olá,%20gostaria%20de%20agendar%20uma%20consulta.`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-white transition-transform hover:-translate-y-1 ${clinic.color === 'teal'
                                            ? 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100'
                                            : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-100'
                                            }`}
                                    >
                                        <MessageCircle size={20} />
                                        Chamar no WhatsApp
                                    </a>

                                    <button
                                        onClick={() => openMaps(clinic.address)}
                                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-gray-700 bg-white border-2 border-gray-200 hover:border-teal-500 hover:text-teal-700 transition-colors"
                                    >
                                        <MapPin size={20} />
                                        Como Chegar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default ContactSection;
