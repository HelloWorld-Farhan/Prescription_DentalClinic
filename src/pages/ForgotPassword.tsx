import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import ForgotPasswordModal from '../components/ForgotPasswordModal';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(true);

  const handleSuccess = (email: string) => {
    sessionStorage.setItem('smileclinic_prescriber_registered_flash', `Password updated successfully for ${email}. You may now log in.`);
    navigate('/login');
  };

  const handleClose = () => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-surface to-secondary/5 -z-10" />

      {/* Header */}
      <header className="h-16 w-full bg-surface-container-lowest border-b border-surface-container-high px-4 lg:px-8 flex items-center justify-between shadow-xs">
        <Link to="/login" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
            <span className="material-symbols-outlined text-[24px]">dentistry</span>
          </div>
          <div>
            <span className="font-bold text-lg text-primary block leading-none">Smile Clinic</span>
            <span className="text-[10px] text-outline font-medium uppercase tracking-wider">
              RxGuard Decision Support
            </span>
          </div>
        </Link>

        <Link
          to="/login"
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          <span>Back to Sign In</span>
        </Link>
      </header>

      {/* Center Interactive Modal / View */}
      <main className="flex-1 flex items-center justify-center p-4">
        <ForgotPasswordModal
          isOpen={isModalOpen}
          onClose={handleClose}
          onSuccess={handleSuccess}
        />
      </main>

      {/* Footer */}
      <footer className="w-full bg-surface-container-lowest border-t border-surface-container-high py-4 px-4 text-center text-xs text-outline">
        © 2026 Smile Clinic Health System. DEA EPCS &amp; HIPAA 45 CFR §164 Certified Identity Recovery.
      </footer>
    </div>
  );
}
