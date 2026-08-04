import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, CreditCard, Infinity as InfinityIcon, User, Shield, MessageCircle, Zap, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export function UserDashboard() {
  const { profile, user, logout } = useAuth();

  if (!profile) return null;

  const handleBuyCredits = (plan: string) => {
    const phone = "+8801601934495";
    const message = encodeURIComponent(`Hi Admin, I want to buy the ${plan} plan for StockConv. My email is ${profile.email}.`);
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const plans = [
    { name: 'Starter', credits: '2,000', price: '200', value: '2000' },
    { name: 'Pro', credits: '5,000', price: '400', value: '5000', popular: true },
    { name: 'Enterprise', credits: '10,000', price: '600', value: '10000' },
    { name: 'Unlimited', credits: 'Infinite', price: '2000', value: 'unlimited', icon: <InfinityIcon className="w-5 h-5 text-purple-400" /> },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-6"
    >
      {/* Profile Card */}
      <div className="p-5 rounded-2xl bg-[#140D2B]/50 border border-purple-500/10 backdrop-blur-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            {profile.role === 'admin' ? <Shield className="w-6 h-6 text-white" /> : <User className="w-6 h-6 text-white" />}
          </div>
          <div className="flex-1 overflow-hidden">
            <h3 className="text-sm font-bold text-white truncate">{user?.displayName || 'User'}</h3>
            <p className="text-[11px] text-purple-400/60 truncate">{profile.email}</p>
          </div>
          <button 
            onClick={logout}
            className="p-2.5 rounded-xl bg-red-900/20 text-red-400 hover:bg-red-900/40 transition-colors border border-red-500/10"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="p-4 rounded-xl bg-[#0F0821] border border-purple-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-900/30 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-purple-400" />
              </div>
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">Balance</span>
            </div>
            <div className="flex items-center gap-2">
              {profile.isUnlimited ? (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-purple-500/20 rounded-full border border-purple-400/30">
                  <InfinityIcon className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-black text-purple-200">UNLIMITED</span>
                </div>
              ) : (
                <span className="text-2xl font-mono font-black text-white">{profile.credits}</span>
              )}
            </div>
          </div>
          
          <div className="px-4 py-3 rounded-lg bg-purple-900/10 border border-purple-500/10">
            <p className="text-[11px] text-purple-300/80 leading-relaxed">
              1 credit is deducted per image conversion. {profile.isUnlimited ? "Your account is set to unlimited." : "Choose a plan below to recharge."}
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Plans */}
      <div className="p-5 rounded-2xl bg-[#140D2B]/50 border border-purple-500/10 backdrop-blur-xl">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-widest">Upgrade Plan</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {plans.map((plan, i) => (
            <motion.button
              key={plan.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              onClick={() => handleBuyCredits(plan.name)}
              className={`relative flex flex-col items-center justify-center p-6 rounded-2xl border transition-all text-left overflow-hidden group ${
                plan.popular 
                  ? 'bg-purple-900/20 border-purple-400/40 hover:border-purple-400 hover:bg-purple-900/30 shadow-lg shadow-purple-900/20' 
                  : 'bg-[#0F0821] border-purple-500/10 hover:border-purple-500/30 hover:bg-[#1A103C]'
              }`}
            >
              {plan.popular && (
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500" />
              )}
              
              <div className="w-full flex justify-between items-center mb-4">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${plan.popular ? 'text-purple-300' : 'text-purple-400/60'}`}>
                  {plan.name}
                </span>
                {plan.popular && (
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-purple-500 text-white px-2 py-0.5 rounded-full">
                    Best Value
                  </span>
                )}
              </div>
              
              <div className="w-full flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-black text-white">{plan.price}</span>
                <span className="text-xs font-bold text-purple-400/60 uppercase">TK</span>
              </div>
              
              <div className="w-full flex items-center gap-2 mb-6">
                {plan.icon ? plan.icon : <ShieldCheck className="w-4 h-4 text-purple-400" />}
                <span className="text-sm font-bold text-purple-200">{plan.credits} Credits</span>
              </div>

              <div className={`w-full py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors ${
                plan.popular 
                  ? 'bg-purple-600 text-white group-hover:bg-purple-500' 
                  : 'bg-purple-900/30 text-purple-300 group-hover:bg-purple-600 group-hover:text-white'
              }`}>
                Buy Now
                <MessageCircle className="w-3.5 h-3.5" />
              </div>
            </motion.button>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-center p-4 bg-purple-950/20 rounded-xl border border-dashed border-purple-500/20">
          <p className="text-[10px] text-purple-400/60 text-center max-w-sm">
            After clicking "Buy Now", you will be redirected to WhatsApp to complete the payment via Bkash/Rocket.
          </p>
        </div>
      </div>
    </motion.div>
  );
}
