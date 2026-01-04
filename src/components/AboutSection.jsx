import React from 'react';
import { Instagram, GraduationCap, Clock, Award } from 'lucide-react';

const AboutSection = () => {
    return (
        <section id="about" className="py-24 bg-gray-50 overflow-hidden relative">
            <div className="container mx-auto px-6">
                <div className="flex flex-col lg:flex-row items-center gap-16">

                    {/* Image Side */}
                    <div className="lg:w-1/2 relative">
                        <div className="relative z-10 rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white transform rotate-2 hover:rotate-0 transition-all duration-500">
                            <img
                                src="/doctor-profile.png"
                                alt="Dr. Wellington Oliveira"
                                className="w-full h-auto object-cover"
                            />

                            {/* Floating Badge */}
                            <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur p-4 rounded-2xl shadow-lg border border-teal-100 animate-bounce-gentle">
                                <p className="text-teal-800 font-bold text-lg">Buco Maxilo</p>
                                <p className="text-teal-600 text-sm">Harmonização Orofacial</p>
                            </div>
                        </div>

                        {/* Decorative background elements */}
                        <div className="absolute top-10 -left-10 w-full h-full bg-teal-200/20 rounded-[3rem] -z-10 rotate-[-5deg]"></div>
                    </div>

                    {/* Content Side */}
                    <div className="lg:w-1/2 space-y-8">
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 text-teal-800 text-sm font-bold tracking-wide">
                            <Award size={16} />
                            Sobre o Doutor
                        </div>

                        <h2 className="text-4xl md:text-5xl font-serif font-bold text-gray-900 leading-tight">
                            Dr. Wellington Oliveira
                        </h2>
                        <h3 className="text-xl md:text-2xl text-teal-600 font-medium">
                            Cirurgião-Dentista | CRO/SC 23642
                        </h3>

                        <div className="space-y-4 text-lg text-gray-600 leading-relaxed">
                            <p>
                                O Dr. Wellington Oliveira é cirurgião-dentista com ampla experiência em diagnóstico oral, cirurgia oral menor, implantodontia, reabilitação protética e tratamentos restauradores. Atua também em procedimentos estéticos, como toxina botulínica, facetas em resina e ozonioterapia, oferecendo soluções modernas e personalizadas que integram saúde bucal, estética e qualidade de vida.
                            </p>
                            <p>
                                Atualmente é residente em Cirurgia e Traumatologia Bucomaxilofacial, o que o capacita para atuar em procedimentos de maior complexidade, sempre com segurança, ética e excelência técnica.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                            <div className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                                    <GraduationCap size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900">Formação</h4>
                                    <p className="text-sm text-gray-900 font-medium">Bacharel em Odontologia</p>
                                    <p className="text-xs text-gray-500 mt-1">Esp. Bucomaxilo • Pós em Orto/Implanto</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                                <div className="p-3 bg-teal-50 text-teal-600 rounded-lg">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <h4 className="font-bold text-gray-900">Experiência</h4>
                                    <p className="text-sm text-gray-500">Na Sorriso do Bem desde 2025</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 flex flex-col sm:flex-row gap-4">
                            <a
                                href="https://www.instagram.com/drwellingtonoliveiraa/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-8 py-4 rounded-xl font-bold transition-transform hover:-translate-y-1 shadow-lg hover:shadow-pink-200"
                            >
                                <Instagram size={24} />
                                Instagram
                            </a>
                            <a
                                href="https://www.threads.net/@drwellingtonoliveiraa"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-3 bg-black text-white px-8 py-4 rounded-xl font-bold transition-transform hover:-translate-y-1 shadow-lg hover:shadow-gray-400"
                            >
                                <span className="font-sans text-xl font-bold">@</span>
                                Threads
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AboutSection;
