'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Award, Briefcase, CheckCircle, MessageSquare, Shield, Trash2, 
  PauseCircle, PlayCircle, ExternalLink, Copy, Check, 
  Lock, Send, Link as LinkIcon, PlusCircle, Trophy, Clock, Flame, DollarSign
} from 'lucide-react';

// Secure Admin PIN pulled directly from environment variables (defaults to 8888)
const ADMIN_PIN = process.env.NEXT_PUBLIC_ADMIN_PIN || "8888";

export default function App() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [userName, setUserName] = useState('');
  
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
    type: 'CAMPAIGN', // 'CAMPAIGN' or 'BOUNTY'
    creator_name: '',
    title: '',
    reward_inr: '',
    total_budget: '',
    deadline: '',
    guidelines: '',
    assets_url: '',
  });

  useEffect(() => {
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
      supabase.removeChannel(channel);
    };
  }, []);

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
      alert('Error creating item: ' + error.message);
    } else {
      alert(`${newItem.type === 'CAMPAIGN' ? 'Campaign' : 'Bounty'} posted successfully!`);
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
    if (!submissionForm.reel_url || !submissionForm.upi_id) return alert('Please fill in all required fields.');

    // Check if campaign is expired or exhausted
    const targetItem = items.find(i => i.id === submissionForm.campaign_id);
    if (targetItem) {
      if (targetItem.deadline && new Date(targetItem.deadline) < new Date()) {
        return alert('This campaign has already reached its deadline.');
      }
    }

    const { error } = await supabase.from('submissions').insert([{
      campaign_id: submissionForm.campaign_id,
      creator_handle: submissionForm.creator_handle,
      reel_url: submissionForm.reel_url,
      views_claimed: parseInt(submissionForm.views_claimed) || 0,
      upi_id: submissionForm.upi_id,
      status: 'PENDING'
    }]);

    if (!error) {
      alert('Submission received! Admin will review your work and process the UPI reward.');
      setSubmissionForm({ ...submissionForm, creator_handle: '', reel_url: '', views_claimed: '', upi_id: '' });
      fetchSubmissions();
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
    if (!chatInput.trim()) return;
    const sender = userName.trim() || 'Creator';
    await supabase.from('messages').insert([{ sender_name: sender, content: chatInput.trim() }]);
    setChatInput('');
  };

  const deleteChatMessage = async (id) => {
    await supabase.from('messages').delete().eq('id', id);
    fetchMessages();
  };

  // Helper for budget calculation
  const getBudgetStatus = (item) => {
    if (!item.total_budget || item.total_budget <= 0) return null;
    const paidAmount = submissions
      .filter(s => s.campaign_id === item.id && s.status === 'PAID')
      .reduce((acc, s) => acc + (item.reward_inr || 0), 0);
    const remaining = Math.max(0, item.total_budget - paidAmount);
    const percent = Math.min(100, Math.round((paidAmount / item.total_budget) * 100));
    return { paidAmount, remaining, percent, isExhausted: remaining <= 0 };
  };

  // Leaderboard Calculation (Grouped by Creator Handle for PAID payouts)
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
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      <header className="border-b border-neutral-800 bg-neutral-900/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <Award className="text-amber-400 w-6 h-6" />
          <span className="font-extrabold text-lg tracking-tight">ReelBounty India</span>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Your Name / Handle"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 px-3 py-1.5 rounded-lg text-sm outline-none focus:border-amber-400 w-36 sm:w-48"
          />
          {isAdmin && (
            <button
              onClick={() => setIsAdmin(false)}
              className="flex items-center gap-1 text-xs bg-red-950 text-red-400 border border-red-800 px-2.5 py-1.5 rounded-lg hover:bg-red-900 transition-colors"
            >
              <Lock className="w-3 h-3" /> Lock Admin
            </button>
          )}
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="flex border-b border-neutral-800 px-6 bg-neutral-900/40 gap-4 sm:gap-6 overflow-x-auto">
        {[
          { id: 'campaigns', label: 'Campaigns', icon: Briefcase },
          { id: 'bounties', label: 'Bounties', icon: Award },
          { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
          { id: 'submit', label: 'Submit Proof', icon: CheckCircle },
          { id: 'chat', label: 'Community Chat', icon: MessageSquare },
          { id: 'admin', label: 'Admin Dashboard', icon: Shield },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'border-amber-400 text-amber-400' : 'border-transparent text-neutral-400 hover:text-white'
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
              <h2 className="text-xl font-bold text-white">Active Campaigns</h2>
              <span className="text-xs text-neutral-400">{activeCampaigns.length} campaigns open</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {activeCampaigns.length === 0 ? (
                <div className="col-span-2 text-center py-16 text-neutral-500 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                  No active campaigns yet. Switch to Admin Dashboard to launch one!
                </div>
              ) : (
                activeCampaigns.map((c) => {
                  const budgetInfo = getBudgetStatus(c);
                  const isExpired = c.deadline && new Date(c.deadline) < new Date();

                  return (
                    <div key={c.id} className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold px-2.5 py-1 bg-amber-950 text-amber-400 border border-amber-800/60 rounded-full">
                            Campaign • @{c.creator_name}
                          </span>
                          <span className="text-amber-400 font-extrabold text-xl">₹{c.reward_inr}</span>
                        </div>
                        <h3 className="font-bold text-lg text-neutral-100">{c.title}</h3>
                        
                        {/* Budget Bar & Deadline info */}
                        <div className="flex flex-wrap items-center gap-3 my-3 text-xs text-neutral-400">
                          {c.deadline && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                              isExpired ? 'bg-red-950 text-red-400 border-red-800' : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {isExpired ? 'Deadline Passed' : `Ends: ${c.deadline}`}
                            </div>
                          )}
                          {budgetInfo && (
                            <div className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded text-neutral-300">
                              <DollarSign className="w-3 h-3 text-amber-400" />
                              Remaining Pool: ₹{budgetInfo.remaining} / ₹{c.total_budget}
                            </div>
                          )}
                        </div>

                        {budgetInfo && (
                          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-3">
                            <div className="bg-amber-400 h-full transition-all" style={{ width: `${budgetInfo.percent}%` }} />
                          </div>
                        )}

                        <p className="text-sm text-neutral-400 mt-2 whitespace-pre-line">{c.guidelines}</p>
                        
                        {c.assets_url && (
                          <a
                            href={c.assets_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline mt-3 bg-neutral-800/80 px-3 py-1.5 rounded-lg border border-neutral-700"
                          >
                            <LinkIcon className="w-3.5 h-3.5" /> Campaign Assets / Drive Folder
                          </a>
                        )}
                      </div>
                      <button
                        disabled={isExpired || budgetInfo?.isExhausted}
                        onClick={() => {
                          setSubmissionForm((prev) => ({ ...prev, campaign_id: c.id }));
                          setActiveTab('submit');
                        }}
                        className={`mt-5 w-full font-semibold py-2.5 rounded-lg text-sm transition-colors ${
                          isExpired || budgetInfo?.isExhausted
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            : 'bg-amber-500 hover:bg-amber-400 text-black'
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
              <h2 className="text-xl font-bold text-white">Active Reel Bounties</h2>
              <span className="text-xs text-neutral-400">{activeBounties.length} bounties open</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {activeBounties.length === 0 ? (
                <div className="col-span-2 text-center py-16 text-neutral-500 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                  No active bounties right now. Go to Admin Dashboard to add one!
                </div>
              ) : (
                activeBounties.map((b) => {
                  const budgetInfo = getBudgetStatus(b);
                  const isExpired = b.deadline && new Date(b.deadline) < new Date();

                  return (
                    <div key={b.id} className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-950 text-emerald-400 border border-emerald-800/60 rounded-full">
                            Bounty • @{b.creator_name}
                          </span>
                          <span className="text-emerald-400 font-extrabold text-xl">₹{b.reward_inr}</span>
                        </div>
                        <h3 className="font-bold text-lg text-neutral-100">{b.title}</h3>
                        
                        {/* Budget Bar & Deadline info */}
                        <div className="flex flex-wrap items-center gap-3 my-3 text-xs text-neutral-400">
                          {b.deadline && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded border ${
                              isExpired ? 'bg-red-950 text-red-400 border-red-800' : 'bg-neutral-800 border-neutral-700 text-neutral-300'
                            }`}>
                              <Clock className="w-3 h-3" />
                              {isExpired ? 'Deadline Passed' : `Ends: ${b.deadline}`}
                            </div>
                          )}
                          {budgetInfo && (
                            <div className="flex items-center gap-1 bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded text-neutral-300">
                              <DollarSign className="w-3 h-3 text-emerald-400" />
                              Remaining Pool: ₹{budgetInfo.remaining} / ₹{b.total_budget}
                            </div>
                          )}
                        </div>

                        {budgetInfo && (
                          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-3">
                            <div className="bg-emerald-400 h-full transition-all" style={{ width: `${budgetInfo.percent}%` }} />
                          </div>
                        )}

                        <p className="text-sm text-neutral-400 mt-2 whitespace-pre-line">{b.guidelines}</p>
                        
                        {b.assets_url && (
                          <a
                            href={b.assets_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline mt-3 bg-neutral-800/80 px-3 py-1.5 rounded-lg border border-neutral-700"
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
                        className={`mt-5 w-full font-semibold py-2.5 rounded-lg text-sm transition-colors ${
                          isExpired || budgetInfo?.isExhausted
                            ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                            : 'bg-emerald-500 hover:bg-emerald-400 text-black'
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

        {/* ================= TAB 3: LEADERBOARD (#5) ================= */}
        {activeTab === 'leaderboard' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-full mb-2">
                <Trophy className="w-6 h-6 text-amber-400" />
              </div>
              <h2 className="text-2xl font-extrabold text-white">Creator Hall of Fame</h2>
              <p className="text-sm text-neutral-400">Top creators earning via verified bounties & viral views</p>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-16 text-neutral-500 bg-neutral-900 border border-neutral-800 rounded-xl">
                No payouts recorded yet. The first creators paid will rank here!
              </div>
            ) : (
              <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-neutral-400 bg-neutral-800/40 border-b border-neutral-800">
                    <tr>
                      <th className="py-3 px-4">Rank</th>
                      <th>Creator</th>
                      <th>Bounties Won</th>
                      <th>Total Views</th>
                      <th className="text-right px-4">Total Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y border-neutral-800">
                    {leaderboard.map((creator, index) => (
                      <tr key={creator.handle} className="hover:bg-neutral-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-bold">
                          {index === 0 ? '🥇 1st' : index === 1 ? '🥈 2nd' : index === 2 ? '🥉 3rd' : `#${index + 1}`}
                        </td>
                        <td className="font-semibold text-white">
                          <span className="flex items-center gap-1.5">
                            {creator.handle}
                            {index === 0 && <Flame className="w-4 h-4 text-amber-400" />}
                          </span>
                        </td>
                        <td className="text-neutral-300">{creator.paidSubmissions}</td>
                        <td className="text-neutral-300">{creator.totalViews.toLocaleString()}</td>
                        <td className="text-right px-4 font-extrabold text-emerald-400">
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
          <div className="max-w-lg mx-auto bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
            <h2 className="text-lg font-bold mb-1">Submit Proof of Work</h2>
            <p className="text-xs text-neutral-400 mb-5">Select the campaign or bounty you completed to claim your reward via UPI.</p>
            <form onSubmit={handleSubmitProof} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 font-medium">Select Campaign or Bounty</label>
                <select
                  value={submissionForm.campaign_id}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, campaign_id: e.target.value })}
                  className="w-full mt-1 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm text-neutral-200"
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
                  className="w-full mt-1 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 font-medium">Instagram Reel Link</label>
                <input
                  required
                  placeholder="https://www.instagram.com/reel/..."
                  value={submissionForm.reel_url}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, reel_url: e.target.value })}
                  className="w-full mt-1 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
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
                  className="w-full mt-1 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 font-medium">Your UPI ID (For Direct Payout)</label>
                <input
                  required
                  placeholder="username@okhdfcbank, mobile@paytm"
                  value={submissionForm.upi_id}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, upi_id: e.target.value })}
                  className="w-full mt-1 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                />
              </div>
              <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2.5 rounded-lg text-sm transition-colors">
                Submit for Verification
              </button>
            </form>
          </div>
        )}

        {/* ================= TAB 5: COMMUNITY CHAT ================= */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[550px] bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-3.5 border-b border-neutral-800 bg-neutral-800/40 flex justify-between items-center">
              <span className="text-xs font-semibold text-neutral-300">Creator & Editor Hub</span>
              {isAdmin && <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-800">Admin Mode Active</span>}
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
              {messages.length === 0 ? (
                <p className="text-neutral-500 text-sm text-center mt-20">No messages yet. Say hello!</p>
              ) : (
                messages.map((m) => (
                  <div key={m.id} className="text-sm bg-neutral-800/40 p-2.5 rounded-lg flex justify-between items-start group">
                    <div>
                      <span className="font-bold text-amber-400 text-xs">{m.sender_name}: </span>
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
            <form onSubmit={handleSendMessage} className="p-3 bg-neutral-900 border-t border-neutral-800 flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Discuss hooks, video ideas, or collab..."
                className="flex-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-lg text-sm outline-none"
              />
              <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-lg font-medium">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ================= TAB 6: ADMIN DASHBOARD ================= */}
        {activeTab === 'admin' && (
          <div>
            {!isAdmin ? (
              <div className="max-w-sm mx-auto bg-neutral-900 border border-neutral-800 p-6 rounded-xl text-center mt-12">
                <Shield className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-1">Admin Access Only</h3>
                <p className="text-xs text-neutral-400 mb-4">Enter PIN to manage campaigns, bounties, and UPI payouts.</p>
                <form onSubmit={handlePinSubmit} className="space-y-3">
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="Enter Secret PIN"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full text-center bg-neutral-800 border border-neutral-700 py-2 rounded-lg text-lg tracking-widest outline-none focus:border-amber-400"
                  />
                  {pinError && <p className="text-xs text-red-400">Incorrect PIN.</p>}
                  <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2 rounded-lg text-sm">
                    Unlock Dashboard
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-8">
                {/* 1. Post New Item with Budget and Deadline */}
                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-amber-400" /> Create Listing
                  </h3>
                  
                  {/* Category Selector */}
                  <div className="flex gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, type: 'CAMPAIGN' })}
                      className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-all ${
                        newItem.type === 'CAMPAIGN' 
                          ? 'bg-amber-500 text-black border-amber-500' 
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      Post as Campaign
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewItem({ ...newItem, type: 'BOUNTY' })}
                      className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-all ${
                        newItem.type === 'BOUNTY' 
                          ? 'bg-emerald-500 text-black border-emerald-500' 
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      Post as Bounty
                    </button>
                  </div>

                  <form onSubmit={handleCreateItem} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      required
                      placeholder="Brand or Host Handle (e.g. FitRaj)"
                      value={newItem.creator_name}
                      onChange={(e) => setNewItem({ ...newItem, creator_name: e.target.value })}
                      className="bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                    />
                    <input
                      required
                      type="number"
                      placeholder="Reward per Winner in ₹ (e.g. 1000)"
                      value={newItem.reward_inr}
                      onChange={(e) => setNewItem({ ...newItem, reward_inr: e.target.value })}
                      className="bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Total Pool Budget in ₹ (Optional, e.g. 10000)"
                      value={newItem.total_budget}
                      onChange={(e) => setNewItem({ ...newItem, total_budget: e.target.value })}
                      className="bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                    />
                    <input
                      type="date"
                      value={newItem.deadline}
                      onChange={(e) => setNewItem({ ...newItem, deadline: e.target.value })}
                      className="bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm text-neutral-300"
                    />
                    <input
                      required
                      placeholder="Title (e.g. Best 30s Hook Video or Product Review)"
                      value={newItem.title}
                      onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                      className="md:col-span-2 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                    />
                    <input
                      placeholder="Drive or Asset Link (Footage, Logos, Reference Files)"
                      value={newItem.assets_url}
                      onChange={(e) => setNewItem({ ...newItem, assets_url: e.target.value })}
                      className="md:col-span-2 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                    />
                    <textarea
                      required
                      placeholder="Guidelines & Rules (Deliverables, tagging requirements, minimum view metrics...)"
                      value={newItem.guidelines}
                      onChange={(e) => setNewItem({ ...newItem, guidelines: e.target.value })}
                      className="md:col-span-2 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                      rows={3}
                    />
                    <button 
                      type="submit" 
                      className={`md:col-span-2 py-2.5 rounded-lg font-bold text-sm text-black transition-colors ${
                        newItem.type === 'CAMPAIGN' ? 'bg-amber-500 hover:bg-amber-400' : 'bg-emerald-500 hover:bg-emerald-400'
                      }`}
                    >
                      Publish to {newItem.type === 'CAMPAIGN' ? 'Campaign Board' : 'Bounty Board'}
                    </button>
                  </form>
                </div>

                {/* 2. Manage All Items */}
                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                  <h3 className="font-bold text-base mb-3">Manage Active Listings</h3>
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div key={it.id} className="bg-neutral-800/50 p-3 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              it.type === 'BOUNTY' ? 'bg-emerald-950 text-emerald-400 border-emerald-800' : 'bg-amber-950 text-amber-400 border-amber-800'
                            }`}>
                              {it.type || 'CAMPAIGN'}
                            </span>
                            <span className="font-bold text-sm">{it.title}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${it.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-700 text-neutral-300'}`}>
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
                            className="text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-1.5 rounded-lg flex items-center gap-1"
                          >
                            {it.status === 'ACTIVE' ? <><PauseCircle className="w-3.5 h-3.5 text-amber-400" /> Pause</> : <><PlayCircle className="w-3.5 h-3.5 text-emerald-400" /> Resume</>}
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
                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                  <h3 className="font-bold text-base mb-3">Submissions & UPI Payout Desk</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs uppercase text-neutral-400 border-b border-neutral-800">
                        <tr>
                          <th className="py-2.5">Creator</th>
                          <th>Views</th>
                          <th>Reel</th>
                          <th>UPI ID</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-neutral-800">
                        {submissions.map((s) => (
                          <tr key={s.id} className="text-neutral-300">
                            <td className="py-3 font-medium text-white">{s.creator_handle}</td>
                            <td>{s.views_claimed.toLocaleString()}</td>
                            <td>
                              <a href={s.reel_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">
                                Reel <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                            <td>
                              <button
                                onClick={() => copyToClipboard(s.upi_id)}
                                className="inline-flex items-center gap-1 font-mono text-xs bg-neutral-800 hover:bg-neutral-700 px-2 py-1 rounded text-amber-300 border border-neutral-700"
                              >
                                {s.upi_id}
                                {copiedUpi === s.upi_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-neutral-400" />}
                              </button>
                            </td>
                            <td>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                s.status === 'PAID' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                s.status === 'REJECTED' ? 'bg-red-950 text-red-400 border border-red-800' :
                                'bg-amber-950 text-amber-400 border border-amber-800'
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
    </div>
  );
}