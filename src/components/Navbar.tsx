import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { LogOut, LayoutDashboard, Calendar, Menu, X } from 'lucide-react';

interface NavbarProps {
    onOpenBooking: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onOpenBooking }) => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [user, setUser] = useState<User | null>(null);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);

        // Auth Listener
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
        });

        return () => {
            window.removeEventListener('scroll', handleScroll);
            unsubscribe();
        };
    }, []);

    const handleLogoutClick = (e: React.MouseEvent) => {
        e.preventDefault();
        setShowLogoutConfirm(true);
    };

    const confirmLogout = async () => {
        await signOut(auth);
        setShowLogoutConfirm(false);
    };

    return (
        <>
            <nav className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-white/90 backdrop-blur-md shadow-sm py-4' : 'bg-transparent py-6'}`}>
                <div className="container mx-auto px-6 flex items-center justify-between">
                    <a href="#" className="text-2xl font-serif font-bold text-teal-900 tracking-tight">
                        Dr. Wellington Oliveira<span className="text-teal-600">.</span>
                    </a>

                    {/* Desktop Menu */}
                    <div className="hidden md:flex items-center gap-8">
                        <a href="#services" className="text-gray-600 hover:text-teal-700 font-medium transition-colors">Tratamentos</a>
                        <a href="#about" className="text-gray-600 hover:text-teal-700 font-medium transition-colors">Sobre</a>
                        <a href="#contact" className="text-gray-600 hover:text-teal-700 font-medium transition-colors">Contato</a>

                        {user ? (
                            <div className="flex items-center gap-3">
                                <Link to="/admin/dashboard" className="text-teal-700 hover:text-teal-900 font-medium transition-colors flex items-center gap-1 bg-teal-50 px-3 py-1 rounded-full border border-teal-100">
                                    <LayoutDashboard size={14} />
                                    <span className="text-sm">Painel</span>
                                </Link>
                                <button
                                    onClick={handleLogoutClick}
                                    className="text-gray-500 hover:text-red-600 font-medium transition-colors flex items-center gap-1 hover:bg-red-50 px-3 py-1 rounded-full"
                                    title="Sair"
                                >
                                    <LogOut size={16} />
                                </button>
                            </div>
                        ) : (
                            <Link to="/admin" className="text-gray-600 hover:text-teal-700 font-medium transition-colors flex items-center gap-1">
                                <span className="text-sm border border-gray-200 px-3 py-1 rounded-full hover:bg-gray-50 transition-colors">Login</span>
                            </Link>
                        )}

                        <button onClick={onOpenBooking} className="bg-teal-600 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-teal-100 transition-all hover:-translate-y-0.5 flex items-center gap-2">
                            <Calendar size={18} />
                            Agendar Consulta
                        </button>
                    </div>

                    {/* Mobile Toggle */}
                    <button
                        className="md:hidden text-gray-700"
                        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    >
                        {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                    </button>
                </div>

                {/* Mobile Menu */}
                {isMobileMenuOpen && (
                    <div className="md:hidden absolute top-full left-0 w-full bg-white shadow-lg border-t border-gray-100 py-4 px-6 flex flex-col space-y-4 animate-fade-in-down">
                        <a href="#services" className="text-gray-600 hover:text-teal-600 py-2">Tratamentos</a>
                        <a href="#about" className="text-gray-600 hover:text-teal-600 py-2">Sobre</a>

                        <a href="#contact" className="text-gray-600 hover:text-teal-600 py-2">Contato</a>

                        {user ? (
                            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                                <Link to="/admin/dashboard" className="text-teal-700 font-medium py-2 flex items-center gap-2">
                                    <LayoutDashboard size={16} /> Painel Administrativo
                                </Link>
                                <button onClick={handleLogoutClick} className="text-red-600 font-medium py-2 flex items-center gap-2 text-left">
                                    <LogOut size={16} /> Sair
                                </button>
                            </div>
                        ) : (
                            <Link to="/admin" className="text-gray-600 hover:text-teal-600 py-2">Login Admin</Link>
                        )}

                        <button className="bg-teal-600 text-white py-3 rounded-lg font-bold w-full">
                            Agendar Agora
                        </button>
                    </div>
                )}
            </nav>

            {/* Logout Confirmation Modal */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 animate-scale-in">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Sair da conta?</h3>
                        <p className="text-gray-500 mb-6">Você precisará fazer login novamente para acessar o painel administrativo.</p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowLogoutConfirm(false)}
                                className="flex-1 py-2.5 rounded-xl text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmLogout}
                                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
                            >
                                Sair
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
