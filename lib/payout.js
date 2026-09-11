export async function executeUpiPayout({ transferId, amountInr, upiId, creatorName }) {
  // If Cashfree keys are not configured, simulate an instant mock payout
  if (!process.env.CASHFREE_APP_ID || !process.env.CASHFREE_SECRET_KEY) {
    return {
      success: true,
      txId: `MOCK_TXN_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      mode: 'SIMULATED'
    };
  }

  const isSandbox = process.env.CASHFREE_ENV === 'SANDBOX';
  const baseUrl = isSandbox 
    ? 'https://sandbox.cashfree.com/payout/transfers' 
    : 'https://api.cashfree.com/payout/transfers';

  const payload = {
    transfer_id: transferId,
    transfer_mode: 'upi',
    transfer_amount: parseFloat(amountInr).toFixed(2),
    transfer_currency: 'INR',
    beneficiary_details: {
      beneficiary_name: creatorName || 'Creator',
      beneficiary_vpa: upiId.trim()
    },
    transfer_remarks: 'Creator Core Reward'
  };

  try {
    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Id': process.env.CASHFREE_APP_ID,
        'X-Client-Secret': process.env.CASHFREE_SECRET_KEY,
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok && data.status === 'SUCCESS') {
      return { success: true, txId: data.reference_id || data.transfer_id };
    } else {
      return { success: false, error: data.message || 'Payment provider declined transfer.' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}