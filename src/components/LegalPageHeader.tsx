import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

interface LegalPageHeaderProps {
  title: string;
  showPrintButton?: boolean;
  onPrint?: () => void;
}

export default function LegalPageHeader({
  title,
  showPrintButton = false,
  onPrint
}: LegalPageHeaderProps) {
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [prescriberName, setPrescriberName] = useState('Dr. Sarah Lin, PharmD');

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isLoggedIn ? '/dashboard' : '/login');
    }
  };

  useEffect(() => {
    const auth = typeof window !== 'undefined' && sessionStorage.getItem('rxguard_authenticated') === 'true';
    setIsLoggedIn(Boolean(auth));
    const storedName = sessionStorage.getItem('rxguard_prescriber_name');
    if (storedName) setPrescriberName(storedName);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-surface-container-high shadow-xs">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand Logo & Context */}
        <div className="flex items-center gap-3">
          <Link
            to={isLoggedIn ? "/dashboard" : "/login"}
            className="flex items-center gap-2.5 group shrink-0"
            title={isLoggedIn ? "Return to Prescription Dashboard" : "Return to Prescriber Login"}
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <span className="material-symbols-outlined text-[24px]">dentistry</span>
            </div>
            <div>
              <span className="font-headline font-bold text-lg text-primary block leading-none">Smile Clinic</span>
              <span className="text-[10px] text-secondary font-semibold uppercase tracking-wider">
                {isLoggedIn ? 'Prescription Portal' : 'Prescription System'}
              </span>
            </div>
          </Link>

          {/* Context Breadcrumb */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-on-surface-variant font-medium pl-3 border-l border-surface-container-high">
            <span className="text-outline">{isLoggedIn ? 'RxGuard Dashboard' : 'Prescription Access'}</span>
            <span className="text-outline">/</span>
            <span className="text-primary font-semibold">{title}</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 24/7 Dental Emergency Hotline */}
          <a
            href="tel:5552345678"
            className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition-colors shrink-0"
          >
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
            <span>Emergency 24/7:</span>
            <span className="font-bold">(555) 234-5678</span>
          </a>

          {/* Print Document Button */}
          {showPrintButton && (
            <button
              type="button"
              onClick={onPrint || (() => window.print())}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-semibold rounded-lg border border-surface-container-high transition-colors cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">print</span>
              <span>Print</span>
            </button>
          )}

          {isLoggedIn ? (
            <>
              {/* Prescriber Badge */}
              <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-surface-container-low border border-surface-container-high text-xs shrink-0">
                <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[11px] ring-1 ring-primary/30">
                  SL
                </div>
                <span className="font-bold text-on-surface text-[11px] truncate max-w-[140px]">{prescriberName}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </div>

              {/* Single Back Button */}
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white hover:bg-primary-container text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer shrink-0"
                title="Back to previous page"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Back</span>
              </button>
            </>
          ) : (
            <>
              {/* Sign In Button */}
              <Link
                to="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary-tint border border-primary/30 transition-all shadow-xs shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">login</span>
                <span>Sign In</span>
              </Link>

              {/* Back Button */}
              <button
                type="button"
                onClick={handleBack}
                className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-surface-container-high hover:bg-surface-container text-on-surface text-xs font-bold rounded-lg transition-all shadow-xs cursor-pointer shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                <span>Back</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
