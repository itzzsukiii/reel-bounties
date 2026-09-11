'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Briefcase, CheckCircle, MessageSquare, Shield, Trash2, 
  PauseCircle, PlayCircle, ExternalLink, Copy, Check, 
  Lock, Send, Link as LinkIcon, PlusCircle, Trophy, Clock, 
  Flame, DollarSign, LogIn, LogOut, User, X, Sparkles
} from 'lucide-react';

const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "8888";

// Official Creator Core Vector Icon
function CreatorCoreLogo({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="ccGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="45%" stopColor="#E5C7FF" />
          <stop offset="100%" stopColor="#887DFF" />
        </linearGradient>
        <linearGradient id="starGrad" x1="0%" y1="0%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#7567FF" />
          <stop offset="50%" stopColor="#887DFF" />
          <stop offset="100%" stopColor="#C988FF" />
        </linearGradient>
      </defs>
      {/* Outer Glow Ring */}
      <circle cx="50" cy="50" r="47" stroke="url(#starGrad)" strokeWidth="2.5" opacity="0.85" />
      {/* Bold C Glyph */}
      <path
        d="M 64 26 C 56 18 43 16 32 23 C 17 33 15 54 24 68 C 32 81 52 84 65 74 C 71 69 74 63 74 63 L 59 53 C 57 57 53 60 47 60 C 39 60 34 52 35 44 C 36 36 43 32 50 33 C 55 34 59 38 60 41 Z"
        fill="url(#ccGrad)"
      />
      {/* Inner Sparkle */}
      <path
        d="M 50 49 Q 58 49 58 41 Q 58 49 76 49 Q 58 49 58 57 Q 58 49 50 49 Z"
        fill="url(#starGrad)"
      />
    </svg>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('campaigns');
  
  // Auth & Profile State
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Data States
  const [items, setItems] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [copiedUpi, setCopiedUpi] = useState('');

  // Form States
  const [chatInput, setChatInput] = useState('');
  const [submissionForm, setSubmissionForm] = useState({
    campaign_id: '',
    creator_handle: '',
    reel_url: '',
    views_claimed: '',
    upi_id: '',
  });

  const [newItem, setNewItem] = useState({
    type: 'CAMPAIGN',
    creator_name: '',
    title: '',
    reward_inr: '',
    total_budget: '',
    deadline: '',
    guidelines: '',
    assets_url: '',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user || null;
      setUser(currentUser);
      if (currentUser) {
        fetchUserProfile(currentUser.id);
      } else {
        setProfile(null);
      }
    });

    fetchItems();
    fetchSubmissions();
    fetchMessages();

    const channel = supabase
      .channel('chat-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
      authListener?.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchUserProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      setSubmissionForm((prev) => ({
        ...prev,
        creator_handle: prev.creator_handle || data.instagram_handle || '',
        upi_id: prev.upi_id || data.saved_upi_id || '',
      }));
    }
  };

  const fetchItems = async () => {
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (data) {
      setItems(data);
      if (data.length > 0 && !submissionForm.campaign_id) {
        setSubmissionForm((prev) => ({ ...prev, campaign_id: data[0].id }));
      }
    }
  };

  const fetchSubmissions = async () => {
    const { data } = await supabase.from('submissions').select('*, campaigns(title, type, reward_inr)').order('created_at', { ascending: false });
    if (data) setSubmissions(data);
  };

  const fetchMessages = async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : '',
      },
    });
    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    if (authMode === 'signup') {
      const { data, error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword,
        options: {
          data: { full_name: authName.trim() || 'Creator' }
        }
      });
      if (error) {
        setAuthError(error.message);
      } else {
        alert('Welcome to Creator Core! Account created successfully.');
        setShowAuthModal(false);
        setUser(data.user);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setShowAuthModal(false);
        setUser(data.user);
      }
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setIsAdmin(true);
      setPinError(false);
      setPinInput('');
    } else {
      setPinError(true);
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('campaigns').insert([{
      type: newItem.type,
      creator_name: newItem.creator_name,
      title: newItem.title,
      reward_inr: parseInt(newItem.reward_inr) || 0,
      total_budget: parseInt(newItem.total_budget) || 0,
      deadline: newItem.deadline || '',
      guidelines: newItem.guidelines,
      assets_url: newItem.assets_url || '',
      status: 'ACTIVE'
    }]);

    if (error) {
      alert('Error creating listing: ' + error.message);
    } else {
      alert(`${newItem.type === 'CAMPAIGN' ? 'Campaign' : 'Bounty'} posted successfully on Creator Core!`);
      setNewItem({ 
        type: newItem.type, 
        creator_name: '', 
        title: '', 
        reward_inr: '', 
        total_budget: '', 
        deadline: '', 
        guidelines: '', 
        assets_url: '' 
      });
      fetchItems();
    }
  };

  const toggleItemStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    await supabase.from('campaigns').update({ status: nextStatus }).eq('id', id);
    fetchItems();
  };

  const deleteItem = async (id) => {
    if (confirm('Delete this record and all associated submissions?')) {
      await supabase.from('campaigns').delete().eq('id', id);
      fetchItems();
      fetchSubmissions();
    }
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!submissionForm.reel_url || !submissionForm.upi_id) return alert('Please fill in all required fields.');

    const targetItem = items.find(i => i.id === submissionForm.campaign_id);
    if (targetItem && targetItem.deadline && new Date(targetItem.deadline) < new Date()) {
      return alert('This campaign has already reached its deadline.');
    }

    const { error } = await supabase.from('submissions').insert([{
      user_id: user.id,
      campaign_id: submissionForm.campaign_id,
      creator_handle: submissionForm.creator_handle,
      reel_url: submissionForm.reel_url,
      views_claimed: parseInt(submissionForm.views_claimed) || 0,
      upi_id: submissionForm.upi_id,
      status: 'PENDING'
    }]);

    if (!error) {
      await supabase.from('profiles').update({
        instagram_handle: submissionForm.creator_handle,
        saved_upi_id: submissionForm.upi_id
      }).eq('id', user.id);

      alert('Proof submitted successfully! Admin will review views and transfer the UPI reward.');
      setSubmissionForm({ ...submissionForm, reel_url: '', views_claimed: '' });
      fetchSubmissions();
    } else {
      alert('Error submitting proof: ' + error.message);
    }
  };

  const updateSubmissionStatus = async (id, status) => {
    await supabase.from('submissions').update({ status }).eq('id', id);
    fetchSubmissions();
  };

  const deleteSubmission = async (id) => {
    if (confirm('Delete this submission record?')) {
      await supabase.from('submissions').delete().eq('id', id);
      fetchSubmissions();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUpi(text);
    setTimeout(() => setCopiedUpi(''), 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    if (!chatInput.trim()) return;
    const sender = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
    await supabase.from('messages').insert([{ sender_name: sender, content: chatInput.trim() }]);
    setChatInput('');
  };

  const deleteChatMessage = async (id) => {
    await supabase.from('messages').delete().eq('id', id);
    fetchMessages();
  };

  const getBudgetStatus = (item) => {
    if (!item.total_budget || item.total_budget <= 0) return null;
    const paidAmount = submissions
      .filter(s => s.campaign_id === item.id && s.status === 'PAID')
      .reduce((acc, s) => acc + (item.reward_inr || 0), 0);
    const remaining = Math.max(0, item.total_budget - paidAmount);
    const percent = Math.min(100, Math.round((paidAmount / item.total_budget) * 100));
    return { paidAmount, remaining, percent, isExhausted: remaining <= 0 };
  };

  const leaderboard = useMemo(() => {
    const creatorsMap = {};
    submissions.forEach(sub => {
      const handle = (sub.creator_handle || 'anonymous').trim().toLowerCase();
      if (!creatorsMap[handle]) {
        creatorsMap[handle] = {
          handle: sub.creator_handle,
          totalEarned: 0,
          totalViews: 0,
          paidSubmissions: 0,
        };
      }
      if (sub.status === 'PAID') {
        const reward = sub.campaigns?.reward_inr || 0;
        creatorsMap[handle].totalEarned += reward;
        creatorsMap[handle].totalViews += (sub.views_claimed || 0);
        creatorsMap[handle].paidSubmissions += 1;
      }
    });

    return Object.values(creatorsMap)
      .filter(c => c.totalEarned > 0 || c.totalViews > 0)
      .sort((a, b) => b.totalEarned - a.totalEarned || b.totalViews - a.totalViews);
  }, [submissions]);

  const activeCampaigns = items.filter(i => (i.type === 'CAMPAIGN' || !i.type) && i.status === 'ACTIVE');
  const activeBounties = items.filter(i => i.type === 'BOUNTY' && i.status === 'ACTIVE');

  return (
    <div className="min-h-screen bg-[#08080F] text-[#F4F4F6] flex flex-col font-sans selection:bg-[#887DFF]/30 selection:text-white">
      {/* Brand Header */}
      <header className="border-b border-[#1F1F26] bg-[#08080F]/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <CreatorCoreLogo className="w-8 h-8" />
          <div>
            <span className="font-extrabold text-lg tracking-tight text-white block leading-none">
              Creator <span className="text-[#C988FF]">Core</span>
            </span>
            <span className="text-[9px] uppercase tracking-widest text-[#887DFF] font-semibold">
              Create • Connect • Grow
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-2 bg-[#14141E] border border-[#28283C] px-3 py-1.5 rounded-lg text-xs">
              <User className="w-3.5 h-3.5 text-[#887DFF]" />
              <span className="font-semibold text-neutral-200">
                {profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0]}
              </span>
              <button 
                onClick={handleSignOut} 
                title="Sign Out" 
                className="ml-2 text-neutral-500 hover:text-red-400 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }}
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#887DFF] to-[#A278FF] hover:from-[#786CFF] hover:to-[#9366FF] text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs transition-all shadow-md shadow-[#887DFF]/20"
            >
              <LogIn className="w-3.5 h-3.5" /> Sign In / Join
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => setIsAdmin(false)}
              className="flex items-center gap-1 text-xs bg-red-950/80 text-red-400 border border-red-800 px-2.5 py-1.5 rounded-lg hover:bg-red-900 transition-colors"
            >
              <Lock className="w-3 h-3" /> Lock Admin
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-[#1F1F26] px-6 bg-[#0E0E18] gap-4 sm:gap-6 overflow-x-auto">
        {[
          { id: 'campaigns', label: 'Campaigns', icon: Briefcase },
          { id: 'bounties', label: 'Bounties', icon: Sparkles },
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          { id: 'submit', label: 'Submit Proof', icon: CheckCircle },
          { id: 'chat', label: 'Community Hub', icon: MessageSquare },
          { id: 'admin', label: 'Admin Desk', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id 
                  ? 'border-[#887DFF] text-[#C988FF]' 
                  : 'border-transparent text-neutral-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        {/* ================= TAB 1: CAMPAIGNS ================= */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-xl font-bold text-white">Active Campaigns</h2>
                <p className="text-xs text-neutral-400">Complete tasks and brand campaigns to unlock rewards</p>
              </div>
              <span className="text-xs bg-[#1F1F26] border border-[#28283C] text-[#C988FF] px-2.5 py-1 rounded-full font-medium">
                {activeCampaigns.length} Open
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {activeCampaigns.length === 0 ? (
                <div className="col-span-2 text-center py-16 text-neutral-500 bg-[#12121B] border border-[#1F1F26] rounded-2xl">
                  No active campaigns right now. Check back shortly or view the Bounty board!
                </div>
              ) : (
                activeCampaigns.map((c) => {
                  const budgetInfo = getBudgetStatus(c);
                  const isExpired = c.deadline && new Date(c.deadline) < new Date();

                  return (
                    <div key={c.id} className="bg-[#12121C] border border-[#1F1F2C] hover:border-[#887DFF]/40 p-5 rounded-2xl flex flex-col justify-between transition-colors shadow-sm">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold px-2.5 py-1 bg-[#887DFF]/10 text-[#C988FF] border border-[#887DFF]/30 rounded-full">
                            Campaign • @{c.creator_name}
                          </span>
                          <span className="text-white font-extrabold text-xl tracking-tight">₹{c.reward_inr}</span>
                        </div>
                        <h3 className="font-bold text-lg text-white mt-1">{c.title}</h3>
                        
                        <div className="flex flex-wrap items-center gap-2.5 my-3 text-xs text-neutral-400">
                          {c.deadline && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                              isExpired ? 'bg-red-950/80 text-red-400 border-red-800' : 'bg-[#181824] border-[#29293C] text-neutral-300'
                            }`}>
                              <Clock className="w-3 h-3 text-[#887DFF]" />
                              {isExpired ? 'Deadline Passed' : `Ends: ${c.deadline}`}
                            </div>
                          )}
                          {budgetInfo && (
                            <div className="flex items-center gap-1 bg-[#181824] border border-[#29293C] px-2 py-0.5 rounded text-neutral-300">
                              <DollarSign className="w-3 h-3 text-[#C988FF]" />
                              Pool Left: ₹{budgetInfo.remaining} / ₹{c.total_budget}
                            </div>
                          )}
                        </div>

                        {budgetInfo && (
                          <div className="w-full bg-[#1A1A28] h-1.5 rounded-full overflow-hidden mb-3">
                            <div className="bg-gradient-to-r from-[#887DFF] to-[#C988FF] h-full transition-all" style={{ width: `${budgetInfo.percent}%` }} />
                          </div>
                        )}

                        <p className="text-sm text-neutral-400 mt-2 whitespace-pre-line leading-relaxed">{c.guidelines}</p>
                        
                        {c.assets_url && (
                          <a
                            href={c.assets_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-[#C988FF] hover:underline mt-3 bg-[#181826] px-3 py-1.5 rounded-lg border border-[#28283C]"
                          >
                            <LinkIcon className="w-3.5 h-3.5" /> Campaign Assets & Drive Files
                          </a>
                        )}
                      </div>
                      <button
                        disabled={isExpired || budgetInfo?.isExhausted}
                        onClick={() => {
                          setSubmissionForm((prev) => ({ ...prev, campaign_id: c.id }));
                          setActiveTab('submit');
                        }}
                        className={`mt-5 w-full font-semibold py-2.5 rounded-xl text-sm transition-all ${
                          isExpired || budgetInfo?.isExhausted
                            ? 'bg-[#181824] text-neutral-500 cursor-not-allowed border border-[#252535]'
                            : 'bg-gradient-to-r from-[#887DFF] to-[#9F72FF] hover:from-[#796CF0] hover:to-[#9060F0] text-white shadow-md shadow-[#887DFF]/20'
                        }`}
                      >
                        {isExpired ? 'Campaign Closed' : budgetInfo?.isExhausted ? 'Budget Exhausted' : 'Submit Campaign Proof'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: BOUNTIES ================= */}
        {activeTab === 'bounties' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h2 className="text-xl font-bold text-white">Active Reel Bounties</h2>
                <p className="text-xs text-neutral-400">Post reels, hit view milestones, and claim direct UPI rewards</p>
              </div>
              <span className="text-xs bg-[#1F1F26] border border-[#28283C] text-[#C988FF] px-2.5 py-1 rounded-full font-medium">
                {activeBounties.length} Open
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {activeBounties.length === 0 ? (
                <div className="col-span-2 text-center py-16 text-neutral-500 bg-[#12121B] border border-[#1F1F26] rounded-2xl">
                  No active bounties right now. Go to Admin Desk to post one!
                </div>
              ) : (
                activeBounties.map((b) => {
                  const budgetInfo = getBudgetStatus(b);
                  const isExpired = b.deadline && new Date(b.deadline) < new Date();

                  return (
                    <div key={b.id} className="bg-[#12121C] border border-[#1F1F2C] hover:border-[#C988FF]/40 p-5 rounded-2xl flex flex-col justify-between transition-colors shadow-sm">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold px-2.5 py-1 bg-[#C988FF]/10 text-[#E5C7FF] border border-[#C988FF]/30 rounded-full">
                            Bounty • @{b.creator_name}
                          </span>
                          <span className="text-[#C988FF] font-extrabold text-xl tracking-tight">₹{b.reward_inr}</span>
                        </div>
                        <h3 className="font-bold text-lg text-white mt-1">{b.title}</h3>
                        
                        <div className="flex flex-wrap items-center gap-2.5 my-3 text-xs text-neutral-400">
                          {b.deadline && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                              isExpired ? 'bg-red-950/80 text-red-400 border-red-800' : 'bg-[#181824] border-[#29293C] text-neutral-300'
                            }`}>
                              <Clock className="w-3 h-3 text-[#C988FF]" />
                              {isExpired ? 'Deadline Passed' : `Ends: ${b.deadline}`}
                            </div>
                          )}
                          {budgetInfo && (
                            <div className="flex items-center gap-1 bg-[#181824] border border-[#29293C] px-2 py-0.5 rounded text-neutral-300">
                              <DollarSign className="w-3 h-3 text-[#C988FF]" />
                              Pool Left: ₹{budgetInfo.remaining} / ₹{b.total_budget}
                            </div>
                          )}
                        </div>

                        {budgetInfo && (
                          <div className="w-full bg-[#1A1A28] h-1.5 rounded-full overflow-hidden mb-3">
                            <div className="bg-gradient-to-r from-[#C988FF] to-[#887DFF] h-full transition-all" style={{ width: `${budgetInfo.percent}%` }} />
                          </div>
                        )}

                        <p className="text-sm text-neutral-400 mt-2 whitespace-pre-line leading-relaxed">{b.guidelines}</p>
                        
                        {b.assets_url && (
                          <a
                            href={b.assets_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-[#C988FF] hover:underline mt-3 bg-[#181826] px-3 py-1.5 rounded-lg border border-[#28283C]"
                          >
                            <LinkIcon className="w-3.5 h-3.5" /> Video Footage & Audio Assets
                          </a>
                        )}
                      </div>
                      <button
                        disabled={isExpired || budgetInfo?.isExhausted}
                        onClick={() => {
                          setSubmissionForm((prev) => ({ ...prev, campaign_id: b.id }));
                          setActiveTab('submit');
                        }}
                        className={`mt-5 w-full font-semibold py-2.5 rounded-xl text-sm transition-all ${
                          isExpired || budgetInfo?.isExhausted
                            ? 'bg-[#181824] text-neutral-500 cursor-not-allowed border border-[#252535]'
                            : 'bg-gradient-to-r from-[#C988FF] to-[#887DFF] hover:opacity-90 text-black font-bold shadow-md shadow-[#C988FF]/20'
                        }`}
                      >
                        {isExpired ? 'Bounty Closed' : budgetInfo?.isExhausted ? 'Budget Exhausted' : 'Submit Bounty Clip'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: LEADERBOARD ================= */}
        {activeTab === 'leaderboard' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-[#887DFF]/10 border border-[#887DFF]/30 rounded-2xl mb-2">
                <Trophy className="w-6 h-6 text-[#C988FF]" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Creator Hall of Fame</h2>
              <p className="text-xs text-neutral-400">Top earning creators & editors across Creator Core bounties</p>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 bg-[#12121B] border border-[#1F1F26] rounded-2xl">
                No payouts verified yet. The first creators paid will rank here!
              </div>
            ) : (
              <div className="bg-[#12121C] border border-[#1F1F2C] rounded-2xl overflow-hidden shadow-lg">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-neutral-400 bg-[#161622] border-b border-[#1F1F2C]">
                    <tr>
                      <th className="py-3 px-4">Rank</th>
                      <th>Creator</th>
                      <th>Bounties Won</th>
                      <th>Total Views</th>
                      <th className="text-right px-4">Total Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-[#1F1F2C]">
                    {leaderboard.map((creator, index) => (
                      <tr key={creator.handle} className="hover:bg-[#181828]/50 transition-colors">
                        <td className="py-3.5 px-4 font-bold">
                          {index === 0 ? '🥇 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `#${index + 1}`}
                        </td>
                        <td className="font-semibold text-white">
                          <span className="flex items-center gap-1.5">
                            {creator.handle}
                            {index === 0 && <Flame className="w-4 h-4 text-[#C988FF]" />}
                          </span>
                        </td>
                        <td className="text-neutral-300">{creator.paidSubmissions}</td>
                        <td className="text-neutral-300">{creator.totalViews.toLocaleString()}</td>
                        <td className="text-right px-4 font-extrabold text-[#C988FF]">
                          ₹{creator.totalEarned.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 4: SUBMIT PROOF ================= */}
        {activeTab === 'submit' && (
          <div className="max-w-lg mx-auto bg-[#12121C] border border-[#1F1F2C] p-6 rounded-2xl shadow-xl">
            <h2 className="text-lg font-bold text-white mb-1">Submit Proof of Work</h2>
            <p className="text-xs text-neutral-400 mb-5">Select the campaign or bounty you completed to claim your reward via UPI.</p>
            
            {!user ? (
              <div className="text-center py-8 bg-[#161624] border border-[#252538] rounded-xl p-6">
                <CreatorCoreLogo className="w-12 h-12 mx-auto mb-3" />
                <h3 className="font-bold text-white mb-1">Account Required to Claim Payout</h3>
                <p className="text-xs text-neutral-400 mb-5">Sign in to automatically link your verified identity, save your UPI handle, and track payments.</p>
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="bg-gradient-to-r from-[#887DFF] to-[#A278FF] hover:opacity-95 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-all shadow-lg shadow-[#887DFF]/25"
                >
                  Sign In or Create Account
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitProof} className="space-y-4">
                <div>
                  <label className="text-xs text-neutral-400 font-medium">Select Campaign or Bounty</label>
                  <select
                    value={submissionForm.campaign_id}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, campaign_id: e.target.value })}
                    className="w-full mt-1 bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm text-neutral-200 outline-none focus:border-[#887DFF]"
                  >
                    {items.filter(i => i.status === 'ACTIVE').map((i) => (
                      <option key={i.id} value={i.id}>
                        [{i.type === 'BOUNTY' ? 'Bounty' : 'Campaign'}] {i.title} (₹{i.reward_inr})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-medium">Your Instagram Handle</label>
                  <input
                    required
                    placeholder="@your_handle"
                    value={submissionForm.creator_handle}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, creator_handle: e.target.value })}
                    className="w-full mt-1 bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-medium">Instagram Reel Link</label>
                  <input
                    required
                    placeholder="https://www.instagram.com/reel/..."
                    value={submissionForm.reel_url}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, reel_url: e.target.value })}
                    className="w-full mt-1 bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-medium">Views Achieved</label>
                  <input
                    required
                    type="number"
                    placeholder="e.g. 15000"
                    value={submissionForm.views_claimed}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, views_claimed: e.target.value })}
                    className="w-full mt-1 bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 font-medium">Your UPI ID (Saved to Your Account)</label>
                  <input
                    required
                    placeholder="username@okhdfcbank, mobile@paytm"
                    value={submissionForm.upi_id}
                    onChange={(e) => setSubmissionForm({ ...submissionForm, upi_id: e.target.value })}
                    className="w-full mt-1 bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                  />
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-[#887DFF] to-[#A278FF] hover:opacity-95 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-lg shadow-[#887DFF]/20">
                  Submit for Verification
                </button>
              </form>
            )}
          </div>
        )}

        {/* ================= TAB 5: COMMUNITY CHAT ================= */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[550px] bg-[#12121C] border border-[#1F1F2C] rounded-2xl overflow-hidden shadow-xl">
            <div className="p-3.5 border-b border-[#1F1F2C] bg-[#161624] flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CreatorCoreLogo className="w-5 h-5" />
                <span className="text-xs font-semibold text-neutral-200">Creator Core Hub</span>
              </div>
              {isAdmin && <span className="text-[10px] bg-[#887DFF]/20 text-[#C988FF] px-2 py-0.5 rounded border border-[#887DFF]/30">Admin Mode</span>}
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
              {messages.length === 0 ? (
                <p className="text-neutral-500 text-sm text-center mt-20">No messages yet. Say hello to the creator network!</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="text-sm bg-[#181826] p-3 rounded-xl flex justify-between items-start group border border-[#222234]">
                    <div>
                      <span className="font-bold text-[#C988FF] text-xs">{m.sender_name}: </span>
                      <span className="text-neutral-200">{m.content}</span>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => deleteChatMessage(m.id)}
                        className="text-neutral-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            {user ? (
              <form onSubmit={handleSendMessage} className="p-3 bg-[#12121C] border-t border-[#1F1F2C] flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Discuss hooks, audio trends, or editing techniques..."
                  className="flex-1 bg-[#181826] border border-[#28283C] px-3.5 py-2 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                />
                <button type="submit" className="bg-[#887DFF] hover:bg-[#796CF0] text-white px-4 py-2 rounded-xl font-medium transition-colors">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="p-3 bg-[#12121C] border-t border-[#1F1F2C] text-center">
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="text-xs text-[#C988FF] hover:underline font-medium"
                >
                  Sign in to join the conversation
                </button>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 6: ADMIN DASHBOARD ================= */}
        {activeTab === 'admin' && (
          <div>
            {!isAdmin ? (
              <div className="max-w-sm mx-auto bg-[#12121C] border border-[#1F1F2C] p-6 rounded-2xl text-center mt-12 shadow-2xl">
                <Shield className="w-10 h-10 text-[#887DFF] mx-auto mb-3" />
                <h3 className="font-bold text-lg text-white mb-1">Admin Access Only</h3>
                <p className="text-xs text-neutral-400 mb-4">Enter your secret PIN to unlock campaigns, bounties, and UPI payouts.</p>
                <form onSubmit={handlePinSubmit} className="space-y-3">
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="Enter Secret PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full text-center bg-[#181826] border border-[#28283C] py-2 rounded-xl text-lg tracking-widest outline-none focus:border-[#887DFF]"
                  />
                  {pinError && <p className="text-xs text-red-400">Incorrect PIN.</p>}
                  <button type="submit" className="w-full bg-gradient-to-r from-[#887DFF] to-[#A278FF] text-white font-bold py-2 rounded-xl text-sm">
                    Unlock Dashboard
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-8">
                {/* 1. Post New Item */}
                <div className="bg-[#12121C] border border-[#1F1F2C] p-5 rounded-2xl">
                  <h3 className="font-bold text-base text-white mb-3 flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-[#887DFF]" /> Create New Listing
                  </h3>
                  
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, type: 'CAMPAIGN' })}
                      className={`flex-1 py-2 rounded-xl font-bold text-xs border transition-all ${
                        newItem.type === 'CAMPAIGN' 
                          ? 'bg-[#887DFF] text-white border-[#887DFF]' 
                          : 'bg-[#181826] text-neutral-400 border-[#28283C] hover:text-white'
                      }`}
                    >
                      Post as Campaign
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, type: 'BOUNTY' })}
                      className={`flex-1 py-2 rounded-xl font-bold text-xs border transition-all ${
                        newItem.type === 'BOUNTY' 
                          ? 'bg-[#C988FF] text-black border-[#C988FF]' 
                          : 'bg-[#181826] text-neutral-400 border-[#28283C] hover:text-white'
                      }`}
                    >
                      Post as Bounty
                    </button>
                  </div>

                  <form onSubmit={handleCreateItem} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      required
                      placeholder="Brand or Host Handle (e.g. CreatorCore)"
                      value={newItem.creator_name}
                      onChange={(e) => setNewItem({ ...newItem, creator_name: e.target.value })}
                      className="bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                    />
                    <input
                      required
                      type="number"
                      placeholder="Reward per Winner in ₹ (e.g. 1000)"
                      value={newItem.reward_inr}
                      onChange={(e) => setNewItem({ ...newItem, reward_inr: e.target.value })}
                      className="bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                    />
                    <input
                      type="number"
                      placeholder="Total Pool Budget in ₹ (Optional, e.g. 10000)"
                      value={newItem.total_budget}
                      onChange={(e) => setNewItem({ ...newItem, total_budget: e.target.value })}
                      className="bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                    />
                    <input
                      type="date"
                      value={newItem.deadline}
                      onChange={(e) => setNewItem({ ...newItem, deadline: e.target.value })}
                      className="bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm text-neutral-300 outline-none focus:border-[#887DFF]"
                    />
                    <input
                      required
                      placeholder="Title (e.g. Best 30s Hook Video / Product Showcase)"
                      value={newItem.title}
                      onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                      className="md:col-span-2 bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                    />
                    <input
                      placeholder="Drive or Asset Link (Footage, Logos, Reference Files)"
                      value={newItem.assets_url}
                      onChange={(e) => setNewItem({ ...newItem, assets_url: e.target.value })}
                      className="md:col-span-2 bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                    />
                    <textarea
                      required
                      placeholder="Guidelines & Rules (Deliverables, tagging requirements, minimum view metrics...)"
                      value={newItem.guidelines}
                      onChange={(e) => setNewItem({ ...newItem, guidelines: e.target.value })}
                      className="md:col-span-2 bg-[#181826] border border-[#28283C] p-2.5 rounded-xl text-sm outline-none focus:border-[#887DFF]"
                      rows={3}
                    />
                    <button 
                      type="submit" 
                      className={`md:col-span-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        newItem.type === 'CAMPAIGN' 
                          ? 'bg-[#887DFF] hover:bg-[#796CF0] text-white shadow-lg shadow-[#887DFF]/25' 
                          : 'bg-[#C988FF] hover:bg-[#B975F0] text-black shadow-lg shadow-[#C988FF]/25'
                      }`}
                    >
                      Publish to {newItem.type === 'CAMPAIGN' ? 'Campaign Board' : 'Bounty Board'}
                    </button>
                  </form>
                </div>

                {/* 2. Manage Listings */}
                <div className="bg-[#12121C] border border-[#1F1F2C] p-5 rounded-2xl">
                  <h3 className="font-bold text-base text-white mb-3">Manage Active Listings</h3>
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div key={it.id} className="bg-[#181826] border border-[#252538] p-3 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              it.type === 'BOUNTY' 
                                ? 'bg-[#C988FF]/15 text-[#E5C7FF] border-[#C988FF]/30' 
                                : 'bg-[#887DFF]/15 text-[#C988FF] border-[#887DFF]/30'
                            }`}>
                              {it.type || 'CAMPAIGN'}
                            </span>
                            <span className="font-bold text-sm text-white">{it.title}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${it.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-800 text-neutral-300'}`}>
                              {it.status}
                            </span>
                          </div>
                          <span className="text-xs text-neutral-400">
                            @{it.creator_name} • ₹{it.reward_inr}
                            {it.total_budget > 0 && ` • Pool: ₹${it.total_budget}`}
                            {it.deadline && ` • Closes: ${it.deadline}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleItemStatus(it.id, it.status)}
                            className="text-xs bg-[#222234] hover:bg-[#2B2B42] border border-[#303048] px-3 py-1.5 rounded-lg flex items-center gap-1"
                          >
                            {it.status === 'ACTIVE' ? <><PauseCircle className="w-3.5 h-3.5 text-[#C988FF]" /> Pause</> : <><PlayCircle className="w-3.5 h-3.5 text-emerald-400" /> Resume</>}
                          </button>
                          <button
                            onClick={() => deleteItem(it.id)}
                            className="text-xs bg-red-950/60 hover:bg-red-900 text-red-400 border border-red-800 px-2.5 py-1.5 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. Submissions & UPI Payouts */}
                <div className="bg-[#12121C] border border-[#1F1F2C] p-5 rounded-2xl">
                  <h3 className="font-bold text-base text-white mb-3">Submissions & UPI Payout Desk</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-neutral-400 border-b border-[#1F1F2C]">
                        <tr>
                          <th className="py-2.5">Creator</th>
                          <th>Views</th>
                          <th>Reel</th>
                          <th>UPI ID</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-[#1F1F2C]">
                        {submissions.map((s) => (
                          <tr key={s.id} className="text-neutral-300">
                            <td className="py-3 font-medium text-white">{s.creator_handle}</td>
                            <td>{s.views_claimed.toLocaleString()}</td>
                            <td>
                              <a href={s.reel_url} target="_blank" rel="noreferrer" className="text-[#887DFF] hover:underline inline-flex items-center gap-1">
                                Reel <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                            <td>
                              <button
                                onClick={() => copyToClipboard(s.upi_id)}
                                className="inline-flex items-center gap-1 font-mono text-xs bg-[#181826] hover:bg-[#222236] px-2 py-1 rounded text-[#C988FF] border border-[#28283C]"
                              >
                                {s.upi_id}
                                {copiedUpi === s.upi_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                              </button>
                            </td>
                            <td>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.status === 'PAID' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                s.status === 'REJECTED' ? 'bg-red-950 text-red-400 border border-red-800' :
                                'bg-[#887DFF]/15 text-[#C988FF] border border-[#887DFF]/30'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="space-x-1.5">
                              {s.status === 'PENDING' && (
                                <>
                                  <button
                                    onClick={() => updateSubmissionStatus(s.id, 'PAID')}
                                    className="bg-emerald-500 hover:bg-emerald-400 text-black px-2.5 py-1 rounded text-xs font-bold"
                                  >
                                    Paid
                                  </button>
                                  <button
                                    onClick={() => updateSubmissionStatus(s.id, 'REJECTED')}
                                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-400 px-2 py-1 rounded text-xs"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => deleteSubmission(s.id)}
                                className="text-neutral-500 hover:text-red-400 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ================= DUAL AUTH MODAL ================= */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12121C] border border-[#1F1F2C] max-w-sm w-full p-6 rounded-3xl relative shadow-2xl">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <CreatorCoreLogo className="w-12 h-12 mx-auto mb-2" />
              <h3 className="font-bold text-lg text-white">
                {authMode === 'signin' ? 'Welcome to Creator Core' : 'Join Creator Core'}
              </h3>
              <p className="text-xs text-neutral-400 mt-1">
                {authMode === 'signin' ? 'Sign in to submit work and get paid' : 'Create an account to unlock bounties and payouts'}
              </p>
            </div>

            {authError && (
              <div className="bg-red-950/80 border border-red-800 text-red-300 text-xs p-2.5 rounded-xl mb-4 text-center">
                {authError}
              </div>
            )}

            {/* Google Sign In */}
            <button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full bg-white hover:bg-neutral-100 text-black font-semibold py-2.5 px-4 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors mb-4"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 border-b border-[#252538]" />
              <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">Or use email</span>
              <div className="flex-1 border-b border-[#252538]" />
            </div>

            {/* Email Form */}
            <form onSubmit={handleEmailAuth} className="space-y-3">
              {authMode === 'signup' && (
                <div>
                  <label className="text-[11px] text-neutral-400 font-medium">Your Name / Creator Handle</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Aarav Sharma"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    className="w-full mt-1 bg-[#181826] border border-[#28283C] px-3 py-2 rounded-xl text-sm text-white outline-none focus:border-[#887DFF]"
                  />
                </div>
              )}
              <div>
                <label className="text-[11px] text-neutral-400 font-medium">Email Address</label>
                <input
                  required
                  type="email"
                  placeholder="creator@example.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full mt-1 bg-[#181826] border border-[#28283C] px-3 py-2 rounded-xl text-sm text-white outline-none focus:border-[#887DFF]"
                />
              </div>
              <div>
                <label className="text-[11px] text-neutral-400 font-medium">Password</label>
                <input
                  required
                  type="password"
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full mt-1 bg-[#181826] border border-[#28283C] px-3 py-2 rounded-xl text-sm text-white outline-none focus:border-[#887DFF]"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-[#887DFF] to-[#A278FF] hover:opacity-95 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-md shadow-[#887DFF]/25 mt-2"
              >
                {authLoading ? 'Processing...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="mt-4 text-center">
              {authMode === 'signin' ? (
                <p className="text-xs text-neutral-400">
                  New creator?{' '}
                  <button
                    onClick={() => { setAuthMode('signup'); setAuthError(''); }}
                    className="text-[#C988FF] font-semibold hover:underline"
                  >
                    Create an account
                  </button>
                </p>
              ) : (
                <p className="text-xs text-neutral-400">
                  Already have an account?{' '}
                  <button
                    onClick={() => { setAuthMode('signin'); setAuthError(''); }}
                    className="text-[#C988FF] font-semibold hover:underline"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
