import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Lock, Loader2, ArrowLeft, Mail, Key } from 'lucide-react';
import { toast } from 'sonner';

const AdminLogin: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                navigate('/admin/dashboard');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6 || password.length > 10) {
            toast.error("A senha deve ter entre 6 e 10 dígitos.");
            return;
        }

        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
            toast.success("Bem-vindo de volta!");
            navigate('/admin/dashboard');
        } catch (error) {
            console.error(error);
            toast.error("Email ou senha inválidos.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async () => {
        if (!email) {
            toast.error("Digite seu email para recuperar a senha.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            toast.success("Email de redefinição enviado! Verifique sua caixa de entrada.");
        } catch (error) {
            console.error(error);
            toast.error("Erro ao enviar email. Verifique se o endereço está correto.");
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 to-blue-50 flex items-center justify-center p-4">
            <div className="bg-white/80 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-md p-8 animate-scale-in border border-white/50">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-6">
                        <img
                            src="/logo.png"
                            alt="Logo"
                            className="h-20 w-auto object-contain drop-shadow-md"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.style.display = 'none';
                                const sibling = target.nextSibling as HTMLElement;
                                if (sibling) sibling.style.display = 'flex';
                            }}
                        />
                        {/* Fallback Icon if logo fails */}
                        <div className="hidden w-20 h-20 bg-teal-100 text-teal-700 rounded-full items-center justify-center">
                            <Lock size={32} />
                        </div>
                    </div>
                    <h1 className="text-2xl font-serif font-bold text-gray-800 tracking-tight">Área do Cliente</h1>
                    <p className="text-gray-500 text-sm mt-1">Acesse sua conta com segurança</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1">Email</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Mail size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-teal-500 outline-none transition-all font-medium text-gray-700 placeholder-gray-400"
                                placeholder="nome@exemplo.com"
                            />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center ml-1">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Senha</label>
                        </div>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                <Key size={18} className="text-gray-400" />
                            </div>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                minLength={6}
                                maxLength={10}
                                className="w-full pl-11 pr-4 py-3 rounded-xl bg-gray-50 border-2 border-transparent focus:bg-white focus:border-teal-500 outline-none transition-all font-medium text-gray-700 placeholder-gray-400"
                                placeholder="******"
                            />
                        </div>
                        <div className="flex justify-end pt-1">
                            <button
                                type="button"
                                onClick={handleResetPassword}
                                className="text-xs text-teal-600 hover:text-teal-800 font-bold hover:underline"
                            >
                                Esqueci minha senha
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-teal-200 hover:shadow-xl hover:shadow-teal-300 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : 'Entrar no Sistema'}
                    </button>

                    <div className="pt-4 space-y-4">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-2 bg-white/80 text-gray-500">ou</span>
                            </div>
                        </div>

                        <Link
                            to="/register"
                            className="block w-full text-center py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 hover:border-gray-300 transition-all text-sm"
                        >
                            Criar Conta de Paciente
                        </Link>

                        <Link to="/" className="flex items-center justify-center gap-2 text-sm text-gray-400 hover:text-teal-600 transition-colors font-medium">
                            <ArrowLeft size={14} />
                            Voltar para o site
                        </Link>
                    </div>
                </form>
            </div>

            {/* Background Decoration */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-teal-200/30 rounded-full blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[100px]" />
            </div>
        </div>
    );
};

export default AdminLogin;
