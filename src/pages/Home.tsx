import React, { useState } from 'react';
import Navbar from '../components/Navbar.tsx';
import Hero from '../components/Hero'; // Hero was already TSX, check import in Hero is fine.
import ServicesSection from '../components/ServicesSection.tsx';
import AboutSection from '../components/AboutSection.tsx';
import ContactSection from '../components/ContactSection.tsx';
import FloatingWhatsApp from '../components/FloatingWhatsApp';
import BookingModal from '../components/BookingModal';
import { ServiceForModal } from '../types';

const Home: React.FC = () => {
    const [selectedService, setSelectedService] = useState<ServiceForModal | null>(null);
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    const handleOpenBooking = (service: ServiceForModal | null = null) => {
        setSelectedService(service);
        setIsBookingOpen(true);
    };

    return (
        <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">
            <Navbar onOpenBooking={() => handleOpenBooking(null)} />
            <main>
                <Hero onOpenBooking={() => handleOpenBooking(null)} />
                <AboutSection />
                <ServicesSection onSelectService={handleOpenBooking} />
                <ContactSection />
            </main>

            <FloatingWhatsApp />

            {/* Booking Modal */}
            {isBookingOpen && (
                <BookingModal
                    onClose={() => setIsBookingOpen(false)}
                    service={selectedService}
                />
            )}

            {/* Footer Placeholder */}
            <footer className="bg-gray-900 text-white py-12">
                <div className="container mx-auto px-6 text-center text-gray-400">
                    <p>&copy; {new Date().getFullYear()} Dr. Wellington Oliveira. Todos os direitos reservados.</p>
                </div>
            </footer>
        </div>
    );
};

export default Home;
