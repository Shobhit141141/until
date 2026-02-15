
export type StacksTxApiResponse = {
  tx_id: string;
  tx_status: string;
  sender_address: string;
  /** Present when tx is in an anchored block. Required for confirmation. */
  block_height?: number;
  /** True if tx is in a microblock not yet confirmed by an anchor block. Do not credit until false. */
  is_unanchored?: boolean;
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
