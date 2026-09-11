'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Award, CheckCircle, MessageSquare, Shield, Trash2, 
  PauseCircle, PlayCircle, ExternalLink, Copy, Check, 
  Lock, Send, Link as LinkIcon, PlusCircle 
} from 'lucide-react';

// Default Admin PIN to enter the Admin Control Center
const ADMIN_PIN = "8888";

export default function App() {
  const [activeTab, setActiveTab] = useState('campaigns');
  const [userName, setUserName] = useState('');
  
  // Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);

  // Data States
  const [campaigns, setCampaigns] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [messages, setMessages] = useState([]);
  const [copiedUpi, setCopiedUpi] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form States
  const [chatInput, setChatInput] = useState('');
  const [submissionForm, setSubmissionForm] = useState({
    campaign_id: '',
    creator_handle: '',
    reel_url: '',
    views_claimed: '',
    upi_id: '',
  });

  const [newCampaign, setNewCampaign] = useState({
    creator_name: '',
    title: '',
    reward_inr: '',
    guidelines: '',
    assets_url: '',
  });

  useEffect(() => {
    fetchCampaigns();
    fetchSubmissions();
    fetchMessages();

    // Listen for live messages in chat
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

  const fetchCampaigns = async () => {
    const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
    if (error) {
      console.error('Fetch campaigns error:', error);
    } else if (data) {
      setCampaigns(data);
      if (data.length > 0 && !submissionForm.campaign_id) {
        setSubmissionForm((prev) => ({ ...prev, campaign_id: data[0].id }));
      }
    }
  };

  const fetchSubmissions = async () => {
    const { data, error } = await supabase.from('submissions').select('*, campaigns(title)').order('created_at', { ascending: false });
    if (error) {
      console.error('Fetch submissions error:', error);
    } else if (data) {
      setSubmissions(data);
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true });
    if (error) {
      console.error('Fetch messages error:', error);
    } else if (data) {
      setMessages(data);
    }
  };

  // Admin PIN verification
  const handlePinSubmit = (e) => {
    e.preventDefault();
    if (pinInput.trim() === ADMIN_PIN) {
      setIsAdmin(true);
      setPinError(false);
      setPinInput('');
    } else {
      setPinError(true);
    }
  };

  // Campaign management
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const cleanReward = parseInt(newCampaign.reward_inr, 10) || 0;
    
    const { data, error } = await supabase.from('campaigns').insert([{
      creator_name: newCampaign.creator_name.trim(),
      title: newCampaign.title.trim(),
      reward_inr: cleanReward,
      guidelines: newCampaign.guidelines.trim(),
      assets_url: newCampaign.assets_url ? newCampaign.assets_url.trim() : '',
      status: 'ACTIVE'
    }]).select();

    setIsSubmitting(false);

    if (error) {
      alert('Error creating campaign:\n\n' + error.message);
      console.error(error);
    } else {
      alert('Campaign launched successfully!');
      setNewCampaign({ creator_name: '', title: '', reward_inr: '', guidelines: '', assets_url: '' });
      fetchCampaigns();
    }
  };

  const toggleCampaignStatus = async (id, currentStatus) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const { error } = await supabase.from('campaigns').update({ status: nextStatus }).eq('id', id);
    if (error) alert('Error updating status: ' + error.message);
    fetchCampaigns();
  };

  const deleteCampaign = async (id) => {
    if (confirm('Delete this campaign and all related submissions?')) {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) alert('Error deleting: ' + error.message);
      fetchCampaigns();
      fetchSubmissions();
    }
  };

  // Submissions management
  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!submissionForm.campaign_id) return alert('Please select a campaign first.');
    if (!submissionForm.reel_url || !submissionForm.upi_id) return alert('Please fill in all fields.');

    setIsSubmitting(true);

    const { error } = await supabase.from('submissions').insert([{
      campaign_id: submissionForm.campaign_id,
      creator_handle: submissionForm.creator_handle.trim(),
      reel_url: submissionForm.reel_url.trim(),
      views_claimed: parseInt(submissionForm.views_claimed, 10) || 0,
      upi_id: submissionForm.upi_id.trim(),
      status: 'PENDING'
    }]);

    setIsSubmitting(false);

    if (error) {
      alert('Error submitting proof:\n\n' + error.message);
      console.error(error);
    } else {
      alert('Submission received! Admin will review your reel and send the reward to your UPI.');
      setSubmissionForm({ ...submissionForm, creator_handle: '', reel_url: '', views_claimed: '', upi_id: '' });
      fetchSubmissions();
      setActiveTab('campaigns');
    }
  };

  const updateSubmissionStatus = async (id, status) => {
    const { error } = await supabase.from('submissions').update({ status }).eq('id', id);
    if (error) alert('Error updating status: ' + error.message);
    fetchSubmissions();
  };

  const deleteSubmission = async (id) => {
    if (confirm('Delete this submission record?')) {
      const { error } = await supabase.from('submissions').delete().eq('id', id);
      if (error) alert('Error deleting: ' + error.message);
      fetchSubmissions();
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedUpi(text);
    setTimeout(() => setCopiedUpi(''), 2000);
  };

  // Community Chat
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const sender = userName.trim() || 'Editor';
    const { error } = await supabase.from('messages').insert([{ sender_name: sender, content: chatInput.trim() }]);
    if (error) alert('Error sending message: ' + error.message);
    setChatInput('');
  };

  const deleteChatMessage = async (id) => {
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) alert('Error deleting message: ' + error.message);
    fetchMessages();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* Header */}
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
          { id: 'campaigns', label: 'Bounties', icon: Award },
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

      {/* Content Area */}
      <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
        {/* ================= TAB 1: BOUNTIES ================= */}
        {activeTab === 'campaigns' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white mb-2">Available Instagram Bounties</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {campaigns.filter(c => c.status === 'ACTIVE').length === 0 ? (
                <div className="col-span-2 text-center py-16 text-neutral-500 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                  No active bounties right now. Go to the Admin Dashboard to create one!
                </div>
              ) : (
                campaigns.filter(c => c.status === 'ACTIVE').map((c) => (
                  <div key={c.id} className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-xs font-semibold px-2.5 py-1 bg-neutral-800 text-neutral-300 rounded-full">
                          @{c.creator_name}
                        </span>
                        <span className="text-amber-400 font-extrabold text-xl">₹{c.reward_inr}</span>
                      </div>
                      <h3 className="font-bold text-lg text-neutral-100">{c.title}</h3>
                      <p className="text-sm text-neutral-400 mt-2 whitespace-pre-line">{c.guidelines}</p>
                      
                      {c.assets_url && (
                        <a
                          href={c.assets_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:underline mt-3 bg-neutral-800/80 px-3 py-1.5 rounded-lg border border-neutral-700"
                        >
                          <LinkIcon className="w-3.5 h-3.5" /> Download Video Assets / Audio (Drive)
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setSubmissionForm((prev) => ({ ...prev, campaign_id: c.id }));
                        setActiveTab('submit');
                      }}
                      className="mt-5 w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2.5 rounded-lg text-sm transition-colors"
                    >
                      Submit Reel Proof
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 2: SUBMIT PROOF ================= */}
        {activeTab === 'submit' && (
          <div className="max-w-lg mx-auto bg-neutral-900 border border-neutral-800 p-6 rounded-xl">
            <h2 className="text-lg font-bold mb-1">Submit Reel for Verification</h2>
            <p className="text-xs text-neutral-400 mb-5">Once verified, your bounty reward is sent directly to your UPI ID.</p>
            <form onSubmit={handleSubmitProof} className="space-y-4">
              <div>
                <label className="text-xs text-neutral-400 font-medium">Select Bounty</label>
                <select
                  value={submissionForm.campaign_id}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, campaign_id: e.target.value })}
                  className="w-full mt-1 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm text-neutral-200"
                  required
                >
                  <option value="" disabled>Choose a campaign...</option>
                  {campaigns.filter(c => c.status === 'ACTIVE').map((c) => (
                    <option key={c.id} value={c.id}>{c.title} (₹{c.reward_inr})</option>
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
                  placeholder="e.g. 10000"
                  value={submissionForm.views_claimed}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, views_claimed: e.target.value })}
                  className="w-full mt-1 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-400 font-medium">Your UPI ID (For Direct INR Transfer)</label>
                <input
                  required
                  placeholder="name@okaxis, mobile@paytm, etc."
                  value={submissionForm.upi_id}
                  onChange={(e) => setSubmissionForm({ ...submissionForm, upi_id: e.target.value })}
                  className="w-full mt-1 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                />
              </div>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold py-2.5 rounded-lg text-sm transition-colors"
              >
                {isSubmitting ? 'Submitting...' : 'Submit for Verification'}
              </button>
            </form>
          </div>
        )}

        {/* ================= TAB 3: COMMUNITY CHAT ================= */}
        {activeTab === 'chat' && (
          <div className="flex flex-col h-[550px] bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
            <div className="p-3.5 border-b border-neutral-800 bg-neutral-800/40 flex justify-between items-center">
              <span className="text-xs font-semibold text-neutral-300">Creator & Editor Community Hub</span>
              {isAdmin && <span className="text-[10px] bg-amber-950 text-amber-400 px-2 py-0.5 rounded border border-amber-800">Admin Mode Active</span>}
            </div>
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
              {messages.length === 0 ? (
                <p className="text-neutral-500 text-sm text-center mt-20">No messages yet. Start the conversation!</p>
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
                        title="Delete message"
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
                placeholder="Share editing ideas, trending audio, or collab requests..."
                className="flex-1 bg-neutral-800 border border-neutral-700 px-3 py-2 rounded-lg text-sm outline-none"
              />
              <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-lg font-medium">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ================= TAB 4: ADMIN DASHBOARD ================= */}
        {activeTab === 'admin' && (
          <div>
            {!isAdmin ? (
              // Locked Screen
              <div className="max-w-sm mx-auto bg-neutral-900 border border-neutral-800 p-6 rounded-xl text-center mt-12">
                <Shield className="w-10 h-10 text-amber-400 mx-auto mb-3" />
                <h3 className="font-bold text-lg mb-1">Admin Access Only</h3>
                <p className="text-xs text-neutral-400 mb-4">Enter your 4-digit PIN to manage bounties, copy UPI IDs, and review submissions.</p>
                <form onSubmit={handlePinSubmit} className="space-y-3">
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="Enter PIN (Default: 8888)"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full text-center bg-neutral-800 border border-neutral-700 py-2 rounded-lg text-lg tracking-widest outline-none focus:border-amber-400"
                  />
                  {pinError && <p className="text-xs text-red-400">Incorrect PIN. (Default is 8888)</p>}
                  <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black font-semibold py-2 rounded-lg text-sm">
                    Unlock Dashboard
                  </button>
                </form>
              </div>
            ) : (
              // Unlocked Workspace
              <div className="space-y-8">
                {/* 1. Add New Campaign */}
                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                  <h3 className="font-bold text-base mb-3 flex items-center gap-2">
                    <PlusCircle className="w-5 h-5 text-amber-400" /> Launch New Bounty Campaign
                  </h3>
                  <form onSubmit={handleCreateCampaign} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      required
                      placeholder="Target Instagram Handle (e.g. FitRaj)"
                      value={newCampaign.creator_name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, creator_name: e.target.value })}
                      className="bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                    />
                    <input
                      required
                      type="number"
                      placeholder="Reward in ₹ (e.g. 500)"
                      value={newCampaign.reward_inr}
                      onChange={(e) => setNewCampaign({ ...newCampaign, reward_inr: e.target.value })}
                      className="bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                    />
                    <input
                      required
                      placeholder="Campaign Title (e.g. Best 25s Clip from Episode #10)"
                      value={newCampaign.title}
                      onChange={(e) => setNewCampaign({ ...newCampaign, title: e.target.value })}
                      className="md:col-span-2 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                    />
                    <input
                      placeholder="Raw Assets / Video Clips Link (Google Drive, Dropbox folder link)"
                      value={newCampaign.assets_url}
                      onChange={(e) => setNewCampaign({ ...newCampaign, assets_url: e.target.value })}
                      className="md:col-span-2 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                    />
                    <textarea
                      required
                      placeholder="Rules & Guidelines (e.g. Must tag account, audio link to use, minimum views...)"
                      value={newCampaign.guidelines}
                      onChange={(e) => setNewCampaign({ ...newCampaign, guidelines: e.target.value })}
                      className="md:col-span-2 bg-neutral-800 border border-neutral-700 p-2.5 rounded-lg text-sm"
                      rows={3}
                    />
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="md:col-span-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black py-2.5 rounded-lg font-bold text-sm transition-colors"
                    >
                      {isSubmitting ? 'Publishing...' : 'Publish to Live Board'}
                    </button>
                  </form>
                </div>

                {/* 2. Manage Campaigns */}
                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-xl">
                  <h3 className="font-bold text-base mb-3">Manage Existing Campaigns</h3>
                  <div className="space-y-2">
                    {campaigns.map((c) => (
                      <div key={c.id} className="bg-neutral-800/50 p-3 rounded-lg flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{c.title}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${c.status === 'ACTIVE' ? 'bg-emerald-950 text-emerald-400' : 'bg-neutral-700 text-neutral-300'}`}>
                              {c.status}
                            </span>
                          </div>
                          <span className="text-xs text-neutral-400">@{c.creator_name} • ₹{c.reward_inr}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleCampaignStatus(c.id, c.status)}
                            className="text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 px-3 py-1.5 rounded-lg flex items-center gap-1"
                          >
                            {c.status === 'ACTIVE' ? <><PauseCircle className="w-3.5 h-3.5 text-amber-400" /> Pause</> : <><PlayCircle className="w-3.5 h-3.5 text-emerald-400" /> Resume</>}
                          </button>
                          <button
                            onClick={() => deleteCampaign(c.id)}
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
                          <th>UPI ID (Click to Copy)</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800">
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
                                {copiedUpi === s.upi_id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
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