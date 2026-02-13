
export type StacksTxApiResponse = {
  tx_id: string;
  tx_status: string;
  sender_address: string;
  token_transfer?: {
    recipient_address: string;
    amount: string;
    memo?: string;
  };
};

export type PaymentVerificationExpected = {
  recipientAddress: string;
  amountMicroStx: bigint | number;
  nonce: string;
};

export type PaymentVerificationSuccess = {
  ok: true;
  senderAddress: string;
};

export type PaymentVerificationFailure = {
  ok: false;
  reason: string;
};

export type PaymentVerificationResult =
  | PaymentVerificationSuccess
  | PaymentVerificationFailure;
