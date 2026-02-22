'use client';

import React from 'react';
import Link from 'next/link';
import { Facebook, Instagram, Twitter, Youtube } from 'lucide-react';

export interface FooterLink {
  href: string;
  label: string;
}

export interface FooterSection {
  title: string;
  links: FooterLink[];
}

export interface FooterProps {
  sections?: FooterSection[];
}

// Sections matching ticket360.com.br style
const defaultSections: FooterSection[] = [
  {
    title: 'Sympla 360',
    links: [
      { href: '/events', label: 'Eventos' },
      { href: '/auth/register', label: 'Criar Conta' },
      { href: '/auth/login', label: 'Login' },
      { href: '/dashboard', label: 'Minha Conta' },
    ],
  },
  {
    title: 'Dúvidas',
    links: [
      { href: '/faq', label: 'Perguntas Frequentes' },
      { href: '/support', label: 'Central de Ajuda' },
      { href: '/refund-policy', label: 'Política de Reembolso' },
    ],
  },
  {
    title: 'Parcerias',
    links: [
      { href: '/organizer/dashboard', label: 'Seja um Organizador' },
      { href: '/contact', label: 'Fale Conosco' },
      { href: '/advertise', label: 'Anuncie Conosco' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Termos de Uso' },
      { href: '/privacy', label: 'Política de Privacidade' },
      { href: '/cookies', label: 'Política de Cookies' },
    ],
  },
];

export const Footer: React.FC<FooterProps> = ({ sections = defaultSections }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark-bg text-dark-text border-t border-dark-border">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
            <Link href="/" className="text-xl font-display font-bold text-accent">
              Sympla 360
            </Link>
            <p className="mt-3 text-sm text-dark-secondary leading-relaxed">
              Sua plataforma de eventos e ingressos.
            </p>

            {/* Social Networks */}
            <div className="flex gap-3 mt-4">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-dark-border text-dark-secondary hover:text-white hover:bg-accent transition-colors" aria-label="Facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-dark-border text-dark-secondary hover:text-white hover:bg-accent transition-colors" aria-label="Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-dark-border text-dark-secondary hover:text-white hover:bg-accent transition-colors" aria-label="Twitter">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-dark-border text-dark-secondary hover:text-white hover:bg-accent transition-colors" aria-label="Youtube">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Links */}
          {sections.map((section, index) => (
            <div key={index}>
              <p className="text-xs font-semibold text-dark-secondary uppercase tracking-wider mb-3">
                {section.title}
              </p>
              <ul className="space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-dark-secondary hover:text-white transition-colors inline-block"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Payment Methods */}
        <div className="mt-10 pt-8 border-t border-dark-border">
          <p className="text-xs font-semibold text-dark-secondary uppercase tracking-wider mb-3">
            Formas de Pagamento
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-dark-border rounded text-xs text-dark-secondary">Visa</span>
            <span className="px-2 py-1 bg-dark-border rounded text-xs text-dark-secondary">Mastercard</span>
            <span className="px-2 py-1 bg-dark-border rounded text-xs text-dark-secondary">American Express</span>
            <span className="px-2 py-1 bg-dark-border rounded text-xs text-dark-secondary">Pix</span>
            <span className="px-2 py-1 bg-dark-border rounded text-xs text-dark-secondary">Boleto</span>
            <span className="px-2 py-1 bg-dark-border rounded text-xs text-dark-secondary">Hiper</span>
            <span className="px-2 py-1 bg-dark-border rounded text-xs text-dark-secondary">Elo</span>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-8 pt-6 border-t border-dark-border">
          <p className="text-xs text-center text-dark-secondary">
            &copy; {currentYear} Sympla 360. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};
