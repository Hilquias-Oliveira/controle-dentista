import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Hero from '../components/Hero';
import ServicesSection from '../components/ServicesSection';
import AboutSection from '../components/AboutSection';
import ContactSection from '../components/ContactSection';
import FloatingWhatsApp from '../components/FloatingWhatsApp';
import BookingModal from '../components/BookingModal';

const Home = () => {
    const [selectedService, setSelectedService] = useState(null);
    const [isBookingOpen, setIsBookingOpen] = useState(false);

    const handleOpenBooking = (service = null) => {
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
                    service={selectedService}
                    onClose={() => setIsBookingOpen(false)}
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
