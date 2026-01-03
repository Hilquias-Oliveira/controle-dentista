import React, { useEffect, useState } from 'react';
import { Sparkles, Activity, Smile, Search, Stethoscope, Heart, ShieldPlus } from 'lucide-react';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

// Custom Tooth Icon - Molar with Sparkle
const ToothIcon = ({ className, size = 24 }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M12 5.5c-2.5 0-4 1.5-5.5 2.5C5.5 9 5 11 5 14c0 3.5 2 6 3 8 0 0 1.5-1 2-3 .5-2 2-2 2-2s1.5 0 2 2c.5 2 2 3 2 3 1-2 3-4.5 3-8 0-3-.5-5-1.5-6-1.5-1-3-2.5-5.5-2.5z" />
        <path d="M8 8.5l1.5-1.5 1.5 1.5 1 1-1 1-1.5 1.5-1.5-1.5-1-1z" fill="currentColor" stroke="none" className="text-teal-400" />
        <path d="M9.5 7l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5z" />
    </svg>
);

const ServicesSection = ({ onSelectService }) => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchServices = async () => {
            try {
                const q = query(collection(db, "services"), orderBy("name"));
                const querySnapshot = await getDocs(q);
                const fetchedServices = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setServices(fetchedServices);
            } catch (error) {
                console.error("Error fetching services:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchServices();
    }, []);

    const [selectedServiceInfo, setSelectedServiceInfo] = useState(null);

    // Carousel State
    const [currentSlide, setCurrentSlide] = useState(0);
    const [visibleItems, setVisibleItems] = useState(4);

    // Resize Listener
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth >= 1024) {
                setVisibleItems(4);
            } else if (window.innerWidth >= 768) {
                setVisibleItems(2);
            } else {
                setVisibleItems(1);
            }
        };

        handleResize(); // Init
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const nextSlide = () => {
        const maxIndex = Math.max(0, services.length - visibleItems);
        setCurrentSlide((prev) => (prev >= maxIndex ? 0 : prev + 1));
    };

    const prevSlide = () => {
        const maxIndex = Math.max(0, services.length - visibleItems);
        setCurrentSlide((prev) => (prev <= 0 ? maxIndex : prev - 1));
    };

    return (
        <section id="services" className="py-24 bg-white relative">
            <div className="container mx-auto px-6">
                <div className="text-center max-w-2xl mx-auto mb-16">
                    <h2 className="text-4xl font-serif font-bold text-gray-900 mb-4">Tratamentos Especializados</h2>
                    <p className="text-gray-500 text-lg">
                        Oferecemos uma gama completa de serviços odontológicos para garantir que sua saúde bucal esteja sempre em dia.
                    </p>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-400">Carregando serviços...</p>
                    </div>
                ) : (
                    <div className="relative group/carousel">
                        {/* Navigation Buttons */}
                        <button
                            onClick={prevSlide}
                            className="absolute -left-4 md:-left-12 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white text-teal-600 rounded-full shadow-lg border border-gray-100 flex items-center justify-center hover:bg-teal-50 hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 disabled:opacity-50"
                            disabled={services.length <= visibleItems}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                        </button>

                        <button
                            onClick={nextSlide}
                            className="absolute -right-4 md:-right-12 top-1/2 -translate-y-1/2 z-10 w-12 h-12 bg-white text-teal-600 rounded-full shadow-lg border border-gray-100 flex items-center justify-center hover:bg-teal-50 hover:scale-110 transition-all opacity-0 group-hover/carousel:opacity-100 disabled:opacity-50"
                            disabled={services.length <= visibleItems}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                        </button>

                        <div className="overflow-hidden p-4 -m-4">
                            <div
                                className="flex transition-transform duration-500 ease-out"
                                style={{
                                    width: `${(services.length / visibleItems) * 100}%`,
                                    transform: `translateX(-${currentSlide * (100 / services.length)}%)`
                                }}
                            >
                                {services.map((service) => {
                                    const displayPrice = service.displayPrice !== false
                                        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(service.price)
                                        : "Sob Consulta";

                                    const serviceForModal = {
                                        ...service,
                                        title: service.name,
                                        icon: <ToothIcon className="w-8 h-8" />,
                                        color: "bg-teal-50 text-teal-600"
                                    };

                                    return (
                                        <div
                                            key={service.id}
                                            className="px-3 flex-shrink-0"
                                            style={{ width: `${100 / services.length}%` }}
                                        >
                                            <div className="group h-full p-6 rounded-3xl border border-gray-100 bg-white hover:border-transparent hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col max-w-[360px] mx-auto">
                                                <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                                                    <ToothIcon className="w-7 h-7" />
                                                </div>
                                                <h3 className="text-xl font-bold text-gray-900 mb-3">{service.name}</h3>

                                                <div className="flex-1 mb-5">
                                                    <p className="text-gray-500 leading-relaxed text-sm line-clamp-3">
                                                        {service.description || "Agende uma avaliação para saber mais sobre este tratamento."}
                                                    </p>
                                                </div>

                                                <div className="mt-auto space-y-3">
                                                    <div className="text-sm font-semibold text-gray-900 border-t border-gray-50 pt-3">
                                                        {displayPrice}
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            className="px-2 py-2 rounded-xl text-xs font-bold border-2 border-slate-100 text-slate-600 hover:border-teal-100 hover:text-teal-600 transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedServiceInfo(service);
                                                            }}
                                                        >
                                                            Info
                                                        </button>
                                                        <button
                                                            onClick={() => onSelectService(serviceForModal)}
                                                            className="px-2 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition-colors shadow-lg shadow-teal-100"
                                                        >
                                                            Agendar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {services.length === 0 && !loading && (
                    <p className="text-center text-gray-400">Nenhum serviço disponível no momento.</p>
                )}

                <div className="text-center mt-8">
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold bg-gray-50 inline-block px-4 py-2 rounded-full">
                        * Serviços sujeitos a avaliação clínica prévia
                    </p>
                </div>
            </div>

            {/* Service Info Modal */}
            {selectedServiceInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-8 relative animate-scale-in">
                        <button
                            onClick={() => setSelectedServiceInfo(null)}
                            className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>

                        <div className="w-16 h-16 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-6">
                            <ToothIcon className="w-8 h-8" />
                        </div>

                        <h3 className="text-2xl font-serif font-bold text-gray-900 mb-4">
                            {selectedServiceInfo.name}
                        </h3>

                        <div className="prose prose-teal max-w-none text-gray-600 mb-8 max-h-[60vh] overflow-y-auto">
                            <p className="whitespace-pre-wrap leading-relaxed">
                                {selectedServiceInfo.description || "Descrição detalhada do serviço indisponível no momento."}
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                const serviceForModal = {
                                    ...selectedServiceInfo,
                                    title: selectedServiceInfo.name,
                                    icon: <ToothIcon className="w-8 h-8" />,
                                    color: "bg-teal-50 text-teal-600"
                                };
                                setSelectedServiceInfo(null);
                                onSelectService(serviceForModal);
                            }}
                            className="w-full py-4 rounded-xl bg-teal-600 text-white font-bold text-lg hover:bg-teal-700 transition-all shadow-xl shadow-teal-100"
                        >
                            Agendar Agora
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
};

export default ServicesSection;
