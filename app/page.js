// app/page.jsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  submitProofAction, 
  approveSubmissionAction, 
  rejectSubmissionAction, 
  deleteListingAction, 
  toggleListingStatusAction 
} from '@/app/actions';
import { 
  Briefcase, CheckCircle, MessageSquare, Shield, Trash2, 
  PauseCircle, PlayCircle, Send, Link as LinkIcon, PlusCircle, Trophy, Clock, 
  DollarSign, LogIn, LogOut, User, X, 
  ArrowUpRight, Calculator, Calendar, Building2, CheckSquare,
  Search, SlidersHorizontal, AlertCircle, Check
} from 'lucide-react';

const PRIMARY_ADMIN_EMAIL = 'gameraarush999@gmail.com';

const isValidContentUrl = (url) => {
  try {
    const parsed = new URL(url.trim());
    const validDomains = ['instagram.com', 'www.instagram.com', 'youtube.com', 'www.youtube.com', 'youtu.be', 'tiktok.com', 'www.tiktok.com'];
    return validDomains.some(d => parsed.hostname.endsWith(d));
  } catch {
    return false;
  }
};

const calculatePayout = (item, viewsClaimed) => {
  if (!item) return 0;
  if (item.type === 'BOUNTY') {
    return Number(item.reward_inr) || 0;
  }
  const v = Number(viewsClaimed) || 0;
  const r = Number(item.reward_inr) || 0;
  return Math.round((v / 1000) * r);
};

function CreatorCoreLogo({ size = 32 }) {
  return (
    <svg 
      viewBox="0 0 100 100" 
      width={size} 
      height={size} 
      style={{ minWidth: `${size}px`, minHeight: `${size}px`, display: 'inline-block' }}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ccGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="65%" stopColor="#E9E5FF" />
          <stop offset="100%" stopColor="#C988FF" />
        </linearGradient>
        <linearGradient id="ccStar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#887DFF" />
          <stop offset="100%" stopColor="#C988FF" />
        </linearGradient>
      </defs>
      <path d="M 68 22 A 40 40 0 1 0 68 78 L 68 60 A 22 22 0 1 1 68 40 Z" fill="url(#ccGrad)" />
      <path d="M 52 50 C 58 50 60 47 60 40 C 60 47 62 50 69 50 C 62 50 60 53 60 60 C 60 53 58 50 52 50 Z" fill="url(#ccStar)" />
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

  // Data States
  const [items, setItems] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [copiedUpi, setCopiedUpi] = useState('');

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [hideUnavailable, setHideUnavailable] = useState(false);

  // Form States
  const [chatInput, setChatInput] = useState('');
  const [submissionLoading, setSubmissionLoading] = useState(false);
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
    min_views: '',
    start_date: '',
    deadline: '',
    guidelines: '',
    assets_url: '',
  });

  const isAdmin = useMemo(() => {
    if (!user?.email) return false;
    return user.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase() || Boolean(profile?.is_admin);
  }, [user, profile]);

  useEffect(() => {
    if (activeTab === 'admin' && !isAdmin) {
      setActiveTab('campaigns');
    }
  }, [activeTab, isAdmin]);

  const fetchUserProfile = useCallback(async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setProfile(data);
      setSubmissionForm((prev) => ({
        ...prev,
        creator_handle: prev.creator_handle || data.instagram_handle || '',
        upi_id: prev.upi_id || data.saved_upi_id || '',
      }));
    }
  }, []);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (data) {
      setItems(data);
      if (data.length > 0 && !submissionForm.campaign_id) {
        setSubmissionForm((prev) => ({ ...prev, campaign_id: data[0].id }));
      }
    }
  }, [submissionForm.campaign_id]);

  const fetchSubmissions = useCallback(async () => {
    const { data } = await supabase
      .from('submissions')
      .select('*, campaigns(title, type, reward_inr, total_budget, creator_name, start_date, deadline, assets_url, min_views)')
      .order('created_at', { ascending: false });
    if (data) setSubmissions(data);
  }, []);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (data) setMessages(data);
  }, []);

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
  }, [fetchUserProfile, fetchItems, fetchSubmissions, fetchMessages]);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: typeof window !== 'undefined' ? window.location.origin : '' },
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
        options: { data: { full_name: authName.trim() || 'Creator' } }
      });
      if (error) {
        setAuthError(error.message);
      } else {
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
    setActiveTab('campaigns');
  };

  // Secure Server Action: Submit Proof with automated view verification
  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!user) return setShowAuthModal(true);

    if (!isValidContentUrl(submissionForm.reel_url)) {
      return alert('Fraud Protection: Please enter a valid URL from Instagram, YouTube, or TikTok.');
    }

    setSubmissionLoading(true);

    const res = await submitProofAction({
      userId: user.id,
      campaignId: submissionForm.campaign_id,
      creatorHandle: submissionForm.creator_handle,
      reelUrl: submissionForm.reel_url,
      claimedViews: submissionForm.views_claimed,
      upiId: submissionForm.upi_id,
    });

    setSubmissionLoading(false);

    if (res.error) {
      alert(res.error);
    } else {
      alert('Proof validated and submitted successfully! Check progress in "My Submissions".');
      setSubmissionForm((prev) => ({ ...prev, reel_url: '', views_claimed: '' }));
      fetchSubmissions();
      setActiveTab('my-submissions');
    }
  };

  // Secure Server Action: 1-Click Instant UPI Payout
  const handleApproveWithPayout = async (submissionId) => {
    if (!confirm('Approve submission and trigger instant UPI payout?')) return;

    const res = await approveSubmissionAction({
      submissionId,
      callerEmail: user?.email
    });

    if (res.error) {
      alert('Payout Failed: ' + res.error);
    } else {
      alert(`Success! ₹${res.amount} sent via UPI. Reference ID: ${res.txId}`);
      fetchSubmissions();
    }
  };

  const handleRejectSubmission = async (submissionId) => {
    const res = await rejectSubmissionAction({ submissionId, callerEmail: user?.email });
    if (res.error) alert(res.error);
    else fetchSubmissions();
  };

  const handleToggleStatus = async (id, status) => {
    const res = await toggleListingStatusAction({ listingId: id, currentStatus: status, callerEmail: user?.email });
    if (res.error) alert(res.error);
    else fetchItems();
  };

  const handleDeleteListing = async (id) => {
    if (!confirm('Delete listing and linked submissions?')) return;
    const res = await deleteListingAction({ listingId: id, callerEmail: user?.email });
    if (res.error) alert(res.error);
    else { fetchItems(); fetchSubmissions(); }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    const insertObj = {
      type: newItem.type,
      creator_name: newItem.creator_name,
      title: newItem.title,
      reward_inr: parseInt(newItem.reward_inr, 10) || 0,
      total_budget: parseInt(newItem.total_budget, 10) || 0,
      min_views: parseInt(newItem.min_views, 10) || 0,
      start_date: newItem.start_date || '',
      deadline: newItem.deadline || '',
      guidelines: newItem.guidelines,
      assets_url: newItem.assets_url || '',
      status: 'ACTIVE'
    };

    const { error } = await supabase.from('campaigns').insert([insertObj]);
    if (error) alert('Error creating: ' + error.message);
    else {
      setNewItem({ type: newItem.type, creator_name: '', title: '', reward_inr: '', total_budget: '', min_views: '', start_date: '', deadline: '', guidelines: '', assets_url: '' });
      fetchItems();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUpi(text);
    setTimeout(() => setCopiedUpi(''), 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!user) return setShowAuthModal(true);
    if (!chatInput.trim()) return;
    const sender = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
    await supabase.from('messages').insert([{ sender_name: sender, content: chatInput.trim() }]);
    setChatInput('');
  };

  const getBudgetStatus = (item) => {
    if (!item.total_budget || item.total_budget <= 0) return null;
    const paidAmount = submissions
      .filter(s => s.campaign_id === item.id && s.status === 'PAID')
      .reduce((acc, s) => acc + calculatePayout(item, s.views_claimed), 0);
    const remaining = Math.max(0, item.total_budget - paidAmount);
    const percent = Math.min(100, Math.round((paidAmount / item.total_budget) * 100));
    return { paidAmount, remaining, percent, isExhausted: remaining <= 0 };
  };

  const filterAndSortItems = useCallback((list) => {
    return list.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || item.title?.toLowerCase().includes(q) || item.creator_name?.toLowerCase().includes(q);
      if (!matchesSearch) return false;

      if (hideUnavailable) {
        const isExpired = item.deadline && new Date(item.deadline) < new Date();
        const budget = getBudgetStatus(item);
        if (isExpired || budget?.isExhausted) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'reward_high') return (b.reward_inr || 0) - (a.reward_inr || 0);
      if (sortBy === 'reward_low') return (a.reward_inr || 0) - (b.reward_inr || 0);
      if (sortBy === 'deadline') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [searchQuery, hideUnavailable, sortBy]);

  const activeCampaigns = useMemo(() => {
    const raw = items.filter(i => (i.type === 'CAMPAIGN' || !i.type) && i.status === 'ACTIVE');
    return filterAndSortItems(raw);
  }, [items, filterAndSortItems]);

  const activeBounties = useMemo(() => {
    const raw = items.filter(i => i.type === 'BOUNTY' && i.status === 'ACTIVE');
    return filterAndSortItems(raw);
  }, [items, filterAndSortItems]);

  const mySubmissions = useMemo(() => {
    if (!user) return [];
    return submissions.filter(s => s.user_id === user.id);
  }, [submissions, user]);

  const myEarned = useMemo(() => {
    return mySubmissions
      .filter(s => s.status === 'PAID')
      .reduce((acc, s) => acc + calculatePayout(s.campaigns, s.views_claimed), 0);
  }, [mySubmissions]);

  const myPendingCount = useMemo(() => {
    return mySubmissions.filter(s => s.status === 'PENDING').length;
  }, [mySubmissions]);

  const myJoinedCampaigns = useMemo(() => {
    if (!user || !items.length) return [];
    const joinedIds = new Set(mySubmissions.map(s => s.campaign_id));
    return items
      .filter(item => joinedIds.has(item.id))
      .map(item => {
        const itemSubs = mySubmissions.filter(s => s.campaign_id === item.id);
        const totalViews = itemSubs.reduce((acc, s) => acc + (Number(s.views_claimed) || 0), 0);
        const totalEarned = itemSubs
          .filter(s => s.status === 'PAID')
          .reduce((acc, s) => acc + calculatePayout(item, s.views_claimed), 0);
        const pendingCount = itemSubs.filter(s => s.status === 'PENDING').length;
        const paidCount = itemSubs.filter(s => s.status === 'PAID').length;
        return {
          ...item,
          clipsSubmitted: itemSubs.length,
          totalViews,
          totalEarned,
          pendingCount,
          paidCount
        };
      });
  }, [items, mySubmissions, user]);

  const leaderboard = useMemo(() => {
    const creatorsMap = {};
    submissions.forEach(sub => {
      const handle = (sub.creator_handle || 'anonymous').trim().toLowerCase();
      if (!creatorsMap[handle]) {
        creatorsMap[handle] = { handle: sub.creator_handle, totalEarned: 0, totalViews: 0, paidSubmissions: 0 };
      }
      if (sub.status === 'PAID') {
        creatorsMap[handle].totalEarned += calculatePayout(sub.campaigns, sub.views_claimed);
        creatorsMap[handle].totalViews += (Number(sub.views_claimed) || 0);
        creatorsMap[handle].paidSubmissions += 1;
      }
    });
    return Object.values(creatorsMap)
      .filter(c => c.totalEarned > 0 || c.totalViews > 0)
      .sort((a, b) => b.totalEarned - a.totalEarned);
  }, [submissions]);

  const selectedSubmitItem = items.find(i => i.id === submissionForm.campaign_id);
  const estimatedPayout = selectedSubmitItem ? calculatePayout(selectedSubmitItem, submissionForm.views_claimed) : 0;

  const navigationTabs = useMemo(() => {
    const baseTabs = [
      { id: 'campaigns', label: 'Campaigns (PPV)', icon: Briefcase },
      { id: 'bounties', label: 'Bounties', icon: CheckSquare },
      { id: 'my-campaigns', label: 'My Campaigns', icon: Building2, count: user ? myJoinedCampaigns.length : null },
      { id: 'my-submissions', label: 'My Submissions', icon: Clock, count: user ? mySubmissions.length : null },
      { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
      { id: 'submit', label: 'Submit Proof', icon: CheckCircle },
      { id: 'chat', label: 'Creator Hub', icon: MessageSquare },
    ];
    if (isAdmin) baseTabs.push({ id: 'admin', label: 'Admin Desk', icon: Shield });
    return baseTabs;
  }, [user, myJoinedCampaigns.length, mySubmissions.length, isAdmin]);

  return (
    <div style={{ backgroundColor: '#08080C', minHeight: '100vh', color: '#F4F4F6', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.07)', backgroundColor: 'rgba(12, 12, 16, 0.75)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 50, padding: '12px 24px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CreatorCoreLogo size={32} />
            <div>
              <div style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.02em', color: '#FFFFFF', lineHeight: 1.1 }}>Creator Core</div>
              <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#887DFF', fontWeight: 700, marginTop: '3px' }}>Automated Payouts & Verification</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '6px 12px', fontSize: '13px' }}>
                <User size={14} color={isAdmin ? "#C988FF" : "#887DFF"} />
                <span style={{ fontWeight: 600, color: '#F4F4F6' }}>
                  {profile?.full_name || user.email.split('@')[0]}
                  {isAdmin && <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 800, color: '#C988FF', backgroundColor: 'rgba(201, 136, 255, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>ADMIN</span>}
                </span>
                <button onClick={handleSignOut} style={{ marginLeft: '6px', color: '#8E8E9F', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><LogOut size={14} /></button>
              </div>
            ) : (
              <button onClick={() => { setAuthMode('signin'); setShowAuthModal(true); }} style={{ background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', borderRadius: '12px', padding: '8px 16px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <LogIn size={14} /> Sign In / Join
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Nav Tabs */}
      <div style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)', backgroundColor: '#0D0D12', padding: '8px 16px' }}>
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'flex', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          {navigationTabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: active ? 700 : 500, color: active ? '#FFFFFF' : '#8E8E9F', backgroundColor: active ? 'rgba(136, 125, 255, 0.15)' : 'transparent', border: active ? '1px solid rgba(136, 125, 255, 0.3)' : '1px solid transparent', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                <Icon size={15} color={active ? '#C988FF' : '#8E8E9F'} />
                {tab.label}
                {tab.count !== null && <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '999px', backgroundColor: active ? '#887DFF' : 'rgba(255, 255, 255, 0.1)', color: '#FFFFFF' }}>{tab.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      <main style={{ flex: 1, maxWidth: '1120px', width: '100%', margin: '0 auto', padding: '32px 20px' }}>
        
        {/* Search Bar */}
        {(activeTab === 'campaigns' || activeTab === 'bounties') && (
          <div style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '16px', padding: '14px 18px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 280px', backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '10px', padding: '8px 12px' }}>
              <Search size={16} color="#8E8E9F" />
              <input placeholder="Search by brand, title, or keywords..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: 'none', border: 'none', color: '#FFFFFF', fontSize: '13px', width: '100%', outline: 'none' }} />
              {searchQuery && <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', color: '#8E8E9F', cursor: 'pointer' }}><X size={14} /></button>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#8E8E9F' }}>
                <SlidersHorizontal size={14} />
                <span>Sort by:</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '8px', padding: '6px 10px', color: '#FFFFFF', fontSize: '12px' }}>
                  <option value="newest">Newest</option>
                  <option value="reward_high">Highest Reward</option>
                  <option value="reward_low">Lowest Reward</option>
                  <option value="deadline">Ending Soon</option>
                </select>
              </div>
              <button onClick={() => setHideUnavailable(!hideUnavailable)} style={{ fontSize: '12px', fontWeight: 600, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', border: hideUnavailable ? '1px solid rgba(136, 125, 255, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)', background: hideUnavailable ? 'rgba(136, 125, 255, 0.15)' : 'none', color: hideUnavailable ? '#C988FF' : '#8E8E9F' }}>
                {hideUnavailable ? '✓ Available Only' : 'Hide Full / Expired'}
              </button>
            </div>
          </div>
        )}

        {/* TAB: MY CAMPAIGNS (Restored) */}
        {activeTab === 'my-campaigns' && (
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>My Joined Campaigns & Brands</h2>
              <p style={{ fontSize: '13px', color: '#8E8E9F', margin: '4px 0 0 0' }}>Programs you are actively delivering for</p>
            </div>

            {!user ? (
              <div style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', padding: '48px 24px', textAlign: 'center' }}>
                <Building2 size={44} color="#887DFF" style={{ margin: '0 auto 14px auto' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 6px 0', color: '#FFFFFF' }}>Sign in to view your joined programs</h3>
                <p style={{ fontSize: '13px', color: '#8E8E9F', margin: '0 0 20px 0' }}>Track campaigns, bounties completed, and earnings per brand.</p>
                <button onClick={() => setShowAuthModal(true)} style={{ background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', padding: '11px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
                  Sign In or Create Account
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <div style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '18px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E9F', textTransform: 'uppercase' }}>Brands Joined</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', marginTop: '6px' }}>{myJoinedCampaigns.length}</div>
                  </div>
                  <div style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '18px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#C988FF', textTransform: 'uppercase' }}>Total Views Made</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#C988FF', marginTop: '6px' }}>{myJoinedCampaigns.reduce((acc, c) => acc + c.totalViews, 0).toLocaleString()}</div>
                  </div>
                  <div style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '18px', padding: '18px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#4ADE80', textTransform: 'uppercase' }}>Total Earned Across Brands</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#4ADE80', marginTop: '6px', fontFamily: 'monospace' }}>₹{myEarned.toLocaleString()}</div>
                  </div>
                </div>

                {myJoinedCampaigns.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '20px', color: '#8E8E9F' }}>
                    <Building2 size={36} color="#8E8E9F" style={{ margin: '0 auto 12px auto' }} />
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 6px 0' }}>No Joined Programs Yet</h3>
                    <p style={{ fontSize: '13px', margin: '0 0 16px 0' }}>Submit proof to any active campaign or bounty to track progress.</p>
                    <button onClick={() => setActiveTab('campaigns')} style={{ background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', padding: '9px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
                      Explore Programs
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
                    {myJoinedCampaigns.map((c) => (
                      <div key={c.id} style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: c.type === 'BOUNTY' ? 'rgba(201, 136, 255, 0.15)' : 'rgba(136, 125, 255, 0.15)', color: c.type === 'BOUNTY' ? '#C988FF' : '#887DFF', padding: '3px 10px', borderRadius: '999px' }}>
                              {c.type === 'BOUNTY' ? 'Task Bounty' : 'PPV Campaign'} • @{c.creator_name}
                            </span>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: '#4ADE80', fontFamily: 'monospace' }}>Earned: ₹{c.totalEarned.toLocaleString()}</span>
                          </div>
                          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px 0', color: '#FFFFFF' }}>{c.title}</h3>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '10px 0 14px 0', fontSize: '12px' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#B4B4C4' }}>
                              <Calendar size={12} color="#887DFF" /> {c.start_date ? `Starts: ${c.start_date}` : 'Ongoing'}
                            </span>
                            {c.deadline && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#B4B4C4' }}>
                                <Clock size={12} color="#C988FF" /> Ends: {c.deadline}
                              </span>
                            )}
                          </div>
                          <div style={{ backgroundColor: '#09090D', borderRadius: '12px', padding: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', marginBottom: '14px' }}>
                            <div>
                              <div style={{ fontSize: '10px', color: '#8E8E9F', textTransform: 'uppercase', fontWeight: 700 }}>Proofs Sent</div>
                              <div style={{ fontSize: '16px', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>{c.clipsSubmitted}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', color: '#8E8E9F', textTransform: 'uppercase', fontWeight: 700 }}>{c.type === 'BOUNTY' ? 'Completed' : 'Total Views'}</div>
                              <div style={{ fontSize: '16px', fontWeight: 800, color: '#C988FF', marginTop: '2px' }}>{c.type === 'BOUNTY' ? c.paidCount : c.totalViews.toLocaleString()}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', color: '#8E8E9F', textTransform: 'uppercase', fontWeight: 700 }}>In Review</div>
                              <div style={{ fontSize: '16px', fontWeight: 800, color: '#FBBF24', marginTop: '2px' }}>{c.pendingCount}</div>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => { setSubmissionForm((prev) => ({ ...prev, campaign_id: c.id })); setActiveTab('submit'); }} style={{ flex: 1, padding: '10px', borderRadius: '10px', background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '12px', border: 'none', cursor: 'pointer' }}>
                            Submit Another Proof
                          </button>
                          {c.assets_url && (
                            <a href={c.assets_url} target="_blank" rel="noreferrer" style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#FFFFFF', fontSize: '12px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              Assets <ArrowUpRight size={13} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB: CAMPAIGNS (Restored with Budget Bar) */}
        {activeTab === 'campaigns' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>Pay-Per-View Campaigns</h2>
                <p style={{ fontSize: '13px', color: '#8E8E9F', margin: '4px 0 0 0' }}>Create content and earn scaled cash per 1,000 verified views</p>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(136, 125, 255, 0.12)', color: '#C988FF', border: '1px solid rgba(136, 125, 255, 0.25)', borderRadius: '999px', padding: '4px 12px' }}>
                {activeCampaigns.length} available
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {activeCampaigns.map((c) => {
                const budgetInfo = getBudgetStatus(c);
                const isExpired = c.deadline && new Date(c.deadline) < new Date();

                return (
                  <div key={c.id} style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(136, 125, 255, 0.1)', color: '#C988FF', border: '1px solid rgba(136, 125, 255, 0.2)', padding: '3px 10px', borderRadius: '999px' }}>
                          PPV • @{c.creator_name}
                        </span>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '18px', fontWeight: 800, color: '#C988FF', fontFamily: 'monospace' }}>₹{c.reward_inr}</span>
                          <span style={{ fontSize: '11px', color: '#8E8E9F', marginLeft: '3px' }}>/ 1k views</span>
                        </div>
                      </div>

                      <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0', color: '#FFFFFF' }}>{c.title}</h3>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '12px 0', fontSize: '12px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#B4B4C4' }}>
                          <Calendar size={12} color="#887DFF" /> {c.start_date ? `Starts: ${c.start_date}` : 'Immediate'}
                        </span>
                        {c.deadline && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', backgroundColor: isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)', color: isExpired ? '#F87171' : '#B4B4C4' }}>
                            <Clock size={12} color="#C988FF" /> {isExpired ? 'Ended' : `Ends: ${c.deadline}`}
                          </span>
                        )}
                        {c.min_views > 0 && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', backgroundColor: 'rgba(201, 136, 255, 0.08)', color: '#C988FF' }}>
                            <AlertCircle size={12} /> Min {c.min_views.toLocaleString()} views
                          </span>
                        )}
                        {budgetInfo && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#B4B4C4' }}>
                            <DollarSign size={12} color="#887DFF" /> Pool: ₹{budgetInfo.remaining.toLocaleString()} left
                          </span>
                        )}
                      </div>

                      {budgetInfo && (
                        <div style={{ width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.05)', height: '5px', borderRadius: '999px', overflow: 'hidden', margin: '8px 0 12px 0' }}>
                          <div style={{ width: `${budgetInfo.percent}%`, height: '100%', background: 'linear-gradient(90deg, #887DFF, #C988FF)' }} />
                        </div>
                      )}

                      <p style={{ fontSize: '13px', color: '#8E8E9F', lineHeight: 1.5, margin: '10px 0', whiteSpace: 'pre-line' }}>{c.guidelines}</p>
                    </div>

                    <button disabled={isExpired || budgetInfo?.isExhausted} onClick={() => { setSubmissionForm((prev) => ({ ...prev, campaign_id: c.id })); setActiveTab('submit'); }} style={{ marginTop: '20px', width: '100%', padding: '11px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', background: isExpired || budgetInfo?.isExhausted ? '#1E1E26' : 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', border: 'none', cursor: isExpired || budgetInfo?.isExhausted ? 'not-allowed' : 'pointer' }}>
                      {isExpired ? 'Campaign Concluded' : budgetInfo?.isExhausted ? 'Budget Exhausted' : 'Submit Reel Proof'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB: BOUNTIES */}
        {activeTab === 'bounties' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>Task Bounties</h2>
                <p style={{ fontSize: '13px', color: '#8E8E9F', margin: '4px 0 0 0' }}>Fixed reward per task completion</p>
              </div>
              <span style={{ fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(201, 136, 255, 0.12)', color: '#C988FF', border: '1px solid rgba(201, 136, 255, 0.25)', borderRadius: '999px', padding: '4px 12px' }}>
                {activeBounties.length} open
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
              {activeBounties.map((b) => (
                <div key={b.id} style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(201, 136, 255, 0.1)', color: '#C988FF', border: '1px solid rgba(201, 136, 255, 0.2)', padding: '3px 10px', borderRadius: '999px' }}>
                        Bounty • @{b.creator_name}
                      </span>
                      <span style={{ fontSize: '20px', fontWeight: 800, color: '#4ADE80', fontFamily: 'monospace' }}>₹{b.reward_inr}</span>
                    </div>

                    <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 8px 0', color: '#FFFFFF' }}>{b.title}</h3>
                    <p style={{ fontSize: '13px', color: '#8E8E9F', lineHeight: 1.5, margin: '10px 0', whiteSpace: 'pre-line' }}>{b.guidelines}</p>
                    {b.assets_url && (
                      <a href={b.assets_url} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#C988FF', marginTop: '8px', textDecoration: 'none' }}>
                        <LinkIcon size={12} /> Task Asset / Link ↗
                      </a>
                    )}
                  </div>

                  <button onClick={() => { setSubmissionForm((prev) => ({ ...prev, campaign_id: b.id })); setActiveTab('submit'); }} style={{ marginTop: '20px', width: '100%', padding: '11px', borderRadius: '12px', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', background: 'linear-gradient(135deg, #C988FF 0%, #887DFF 100%)', border: 'none', cursor: 'pointer' }}>
                    Claim Bounty (Earn ₹{b.reward_inr})
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: MY SUBMISSIONS (Restored Full View) */}
        {activeTab === 'my-submissions' && (
          <div style={{ maxWidth: '820px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>My Submissions & Payouts</h2>
              <p style={{ fontSize: '13px', color: '#8E8E9F', margin: '4px 0 0 0' }}>Track approval status, automated verification, and direct UPI rewards</p>
            </div>

            {!user ? (
              <div style={{ backgroundColor: '#121217', borderRadius: '24px', padding: '48px 24px', textAlign: 'center' }}>
                <Clock size={44} color="#887DFF" style={{ margin: '0 auto 14px auto' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#FFFFFF' }}>Sign in to view your submissions</h3>
                <button onClick={() => setShowAuthModal(true)} style={{ marginTop: '16px', background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', padding: '11px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
                  Sign In
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
                  <div style={{ backgroundColor: '#121217', borderRadius: '18px', padding: '18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E9F', textTransform: 'uppercase' }}>Submissions</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#FFFFFF', marginTop: '6px' }}>{mySubmissions.length}</div>
                  </div>
                  <div style={{ backgroundColor: '#121217', borderRadius: '18px', padding: '18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#FBBF24', textTransform: 'uppercase' }}>Under Review</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#FBBF24', marginTop: '6px' }}>{myPendingCount}</div>
                  </div>
                  <div style={{ backgroundColor: '#121217', borderRadius: '18px', padding: '18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#4ADE80', textTransform: 'uppercase' }}>Total Earned</div>
                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#4ADE80', marginTop: '6px', fontFamily: 'monospace' }}>₹{myEarned.toLocaleString()}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {mySubmissions.map((sub) => {
                    const isPaid = sub.status === 'PAID';
                    const isPending = sub.status === 'PENDING';
                    const isRejected = sub.status === 'REJECTED';
                    const earnedOrEstimated = calculatePayout(sub.campaigns, sub.views_claimed);

                    return (
                      <div key={sub.id} style={{ backgroundColor: '#121217', border: isPaid ? '1px solid rgba(34, 197, 94, 0.25)' : isPending ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '18px', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px', backgroundColor: sub.campaigns?.type === 'BOUNTY' ? 'rgba(201, 136, 255, 0.15)' : 'rgba(136, 125, 255, 0.15)', color: sub.campaigns?.type === 'BOUNTY' ? '#C988FF' : '#887DFF' }}>
                              {sub.campaigns?.type === 'BOUNTY' ? 'BOUNTY' : 'PPV CAMPAIGN'}
                            </span>
                            <span style={{ fontWeight: 700, fontSize: '15px', color: '#FFFFFF' }}>{sub.campaigns?.title}</span>
                          </div>

                          <div style={{ fontSize: '12px', color: '#8E8E9F', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                            {sub.campaigns?.type === 'CAMPAIGN' && (
                              <span>Views: <strong style={{ color: '#F4F4F6' }}>{Number(sub.views_claimed).toLocaleString()}</strong> • </span>
                            )}
                            <span>UPI: <code style={{ color: '#C988FF' }}>{sub.upi_id}</code></span>
                            <span>•</span>
                            <a href={sub.reel_url} target="_blank" rel="noreferrer" style={{ color: '#887DFF', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              Proof Link <ArrowUpRight size={12} />
                            </a>
                            {sub.payout_tx_id && <span style={{ color: '#4ADE80' }}>• Tx: {sub.payout_tx_id}</span>}
                            {sub.payout_error && <span style={{ color: '#EF4444' }}>• Issue: {sub.payout_error}</span>}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          {isPaid && (
                            <div>
                              <span style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#4ADE80', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 800 }}>
                                Approved & Paid
                              </span>
                              <div style={{ fontSize: '15px', fontWeight: 800, color: '#4ADE80', marginTop: '4px', fontFamily: 'monospace' }}>
                                + ₹{earnedOrEstimated.toLocaleString()}
                              </div>
                            </div>
                          )}
                          {isPending && (
                            <div>
                              <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                                Under Review
                              </span>
                              <div style={{ fontSize: '11px', color: '#8E8E9F', marginTop: '4px' }}>
                                Reward: <strong style={{ color: '#FBBF24' }}>₹{earnedOrEstimated.toLocaleString()}</strong>
                              </div>
                            </div>
                          )}
                          {isRejected && (
                            <span style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '4px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                              Not Accepted
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: SUBMIT PROOF (Restored with Live Calculator Card) */}
        {activeTab === 'submit' && (
          <div style={{ maxWidth: '520px', margin: '0 auto', backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', padding: '28px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px 0', color: '#FFFFFF' }}>Submit Proof of Work</h2>
            <p style={{ fontSize: '13px', color: '#8E8E9F', margin: '0 0 24px 0' }}>Paste your live link for automated social verification and UPI payout</p>

            {!user ? (
              <div style={{ textAlign: 'center', padding: '32px 16px' }}>
                <CreatorCoreLogo size={40} />
                <h3 style={{ fontSize: '16px', fontWeight: 700, margin: '12px 0 6px 0', color: '#FFFFFF' }}>Sign In Required</h3>
                <p style={{ fontSize: '13px', color: '#8E8E9F', margin: '0 0 20px 0' }}>Create an account to bind your UPI ID and track payouts in real time.</p>
                <button onClick={() => setShowAuthModal(true)} style={{ background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', padding: '10px 24px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
                  Sign In or Create Account
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitProof} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E9F', textTransform: 'uppercase' }}>Select Campaign or Bounty</label>
                  <select value={submissionForm.campaign_id} onChange={(e) => setSubmissionForm({ ...submissionForm, campaign_id: e.target.value })} style={{ width: '100%', marginTop: '6px', backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '11px 14px', color: '#FFFFFF', fontSize: '13px' }}>
                    {items.filter(i => i.status === 'ACTIVE').map((i) => (
                      <option key={i.id} value={i.id}>
                        [{i.type === 'BOUNTY' ? 'BOUNTY' : 'PPV'}] {i.title} ({i.type === 'BOUNTY' ? `₹${i.reward_inr} Fixed Reward` : `₹${i.reward_inr}/1k views`})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E9F', textTransform: 'uppercase' }}>Your Social Handle</label>
                  <input required placeholder="@your_handle" value={submissionForm.creator_handle} onChange={(e) => setSubmissionForm({ ...submissionForm, creator_handle: e.target.value })} style={{ width: '100%', marginTop: '6px', backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '11px 14px', color: '#FFFFFF', fontSize: '13px' }} />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E9F', textTransform: 'uppercase' }}>
                      {selectedSubmitItem?.type === 'BOUNTY' ? 'Proof Link (Screenshot / Post / Deliverable)' : 'Instagram Reel / YouTube Shorts URL'}
                    </label>
                    {submissionForm.reel_url && (
                      <span style={{ fontSize: '11px', color: isValidContentUrl(submissionForm.reel_url) ? '#4ADE80' : '#F87171', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        {isValidContentUrl(submissionForm.reel_url) ? <><Check size={12} /> Valid URL</> : 'Invalid Format'}
                      </span>
                    )}
                  </div>
                  <input required placeholder={selectedSubmitItem?.type === 'BOUNTY' ? 'https://instagram.com/p/... or drive link' : 'https://instagram.com/reel/...'} value={submissionForm.reel_url} onChange={(e) => setSubmissionForm({ ...submissionForm, reel_url: e.target.value })} style={{ width: '100%', marginTop: '6px', backgroundColor: '#09090D', border: submissionForm.reel_url && !isValidContentUrl(submissionForm.reel_url) ? '1px solid #EF4444' : '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '11px 14px', color: '#FFFFFF', fontSize: '13px' }} />
                </div>

                {selectedSubmitItem?.type !== 'BOUNTY' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E9F', textTransform: 'uppercase' }}>Views Achieved</label>
                      {selectedSubmitItem?.min_views > 0 && (
                        <span style={{ fontSize: '11px', color: '#C988FF' }}>Min: {selectedSubmitItem.min_views.toLocaleString()}</span>
                      )}
                    </div>
                    <input required type="number" placeholder="e.g. 25000" value={submissionForm.views_claimed} onChange={(e) => setSubmissionForm({ ...submissionForm, views_claimed: e.target.value })} style={{ width: '100%', marginTop: '6px', backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '11px 14px', color: '#FFFFFF', fontSize: '13px' }} />
                  </div>
                )}

                {/* Restored Live Calculator Preview */}
                {selectedSubmitItem && (
                  <div style={{ backgroundColor: 'rgba(136, 125, 255, 0.1)', border: '1px solid rgba(136, 125, 255, 0.25)', borderRadius: '12px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Calculator size={18} color="#C988FF" />
                      <div>
                        <div style={{ fontSize: '11px', color: '#8E8E9F', textTransform: 'uppercase', fontWeight: 700 }}>
                          {selectedSubmitItem.type === 'BOUNTY' ? 'Fixed Bounty Reward' : 'Calculated PPV Payout'}
                        </div>
                        <div style={{ fontSize: '12px', color: '#F4F4F6' }}>
                          {selectedSubmitItem.type === 'BOUNTY'
                            ? `Fixed reward upon verification`
                            : `${Number(submissionForm.views_claimed || 0).toLocaleString()} views @ ₹${selectedSubmitItem.reward_inr} / 1k`}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#4ADE80', fontFamily: 'monospace' }}>
                      ₹{estimatedPayout.toLocaleString()}
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E9F', textTransform: 'uppercase' }}>UPI ID for Direct Payout</label>
                  <input required placeholder="username@okhdfcbank" value={submissionForm.upi_id} onChange={(e) => setSubmissionForm({ ...submissionForm, upi_id: e.target.value })} style={{ width: '100%', marginTop: '6px', backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '11px 14px', color: '#FFFFFF', fontSize: '13px' }} />
                </div>

                <button disabled={submissionLoading} type="submit" style={{ marginTop: '8px', background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer' }}>
                  {submissionLoading ? 'Verifying with Social API...' : 'Verify Link & Submit Proof'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* TAB: LEADERBOARD */}
        {activeTab === 'leaderboard' && (
          <div style={{ maxWidth: '780px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '16px', backgroundColor: 'rgba(136, 125, 255, 0.1)', border: '1px solid rgba(136, 125, 255, 0.2)', marginBottom: '10px' }}>
                <Trophy size={28} color="#C988FF" />
              </div>
              <h2 style={{ fontSize: '26px', fontWeight: 800, margin: 0, color: '#FFFFFF' }}>Creator Hall of Fame</h2>
              <p style={{ fontSize: '13px', color: '#8E8E9F', marginTop: '6px' }}>Top creators ranked by verified earnings</p>
            </div>

            <div style={{ backgroundColor: '#121217', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.08)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 140px', padding: '14px 20px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#8E8E9F', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <span>Rank</span>
                <span>Creator</span>
                <span>Views</span>
                <span style={{ textAlign: 'right' }}>Total Earned</span>
              </div>

              {leaderboard.map((c, i) => (
                <div key={c.handle} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 120px 140px', padding: '16px 20px', fontSize: '13px', alignItems: 'center', borderBottom: i === leaderboard.length - 1 ? 'none' : '1px solid rgba(255, 255, 255, 0.04)' }}>
                  <span style={{ fontWeight: 800, color: i === 0 ? '#C988FF' : '#FFFFFF' }}>
                    {i === 0 ? '🥇 1st' : i === 1 ? '🥈 2nd' : i === 2 ? '🥉 3rd' : `#${i + 1}`}
                  </span>
                  <span style={{ fontWeight: 600, color: '#FFFFFF' }}>{c.handle}</span>
                  <span style={{ color: '#8E8E9F' }}>{c.totalViews.toLocaleString()}</span>
                  <span style={{ textAlign: 'right', fontWeight: 800, color: '#4ADE80', fontFamily: 'monospace' }}>₹{c.totalEarned.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: COMMUNITY CHAT */}
        {activeTab === 'chat' && (
          <div style={{ maxWidth: '680px', margin: '0 auto', backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '540px' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}>Creator Hub</span>
              {isAdmin && <span style={{ fontSize: '11px', color: '#C988FF' }}>Admin Active</span>}
            </div>

            <div style={{ flex: 1, padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {messages.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#8E8E9F', margin: 'auto', fontSize: '13px' }}>No messages yet. Say hello!</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} style={{ backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '12px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '12px', color: '#C988FF', marginRight: '6px' }}>{m.sender_name}:</span>
                      <span style={{ fontSize: '13px', color: '#F4F4F6' }}>{m.content}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {user ? (
              <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', gap: '8px' }}>
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Share feedback or collaborate..." style={{ flex: 1, backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '10px 14px', color: '#FFFFFF', fontSize: '13px' }} />
                <button type="submit" style={{ background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', borderRadius: '12px', padding: '10px 16px', border: 'none', cursor: 'pointer' }}>
                  <Send size={15} />
                </button>
              </form>
            ) : (
              <div style={{ padding: '14px', textAlign: 'center', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <button onClick={() => setShowAuthModal(true)} style={{ color: '#C988FF', fontSize: '13px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                  Sign in to participate in chat
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB: ADMIN DESK (Restored Full Control Table & Creator Actions) */}
        {activeTab === 'admin' && isAdmin && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* 1. Review Table */}
            <div style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '24px', overflowX: 'auto' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#FFFFFF' }}>Review & 1-Click Instant UPI Disbursements</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ color: '#8E8E9F', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', fontSize: '11px', textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 0' }}>Creator</th>
                    <th>Metric</th>
                    <th>Payout</th>
                    <th>Proof</th>
                    <th>UPI Handle</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((s) => {
                    const payout = calculatePayout(s.campaigns, s.views_claimed);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                        <td style={{ padding: '14px 0', fontWeight: 600 }}>{s.creator_handle}</td>
                        <td style={{ color: '#8E8E9F' }}>{s.views_claimed?.toLocaleString()} views</td>
                        <td style={{ fontWeight: 800, color: '#4ADE80', fontFamily: 'monospace' }}>₹{payout.toLocaleString()}</td>
                        <td>
                          <a href={s.reel_url} target="_blank" rel="noreferrer" style={{ color: '#C988FF', textDecoration: 'none', fontWeight: 600 }}>Proof ↗</a>
                        </td>
                        <td>
                          <button onClick={() => copyToClipboard(s.upi_id)} style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', padding: '4px 8px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', color: '#C988FF', border: 'none', cursor: 'pointer' }}>
                            {s.upi_id} {copiedUpi === s.upi_id ? '✓' : ''}
                          </button>
                        </td>
                        <td>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', backgroundColor: s.status === 'PAID' ? 'rgba(34, 197, 94, 0.15)' : s.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: s.status === 'PAID' ? '#4ADE80' : s.status === 'REJECTED' ? '#F87171' : '#FBBF24' }}>
                            {s.status === 'PAID' ? 'PAID VIA UPI' : s.status}
                          </span>
                        </td>
                        <td>
                          {s.status === 'PENDING' ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => handleApproveWithPayout(s.id)} style={{ backgroundColor: '#22C55E', color: '#000000', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 800, border: 'none', cursor: 'pointer' }}>
                                Approve & Pay (UPI)
                              </button>
                              <button onClick={() => handleRejectSubmission(s.id)} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: '#8E8E9F', fontSize: '11px' }}>{s.payout_tx_id ? `Tx: ${s.payout_tx_id}` : 'Processed'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 2. Create Listing Form */}
            <div style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 4px 0', color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <PlusCircle size={18} color="#C988FF" /> Publish Program
              </h3>
              <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
                <button type="button" onClick={() => setNewItem({ ...newItem, type: 'CAMPAIGN' })} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, backgroundColor: newItem.type === 'CAMPAIGN' ? '#887DFF' : 'rgba(255, 255, 255, 0.05)', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.08)', cursor: 'pointer' }}>
                  PPV Campaign (Pay per 1k views)
                </button>
                <button type="button" onClick={() => setNewItem({ ...newItem, type: 'BOUNTY' })} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, backgroundColor: newItem.type === 'BOUNTY' ? '#C988FF' : 'rgba(255, 255, 255, 0.05)', color: '#FFFFFF', border: '1px solid rgba(255, 255, 255, 0.08)', cursor: 'pointer' }}>
                  Task Bounty (Fixed Reward)
                </button>
              </div>

              <form onSubmit={handleCreateItem} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <input required placeholder="Brand or Creator Handle (e.g. FitRaj)" value={newItem.creator_name} onChange={(e) => setNewItem({ ...newItem, creator_name: e.target.value })} style={{ backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '13px' }} />
                <input required type="number" placeholder="Total Pool Budget in ₹" value={newItem.total_budget} onChange={(e) => setNewItem({ ...newItem, total_budget: e.target.value })} style={{ backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '13px' }} />
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: newItem.type === 'BOUNTY' ? '#C988FF' : '#887DFF', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    {newItem.type === 'BOUNTY' ? 'Reward per Submission (₹)' : 'Rate / 1k Views (₹)'}
                  </label>
                  <input required type="number" placeholder={newItem.type === 'BOUNTY' ? '500' : '100'} value={newItem.reward_inr} onChange={(e) => setNewItem({ ...newItem, reward_inr: e.target.value })} style={{ backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '13px', width: '100%' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#8E8E9F', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Min Views Required</label>
                  <input type="number" placeholder="e.g. 1000" value={newItem.min_views} onChange={(e) => setNewItem({ ...newItem, min_views: e.target.value })} style={{ backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '13px', width: '100%' }} />
                </div>
                <input required placeholder="Title" value={newItem.title} onChange={(e) => setNewItem({ ...newItem, title: e.target.value })} style={{ gridColumn: '1 / -1', backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '13px' }} />
                <textarea required placeholder="Guidelines & Rules" value={newItem.guidelines} onChange={(e) => setNewItem({ ...newItem, guidelines: e.target.value })} rows={3} style={{ gridColumn: '1 / -1', backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '13px' }} />
                <button type="submit" style={{ gridColumn: '1 / -1', padding: '11px', borderRadius: '10px', background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer' }}>
                  Publish Program
                </button>
              </form>
            </div>

            {/* 3. Manage Listings */}
            <div style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '20px', padding: '24px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, margin: '0 0 16px 0', color: '#FFFFFF' }}>Manage Listings ({items.length})</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {items.map((it) => (
                  <div key={it.id} style={{ backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: '#FFFFFF' }}>{it.title}</div>
                      <div style={{ fontSize: '12px', color: '#8E8E9F' }}>@{it.creator_name} • ₹{it.reward_inr} • Status: {it.status}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button onClick={() => handleToggleStatus(it.id, it.status)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(255, 255, 255, 0.05)', color: '#F4F4F6', border: 'none', cursor: 'pointer' }}>
                        {it.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                      </button>
                      <button onClick={() => handleDeleteListing(it.id)} style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#EF4444', border: 'none', cursor: 'pointer' }}>
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal (Restored with Google Sign-in) */}
      {showAuthModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
          <div style={{ backgroundColor: '#121217', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '24px', maxWidth: '380px', width: '100%', padding: '28px', position: 'relative' }}>
            <button onClick={() => setShowAuthModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', color: '#8E8E9F', background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={18} />
            </button>

            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <CreatorCoreLogo size={40} />
              <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '12px 0 4px 0', color: '#FFFFFF' }}>
                {authMode === 'signin' ? 'Welcome Back' : 'Join Creator Core'}
              </h3>
              <p style={{ fontSize: '12px', color: '#8E8E9F', margin: 0 }}>
                {authMode === 'signin' ? 'Sign in to track payouts and claim bounties' : 'Create an account to start earning'}
              </p>
            </div>

            {authError && (
              <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#F87171', fontSize: '12px', padding: '8px', borderRadius: '8px', marginBottom: '12px', textAlign: 'center' }}>
                {authError}
              </div>
            )}

            <button onClick={handleGoogleLogin} disabled={authLoading} style={{ width: '100%', backgroundColor: '#FFFFFF', color: '#000000', fontWeight: 700, fontSize: '13px', padding: '11px', borderRadius: '12px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continue with Google
            </button>

            <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {authMode === 'signup' && (
                <input required placeholder="Your Name" value={authName} onChange={(e) => setAuthName(e.target.value)} style={{ backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '13px' }} />
              )}
              <input required type="email" placeholder="Email address" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} style={{ backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '13px' }} />
              <input required type="password" minLength={6} placeholder="Password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} style={{ backgroundColor: '#09090D', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px', padding: '10px 12px', color: '#FFFFFF', fontSize: '13px' }} />

              <button type="submit" disabled={authLoading} style={{ marginTop: '4px', background: 'linear-gradient(135deg, #887DFF 0%, #C988FF 100%)', color: '#FFFFFF', fontWeight: 700, fontSize: '13px', padding: '11px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
                {authLoading ? 'Working...' : authMode === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              {authMode === 'signin' ? (
                <span style={{ fontSize: '12px', color: '#8E8E9F' }}>
                  New here? <button onClick={() => setAuthMode('signup')} style={{ color: '#C988FF', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Create account</button>
                </span>
              ) : (
                <span style={{ fontSize: '12px', color: '#8E8E9F' }}>
                  Have an account? <button onClick={() => setAuthMode('signin')} style={{ color: '#C988FF', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>Sign in</button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}