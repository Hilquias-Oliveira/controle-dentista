import React from 'react';
import { ArrowRight, Star } from 'lucide-react';

const Hero = ({ onOpenBooking }) => {
    return (
        <section className="relative min-h-screen flex items-center pt-20 overflow-hidden bg-white">
            {/* Full Width Background Image with Overlay for Mobile/Tablet or Split for Desktop */}
            <div className="absolute inset-y-0 right-0 w-full lg:w-1/2 bg-gray-100">
                <img
                    src="/hero-image.png"
                    alt="Dr. Wellington atendendo paciente"
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-white via-white/50 to-transparent lg:via-white/20"></div>
            </div>

            <div className="container mx-auto px-6 relative z-10">
                <div className="max-w-2xl space-y-8 animate-fade-in-up py-12 lg:py-0">
                    <div className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-teal-800 text-sm font-bold tracking-wide uppercase border border-teal-100 animate-fade-in">
                        <Star size={14} className="fill-teal-800" />
                        Odontologia de Excelência
                    </div>

                    <h1 className="text-4xl md:text-5xl lg:text-7xl font-serif font-bold text-gray-900 leading-tight md:leading-[1.1]">
                        Seu melhor sorriso <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600">
                            começa aqui.
                        </span>
                    </h1>

                    <p className="hidden md:block text-lg text-gray-600 max-w-lg leading-relaxed">
                        Dr. Wellington Oliveira cuida da sua saúde bucal com tecnologia de ponta e um atendimento humanizado que você merece. Agende sua avaliação hoje mesmo.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button onClick={onOpenBooking} className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:shadow-teal-200 hover:-translate-y-1 flex items-center justify-center gap-2">
                            Agendar Avaliação
                            <ArrowRight size={20} />
                        </button>
                    </div>


                </div>
            </div>
        </section>
    );
};

export default Hero;
