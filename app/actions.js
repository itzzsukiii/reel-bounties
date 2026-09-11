'use server';

import { createClient } from '@supabase/supabase-js';
import { fetchLiveViews } from '@/lib/verifySocial';
import { executeUpiPayout } from '@/lib/payout';

// Dedicated server-only admin client that bypasses client RLS securely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyAdmin(callerEmail) {
  if (!callerEmail || callerEmail.toLowerCase() !== process.env.ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Unauthorized access: Admin authorization failed.');
  }
}

// 1. Submit proof with automated social scrape
export async function submitProofAction({ userId, campaignId, creatorHandle, reelUrl, claimedViews, upiId }) {
  if (!userId || !campaignId || !reelUrl || !upiId) {
    return { error: 'Missing required fields.' };
  }

  const { data: campaign, error: campErr } = await supabaseAdmin
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .single();

  if (campErr || !campaign) return { error: 'Target campaign not found.' };

  // Automated Social View Verification
  const verification = await fetchLiveViews(reelUrl);
  if (!verification.success) {
    return { error: `Social Verification Failed: ${verification.error}` };
  }

  // Use scraped views if API available; otherwise fallback to claimed views
  const finalViews = verification.views !== null 
    ? verification.views 
    : (parseInt(claimedViews, 10) || 0);

  // Enforce campaign minimum view threshold
  if (campaign.type !== 'BOUNTY' && campaign.min_views > 0 && finalViews < campaign.min_views) {
    return { 
      error: `Verification Block: Campaign requires minimum ${campaign.min_views.toLocaleString()} views. Found: ${finalViews.toLocaleString()}.` 
    };
  }

  const { data, error } = await supabaseAdmin.from('submissions').insert([{
    user_id: userId,
    campaign_id: campaignId,
    creator_handle: creatorHandle,
    reel_url: reelUrl.trim(),
    views_claimed: finalViews,
    verified_views: finalViews,
    upi_id: upiId.trim(),
    status: 'PENDING'
  }]).select().single();

  if (error) return { error: error.message };
  return { success: true, submission: data };
}

// 2. 1-Click Instant UPI Payout & Approval
export async function approveSubmissionAction({ submissionId, callerEmail }) {
  await verifyAdmin(callerEmail);

  const { data: sub, error: subErr } = await supabaseAdmin
    .from('submissions')
    .select('*, campaigns(*)')
    .eq('id', submissionId)
    .single();

  if (subErr || !sub) return { error: 'Submission record not found.' };
  if (sub.status === 'PAID') return { error: 'This submission has already been paid.' };

  let payoutAmount = 0;
  if (sub.campaigns.type === 'BOUNTY') {
    payoutAmount = Number(sub.campaigns.reward_inr) || 0;
  } else {
    const views = Number(sub.views_claimed) || 0;
    const rate = Number(sub.campaigns.reward_inr) || 0;
    payoutAmount = Math.round((views / 1000) * rate);
  }

  if (payoutAmount <= 0) return { error: 'Calculated payout is 0 INR.' };

  // Dispatch payout via Cashfree or Sandbox Mock
  const payoutResult = await executeUpiPayout({
    transferId: `SUB_${sub.id.slice(0, 8)}_${Date.now()}`,
    amountInr: payoutAmount,
    upiId: sub.upi_id,
    creatorName: sub.creator_handle
  });

  if (!payoutResult.success) {
    await supabaseAdmin
      .from('submissions')
      .update({ payout_error: payoutResult.error })
      .eq('id', sub.id);

    return { error: `Payment Gateway Error: ${payoutResult.error}` };
  }

  const { error: updateErr } = await supabaseAdmin
    .from('submissions')
    .update({
      status: 'PAID',
      payout_tx_id: payoutResult.txId,
      payout_error: null
    })
    .eq('id', sub.id);

  if (updateErr) return { error: updateErr.message };

  return { success: true, txId: payoutResult.txId, amount: payoutAmount };
}

// 3. Reject submission
export async function rejectSubmissionAction({ submissionId, callerEmail }) {
  await verifyAdmin(callerEmail);
  const { error } = await supabaseAdmin
    .from('submissions')
    .update({ status: 'REJECTED' })
    .eq('id', submissionId);

  if (error) return { error: error.message };
  return { success: true };
}

// 4. Delete listing
export async function deleteListingAction({ listingId, callerEmail }) {
  await verifyAdmin(callerEmail);
  await supabaseAdmin.from('submissions').delete().eq('campaign_id', listingId);
  const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', listingId);
  if (error) return { error: error.message };
  return { success: true };
}

// 5. Toggle status
export async function toggleListingStatusAction({ listingId, currentStatus, callerEmail }) {
  await verifyAdmin(callerEmail);
  const nextStatus = currentStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
  const { error } = await supabaseAdmin
    .from('campaigns')
    .update({ status: nextStatus })
    .eq('id', listingId);

  if (error) return { error: error.message };
  return { success: true };
}